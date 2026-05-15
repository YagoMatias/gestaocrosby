import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import {
  Storefront,
  Package,
  TShirt,
  Buildings,
  Tag,
  Presentation,
  Star,
  Briefcase,
  ChartBar,
  ChartPieSlice,
  CurrencyDollar,
  CreditCard,
  MagnifyingGlass,
  Spinner,
  ArrowsClockwise,
  CalendarBlank,
  Export,
  X,
  ArrowUp,
  ArrowDown,
  Minus,
  Receipt,
} from 'phosphor-react';
import { Pencil, Target } from 'phosphor-react';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/cards';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import PromessaSemanal from '../components/forecast/PromessaSemanal';
import PromessaMensal from '../components/forecast/PromessaMensal';
import PromessaVendedores from '../components/forecast/PromessaVendedores';
import ComparativoAnual from '../components/forecast/ComparativoAnual';
import PlanejamentoMensalModal from '../components/forecast/PlanejamentoMensalModal';
import HistoricoMetasModal from '../components/forecast/HistoricoMetasModal';

const API_KEY = import.meta.env.VITE_API_KEY || '';

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Helpers de período (mensal / semanal ISO Mon-Sun) ───────────────────
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentMonthRange() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    datemin: first.toISOString().split('T')[0],
    datemax: d.toISOString().split('T')[0],
  };
}
// Pega ISO week (semana 1 = semana que contém a 1ª quinta do ano) de uma data
function isoWeekKeyOf(date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = target.getUTCDay() || 7; // dom=7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum); // quinta da semana ISO
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// "Semana de referência" = ÚLTIMA SEMANA COMPLETA (segunda passada → domingo passado)
// Ex: hoje (seg 11/05) → semana 04/05 a 10/05 (W19)
// Ex: hoje (qua 13/05) → semana 04/05 a 10/05 (mesma — ainda não completou a corrente)
// Ex: hoje (dom 17/05) → semana 04/05 a 10/05 (W20 só completa no próximo dia)
function currentWeekKey() {
  return isoWeekKeyOf(lastCompletedSunday());
}
function currentWeekRange() {
  const sun = lastCompletedSunday();
  const mon = new Date(sun);
  mon.setDate(sun.getDate() - 6);
  return {
    datemin: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate())
      .toISOString()
      .split('T')[0],
    datemax: new Date(sun.getFullYear(), sun.getMonth(), sun.getDate())
      .toISOString()
      .split('T')[0],
  };
}
// Helper: último domingo completo (ontem se hoje é seg, etc).
// Se hoje é domingo, ainda é a semana CORRENTE → última completa = domingo anterior.
function lastCompletedSunday() {
  const today = new Date();
  const dow = today.getDay(); // 0=dom, 1=seg, ..., 6=sáb
  const daysSinceLastSunday = dow === 0 ? 7 : dow;
  const sun = new Date(today);
  sun.setDate(today.getDate() - daysSinceLastSunday);
  return sun;
}

// Parse "YYYY-Www" → { datemin, datemax } (segunda-domingo da ISO week)
function weekKeyRange(weekKey) {
  const m = String(weekKey).match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return null;
  const ano = Number(m[1]);
  const week = Number(m[2]);
  // ISO week 1 = semana que contém a primeira quinta-feira do ano
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { datemin: fmt(monday), datemax: fmt(sunday) };
}

// Gera opções de semanas: N anteriores + atual (completa) + próxima
function weekOptions({ before = 6, after = 1 } = {}) {
  const out = [];
  const cur = lastCompletedSunday();
  for (let i = before; i >= -after; i--) {
    const d = new Date(cur);
    d.setDate(cur.getDate() - i * 7);
    const key = isoWeekKeyOf(d);
    const r = weekKeyRange(key);
    if (!r) continue;
    const fmtBr = (s) => {
      const [, m, dd] = s.split('-');
      return `${dd}/${m}`;
    };
    out.push({
      key,
      label: `${key}  (${fmtBr(r.datemin)}–${fmtBr(r.datemax)})`,
    });
  }
  // remove duplicatas (caso a iteração coincida)
  const seen = new Set();
  return out.filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true)));
}

// Gera opções de meses
function monthOptions({ before = 11, after = 1 } = {}) {
  const out = [];
  const now = new Date();
  for (let i = before; i >= -after; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: key });
  }
  return out;
}

function formatBRLCompact(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatBRL(n);
}

async function apiPost(endpoint, body) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

const CANAL_CONFIG = {
  varejo: {
    label: 'Varejo',
    icon: Storefront,
    color: '#3b82f6',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    bar: 'bg-blue-500',
  },
  revenda: {
    label: 'Revenda',
    icon: Package,
    color: '#10b981',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  multimarcas: {
    label: 'Multimarcas',
    icon: TShirt,
    color: '#8b5cf6',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    bar: 'bg-violet-500',
  },
  franquia: {
    label: 'Franquia',
    icon: Buildings,
    color: '#f59e0b',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    bar: 'bg-amber-500',
  },
  bazar: {
    label: 'Bazar',
    icon: Tag,
    color: '#ef4444',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    bar: 'bg-red-500',
  },
  showroom: {
    label: 'Showroom',
    icon: Presentation,
    color: '#0ea5e9',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    bar: 'bg-sky-500',
  },
  novidadesfranquia: {
    label: 'Novidades Franquia',
    icon: Star,
    color: '#d97706',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    bar: 'bg-yellow-500',
  },
  business: {
    label: 'Business',
    icon: Briefcase,
    color: '#64748b',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    bar: 'bg-slate-500',
  },
  inbound: {
    label: 'B2M Inbound',
    icon: TShirt,
    color: '#7c3aed',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    bar: 'bg-purple-500',
  },
  inbound_david: {
    label: 'MTM Inbound David',
    icon: TShirt,
    color: '#7c3aed',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    bar: 'bg-purple-500',
  },
  inbound_rafael: {
    label: 'MTM Inbound Rafael',
    icon: TShirt,
    color: '#a21caf',
    bg: 'bg-fuchsia-50',
    border: 'border-fuchsia-200',
    text: 'text-fuchsia-700',
    bar: 'bg-fuchsia-500',
  },
  ricardoeletro: {
    label: 'Ricardo Eletro',
    icon: Storefront,
    color: '#dc2626',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    bar: 'bg-red-500',
  },
  // Canal virtual usado APENAS na seção Faturamento × Meta — soma
  // (showroom + novidadesfranquia). Mantém metas salvas com canal='fabrica'.
  fabrica: {
    label: 'Fábrica (Kleiton)',
    icon: Buildings,
    color: '#0891b2',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    bar: 'bg-cyan-500',
  },
};

// Canais que somam para formar "fabrica" (usados apenas na seção Faturamento × Meta)
const FABRICA_SOURCES = ['showroom', 'novidadesfranquia'];

const CANAL_ORDER = [
  'varejo',
  'revenda',
  'multimarcas',
  'inbound_david',
  'inbound_rafael',
  'franquia',
  'bazar',
  'showroom',
  'novidadesfranquia',
  'business',
  'ricardoeletro',
];

// Op codes de devolucao / credev
const CREDEV_OP_CODES = new Set([
  1, 2, 555, 9073, 9402, 9065, 9403, 9062, 9005, 7790, 7245, 20, 1214, 7244,
]);
const isCredev = (t) =>
  t.is_credev === true ||
  CREDEV_OP_CODES.has(t.operation_code) ||
  /credev|devolu/i.test(t.operation_name || '');

// Modal de transacoes por canal
function ModalTransacoes({
  canal,
  datemin,
  datemax,
  onClose,
  custoAds,
  custoWpp,
}) {
  const cfg = CANAL_CONFIG[canal] || {
    label: canal,
    icon: ChartBar,
    color: '#64748b',
    text: 'text-gray-700',
    bar: 'bg-gray-400',
  };
  const Icon = cfg.icon;
  const [dados, setDados] = useState(null);
  const [loadingTx, setLoadingTx] = useState(true);
  const [busca, setBusca] = useState('');
  const [sortField, setSortField] = useState('issue_date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    const API_KEY = import.meta.env.VITE_API_KEY || '';
    setLoadingTx(true);
    fetch(API_BASE_URL + '/api/crm/transacoes-canal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ canal, datemin, datemax }),
    })
      .then((r) => r.json())
      .then((j) => setDados(j.data ?? j))
      .catch(() => setDados(null))
      .finally(() => setLoadingTx(false));
  }, [canal, datemin, datemax]);

  // DEBUG: loga o que chegou de custos quando o modal abre
  useEffect(() => {
    console.log('[ModalTransacoes]', {
      canal,
      hasCustoWpp: !!custoWpp,
      custoWpp_by_canal_keys: custoWpp?.by_canal
        ? Object.keys(custoWpp.by_canal)
        : null,
      wpp_canal_val: custoWpp?.by_canal?.[canal.toLowerCase()],
      hasCustoAds: !!custoAds,
      ads_accounts_count: custoAds?.accounts?.length || 0,
      ads_for_canal: custoAds?.accounts?.filter(
        (a) => (a.canal_venda || '').toLowerCase() === canal.toLowerCase(),
      ).length || 0,
    });
  }, [canal, custoWpp, custoAds]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const transacoesFiltradas = useMemo(() => {
    if (!dados?.transacoes) return [];
    let list = dados.transacoes;
    if (busca) {
      const b = busca.toLowerCase();
      list = list.filter(
        (t) =>
          (t.person_name || '').toLowerCase().includes(b) ||
          (t.invoice_code || '').toLowerCase().includes(b) ||
          (t.operation_name || '').toLowerCase().includes(b) ||
          String(t.branch_code).includes(b),
      );
    }
    list = [...list].sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'pt-BR')
        : String(vb).localeCompare(String(va), 'pt-BR');
    });
    return list;
  }, [dados, busca, sortField, sortDir]);

  const exportarCSV = () => {
    if (!transacoesFiltradas.length) return;
    const header = [
      'Data',
      'Filial',
      'NF',
      'Cliente',
      'Cod. Cliente',
      'Operacao',
      'Vendedor',
      'Pagamento',
      'Valor',
    ];
    const rows = transacoesFiltradas.map((t) => [
      t.issue_date,
      t.branch_code,
      t.invoice_code || '-',
      '"' + (t.person_name || '').replace(/"/g, "'") + '"',
      t.person_code,
      '"' + (t.operation_name || '').replace(/"/g, "'") + '"',
      t.vendedor_nome || (t.dealer_code ? String(t.dealer_code) : '') || '',
      '"' +
        (t.payment_method || t.payment_condition || '').replace(/"/g, "'") +
        '"',
      t.total_value.toFixed(2).replace('.', ','),
    ]);
    const csv = [header, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes-' + canal + '-' + datemin + '-' + datemax + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
          style={{ backgroundColor: cfg.color + '18' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: cfg.color + '25' }}
            >
              <Icon size={20} weight="duotone" style={{ color: cfg.color }} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">{cfg.label}</h2>
              <p className="text-xs text-gray-500">
                {datemin} &rarr; {datemax}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {custoAds &&
              (() => {
                // Filtra contas do canal atual pelo campo canal_venda
                const contasDoCanal = Array.isArray(custoAds.accounts)
                  ? custoAds.accounts.filter(
                      (a) =>
                        (a.canal_venda || '').toLowerCase() ===
                        canal.toLowerCase(),
                    )
                  : [];
                const spendCanal =
                  contasDoCanal.length > 0
                    ? contasDoCanal.reduce((s, a) => s + (a.spend || 0), 0)
                    : null;
                return spendCanal !== null ? (
                  <div className="text-right mr-2 border-r border-gray-200 pr-3">
                    <p className="text-xs text-purple-500 font-medium">
                      Tráfego Pago
                    </p>
                    <p className="font-bold text-purple-700 text-sm">
                      R$ {formatBRL(spendCanal)}
                    </p>
                  </div>
                ) : null;
              })()}
            {custoWpp &&
              (() => {
                // Pega o custo do canal específico via by_canal (já agregado
                // por canal_venda no backend); fallback pro total geral se
                // não houver breakdown.
                const byCanal = custoWpp.by_canal || {};
                const canalKey = canal.toLowerCase();
                const wppCanal = byCanal[canalKey];
                const wppBRL = wppCanal
                  ? wppCanal.costBRL ?? wppCanal.cost * 5.8
                  : null;
                return wppBRL !== null ? (
                  <div className="text-right mr-2 border-r border-gray-200 pr-3">
                    <p className="text-xs text-yellow-600 font-medium">
                      WhatsApp API
                    </p>
                    <p className="font-bold text-yellow-700 text-sm">
                      R$ {formatBRL(wppBRL)}
                    </p>
                  </div>
                ) : null;
              })()}
            {dados && (
              <div className="text-right mr-2">
                <p className="text-xs text-gray-500">
                  Total Líquido
                  {dados.credev_total > 0 && (
                    <span className="ml-1 text-orange-500 font-normal">
                      (credev -R$ {formatBRL(dados.credev_total)})
                    </span>
                  )}
                </p>
                <p className="font-bold text-gray-900 text-sm">
                  R$ {formatBRL(dados.total_liquido ?? dados.total)}
                </p>
              </div>
            )}
            <button
              onClick={exportarCSV}
              title="Exportar CSV"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Export size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar por cliente, NF, operacao, filial..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              autoFocus
            />
          </div>
          {dados && (
            <p className="text-xs text-gray-400 mt-1.5">
              {transacoesFiltradas.length} de {dados.count} transacoes
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingTx ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Spinner size={24} className="animate-spin" />
              <span className="text-sm">Carregando transacoes...</span>
            </div>
          ) : !dados ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Receipt size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Erro ao carregar transacoes.</p>
            </div>
          ) : transacoesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Receipt size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Nenhuma transacao encontrada.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                <tr>
                  {[
                    {
                      label: 'Data',
                      field: 'issue_date',
                      align: 'left',
                      px: 'px-3',
                    },
                    {
                      label: 'Filial',
                      field: 'branch_code',
                      align: 'left',
                      px: 'px-2',
                    },
                    {
                      label: 'NF',
                      field: 'invoice_code',
                      align: 'left',
                      px: 'px-2',
                    },
                    {
                      label: 'Transacao',
                      field: 'transaction_code',
                      align: 'left',
                      px: 'px-2',
                    },
                    {
                      label: 'Cliente',
                      field: 'person_name',
                      align: 'left',
                      px: 'px-3',
                    },
                    {
                      label: 'Operacao',
                      field: 'operation_name',
                      align: 'left',
                      px: 'px-3',
                    },
                    {
                      label: 'Vendedor',
                      field: 'vendedor_nome',
                      align: 'left',
                      px: 'px-3',
                    },
                  ].map(({ label, field, align, px }) => (
                    <th
                      key={field}
                      onClick={() => {
                        if (sortField === field)
                          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else {
                          setSortField(field);
                          setSortDir('asc');
                        }
                      }}
                      className={`text-${align} py-3 ${px} text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${sortField === field ? 'text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                      {label}{' '}
                      <span
                        className={
                          sortField === field
                            ? 'text-gray-800'
                            : 'text-gray-300'
                        }
                      >
                        {sortField === field
                          ? sortDir === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </th>
                  ))}
                  <th
                    onClick={() => {
                      if (sortField === 'payment_method')
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      else {
                        setSortField('payment_method');
                        setSortDir('asc');
                      }
                    }}
                    className={`text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${sortField === 'payment_method' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    Pagamento{' '}
                    <span
                      className={
                        sortField === 'payment_method'
                          ? 'text-gray-800'
                          : 'text-gray-300'
                      }
                    >
                      {sortField === 'payment_method'
                        ? sortDir === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === 'total_value')
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      else {
                        setSortField('total_value');
                        setSortDir('desc');
                      }
                    }}
                    className={`text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${sortField === 'total_value' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    Valor{' '}
                    <span
                      className={
                        sortField === 'total_value'
                          ? 'text-gray-800'
                          : 'text-gray-300'
                      }
                    >
                      {sortField === 'total_value'
                        ? sortDir === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transacoesFiltradas.map((t, i) => {
                  const credev = isCredev(t);
                  return (
                    <tr
                      key={i}
                      className={
                        (credev
                          ? 'bg-orange-50/60'
                          : i % 2 === 0
                            ? 'bg-white'
                            : 'bg-gray-50/50') +
                        ' border-b border-gray-50 hover:bg-blue-50/30 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap text-xs">
                        {t.issue_date}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 text-xs">
                        {t.branch_code}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 text-xs font-mono">
                        {t.invoice_code || '\u2014'}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 text-xs font-mono">
                        {t.transaction_code || '\u2014'}
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px]">
                        <p className="font-medium text-gray-800 truncate">
                          {t.person_name || '\u2014'}
                        </p>
                        <p className="text-xs text-gray-400">
                          #{t.person_code}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-xs max-w-[150px] truncate">
                        {credev && (
                          <span className="inline-block mr-1 px-1 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                            CREDEV
                          </span>
                        )}
                        <span className="text-gray-500">
                          {t.operation_name || t.operation_code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs font-mono">
                        {t.vendedor_nome ? (
                          <span>
                            {t.vendedor_nome}
                            {t.vendedor_ativo === false && (
                              <span className="ml-1 text-gray-400 text-[10px]">
                                (inativo)
                              </span>
                            )}
                          </span>
                        ) : t.dealer_code ? (
                          String(t.dealer_code)
                        ) : (
                          '\u2014'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[120px] truncate">
                        {t.payment_method || t.payment_condition || '\u2014'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-gray-800 whitespace-nowrap">
                        R$ {formatBRL(t.total_value)}
                        {t.credev_amount > 0 && (
                          <div className="text-[10px] text-orange-500 font-normal">
                            bruto R$ {formatBRL(t.total_bruto)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-200">
                <tr>
                  <td
                    colSpan={7}
                    className="py-3 px-4 text-sm font-bold text-gray-700"
                  >
                    Total Líquido ({transacoesFiltradas.length} NFs
                    {transacoesFiltradas.some((t) => t.credev_amount > 0) && (
                      <span className="ml-1 font-normal text-orange-500 text-xs">
                        {' '}
                        · credev -R${' '}
                        {formatBRL(
                          transacoesFiltradas.reduce(
                            (s, t) => s + (t.credev_amount || 0),
                            0,
                          ),
                        )}
                      </span>
                    )}
                    )
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">
                    R${' '}
                    {formatBRL(
                      transacoesFiltradas.reduce(
                        (s, t) => s + t.total_value,
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const CanalCard = React.memo(function CanalCard({
  canal,
  valor,
  percentual,
  rank,
  onClick,
}) {
  const cfg = CANAL_CONFIG[canal] || {
    label: canal,
    icon: ChartBar,
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
  };
  const Icon = cfg.icon;

  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 ${cfg.text} font-semibold text-sm`}
        >
          <Icon size={18} weight="duotone" />
          {cfg.label}
        </div>
        <span className="text-xs text-gray-400 font-medium">#{rank}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800 leading-tight">
        {formatBRLCompact(valor)}
      </div>
      <div className="text-xs text-gray-500">R$ {formatBRL(valor)}</div>
      {/* barra de progresso */}
      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${cfg.bar}`}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>
      <div className={`text-xs font-semibold ${cfg.text}`}>
        {percentual.toFixed(1)}% do total
      </div>
    </div>
  );
});

// â”€â”€â”€ Componente: barra horizontal do gráfico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BarChart({ canais, total }) {
  if (!canais || canais.length === 0) return null;
  const maxVal = Math.max(...canais.map((c) => c.valor));

  return (
    <div className="flex flex-col gap-3">
      {canais.map(({ canal, valor, percentual }) => {
        const cfg = CANAL_CONFIG[canal] || {
          label: canal,
          bar: 'bg-gray-400',
          text: 'text-gray-600',
        };
        const barPct = maxVal > 0 ? (valor / maxVal) * 100 : 0;
        return (
          <div key={canal} className="flex items-center gap-3">
            <div className="w-24 text-right text-xs font-medium text-gray-600 shrink-0">
              {cfg.label}
            </div>
            <div className="flex-1 relative h-7 bg-gray-100 rounded-md overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${cfg.bar} rounded-md transition-all duration-500`}
                style={{ width: `${barPct}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white mix-blend-normal z-10">
                {formatBRLCompact(valor)}
              </span>
            </div>
            <div className="w-14 text-right text-xs text-gray-500 shrink-0">
              {percentual.toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// â”€â”€â”€ Componente: pizza SVG simples â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PieChart({ canais }) {
  if (!canais || canais.length === 0) return null;

  const r = 60;
  const cx = 80;
  const cy = 80;
  let cumAngle = -Math.PI / 2;

  const slices = canais.map(({ canal, percentual }) => {
    const angle = (percentual / 100) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    const x2 = cx + r * Math.cos(cumAngle + angle);
    const y2 = cy + r * Math.sin(cumAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const midAngle = cumAngle + angle / 2;
    const lx = cx + (r + 20) * Math.cos(midAngle);
    const ly = cy + (r + 20) * Math.sin(midAngle);
    const cfg = CANAL_CONFIG[canal] || { color: '#9ca3af' };
    cumAngle += angle;
    return { path, color: cfg.color, lx, ly, canal, percentual };
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {slices.map(({ path, color, canal }) => (
          <path
            key={canal}
            d={path}
            fill={color}
            stroke="white"
            strokeWidth={2}
          />
        ))}
      </svg>
      <div className="flex flex-col gap-2">
        {canais.map(({ canal, percentual }) => {
          const cfg = CANAL_CONFIG[canal] || { label: canal, color: '#9ca3af' };
          return (
            <div key={canal} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cfg.color }}
              />
              <span className="text-gray-600">{cfg.label}</span>
              <span className="font-semibold text-gray-800 ml-1">
                {percentual.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// â”€â”€â”€ Componente: tabela comparativo ano a ano â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Canais criados em 2026 — sem histórico de ano anterior
const NOVOS_CANAIS = new Set(['inbound_david', 'inbound_rafael']);

function TabelaComparativo({ comp, anoAtual, anoAnterior }) {
  const allCanais = CANAL_ORDER.filter(
    (c) =>
      (comp.atual?.segmentos?.[c] ?? 0) > 0 ||
      (comp.acumulado?.segmentos?.[c] ?? 0) > 0 ||
      (comp.anoCompleto?.segmentos?.[c] ?? 0) > 0,
  );

  const totalAtual = comp.atual?.total || 0;
  const totalAcumulado = comp.acumulado?.total || 0;
  const totalAnoCompleto = comp.anoCompleto?.total || 0;
  const totalDiff = totalAtual - totalAcumulado;
  const totalPct =
    totalAcumulado !== 0 ? (totalDiff / totalAcumulado) * 100 : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#000638] text-white">
            <th
              className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wide"
              colSpan={6}
            >
              Comparativo {anoAnterior} × {anoAtual}
            </th>
          </tr>
          <tr className="bg-[#000638]/80 text-white">
            <th className="text-left py-2 px-4 font-semibold text-xs">Canal</th>
            <th className="text-right py-2 px-4 font-semibold text-xs">
              {anoAnterior} (Ano completo)
            </th>
            <th className="text-right py-2 px-4 font-semibold text-xs">
              {anoAnterior} Acumulado
            </th>
            <th className="text-right py-2 px-4 font-semibold text-xs">
              Real {anoAtual}
            </th>
            <th className="text-right py-2 px-4 font-semibold text-xs">
              Diferença
            </th>
            <th className="text-center py-2 px-4 font-semibold text-xs">
              Comparativo
            </th>
          </tr>
        </thead>
        <tbody>
          {allCanais.map((canal, idx) => {
            const cfg = CANAL_CONFIG[canal] || {
              label: canal,
              icon: ChartBar,
              text: 'text-gray-700',
            };
            const Icon = cfg.icon;
            const isNovo = NOVOS_CANAIS.has(canal);
            const anoCompleto = comp.anoCompleto?.segmentos?.[canal] ?? 0;
            const acumulado = comp.acumulado?.segmentos?.[canal] ?? 0;
            const atual = comp.atual?.segmentos?.[canal] ?? 0;
            const diff = isNovo ? null : atual - acumulado;
            const pct =
              isNovo ? null
              : acumulado !== 0
                ? ((atual - acumulado) / acumulado) * 100
                : atual > 0
                  ? 100
                  : null;
            const isPos = diff !== null && diff > 0;
            const isNeg = diff !== null && diff < 0;
            return (
              <tr
                key={canal}
                className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/30 transition-colors`}
              >
                <td className="py-3 px-4">
                  <div
                    className={`flex items-center gap-2 font-semibold text-sm ${cfg.text}`}
                  >
                    <Icon size={15} weight="duotone" />
                    {cfg.label}
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-gray-600">
                  {isNovo ? (
                    <span className="text-xs text-gray-400 italic">Novo canal</span>
                  ) : anoCompleto > 0 ? (
                    `R$ ${formatBRL(anoCompleto)}`
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right text-gray-600">
                  {isNovo ? (
                    <span className="text-xs text-gray-400 italic">Novo canal</span>
                  ) : acumulado > 0 ? (
                    `R$ ${formatBRL(acumulado)}`
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-gray-800">
                  {atual > 0 ? (
                    `R$ ${formatBRL(atual)}`
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td
                  className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-600' : 'text-gray-400'}`}
                >
                  {isNovo ? (
                    <span className="text-gray-300">-</span>
                  ) : diff !== null && diff !== 0 ? (
                    `${isPos ? '+' : ''}R$ ${formatBRL(diff)}`
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {isNovo ? (
                    <span className="text-gray-300 text-xs text-center block">-</span>
                  ) : pct !== null ? (
                    <div
                      className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full text-xs font-bold w-fit mx-auto ${isPos ? 'bg-emerald-100 text-emerald-700' : isNeg ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {isPos ? (
                        <ArrowUp size={12} weight="bold" />
                      ) : isNeg ? (
                        <ArrowDown size={12} weight="bold" />
                      ) : (
                        <Minus size={12} weight="bold" />
                      )}
                      {Math.abs(pct).toFixed(0)}%
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs text-center block">
                      -
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
            <td className="py-3 px-4 text-gray-800 text-sm">TOTAL</td>
            <td className="py-3 px-4 text-right text-gray-700">
              {totalAnoCompleto > 0 ? `R$ ${formatBRL(totalAnoCompleto)}` : '-'}
            </td>
            <td className="py-3 px-4 text-right text-gray-700">
              {totalAcumulado > 0 ? `R$ ${formatBRL(totalAcumulado)}` : '-'}
            </td>
            <td className="py-3 px-4 text-right text-gray-900">
              R$ {formatBRL(totalAtual)}
            </td>
            <td
              className={`py-3 px-4 text-right font-bold ${totalDiff > 0 ? 'text-emerald-600' : totalDiff < 0 ? 'text-red-600' : 'text-gray-400'}`}
            >
              {totalDiff !== 0
                ? `${totalDiff > 0 ? '+' : ''}R$ ${formatBRL(totalDiff)}`
                : '-'}
            </td>
            <td className="py-3 px-4">
              {totalPct !== null ? (
                <div
                  className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full text-xs font-bold w-fit mx-auto ${totalDiff > 0 ? 'bg-emerald-100 text-emerald-700' : totalDiff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {totalDiff > 0 ? (
                    <ArrowUp size={12} weight="bold" />
                  ) : totalDiff < 0 ? (
                    <ArrowDown size={12} weight="bold" />
                  ) : (
                    <Minus size={12} weight="bold" />
                  )}
                  {Math.abs(totalPct).toFixed(0)}%
                </div>
              ) : (
                '-'
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// â”€â”€â”€ Página principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function FaturamentoCanal() {
  const hoje = new Date();
  const defaultFim = hoje.toISOString().split('T')[0];
  const defaultInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [dataInicio, setDataInicio] = useState(defaultInicio);
  const [dataFim, setDataFim] = useState(defaultFim);
  const [loading, setLoading] = useState(false);
  const [revalidating, setRevalidating] = useState(false); // stale-while-revalidate em background
  const [loadingComp, setLoadingComp] = useState(false);
  const [loadingPag, setLoadingPag] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [comp, setComp] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [aba, setAba] = useState('canal');
  const [modalCanal, setModalCanal] = useState(null);
  const [custoWpp, setCustoWpp] = useState(null); // { cost (USD), conversations }
  const [custoAds, setCustoAds] = useState(null); // { spend (USD) }
  const [erroMeta, setErroMeta] = useState(null); // erros das APIs de custo (WhatsApp/Ads)
  const [vendedores, setVendedores] = useState(null);
  const [loadingVend, setLoadingVend] = useState(false);
  const [rankingFat, setRankingFat] = useState(null);

  // ─── Metas por canal (Faturamento × Meta) ─────────────────────────────
  // metaData.metas: { mensal: { canal: valor }, semanal: { canal: valor } }
  // metaData.fat:   { mensal: { canal: valor }, semanal: { canal: valor } }
  const { user } = useAuth() || {};
  const userRole = String(
    user?.user_metadata?.role || user?.role || 'user',
  ).toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const userLogin =
    user?.email || user?.user_metadata?.login || user?.id || null;
  const [metaData, setMetaData] = useState({
    metas: { mensal: {}, semanal: {} },
    justificativas: { mensal: {}, semanal: {} },
    fat: { mensal: {}, semanal: {} },
    loading: false,
    loaded: false,
  });
  const [metaEdit, setMetaEdit] = useState(null); // { canal, periodType, current } ou null
  const [showPlanejamento, setShowPlanejamento] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  // Período selecionado pra exibir/editar metas (default = última semana completa / mês corrente)
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => currentWeekKey());
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => currentMonthKey());

  const anoAtual = dataInicio
    ? new Date(dataInicio + 'T00:00:00').getFullYear()
    : hoje.getFullYear();
  const anoAnterior = anoAtual - 1;

  const buscar = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setErro('');
    setErroMeta(null);
    setCustoWpp(null);
    setCustoAds(null);

    // Stale-while-revalidate: mostra cache local imediatamente, busca fresco em background
    // v3: bumped após correção do varejo via ranking-mirror em /faturamento-por-segmento
    const cacheKey = `fatseg:v7:${dataInicio}:${dataFim}`;
    let hasStale = false;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        setResultado(cached);
        setRevalidating(true);
        hasStale = true;
      }
    } catch {}

    if (!hasStale) setLoading(true);

    // Busca o faturamento principal via faturamento-por-segmento (classifica por
    // dealer + operação — correto para revenda e franquia)
    try {
      const res = await apiPost('/api/crm/faturamento-por-segmento', {
        datemin: dataInicio,
        datemax: dataFim,
      });
      const resultadoFinal = {
        ...res,
        segmentos: res.segmentos ?? res.segmentos_bruto,
        total: res.total_liquido ?? res.total,
      };
      console.log(
        `[Forecast] /faturamento-por-segmento OK — varejo=R$${Number(resultadoFinal.segmentos?.varejo || 0).toFixed(2)} total=R$${Number(resultadoFinal.total || 0).toFixed(2)} source=${res.source || '?'} cached=${res.cached ?? false}`,
      );
      setResultado(resultadoFinal);
      // Salva no localStorage para próxima visita (stale)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(resultadoFinal));
        // Limpa entradas antigas — mantém no máximo 8 chaves fatseg:
        // Limpa caches de versões antigas (v1/v2/v3/v4) — mantém só v5
        Object.keys(localStorage)
          .filter((k) => k.startsWith('fatseg:') && !k.startsWith('fatseg:v7:'))
          .forEach((k) => localStorage.removeItem(k));
        const allKeys = Object.keys(localStorage).filter((k) =>
          k.startsWith('fatseg:v7:'),
        );
        if (allKeys.length > 8) {
          allKeys.slice(0, allKeys.length - 8).forEach((k) => localStorage.removeItem(k));
        }
      } catch {}
    } catch (e) {
      if (!hasStale) {
        let msg =
          'Erro ao buscar faturamento: ' + (e?.message || 'Erro desconhecido');
        if (e?.message?.includes('500')) {
          msg +=
            '\nVerifique se o período selecionado possui dados disponíveis. Caso o erro persista, contate o suporte.';
        }
        setErro(msg);
      }
    } finally {
      setLoading(false);
      setRevalidating(false);
    }

    // Custos de mídia em background — não bloqueiam a exibição do faturamento
    Promise.allSettled([
      apiPost('/api/meta/conversation-costs', {
        startDate: dataInicio,
        endDate: dataFim,
      }),
      apiPost('/api/meta/ads-spend', {
        startDate: dataInicio,
        endDate: dataFim,
      }),
    ]).then(([wpp, ads]) => {
      const metaErros = [];
      if (wpp.status === 'fulfilled') {
        // Inclui by_canal pra mostrar quebra por canal no header
        const t = wpp.value?.totals ?? null;
        if (t) {
          setCustoWpp({ ...t, by_canal: wpp.value?.by_canal || {} });
        } else {
          setCustoWpp(null);
        }
      } else {
        console.error(
          '[Forecast] Falha WhatsApp API costs:',
          wpp.reason?.message,
        );
        metaErros.push(
          'WhatsApp API: ' + (wpp.reason?.message ?? 'erro desconhecido'),
        );
      }
      if (ads.status === 'fulfilled') {
        // Se houver contas, mostrar detalhado, senão mostrar totals
        if (
          ads.value?.accounts &&
          Array.isArray(ads.value.accounts) &&
          ads.value.accounts.length > 0
        ) {
          setCustoAds({
            spend: ads.value.totals?.spend ?? 0,
            impressions: ads.value.totals?.impressions ?? 0,
            clicks: ads.value.totals?.clicks ?? 0,
            accounts: ads.value.accounts,
            by_canal: ads.value.by_canal || {},
          });
        } else {
          setCustoAds(
            ads.value?.totals
              ? { ...ads.value.totals, by_canal: ads.value.by_canal || {} }
              : null,
          );
        }
      } else {
        console.error(
          '[Forecast] Falha Tráfego Pago costs:',
          ads.reason?.message,
        );
        metaErros.push(
          'Tráfego Pago: ' + (ads.reason?.message ?? 'erro desconhecido'),
        );
      }
      if (metaErros.length > 0) setErroMeta(metaErros.join(' | '));
    });
  }, [dataInicio, dataFim]);

  // ─── Carrega metas + faturamento atual (semana + mês corrente) ────────
  // Estratégia: stale-while-revalidate. Cache local de FAT (parte pesada) com
  // TTL 5 min. Metas (parte leve) sempre busca fresh (admin pode editar).
  const loadMetaData = useCallback(async (forceRefresh = false) => {
    // Usa períodos SELECIONADOS pelo usuário (selectedWeekKey / selectedMonthKey)
    // Default: última semana completa + mês corrente
    const monthKey = selectedMonthKey || currentMonthKey();
    const weekKey = selectedWeekKey || currentWeekKey();

    // monthRange: 1º dia do mês até hoje (se for mês corrente) ou último dia
    const [mY, mM] = monthKey.split('-').map(Number);
    const todayIso = new Date().toISOString().slice(0, 10);
    const monthFirst = `${mY}-${String(mM).padStart(2, '0')}-01`;
    const lastDay = new Date(mY, mM, 0).getDate();
    const monthLast = `${mY}-${String(mM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const monthRange = {
      datemin: monthFirst,
      datemax: monthLast < todayIso ? monthLast : todayIso,
    };

    // weekRange a partir do weekKey escolhido
    const weekRangeRaw = weekKeyRange(weekKey) || currentWeekRange();
    const weekRange = {
      datemin: weekRangeRaw.datemin,
      datemax: weekRangeRaw.datemax < todayIso ? weekRangeRaw.datemax : todayIso,
    };

    const fatCacheKey = `fmetas-fat:v1:${monthKey}:${weekKey}`;
    const FAT_CACHE_TTL = 5 * 60 * 1000; // 5 min

    // ── PASSO 1: tenta usar cache local de FAT (stale-while-revalidate) ──
    let cachedFat = null;
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(fatCacheKey);
        if (raw) cachedFat = JSON.parse(raw);
      } catch {}
    }
    const cacheFresh =
      cachedFat && Date.now() - cachedFat.ts < FAT_CACHE_TTL;

    const fetchJson = (url) =>
      fetch(url, { headers: { 'x-api-key': API_KEY } }).then((r) => r.json());

    const composeAndSet = (metasMRes, metasSRes, fatM, fatS, loading) => {
      const metasMensal = {};
      const justifMensal = {};
      for (const m of metasMRes?.data?.metas || []) {
        metasMensal[m.canal] = Number(m.valor_meta);
        if (m.justificativa) justifMensal[m.canal] = m.justificativa;
      }
      const metasSemanal = {};
      const justifSemanal = {};
      for (const m of metasSRes?.data?.metas || []) {
        metasSemanal[m.canal] = Number(m.valor_meta);
        if (m.justificativa) justifSemanal[m.canal] = m.justificativa;
      }
      const fatMensal = { ...(fatM?.segmentos || {}) };
      const fatSemanal = { ...(fatS?.segmentos || {}) };
      fatMensal.fabrica = FABRICA_SOURCES.reduce(
        (s, c) => s + Number(fatMensal[c] || 0),
        0,
      );
      fatSemanal.fabrica = FABRICA_SOURCES.reduce(
        (s, c) => s + Number(fatSemanal[c] || 0),
        0,
      );

      setMetaData({
        metas: { mensal: metasMensal, semanal: metasSemanal },
        justificativas: { mensal: justifMensal, semanal: justifSemanal },
        fat: { mensal: fatMensal, semanal: fatSemanal },
        loading,
        loaded: true,
        monthKey,
        weekKey,
      });
    };

    // ── PASSO 2: busca metas SEMPRE fresh (rápido, admin pode ter editado) ──
    setMetaData((s) => ({ ...s, loading: true }));
    let metasMRes, metasSRes;
    try {
      [metasMRes, metasSRes] = await Promise.all([
        fetchJson(
          `${API_BASE_URL}/api/crm/canal-metas?period_type=mensal&period_key=${monthKey}`,
        ),
        fetchJson(
          `${API_BASE_URL}/api/crm/canal-metas?period_type=semanal&period_key=${weekKey}`,
        ),
      ]);
    } catch (err) {
      console.error('[Forecast/Métricas] metas fetch falhou:', err.message);
      setMetaData((s) => ({ ...s, loading: false, loaded: true }));
      return;
    }

    // ── PASSO 3: se cache fresh, usa stale do localStorage + metas atuais ──
    if (cacheFresh) {
      composeAndSet(
        metasMRes,
        metasSRes,
        cachedFat.fatM,
        cachedFat.fatS,
        false, // loading: false — já é stale-fresh
      );
      return;
    }

    // ── PASSO 4: se cache stale (>5min), mostra imediatamente + revalida ──
    if (cachedFat) {
      composeAndSet(
        metasMRes,
        metasSRes,
        cachedFat.fatM,
        cachedFat.fatS,
        true, // loading=true mostra o spinner sutil
      );
    }

    // ── PASSO 5: busca FAT fresh em background ──
    try {
      const [fatM, fatS] = await Promise.all([
        apiPost('/api/crm/faturamento-por-segmento', monthRange),
        apiPost('/api/crm/faturamento-por-segmento', weekRange),
      ]);
      composeAndSet(metasMRes, metasSRes, fatM, fatS, false);
      // Salva no cache local
      try {
        localStorage.setItem(
          fatCacheKey,
          JSON.stringify({ ts: Date.now(), fatM, fatS }),
        );
        // Limpa caches antigos (mantém só 4 entradas fmetas-fat:)
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith('fmetas-fat:'),
        );
        if (keys.length > 4) {
          keys.slice(0, keys.length - 4).forEach((k) =>
            localStorage.removeItem(k),
          );
        }
      } catch {}
    } catch (err) {
      console.error('[Forecast/Métricas] fat fetch falhou:', err.message);
      setMetaData((s) => ({ ...s, loading: false }));
    }
  }, [selectedWeekKey, selectedMonthKey]);

  // Salva uma meta (admin only) — usa período SELECIONADO
  const saveMeta = useCallback(
    async (canal, periodType, valor, justificativa) => {
      if (!isAdmin) return;
      const periodKey = periodType === 'mensal'
        ? (selectedMonthKey || currentMonthKey())
        : (selectedWeekKey || currentWeekKey());
      try {
        const res = await fetch(`${API_BASE_URL}/api/crm/canal-metas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-user-role': userRole,
            'x-user-login': userLogin || '',
          },
          body: JSON.stringify({
            canal,
            period_type: periodType,
            period_key: periodKey,
            valor_meta: Number(valor),
            justificativa: justificativa || null,
            user_login: userLogin,
          }),
        });
        const j = await res.json();
        if (!res.ok || !j?.success) {
          throw new Error(j?.message || `HTTP ${res.status}`);
        }
        // Atualiza estado local
        setMetaData((s) => {
          const newJustif = { ...(s.justificativas?.[periodType] || {}) };
          if (justificativa) newJustif[canal] = justificativa;
          else delete newJustif[canal];
          return {
            ...s,
            metas: {
              ...s.metas,
              [periodType]: { ...s.metas[periodType], [canal]: Number(valor) },
            },
            justificativas: {
              ...(s.justificativas || { mensal: {}, semanal: {} }),
              [periodType]: newJustif,
            },
          };
        });
        setMetaEdit(null);
      } catch (err) {
        alert('Erro ao salvar meta: ' + err.message);
      }
    },
    [isAdmin, userRole, userLogin, selectedWeekKey, selectedMonthKey],
  );

  // Carrega meta quando a aba 'vendedores' é aberta OU quando muda período
  useEffect(() => {
    if (aba === 'vendedores') {
      loadMetaData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, selectedWeekKey, selectedMonthKey]);

  const buscarVendedores = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setLoadingVend(true);
    setErro('');
    try {
      // Usa o mesmo endpoint TOTVS para todos os canais (sem Supabase)
      const res = await apiPost('/api/crm/canais-totals-all', {
        datemin: dataInicio,
        datemax: dataFim,
      });
      setVendedores([]); // não precisa mais de dados por vendedor individual
      setRankingFat(res ?? null);
    } catch (e) {
      setErro('Erro ao buscar dados: ' + e.message);
    } finally {
      setLoadingVend(false);
    }
  }, [dataInicio, dataFim]);

  const buscarPagamento = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setLoadingPag(true);
    setErro('');
    try {
      const res = await apiPost('/api/crm/faturamento-por-pagamento', {
        datemin: dataInicio,
        datemax: dataFim,
      });
      setPagamento(res);
    } catch (e) {
      setErro('Erro ao buscar formas de pagamento: ' + e.message);
    } finally {
      setLoadingPag(false);
    }
  }, [dataInicio, dataFim]);

  const buscarComparativo = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setLoadingComp(true);
    setErro('');
    try {
      const acumInicio = subtrairUmAno(dataInicio);
      const acumFim = subtrairUmAno(dataFim);
      const anoCompletoInicio = `${anoAnterior}-01-01`;
      const anoCompletoFim = `${anoAnterior}-12-31`;

      const [atual, acumulado, anoCompleto] = await Promise.all([
        apiPost('/api/crm/canais-totals-all', {
          datemin: dataInicio,
          datemax: dataFim,
        }),
        apiPost('/api/crm/canais-totals-all', {
          datemin: acumInicio,
          datemax: acumFim,
        }),
        apiPost('/api/crm/canais-totals-all', {
          datemin: anoCompletoInicio,
          datemax: anoCompletoFim,
        }),
      ]);

      setComp({ atual, acumulado, anoCompleto, acumInicio, acumFim });
    } catch (e) {
      setErro('Erro ao buscar comparativo: ' + e.message);
    } finally {
      setLoadingComp(false);
    }
  }, [dataInicio, dataFim, anoAnterior]);

  React.useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    // aba === 'canal' é carregado pelo effect de mount acima — não duplicar aqui
    if (
      aba === 'comparativo' &&
      !comp &&
      !loadingComp &&
      dataInicio &&
      dataFim
    ) {
      buscarComparativo();
    }
    if (
      aba === 'pagamento' &&
      !pagamento &&
      !loadingPag &&
      dataInicio &&
      dataFim
    ) {
      buscarPagamento();
    }
    if (
      aba === 'vendedores' &&
      !vendedores &&
      !loadingVend &&
      dataInicio &&
      dataFim
    ) {
      buscarVendedores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const canaisOrdenados = useMemo(() => {
    if (!resultado?.segmentos) return [];
    const segs = resultado.segmentos;
    const total = resultado.total || 1;
    return CANAL_ORDER.filter((c) => segs[c] != null && segs[c] > 0)
      .map((canal) => ({
        canal,
        valor: segs[canal],
        percentual: (segs[canal] / total) * 100,
      }))
      .sort((a, b) => b.valor - a.valor)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [resultado]);

  const handleBuscar = () => {
    setResultado(null);
    setComp(null);
    setPagamento(null);
    setVendedores(null);
    setRankingFat(null);
    setCustoWpp(null);
    setCustoAds(null);
    setErroMeta(null);
    // Sempre atualiza o faturamento principal (aba canal)
    buscar();
    if (aba === 'comparativo') buscarComparativo();
    else if (aba === 'vendedores') buscarVendedores();
    else if (aba === 'pagamento') buscarPagamento();
  };

  const ATALHOS = [
    {
      // Última semana COMPLETA = segunda passada até domingo passado.
      // Ex: hoje (segunda 11/05) → 04/05 a 10/05.
      // Ex: hoje (quarta 13/05) → 04/05 a 10/05 (mesma semana anterior).
      // Ex: hoje (domingo 10/05) → 27/04 a 03/05 (domingo de hoje ainda
      //   pertence à semana corrente, então pega a anterior).
      label: 'Última semana',
      fn: () => {
        const today = new Date();
        const dow = today.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
        const daysSinceLastSunday = dow === 0 ? 7 : dow;
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - daysSinceLastSunday);
        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 6);
        setDataInicio(
          new Date(
            lastMonday.getFullYear(),
            lastMonday.getMonth(),
            lastMonday.getDate(),
          )
            .toISOString()
            .split('T')[0],
        );
        setDataFim(
          new Date(
            lastSunday.getFullYear(),
            lastSunday.getMonth(),
            lastSunday.getDate(),
          )
            .toISOString()
            .split('T')[0],
        );
      },
    },
    {
      label: 'Este mês',
      fn: () => {
        const h = new Date();
        setDataInicio(
          new Date(h.getFullYear(), h.getMonth(), 1)
            .toISOString()
            .split('T')[0],
        );
        setDataFim(h.toISOString().split('T')[0]);
      },
    },
    {
      label: 'Mês passado',
      fn: () => {
        const h = new Date();
        setDataInicio(
          new Date(h.getFullYear(), h.getMonth() - 1, 1)
            .toISOString()
            .split('T')[0],
        );
        setDataFim(
          new Date(h.getFullYear(), h.getMonth(), 0)
            .toISOString()
            .split('T')[0],
        );
      },
    },
    {
      label: 'Últimos 3 meses',
      fn: () => {
        const h = new Date();
        setDataInicio(
          new Date(h.getFullYear(), h.getMonth() - 2, 1)
            .toISOString()
            .split('T')[0],
        );
        setDataFim(h.toISOString().split('T')[0]);
      },
    },
    {
      label: 'Este ano',
      fn: () => {
        const h = new Date();
        setDataInicio(`${h.getFullYear()}-01-01`);
        setDataFim(h.toISOString().split('T')[0]);
      },
    },
  ];

  const isLoading =
    aba === 'canal'
      ? loading
      : aba === 'comparativo'
        ? loadingComp
        : aba === 'vendedores'
          ? loadingVend
          : aba === 'pagamento'
            ? loadingPag
            : false; // metricas-diarias usa loading interno dos próprios componentes

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageTitle
          title="Forecast"
          subtitle="Análise do faturamento separado por canal de vendas"
          icon={ChartPieSlice}
        />

        {/* â”€â”€ Filtros â”€â”€ */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">
                  Data início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">
                  Data fim
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {ATALHOS.map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={fn}
                    className="text-xs px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleBuscar}
                disabled={isLoading || !dataInicio || !dataFim}
                className="flex items-center gap-2 px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-medium hover:bg-[#000638]/90 disabled:opacity-50 transition-colors ml-auto"
              >
                {isLoading ? (
                  <Spinner size={16} className="animate-spin" />
                ) : (
                  <ArrowsClockwise size={16} />
                )}
                {isLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* â”€â”€ Abas â”€â”€ */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {[
            { id: 'canal', label: 'Por Canal', icon: ChartPieSlice },
            // Comparativo × Ano Anterior e Forma de Pagamento ocultos temporariamente
            // (não estão completos ainda). Para reativar, descomente as linhas abaixo.
            // {
            //   id: 'comparativo',
            //   label: `Comparativo × Ano Anterior`,
            //   icon: CalendarBlank,
            // },
            // { id: 'pagamento', label: 'Forma de Pagamento', icon: CreditCard },
            { id: 'vendedores', label: 'Métricas por Canal', icon: ChartBar },
            { id: 'metricas-diarias', label: 'Métricas Diárias', icon: Target },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === id ? 'bg-[#000638] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* â”€â”€ Erro â”€â”€ */}
        {erro && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {erro}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• ABA: POR CANAL â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {aba === 'canal' && resultado && !loading && (
          <>
            <Card className="mb-6 relative overflow-hidden border-0 shadow-lg">
              {/* Gradiente + glow ornaments (mesmo padrão da aba Métricas) */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#000638] via-[#0e1660] to-[#000638]" />
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-yellow-500/5 rounded-full blur-3xl" />

              <CardContent className="relative pt-6 pb-6 text-white">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* ── ESQUERDA: total + período ── */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-14 h-14 rounded-xl bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                      <CurrencyDollar
                        size={28}
                        weight="duotone"
                        className="text-blue-300"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[11px] text-blue-200 font-semibold uppercase tracking-wider">
                          Faturamento Líquido no Período
                        </p>
                        <span className="text-[10px] text-blue-300/70 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                          TOTVS
                        </span>
                        {revalidating && (
                          <span className="text-[11px] inline-flex items-center gap-1 opacity-80 text-blue-300">
                            <Spinner size={10} className="animate-spin" />
                            atualizando...
                          </span>
                        )}
                      </div>
                      <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                        R$ {formatBRL(resultado.total || 0)}
                      </p>
                      <p className="text-xs text-blue-300 mt-1 flex items-center gap-2 flex-wrap">
                        <CalendarBlank size={12} weight="bold" />
                        <span>
                          {dataInicio} → {dataFim}
                        </span>
                        <span className="opacity-50">•</span>
                        <span>{canaisOrdenados.length} canais</span>
                        {canaisOrdenados[0] && (
                          <>
                            <span className="opacity-50">•</span>
                            <span>
                              Top:{' '}
                              <b>
                                {CANAL_CONFIG[canaisOrdenados[0].canal]?.label ||
                                  canaisOrdenados[0].canal}
                              </b>{' '}
                              ({formatBRLCompact(canaisOrdenados[0].valor)})
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Custos API WhatsApp + Tráfego */}
                  {(custoWpp || custoAds || erroMeta) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 lg:gap-3 min-w-0 lg:min-w-[440px]">
                      {custoWpp && (
                        <div className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-400/20 rounded-lg p-3 text-left">
                          <p className="text-[10px] text-yellow-200/80 uppercase tracking-wider font-medium mb-1">
                            WhatsApp API
                          </p>
                          <p className="text-base font-bold text-yellow-200">
                            R${' '}
                            {formatBRL(
                              custoWpp.costBRL ?? custoWpp.cost * 5.8 ?? 0,
                            )}
                          </p>
                          {(custoWpp.conversations ?? 0) > 0 && (
                            <p className="text-xs text-blue-300">
                              {custoWpp.conversations.toLocaleString('pt-BR')}{' '}
                              conversas
                            </p>
                          )}
                          {/* Quebra por canal — destaca varejo, multimarcas, revenda
                              + expansível pra ver todos os outros canais */}
                          {custoWpp.by_canal &&
                            Object.keys(custoWpp.by_canal).length > 0 && (() => {
                              const PRINCIPAIS = ['varejo', 'multimarcas', 'revenda'];
                              const byCanal = custoWpp.by_canal;
                              const principais = PRINCIPAIS
                                .filter((c) => byCanal[c])
                                .map((c) => ({ canal: c, ...byCanal[c] }));
                              const outros = Object.entries(byCanal)
                                .filter(([c]) => !PRINCIPAIS.includes(c))
                                .map(([c, v]) => ({ canal: c, ...v }))
                                .sort((a, b) => b.costBRL - a.costBRL);
                              const labelMap = {
                                varejo: 'Varejo',
                                multimarcas: 'Multimarcas',
                                revenda: 'Revenda',
                                franquia: 'Franquia',
                                financeiro: 'Financeiro',
                                business: 'Business',
                                bazar: 'Bazar',
                                showroom: 'Showroom',
                                novidadesfranquia: 'Novidades Franquia',
                                ricardoeletro: 'Ricardo Eletro',
                                sem_canal: 'Sem canal',
                              };
                              return (
                                <div className="mt-2 space-y-0.5">
                                  {principais.map((c) => (
                                    <div
                                      key={c.canal}
                                      className="flex items-center justify-between gap-3 text-xs"
                                    >
                                      <span className="text-blue-200">
                                        {labelMap[c.canal] || c.canal}
                                      </span>
                                      <span className="text-yellow-100 font-semibold tabular-nums">
                                        R$ {formatBRL(c.costBRL || 0)}
                                      </span>
                                    </div>
                                  ))}
                                  {outros.length > 0 && (
                                    <details className="mt-1 text-left">
                                      <summary className="text-[11px] text-blue-300 cursor-pointer hover:text-blue-200 select-none">
                                        + {outros.length} outro
                                        {outros.length > 1 ? 's' : ''} canal
                                        {outros.length > 1 ? 'is' : ''}
                                      </summary>
                                      <div className="mt-1 space-y-0.5 pl-2 border-l border-blue-700">
                                        {outros.map((c) => (
                                          <div
                                            key={c.canal}
                                            className="flex items-center justify-between gap-3 text-xs"
                                          >
                                            <span className="text-blue-300">
                                              {labelMap[c.canal] || c.canal}
                                            </span>
                                            <span className="text-yellow-100 tabular-nums">
                                              R$ {formatBRL(c.costBRL || 0)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      )}
                      {custoAds && (
                        <div className="bg-purple-500/10 backdrop-blur-sm border border-purple-400/20 rounded-lg p-3 text-left">
                          <p className="text-[10px] text-purple-200/80 uppercase tracking-wider font-medium mb-1">
                            Tráfego Pago (Meta Ads)
                          </p>
                          <p className="text-base font-bold text-purple-200">
                            R$ {formatBRL(custoAds.spend ?? 0)}
                          </p>
                          {(custoAds.impressions ?? 0) > 0 && (
                            <p className="text-xs text-blue-300">
                              {custoAds.impressions.toLocaleString('pt-BR')}{' '}
                              impressões
                            </p>
                          )}
                          {(custoAds.clicks ?? 0) > 0 && (
                            <p className="text-xs text-green-300">
                              {custoAds.clicks.toLocaleString('pt-BR')} cliques
                            </p>
                          )}
                          {/* Quebra por canal — destaca varejo, multimarcas, revenda
                              + expansível pra ver outros canais */}
                          {custoAds.by_canal &&
                            Object.keys(custoAds.by_canal).length > 0 && (() => {
                              const PRINCIPAIS = ['varejo', 'multimarcas', 'revenda'];
                              const byCanal = custoAds.by_canal;
                              const principais = PRINCIPAIS
                                .filter((c) => byCanal[c])
                                .map((c) => ({ canal: c, ...byCanal[c] }));
                              const outros = Object.entries(byCanal)
                                .filter(([c]) => !PRINCIPAIS.includes(c))
                                .map(([c, v]) => ({ canal: c, ...v }))
                                .sort((a, b) => b.spend - a.spend);
                              const labelMap = {
                                varejo: 'Varejo',
                                multimarcas: 'Multimarcas',
                                revenda: 'Revenda',
                                franquia: 'Franquia',
                                financeiro: 'Financeiro',
                                business: 'Business',
                                bazar: 'Bazar',
                                showroom: 'Showroom',
                                novidadesfranquia: 'Novidades Franquia',
                                ricardoeletro: 'Ricardo Eletro',
                                sem_canal: 'Sem canal',
                              };
                              return (
                                <div className="mt-2 space-y-0.5">
                                  {principais.map((c) => (
                                    <div
                                      key={c.canal}
                                      className="flex items-center justify-between gap-3 text-xs"
                                    >
                                      <span className="text-blue-200">
                                        {labelMap[c.canal] || c.canal}
                                      </span>
                                      <span className="text-purple-100 font-semibold tabular-nums">
                                        R$ {formatBRL(c.spend || 0)}
                                      </span>
                                    </div>
                                  ))}
                                  {outros.length > 0 && (
                                    <details className="mt-1 text-left">
                                      <summary className="text-[11px] text-purple-400 cursor-pointer hover:text-purple-300 select-none">
                                        + {outros.length} outro
                                        {outros.length > 1 ? 's' : ''} canal
                                        {outros.length > 1 ? 'is' : ''}
                                      </summary>
                                      <div className="mt-1 space-y-0.5 pl-2 border-l border-purple-700">
                                        {outros.map((c) => (
                                          <div
                                            key={c.canal}
                                            className="flex items-center justify-between gap-3 text-xs"
                                          >
                                            <span className="text-blue-300">
                                              {labelMap[c.canal] || c.canal}
                                            </span>
                                            <span className="text-purple-100 tabular-nums">
                                              R$ {formatBRL(c.spend || 0)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              );
                            })()}
                          {Array.isArray(custoAds.accounts) &&
                            custoAds.accounts.length > 0 && (
                              <details className="mt-1">
                                <summary className="text-xs text-purple-400 cursor-pointer">
                                  Ver contas detalhadas
                                </summary>
                                <ul className="text-xs text-purple-200">
                                  {custoAds.accounts.map((acc) => (
                                    <li
                                      key={acc.ad_account_id}
                                      className="mb-1"
                                    >
                                      <span className="font-semibold">
                                        {acc.name}:
                                      </span>{' '}
                                      R$ {formatBRL(acc.spend ?? 0)}
                                      {acc.impressions
                                        ? ` | ${acc.impressions.toLocaleString('pt-BR')} imp.`
                                        : ''}
                                      {acc.clicks
                                        ? ` | ${acc.clicks.toLocaleString('pt-BR')} cliques`
                                        : ''}
                                      {acc.error ? (
                                        <span className="text-red-400">
                                          {' '}
                                          | Erro: {acc.error}
                                        </span>
                                      ) : (
                                        ''
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                        </div>
                      )}
                      {erroMeta && (
                        <p className="text-xs text-red-300 max-w-[200px] text-right">
                          ⚠️ Custos indisponíveis: {erroMeta}
                        </p>
                      )}
                    </div>
                  )}

                  {resultado.credev_total > 0 && (
                    <div className="grid grid-cols-2 gap-2 lg:gap-3">
                      <div className="bg-rose-500/10 backdrop-blur-sm border border-rose-400/20 rounded-lg p-3">
                        <p className="text-[10px] text-rose-200/80 uppercase tracking-wider font-medium mb-1">
                          Devoluções (Credev)
                        </p>
                        <p className="text-xl font-bold text-rose-300">
                          — R$ {formatBRL(resultado.credev_total)}
                        </p>
                      </div>
                      <div className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-400/20 rounded-lg p-3">
                        <p className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-medium mb-1">
                          Faturamento Líquido
                        </p>
                        <p className="text-xl font-bold text-emerald-300">
                          R${' '}
                          {formatBRL(
                            resultado.total_liquido ??
                              resultado.total - resultado.credev_total,
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {canaisOrdenados.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
                  {canaisOrdenados.map((item) => (
                    <CanalCard
                      key={item.canal}
                      {...item}
                      onClick={() => setModalCanal(item.canal)}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ChartBar size={16} />
                        Comparativo por Canal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarChart canais={canaisOrdenados} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ChartPieSlice size={16} />
                        Distribuição (%)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PieChart canais={canaisOrdenados} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tabela Detalhada</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            {[
                              '#',
                              'Canal',
                              'Faturamento',
                              '% do Total',
                              'Participação',
                            ].map((h, i) => (
                              <th
                                key={h}
                                className={`py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i > 1 ? 'text-right' : 'text-left'}`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {canaisOrdenados.map(
                            ({ canal, valor, percentual, rank }) => {
                              const cfg = CANAL_CONFIG[canal] || {
                                label: canal,
                                icon: ChartBar,
                                bar: 'bg-gray-400',
                                text: 'text-gray-600',
                              };
                              const Icon = cfg.icon;
                              return (
                                <tr
                                  key={canal}
                                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-3 px-3 text-gray-400 font-medium">
                                    {rank}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div
                                      className={`flex items-center gap-2 font-medium ${cfg.text}`}
                                    >
                                      <Icon size={16} weight="duotone" />
                                      {cfg.label}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-semibold text-gray-800">
                                    R$ {formatBRL(valor)}
                                  </td>
                                  <td className="py-3 px-3 text-right text-gray-600">
                                    {percentual.toFixed(2)}%
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center justify-end">
                                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${cfg.bar} rounded-full`}
                                          style={{ width: `${percentual}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="py-3 px-3 text-gray-400" />
                            <td className="py-3 px-3 text-gray-700">Total</td>
                            <td className="py-3 px-3 text-right text-gray-800">
                              R$ {formatBRL(resultado.total || 0)}
                            </td>
                            <td className="py-3 px-3 text-right text-gray-600">
                              100%
                            </td>
                            <td className="py-3 px-3" />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <ChartPieSlice size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  Nenhum faturamento encontrado para o período.
                </p>
              </div>
            )}
          </>
        )}

        {aba === 'canal' && !resultado && !loading && !erro && (
          <div className="text-center py-16 text-gray-400">
            <ChartPieSlice size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione o período e clique em Buscar.</p>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• ABA: COMPARATIVO â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {aba === 'comparativo' && comp && !loadingComp && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {(() => {
                const totalAtual = comp.atual?.total || 0;
                const totalAcumulado = comp.acumulado?.total || 0;
                const diff = totalAtual - totalAcumulado;
                const isPos = diff >= 0;
                return [
                  {
                    label: `${anoAnterior} Acumulado`,
                    sublabel: `${comp.acumInicio} → ${comp.acumFim}`,
                    valor: totalAcumulado,
                    prefix: 'R$',
                    color: 'text-gray-800',
                  },
                  {
                    label: `Real ${anoAtual}`,
                    sublabel: `${dataInicio} â†’ ${dataFim}`,
                    valor: totalAtual,
                    prefix: 'R$',
                    color: 'text-[#000638]',
                  },
                  {
                    label: 'Diferença',
                    sublabel: 'Real vs Acumulado',
                    valor: diff,
                    prefix: diff > 0 ? '+R$' : 'R$',
                    color: isPos ? 'text-emerald-600' : 'text-red-600',
                    bg: isPos ? 'bg-emerald-50' : 'bg-red-50',
                  },
                  ,
                  {
                    label: 'Credev (Devoluções)',
                    sublabel: 'NFs de devolução do período',
                    valor: comp.atual?.credev_total || 0,
                    prefix: '- R$',
                    color:
                      comp.atual?.credev_total > 0
                        ? 'text-red-600'
                        : 'text-gray-400',
                    bg: comp.atual?.credev_total > 0 ? 'bg-red-50' : undefined,
                  },
                ].map(({ label, sublabel, valor, prefix, color, bg }) => (
                  <Card key={label} className={bg}>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {label}
                      </p>
                      <p className={`text-xl font-bold ${color}`}>
                        {prefix} {formatBRL(Math.abs(valor))}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>

            <Card>
              <CardContent className="pt-4">
                <TabelaComparativo
                  comp={comp}
                  anoAtual={anoAtual}
                  anoAnterior={anoAnterior}
                />
              </CardContent>
            </Card>
          </>
        )}

        {aba === 'comparativo' && !comp && !loadingComp && !erro && (
          <div className="text-center py-16 text-gray-400">
            <CalendarBlank size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione o período e clique em Buscar.</p>
          </div>
        )}

        {/* ══════════════════ ABA: FORMA DE PAGAMENTO ══════════════════ */}
        {aba === 'pagamento' &&
          pagamento &&
          !loadingPag &&
          (() => {
            const itensFiltrados = (pagamento.items || [])
              .filter(
                (item) =>
                  !termoBusca ||
                  (item.paymentDescription || '')
                    .toLowerCase()
                    .includes(termoBusca.toLowerCase()),
              )
              .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));

            const totalGeral = (pagamento.items || []).reduce(
              (s, i) => s + (i.totalValue || 0),
              0,
            );
            const maxValor =
              itensFiltrados.length > 0
                ? Math.max(...itensFiltrados.map((i) => i.totalValue || 0))
                : 1;

            return (
              <>
                <Card className="mb-6 bg-[#000638] text-white">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-xs text-blue-200 font-medium uppercase tracking-wide mb-1">
                          Total por Forma de Pagamento
                        </p>
                        <p className="text-3xl font-bold">
                          R$ {formatBRL(totalGeral)}
                        </p>
                        <p className="text-xs text-blue-300 mt-1">
                          {dataInicio} &rarr; {dataFim} &bull;{' '}
                          {pagamento.items?.length || 0} forma(s) &bull; Credev
                          excluído automaticamente
                        </p>
                      </div>
                      <CreditCard
                        size={48}
                        className="text-blue-400 opacity-60"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 max-w-xs">
                    <MagnifyingGlass
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Filtrar forma de pagamento..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <Card>
                  <CardContent className="pt-4">
                    {itensFiltrados.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-8">
                        Nenhuma forma de pagamento encontrada.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              {[
                                '#',
                                'Forma de Pagamento',
                                'Qtd. NFs',
                                'Total',
                                '% do Total',
                                'Distribuição',
                              ].map((h, i) => (
                                <th
                                  key={h}
                                  className={`py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i >= 2 ? 'text-right' : 'text-left'}`}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {itensFiltrados.map(
                              (
                                {
                                  paymentCode,
                                  paymentDescription,
                                  invoiceQty,
                                  totalValue,
                                },
                                idx,
                              ) => {
                                const pct =
                                  totalGeral > 0
                                    ? (totalValue / totalGeral) * 100
                                    : 0;
                                const barPct =
                                  maxValor > 0
                                    ? (totalValue / maxValor) * 100
                                    : 0;
                                return (
                                  <tr
                                    key={paymentCode ?? idx}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                  >
                                    <td className="py-3 px-3 text-gray-400 font-medium text-xs">
                                      {idx + 1}
                                    </td>
                                    <td className="py-3 px-3 font-medium text-gray-800">
                                      {paymentDescription ||
                                        `Cód. ${paymentCode}`}
                                    </td>
                                    <td className="py-3 px-3 text-right text-gray-600">
                                      {invoiceQty ?? '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right font-semibold text-gray-800">
                                      R$ {formatBRL(totalValue)}
                                    </td>
                                    <td className="py-3 px-3 text-right text-gray-600">
                                      {pct.toFixed(2)}%
                                    </td>
                                    <td className="py-3 px-3 min-w-[140px]">
                                      <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                                        <div
                                          className="absolute inset-y-0 left-0 bg-violet-500 rounded transition-all duration-500"
                                          style={{ width: `${barPct}%` }}
                                        />
                                        <span className="absolute inset-0 flex items-center px-1.5 text-xs font-semibold text-white z-10">
                                          {formatBRLCompact(totalValue)}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                              <td className="py-3 px-3 text-gray-400" />
                              <td className="py-3 px-3 text-gray-700">Total</td>
                              <td className="py-3 px-3 text-right text-gray-700">
                                {itensFiltrados.reduce(
                                  (s, i) => s + (i.invoiceQty || 0),
                                  0,
                                )}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-900">
                                R$ {formatBRL(totalGeral)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-600">
                                100%
                              </td>
                              <td className="py-3 px-3" />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}

        {aba === 'pagamento' && !pagamento && !loadingPag && !erro && (
          <div className="text-center py-16 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione o período e clique em Buscar.</p>
          </div>
        )}

        {/* ══════════════════ ABA: MÉTRICAS POR CANAL ══════════════════ */}
        {aba === 'vendedores' &&
          rankingFat &&
          !loadingVend &&
          (() => {
            // Dados 100% TOTVS: rankingFat = { segmentos, segmentosQty, segmentosItens, total }
            const segs = rankingFat.segmentos || {};
            const segsQty = rankingFat.segmentosQty || {};
            const segsItens = rankingFat.segmentosItens || {};

            const canaisAgg = CANAL_ORDER.filter((c) => (segs[c] ?? 0) > 0)
              .map((canal) => {
                const iv = segs[canal] || 0;
                const iq = segsQty[canal] || 0;
                const iz = segsItens[canal] || 0;
                const tm = iq > 0 ? iv / iq : 0;
                const pa = iq > 0 && iz > 0 ? iz / iq : 0;
                const pmpv = iz > 0 ? iv / iz : 0;
                return {
                  canal,
                  invoice_value: iv,
                  invoice_qty: iq,
                  itens_qty: iz,
                  credev_value: 0,
                  tm,
                  pa,
                  pmpv,
                  _viaTotvs: true,
                };
              })
              .sort((a, b) => b.invoice_value - a.invoice_value);

            const totalGeral = canaisAgg.reduce(
              (s, c) => s + c.invoice_value,
              0,
            );
            const maxVal = canaisAgg[0]?.invoice_value || 1;

            // Lista de canais ordenada — esconde showroom/novidades (somados
            // virtualmente em "fabrica") e inclui "fabrica" na posição original
            // de showroom.
            const canaisMetaSet = new Set([
              ...Object.keys(metaData.metas?.mensal || {}),
              ...Object.keys(metaData.metas?.semanal || {}),
              ...Object.keys(metaData.fat?.mensal || {}),
              ...Object.keys(metaData.fat?.semanal || {}),
            ]);
            const FABRICA_SET = new Set(FABRICA_SOURCES);
            const orderWithFabrica = [];
            for (const c of CANAL_ORDER) {
              if (FABRICA_SET.has(c)) {
                // Quando encontrar o primeiro showroom, insere fabrica e pula
                if (!orderWithFabrica.includes('fabrica')) {
                  orderWithFabrica.push('fabrica');
                }
                continue;
              }
              orderWithFabrica.push(c);
            }
            const canaisMeta = orderWithFabrica.filter(
              (c) =>
                canaisMetaSet.has(c) ||
                c === 'fabrica' ||
                (metaData.fat?.mensal?.[c] ?? 0) > 0 ||
                (metaData.fat?.semanal?.[c] ?? 0) > 0,
            );

            const pctColor = (pct) => {
              if (pct >= 100) return 'text-emerald-600 bg-emerald-50';
              if (pct >= 70) return 'text-amber-600 bg-amber-50';
              return 'text-rose-600 bg-rose-50';
            };

            return (
              <>
                {(() => {
                  // Estatísticas pra header (atingimento médio + top/pior)
                  const PRINCIPAIS = ['varejo', 'multimarcas', 'revenda'];
                  const topCanal = canaisAgg[0];
                  // Calcula % médio considerando canais com meta cadastrada
                  const canaisComMeta = canaisMeta
                    .filter((c) => (metaData.metas?.mensal?.[c] ?? 0) > 0)
                    .map((c) => ({
                      canal: c,
                      meta: metaData.metas.mensal[c],
                      fat: metaData.fat?.mensal?.[c] || 0,
                      pct:
                        metaData.metas.mensal[c] > 0
                          ? ((metaData.fat?.mensal?.[c] || 0) /
                              metaData.metas.mensal[c]) *
                            100
                          : 0,
                    }));
                  const totalMetasMes = canaisComMeta.reduce(
                    (s, c) => s + c.meta,
                    0,
                  );
                  const totalAtingidoMes = canaisComMeta.reduce(
                    (s, c) => s + c.fat,
                    0,
                  );
                  const pctMedio =
                    totalMetasMes > 0
                      ? (totalAtingidoMes / totalMetasMes) * 100
                      : 0;
                  const ordenadoPct = [...canaisComMeta].sort(
                    (a, b) => b.pct - a.pct,
                  );
                  const melhor = ordenadoPct[0];
                  const pior = ordenadoPct[ordenadoPct.length - 1];

                  const pctTextColor = (p) =>
                    p >= 100
                      ? 'text-emerald-300'
                      : p >= 70
                        ? 'text-amber-300'
                        : 'text-rose-300';

                  return (
                    <Card className="mb-6 relative overflow-hidden border-0 shadow-lg">
                      {/* Gradiente de fundo + ornament */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#000638] via-[#0e1660] to-[#000638]" />
                      <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
                      <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />

                      <CardContent className="relative pt-6 pb-6 text-white">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                          {/* ── ESQUERDA: total + período ── */}
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                              <ChartBar
                                size={28}
                                weight="duotone"
                                className="text-blue-300"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[11px] text-blue-200 font-semibold uppercase tracking-wider">
                                  Métricas por Canal
                                </p>
                                <span className="text-[10px] text-blue-300/70 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                  TOTVS
                                </span>
                              </div>
                              <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                                R$ {formatBRL(totalGeral)}
                              </p>
                              <p className="text-xs text-blue-300 mt-1 flex items-center gap-2 flex-wrap">
                                <CalendarBlank size={12} weight="bold" />
                                <span>
                                  {dataInicio} → {dataFim}
                                </span>
                                <span className="opacity-50">•</span>
                                <span>{canaisAgg.length} canais</span>
                                {topCanal && (
                                  <>
                                    <span className="opacity-50">•</span>
                                    <span>
                                      Top: <b>{CANAL_CONFIG[topCanal.canal]?.label || topCanal.canal}</b>{' '}
                                      ({formatBRLCompact(topCanal.invoice_value)})
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* ── DIREITA: stat cards de meta ── */}
                          {canaisComMeta.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 lg:gap-3 min-w-0 lg:min-w-[460px]">
                              {/* % MÉDIO MÊS */}
                              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3">
                                <p className="text-[10px] text-blue-200/80 uppercase tracking-wider font-medium mb-1">
                                  % Médio Mês
                                </p>
                                <p
                                  className={`text-2xl font-bold ${pctTextColor(pctMedio)}`}
                                >
                                  {pctMedio.toFixed(1)}%
                                </p>
                                <p className="text-[10px] text-blue-300/70 mt-0.5 truncate">
                                  R$ {formatBRLCompact(totalAtingidoMes)} / R${' '}
                                  {formatBRLCompact(totalMetasMes)}
                                </p>
                              </div>

                              {/* MELHOR % */}
                              {melhor && (
                                <div className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-400/20 rounded-lg p-3">
                                  <p className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                    <ArrowUp size={10} weight="bold" />
                                    Melhor
                                  </p>
                                  <p className="text-lg font-bold text-emerald-200 truncate">
                                    {CANAL_CONFIG[melhor.canal]?.label || melhor.canal}
                                  </p>
                                  <p
                                    className={`text-xs font-semibold ${pctTextColor(melhor.pct)}`}
                                  >
                                    {melhor.pct.toFixed(1)}% atingido
                                  </p>
                                </div>
                              )}

                              {/* PIOR % */}
                              {pior && pior !== melhor && (
                                <div className="bg-rose-500/10 backdrop-blur-sm border border-rose-400/20 rounded-lg p-3">
                                  <p className="text-[10px] text-rose-200/80 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                    <ArrowDown size={10} weight="bold" />
                                    Atenção
                                  </p>
                                  <p className="text-lg font-bold text-rose-200 truncate">
                                    {CANAL_CONFIG[pior.canal]?.label || pior.canal}
                                  </p>
                                  <p
                                    className={`text-xs font-semibold ${pctTextColor(pior.pct)}`}
                                  >
                                    {pior.pct.toFixed(1)}% atingido
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ════════════════ FATURAMENTO × META ════════════════ */}
                <Card className="mb-6">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Target size={20} className="text-blue-700" />
                        <h3 className="text-lg font-semibold text-gray-800">
                          Faturamento × Meta
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Seletores de período */}
                        <label className="text-xs text-gray-500 inline-flex items-center gap-1">
                          Mês:
                          <select
                            value={selectedMonthKey}
                            onChange={(e) => setSelectedMonthKey(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                          >
                            {monthOptions().map((o) => (
                              <option key={o.key} value={o.key}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-gray-500 inline-flex items-center gap-1">
                          Semana:
                          <select
                            value={selectedWeekKey}
                            onChange={(e) => setSelectedWeekKey(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                          >
                            {weekOptions().map((o) => (
                              <option key={o.key} value={o.key}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                        {(selectedWeekKey !== currentWeekKey() || selectedMonthKey !== currentMonthKey()) && (
                          <button
                            onClick={() => {
                              setSelectedWeekKey(currentWeekKey());
                              setSelectedMonthKey(currentMonthKey());
                            }}
                            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
                            title="Voltar para o período padrão (última semana completa / mês corrente)"
                          >
                            Hoje
                          </button>
                        )}
                        {metaData.loading && metaData.loaded && (
                          <span className="text-[11px] text-blue-600 inline-flex items-center gap-1">
                            <Spinner size={10} className="animate-spin" />
                            atualizando...
                          </span>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setShowPlanejamento(true)}
                            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
                            title="Cadastrar metas do mês inteiro (mensal + todas as semanas)"
                          >
                            <Target size={12} weight="bold" />
                            Planejar mês
                          </button>
                        )}
                        <button
                          onClick={() => setShowHistorico(true)}
                          className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
                          title="Histórico de alterações de metas"
                        >
                          <CalendarBlank size={12} />
                          Histórico
                        </button>
                        <button
                          onClick={() => loadMetaData(true)}
                          disabled={metaData.loading}
                          className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
                          title="Força atualização (ignora cache)"
                        >
                          <ArrowsClockwise size={12} />
                          {metaData.loading && !metaData.loaded
                            ? 'Carregando...'
                            : 'Atualizar'}
                        </button>
                      </div>
                    </div>
                    {!metaData.loaded && metaData.loading ? (
                      <p className="text-center text-sm text-gray-400 py-8">
                        Carregando metas...
                      </p>
                    ) : canaisMeta.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-8">
                        Nenhum canal com meta ou faturamento atual.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Canal
                              </th>
                              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Meta Semana
                              </th>
                              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Atingido Semana
                              </th>
                              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                % Sem
                              </th>
                              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Meta Mês
                              </th>
                              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Atingido Mês
                              </th>
                              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                % Mês
                              </th>
                              {isAdmin && <th className="py-2 px-3" />}
                            </tr>
                          </thead>
                          <tbody>
                            {canaisMeta.map((canal) => {
                              const cfg = CANAL_CONFIG[canal] || {};
                              const Icon = cfg.icon || Tag;
                              const metaS = metaData.metas.semanal[canal] || 0;
                              const metaM = metaData.metas.mensal[canal] || 0;
                              const fatS = metaData.fat.semanal[canal] || 0;
                              const fatM = metaData.fat.mensal[canal] || 0;
                              const pctS = metaS > 0 ? (fatS / metaS) * 100 : 0;
                              const pctM = metaM > 0 ? (fatM / metaM) * 100 : 0;
                              const justifS =
                                metaData.justificativas?.semanal?.[canal];
                              const justifM =
                                metaData.justificativas?.mensal?.[canal];
                              return (
                                <tr
                                  key={canal}
                                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-2.5 px-3 font-medium text-gray-800">
                                    <div className="inline-flex items-center gap-2">
                                      <Icon
                                        size={14}
                                        weight="bold"
                                        className={cfg.text || 'text-gray-600'}
                                      />
                                      {cfg.label || canal}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                                    {metaS > 0 ? `R$ ${formatBRL(metaS)}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                                    R$ {formatBRL(fatS)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums">
                                    {metaS > 0 ? (
                                      <div className="inline-flex items-center gap-1 justify-end">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctColor(pctS)}`}
                                        >
                                          {pctS.toFixed(1)}%
                                        </span>
                                        {pctS < 100 && justifS && (
                                          <span
                                            className="cursor-help text-amber-600"
                                            title={`Justificativa: ${justifS}`}
                                          >
                                            ℹ️
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                                    {metaM > 0 ? `R$ ${formatBRL(metaM)}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                                    R$ {formatBRL(fatM)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums">
                                    {metaM > 0 ? (
                                      <div className="inline-flex items-center gap-1 justify-end">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctColor(pctM)}`}
                                        >
                                          {pctM.toFixed(1)}%
                                        </span>
                                        {pctM < 100 && justifM && (
                                          <span
                                            className="cursor-help text-amber-600"
                                            title={`Justificativa: ${justifM}`}
                                          >
                                            ℹ️
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </td>
                                  {isAdmin && (
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        onClick={() =>
                                          setMetaEdit({
                                            canal,
                                            label: cfg.label || canal,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-xs"
                                        title="Editar metas"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            {(() => {
                              // Soma somente canais visíveis na tabela (evita
                              // duplicar showroom+novidades já contados em fabrica)
                              const sum = (period, kind) =>
                                canaisMeta.reduce(
                                  (s, c) =>
                                    s + Number(metaData[kind]?.[period]?.[c] || 0),
                                  0,
                                );
                              return (
                                <tr className="border-t-2 border-gray-300 bg-gray-50">
                                  <td className="py-2.5 px-3 font-bold text-gray-800">
                                    Total
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800">
                                    R$ {formatBRL(sum('semanal', 'metas'))}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800">
                                    R$ {formatBRL(sum('semanal', 'fat'))}
                                  </td>
                                  <td />
                                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800">
                                    R$ {formatBRL(sum('mensal', 'metas'))}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800">
                                    R$ {formatBRL(sum('mensal', 'fat'))}
                                  </td>
                                  <td />
                                  {isAdmin && <td />}
                                </tr>
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {!isAdmin && metaData.loaded && (
                      <p className="text-xs text-gray-400 mt-3">
                        Apenas administradores podem editar metas.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            {[
                              '#',
                              'Canal',
                              'Faturamento',
                              '% Total',
                              'NFs',
                              'Credev',
                              'TM',
                              'PA',
                              'PMPV',
                              'Participação',
                            ].map((h, i) => (
                              <th
                                key={h}
                                className={`py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                                  i <= 1
                                    ? 'text-left'
                                    : i === 9
                                      ? 'text-left'
                                      : 'text-right'
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {canaisAgg.map(
                            (
                              {
                                canal,
                                invoice_value,
                                invoice_qty,
                                credev_value,
                                itens_qty,
                                tm,
                                pa,
                                pmpv,
                                _viaTotvs,
                              },
                              idx,
                            ) => {
                              const cfg = CANAL_CONFIG[canal] || {
                                label: canal,
                                icon: ChartBar,
                                bar: 'bg-gray-400',
                                text: 'text-gray-600',
                                color: '#64748b',
                              };
                              const Icon = cfg.icon;
                              const pct =
                                totalGeral > 0
                                  ? (invoice_value / totalGeral) * 100
                                  : 0;
                              const barPct =
                                maxVal > 0 ? (invoice_value / maxVal) * 100 : 0;
                              return (
                                <tr
                                  key={canal}
                                  className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                                >
                                  <td className="py-3 px-3 text-xs text-gray-400 font-medium">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div
                                      className={`flex items-center gap-2 font-semibold text-sm ${cfg.text}`}
                                    >
                                      <Icon size={15} weight="duotone" />
                                      {cfg.label}
                                      {_viaTotvs && (
                                        <span className="text-[10px] font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                          TOTVS
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-semibold text-gray-800">
                                    R$ {formatBRL(invoice_value)}
                                  </td>
                                  <td className="py-3 px-3 text-right text-gray-600 text-xs">
                                    {pct.toFixed(1)}%
                                  </td>
                                  <td className="py-3 px-3 text-right text-gray-600 text-xs">
                                    {invoice_qty}
                                  </td>
                                  <td className="py-3 px-3 text-right text-xs">
                                    {credev_value > 0 ? (
                                      <span className="text-red-500">
                                        — R$ {formatBRL(credev_value)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right text-xs text-gray-700">
                                    {tm > 0
                                      ? `R$ ${formatBRLCompact(tm)}`
                                      : '—'}
                                  </td>
                                  <td className="py-3 px-3 text-right text-xs text-gray-700">
                                    {pa > 0 ? pa.toFixed(2) : '—'}
                                  </td>
                                  <td className="py-3 px-3 text-right text-xs text-gray-700">
                                    {pmpv > 0
                                      ? `R$ ${formatBRLCompact(pmpv)}`
                                      : '—'}
                                  </td>
                                  <td className="py-3 px-3 min-w-[120px]">
                                    <div className="relative h-5 bg-gray-100 rounded overflow-hidden">
                                      <div
                                        className={`absolute inset-y-0 left-0 ${cfg.bar} rounded transition-all duration-500`}
                                        style={{ width: `${barPct}%` }}
                                      />
                                      <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-semibold text-white z-10">
                                        {formatBRLCompact(invoice_value)}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                          <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                            <td className="py-3 px-3 text-gray-400" />
                            <td className="py-3 px-3 text-gray-700">Total</td>
                            <td className="py-3 px-3 text-right text-gray-900">
                              R$ {formatBRL(totalGeral)}
                            </td>
                            <td className="py-3 px-3 text-right text-gray-600 text-xs">
                              100%
                            </td>
                            <td className="py-3 px-3 text-right text-gray-700 text-xs">
                              {canaisAgg.reduce((s, c) => s + c.invoice_qty, 0)}
                            </td>
                            <td className="py-3 px-3 text-right text-xs">
                              {canaisAgg.reduce(
                                (s, c) => s + c.credev_value,
                                0,
                              ) > 0 ? (
                                <span className="text-red-500">
                                  — R${' '}
                                  {formatBRL(
                                    canaisAgg.reduce(
                                      (s, c) => s + c.credev_value,
                                      0,
                                    ),
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td colSpan={4} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}

        {aba === 'vendedores' && !rankingFat && !loadingVend && !erro && (
          <div className="text-center py-16 text-gray-400">
            <ChartBar size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione o período e clique em Buscar.</p>
          </div>
        )}

        {/* ╔═══════════════ ABA: MÉTRICAS DIÁRIAS ═══════════════╗ */}
        {/* Promessa Mensal + Semanal + Vendedores (B2R/B2M) + Comparativo Anual */}
        {aba === 'metricas-diarias' && (
          <div className="space-y-6">
            <PromessaMensal />
            <PromessaSemanal />
            <PromessaVendedores />
            <ComparativoAnual />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
            <Spinner size={24} className="animate-spin" />
            <span className="text-sm">Buscando faturamento...</span>
          </div>
        )}
      </div>

      {/* Modal de transações */}
      {modalCanal && (
        <ModalTransacoes
          canal={modalCanal}
          datemin={dataInicio}
          datemax={dataFim}
          onClose={() => setModalCanal(null)}
          custoAds={custoAds}
          custoWpp={custoWpp}
        />
      )}

      {/* Modal de edição de metas (admin) */}
      {metaEdit && (
        <MetaCanalEditModal
          canal={metaEdit.canal}
          label={metaEdit.label}
          metaSemana={metaData.metas.semanal[metaEdit.canal] || 0}
          metaMes={metaData.metas.mensal[metaEdit.canal] || 0}
          justifSemana={metaData.justificativas?.semanal?.[metaEdit.canal] || ''}
          justifMes={metaData.justificativas?.mensal?.[metaEdit.canal] || ''}
          fatSemana={metaData.fat.semanal[metaEdit.canal] || 0}
          fatMes={metaData.fat.mensal[metaEdit.canal] || 0}
          monthKey={metaData.monthKey || currentMonthKey()}
          weekKey={metaData.weekKey || currentWeekKey()}
          onSave={saveMeta}
          onClose={() => setMetaEdit(null)}
        />
      )}
      {showPlanejamento && (
        <PlanejamentoMensalModal
          monthKey={selectedMonthKey}
          userRole={userRole}
          userLogin={userLogin}
          onClose={() => setShowPlanejamento(false)}
          onSaved={() => loadMetaData(true)}
        />
      )}
      {showHistorico && (
        <HistoricoMetasModal onClose={() => setShowHistorico(false)} />
      )}
    </div>
  );
}

// ─── Modal de edição da meta por canal (admin) ────────────────────────
function MetaCanalEditModal({
  canal,
  label,
  metaSemana,
  metaMes,
  justifSemana,
  justifMes,
  fatSemana,
  fatMes,
  monthKey,
  weekKey,
  onSave,
  onClose,
}) {
  const [periodo, setPeriodo] = useState('mensal');
  const [valor, setValor] = useState(String(metaMes || ''));
  const [justif, setJustif] = useState(justifMes || '');

  useEffect(() => {
    if (periodo === 'mensal') {
      setValor(String(metaMes || ''));
      setJustif(justifMes || '');
    } else {
      setValor(String(metaSemana || ''));
      setJustif(justifSemana || '');
    }
  }, [periodo, metaMes, metaSemana, justifMes, justifSemana]);

  const currentVal = periodo === 'mensal' ? metaMes : metaSemana;
  const currentFat = periodo === 'mensal' ? fatMes : fatSemana;
  const periodKey = periodo === 'mensal' ? monthKey : weekKey;
  const metaNum = parseFloat(String(valor).replace(',', '.')) || 0;
  const pct = metaNum > 0 ? (currentFat / metaNum) * 100 : 0;
  const metaNaoAtingida = metaNum > 0 && pct < 100;

  const handleSave = (e) => {
    e?.preventDefault?.();
    const v = parseFloat(String(valor).replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) {
      alert('Valor inválido');
      return;
    }
    onSave(canal, periodo, v, justif.trim() || null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-blue-700" />
            <h3 className="font-semibold text-gray-800">
              Meta — {label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Período
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPeriodo('mensal')}
                className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition ${
                  periodo === 'mensal'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Mensal ({monthKey})
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('semanal')}
                className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition ${
                  periodo === 'semanal'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Última semana completa (segunda passada → domingo passado)"
              >
                Semanal ({weekKey})
                <div className="text-[10px] opacity-75 font-normal mt-0.5">
                  última semana completa
                </div>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Valor da meta (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 50000.00"
            />
            {currentVal > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Atual: R$ {formatBRL(currentVal)} ({periodKey})
              </p>
            )}
          </div>

          {/* Justificativa (visível sempre; destacada quando meta não atingida) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide flex items-center justify-between">
              <span>
                Justificativa
                <span className="text-gray-400 normal-case ml-1">
                  (caso meta não tenha sido atingida)
                </span>
              </span>
              {metaNum > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold ${
                    pct >= 100
                      ? 'bg-emerald-50 text-emerald-700'
                      : pct >= 70
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  Atingido: R$ {formatBRL(currentFat)} ({pct.toFixed(1)}%)
                </span>
              )}
            </label>
            <textarea
              value={justif}
              onChange={(e) => setJustif(e.target.value)}
              rows={3}
              maxLength={1000}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${
                metaNaoAtingida
                  ? 'border-amber-300 focus:ring-amber-500 bg-amber-50/30'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder={
                metaNaoAtingida
                  ? 'Por que a meta não foi atingida? (ex: feriado, campanha atrasada, falta de estoque...)'
                  : 'Justificativa opcional'
              }
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>
                {metaNaoAtingida && !justif.trim()
                  ? '⚠️ Meta abaixo de 100% — preencha a justificativa'
                  : ''}
              </span>
              <span>{justif.length}/1000</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-3 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
