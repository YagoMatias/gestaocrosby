// Página: Expedição → Faturamento (/expedicao/faturamento?chave=<id do card | SEP:ref>)
// Pedido SEPARADO no Dryland → botão FATURAR na tela Pedido de Venda → aqui:
//   • empresa SEMPRE 99, cliente e vendedor do pedido
//   • os produtos do pedido aparecem pelo SKU; LIGAR PORTAL confere cada
//     etiqueta (EPC → SKU) contra o pedido — conferido / faltando / sobrando
//   • fiscal: cenário (RN / fora com IE / fora sem IE + DIFAL) e CFOP por peça
//     (produção própria × adquirido, aprendido das NF-e do TOTVS)
//   • transporte (transportadora, frete, volumes, peso) e pagamento (formas,
//     parcelas e vencimentos do boleto, NSU/autorização) já vêm do pedido
//   • FATURAR: a NF-e sai pelo HeadCoach (série 3 da 99) e o TOTVS recebe o
//     DOCUMENTO INTERNO (511/7807/7808/7809) + recebimento → contas a receber,
//     na EMPRESA 990 (nas empresas que emitem nota a API não fecha o
//     recebimento), com o caixa do terminal 1 da 990 aberto na data de hoje
//   • aba Transações: NF-e, documento interno, quem emitiu, peças com os EPCs
//     (kardex), valor, pagamento e comprovantes
// Backend: /api/faturamento-expedicao (services/faturamentoExpedicao.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Plugs,
  PlugsConnected,
  Spinner,
  ArrowsClockwise,
  ArrowLeft,
  Buildings,
  User,
  CheckCircle,
  Warning,
  Tag,
  Barcode,
  X,
  Trash,
  Broadcast,
  MagnifyingGlass,
  Package,
  Minus,
  Plus,
  Truck,
  CreditCard,
  Scales,
  CalendarBlank,
  FileText,
  Printer,
  DownloadSimple,
  ListBullets,
  CaretDown,
  CaretRight,
  Storefront,
  ArrowSquareOut,
  Info,
  WifiHigh,
  LockKey,
  ClockCounterClockwise,
  FloppyDisk,
  Wallet,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { ClientePicker } from './DevolucaoRFID';
import { portalConnect, portalDisconnect, portalTags, portalClear } from '../utils/portalApi';
import PortalPotenciaModal from '../components/PortalPotenciaModal';
import { gerarHtmlDanfeDeXml } from '../utils/danfeHtml';
import { abrirImpressao } from '../utils/documentoFiscalHtml';

// ─── Configuração ────────────────────────────────────────────────────────────
const EMPRESA = 99; // faturamento (NF-e) sempre pela empresa 99
const EMPRESA_TOTVS = 990; // empresa do TOTVS que recebe o documento interno + contas a receber
const API = `${API_BASE_URL}/api/faturamento-expedicao`;
// Desconto dado na tela (Expedição Brejinho): até 20% é livre para quem tem a
// tela; acima disso, senha de owner, admin ou financeiro (perfil "user").
const LIMITE_DESCONTO_LIVRE = 20;
const ROLES_LIBERAM_DESCONTO = ['owner', 'admin', 'user'];
// Formas que consomem saldo do cliente no TOTVS → campo do saldo.
// Vale SÓ o saldo da empresa 99 (Yago, 10/11/2026): saldo de outra empresa não
// aparece nem pode ser usado.
const CAMPO_SALDO = { credito_loja: 'credev', adiantamento: 'adiantamento' };

const OPERACOES_DOC_INTERNO = [
  { code: 511, label: '511 - VENDA VAREJO *', canal: 'varejo' },
  { code: 7807, label: '7807 - VENDAS FRANQUIAS N/OFC', canal: 'franquias' },
  { code: 7808, label: '7808 - VENDAS MTM N/OFC', canal: 'mtm' },
  { code: 7809, label: '7809 - VENDA REVENDEDORES N/OFC', canal: 'revenda' },
];

const FORMAS = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  boleto: 'Boleto',
  credito_loja: 'Credev',
  adiantamento: 'Adiantamento',
  dinheiro: 'Dinheiro',
};

const CANAIS = { varejo: 'Varejo', revenda: 'Revenda', mtm: 'Multimarcas', franquias: 'Franquias' };

const CENARIOS = {
  interna: { label: 'Dentro do RN', cfop: '5101 / 5102', icms: 'ICMS 20%' },
  interContrib: { label: 'Fora do RN · cliente com IE', cfop: '6101 / 6102', icms: 'ICMS 12%' },
  interNaoContrib: { label: 'Fora do RN · consumidor final', cfop: '6107 / 6108', icms: 'ICMS 12% + DIFAL' },
};

const TOTVS_STATUS = {
  1: { label: 'em andamento', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  4: { label: 'recebido · contas a receber lançado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  6: { label: 'cancelado', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
const NF_STATUS = {
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  erro: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200',
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—');
const hojeIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';

function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 1200 : 320;
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    osc.onended = () => ctx.close();
  } catch {
    /* sem áudio */
  }
}

// parcelas iguais; a diferença de centavos vai na última (igual ao TOTVS)
function parcelasIguais(total, n) {
  const q = Math.max(1, Number(n) || 1);
  const p = round2(total / q);
  return Array.from({ length: q }, (_, i) => (i === q - 1 ? round2(total - p * (q - 1)) : p));
}

// Unidades (uma por peça) de uma lista de itens do Dryland
function unidadesDe(lista) {
  const unidades = [];
  for (const i of lista || []) {
    const sku = String(i.cod || '').trim();
    if (!sku) continue;
    const q = Number(i.qtd) || 1;
    for (let k = 0; k < q; k++) {
      unidades.push({
        sku,
        descricao: i.descricao || '',
        cor: i.cor || '',
        tam: i.tam || i.tamanho || '',
        preco: round2(Number(i.preco) || 0),
        desc: 0,
        black: i.black ? { pct: Number(i.black_pct) || null, antes: Number(i.preco_antes_black) || null } : null,
        troca: i.troca_de ? String(i.troca_de) : null,
        brinde: !!i.brinde,
      });
    }
  }
  return unidades;
}

// Peças que estão no card do Painel e não na separação, e o contrário
// (só informativo: o que vale para faturar é a separação)
function diferencaCardSeparacao(dados) {
  if (dados?.separacaoIncompleta) return null;
  const sep = dados?.itens || [];
  const card = dados?.card?.dados?.itens || [];
  if (!sep.length || !card.length) return null;
  const conta = (lista) => {
    const m = new Map();
    for (const i of lista) {
      const sku = String(i.cod || '').trim();
      if (!sku) continue;
      const cur = m.get(sku) || { sku, nome: i.descricao || '', qtd: 0 };
      cur.qtd += Number(i.qtd) || 1;
      m.set(sku, cur);
    }
    return m;
  };
  const a = conta(sep);
  const b = conta(card);
  const soSeparacao = [];
  const soCard = [];
  for (const [sku, x] of a) if ((b.get(sku)?.qtd || 0) < x.qtd) soSeparacao.push({ ...x, qtd: x.qtd - (b.get(sku)?.qtd || 0) });
  for (const [sku, x] of b) if ((a.get(sku)?.qtd || 0) < x.qtd) soCard.push({ ...x, qtd: x.qtd - (a.get(sku)?.qtd || 0) });
  return soSeparacao.length || soCard.length ? { soSeparacao, soCard } : null;
}

// Itens do pedido agrupados por SKU (código do produto no TOTVS).
// AS PEÇAS vêm da SEPARAÇÃO do Dryland (tela /separar — "Loja Virtual Max",
// pedidos finalizados): é ela que diz o que realmente vai na caixa (trocas,
// peça não achada, crédito). Yago, 10/11/2026: o card do Painel era a tela
// errada para saber o que faturar.
// O PREÇO de cada peça continua o do Detalhar (card da fila: troca, Black e
// ajustes já aplicados — RV1325: 2555 a 17,50 + 16,39) quando o card tem
// aquela peça; peça que só existe na separação usa o preço da separação.
// Sem separação (ex.: Brejinho), valem os itens do card.
// Cada UNIDADE guarda: preço vendido, sua parte do desconto do pedido (Pix /
// desconto geral, rateado pelo preço; centavos que sobram na peça mais cara) e
// as marcas do Dryland (Black %, troca, brinde).
function itensDoPedido(dados) {
  const doCard = unidadesDe(dados?.card?.dados?.itens);
  const daSep = unidadesDe((dados?.itens || []).map((i) => ({ cod: i.cod, descricao: i.descricao, cor: i.cor, tam: i.tamanho, qtd: i.qtd, preco: i.preco })));
  let unidades = doCard;
  if (daSep.length && !(dados?.separacaoIncompleta && doCard.length)) {
    // fila de unidades do card por SKU, para dar a cada peça separada o preço do Detalhar
    const fila = new Map();
    for (const u of doCard) {
      if (!fila.has(u.sku)) fila.set(u.sku, []);
      fila.get(u.sku).push(u);
    }
    unidades = daSep.map((u) => {
      const c = fila.get(u.sku)?.shift();
      return c ? { ...u, preco: c.preco, black: c.black, troca: c.troca, brinde: c.brinde } : { ...u, soSeparacao: doCard.length > 0 };
    });
  }
  // desconto do pedido (Pix + desconto geral) rateado nas peças
  const dd = dados?.card?.dados || {};
  const descPedido = round2((Number(dd.desconto) || 0) + (Number(dd.desconto_pix) || 0));
  const soma = unidades.reduce((s, u) => s + u.preco, 0);
  if (descPedido > 0 && soma > 0) {
    unidades.forEach((u) => (u.desc = round2((descPedido * u.preco) / soma)));
    const sobra = round2(descPedido - unidades.reduce((s, u) => s + u.desc, 0));
    if (sobra !== 0) {
      const k = unidades.reduce((m, u, idx) => (u.preco > unidades[m].preco ? idx : m), 0);
      unidades[k].desc = round2(unidades[k].desc + sobra);
    }
  }
  const porSku = new Map();
  for (const u of unidades) {
    const cur = porSku.get(u.sku) || { sku: u.sku, descricao: u.descricao, cor: u.cor, tam: u.tam, unidades: [] };
    cur.unidades.push(u);
    porSku.set(u.sku, cur);
  }
  return [...porSku.values()]
    .map((x) => ({ ...x, qtd: x.unidades.length, precos: x.unidades.map((u) => u.preco), preco: round2(x.unidades.reduce((s, u) => s + u.preco, 0) / x.unidades.length) }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao));
}

// Resumo dos descontos do pedido (para a tela)
function resumoDescontos(dados, itens) {
  const dd = dados?.card?.dados || {};
  const unidades = itens.flatMap((i) => i.unidades);
  const total = unidades.length;
  const out = [];
  const pix = Number(dd.desconto_pix) || 0;
  const geral = Number(dd.desconto) || 0;
  const base = Number(dd.valor_cheio) || unidades.reduce((s, u) => s + u.preco, 0);
  if (pix > 0) out.push({ tipo: 'Desconto Pix', pct: base ? (pix / base) * 100 : null, valor: pix, pecas: total, total });
  if (geral > 0) out.push({ tipo: 'Desconto do pedido', pct: base ? (geral / base) * 100 : null, valor: geral, pecas: total, total });
  const porPct = {};
  for (const u of unidades.filter((x) => x.black)) {
    let k = u.black.pct;
    if (k == null) k = u.black.antes ? round2((1 - u.preco / u.black.antes) * 100) : 0;
    porPct[k] = porPct[k] || { n: 0, valor: 0 };
    porPct[k].n += 1;
    porPct[k].valor += u.black.antes ? u.black.antes - u.preco : 0;
  }
  for (const [pct, v] of Object.entries(porPct)) out.push({ tipo: 'Black', pct: Number(pct) || null, valor: round2(v.valor), pecas: v.n, total });
  const trocas = unidades.filter((u) => u.troca).length;
  if (trocas) out.push({ tipo: 'Troca (preço pago mantido)', pct: null, valor: null, pecas: trocas, total });
  const brindes = unidades.filter((u) => u.brinde).length;
  if (brindes) out.push({ tipo: 'Brinde', pct: null, valor: null, pecas: brindes, total });
  return out;
}

// Linhas da nota de um SKU conferido: as primeiras `n` unidades, agrupadas por
// (preço, desconto) — assim quantidade × desconto da linha é exato
function linhasPorPreco(unidades, n) {
  const grupos = [];
  for (const u of unidades.slice(0, n)) {
    const g = grupos.find((x) => x.valor === u.preco && x.desc === u.desc);
    if (g) g.qtd += 1;
    else grupos.push({ valor: u.preco, desc: u.desc, qtd: 1 });
  }
  return grupos;
}

async function imprimirDanfe(notaId, { cancelada = false } = {}) {
  const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}/xml`);
  if (!r.ok) throw new Error('XML da nota não encontrado');
  abrirImpressao(gerarHtmlDanfeDeXml(await r.text(), { cancelada }));
}

function Bloco({ titulo, icone: Icone, children, extra }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <Icone size={15} className="text-[#000638]" />
        <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-[#000638]">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Chip({ children, cls = 'bg-gray-100 text-gray-600 ring-gray-200' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${cls}`}>{children}</span>;
}

// ─── Busca de transportadora (taxista ou outra pessoa do TOTVS) ─────────────
function BuscaPessoa({ onEscolher }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const buscar = async () => {
    const t = q.trim();
    if (!t) return;
    setBusy(true);
    try {
      const param = /^\d+$/.test(t) ? `code=${t}` : `nome=${encodeURIComponent(t)}`;
      const r = await fetch(`${API_BASE_URL}/api/totvs/clientes/search-name?${param}`);
      const j = await r.json();
      setRes(j?.data?.clientes || []);
    } catch {
      setRes([]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} placeholder="Código ou nome no TOTVS" className={inputCls} />
        <button onClick={buscar} disabled={busy} className="h-9 shrink-0 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40">
          {busy ? <Spinner size={13} className="animate-spin" /> : <MagnifyingGlass size={13} />}
        </button>
      </div>
      {res && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg ring-1 ring-gray-200">
          {res.length === 0 && <li className="px-2 py-1.5 text-xs text-gray-400">Ninguém encontrado</li>}
          {res.slice(0, 20).map((c) => (
            <li key={c.code}>
              <button
                onClick={() => {
                  onEscolher({ code: c.code, nome: c.name });
                  setRes(null);
                  setQ('');
                }}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50"
              >
                <b className="text-[#000638]">{c.code}</b> — {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Lista dos pedidos a faturar (tela sem pedido escolhido) ────────────────
// QUAIS pedidos: os "a faturar" do Painel do frete (pago e sem nota; não some
// depois de 72 h como os Finalizados da tela Separar). QUAIS peças: a separação.
// Situação da separação de cada linha da lista:
const situacaoSeparacao = (p) => {
  const sp = p.separacao;
  const semSep = { k: 'sem', label: 'sem separação · peças do card', cls: 'bg-gray-100 text-gray-600 ring-gray-200', pode: true };
  if (!sp) return semSep;
  // ainda na tela Separar do Dryland com peça por achar: não libera
  if (sp.viva && sp.status !== 'separado') return { k: 'andamento', label: `em separação ${sp.qtd_separada || 0}/${sp.qtd_pecas || 0}`, cls: 'bg-amber-50 text-amber-700 ring-amber-200', pode: false };
  if (sp.incompleta) return { k: 'antiga', label: 'separação antiga · peças do card', cls: 'bg-gray-100 text-gray-600 ring-gray-200', pode: true };
  if (sp.status === 'separado') return { k: 'ok', label: 'separação finalizada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', pode: true };
  // saiu da tela sem nenhuma linha separada (linhas tiradas do pedido)
  return semSep;
};
const pecasDaLinha = (p) => {
  const st = situacaoSeparacao(p);
  return Number(st.k === 'ok' || st.k === 'andamento' ? p.separacao?.qtd_pecas : p.pecas_card ?? p.separacao?.qtd_pecas) || 0;
};

function ListaSeparados({ onEscolher, origem = 'pedidos' }) {
  const brejinho = origem === 'brejinho';
  const [itens, setItens] = useState(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    setItens(null);
    setErro('');
    try {
      const r = await fetch(
        brejinho
          ? `${API_BASE_URL}/api/brejinho?status=${encodeURIComponent('aguardando pagamento')}`
          : `${API_BASE_URL}/api/pedidos-venda?status=${encodeURIComponent('a faturar')}`,
      );
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || `HTTP ${r.status}`);
      setItens(
        brejinho
          ? (j.data.items || []).map((p) => ({
              chave: p.chave,
              numero_site: p.pedido,
              cliente: p.cliente,
              canal: 'franquias',
              separacao: { qtd_pecas: p.qtd_pecas },
              valor: p.valor,
              faturamento: p.faturamento,
            }))
          : j.data.items || [],
      );
    } catch (e) {
      setErro(e.message);
      setItens([]);
    }
  }, [brejinho]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const filtrados = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return (itens || [])
      .filter((p) => brejinho || tipo === 'todos' || p.canal === tipo)
      .filter((p) => !b || [p.numero_site, p.cliente, p.titulo, p.vendedor].filter(Boolean).some((v) => String(v).toUpperCase().includes(b)));
  }, [itens, busca, tipo, brejinho]);
  // mesmos tipos da tela Separar do Dryland (transferência não é venda: não fatura aqui)
  const tipos = useMemo(() => {
    const conta = (k) => {
      const l = (itens || []).filter((p) => k === 'todos' || p.canal === k);
      return { pedidos: l.length, pecas: l.reduce((s, p) => s + pecasDaLinha(p), 0) };
    };
    return [
      ['todos', 'Todos'],
      ['mtm', 'Multimarcas'],
      ['revenda', 'Revendedor'],
      ['franquias', 'Franquia'],
      ['varejo', 'Varejo'],
    ].map(([k, label]) => ({ k, label, ...conta(k) }));
  }, [itens]);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-bold text-[#000638]">{brejinho ? 'Pedidos do Brejinho aguardando pagamento' : 'Pedidos a faturar (Painel do frete) · peças pela separação do Dryland'}</p>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="pedido, cliente, vendedor…" className="mb-0 h-9 w-56 rounded-lg border border-gray-300 pl-8 pr-2 text-sm" />
        </div>
        <button onClick={carregar} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
          <ArrowsClockwise size={13} className={itens === null ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {!brejinho && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tipos.map((t) => (
            <button
              key={t.k}
              onClick={() => setTipo(t.k)}
              className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold ring-1 transition ${
                tipo === t.k ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'
              }`}
            >
              {t.label} · {t.pedidos} pedido{t.pedidos === 1 ? '' : 's'} · {t.pecas} pçs
            </button>
          ))}
        </div>
      )}
      {erro && <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {itens === null ? (
        <div className="py-8 text-center text-gray-400">
          <Spinner size={20} className="mx-auto animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">{brejinho ? 'Nenhum pedido aguardando pagamento.' : 'Nenhum pedido a faturar.'}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filtrados.map((p) => (
            <li key={p.chave} className="flex flex-wrap items-center gap-2 py-2 text-xs">
              <span className="w-20 font-mono font-bold text-[#000638]">{p.numero_site || '—'}</span>
              <span className="min-w-[160px] flex-1 truncate font-medium text-gray-800">{p.cliente || p.titulo}</span>
              <span className="text-gray-500">{CANAIS[p.canal] || p.canal}</span>
              <span className="tabular-nums text-gray-500">{brejinho ? p.separacao?.qtd_pecas || 0 : pecasDaLinha(p)} pç</span>
              {!brejinho && <Chip cls={situacaoSeparacao(p).cls}>{situacaoSeparacao(p).label}</Chip>}
              <span className="w-24 text-right font-semibold tabular-nums">{fmtBRL(p.valor)}</span>
              {p.faturamento && (
                <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">{p.faturamento.nf ? `NF ${p.faturamento.nf}` : `tx ${p.faturamento.transacao}`}</Chip>
              )}
              <button
                onClick={() => onEscolher(p.chave)}
                disabled={!brejinho && !situacaoSeparacao(p).pode}
                title={!brejinho && !situacaoSeparacao(p).pode ? 'A separação deste pedido ainda não foi finalizada no Dryland' : ''}
                className="h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                FATURAR
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Aba Transações ─────────────────────────────────────────────────────────
function DetalheTransacao({ id, onReprocessar, reprocessando }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  const [terminalNovo, setTerminalNovo] = useState('');
  const [faturaNova, setFaturaNova] = useState(null); // null = mantém o que está na venda
  const [operacaoNova, setOperacaoNova] = useState(''); // '' = mantém; outra = abre nova transação no TOTVS
  const [cancelar, setCancelar] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [avisoCancel, setAvisoCancel] = useState('');
  useEffect(() => {
    let vivo = true;
    fetch(`${API}/transacoes/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (!j.success) throw new Error(j.message);
        setD(j.data);
      })
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [id, versao]);
  const cancelarNota = async (notaId) => {
    setCancelando(true);
    setAvisoCancel('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      const j = await r.json();
      setAvisoCancel(j.message || (j.success ? 'Nota cancelada' : 'Falha ao cancelar'));
      if (j.success) {
        setCancelar(false);
        setVersao((v) => v + 1);
      }
    } catch (e) {
      setAvisoCancel(e.message);
    } finally {
      setCancelando(false);
    }
  };
  if (erro) return <p className="px-3 py-2 text-xs text-rose-600">{erro}</p>;
  if (!d) return <Spinner size={16} className="mx-auto my-3 animate-spin text-gray-400" />;
  const v = d.venda;
  const nota = v?.notas?.find((n) => n.status === 'autorizada') || v?.notas?.[0];
  const porProduto = {};
  for (const k of d.kardex) {
    porProduto[k.product_code] = porProduto[k.product_code] || { nome: k.produto_nome, epcs: [] };
    porProduto[k.product_code].epcs.push(k.epc);
  }
  return (
    <div className="grid gap-3 bg-gray-50 px-3 py-3 md:grid-cols-2">
      <div className="space-y-2 text-xs">
        <p>
          <b>NF-e:</b>{' '}
          {nota ? (
            <>
              {nota.numero}/{nota.serie} <Chip cls={NF_STATUS[nota.status]}>{nota.status}</Chip>
              {nota.chave && <span className="mt-0.5 block font-mono text-[10.5px] text-gray-500">{nota.chave}</span>}
              {nota.status !== 'autorizada' && nota.xmotivo && <span className="block text-rose-600">{nota.cstat} {nota.xmotivo}</span>}
            </>
          ) : (
            '—'
          )}
        </p>
        {(nota?.status === 'autorizada' || nota?.status === 'cancelada') && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => imprimirDanfe(nota.id, { cancelada: nota.status === 'cancelada' }).catch((e) => alert(e.message))}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white"
            >
              <Printer size={13} /> DANFE
            </button>
            <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${nota.id}/xml`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300">
              <DownloadSimple size={13} /> XML
            </a>
            {nota.status === 'autorizada' && !cancelar && (
              <button onClick={() => setCancelar(true)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50">
                <X size={13} weight="bold" /> Cancelar NF-e
              </button>
            )}
          </div>
        )}
        {cancelar && nota?.status === 'autorizada' && (
          <div className="rounded-lg bg-rose-50 p-2 ring-1 ring-rose-200">
            <p className="text-[11px] font-bold text-rose-700">Cancelar a NF-e {nota.numero}/{nota.serie} na SEFAZ</p>
            <p className="text-[10.5px] text-rose-700">Não tem volta. A transação do TOTVS não é cancelada por aqui — cancele-a no TOTVS.</p>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Justificativa (mínimo 15 caracteres)"
              rows={2}
              className="mb-0 mt-1 w-full rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs"
            />
            <div className="mt-1 flex gap-1.5">
              <button onClick={() => setCancelar(false)} className="h-8 rounded-lg bg-white px-2.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-300">
                Voltar
              </button>
              <button
                onClick={() => cancelarNota(nota.id)}
                disabled={cancelando || justificativa.trim().length < 15}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-[11px] font-bold text-white disabled:opacity-40"
              >
                {cancelando ? <Spinner size={13} className="animate-spin" /> : <X size={13} weight="bold" />} Confirmar cancelamento
              </button>
            </div>
          </div>
        )}
        {avisoCancel && <p className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] text-blue-800 ring-1 ring-blue-200">{avisoCancel}</p>}
        <p>
          <b>TOTVS (documento interno):</b> {v?.totvs_transacao_code ? `transação ${v.totvs_transacao_code} · ${fmtData(v.totvs_transacao_date)}` : '—'}
          {v?.operacao_doc_interno ? ` · op ${v.operacao_doc_interno}` : ''}
          {v?.totvs_transacao_code ? ` · empresa ${v.pedido_info?.empresaTotvs || EMPRESA}` : ''}{' '}
          {v?.totvs_status && <Chip cls={TOTVS_STATUS[v.totvs_status]?.cls}>{TOTVS_STATUS[v.totvs_status]?.label || v.totvs_status}</Chip>}
          {v?.totvs_erro && <span className="block text-rose-600">{v.totvs_erro}</span>}
          {v?.totvs_status !== 4 && v?.status !== 'cancelada' && Number(v?.pedido_info?.empresaTotvs || EMPRESA) !== EMPRESA_TOTVS && (
            <span className="block text-amber-700">
              "Tentar de novo" abre a transação na empresa {EMPRESA_TOTVS}, onde o recebimento pela API funciona{v?.totvs_transacao_code ? `; a ${v.totvs_transacao_code} da ${EMPRESA} fica para cancelar no TOTVS` : ''}.
            </span>
          )}
          {(v?.pedido_info?.transacoesAnteriores || []).length > 0 && (
            <span className="block text-amber-700">
              Transações anteriores para cancelar no TOTVS: {v.pedido_info.transacoesAnteriores.map((t) => `${t.code} (${t.empresa ? `empresa ${t.empresa} · ` : ''}op ${t.operacao})`).join(', ')}
            </span>
          )}
        </p>
        {nota?.status !== 'cancelada' && v?.status !== 'cancelada' && (nota?.status !== 'autorizada' || v?.totvs_status !== 4) && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onReprocessar(v.id, terminalNovo, faturaNova ?? undefined, operacaoNova)}
              disabled={reprocessando}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {reprocessando ? <Spinner size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />} Tentar de novo
            </button>
            <span className="text-[11px] text-gray-500">terminal</span>
            <input
              type="number"
              min="1"
              value={terminalNovo}
              onChange={(e) => setTerminalNovo(e.target.value)}
              placeholder={String(v?.pedido_info?.terminal || 1)}
              className="mb-0 h-8 w-14 rounded-lg border border-gray-300 px-1.5 text-xs"
            />
            <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-gray-600">
              <input
                type="checkbox"
                checked={faturaNova ?? !!v?.pedido_info?.receberComoFatura}
                onChange={(e) => setFaturaNova(e.target.checked)}
                className="mb-0 !h-3.5 !w-3.5"
              />
              como fatura
            </label>
            <select value={operacaoNova} onChange={(e) => setOperacaoNova(e.target.value)} className="mb-0 h-8 rounded-lg border border-gray-300 px-1 text-[11px]" title="Trocar a operação abre uma NOVA transação no TOTVS; a anterior fica para cancelar">
              <option value="">operação {v?.operacao_doc_interno || ''}</option>
              {OPERACOES_DOC_INTERNO.filter((o) => o.code !== Number(v?.operacao_doc_interno)).map((o) => (
                <option key={o.code} value={o.code}>
                  trocar p/ {o.code}
                </option>
              ))}
            </select>
          </div>
        )}
        <p>
          <b>Pagamento:</b>{' '}
          {(v?.pagamentos || []).map((p) => `${FORMAS[p.forma] || p.forma} ${fmtBRL(p.valor)}${p.parcelas > 1 ? ` em ${p.parcelas}x` : ''}${p.nsu ? ` · NSU ${p.nsu}` : ''}${p.autorizacao ? ` · aut ${p.autorizacao}` : ''}`).join(' + ') || '—'}
        </p>
        {(v?.cobranca?.parcelas || []).length > 0 && (
          <p>
            <b>Boleto:</b> {v.cobranca.parcelas.map((x) => `${fmtData(x.vencimento)} ${fmtBRL(x.valor)}`).join(' · ')}
          </p>
        )}
        <p>
          <b>Transporte:</b> {v?.transporte ? `${v.transporte.nome}${v.transporte.servico ? ` · ${v.transporte.servico}` : ''} · ${v.transporte.volumes} vol · ${v.transporte.pesoB || 0} kg` : 'retirada / sem transportadora'} · frete {fmtBRL(v?.frete)}
        </p>
        <p>
          <b>Emitido por:</b> {d.faturamento.criado_por || '—'} em {fmtDataHora(d.faturamento.criado_em)}
          {v?.pedido_info?.dataVenda ? (
            <span className="ml-1 rounded bg-amber-50 px-1 font-semibold text-amber-700">VENDA DO DIA {fmtData(v.pedido_info.dataVenda)}</span>
          ) : null}
          {Number(v?.pedido_info?.descontoFaturamento?.pct) > 0 ? (
            <span className="ml-1 rounded bg-amber-50 px-1 font-semibold text-amber-700">
              DESCONTO {String(v.pedido_info.descontoFaturamento.pct).replace('.', ',')}% NO FATURAMENTO
              {v.pedido_info.descontoFaturamento.liberadoPor ? ` · liberado por ${v.pedido_info.descontoFaturamento.liberadoPor}` : ''}
            </span>
          ) : null}
        </p>
        {(v?.comprovantes || []).length > 0 && (
          <p className="flex flex-wrap gap-1">
            <b>Comprovantes:</b>
            {v.comprovantes.map((c, i) => (
              <a key={c.path || i} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline">
                comprovante {i + 1} <ArrowSquareOut size={10} />
              </a>
            ))}
          </p>
        )}
        {(d.faturamento.qtd_faltando > 0 || d.faturamento.qtd_sobrando > 0) && (
          <p className="text-amber-700">
            Ficaram fora: {d.faturamento.qtd_faltando} faltando · {d.faturamento.qtd_sobrando} sobrando
          </p>
        )}
      </div>
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Peças e etiquetas RFID (kardex)</p>
        <ul className="space-y-1.5">
          {(v?.itens || []).map((it) => (
            <li key={it.id} className="rounded-lg bg-white p-2 ring-1 ring-gray-200">
              <p className="text-xs font-semibold text-gray-800">
                {it.nome} <span className="font-mono text-gray-400">· SKU {it.product_code}</span>
              </p>
              <p className="text-[11px] text-gray-500">
                {it.quantidade} × {fmtBRL(it.valor_unit)} · CFOP {it.cfop || '—'} · {it.tipo_fiscal === 'adquirido' ? 'adquirido' : 'produção'}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(porProduto[it.product_code]?.epcs || []).map((epc) => (
                  <span key={epc} className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 ring-1 ring-purple-200">
                    <Tag size={9} /> {epc}
                  </span>
                ))}
                {!(porProduto[it.product_code]?.epcs || []).length && <span className="text-[10px] text-gray-400">sem etiqueta (digitada)</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AbaTransacoes() {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hojeIso);
  const [aberto, setAberto] = useState(null);
  const [reprocessando, setReprocessando] = useState(false);
  const [aviso, setAviso] = useState('');
  const carregar = useCallback(async () => {
    setLista(null);
    try {
      const qs = new URLSearchParams({ de, ate, ...(busca.trim() ? { busca: busca.trim() } : {}) });
      const r = await fetch(`${API}/transacoes?${qs}`);
      const j = await r.json();
      setLista(j.success ? j.data : []);
    } catch {
      setLista([]);
    }
  }, [de, ate, busca]);
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate]);
  const reprocessar = async (vendaId, terminalNovo, faturaNova, operacaoNova) => {
    setReprocessando(true);
    setAviso('');
    try {
      const r = await fetch(`${API}/vendas/${vendaId}/reprocessar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(Number(terminalNovo) > 0 ? { terminal: Number(terminalNovo) } : {}),
          ...(typeof faturaNova === 'boolean' ? { comoFatura: faturaNova } : {}),
          ...(Number(operacaoNova) > 0 ? { operacaoDocInterno: Number(operacaoNova) } : {}),
        }),
      });
      const j = await r.json();
      setAviso(j.message || '');
      await carregar();
      setAberto(null);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setReprocessando(false);
    }
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 p-3">
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregar()} placeholder="Pedido, cliente, NF, transação, quem emitiu…" className={`${inputCls} pl-8`} />
        </div>
        <div>
          <label className={labelCls}>De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} w-auto`} />
        </div>
        <div>
          <label className={labelCls}>Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} w-auto`} />
        </div>
        <button onClick={carregar} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
          <ArrowsClockwise size={13} className={lista === null ? 'animate-spin' : ''} /> Buscar
        </button>
      </div>
      {aviso && <p className="mx-3 mt-2 rounded-lg bg-blue-50 px-2 py-1.5 text-xs text-blue-800 ring-1 ring-blue-200">{aviso}</p>}
      {lista === null ? (
        <div className="py-10 text-center text-gray-400">
          <Spinner size={20} className="mx-auto animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <p className="py-10 text-center text-xs text-gray-400">Nenhum faturamento no período.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lista.map((f) => {
            const nf = f.nota;
            const st = f.venda?.totvs_status;
            return (
              <li key={f.id}>
                <button onClick={() => setAberto(aberto === f.id ? null : f.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-xs hover:bg-gray-50">
                  {aberto === f.id ? <CaretDown size={12} /> : <CaretRight size={12} />}
                  <span className="w-24 text-gray-500">{fmtDataHora(f.criado_em)}</span>
                  <span className="w-20 font-mono font-bold text-[#000638]">{f.numero_site || '—'}</span>
                  <span className="min-w-[140px] flex-1 truncate font-medium text-gray-800">{f.cliente_nome}</span>
                  <span>
                    {nf ? (
                      <Chip cls={NF_STATUS[nf.status]}>
                        NF {nf.numero} · {nf.status}
                      </Chip>
                    ) : (
                      <Chip cls={NF_STATUS.erro}>sem NF</Chip>
                    )}
                  </span>
                  <span>
                    {st === 4 ? (
                      <Chip cls={TOTVS_STATUS[4].cls}>TOTVS {f.venda?.totvs_transacao_code}</Chip>
                    ) : f.venda?.totvs_erro ? (
                      <Chip cls="bg-rose-50 text-rose-700 ring-rose-200">TOTVS pendente</Chip>
                    ) : (
                      <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">TOTVS {f.venda?.totvs_transacao_code || '—'}</Chip>
                    )}
                  </span>
                  <span className="w-28 text-gray-500">{(f.forma_pagamento || '').split(' + ').map((x) => FORMAS[x] || x).join(' + ')}</span>
                  <span className="w-20 text-right tabular-nums">{f.qtd_conferida} pç</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{fmtBRL(f.total)}</span>
                  <span className="w-28 truncate text-gray-400">{f.criado_por || ''}</span>
                </button>
                {aberto === f.id && <DetalheTransacao id={f.id} onReprocessar={reprocessar} reprocessando={reprocessando} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Senha de owner/admin/financeiro para desconto acima do limite ──────────
function SenhaDescontoModal({ pct, pedido, por, onLiberado, onCancelar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const liberar = async () => {
    if (!email.trim() || !senha || busy) return;
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`${API}/autorizar-desconto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), senha, pct, pedido, por }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Não autorizado');
      onLiberado({ ...j.data, pct });
    } catch (e) {
      setErro(e.message);
      setSenha('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <LockKey size={26} weight="fill" className="text-amber-500" />
          <h3 className="text-lg font-bold text-[#000638]">Liberar desconto</h3>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Desconto de <b>{pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</b> passa do limite de {LIMITE_DESCONTO_LIVRE}%. Um <b>owner</b>, <b>admin</b> ou alguém do{' '}
          <b>financeiro</b> precisa digitar o e-mail e a senha do HeadCoach.
        </p>
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail de quem autoriza"
            autoComplete="off"
            className="mb-0 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && liberar()}
            placeholder="Senha"
            autoComplete="new-password"
            className="mb-0 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
          />
        </div>
        {erro && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancelar} disabled={busy} className="h-10 rounded-lg text-sm font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={liberar} disabled={busy || !email.trim() || !senha} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#000638] text-sm font-bold text-white disabled:opacity-40">
            {busy ? <Spinner size={14} className="animate-spin" /> : <LockKey size={14} weight="bold" />} Liberar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
const FaturamentoPedido = ({ origem = 'pedidos' }) => {
  const brejinho = origem === 'brejinho';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chave = params.get('chave') || '';
  const aba = params.get('aba') || 'faturar';

  const [toast, setToast] = useState(null);
  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Pedido
  const [pedido, setPedido] = useState(null); // { card, separacao, itens, faturamentos }
  const [prep, setPrep] = useState(null); // sugestões do /preparar
  const [carregando, setCarregando] = useState(false);
  const [erroPedido, setErroPedido] = useState('');

  // Cabeçalho
  const [sellers, setSellers] = useState([]);
  const [seller, setSeller] = useState('');
  const [customer, setCustomer] = useState(null);
  const [consumidorFinal, setConsumidorFinal] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [previaErro, setPreviaErro] = useState('');
  const [operacao, setOperacao] = useState('');
  const [comoFatura, setComoFatura] = useState(() => {
    try {
      return localStorage.getItem('fat_como_fatura') === '1';
    } catch {
      return false;
    }
  });
  const [terminal, setTerminal] = useState(() => {
    try {
      return localStorage.getItem('fat_terminal') || '1';
    } catch {
      return '1';
    }
  });
  // Transação do TOTVS sempre na data de hoje (a API só recebe com caixa do
  // dia). Venda de outro dia: "transação com data diferente" → a data real vai
  // na observação da transação (VENDA DO DIA dd/mm/aaaa).
  const [dataDiferente, setDataDiferente] = useState(false);
  const [dataVenda, setDataVenda] = useState('');

  // Transporte e pagamento
  const [transp, setTransp] = useState({ id: 'RETIRADA', code: null, nome: null, servico: '', frete: 0, modFrete: 0, volumes: 0, pesoB: 0 });
  const [pagamentos, setPagamentos] = useState([]);
  const [vencimentos, setVencimentos] = useState([]);
  // Operadoras/parcelamentos de cartão do cadastro do TOTVS (como na FGRFM003)
  const [cartoes, setCartoes] = useState(null);
  useEffect(() => {
    fetch(`${API}/cartoes`)
      .then((r) => r.json())
      .then((j) => setCartoes(j.success ? j.data : { credito: [], debito: [], padrao: {} }))
      .catch(() => setCartoes({ credito: [], debito: [], padrao: {} }));
  }, []);
  // Cartão efetivo de um pagamento: o que o vendedor escolheu ou o padrão
  // (Pagar.me) com o parcelamento do pedido
  const cartaoDe = useCallback(
    (p) => {
      if (!cartoes || (p.forma !== 'credito' && p.forma !== 'debito')) return null;
      const grupos = cartoes[p.forma] || [];
      const grupo = grupos.find((g) => g.chave === p.cartaoChave) || grupos.find((g) => g.chave === cartoes.padrao?.[p.forma]) || null;
      if (!grupo) return { grupos, grupo: null, opcao: null };
      const n = p.forma === 'debito' ? 1 : Number(p.parcelas) || 1;
      const opcao = grupo.opcoes.find((o) => o.seq === p.cartaoSeq) || grupo.opcoes.find((o) => o.parcelas === n) || null;
      return { grupos, grupo, opcao };
    },
    [cartoes],
  );

  // Portal / leituras
  const [portalStatus, setPortalStatus] = useState({ status: 'desconectado' });
  const [portalBusy, setPortalBusy] = useState(false);
  const [potenciaOpen, setPotenciaOpen] = useState(false);
  const [lidos, setLidos] = useState({}); // sku → { sku, nome, epcs[], manual, precoTotvs }
  const [naoResolvidos, setNaoResolvidos] = useState([]);
  const processed = useRef(new Set());
  const [codigoManual, setCodigoManual] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  // Faturamento
  const [confirmaDuplicar, setConfirmaDuplicar] = useState(false);
  const [posting, setPosting] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modalFat, setModalFat] = useState(false); // confirmação → andamento → resultado

  // Desconto dado na tela (Brejinho): % sobre as peças; acima do limite pede senha
  const [descPct, setDescPct] = useState('');
  const [descLiberado, setDescLiberado] = useState(null); // { nome, email, role, pct }
  const [senhaDescOpen, setSenhaDescOpen] = useState(false);
  // Saldos do cliente no TOTVS (CREDEV e adiantamento), por empresa
  const [saldos, setSaldos] = useState(null);
  // Faturamentos em andamento: salvos neste computador, por usuário (como na Devolução)
  const chaveRascunhos = `fat_andamento_${brejinho ? 'brj' : 'ped'}_${user?.id || user?.email || 'anon'}`;
  const [rascunhos, setRascunhos] = useState([]);
  const [rascunhosOpen, setRascunhosOpen] = useState(false);
  const rascunhoPendente = useRef(null);
  useEffect(() => {
    try {
      setRascunhos(JSON.parse(localStorage.getItem(chaveRascunhos)) || []);
    } catch {
      setRascunhos([]);
    }
  }, [chaveRascunhos]);
  const gravarRascunhos = useCallback(
    (fn) => {
      setRascunhos((atual) => {
        const lista = fn(atual);
        try {
          localStorage.setItem(chaveRascunhos, JSON.stringify(lista));
        } catch {
          /* storage cheio */
        }
        return lista;
      });
    },
    [chaveRascunhos],
  );
  const tirarRascunho = useCallback((k) => gravarRascunhos((l) => l.filter((d) => d.chave !== k)), [gravarRascunhos]);
  // devolve à tela o que estava salvo (leituras, pagamento, transporte, desconto…)
  const aplicarRascunho = useCallback((r) => {
    const e = r?.estado || {};
    setLidos(e.lidos || {});
    setNaoResolvidos(e.naoResolvidos || []);
    processed.current = new Set([...Object.values(e.lidos || {}).flatMap((l) => l.epcs || []), ...(e.naoResolvidos || [])]);
    if (e.customer) setCustomer(e.customer);
    if (e.seller) setSeller(e.seller);
    setConsumidorFinal(!!e.consumidorFinal);
    if (e.operacao) setOperacao(e.operacao);
    setDataDiferente(!!e.dataDiferente);
    setDataVenda(e.dataVenda || '');
    if (e.transp) setTransp(e.transp);
    if (Array.isArray(e.pagamentos) && e.pagamentos.length) setPagamentos(e.pagamentos);
    if (Array.isArray(e.vencimentos)) setVencimentos(e.vencimentos);
    setDescPct(e.descPct || '');
    setDescLiberado(e.descLiberado || null);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fat_terminal', terminal);
      localStorage.setItem('fat_como_fatura', comoFatura ? '1' : '0');
    } catch {
      /* sem storage */
    }
  }, [terminal, comoFatura]);

  const limparLeituras = useCallback(() => {
    setLidos({});
    setNaoResolvidos([]);
    processed.current = new Set();
    portalClear().catch(() => {});
  }, []);

  // ─── Carrega o pedido + sugestões ────────────────────────────────────────
  useEffect(() => {
    setPedido(null);
    setPrep(null);
    setErroPedido('');
    setResultado(null);
    setConfirmaDuplicar(false);
    setConsumidorFinal(false);
    setDataDiferente(false);
    setDataVenda('');
    setLidos({});
    setNaoResolvidos([]);
    processed.current = new Set();
    setDescPct('');
    setDescLiberado(null);
    // etiquetas que o portal ainda guarda são do pedido anterior: sem limpar,
    // elas entravam no pedido seguinte como "sobrando"
    portalClear().catch(() => {});
    if (!chave) return undefined;
    let vivo = true;
    setCarregando(true);
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE_URL}/api/pedidos-venda/${encodeURIComponent(chave)}`).then((r) => r.json()),
          fetch(`${API}/preparar/${encodeURIComponent(chave)}`).then((r) => r.json()),
        ]);
        if (!r1.success) throw new Error(r1.message || 'Pedido não encontrado');
        if (!r2.success) throw new Error(r2.message || 'Não consegui preparar o faturamento');
        if (!vivo) return;
        const d = r1.data;
        const p = r2.data;
        setPedido(d);
        setPrep(p);
        setCustomer(p.cliente?.code ? { code: p.cliente.code, name: p.cliente.nome || `Cliente ${p.cliente.code}` } : null);
        setSeller(p.vendedorCode ? String(p.vendedorCode) : '');
        setOperacao(String(p.operacaoDocInterno || ''));
        const tr = p.transportadoras.find((t) => t.id === p.transporte.id);
        setTransp({
          id: p.transporte.id,
          code: p.transporte.code,
          nome: tr && tr.code ? tr.label : null,
          servico: p.transporte.servico || '',
          frete: p.transporte.frete || 0,
          modFrete: p.transporte.modFrete,
          volumes: p.transporte.volumes,
          pesoB: p.transporte.pesoB || 0,
        });
        const formas = p.pagamento.formas.length ? p.pagamento.formas : ['pix'];
        setPagamentos(
          formas.map((f, i) => ({
            forma: f,
            valor: 0,
            parcelas: f === 'boleto' || f === 'credito' ? p.pagamento.parcelas || 1 : 1,
            nsu: f === 'credito' || f === 'debito' ? p.pagamento.nsu || '' : '',
            autorizacao: f === 'credito' || f === 'debito' ? p.pagamento.autorizacao || '' : '',
            bandeira: f === 'credito' || f === 'debito' ? String(p.pagamento.bandeira || '').toLowerCase() : '',
            auto: i === 0,
          })),
        );
        setVencimentos(p.pagamento.vencimentos || []);
        // faturamento salvo "em andamento" deste pedido: devolve as leituras e o resto
        const salvo = rascunhoPendente.current;
        if (salvo && salvo.chave === chave) {
          rascunhoPendente.current = null;
          aplicarRascunho(salvo);
        }
      } catch (e) {
        if (vivo) setErroPedido(e.message);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/pdv/sellers?branch=${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => setSellers(j?.data?.items || []))
      .catch(() => setSellers([]));
  }, []);

  // Saldos do cliente no TOTVS: CREDEV e adiantamento, só da empresa 99
  useEffect(() => {
    setSaldos(null);
    if (!customer?.code) return undefined;
    let vivo = true;
    fetch(`${API_BASE_URL}/api/totvs/pdv/customer-balance?code=${customer.code}&branch=${EMPRESA}`)
      .then((r) => r.json())
      .then((j) => vivo && setSaldos(j?.success ? j.data : { erro: j?.message || 'não consegui consultar' }))
      .catch((e) => vivo && setSaldos({ erro: e.message }));
    return () => {
      vivo = false;
    };
  }, [customer?.code]);
  const saldoInfo = useCallback(
    (forma) => {
      const campo = CAMPO_SALDO[forma];
      if (!campo || !saldos || saldos.erro) return null;
      // saldos.credev / saldos.adiantamento já são os da empresa consultada (99)
      return { total: Math.max(0, round2(Number(saldos[campo]) || 0)) };
    },
    [saldos],
  );

  const itensPedido = useMemo(() => (pedido ? itensDoPedido(pedido) : []), [pedido]);
  const difCard = useMemo(() => (pedido ? diferencaCardSeparacao(pedido) : null), [pedido]);
  const descontos = useMemo(() => (pedido ? resumoDescontos(pedido, itensPedido) : []), [pedido, itensPedido]);
  const skusPedido = useMemo(() => new Set(itensPedido.map((i) => i.sku)), [itensPedido]);

  // ─── Prévia fiscal (cenário + CFOP por peça) ─────────────────────────────
  useEffect(() => {
    setPrevia(null);
    setPreviaErro('');
    if (!customer?.code || !itensPedido.length) return undefined;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/previa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clienteCode: customer.code, consumidorFinal, itens: itensPedido.map((i) => ({ productCode: Number(i.sku), referencia: i.descricao })) }),
        });
        const j = await r.json();
        if (!vivo) return;
        if (!j.success) throw new Error(j.message);
        setPrevia(j.data);
      } catch (e) {
        if (vivo) setPreviaErro(e.message);
      }
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [customer, consumidorFinal, itensPedido]);
  const cfopPor = useMemo(() => new Map((previa?.itens || []).map((i) => [String(i.productCode), i])), [previa]);

  // ─── Portal RFID ─────────────────────────────────────────────────────────
  const portalLigado = ['lendo', 'conectando', 'reconectando'].includes(portalStatus.status);
  const ligarPortal = useCallback(async () => {
    setPortalBusy(true);
    try {
      const j = await portalConnect({});
      if (!j?.success) showToast('erro', j?.message || 'Falha ao ligar o portal');
      else setPortalStatus(j.data);
    } catch (e) {
      showToast('erro', `Portal indisponível — instale/inicie o Agente do Portal nesta máquina (${e.message})`);
    } finally {
      setPortalBusy(false);
    }
  }, [showToast]);
  const desligarPortal = useCallback(async () => {
    setPortalBusy(true);
    try {
      const j = await portalDisconnect();
      if (j?.data) setPortalStatus(j.data);
    } catch {
      /* segue */
    } finally {
      setPortalBusy(false);
    }
  }, []);
  const consultarProduto = useCallback(async (code) => {
    const r = await fetch(`${API_BASE_URL}/api/totvs/pdv/product/${encodeURIComponent(code)}?branch=${EMPRESA}&priceCodes=4`);
    const j = await r.json();
    return { ok: r.ok && !!j?.data?.product, data: j?.data, message: j?.message };
  }, []);
  const somar = useCallback(
    (data, { epc = null, manual = 0 }) => {
      const p = data.product;
      const sku = String(p.productCode);
      const padrao = (data.prices || []).find((x) => x.promotionalPrice > 0 || x.price > 0);
      const precoTotvs = padrao ? (padrao.promotionalPrice > 0 ? padrao.promotionalPrice : padrao.price) : 0;
      setLidos((prev) => {
        const cur = prev[sku] || { sku, nome: p.productName, epcs: [], manual: 0, precoTotvs };
        return { ...prev, [sku]: { ...cur, epcs: epc && !cur.epcs.includes(epc) ? [...cur.epcs, epc] : cur.epcs, manual: cur.manual + manual } };
      });
      beep(skusPedido.has(sku));
    },
    [skusPedido],
  );
  const resolverEpc = useCallback(
    async (epc) => {
      try {
        const res = await consultarProduto(epc);
        if (res.ok) somar(res.data, { epc });
        else setNaoResolvidos((l) => (l.includes(epc) ? l : [...l, epc]));
      } catch {
        processed.current.delete(epc);
      }
    },
    [consultarProduto, somar],
  );
  useEffect(() => {
    if (!chave || aba !== 'faturar') return undefined;
    const timer = setInterval(async () => {
      try {
        const j = await portalTags();
        if (!j?.data) return;
        setPortalStatus(j.data.status);
        for (const t of j.data.tags || []) {
          if (!processed.current.has(t.epc)) {
            processed.current.add(t.epc);
            resolverEpc(t.epc);
          }
        }
      } catch {
        /* agente/backend fora */
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [chave, aba, resolverEpc]);
  const adicionarManual = useCallback(async () => {
    const code = codigoManual.trim();
    if (!code || manualBusy) return;
    setManualBusy(true);
    setCodigoManual('');
    try {
      const res = await consultarProduto(code);
      if (!res.ok) {
        beep(false);
        showToast('erro', res.message || `Código ${code} não encontrado`);
        return;
      }
      somar(res.data, { manual: 1 });
    } catch (e) {
      beep(false);
      showToast('erro', `Erro na consulta: ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  }, [codigoManual, manualBusy, consultarProduto, somar, showToast]);
  const removerEpc = useCallback((sku, epc) => {
    processed.current.delete(epc);
    setLidos((prev) => {
      const cur = prev[sku];
      if (!cur) return prev;
      const novo = { ...cur, epcs: cur.epcs.filter((e) => e !== epc) };
      const next = { ...prev, [sku]: novo };
      if (novo.epcs.length + novo.manual <= 0) delete next[sku];
      return next;
    });
  }, []);
  const tirarManual = useCallback((sku) => {
    setLidos((prev) => {
      const cur = prev[sku];
      if (!cur || cur.manual <= 0) return prev;
      const novo = { ...cur, manual: cur.manual - 1 };
      const next = { ...prev, [sku]: novo };
      if (novo.epcs.length + novo.manual <= 0) delete next[sku];
      return next;
    });
  }, []);

  // desconto dado na tela (só Brejinho), em % sobre o valor de cada peça
  const pctDesc = brejinho ? Math.min(100, Math.max(0, round2(Number(String(descPct).replace(',', '.')) || 0))) : 0;

  // ─── Conferência: SKU do pedido × SKU lido ───────────────────────────────
  const conf = useMemo(() => {
    const linhas = itensPedido.map((i) => {
      const l = lidos[i.sku];
      const lido = l ? l.epcs.length + l.manual : 0;
      const conferido = Math.min(lido, i.qtd);
      // unidade sem preço no pedido usa o preço do TOTVS
      const unidades = i.unidades.map((u) => {
        const preco = u.preco > 0 ? u.preco : round2(l?.precoTotvs || 0);
        // desconto do faturamento por cima do que o pedido já trouxe
        const extra = pctDesc > 0 ? round2(((preco - u.desc) * pctDesc) / 100) : 0;
        return { ...u, preco, desc: round2(u.desc + extra), descExtra: extra };
      });
      const precos = unidades.map((u) => u.preco);
      const preco = round2(precos.reduce((s, v) => s + v, 0) / precos.length);
      const confU = unidades.slice(0, conferido);
      const brutoConferido = round2(confU.reduce((s, u) => s + u.preco, 0));
      const descConferido = round2(confU.reduce((s, u) => s + u.desc, 0));
      const valorConferido = round2(brutoConferido - descConferido);
      const valorTotal = round2(unidades.reduce((s, u) => s + u.preco - u.desc, 0));
      return {
        ...i,
        descExtraConferido: round2(confU.reduce((s, u) => s + (u.descExtra || 0), 0)),
        unidades,
        precos,
        preco,
        brutoConferido,
        descConferido,
        valorConferido,
        valorTotal,
        lido,
        conferido,
        falta: i.qtd - conferido,
        sobra: Math.max(0, lido - i.qtd),
        epcs: l?.epcs || [],
        manual: l?.manual || 0,
      };
    });
    const fora = Object.values(lidos)
      .filter((l) => !skusPedido.has(l.sku))
      .map((l) => ({ ...l, lido: l.epcs.length + l.manual }));
    const esperado = linhas.reduce((s, l) => s + l.qtd, 0);
    const conferidas = linhas.reduce((s, l) => s + l.conferido, 0);
    const faltando = esperado - conferidas;
    const sobrando = linhas.reduce((s, l) => s + l.sobra, 0) + fora.reduce((s, l) => s + l.lido, 0);
    const totalPedido = round2(linhas.reduce((s, l) => s + l.valorTotal, 0));
    const brutoConferido = round2(linhas.reduce((s, l) => s + l.brutoConferido, 0));
    const descConferido = round2(linhas.reduce((s, l) => s + l.descConferido, 0));
    const totalConferido = round2(brutoConferido - descConferido);
    const descExtraConferido = round2(linhas.reduce((s, l) => s + l.descExtraConferido, 0));
    return { linhas, fora, esperado, conferidas, faltando, sobrando, totalPedido, brutoConferido, descConferido, descExtraConferido, totalConferido, ok: esperado > 0 && faltando === 0 && sobrando === 0 };
  }, [itensPedido, lidos, skusPedido, pctDesc]);

  // ─── Totais e pagamento ──────────────────────────────────────────────────
  const temTransportadora = transp.id !== 'RETIRADA' && !!transp.code;
  const frete = temTransportadora ? round2(transp.frete) : 0;
  const totalNota = round2(conf.totalConferido + frete);
  // forma "automática" (a primeira) acompanha o total: total − as outras formas
  useEffect(() => {
    setPagamentos((ps) => {
      if (!ps.length) return ps;
      const outras = round2(ps.filter((p) => !p.auto).reduce((s, p) => s + Number(p.valor || 0), 0));
      const alvo = round2(Math.max(0, totalNota - outras));
      return ps.map((p) => (p.auto && p.valor !== alvo ? { ...p, valor: alvo } : p));
    });
  }, [totalNota, pagamentos.map((p) => (p.auto ? '' : p.valor)).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const somaPag = round2(pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0));
  const pBoleto = pagamentos.find((p) => p.forma === 'boleto');
  const parcelasBoleto = pBoleto ? parcelasIguais(Number(pBoleto.valor || 0), pBoleto.parcelas) : [];
  const setPag = (i, patch) => setPagamentos((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  // ─── Validação ───────────────────────────────────────────────────────────
  const card = pedido?.card || null;
  const ref =
    prep?.ref ||
    card?.numero_site ||
    pedido?.separacao?.ref ||
    (chave.startsWith('SEP:') ? chave.slice(4) : null) ||
    (card?.dados?.brejinho ? `BRJ ${card.dados.brejinho.pedido_showroom || card.dados.brejinho.id}` : null);
  const fatsVivos = (pedido?.faturamentos || []).filter((f) => f.venda_id && f.nf_status === 'autorizada');
  const jaNoTotvs = prep?.jaNoTotvs || [];
  const precisaConfirmar = jaNoTotvs.length > 0 || fatsVivos.length > 0;
  const semPreco = conf.linhas.some((l) => l.conferido > 0 && l.unidades.slice(0, l.conferido).some((u) => !(u.preco > 0)));
  const pendencias = [];
  if (!customer) pendencias.push('Escolha o cliente.');
  if (previa && !previa.cliente.temEndereco) pendencias.push('Cliente sem endereço completo no TOTVS (a NF-e exige).');
  if (previa && !previa.difalOk) pendencias.push(`DIFAL de ${previa.cenario.destUf} ainda não conferido — fature esta pelo TOTVS ou marque se o cliente tem IE.`);
  if (previaErro) pendencias.push(previaErro);
  if (!seller) pendencias.push('Escolha o vendedor.');
  if (!operacao) pendencias.push('Escolha a operação do documento interno.');
  if (dataDiferente && !/^\d{4}-\d{2}-\d{2}$/.test(dataVenda)) pendencias.push('Informe a data da venda (transação com data diferente).');
  if (dataDiferente && dataVenda > hojeIso()) pendencias.push('A data da venda não pode ser depois de hoje.');
  if (conf.conferidas === 0) pendencias.push('Ligue o portal e passe as peças do pedido.');
  if (semPreco) pendencias.push('Há peça conferida sem preço.');
  if (transp.id !== 'RETIRADA' && !transp.code) pendencias.push('Escolha a transportadora (em "Outro", pesquise pelo nome ou código).');
  if (!pagamentos.length) pendencias.push('Informe o pagamento.');
  if (!comoFatura && pagamentos.some((p) => (p.forma === 'credito' || p.forma === 'debito') && !cartaoDe(p)?.opcao))
    pendencias.push('Escolha a operadora e o parcelamento do cartão (cadastro do TOTVS).');
  if (Math.abs(somaPag - totalNota) > 0.01) pendencias.push(`Pagamento (${fmtBRL(somaPag)}) não fecha com o total da nota (${fmtBRL(totalNota)}).`);
  // desconto acima do limite: quem é owner/admin/financeiro passa direto; os demais pedem a senha
  const descSemLimite = ROLES_LIBERAM_DESCONTO.includes(user?.role);
  const descPrecisaSenha = pctDesc > LIMITE_DESCONTO_LIVRE && !descSemLimite && !(descLiberado && Number(descLiberado.pct) >= pctDesc);
  if (descPrecisaSenha) pendencias.push(`Desconto de ${pctDesc.toLocaleString('pt-BR')}% passa de ${LIMITE_DESCONTO_LIVRE}%: precisa da senha de owner, admin ou financeiro.`);
  if (pctDesc >= 100) pendencias.push('O desconto não pode ser de 100%.');
  // CREDEV / adiantamento: não pode usar mais do que o cliente tem no TOTVS
  const usoSaldo = (forma) => round2(pagamentos.filter((p) => p.forma === forma).reduce((t, p) => t + Number(p.valor || 0), 0));
  for (const forma of Object.keys(CAMPO_SALDO)) {
    const uso = usoSaldo(forma);
    if (!(uso > 0)) continue;
    if (!saldos) pendencias.push(`Aguarde a consulta do saldo de ${FORMAS[forma]} do cliente no TOTVS.`);
    else if (saldos.erro) pendencias.push(`Não consegui consultar o saldo de ${FORMAS[forma]} no TOTVS (${saldos.erro}).`);
    else if (uso > (saldoInfo(forma)?.total || 0) + 0.005)
      pendencias.push(`${FORMAS[forma]} usado (${fmtBRL(uso)}) é maior que o saldo do cliente na empresa ${EMPRESA} (${fmtBRL(saldoInfo(forma)?.total || 0)}).`);
  }
  if (pBoleto && parcelasBoleto.some((_, i) => !/^\d{4}-\d{2}-\d{2}$/.test(vencimentos[i] || ''))) pendencias.push('Informe o vencimento de cada parcela do boleto.');
  if (precisaConfirmar && !confirmaDuplicar) pendencias.push('Confirme o aviso de lançamento já existente.');
  const podeFaturar = !posting && !resultado && pendencias.length === 0;

  // ─── Faturamento em andamento: salvar e retomar depois ───────────────────
  const salvarRascunho = () => {
    if (!chave || !pedido) return;
    const registro = {
      chave,
      em: Date.now(),
      ref: ref || null,
      cliente: customer?.name || card?.dados?.nome_cliente || pedido.separacao?.cliente || null,
      lidas: conf.conferidas + conf.sobrando,
      esperado: conf.esperado,
      estado: { lidos, naoResolvidos, customer, seller, consumidorFinal, operacao, dataDiferente, dataVenda, transp, pagamentos, vencimentos, descPct, descLiberado },
    };
    gravarRascunhos((l) => [registro, ...l.filter((d) => d.chave !== chave)].slice(0, 30));
    showToast('ok', 'Faturamento salvo — está em "Em andamento" para continuar depois');
  };
  const abrirRascunho = (d) => {
    setRascunhosOpen(false);
    if (d.chave === chave && pedido) {
      aplicarRascunho(d);
      showToast('ok', 'Faturamento retomado');
      return;
    }
    rascunhoPendente.current = d;
    setParams({ chave: d.chave });
  };
  const rascunhoAtual = rascunhos.find((d) => d.chave === chave) || null;

  // ─── FATURAR ─────────────────────────────────────────────────────────────
  const faturar = useCallback(async () => {
    if (!podeFaturar) return;
    setPosting(true);
    try {
      const vend = sellers.find((s) => String(s.code) === String(seller));
      const body = {
        chave,
        numeroSite: ref,
        canal: prep?.canal,
        clienteCode: customer.code,
        vendedorCode: Number(seller),
        vendedorNome: vend?.name || null,
        operacaoDocInterno: Number(operacao),
        consumidorFinal,
        dataVenda: dataDiferente && dataVenda ? dataVenda : null,
        terminal: Number(terminal) || 1,
        receberComoFatura: comoFatura,
        descontoFaturamento:
          pctDesc > 0
            ? { pct: pctDesc, liberadoPor: pctDesc > LIMITE_DESCONTO_LIVRE ? descLiberado?.nome || (descSemLimite ? user?.name || user?.email : null) : null }
            : null,
        itens: conf.linhas
          .filter((l) => l.conferido > 0)
          .flatMap((l) => {
            let ini = 0;
            return linhasPorPreco(l.unidades, l.conferido).map((g) => {
              const epcs = l.epcs.slice(ini, ini + g.qtd);
              ini += g.qtd;
              return { productCode: Number(l.sku), quantidade: g.qtd, valorUnit: g.valor, descontoUnit: g.desc, nome: l.descricao, epcs };
            });
          }),
        transporte: temTransportadora
          ? { code: transp.code, servico: transp.servico || null, frete, modFrete: Number(transp.modFrete), volumes: Number(transp.volumes) || 1, pesoB: Number(transp.pesoB) || 0 }
          : { code: null, frete: 0 },
        pagamentos: pagamentos.map((p) => {
          const c = cartaoDe(p);
          return {
            forma: p.forma,
            valor: round2(p.valor),
            parcelas: c?.opcao ? c.opcao.parcelas : Number(p.parcelas) || 1,
            nsu: p.nsu || null,
            autorizacao: p.autorizacao || null,
            bandeira: p.bandeira || null,
            cartao: c?.opcao
              ? { seq: c.opcao.seq, descricao: c.opcao.descricao, parcelas: c.opcao.parcelas, portador: c.grupo.portador, operadora: c.grupo.operadora, bandeira: c.grupo.bandeira }
              : null,
          };
        }),
        vencimentos: pBoleto ? parcelasBoleto.map((_, i) => vencimentos[i]) : [],
        comprovantes: prep?.comprovantes || [],
        pedidoInfo: { forma: prep?.pagamento?.formaTexto, nsu: prep?.pagamento?.nsu, autorizacao: prep?.pagamento?.autorizacao },
        qtdPedido: conf.esperado,
        faltando: conf.linhas.filter((l) => l.falta > 0).map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.falta })),
        sobrando: [
          ...conf.linhas.filter((l) => l.sobra > 0).map((l) => ({ productCode: l.sku, name: l.descricao, quantidade: l.sobra, epcs: l.epcs.slice(l.qtd) })),
          ...conf.fora.map((l) => ({ productCode: l.sku, name: l.nome, quantidade: l.lido, epcs: l.epcs })),
        ],
        por: user?.name || user?.email || null,
      };
      const r = await fetch(`${API}/faturar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.success) {
        beep(false);
        showToast('erro', j.message || 'Falha ao faturar');
        return;
      }
      setResultado(j.data);
      if (j.data.fiscal?.ok) tirarRascunho(chave); // virou nota: sai da lista "em andamento"
      beep(j.data.fiscal?.ok && j.data.totvs?.ok);
      showToast(j.data.fiscal?.ok && j.data.totvs?.ok ? 'ok' : 'erro', j.message);
    } catch (e) {
      showToast('erro', `Falha ao faturar: ${e.message}`);
    } finally {
      setPosting(false);
    }
  }, [podeFaturar, prep, customer, conf, frete, operacao, dataDiferente, dataVenda, terminal, comoFatura, sellers, seller, chave, ref, consumidorFinal, temTransportadora, transp, pagamentos, cartaoDe, pBoleto, parcelasBoleto, vencimentos, user, showToast, pctDesc, descLiberado, descSemLimite, tirarRascunho]);

  const reprocessar = useCallback(async () => {
    if (!resultado?.vendaId) return;
    setPosting(true);
    try {
      const r = await fetch(`${API}/vendas/${resultado.vendaId}/reprocessar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminal: Number(terminal) || 1, comoFatura }),
      });
      const j = await r.json();
      if (j.success) setResultado(j.data);
      showToast(j.data?.fiscal?.ok && j.data?.totvs?.ok ? 'ok' : 'erro', j.message);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setPosting(false);
    }
  }, [resultado, terminal, comoFatura, showToast]);

  const escolherPedido = (k) => setParams(k ? { chave: k } : {});
  const irAba = (a) => setParams(a === 'transacoes' ? { aba: 'transacoes' } : chave ? { chave } : {});

  // ─── Render ──────────────────────────────────────────────────────────────
  const cen = previa ? CENARIOS[previa.cenario.chave] : null;
  const notaRes = resultado?.nota;
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle
          title={brejinho ? 'Faturamento — Brejinho' : 'Faturamento'}
          subtitle="NF-e emitida pelo HeadCoach (empresa 99) + documento interno e contas a receber no TOTVS (empresa 990)"
          icon={Receipt}
        />

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(brejinho ? '/expedicao/brejinho/pedidos' : '/expedicao/pedidos-venda')}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
          >
            <ArrowLeft size={13} /> {brejinho ? 'Pedidos Brejinho' : 'Pedido de Venda'}
          </button>
          <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-gray-200">
            {[
              { id: 'faturar', label: 'Faturar', icon: Receipt },
              { id: 'transacoes', label: 'Transações', icon: ListBullets },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => irAba(t.id)}
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-bold ${aba === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'}`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
          {chave && aba === 'faturar' && (
            <button onClick={() => escolherPedido('')} className="h-8 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">
              Escolher outro pedido
            </button>
          )}
        </div>

        {aba === 'faturar' && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRascunhosOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
              >
                <ClockCounterClockwise size={14} /> Em andamento ({rascunhos.length})
              </button>
              {chave && pedido && !resultado && (
                <button
                  onClick={salvarRascunho}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#000638] shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  <FloppyDisk size={14} /> Salvar para continuar depois
                </button>
              )}
              {rascunhoAtual && !resultado && <span className="text-[11px] text-gray-500">Este pedido tem um faturamento salvo em {fmtDataHora(rascunhoAtual.em)}</span>}
            </div>
            {rascunhosOpen && (
              <div className="mb-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                {rascunhos.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum faturamento salvo. Abra um pedido, leia as peças e use “Salvar para continuar depois”.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {rascunhos.map((d) => (
                      <li key={d.chave} className="flex items-center gap-2 py-1.5 text-xs">
                        <span className="w-24 shrink-0 text-gray-400">{fmtDataHora(d.em)}</span>
                        <span className="w-20 shrink-0 font-mono font-bold text-[#000638]">{d.ref || '—'}</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{d.cliente || 'Sem cliente'}</span>
                        <span className="shrink-0 tabular-nums text-gray-500">
                          {d.lidas || 0} de {d.esperado || 0} pç lidas
                        </span>
                        <button onClick={() => abrirRascunho(d)} className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
                          abrir
                        </button>
                        <button onClick={() => tirarRascunho(d.chave)} className="text-gray-300 hover:text-rose-500" title="Apagar">
                          <Trash size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-[10.5px] text-gray-400">Fica salvo neste computador, no seu usuário. Sai da lista sozinho quando a nota é emitida.</p>
              </div>
            )}
          </>
        )}

        {aba === 'transacoes' ? (
          <AbaTransacoes />
        ) : !chave ? (
          <ListaSeparados onEscolher={escolherPedido} origem={origem} />
        ) : carregando ? (
          <div className="py-16 text-center text-gray-400">
            <Spinner size={22} className="mx-auto animate-spin" />
          </div>
        ) : erroPedido ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erroPedido}</p>
        ) : pedido && prep ? (
          <>
            {/* Pedido */}
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-[#000638] shadow-sm">
              <span className="font-mono text-sm font-bold">{ref || '—'}</span>
              <span className="font-semibold">{card?.dados?.nome_cliente || pedido.separacao?.cliente || card?.titulo}</span>
              <span className="text-gray-500">{CANAIS[prep.canal] || prep.canal}</span>
              <span className="text-gray-500">{prep.pagamento.formaTexto || ''}</span>
              <span>
                <b>{conf.esperado}</b> peça(s) · <b>{fmtBRL(conf.totalPedido)}</b>
              </span>
              {card?.status && <Chip>{card.status}</Chip>}
              <span className="flex-1" />
              {prep.numeracao?.serie != null && (
                <Chip cls={Number(prep.numeracao.ambiente) === 1 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                  NF-e série {prep.numeracao.serie} · {Number(prep.numeracao.ambiente) === 1 ? 'PRODUÇÃO' : 'homologação'}
                </Chip>
              )}
            </div>

            {precisaConfirmar && !resultado && (
              <div className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-300">
                <p className="inline-flex items-center gap-1 font-semibold">
                  <Warning size={14} weight="bold" /> Atenção: este pedido já tem lançamento
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {jaNoTotvs.length > 0 && <li>O Dryland já abriu no TOTVS: {jaNoTotvs.join(', ')} — confira para não faturar duas vezes.</li>}
                  {fatsVivos.map((f) => (
                    <li key={f.id}>
                      Já faturado aqui em {fmtDataHora(f.criado_em)}: NF {f.nf_numero}/{f.nf_serie} · {f.qtd_conferida} pç · {fmtBRL(f.total)}
                    </li>
                  ))}
                </ul>
                <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={confirmaDuplicar} onChange={(e) => setConfirmaDuplicar(e.target.checked)} className="mb-0 !h-4 !w-4 shrink-0 accent-amber-600" />
                  Conferi e quero faturar mesmo assim
                </label>
              </div>
            )}

            <div className="grid items-start gap-2 lg:grid-cols-[1fr_330px]">
              {/* ── Coluna esquerda ── */}
              <div className="space-y-2">
                {/* Cliente / fiscal */}
                <Bloco titulo="Cliente e fiscal" icone={FileText}>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className={labelCls}>Empresa</label>
                      <div className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 text-sm font-semibold text-[#000638] ring-1 ring-gray-200">
                        <Buildings size={15} className="text-gray-400" /> {EMPRESA} · {prep.emitente.uf}
                      </div>
                    </div>
                    <ClientePicker
                      value={customer}
                      onSelect={(c) => {
                        setCustomer(c);
                        setConsumidorFinal(false);
                      }}
                    />
                    <div>
                      <label className={labelCls}>Vendedor</label>
                      <div className="relative">
                        <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select value={seller} onChange={(e) => setSeller(e.target.value)} className={`${inputCls} pl-8 ${seller ? '' : 'border-amber-400'}`}>
                          <option value="">Selecione…</option>
                          {seller && !sellers.some((s) => String(s.code) === seller) && <option value={seller}>{seller} — vendedor do pedido</option>}
                          {sellers.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {customer && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2 text-xs ring-1 ring-gray-200">
                      {!previa && !previaErro && (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Spinner size={12} className="animate-spin" /> conferindo cadastro e tributação…
                        </span>
                      )}
                      {previa && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            {previa.cliente.cnpj ? `CNPJ ${previa.cliente.cnpj}` : `CPF ${previa.cliente.cpf || '—'}`} · {previa.cliente.ie ? `IE ${previa.cliente.ie}` : 'sem IE'} ·{' '}
                            {previa.cliente.cidade}/{previa.cliente.uf}
                          </span>
                          <Chip cls="bg-indigo-50 text-[#000638] ring-indigo-200">
                            {cen?.label} · CFOP {cen?.cfop} · {cen?.icms}
                            {previa.aliqDifal ? ` (${previa.cenario.destUf} ${previa.aliqDifal}%)` : ''}
                          </Chip>
                          {(previa.cliente.ie || consumidorFinal) && previa.cenario.interestadual && (
                            <label className="inline-flex cursor-pointer items-center gap-1 text-gray-600" title="Use quando o cliente tem IE mas o TOTVS o trata como consumidor final (ex.: MEI): vira CFOP 6107/6108 com DIFAL">
                              <input type="checkbox" checked={consumidorFinal} onChange={(e) => setConsumidorFinal(e.target.checked)} className="mb-0 !h-3.5 !w-3.5" />
                              tratar como consumidor final
                            </label>
                          )}
                        </div>
                      )}
                      {previaErro && <span className="text-rose-600">{previaErro}</span>}
                    </div>
                  )}
                </Bloco>

                {/* Conferência */}
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-bold text-[#000638]">
                      <Package size={14} /> Produtos do pedido
                    </span>
                    <span className="text-emerald-700">
                      <b>{conf.conferidas}</b> de {conf.esperado} conferidas
                    </span>
                    {conf.faltando > 0 && (
                      <span className="text-amber-700">
                        <b>{conf.faltando}</b> faltando
                      </span>
                    )}
                    {conf.sobrando > 0 && (
                      <span className="text-rose-700">
                        <b>{conf.sobrando}</b> sobrando
                      </span>
                    )}
                    {conf.ok && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <CheckCircle size={14} weight="fill" /> tudo confere
                      </span>
                    )}
                  </div>
                  <p className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-[10.5px] text-gray-500">
                    {pedido?.separacaoIncompleta
                      ? 'Pedido antigo: a separação saiu da tela do Dryland antes de o HeadCoach guardar todas as linhas. Peças do card do pedido (com as trocas registradas nele).'
                      : (pedido?.itens || []).length > 0
                        ? 'Peças da separação do Dryland (tela Separar · Loja Virtual Max).'
                        : 'Este pedido não tem separação no Dryland: peças do card do pedido.'}
                  </p>
                  {difCard && (
                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
                      <b>O card do Painel está diferente da separação.</b> Vale a separação.
                      {difCard.soSeparacao.length > 0 && <span className="block">Só na separação (entra na nota): {difCard.soSeparacao.map((x) => `${x.qtd}x ${x.sku} ${x.nome}`).join(' · ')}</span>}
                      {difCard.soCard.length > 0 && <span className="block">Só no card (fica fora da nota): {difCard.soCard.map((x) => `${x.qtd}x ${x.sku} ${x.nome}`).join(' · ')}</span>}
                    </div>
                  )}
                  {conf.linhas.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-gray-400">Este pedido não tem itens no Dryland.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {conf.linhas.map((l) => {
                        const cor =
                          l.conferido === l.qtd && l.sobra === 0
                            ? 'border-l-emerald-500 bg-emerald-50/40'
                            : l.sobra > 0
                              ? 'border-l-rose-500 bg-rose-50/40'
                              : l.conferido > 0
                                ? 'border-l-amber-400 bg-amber-50/30'
                                : 'border-l-gray-200';
                        const fx = cfopPor.get(l.sku);
                        return (
                          <li key={l.sku} className={`border-l-4 px-3 py-2 ${cor}`}>
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-800">{l.descricao || `SKU ${l.sku}`}</p>
                                <p className="text-[11px] text-gray-500">
                                  SKU <b className="font-mono text-[#000638]">{l.sku}</b>
                                  {l.cor ? ` · ${l.cor}` : ''}
                                  {l.tam ? ` · ${l.tam}` : ''} · {[...new Set(l.precos)].map((v) => fmtBRL(v)).join(' + ')}
                                  {l.unidades.some((u) => u.black) && (
                                    <span className="ml-1 rounded bg-rose-50 px-1 font-semibold text-rose-700">
                                      Black −{l.unidades.find((u) => u.black).black.pct ?? '?'}%
                                      {l.unidades.find((u) => u.black).black.antes ? ` (de ${fmtBRL(l.unidades.find((u) => u.black).black.antes)})` : ''}
                                      {l.unidades.filter((u) => u.black).length < l.qtd ? ` em ${l.unidades.filter((u) => u.black).length} de ${l.qtd}` : ''}
                                    </span>
                                  )}
                                  {l.unidades.some((u) => u.troca) && <span className="ml-1 rounded bg-sky-50 px-1 font-semibold text-sky-700">troca de {l.unidades.find((u) => u.troca).troca}</span>}
                                  {l.unidades.some((u) => u.desc > 0) && (
                                    <span className="ml-1 rounded bg-amber-50 px-1 font-semibold text-amber-700">
                                      − {fmtBRL(l.unidades.reduce((s, u) => s + u.desc, 0))} desc. pedido
                                    </span>
                                  )}
                                  {fx && (
                                    <span className="ml-1 rounded bg-indigo-50 px-1 font-semibold text-[#000638]" title={fx.tipo === 'adquirido' ? 'mercadoria adquirida de terceiros' : 'produção do estabelecimento'}>
                                      CFOP {fx.cfop}
                                    </span>
                                  )}
                                  {!(l.preco > 0) && <span className="font-semibold text-rose-600"> sem preço</span>}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-base font-bold tabular-nums text-[#000638]">
                                  {l.lido}
                                  <span className="font-normal text-gray-400">/{l.qtd}</span>
                                </p>
                                <p className="text-[10px] font-semibold">
                                  {l.conferido === l.qtd && l.sobra === 0 ? (
                                    <span className="text-emerald-700">ok</span>
                                  ) : l.sobra > 0 ? (
                                    <span className="text-rose-700">+{l.sobra} a mais</span>
                                  ) : (
                                    <span className="text-amber-700">falta {l.falta}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {(l.epcs.length > 0 || l.manual > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {l.epcs.map((epc) => (
                                  <span key={epc} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-1.5 py-0.5 font-mono text-[10px] text-purple-700 ring-1 ring-purple-200">
                                    <Tag size={9} /> {epc}
                                    <button onClick={() => removerEpc(l.sku, epc)} className="text-purple-300 hover:text-rose-600" title="Tirar esta etiqueta">
                                      <X size={9} weight="bold" />
                                    </button>
                                  </span>
                                ))}
                                {l.manual > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 ring-1 ring-blue-200">
                                    <Barcode size={10} /> {l.manual} digitada(s)
                                    <button onClick={() => tirarManual(l.sku)} className="text-blue-300 hover:text-rose-600" title="Tirar uma">
                                      <Minus size={9} weight="bold" />
                                    </button>
                                  </span>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {conf.fora.length > 0 && (
                    <div className="border-t border-rose-200 bg-rose-50/60">
                      <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                        Lidas que NÃO estão no pedido ({conf.fora.reduce((s, l) => s + l.lido, 0)}) — não entram na nota
                      </p>
                      <ul className="divide-y divide-rose-100">
                        {conf.fora.map((l) => (
                          <li key={l.sku} className="px-3 py-1.5 text-xs">
                            <p className="font-semibold text-rose-800">
                              {l.nome} <span className="font-mono font-normal">· SKU {l.sku}</span> · {l.lido} pç
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {l.epcs.map((epc) => (
                                <span key={epc} className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 font-mono text-[10px] text-rose-700 ring-1 ring-rose-200">
                                  <Tag size={9} /> {epc}
                                  <button onClick={() => removerEpc(l.sku, epc)} className="text-rose-300 hover:text-rose-600">
                                    <X size={9} weight="bold" />
                                  </button>
                                </span>
                              ))}
                              {l.manual > 0 && (
                                <button onClick={() => tirarManual(l.sku)} className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-rose-700 ring-1 ring-rose-200">
                                  {l.manual} digitada(s) · tirar uma
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {naoResolvidos.length > 0 && (
                    <div className="border-t border-gray-200 px-3 py-2 text-[11px] text-gray-500">
                      <b>{naoResolvidos.length}</b> etiqueta(s) que o TOTVS não reconheceu:{' '}
                      <span className="font-mono">
                        {naoResolvidos.slice(0, 6).join(', ')}
                        {naoResolvidos.length > 6 ? '…' : ''}
                      </span>
                    </div>
                  )}
                </section>

                {/* Transporte */}
                <Bloco titulo="Transporte" icone={Truck}>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className={labelCls}>Transportadora</label>
                      <select
                        value={transp.id}
                        onChange={(e) => {
                          const t = prep.transportadoras.find((x) => x.id === e.target.value);
                          setTransp((s) => ({
                            ...s,
                            id: t.id,
                            code: t.code,
                            nome: t.code ? t.label : null,
                            volumes: t.id === 'RETIRADA' ? 0 : s.volumes || 1,
                            frete: t.id === 'RETIRADA' ? 0 : s.frete,
                            servico: t.id === 'CORREIOS' ? s.servico : '',
                          }));
                        }}
                        className={inputCls}
                      >
                        {prep.transportadoras.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                            {t.code ? ` (${t.code})` : ''}
                          </option>
                        ))}
                      </select>
                      {transp.id === 'TAXISTA' &&
                        (transp.code ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-[#000638]">
                            <b>{transp.code}</b> — {transp.nome}
                            <button onClick={() => setTransp((s) => ({ ...s, code: null, nome: null }))} className="text-gray-400 hover:text-rose-600">
                              <X size={11} weight="bold" />
                            </button>
                          </p>
                        ) : (
                          <BuscaPessoa onEscolher={(p) => setTransp((s) => ({ ...s, code: p.code, nome: p.nome }))} />
                        ))}
                    </div>
                    {transp.id !== 'RETIRADA' && (
                      <>
                        <div>
                          <label className={labelCls}>Valor do frete (R$)</label>
                          <input type="number" min="0" step="0.01" value={transp.frete} onChange={(e) => setTransp((s) => ({ ...s, frete: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Quem paga o frete</label>
                          <select value={transp.modFrete} onChange={(e) => setTransp((s) => ({ ...s, modFrete: Number(e.target.value) }))} className={inputCls}>
                            <option value={1}>Cliente (destinatário · FOB)</option>
                            <option value={0}>Crosby (remetente · CIF)</option>
                          </select>
                        </div>
                        {transp.id === 'CORREIOS' && (
                          <div>
                            <label className={labelCls}>Serviço</label>
                            <select value={transp.servico} onChange={(e) => setTransp((s) => ({ ...s, servico: e.target.value }))} className={inputCls}>
                              <option value="">—</option>
                              <option value="PAC">PAC</option>
                              <option value="SEDEX">SEDEX</option>
                            </select>
                          </div>
                        )}
                        <div>
                          <label className={labelCls}>Volumes</label>
                          <input type="number" min="1" step="1" value={transp.volumes} onChange={(e) => setTransp((s) => ({ ...s, volumes: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>
                            <Scales size={11} className="mr-0.5 inline" /> Peso bruto (kg)
                          </label>
                          <input type="number" min="0" step="0.001" value={transp.pesoB} onChange={(e) => setTransp((s) => ({ ...s, pesoB: e.target.value }))} className={inputCls} />
                        </div>
                      </>
                    )}
                  </div>
                  {transp.id === 'RETIRADA' && <p className="mt-1 text-[11px] text-gray-500">Sem transportadora: a NF-e sai com "sem frete" (modFrete 9).</p>}
                </Bloco>

                {/* Pagamento */}
                <Bloco
                  titulo="Pagamento"
                  icone={CreditCard}
                  extra={
                    <button
                      onClick={() => setPagamentos((ps) => [...ps, { forma: 'pix', valor: 0, parcelas: 1, nsu: '', autorizacao: '', bandeira: '', auto: ps.length === 0 }])}
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      <Plus size={11} weight="bold" /> forma
                    </button>
                  }
                >
                  {prep.pagamento.formaTexto && (
                    <p className="mb-2 text-[11px] text-gray-500">
                      No pedido: <b>{prep.pagamento.formaTexto}</b>
                      {prep.pagamento.pix ? ` · Pix ${prep.pagamento.pix}` : ''}
                      {prep.pagamento.credev ? ` · Credev ${prep.pagamento.credev}` : ''}
                    </p>
                  )}
                  <div className="mb-2 rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900 ring-1 ring-blue-200">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1 font-bold">
                        <Wallet size={13} weight="bold" /> Saldos do cliente no TOTVS (empresa {EMPRESA})
                      </span>
                      {!customer ? (
                        <span className="text-blue-700">escolha o cliente</span>
                      ) : !saldos ? (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <Spinner size={11} className="animate-spin" /> consultando…
                        </span>
                      ) : saldos.erro ? (
                        <span className="text-rose-700">não consegui consultar: {saldos.erro}</span>
                      ) : (
                        Object.keys(CAMPO_SALDO).map((forma) => {
                          const si = saldoInfo(forma);
                          const livre = round2((si?.total || 0) - usoSaldo(forma));
                          const falta = round2(totalNota - round2(pagamentos.filter((x) => !x.auto).reduce((t, x) => t + Number(x.valor || 0), 0)));
                          return (
                            <span key={forma} className="inline-flex items-center gap-1">
                              {FORMAS[forma]}: <b className="tabular-nums">{fmtBRL(si?.total || 0)}</b>
                              {livre > 0.005 && falta > 0.005 && (
                                <button
                                  onClick={() =>
                                    setPagamentos((ps) => [...ps, { forma, valor: round2(Math.min(livre, falta)), parcelas: 1, nsu: '', autorizacao: '', bandeira: '', auto: ps.length === 0 }])
                                  }
                                  className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700"
                                >
                                  usar
                                </button>
                              )}
                            </span>
                          );
                        })
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {pagamentos.map((p, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div>
                            <label className={labelCls}>Forma</label>
                            <select value={p.forma} onChange={(e) => setPag(i, { forma: e.target.value, parcelas: 1 })} className={inputCls}>
                              {Object.entries(FORMAS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Valor {p.auto && <span className="normal-case text-gray-400">(automático)</span>}</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.valor}
                              readOnly={p.auto}
                              onChange={(e) => setPag(i, { valor: e.target.value })}
                              className={`${inputCls} ${p.auto ? 'bg-gray-100' : ''}`}
                            />
                          </div>
                          {CAMPO_SALDO[p.forma] &&
                            (() => {
                              const si = saldoInfo(p.forma);
                              const passou = si && usoSaldo(p.forma) > si.total + 0.005;
                              return (
                                <div className="flex flex-col justify-end text-[11px] sm:col-span-2">
                                  <span className={passou ? 'font-semibold text-rose-600' : 'text-gray-600'}>
                                    Saldo de {FORMAS[p.forma]} na empresa {EMPRESA}: <b className="tabular-nums">{si ? fmtBRL(si.total) : '…'}</b>
                                    {passou ? ' — o valor usado passa do saldo.' : ' — o valor usado é consumido do saldo do cliente.'}
                                  </span>
                                </div>
                              );
                            })()}
                          {p.forma === 'boleto' && (
                            <div>
                              <label className={labelCls}>Parcelas</label>
                              <input type="number" min="1" max="24" value={p.parcelas} onChange={(e) => setPag(i, { parcelas: Math.max(1, parseInt(e.target.value, 10) || 1) })} className={inputCls} />
                            </div>
                          )}
                          {(p.forma === 'credito' || p.forma === 'debito') &&
                            (() => {
                              const c = cartaoDe(p);
                              if (!cartoes) return <div className="flex items-end text-[11px] text-gray-400">carregando cartões do TOTVS…</div>;
                              return (
                                <>
                                  <div>
                                    <label className={labelCls}>Operadora *</label>
                                    <select
                                      value={c?.grupo?.chave || ''}
                                      onChange={(e) => setPag(i, { cartaoChave: e.target.value, cartaoSeq: null })}
                                      className={`${inputCls} ${c?.grupo ? '' : 'border-amber-400'}`}
                                    >
                                      <option value="">Selecione…</option>
                                      {(c?.grupos || []).map((g) => (
                                        <option key={g.chave} value={g.chave}>
                                          {g.operadora} · {g.bandeira} ({g.portador})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className={labelCls}>Parcelamento *</label>
                                    <select
                                      value={c?.opcao?.seq ?? ''}
                                      onChange={(e) => {
                                        const o = c?.grupo?.opcoes.find((x) => String(x.seq) === e.target.value);
                                        if (o) setPag(i, { cartaoChave: c.grupo.chave, cartaoSeq: o.seq, parcelas: o.parcelas });
                                      }}
                                      className={`${inputCls} ${c?.opcao ? '' : 'border-amber-400'}`}
                                    >
                                      <option value="">Selecione…</option>
                                      {(c?.grupo?.opcoes || []).map((o) => (
                                        <option key={o.seq} value={o.seq}>
                                          {o.descricao}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              );
                            })()}
                          {(p.forma === 'credito' || p.forma === 'debito') && (
                            <>
                              <div>
                                <label className={labelCls}>Nr. documento (NSU) *</label>
                                <input value={p.nsu} onChange={(e) => setPag(i, { nsu: e.target.value })} className={inputCls} />
                              </div>
                              <div>
                                <label className={labelCls}>Autorização *</label>
                                <input value={p.autorizacao} onChange={(e) => setPag(i, { autorizacao: e.target.value })} className={inputCls} />
                              </div>
                            </>
                          )}
                          {pagamentos.length > 1 && (
                            <div className="flex items-end">
                              <button
                                onClick={() =>
                                  setPagamentos((ps) => {
                                    const n = ps.filter((_, k) => k !== i);
                                    if (n.length && !n.some((x) => x.auto)) n[0] = { ...n[0], auto: true };
                                    return n;
                                  })
                                }
                                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                              >
                                <Trash size={13} /> tirar
                              </button>
                            </div>
                          )}
                        </div>
                        {p.forma === 'boleto' && (
                          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                            {parcelasBoleto.map((v, k) => (
                              <div key={k} className="flex items-center gap-1.5 text-xs">
                                <span className="w-8 shrink-0 font-semibold text-gray-500">{k + 1}ª</span>
                                <input
                                  type="date"
                                  value={vencimentos[k] || ''}
                                  onChange={(e) =>
                                    setVencimentos((vs) => {
                                      const n = [...vs];
                                      n[k] = e.target.value;
                                      return n;
                                    })
                                  }
                                  className={`${inputCls} ${vencimentos[k] ? '' : 'border-amber-400'}`}
                                />
                                <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{fmtBRL(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {prep.comprovantes.length > 0 && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <b className="text-gray-500">Comprovantes do Dryland:</b>
                      {prep.comprovantes.map((c, i) => (
                        <a key={c.path} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline">
                          comprovante {i + 1} <ArrowSquareOut size={10} />
                        </a>
                      ))}
                    </p>
                  )}
                </Bloco>
              </div>

              {/* ── Coluna direita ── */}
              <div className="space-y-2 lg:sticky lg:top-2">
                <Bloco titulo="Portal RFID" icone={Broadcast}>
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className={`h-2.5 w-2.5 rounded-full ${portalStatus.status === 'lendo' ? 'animate-pulse bg-emerald-500' : portalLigado ? 'bg-amber-400' : 'bg-gray-300'}`} />
                    <span className="font-medium text-gray-700">{portalStatus.status || 'desconectado'}</span>
                    {portalStatus.erro && (
                      <span className="truncate text-rose-600" title={portalStatus.erro}>
                        {portalStatus.erro}
                      </span>
                    )}
                  </div>
                  {portalLigado ? (
                    <button onClick={desligarPortal} disabled={portalBusy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                      {portalBusy ? <Spinner size={16} className="animate-spin" /> : <Plugs size={16} weight="bold" />} DESLIGAR PORTAL
                    </button>
                  ) : (
                    <button onClick={ligarPortal} disabled={portalBusy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {portalBusy ? <Spinner size={16} className="animate-spin" /> : <PlugsConnected size={16} weight="bold" />} LIGAR PORTAL
                    </button>
                  )}
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPotenciaOpen(true)}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                      title="Alcance de leitura das antenas"
                    >
                      <WifiHigh size={13} weight="bold" /> Potência
                    </button>
                    <button onClick={limparLeituras} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50">
                      <Trash size={13} /> Limpar leituras
                    </button>
                  </div>
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Peça sem etiqueta (código / barras)</label>
                    <div className="flex gap-1">
                      <input
                        value={codigoManual}
                        onChange={(e) => setCodigoManual(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && adicionarManual()}
                        placeholder="SKU ou código de barras"
                        className="mb-0 h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-2 text-sm"
                      />
                      <button onClick={adicionarManual} disabled={manualBusy || !codigoManual.trim()} className="h-9 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40">
                        {manualBusy ? <Spinner size={13} className="animate-spin" /> : '+1'}
                      </button>
                    </div>
                  </div>
                </Bloco>

                <Bloco titulo="Descontos do pedido" icone={Tag}>
                  {brejinho && (
                    <div className="mb-2 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                      <label className={labelCls}>Desconto neste faturamento (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="0.5"
                          value={descPct}
                          onChange={(e) => setDescPct(e.target.value)}
                          placeholder="0"
                          className={`${inputCls} w-24 ${descPrecisaSenha ? 'border-amber-500' : ''}`}
                        />
                        <span className="text-xs tabular-nums text-amber-800">{pctDesc > 0 ? `− ${fmtBRL(conf.descExtraConferido)} nas peças conferidas` : 'sem desconto extra'}</span>
                      </div>
                      {descPrecisaSenha ? (
                        <button
                          onClick={() => setSenhaDescOpen(true)}
                          className="mt-1.5 inline-flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-2.5 text-[11px] font-bold text-white hover:bg-amber-600"
                        >
                          <LockKey size={12} weight="fill" /> Liberar com senha (owner, admin ou financeiro)
                        </button>
                      ) : pctDesc > LIMITE_DESCONTO_LIVRE ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                          <LockKey size={11} weight="fill" /> {descLiberado && Number(descLiberado.pct) >= pctDesc ? `Liberado por ${descLiberado.nome}` : 'Seu perfil libera acima do limite'}
                        </p>
                      ) : (
                        <p className="mt-1 text-[10.5px] text-amber-800">Até {LIMITE_DESCONTO_LIVRE}% é livre; acima disso pede a senha de owner, admin ou financeiro. Entra no valor de cada peça da NF-e.</p>
                      )}
                    </div>
                  )}
                  {descontos.length === 0 ? (
                    <p className="text-xs text-gray-500">Sem desconto — peças no preço do Detalhar.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {descontos.map((d) => (
                        <li key={d.tipo + d.pct} className="rounded-lg bg-gray-50 px-2 py-1.5 ring-1 ring-gray-200">
                          <p className="font-semibold text-[#000638]">
                            {d.tipo}
                            {d.pct != null ? ` · ${d.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : ''}
                            {d.valor ? ` · ${fmtBRL(d.valor)}` : ''}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {d.pecas === d.total ? `em todas as ${d.total} peças` : d.pecas === 1 ? `em 1 peça de ${d.total}` : `em ${d.pecas} de ${d.total} peças`}
                            {d.tipo.startsWith('Desconto') ? ' — rateado no valor de cada peça da NF-e' : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Bloco>

                <Bloco titulo={`TOTVS (documento interno · empresa ${EMPRESA_TOTVS})`} icone={Storefront}>
                  <label className={labelCls}>Operação</label>
                  <select value={operacao} onChange={(e) => setOperacao(e.target.value)} className={inputCls}>
                    <option value="">Selecione…</option>
                    {OPERACOES_DOC_INTERNO.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 grid grid-cols-[1fr_5rem] gap-2">
                    <div>
                      <label className={labelCls}>
                        <CalendarBlank size={11} className="mr-0.5 inline" /> Data da transação
                      </label>
                      <div className="flex h-9 items-center rounded-lg bg-gray-50 px-2.5 text-sm font-semibold text-[#000638] ring-1 ring-gray-200">Hoje · {fmtData(hojeIso())}</div>
                    </div>
                    <div>
                      <label className={labelCls}>Terminal</label>
                      <input type="number" min="1" value={terminal} onChange={(e) => setTerminal(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDataDiferente((v) => !v)}
                    className={`mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold ring-1 transition ${
                      dataDiferente ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white text-amber-700 ring-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <CalendarBlank size={13} weight="bold" /> TRANSAÇÃO COM DATA DIFERENTE
                  </button>
                  {dataDiferente && (
                    <div className="mt-1.5 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                      <label className={labelCls}>Data da venda</label>
                      <input type="date" value={dataVenda} max={hojeIso()} onChange={(e) => setDataVenda(e.target.value)} className={`${inputCls} ${dataVenda ? '' : 'border-amber-400'}`} />
                      <p className="mt-1 text-[10.5px] text-amber-800">
                        A transação continua com a data de hoje. No TOTVS ela leva a observação{' '}
                        <b>VENDA DO DIA {dataVenda ? fmtData(dataVenda) : 'dd/mm/aaaa'}</b>.
                      </p>
                    </div>
                  )}
                  <label className={`${labelCls} mt-2`}>Recebimento no TOTVS</label>
                  <select value={comoFatura ? 'fatura' : 'forma'} onChange={(e) => setComoFatura(e.target.value === 'fatura')} className={inputCls}>
                    <option value="forma">Pela forma de pagamento (cartão, Pix…)</option>
                    <option value="fatura">Tudo como FATURA (título a receber)</option>
                  </select>
                  <p className="mt-1 flex items-start gap-1 text-[10.5px] text-gray-500">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {comoFatura
                      ? 'Cada pagamento vira fatura no contas a receber (cartão em N vezes = N faturas a cada 30 dias), sem movimento de caixa.'
                      : `O caixa desse terminal da empresa ${EMPRESA_TOTVS} precisa estar aberto no TOTVS com a data de hoje. O contas a receber sai com as parcelas e vencimentos acima.`}
                  </p>
                </Bloco>

                <section className="space-y-1 rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Peças do pedido</span>
                    <span className="tabular-nums">{conf.esperado}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Conferidas (vão na nota)</span>
                    <span className="font-semibold tabular-nums">{conf.conferidas}</span>
                  </div>
                  {conf.faltando > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Faltando (ficam fora)</span>
                      <span className="tabular-nums">{conf.faltando}</span>
                    </div>
                  )}
                  {conf.sobrando > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Sobrando (ficam fora)</span>
                      <span className="tabular-nums">{conf.sobrando}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Produtos</span>
                    <span className="tabular-nums">{fmtBRL(conf.brutoConferido)}</span>
                  </div>
                  {conf.descConferido > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Desconto (vai na NF-e)</span>
                      <span className="tabular-nums">− {fmtBRL(conf.descConferido)}</span>
                    </div>
                  )}
                  {pctDesc > 0 && (
                    <div className="flex justify-between text-[11px] text-amber-700">
                      <span>↳ {pctDesc.toLocaleString('pt-BR')}% dado neste faturamento</span>
                      <span className="tabular-nums">{fmtBRL(conf.descExtraConferido)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Frete</span>
                    <span className="tabular-nums">{fmtBRL(frete)}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-gray-100 pt-1">
                    <span className="font-semibold text-[#000638]">Total da NF-e</span>
                    <span className="text-xl font-bold tabular-nums text-[#000638]">{fmtBRL(totalNota)}</span>
                  </div>
                  {Number(card?.dados?.valor_pedido) > 0 && (
                    <div className={`flex justify-between ${conf.ok && Math.abs(Number(card.dados.valor_pedido) - totalNota) > 0.01 ? 'font-semibold text-rose-600' : 'text-gray-500'}`}>
                      <span>Pago no pedido{conf.ok && Math.abs(Number(card.dados.valor_pedido) - totalNota) > 0.01 ? ' — não bate!' : ''}</span>
                      <span className="tabular-nums">{fmtBRL(card.dados.valor_pedido)}</span>
                    </div>
                  )}

                  {resultado ? (
                    <div className="mt-2 space-y-2">
                      <div className={`rounded-lg p-2 ring-1 ${resultado.fiscal?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
                        <p className={`inline-flex items-center gap-1 font-bold ${resultado.fiscal?.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                          {resultado.fiscal?.ok ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} weight="fill" />}
                          {resultado.fiscal?.ok ? `NF-e ${notaRes?.numero}/${notaRes?.serie} autorizada` : 'NF-e não autorizada'}
                        </p>
                        {!resultado.fiscal?.ok && <p className="text-[11px] text-rose-700">{resultado.fiscal?.mensagem}</p>}
                        {notaRes?.chave && <p className="mt-0.5 break-all font-mono text-[10px] text-gray-500">{notaRes.chave}</p>}
                        {resultado.fiscal?.ok && notaRes?.id && (
                          <div className="mt-1.5 flex gap-1.5">
                            <button onClick={() => imprimirDanfe(notaRes.id).catch((e) => showToast('erro', e.message))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white">
                              <Printer size={13} /> DANFE
                            </button>
                            <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${notaRes.id}/xml`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[#000638] ring-1 ring-gray-300">
                              <DownloadSimple size={13} /> XML
                            </a>
                          </div>
                        )}
                      </div>
                      <div className={`rounded-lg p-2 ring-1 ${resultado.totvs?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
                        <p className={`inline-flex items-center gap-1 font-bold ${resultado.totvs?.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                          {resultado.totvs?.ok ? <CheckCircle size={14} weight="fill" /> : <Warning size={14} weight="fill" />}
                          {resultado.totvs?.ok ? `TOTVS: documento interno ${resultado.totvs.transactionCode}` : 'TOTVS ainda não recebeu'}
                        </p>
                        <p className="text-[11px] text-gray-700">
                          {resultado.totvs?.ok ? `${TOTVS_STATUS[resultado.totvs.status]?.label || ''} · ${fmtData(resultado.totvs.transactionDate)}` : resultado.totvs?.mensagem}
                        </p>
                      </div>
                      {!(resultado.fiscal?.ok && resultado.totvs?.ok) && (
                        <button onClick={reprocessar} disabled={posting} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white disabled:opacity-50">
                          {posting ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Tentar de novo
                        </button>
                      )}
                      <button onClick={() => escolherPedido('')} className="h-9 w-full rounded-lg bg-[#000638] text-xs font-bold text-white hover:bg-[#000638]/90">
                        Faturar outro pedido
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setModalFat(true)}
                        disabled={!podeFaturar}
                        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {posting ? <Spinner size={16} className="animate-spin" /> : <Receipt size={16} weight="bold" />}
                        {posting ? 'FATURANDO…' : `FATURAR (${conf.conferidas} pç)`}
                      </button>
                      {posting && <p className="text-[10.5px] text-gray-500">Emitindo a NF-e na SEFAZ e gravando no TOTVS — pode levar até 1 minuto.</p>}
                      {!posting && pendencias.length > 0 && (
                        <ul className="list-disc space-y-0.5 pl-4 text-[10.5px] text-amber-700">
                          {pendencias.slice(0, 4).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}
                      {conf.conferidas > 0 && !conf.ok && <p className="text-[10px] text-gray-500">Só as peças conferidas entram na nota; o que falta ou sobra fica registrado.</p>}
                    </>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {modalFat && pedido && prep && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#000638]/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => !posting && setModalFat(false)}>
          <div className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#000638] to-[#1b2a6b] px-5 py-4 text-white">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
                <Receipt size={20} weight="bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">{resultado ? 'Faturamento' : posting ? 'Faturando…' : 'Confirmar faturamento'}</p>
                <p className="truncate text-xs text-white/70">
                  Pedido {ref || '—'} · {customer?.name}
                </p>
              </div>
              {Number(prep.numeracao?.ambiente) === 1 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">produção</span>}
              {!posting && (
                <button onClick={() => setModalFat(false)} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white">
                  <X size={18} weight="bold" />
                </button>
              )}
            </div>

            {resultado ? (
              <div className="space-y-3 p-5">
                <div className={`rounded-xl p-3 ring-1 ${resultado.fiscal?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
                  <p className={`flex items-center gap-1.5 text-sm font-bold ${resultado.fiscal?.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                    {resultado.fiscal?.ok ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
                    {resultado.fiscal?.ok ? 'NF-e autorizada' : 'NF-e não autorizada'}
                  </p>
                  {resultado.fiscal?.ok ? (
                    <>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-800">
                        Nº {notaRes?.numero}
                        <span className="text-sm font-semibold text-emerald-700"> · série {notaRes?.serie}</span>
                      </p>
                      {notaRes?.chave && <p className="mt-0.5 break-all font-mono text-[10.5px] text-gray-500">{notaRes.chave}</p>}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-rose-700">{resultado.fiscal?.mensagem}</p>
                  )}
                </div>
                <div className={`rounded-xl p-3 ring-1 ${resultado.totvs?.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
                  <p className={`flex items-center gap-1.5 text-sm font-bold ${resultado.totvs?.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {resultado.totvs?.ok ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
                    {resultado.totvs?.ok ? 'Transação no TOTVS (documento interno)' : 'TOTVS ainda não recebeu'}
                  </p>
                  {resultado.totvs?.ok ? (
                    <>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-800">
                        Nº {resultado.totvs.transactionCode}
                        <span className="text-sm font-semibold text-emerald-700"> · {fmtData(resultado.totvs.transactionDate)}</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Operação {operacao} · empresa {resultado.venda?.pedido_info?.empresaTotvs || EMPRESA} · {TOTVS_STATUS[resultado.totvs.status]?.label || ''}
                      </p>
                    </>
                  ) : (
                    <>
                      {resultado.venda?.totvs_transacao_code && (
                        <p className="mt-1 text-sm font-bold tabular-nums text-amber-800">Transação {resultado.venda.totvs_transacao_code} aberta, sem recebimento</p>
                      )}
                      <p className="mt-1 text-xs text-amber-800">{resultado.totvs?.mensagem}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {resultado.fiscal?.ok && notaRes?.id && (
                    <>
                      <button onClick={() => imprimirDanfe(notaRes.id).catch((e) => showToast('erro', e.message))} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#000638] px-3 text-sm font-bold text-white">
                        <Printer size={15} /> DANFE
                      </button>
                      <a href={`${API_BASE_URL}/api/pdv-crosby/notas/${notaRes.id}/xml`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#000638] ring-1 ring-gray-300">
                        <DownloadSimple size={15} /> XML
                      </a>
                    </>
                  )}
                  {!(resultado.fiscal?.ok && resultado.totvs?.ok) && (
                    <button onClick={reprocessar} disabled={posting} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 text-sm font-bold text-white disabled:opacity-50">
                      {posting ? <Spinner size={15} className="animate-spin" /> : <ArrowsClockwise size={15} />} Tentar de novo
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setModalFat(false);
                    escolherPedido('');
                  }}
                  className="h-10 w-full rounded-xl text-sm font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50"
                >
                  Faturar outro pedido
                </button>
              </div>
            ) : posting ? (
              <div className="p-8 text-center">
                <Spinner size={34} className="mx-auto animate-spin text-[#000638]" />
                <p className="mt-3 text-sm font-semibold text-[#000638]">Emitindo a NF-e na SEFAZ e gravando no TOTVS…</p>
                <p className="mt-1 text-xs text-gray-500">Pode levar até 1 minuto. Não feche esta janela.</p>
              </div>
            ) : (
              <div className="p-5">
                <dl className="divide-y divide-gray-100 text-sm">
                  {[
                    ['NF-e', `série ${prep.numeracao?.serie ?? 3} · próximo nº ${prep.numeracao?.proximo ?? '—'} (conferido com o TOTVS na hora)`],
                    ['Empresa', `${EMPRESA} · ${prep.emitente?.nome || ''}`],
                    ['Cliente', `${customer?.code} — ${customer?.name}`],
                    ['Fiscal', cen ? `${cen.label} · CFOP ${cen.cfop} · ${cen.icms}${previa?.aliqDifal ? ` (${previa.cenario.destUf} ${previa.aliqDifal}%)` : ''}` : '—'],
                    ['Transporte', temTransportadora ? `${transp.nome || transp.id}${transp.servico ? ` · ${transp.servico}` : ''} · ${transp.volumes} vol · ${transp.pesoB} kg` : 'Retirada (sem transportadora)'],
                    ['Pagamento', pagamentos.map((p) => `${FORMAS[p.forma]} ${fmtBRL(p.valor)}${Number(p.parcelas) > 1 ? ` em ${p.parcelas}x` : ''}`).join(' + ')],
                    ['TOTVS', `documento interno ${operacao} · empresa ${EMPRESA_TOTVS} · data de hoje (${fmtData(hojeIso())}) · terminal ${terminal}`],
                    ...(dataDiferente && dataVenda ? [['Data diferente', `observação na transação: VENDA DO DIA ${fmtData(dataVenda)}`]] : []),
                    ...(card?.dados?.transacao || card?.dados?.pedido_totvs
                      ? [['Transação no TOTVS (aberta pelo Dryland)', [card.dados.transacao && `transação ${card.dados.transacao}`, card.dados.pedido_totvs && `pedido ${card.dados.pedido_totvs}`].filter(Boolean).join(' · ')]]
                      : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1.5">
                      <dt className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">{k}</dt>
                      <dd className="min-w-0 flex-1 text-[13px] text-gray-800">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{conf.conferidas} peça(s)</span>
                    <span className="tabular-nums">{fmtBRL(conf.brutoConferido)}</span>
                  </div>
                  {conf.descConferido > 0 && (
                    <div className="flex justify-between text-xs text-amber-700">
                      <span>Desconto</span>
                      <span className="tabular-nums">− {fmtBRL(conf.descConferido)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Frete</span>
                    <span className="tabular-nums">{fmtBRL(frete)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between border-t border-gray-200 pt-1">
                    <span className="text-sm font-bold text-[#000638]">Total da NF-e</span>
                    <span className="text-2xl font-extrabold tabular-nums text-[#000638]">{fmtBRL(totalNota)}</span>
                  </div>
                </div>
                {(conf.faltando > 0 || conf.sobrando > 0) && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Ficam fora da nota: {conf.faltando} faltando · {conf.sobrando} sobrando.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-gray-500">A nota é real (SEFAZ, produção). Depois dela, o TOTVS recebe o documento interno e o contas a receber na empresa {EMPRESA_TOTVS}.</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setModalFat(false)} className="h-11 flex-1 rounded-xl text-sm font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button onClick={faturar} disabled={!podeFaturar} className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    <Receipt size={16} weight="bold" /> Emitir NF-e e gravar no TOTVS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {senhaDescOpen && (
        <SenhaDescontoModal
          pct={pctDesc}
          pedido={ref}
          por={user?.name || user?.email || null}
          onCancelar={() => setSenhaDescOpen(false)}
          onLiberado={(a) => {
            setDescLiberado(a);
            setSenhaDescOpen(false);
            showToast('ok', `Desconto de ${pctDesc.toLocaleString('pt-BR')}% liberado por ${a.nome}`);
          }}
        />
      )}
      {potenciaOpen && (
        <PortalPotenciaModal onClose={() => setPotenciaOpen(false)} onSaved={() => showToast('ok', 'Potência do portal gravada')} />
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-[60] inline-flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-lg ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle size={16} weight="fill" /> : <Warning size={16} weight="fill" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default FaturamentoPedido;
