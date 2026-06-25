// Faturamento Detalhado por Canal — UM card consolidado.
// Junta lojas do Varejo + vendedores do Multimarcas numa lista única,
// ordenada por valor. Cada linha exibe ícone, nome, tag do canal, valor e %.
// Endpoint: GET /api/forecast/ontem-vendedor-loja
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChartBar, Storefront, User, Package, Buildings, TShirt, Briefcase, Tag } from '@phosphor-icons/react';
import { toPng } from 'html-to-image';
import { API_BASE_URL } from '../../config/constants';
import { MetricaHeader, LoadingValue, formatBRL } from './MetricasDiariasUI';

const fmtDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
};

// Cache localStorage — exibe instantâneo no mount, atualiza em background.
// TTL 30min (intra-dia muda pouco; cron canal_totals_cache também não é
// mais frequente que isso).
const LS_PREFIX = 'ovl-cache-v24:'; // v24 = fix Cleiton duplicado (matches CLEYTON+CLEITON unifica)
const LS_TTL_MS = 30 * 60 * 1000;
const lsKey = (periodo, datemin, datemax) =>
  `${LS_PREFIX}${periodo || 'ontem'}|${datemin || ''}|${datemax || ''}`;
const lsRead = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!ts || !data) return null;
    return { ts, data, age: Date.now() - ts };
  } catch { return null; }
};
const lsWrite = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); }
  catch { /* quota? ignora */ }
};

// Config visual por canal — tag/pill + cor da barra
// IMPORTANTE: `border` precisa ser string literal (Tailwind JIT não detecta
// classes geradas em runtime tipo `bg-X-500`.replace('bg-','border-')).
const CANAL_CFG = {
  varejo: {
    label: 'Varejo',
    icon: Storefront,
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    bar: 'bg-blue-500',
    border: 'border-blue-500',
    tag: 'bg-blue-100 text-blue-700 ring-blue-200',
  },
  multimarcas: {
    label: 'Multimarcas',
    icon: User,
    text: 'text-purple-700',
    bg: 'bg-purple-50',
    bar: 'bg-purple-500',
    border: 'border-purple-500',
    tag: 'bg-purple-100 text-purple-700 ring-purple-200',
  },
  revenda: {
    label: 'Revenda',
    icon: Package,
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    bar: 'bg-emerald-500',
    border: 'border-emerald-500',
    tag: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  },
  franquia: {
    label: 'Franquia',
    icon: Buildings,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    bar: 'bg-amber-500',
    border: 'border-amber-500',
    tag: 'bg-amber-100 text-amber-700 ring-amber-200',
  },
  fabrica: {
    label: 'Showroom + Nov. Franq.',
    icon: Briefcase,
    text: 'text-cyan-700',
    bg: 'bg-cyan-50',
    bar: 'bg-cyan-500',
    border: 'border-cyan-500',
    tag: 'bg-cyan-100 text-cyan-700 ring-cyan-200',
  },
  inbound_david: {
    label: 'MTM Inbound David',
    icon: TShirt,
    text: 'text-pink-700',
    bg: 'bg-pink-50',
    bar: 'bg-pink-500',
    border: 'border-pink-500',
    tag: 'bg-pink-100 text-pink-700 ring-pink-200',
  },
  inbound_rafael: {
    label: 'MTM Inbound Rafael',
    icon: TShirt,
    text: 'text-fuchsia-700',
    bg: 'bg-fuchsia-50',
    bar: 'bg-fuchsia-500',
    border: 'border-fuchsia-500',
    tag: 'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200',
  },
  bazar: {
    label: 'Bazar',
    icon: Tag,
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    bar: 'bg-orange-500',
    border: 'border-orange-500',
    tag: 'bg-orange-100 text-orange-700 ring-orange-200',
  },
  business: {
    label: 'Business',
    icon: Briefcase,
    text: 'text-slate-700',
    bg: 'bg-slate-50',
    bar: 'bg-slate-500',
    border: 'border-slate-500',
    tag: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  ricardoeletro: {
    label: 'Ricardo Eletro',
    icon: Storefront,
    text: 'text-red-700',
    bg: 'bg-red-50',
    bar: 'bg-red-500',
    border: 'border-red-500',
    tag: 'bg-red-100 text-red-700 ring-red-200',
  },
};

// Props opcionais:
//   - datemin/datemax/periodo: pra cards de semana/mês (default = ontem)
//   - titulo/subtitulo: customiza header (default = "Faturamento Detalhado por Canal")
//   - delayMs: atraso inicial pra serializar requests entre cards (anti TOTVS-block)
export default function FaturamentoOntemVendedorLoja({
  datemin,
  datemax,
  periodo,
  titulo = 'Faturamento Detalhado por Canal',
  subtitulo,
  corHeader = 'emerald', // alinha com padrão Métricas Diárias: amber/blue/emerald
  delayMs = 0,
  sempreTotvs = false, // se true, sempre força TOTVS direto (pula cache Supabase)
  cacheOnly = false,   // se true, lê SÓ do Supabase (zero TOTVS) — Métricas Diretoria
} = {}) {
  // Cache hit no mount → exibe instantâneo (sem skeleton)
  const cacheKey = lsKey(periodo, datemin, datemax);
  const cacheHit = lsRead(cacheKey);
  const [data, setData] = useState(cacheHit?.data || null);
  const [loading, setLoading] = useState(!cacheHit);
  const [stale, setStale] = useState(false);
  const [erro, setErro] = useState('');
  const reqIdRef = useRef(0);
  const cardRef = useRef(null);

  // Baixa o card como PNG via html-to-image (SVG foreignObject → fontes
  // muito mais nítidas que html2canvas, sem reflow). Renderiza em pixelRatio
  // alto pra ficar perfeito mesmo se ampliar.
  const baixarImagem = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const node = cardRef.current;
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 3,            // 3× DPI — nítido e leve (4× explode no mobile)
        cacheBust: true,
        quality: 1,
        skipFonts: false,
        style: {
          // garante que o card não exiba scroll/sombras cortadas no print
          boxShadow: 'none',
          transform: 'none',
        },
      });
      const link = document.createElement('a');
      const periodoSlug =
        periodo === 'mes'
          ? 'mes'
          : periodo === 'semana'
            ? 'semana'
            : 'ontem';
      const hojeIso = new Date().toISOString().slice(0, 10);
      link.download = `faturamento-${periodoSlug}-${hojeIso}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Erro ao gerar imagem:', e);
      alert('Erro ao baixar imagem: ' + e.message);
    }
  }, [periodo]);

  const carregar = useCallback(async ({ force = false } = {}) => {
    const myId = ++reqIdRef.current;
    // Se já tem cache fresco e não é força, evita request
    if (!force) {
      const hit = lsRead(cacheKey);
      if (hit && hit.age < LS_TTL_MS) {
        setData(hit.data);
        setLoading(false);
        setStale(false);
        return;
      }
    }
    // Só mostra skeleton se NÃO temos dados em tela ainda
    setData((cur) => cur); // no-op pra clareza
    if (!data) setLoading(true);
    else setStale(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (datemin) params.set('datemin', datemin);
      if (datemax) params.set('datemax', datemax);
      if (periodo) params.set('periodo', periodo);
      if (force || sempreTotvs) params.set('nocache', '1');
      // cacheOnly=true: lê SÓ do Supabase, zero TOTVS. Botão "Atualizar"
      // (force=true) sobrepõe e força TOTVS para refresh manual.
      if (cacheOnly && !force) params.set('cacheOnly', '1');
      const qs = params.toString() ? `?${params.toString()}` : '';
      const r = await fetch(`${API_BASE_URL}/api/forecast/ontem-vendedor-loja${qs}`);
      const j = await r.json().catch(() => ({}));
      if (myId !== reqIdRef.current) return;
      if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
      setData(j.data);
      lsWrite(cacheKey, j.data);
    } catch (e) {
      if (myId !== reqIdRef.current) return;
      setErro(e.message);
    } finally {
      if (myId === reqIdRef.current) {
        setLoading(false);
        setStale(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datemin, datemax, periodo, cacheKey, sempreTotvs, cacheOnly]);

  useEffect(() => {
    let cancelled = false;
    // Cache hit: revalida em background sem skeleton
    const hit = lsRead(cacheKey);
    if (hit && hit.age < LS_TTL_MS) {
      setData(hit.data);
      setLoading(false);
      // sempreTotvs: revalida AGORA pra garantir dado fresco (Métricas Diretoria).
      // Senão: revalida só se >5min stale.
      const deveRevalidar = sempreTotvs || hit.age > 5 * 60 * 1000;
      if (deveRevalidar) {
        const t = setTimeout(() => { if (!cancelled) carregar({ force: sempreTotvs }); }, 500);
        return () => { cancelled = true; clearTimeout(t); };
      }
      return () => { cancelled = true; };
    }
    // Sem cache → fetch normal (com delayMs)
    const start = () => { if (!cancelled) carregar(); };
    if (delayMs > 0) {
      const t = setTimeout(start, delayMs);
      return () => { cancelled = true; clearTimeout(t); };
    }
    start();
    return () => { cancelled = true; };
  }, [carregar, delayMs, cacheKey, sempreTotvs]);

  // Junta lojas + vendedores. Vendedores do MESMO canal ficam adjacentes na
  // lista: canais ordenados por total desc, e dentro de cada canal os itens
  // ordenados por valor desc. A borda lateral colorida marca o canal.
  const itensFlat = [
    ...(data?.varejo?.lojas || []).map((l) => ({
      nome: l.nome, uf: l.uf, valor: l.valor, canal: 'varejo',
    })),
    ...(data?.multimarcas?.vendedores || []).map((v) => ({
      nome: v.nome, uf: null, valor: v.valor, canal: 'multimarcas',
    })),
    ...(data?.revenda?.vendedores || []).map((v) => ({
      nome: v.nome, uf: null, valor: v.valor, canal: 'revenda',
    })),
    ...(data?.outros?.vendedores || []).map((v) => ({
      nome: v.nome, uf: null, valor: v.valor, canal: v.canal,
    })),
  ];
  // Agrupa por canal e calcula total de cada um
  const porCanal = new Map();
  for (const it of itensFlat) {
    if (!porCanal.has(it.canal)) porCanal.set(it.canal, { itens: [], total: 0 });
    const g = porCanal.get(it.canal);
    g.itens.push(it);
    g.total += it.valor;
  }
  // Ordem fixa dos canais (definida pela diretoria). Dentro de cada canal,
  // vendedores/lojas ordenados por valor desc.
  const ORDEM_CANAIS = [
    'varejo',
    'fabrica',
    'revenda',
    'franquia',
    'multimarcas',
    'inbound_rafael',
    'inbound_david',
    'bazar',
    'ricardoeletro',
    'business',
  ];
  const idxCanal = (c) => {
    const i = ORDEM_CANAIS.indexOf(c);
    return i === -1 ? 999 : i;
  };
  const itens = Array.from(porCanal.entries())
    .map(([canal, g]) => ({ canal, total: g.total, itens: g.itens.sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => idxCanal(a.canal) - idxCanal(b.canal))
    .flatMap((g) => g.itens);

  const total = itens.reduce((s, i) => s + Math.max(0, i.valor), 0);
  const maxValor = itens.reduce((m, i) => Math.max(m, i.valor), 0);
  const diaRef = data?.dia_anterior;

  return (
    <div ref={cardRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <MetricaHeader
        title={titulo}
        subtitle={
          subtitulo ||
          (periodo === 'ontem' && data?.datemax
            ? `Dia ${fmtDataBr(data.datemax)} · lojas + vendedores`
            : data?.datemin && data?.datemax && data.datemin !== data.datemax
              ? `${fmtDataBr(data.datemin)} → ${fmtDataBr(data.datemax)} · lojas + vendedores`
              : diaRef
                ? `Dia ${fmtDataBr(diaRef)} · lojas + vendedores`
                : 'Faturamento do dia anterior')
        }
        icon={ChartBar}
        color={corHeader}
        onRefresh={() => carregar({ force: true })}
        onDownload={baixarImagem}
        loading={loading || stale}
      />

      <div className="px-5 py-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-bold text-gray-500">
          {periodo === 'semana'
            ? 'Total da Semana'
            : periodo === 'mes'
              ? 'Total do Mês'
              : 'Total Faturado Ontem'}
        </span>
        <span className={`text-xl font-extrabold tabular-nums ${
          corHeader === 'amber' ? 'text-amber-700'
            : corHeader === 'blue' ? 'text-blue-700'
            : corHeader === 'purple' ? 'text-purple-700'
            : 'text-emerald-700'
        }`}>
          {loading ? <LoadingValue width={120} /> : `R$ ${formatBRL(total)}`}
        </span>
      </div>

      {erro && (
        <div className="px-5 py-3 text-xs text-rose-700 bg-rose-50 border-b border-rose-200">
          Erro ao carregar: {erro}
        </div>
      )}

      <div className="p-3 space-y-1.5">
        {loading && !itens.length ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
          ))
        ) : itens.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            Sem faturamento registrado no dia anterior.
          </p>
        ) : (
          itens.map((it, idx) => {
            const cfg = CANAL_CFG[it.canal];
            const Icon = cfg.icon;
            const pct = total > 0 ? (it.valor / total) * 100 : 0;
            const barW = maxValor > 0 ? (it.valor / maxValor) * 100 : 0;
            const isZero = it.valor <= 0;
            return (
              <div
                key={`${it.canal}-${it.nome}-${idx}`}
                className={`flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition border-l-4 ${cfg.border} pl-2 ${
                  isZero ? 'opacity-50' : ''
                }`}
              >
                <div className={`${cfg.bg} p-1.5 rounded-lg shrink-0`}>
                  <Icon size={16} weight="duotone" className={cfg.text} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-gray-700 truncate">
                        {it.nome}
                        {it.uf && (
                          <span className="ml-1.5 text-[10px] text-gray-400 font-medium">
                            · {it.uf}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ${cfg.tag} shrink-0`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums text-gray-900 whitespace-nowrap">
                      R$ {formatBRL(it.valor)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cfg.bar} rounded-full transition-all`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-gray-400 w-10 text-right shrink-0">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
