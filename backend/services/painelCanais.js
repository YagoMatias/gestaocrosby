// ─────────────────────────────────────────────────────────────────────────
// Painel de Vendas → totais por canal de VENDEDOR (fonte canônica única).
//
// Lê a tabela forecast_painel_vendas (sincronizada do "Painel de Vendas" do
// TOTVS, campo seller_sale_value — que JÁ vem líquido por vendedor) e devolve
// os totais dos 4 canais baseados em vendedor:
//   • revenda        (B2R)
//   • multimarcas    (B2M, exceto David/Rafael)
//   • inbound_david  (B2M, dealers 26/69)
//   • inbound_rafael (B2M, dealer 21)
//
// É a MESMA base que o Forecast (buildVendedoresLiquido) usa. Serve pra
// unificar Métricas por Canal / canal-totals / Dashboard com a Promessa.
//
// `hasData=false` quando o período não tem NENHUMA linha no painel — nesse
// caso o chamador NÃO deve sobrescrever (evita zerar histórico não sincronizado).
// ─────────────────────────────────────────────────────────────────────────
import supabase from '../config/supabase.js';

// Grupos espelham os do Forecast (VEND_MENSAL_GROUPS em forecast.routes.js).
const B2R = {
  branchs: [2, 5, 75, 99, 200],
  sellers: [25, 15, 161, 165, 241, 779, 288, 251, 131, 94, 1924, 7044],
};
const B2M = {
  branchs: [99],
  sellers: [65, 177, 259, 26, 21, 69],
};
const INBOUND_DAVID = new Set([26, 69]);
const INBOUND_RAFAEL = new Set([21]);

function toYmd(d) {
  if (!d) return d;
  if (typeof d === 'string') return d.slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

// Soma o valor do painel (positivos) por vendedor permitido, paginando.
// Retorna { perSeller: Map(code → { valor, nome }), totalRows }.
async function somaGrupo(g, dmin, dmax) {
  const sellers = new Set(g.sellers.map(Number));
  const branchs = g.branchs.map(Number);
  const perSeller = new Map();
  let totalRows = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('forecast_painel_vendas')
      .select('seller_code, seller_name, branch_code, valor')
      .gte('data', toYmd(dmin))
      .lte('data', toYmd(dmax))
      .in('branch_code', branchs)
      .order('data', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    totalRows += data.length;
    for (const r of data) {
      const code = Number(r.seller_code);
      const v = Number(r.valor || 0);
      if (v <= 0) continue; // GERAL / ajustes negativos não são vendedor
      if (!sellers.has(code)) continue;
      const cur = perSeller.get(code) || { valor: 0, nome: r.seller_name };
      cur.valor += v;
      if (r.seller_name) cur.nome = r.seller_name;
      perSeller.set(code, cur);
    }
    if (data.length < 1000) break;
  }
  return { perSeller, totalRows };
}

const round = (x) => Math.round(x * 100) / 100;

/**
 * Totais dos 4 canais de vendedor (pra fat-seg / Métricas por Canal).
 * Retorna { hasData, revenda, multimarcas, inbound_david, inbound_rafael }.
 */
export async function getPainelSellerCanais(dmin, dmax) {
  try {
    const [b2r, b2m] = await Promise.all([
      somaGrupo(B2R, dmin, dmax),
      somaGrupo(B2M, dmin, dmax),
    ]);
    const hasData = b2r.totalRows > 0 || b2m.totalRows > 0;
    if (!hasData) return { hasData: false };

    let revenda = 0;
    for (const s of b2r.perSeller.values()) revenda += s.valor;
    let multimarcas = 0;
    let inbound_david = 0;
    let inbound_rafael = 0;
    for (const [code, s] of b2m.perSeller) {
      if (INBOUND_DAVID.has(code)) inbound_david += s.valor;
      else if (INBOUND_RAFAEL.has(code)) inbound_rafael += s.valor;
      else multimarcas += s.valor;
    }
    return {
      hasData: true,
      revenda: round(revenda),
      multimarcas: round(multimarcas),
      inbound_david: round(inbound_david),
      inbound_rafael: round(inbound_rafael),
    };
  } catch (e) {
    console.warn(`[painelCanais] ${e.message}`);
    return { hasData: false };
  }
}

// Filtra os vendedores de um Map perSeller conforme o modulo.
function filtraModulo(perSeller, modulo) {
  const out = [];
  for (const [code, s] of perSeller) {
    const inDavid = INBOUND_DAVID.has(code);
    const inRafael = INBOUND_RAFAEL.has(code);
    if (modulo === 'inbound_david' && !inDavid) continue;
    if (modulo === 'inbound_rafael' && !inRafael) continue;
    if (modulo === 'multimarcas' && (inDavid || inRafael)) continue;
    // revenda: todos os do B2R (sem inbound, que é B2M)
    out.push({
      seller_code: code,
      seller_name: s.nome || `Vend. ${code}`,
      invoice_value: round(s.valor),
    });
  }
  return out.sort((a, b) => b.invoice_value - a.invoice_value);
}

/**
 * Por vendedor de UM canal (pra /canal-totals).
 * Retorna { hasData, total, per_seller:[{seller_code, seller_name, invoice_value}] }.
 */
export async function getPainelPerSeller(modulo, dmin, dmax) {
  const CANAIS = ['revenda', 'multimarcas', 'inbound_david', 'inbound_rafael'];
  if (!CANAIS.includes(modulo)) return { hasData: false };
  try {
    const grupo = modulo === 'revenda' ? B2R : B2M;
    const { perSeller, totalRows } = await somaGrupo(grupo, dmin, dmax);
    if (totalRows === 0) return { hasData: false };
    const per_seller = filtraModulo(perSeller, modulo);
    const total = round(per_seller.reduce((a, s) => a + s.invoice_value, 0));
    return { hasData: true, total, per_seller };
  } catch (e) {
    console.warn(`[painelCanais perSeller ${modulo}] ${e.message}`);
    return { hasData: false };
  }
}

export default getPainelSellerCanais;
