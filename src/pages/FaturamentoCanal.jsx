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
  CaretRight,
  Trophy,
  WhatsappLogo,
  Phone,
} from 'phosphor-react';
import { Pencil, Target, Crown } from 'phosphor-react';
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
import useFreshFetch from '../hooks/useFreshFetch';
import { useAuth } from '../components/AuthContext';
import PromessaSemanal from '../components/forecast/PromessaSemanal';
import PromessaMensal from '../components/forecast/PromessaMensal';
import PromessaVendedores from '../components/forecast/PromessaVendedores';
import ComparativoAnual from '../components/forecast/ComparativoAnual';
import FaturamentoOntemCanal from '../components/forecast/FaturamentoOntemCanal';
import FaturamentoOntemVendedorLoja from '../components/forecast/FaturamentoOntemVendedorLoja';
import { supabase } from '../lib/supabase';
import VendedoresMensal from '../components/forecast/VendedoresMensal';
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

// YYYY-MM-DD em horário LOCAL (toISOString() devolveria o dia UTC, e antes das
// 03h BRT isso pula para o dia seguinte — atalhos "Hoje"/"Este mês" ficariam
// um dia adiantados).
function toLocalIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
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

// Lista todas as ISO weeks que têm ao menos 1 dia no mês informado (YYYY-MM).
// Retorna array de { key, datemin, datemax, ordemNoMes } ordenado cronologicamente.
// Converte chave ISO week (`2026-W23`) → chave de semana do mês (`2026-06-S1`)
// que é o formato usado no Planejamento Mensal Modal (semanas fixas 7 em 7 dias).
// Permite que a busca de meta semanal funcione mesmo com a nova classificação.
function isoWeekToMonthSemKey(weekKey) {
  const m = String(weekKey).match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return weekKey; // já não é ISO — devolve sem mudar
  const ano = Number(m[1]);
  const semana = Number(m[2]);
  // Segunda-feira da semana ISO `ano-Wsemana`
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const w1Mon = new Date(jan4);
  w1Mon.setUTCDate(jan4.getUTCDate() - (dow - 1));
  const monday = new Date(w1Mon);
  monday.setUTCDate(w1Mon.getUTCDate() + (semana - 1) * 7);
  const y = monday.getUTCFullYear();
  const mo = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  let s;
  if (d <= 7) s = 1;
  else if (d <= 14) s = 2;
  else if (d <= 21) s = 3;
  else if (d <= 28) s = 4;
  else s = 5;
  return `${y}-${String(mo).padStart(2, '0')}-S${s}`;
}

function weeksInMonth(monthKey) {
  const m = String(monthKey).match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return [];
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const firstDay = new Date(Date.UTC(ano, mes - 1, 1));
  const lastDay = new Date(Date.UTC(ano, mes, 0));
  const seen = new Set();
  const out = [];
  // Começa pela segunda-feira da semana que contém o 1º dia
  const dow = firstDay.getUTCDay() || 7;
  const monday = new Date(firstDay);
  monday.setUTCDate(firstDay.getUTCDate() - (dow - 1));
  // Pula semanas em incrementos de 7 dias enquanto a semana tocar o mês
  while (monday <= lastDay) {
    const sun = new Date(monday);
    sun.setUTCDate(monday.getUTCDate() + 6);
    // semana toca o mês se monday <= lastDay E sun >= firstDay
    if (monday <= lastDay && sun >= firstDay) {
      const ref = new Date(monday);
      // ISO week key referente à quinta-feira da semana
      const thu = new Date(ref);
      thu.setUTCDate(ref.getUTCDate() + 3);
      const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((thu - yearStart) / 86400000 + 1) / 7);
      const key = `${thu.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
        const fmt = (d) => d.toISOString().slice(0, 10);
        out.push({
          key,
          datemin: fmt(monday),
          datemax: fmt(sun),
        });
      }
    }
    monday.setUTCDate(monday.getUTCDate() + 7);
  }
  out.forEach((w, i) => (w.ordemNoMes = i + 1));
  return out;
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
  const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const out = [];
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  for (let i = before; i >= -after; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let label = `${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}`;
    if (key === curKey) label += ' (atual)';
    else if (key === lastKey) label += ' (passado)';
    out.push({ key, label });
  }
  return out;
}

// Calcula a key do mês anterior ao atual (YYYY-MM).
function lastMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
  // ── Credev overrides (admin) ──
  const [overrides, setOverrides] = useState([]); // overrides ativos
  const [credevModal, setCredevModal] = useState(null); // { tx } — NF para confirmar
  const [credevMotivo, setCredevMotivo] = useState('');
  const [credevSaving, setCredevSaving] = useState(false);
  const { run: runDados, isStale: isStaleDados } = useFreshFetch();

  useEffect(() => {
    const API_KEY = import.meta.env.VITE_API_KEY || '';
    const tok = runDados();
    setLoadingTx(true);
    fetch(API_BASE_URL + '/api/crm/transacoes-canal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ canal, datemin, datemax }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (isStaleDados(tok)) return;
        setDados(j.data ?? j);
      })
      .catch(() => {
        if (isStaleDados(tok)) return;
        setDados(null);
      })
      .finally(() => {
        if (!isStaleDados(tok)) setLoadingTx(false);
      });
  }, [canal, datemin, datemax, runDados, isStaleDados]);

  // Carrega overrides ativos do canal atual
  const carregarOverrides = useCallback(() => {
    fetch(`${API_BASE_URL}/api/forecast/credev-overrides?canal=${canal}`)
      .then((r) => r.json())
      .then((j) => setOverrides(j?.data?.overrides || []))
      .catch(() => setOverrides([]));
  }, [canal]);

  useEffect(() => {
    carregarOverrides();
  }, [carregarOverrides]);

  // Lookup rápido por branch|transaction
  const overrideByKey = useMemo(() => {
    const m = new Map();
    for (const o of overrides) {
      if (o.ativo) m.set(`${o.branch_code}|${o.transaction_code}`, o);
    }
    return m;
  }, [overrides]);

  const isOverridden = (tx) =>
    overrideByKey.has(`${tx.branch_code}|${tx.transaction_code}`);

  const abrirCredevModal = (tx) => {
    setCredevModal(tx);
    setCredevMotivo('');
  };

  const confirmarCredevOverride = async () => {
    if (!credevModal) return;
    if (credevMotivo.trim().length < 3) {
      alert('Informe o motivo (mínimo 3 caracteres)');
      return;
    }
    setCredevSaving(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/forecast/credev-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_code: credevModal.branch_code,
          transaction_code: credevModal.transaction_code,
          invoice_code: credevModal.invoice_code,
          issue_date: credevModal.issue_date,
          canal,
          credev_amount: credevModal.credev_amount,
          motivo: credevMotivo.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        alert(j?.message || 'Erro');
      } else {
        setCredevModal(null);
        setCredevMotivo('');
        carregarOverrides();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setCredevSaving(false);
    }
  };

  const reverterOverride = async (tx) => {
    const ov = overrideByKey.get(`${tx.branch_code}|${tx.transaction_code}`);
    if (!ov) return;
    if (!confirm('Voltar a subtrair o credev desta NF?')) return;
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/forecast/credev-overrides/${ov.id}`,
        { method: 'DELETE' },
      );
      const j = await r.json();
      if (!r.ok || !j?.success) alert(j?.message || 'Erro');
      else carregarOverrides();
    } catch (e) {
      alert(e.message);
    }
  };

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
      Number(t.total_value || 0).toFixed(2).replace('.', ','),
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
                  ? Number(wppCanal.costBRL ?? ((wppCanal.cost ?? 0) * 5.8))
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
                        {(() => {
                          const ov = t.credev_amount > 0 && isOverridden(t);
                          // Se override ativo: mostra valor BRUTO (que vai ser
                          // contabilizado como faturamento). Senão: total_value (líquido).
                          const valorMostrado = ov ? t.total_bruto : t.total_value;
                          return (
                            <>
                              R$ {formatBRL(valorMostrado)}
                              {t.credev_amount > 0 && !ov && (
                                <div className="text-[10px] text-orange-500 font-normal">
                                  bruto R$ {formatBRL(t.total_bruto)}
                                </div>
                              )}
                              {ov && (
                                <div className="text-[10px] text-emerald-600 font-medium">
                                  credev desconsiderado
                                </div>
                              )}
                              {t.credev_amount > 0 && (
                                <div className="mt-1">
                                  {ov ? (
                                    <button
                                      onClick={() => reverterOverride(t)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 hover:bg-rose-100 text-emerald-700 hover:text-rose-700 border border-emerald-200 hover:border-rose-300 transition-colors"
                                      title="Voltar a subtrair credev"
                                    >
                                      ✓ Contado · desfazer
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => abrirCredevModal(t)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                                      title="Contar como faturamento (desconsiderar credev)"
                                    >
                                      + Contar como faturamento
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
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
                        (s, t) => s + Number(t.total_value || 0),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Mini-modal: confirmar override de credev */}
        {credevModal && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !credevSaving && setCredevModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-base font-bold text-gray-800 mb-2">
                Contar credev como faturamento?
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                O valor bruto desta NF passa a contar 100% como faturamento do canal.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-0.5">
                <div><strong>NF:</strong> {credevModal.invoice_code} · <strong>Cliente:</strong> {credevModal.person_name}</div>
                <div><strong>Bruto:</strong> R$ {formatBRL(credevModal.total_bruto)} · <strong>Credev:</strong> <span className="text-emerald-700 font-bold">R$ {formatBRL(credevModal.credev_amount)}</span></div>
              </div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Motivo (obrigatório)
              </label>
              <textarea
                value={credevMotivo}
                onChange={(e) => setCredevMotivo(e.target.value)}
                rows={3}
                placeholder="Ex.: troca não deve afetar faturamento — cliente trouxe item antigo"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setCredevModal(null); setCredevMotivo(''); }}
                  disabled={credevSaving}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarCredevOverride}
                  disabled={credevSaving || credevMotivo.trim().length < 3}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  {credevSaving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Drill-down do canal: mostra per_branch (varejo) ou per_seller (outros)
// dentro da tabela Faturamento × Meta quando o usuário clica na linha.
// ═══════════════════════════════════════════════════════════════════
function CanalDrillDown({ canal, cfg, periodo, setPeriodo, data, formatBRL, monthKey }) {
  const Icon = cfg?.icon || ChartBar;
  const isVarejo = canal === 'varejo';
  const lista = isVarejo ? data?.per_branch : data?.per_seller;

  // Metas por loja — puxa de metas_mensais_calculadas (cada linha tem
  // bronze/prata/ouro/diamante já como números). Fallback: se monthKey atual
  // não tiver, usa o mais recente disponível (≤ monthKey). Tier OURO é o
  // padrão para o cálculo de % Meta.
  const [metasLojas, setMetasLojas] = React.useState({});
  const [metasMesUsado, setMetasMesUsado] = React.useState(null);
  React.useEffect(() => {
    if (!isVarejo || !monthKey) return;
    let cancelado = false;
    (async () => {
      // Primeiro tenta o mês exato
      let { data: rows } = await supabase
        .from('metas_mensais_calculadas')
        .select('nome, bronze, prata, ouro, diamante, mes')
        .eq('tipo', 'lojas')
        .eq('mes', monthKey);

      // Fallback: pega o mais recente ≤ monthKey
      if (!rows || rows.length === 0) {
        const { data: maisRecente } = await supabase
          .from('metas_mensais_calculadas')
          .select('mes')
          .eq('tipo', 'lojas')
          .lte('mes', monthKey)
          .order('mes', { ascending: false })
          .limit(1);
        const mesFb = maisRecente?.[0]?.mes;
        if (mesFb) {
          const r = await supabase
            .from('metas_mensais_calculadas')
            .select('nome, bronze, prata, ouro, diamante, mes')
            .eq('tipo', 'lojas')
            .eq('mes', mesFb);
          rows = r.data || [];
        }
      }
      if (cancelado) return;

      const map = {};
      let mesEfetivo = null;
      for (const r of rows || []) {
        const k = String(r.nome || '').toUpperCase().trim();
        map[k] = {
          bronze: Number(r.bronze || 0),
          prata: Number(r.prata || 0),
          ouro: Number(r.ouro || 0),
          diamante: Number(r.diamante || 0),
        };
        mesEfetivo = r.mes;
      }
      setMetasLojas(map);
      setMetasMesUsado(mesEfetivo);
    })();
    return () => { cancelado = true; };
  }, [isVarejo, monthKey]);
  const getMetaLoja = (nome) => {
    const k = String(nome || '').toUpperCase().trim();
    return metasLojas[k] || null;
  };
  // ── Multiplicador de meta por período ──
  // Semana corrente do mês (1-5) baseado em hoje.
  // Distribuição varejo: S1=22.4%, S2=32%, S3=22.8%, S4=22.8%, S5=0%.
  const VAREJO_DIST_SEM = { 1: 0.224, 2: 0.32, 3: 0.228, 4: 0.228, 5: 0 };
  const semanaCorrenteNoMes = (() => {
    const hoje = new Date();
    const d = hoje.getDate();
    if (d <= 7) return 1;
    if (d <= 14) return 2;
    if (d <= 21) return 3;
    if (d <= 28) return 4;
    return 5;
  })();
  const metaMultiplier = (() => {
    if (periodo === 'semanal') {
      return VAREJO_DIST_SEM[semanaCorrenteNoMes] ?? 0;
    }
    if (periodo === 'anual') return 12; // aproximação: meta mensal × 12 meses
    return 1; // mensal
  })();
  // Calcula meta ajustada pro período (Bronze/Prata/Ouro/Diamante × multiplicador).
  const ajustarMetaPeriodo = (m) => {
    if (!m) return null;
    if (metaMultiplier === 0) return null; // S5 (sem meta semanal)
    return {
      bronze: (m.bronze || 0) * metaMultiplier,
      prata: (m.prata || 0) * metaMultiplier,
      ouro: (m.ouro || 0) * metaMultiplier,
      diamante: (m.diamante || 0) * metaMultiplier,
    };
  };
  const tierAtingido = (valor, m) => {
    if (!m) return null;
    if (m.diamante > 0 && valor >= m.diamante) return { nome: 'Diamante', cor: 'text-cyan-700 bg-cyan-50 ring-cyan-200' };
    if (m.ouro > 0 && valor >= m.ouro)         return { nome: 'Ouro',     cor: 'text-amber-700 bg-amber-50 ring-amber-200' };
    if (m.prata > 0 && valor >= m.prata)       return { nome: 'Prata',    cor: 'text-slate-600 bg-slate-50 ring-slate-200' };
    if (m.bronze > 0 && valor >= m.bronze)     return { nome: 'Bronze',   cor: 'text-orange-700 bg-orange-50 ring-orange-200' };
    return null;
  };
  const totalValor = (lista || []).reduce((s, x) => s + Number(x.invoice_value || 0), 0);
  const ticketTotal = (lista || []).reduce((s, x) => s + Number(x.invoice_qty || 0), 0);
  const top1 = lista?.[0];

  const formatCompact = (v) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${formatBRL(v)}`;
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Header com gradiente */}
      <div
        className="relative px-5 py-4 border-b border-gray-200 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cfg?.color || '#64748b'}14, ${cfg?.color || '#64748b'}05)`,
        }}
      >
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${cfg?.color || '#64748b'}25` }}
            >
              <Icon size={18} weight="duotone" className={cfg?.text || 'text-gray-700'} />
            </div>
            <div>
              <h4 className={`font-bold text-base ${cfg?.text || 'text-gray-800'} leading-tight`}>
                {isVarejo ? 'Performance por Loja' : 'Performance por Vendedor'}
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                <span>{(lista?.length || 0)} {isVarejo ? 'lojas' : 'vendedores'}</span>
                <span className="opacity-40">•</span>
                <span>{ticketTotal} NFs</span>
                <span className="opacity-40">•</span>
                <span>
                  Total <strong className="text-gray-700">R$ {formatBRL(totalValor)}</strong>
                </span>
              </p>
            </div>
          </div>
          <div className="inline-flex bg-white rounded-xl border border-gray-200 p-0.5 shadow-sm">
            <button
              onClick={() => setPeriodo('semanal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodo === 'semanal'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriodo('mensal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodo === 'mensal'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => setPeriodo('anual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodo === 'anual'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Ano
            </button>
          </div>
        </div>
      </div>

      {/* TOP-1 destaque (quando há dados) */}
      {top1 && lista.length > 1 && (
        <div
          className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap"
          style={{
            background: `linear-gradient(90deg, ${cfg?.color || '#64748b'}08 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm">
              <Trophy size={14} weight="fill" className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
              Top 1
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">
              {isVarejo ? top1.branch_name : top1.seller_name || `Vendedor ${top1.seller_code}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Faturamento</p>
              <p className={`text-base font-bold ${cfg?.text || 'text-gray-800'}`}>
                R$ {formatBRL(top1.invoice_value || 0)}
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">% do canal</p>
              <p className="text-base font-bold text-gray-800">
                {totalValor > 0
                  ? `${((Number(top1.invoice_value || 0) / totalValor) * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="px-4 py-3">
        {!data || data.loading ? (
          <div className="py-8 text-center text-xs text-gray-400 inline-flex items-center gap-2 justify-center w-full">
            <Spinner size={14} className="animate-spin" />
            Carregando breakdown...
          </div>
        ) : !lista || lista.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-gray-400 mb-2">
              Sem {isVarejo ? 'vendas em lojas' : 'vendas de vendedores'} no período.
            </p>
            {periodo === 'semanal' && (
              <button
                onClick={() => setPeriodo('mensal')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <CalendarBlank size={12} weight="bold" />
                Ver o mês inteiro
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 px-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-10">
                    Pos
                  </th>
                  <th className="py-2 px-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {isVarejo ? 'Loja' : 'Vendedor'}
                  </th>
                  <th className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Faturamento
                  </th>
                  <th className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    NFs
                  </th>
                  <th className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    TM
                  </th>
                  <th className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    PA
                  </th>
                  {isVarejo && (
                    <>
                      <th
                        className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell"
                        title={metasMesUsado && metasMesUsado !== monthKey
                          ? `Meta de ${metasMesUsado} (mês atual ${monthKey} sem cadastro — fallback)`
                          : `Meta de ${monthKey || 'mês atual'}`}
                      >
                        Meta <span className="text-amber-600">Bronze +20%</span>
                        {periodo === 'semanal' && (
                          <span className="ml-1 text-[8px] font-normal text-blue-600 normal-case">
                            (sem)
                          </span>
                        )}
                        {periodo === 'anual' && (
                          <span className="ml-1 text-[8px] font-normal text-blue-600 normal-case">
                            (ano)
                          </span>
                        )}
                        {metasMesUsado && metasMesUsado !== monthKey && (
                          <span className="ml-1 text-[8px] font-normal text-amber-600 normal-case">
                            ({metasMesUsado})
                          </span>
                        )}
                      </th>
                      <th className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[90px]">
                        % Meta
                      </th>
                    </>
                  )}
                  <th className="py-2 px-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[110px]">
                    Distribuição
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((row, idx) => {
                  const valor = Number(row.invoice_value || 0);
                  const pct = totalValor > 0 ? (valor / totalValor) * 100 : 0;
                  const code = isVarejo ? row.branch_code : row.seller_code;
                  const name = isVarejo
                    ? row.branch_name
                    : row.seller_name || `Vendedor ${row.seller_code}`;
                  const isTop3 = idx < 3;
                  const medalhas = ['🥇', '🥈', '🥉'];
                  return (
                    <tr
                      key={code}
                      className={`border-b border-gray-50 last:border-0 transition-colors group ${
                        idx === 0 ? 'bg-amber-50/30' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="py-2 px-2">
                        {isTop3 ? (
                          <span className="text-lg leading-none">{medalhas[idx]}</span>
                        ) : (
                          <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 font-mono">
                            {idx + 1}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-700 max-w-[280px]">
                        <p
                          className={`truncate ${isTop3 ? 'font-bold text-gray-900' : 'font-semibold'}`}
                        >
                          {name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">#{code}</p>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <p
                          className={`tabular-nums font-bold ${isTop3 ? 'text-gray-900' : 'text-gray-800'} ${isTop3 ? 'text-sm' : ''}`}
                        >
                          R$ {formatBRL(valor)}
                        </p>
                      </td>
                      <td className="py-2 px-2 text-right text-gray-600 tabular-nums hidden md:table-cell">
                        {row.invoice_qty || 0}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">
                        <span className="text-blue-700 font-medium">
                          R$ {formatBRL(row.tm || 0)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums hidden lg:table-cell">
                        <span className="text-purple-700 font-medium">
                          {(row.pa || 0).toFixed(2)}
                        </span>
                      </td>
                      {isVarejo && (() => {
                        const mBase = getMetaLoja(row.branch_name);
                        const mAjustada = ajustarMetaPeriodo(mBase);
                        // Meta de cobrança = Bronze + 20% (regra do gestor).
                        // Usa Bronze × 1.20 — coincide com Prata, mas explícita.
                        const metaBronze = mAjustada?.bronze || 0;
                        const metaAlvo = metaBronze * 1.20;
                        const pctMeta = metaAlvo > 0 ? (valor / metaAlvo) * 100 : 0;
                        const tier = tierAtingido(valor, mAjustada);
                        const corPct =
                          pctMeta >= 100 ? 'text-emerald-700 bg-emerald-50' :
                          pctMeta >= 70  ? 'text-amber-700 bg-amber-50' :
                          pctMeta > 0    ? 'text-rose-700 bg-rose-50' :
                          'text-gray-400 bg-gray-50';
                        // Sufixo do título da meta varia por período
                        const sufixoMeta = periodo === 'semanal'
                          ? ` (S${semanaCorrenteNoMes} · ${(VAREJO_DIST_SEM[semanaCorrenteNoMes] * 100).toFixed(1)}% do mês)`
                          : periodo === 'anual'
                            ? ' (mensal × 12)'
                            : '';
                        return (
                          <>
                            <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell" title={`Meta Bronze + 20%${sufixoMeta}`}>
                              {metaAlvo > 0
                                ? <span className="text-amber-700 font-medium">R$ {formatBRL(metaAlvo)}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums ${corPct}`}>
                                  {metaAlvo > 0 ? `${pctMeta.toFixed(1)}%` : '—'}
                                </span>
                                {tier && (
                                  <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 ${tier.cor}`}>
                                    {tier.nome}
                                  </span>
                                )}
                              </div>
                            </td>
                          </>
                        );
                      })()}
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-gray-700 font-bold tabular-nums w-10 text-right text-xs">
                            {pct.toFixed(1)}%
                          </span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${cfg?.bar || 'bg-blue-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

// ─── Componente: card BlueCred (clientes classificados como BLUE CRED no TOTVS) ──
const BlueCredCard = React.memo(function BlueCredCard({ stats }) {
  const total = stats?.total ?? null;
  const noPeriodo = stats?.no_periodo ?? null;

  return (
    <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2 text-cyan-700 font-semibold text-sm">
          <CreditCard size={18} weight="duotone" />
          BlueCred
        </div>
        <span className="text-[9px] text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
          classificados
        </span>
      </div>
      {total === null ? (
        <div className="text-2xl font-bold text-gray-300 leading-tight">
          —
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-800 leading-tight">
            {Number(total).toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-gray-500">
            {total === 1 ? 'cliente classificado' : 'clientes classificados'}
          </div>
          {noPeriodo != null && noPeriodo > 0 && (
            <div className="text-[10px] text-cyan-700 font-medium mt-1">
              +{noPeriodo} no período
            </div>
          )}
        </>
      )}
    </div>
  );
});

// ─── Componente: card BlueCard (envios via ClickUp) ─────────────────────────
const BlueCardCard = React.memo(function BlueCardCard({ count }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
          <CreditCard size={18} weight="duotone" />
          BlueCard
        </div>
        <span className="text-[9px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
          enviados
        </span>
      </div>
      {count === null ? (
        <div className="text-2xl font-bold text-gray-300 leading-tight">
          —
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-800 leading-tight">
            {Number(count).toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-gray-500">
            {count === 1 ? 'cartão enviado' : 'cartões enviados'}
          </div>
          <div className="text-[10px] text-indigo-600/70 font-medium mt-1">
            via ClickUp
          </div>
        </>
      )}
    </div>
  );
});

// ─── Modal: gasto WhatsApp por número/conta ─────────────────────────────────
const ModalWhatsappPorNumero = React.memo(function ModalWhatsappPorNumero({
  custoWpp,
  dataInicio,
  dataFim,
  onClose,
}) {
  const accounts = Array.isArray(custoWpp?.accounts) ? custoWpp.accounts : [];
  const wabas = Array.isArray(custoWpp?.wabas) ? custoWpp.wabas : [];

  // Como uma WABA pode ter múltiplos phone_ids, o custo é por WABA.
  // Agrupamos accounts por waba_id, mostramos cada conta com o custo da WABA
  // dividido (informativo) ou rateado.
  // Mostra: nome da conta, telefone, canal, custo da WABA, % do total, volume.
  const totalCost = wabas.reduce((s, w) => s + (w.totalCostBRL || 0), 0);
  const totalVol = wabas.reduce((s, w) => s + (w.totalVolume || 0), 0);

  // Constrói linhas: 1 linha por (waba) com os phones agrupados
  const rows = wabas
    .map((w) => {
      const phones = accounts.filter((a) => a.waba_id === w.waba_id);
      return {
        waba_id: w.waba_id,
        name: w.name,
        phones,
        cost: w.totalCostBRL || 0,
        volume: w.totalVolume || 0,
        pct: totalCost > 0 ? ((w.totalCostBRL || 0) / totalCost) * 100 : 0,
        byPricingCategory: w.byPricingCategory || {},
        error: w.error || null,
      };
    })
    .sort((a, b) => b.cost - a.cost);

  const canalLabel = {
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
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-50">
              <WhatsappLogo size={18} weight="fill" className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#000638]">
                Gasto WhatsApp API por número
              </h2>
              <p className="text-[10px] text-gray-500">
                {dataInicio} → {dataFim} • {rows.length} conta
                {rows.length !== 1 ? 's' : ''} • Total:{' '}
                <b>R$ {formatBRL(totalCost)}</b> ·{' '}
                {Number(totalVol).toLocaleString('pt-BR')} conversas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-3">
          {rows.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">
              Nenhuma conta com dados no período.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="py-2 px-2 text-left">#</th>
                  <th className="py-2 px-2 text-left">Conta / Telefone</th>
                  <th className="py-2 px-2 text-left">Canal</th>
                  <th className="py-2 px-2 text-right">Conversas</th>
                  <th className="py-2 px-2 text-right">Custo (R$)</th>
                  <th className="py-2 px-2 text-right">% Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.waba_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-2 text-gray-400 font-medium tabular-nums align-top">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2 align-top">
                      <div className="font-semibold text-[#000638] text-xs">
                        {row.name}
                      </div>
                      {row.phones.map((p) => (
                        <div
                          key={p.accountId}
                          className="flex items-center gap-1 text-[11px] text-gray-500"
                        >
                          <Phone size={10} />
                          {p.nr_telefone || '—'}
                        </div>
                      ))}
                      {row.error && (
                        <div className="text-[10px] text-red-500 mt-0.5">
                          ⚠ {row.error}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 align-top">
                      {(() => {
                        const canais = [
                          ...new Set(
                            row.phones
                              .map((p) => p.canal_venda)
                              .filter(Boolean),
                          ),
                        ];
                        if (canais.length === 0)
                          return (
                            <span className="text-[10px] text-gray-400 italic">
                              sem canal
                            </span>
                          );
                        return canais.map((c) => (
                          <span
                            key={c}
                            className="inline-block bg-blue-50 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1"
                          >
                            {canalLabel[c] || c}
                          </span>
                        ));
                      })()}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums align-top">
                      {Number(row.volume).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-bold text-yellow-700 align-top">
                      R$ {formatBRL(row.cost)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-600 align-top">
                      {row.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-[#000638] bg-gray-50">
                  <td className="py-2 px-2" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {Number(totalVol).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-yellow-700">
                    R$ {formatBRL(totalCost)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">100%</td>
                </tr>
              </tfoot>
            </table>
          )}
          <p className="text-[10px] text-gray-400 mt-3 italic">
            💡 Custo é cobrado <strong>por WABA</strong> (não por número). Quando
            há vários números na mesma WABA, eles compartilham o custo total.
          </p>
        </div>
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
  const defaultFim = toLocalIso(hoje);
  const defaultInicio = toLocalIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

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
  const [bluecredStats, setBluecredStats] = useState(null); // BlueCred (Autentique): { total, por_status }
  const [bluecardCount, setBluecardCount] = useState(null); // BlueCard (ClickUp): número de enviados
  const [modalWppDetail, setModalWppDetail] = useState(false); // modal gasto WhatsApp por número
  const [clientesCanal, setClientesCanal] = useState(null); // { varejo: {ativos, novos}, ... }
  const [modalClientesCanal, setModalClientesCanal] = useState(false);
  const [modalRecompraCanal, setModalRecompraCanal] = useState(null); // {canal, label} ou null
  const [recompraCanal, setRecompraCanal] = useState({}); // cache: canal -> resposta
  const [loadingRecompra, setLoadingRecompra] = useState(false);
  const [abaRecompra, setAbaRecompra] = useState('breakdown'); // 'breakdown' | 'clientes'
  const [clientesCanalDetalhe, setClientesCanalDetalhe] = useState({}); // cache: canal -> {clientes, ...}
  const [loadingClientesDetalhe, setLoadingClientesDetalhe] = useState(false);
  const [filtroStatusCliente, setFiltroStatusCliente] = useState('todos'); // 'todos' | 'novos' | 'recorrentes'
  const [vendedorExpandido, setVendedorExpandido] = useState(null); // key do vendedor expandido na aba breakdown
  const [modalROI, setModalROI] = useState(false);
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
  // Acumulado de faltante das semanas anteriores no mês selecionado
  // Estrutura: { [canal]: { faltante, breakdown: [{ weekKey, meta, fat, faltante }] } }
  const [acumuladoFaltante, setAcumuladoFaltante] = useState({});
  const [loadingAcumulado, setLoadingAcumulado] = useState(false);
  // Linha de canal expandida (drill-down) na tabela Faturamento × Meta
  // Estrutura: { canal, periodo: 'semanal'|'mensal' } | null
  const [canalExpandido, setCanalExpandido] = useState(null);
  // Cache do breakdown por canal+período: { 'varejo|semanal': { per_branch, per_seller, loading } }
  const [breakdownCache, setBreakdownCache] = useState({});
  // Coalescing: in-flight Promise per cacheKey → evita fetches duplicados quando
  // usuário troca rapidamente entre semana/mês no drill-down. Sem isso, vários
  // setState concorrentes podem deixar o "Carregando…" travado.
  const breakdownInflightRef = useRef(new Map());
  // AbortController refs — cancela fetches anteriores quando muda período
  const loadMetaAbortRef = useRef(null);
  const loadAcumAbortRef = useRef(null);
  // Token para deduplicar fetches concorrentes (incrementa a cada call)
  const loadMetaTokenRef = useRef(0);
  // Período selecionado pra exibir/editar metas (default = última semana completa / mês corrente)
  const [selectedWeekKey, setSelectedWeekKey] = useState(() => currentWeekKey());
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => currentMonthKey());

  const anoAtual = dataInicio
    ? new Date(dataInicio + 'T00:00:00').getFullYear()
    : hoje.getFullYear();
  const anoAnterior = anoAtual - 1;

  const subtrairUmAno = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    d.setFullYear(d.getFullYear() - 1);
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Anti-race tokens — cada função async com setState próprio recebe um token.
  // loadMetaData/loadAcumuladoFaltante já têm proteção manual via refs próprios.
  const fetchBuscar = useFreshFetch();           // setResultado/setCustoWpp/setCustoAds/setBluecredStats/setBluecardCount
  const fetchVendedores = useFreshFetch();       // setRankingFat/setVendedores
  const fetchPagamento = useFreshFetch();        // setPagamento
  const fetchComparativo = useFreshFetch();      // setComp

  const buscar = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    const tok = fetchBuscar.run();
    setErro('');
    setErroMeta(null);
    setCustoWpp(null);
    setCustoAds(null);
    setBluecredStats(null);
    setBluecardCount(null);
    setClientesCanal(null);

    // Clientes ativos + novos por canal (paralelo, leve)
    fetch(`${API_BASE_URL}/api/crm/clientes-por-canal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datemin: dataInicio, datemax: dataFim }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (fetchBuscar.isStale(tok)) return;
        if (j?.success) setClientesCanal(j.data);
      })
      .catch(() => setClientesCanal(null));

    // BlueCred — clientes classificados como BLUE CRED no TOTVS
    // (typeCode=55 / code='8'). Lê de pessoas_bluecred (Supabase).
    fetch(
      `${API_BASE_URL}/api/forecast/bluecred-count?datemin=${dataInicio}&datemax=${dataFim}`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (fetchBuscar.isStale(tok)) return;
        if (j?.success && j.data) {
          setBluecredStats({
            total: j.data.total || 0,
            no_periodo: j.data.no_periodo,
          });
        }
      })
      .catch((err) =>
        console.warn('[FaturamentoCanal] BlueCred classificação count falhou:', err.message),
      );
    // BlueCard count (ClickUp) em background — não bloqueia
    fetch(
      `${API_BASE_URL}/api/forecast/bluecard-count?datemin=${dataInicio}&datemax=${dataFim}`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (fetchBuscar.isStale(tok)) return;
        if (j?.success && typeof j.data?.count === 'number') {
          setBluecardCount(j.data.count);
        }
      })
      .catch((err) =>
        console.warn('[FaturamentoCanal] BlueCard count falhou:', err.message),
      );

    // Stale-while-revalidate: mostra cache local imediatamente, busca fresco em background
    // v9: bumped pra invalidar caches stale que estavam mostrando só 6 canais
    //     (faltava franquia/showroom/bazar/novidades — backend já retorna todos).
    const cacheKey = `fatseg:v10:${dataInicio}:${dataFim}`;
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

    // Busca o faturamento principal via canais-totals-all (cache Supabase,
    // resposta instantânea). Mantém formato compatível com setResultado.
    // Antes usava /faturamento-por-segmento (TOTVS direto), mas é lento.
    try {
      const res = await apiPost('/api/crm/canais-totals-all?lite=true', {
        datemin: dataInicio,
        datemax: dataFim,
        lite: true,
      });
      if (fetchBuscar.isStale(tok)) return;
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
        // Limpa caches de versões antigas — mantém só v8
        Object.keys(localStorage)
          .filter((k) => k.startsWith('fatseg:') && !k.startsWith('fatseg:v10:'))
          .forEach((k) => localStorage.removeItem(k));
        const allKeys = Object.keys(localStorage).filter((k) =>
          k.startsWith('fatseg:v10:'),
        );
        if (allKeys.length > 8) {
          allKeys.slice(0, allKeys.length - 8).forEach((k) => localStorage.removeItem(k));
        }
      } catch {}
    } catch (e) {
      if (fetchBuscar.isStale(tok)) return;
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
      if (!fetchBuscar.isStale(tok)) {
        setLoading(false);
        setRevalidating(false);
      }
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
      if (fetchBuscar.isStale(tok)) return;
      const metaErros = [];
      if (wpp.status === 'fulfilled') {
        // Inclui by_canal pra mostrar quebra por canal + accounts/wabas pro modal de detalhe
        const t = wpp.value?.totals ?? null;
        if (t) {
          setCustoWpp({
            ...t,
            by_canal: wpp.value?.by_canal || {},
            accounts: wpp.value?.accounts || [],
            wabas: wpp.value?.wabas || [],
          });
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
  }, [dataInicio, dataFim, fetchBuscar]);

  // ─── Carrega metas + faturamento atual (semana + mês corrente) ────────
  // Estratégia: stale-while-revalidate. Cache local de FAT (parte pesada) com
  // TTL 5 min. Metas (parte leve) sempre busca fresh (admin pode editar).
  const loadMetaData = useCallback(async (forceRefresh = false) => {
    // Usa períodos SELECIONADOS pelo usuário (selectedWeekKey / selectedMonthKey)
    // Default: última semana completa + mês corrente
    const monthKey = selectedMonthKey || currentMonthKey();
    const weekKey = selectedWeekKey || currentWeekKey();

    // Cada call ganha um token único. Se outro call começar antes deste terminar,
    // este token fica "stale" e descartamos o resultado para evitar race condition.
    loadMetaTokenRef.current += 1;
    const myToken = loadMetaTokenRef.current;
    const isStale = () => myToken !== loadMetaTokenRef.current;

    // monthRange: 1º dia do mês até hoje (se for mês corrente) ou último dia
    const [mY, mM] = monthKey.split('-').map(Number);
    const todayIso = toLocalIso(new Date());
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

    const fatCacheKey = `fmetas-fat:v4-rev:${monthKey}:${weekKey}`;
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
      // Anti race-condition: descarta resultado se outro fetch foi disparado depois
      if (isStale()) return;
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
      // ── Override Varejo: meta semanal = meta mensal × % da semana ──────
      // Distribuição: S1=22.4% · S2=32% · S3=22.8% · S4=22.8% · S5=0%
      // Sobrescreve qualquer valor cadastrado em forecast_canal_metas.
      // IMPORTANTE: a posição da semana (S1-S5) é relativa ao MÊS SELECIONADO,
      // não ao mês da segunda-feira da ISO week — caso contrário a semana de
      // virada (ex: 30/jun-06/jul com monthKey=julho) pegaria 0% (S5 de junho)
      // em vez de 22.4% (S1 de julho).
      const VAREJO_DIST_SEM = { 1: 0.224, 2: 0.32, 3: 0.228, 4: 0.228, 5: 0 };
      const semNumNoMesSelecionado = (() => {
        const r = weekKeyRange(weekKey);
        if (!r) return null;
        const [mY, mM] = String(monthKey).split('-').map(Number);
        const start = new Date(r.datemin + 'T00:00:00');
        const end = new Date(r.datemax + 'T00:00:00');
        for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
          if (cur.getFullYear() === mY && cur.getMonth() + 1 === mM) {
            const d = cur.getDate();
            if (d <= 7) return 1;
            if (d <= 14) return 2;
            if (d <= 21) return 3;
            if (d <= 28) return 4;
            return 5;
          }
        }
        return null;
      })();
      const semNum = semNumNoMesSelecionado;
      const pctSem = semNum != null ? VAREJO_DIST_SEM[semNum] : null;
      const metaMesVarejo = Number(metasMensal.varejo || 0);
      if (pctSem != null && metaMesVarejo > 0) {
        const novaMetaSem = Math.round(metaMesVarejo * pctSem * 100) / 100;
        metasSemanal.varejo = novaMetaSem;
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

      // Adiantamento por canal (credev em payments) — usado para tag visual nos
      // canais que contabilizam credev como adiantamento (showroom, novidades,
      // fábrica, bazar). NÃO é subtraído do faturamento.
      const adiantMensal = { ...(fatM?.credev_por_segmento || {}) };
      const adiantSemanal = { ...(fatS?.credev_por_segmento || {}) };
      adiantMensal.fabrica = FABRICA_SOURCES.reduce(
        (s, c) => s + Number(adiantMensal[c] || 0),
        0,
      );
      adiantSemanal.fabrica = FABRICA_SOURCES.reduce(
        (s, c) => s + Number(adiantSemanal[c] || 0),
        0,
      );

      setMetaData({
        metas: { mensal: metasMensal, semanal: metasSemanal },
        justificativas: { mensal: justifMensal, semanal: justifSemanal },
        fat: { mensal: fatMensal, semanal: fatSemanal },
        adiantamento: { mensal: adiantMensal, semanal: adiantSemanal },
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
          `${API_BASE_URL}/api/crm/canal-metas?period_type=semanal&period_key=${isoWeekToMonthSemKey(weekKey)}`,
        ),
      ]);
    } catch (err) {
      if (isStale()) return;
      console.error('[Forecast/Métricas] metas fetch falhou:', err.message);
      setMetaData((s) => ({ ...s, loading: false, loaded: true }));
      return;
    }
    if (isStale()) return;

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
      // lite=true → pula PASS 0 (credev em payments, full FIS_NFITEMPROD scan).
      // Anti-sobrecarga TOTVS: o card de Faturamento × Meta carrega em segundos
      // sem disparar o full scan. Líquido fica levemente inflado mas o ganho
      // de não bloquear o usuário vale a pena.
      const [fatM, fatS] = await Promise.all([
        apiPost('/api/crm/faturamento-por-segmento?lite=true', { ...monthRange, lite: true }),
        apiPost('/api/crm/faturamento-por-segmento?lite=true', { ...weekRange, lite: true }),
      ]);
      if (isStale()) return;
      composeAndSet(metasMRes, metasSRes, fatM, fatS, false);
      // Salva no cache local
      try {
        localStorage.setItem(
          fatCacheKey,
          JSON.stringify({ ts: Date.now(), fatM, fatS }),
        );
        // Limpa caches de versões antigas (mantém só v2)
        Object.keys(localStorage)
          .filter((k) => k.startsWith('fmetas-fat:') && !k.startsWith('fmetas-fat:v4-rev:'))
          .forEach((k) => localStorage.removeItem(k));
        // Limpa entradas v2 antigas (mantém só 4)
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith('fmetas-fat:v4-rev:'),
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

  // Carrega o acumulado de faltante das semanas anteriores no mês selecionado.
  // Para cada semana ANTES da semana selecionada (mesmo mês), busca:
  //   - meta_semanal (canal_metas)
  //   - fat_semanal (faturamento-por-segmento)
  //   - faltante = max(0, meta - fat)
  // Soma por canal → acumuladoFaltante[canal] = total a recuperar nesta semana.
  const loadAcumuladoFaltante = useCallback(async () => {
    const monthKey = selectedMonthKey || currentMonthKey();
    const weekKey = selectedWeekKey || currentWeekKey();
    const weeks = weeksInMonth(monthKey);
    const previousWeeks = weeks.filter((w) => w.key < weekKey);
    // Token único para anti race-condition
    if (!loadAcumAbortRef.current) loadAcumAbortRef.current = { token: 0 };
    loadAcumAbortRef.current.token += 1;
    const myToken = loadAcumAbortRef.current.token;
    const isStale = () => myToken !== loadAcumAbortRef.current?.token;
    if (previousWeeks.length === 0) {
      setAcumuladoFaltante({});
      return;
    }
    setLoadingAcumulado(true);
    try {
      const todayIso = toLocalIso(new Date());
      // ── Anti-sobrecarga TOTVS ──
      // Antes: Promise.all(previousWeeks) → 4+ fat-seg em paralelo, cada um
      // chamando canal-totals internamente. Combinado com loadMetaData
      // (mais 2 fat-seg) e buscarVendedores (11 canal-totals), gerava pico
      // de ~17 queries TOTVS pesadas paralelas → estourava timeout/rate.
      // Agora SEQUENCIAL: uma semana de cada vez, com pequeno delay.
      const results = [];
      for (const w of previousWeeks) {
        if (isStale()) return; // outra requisição foi disparada
        const dmax = w.datemax > todayIso ? todayIso : w.datemax;
        if (dmax < w.datemin) {
          results.push({ weekKey: w.key, metas: {}, fat: {} });
          continue;
        }
        try {
          const [metasRes, fatRes] = await Promise.all([
            fetch(
              `${API_BASE_URL}/api/crm/canal-metas?period_type=semanal&period_key=${isoWeekToMonthSemKey(w.key)}`,
              { headers: { 'x-api-key': API_KEY } },
            ).then((r) => r.json()),
            apiPost('/api/crm/faturamento-por-segmento?lite=true', {
              datemin: w.datemin,
              datemax: dmax,
              lite: true,
            }),
          ]);
          const metas = {};
          for (const m of metasRes?.data?.metas || []) {
            metas[m.canal] = Number(m.valor_meta || 0);
          }
          const fat = { ...(fatRes?.segmentos || {}) };
          fat.fabrica = FABRICA_SOURCES.reduce(
            (s, c) => s + Number(fat[c] || 0),
            0,
          );
          results.push({ weekKey: w.key, datemin: w.datemin, datemax: dmax, metas, fat });
          // Pequena pausa entre semanas pra dar respiro ao TOTVS
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.warn(
            `[Forecast/acumulado] semana ${w.key} falhou: ${err.message}`,
          );
          results.push({ weekKey: w.key, metas: {}, fat: {} });
        }
      }
      // Agrega faltante por canal
      const accByCanal = {};
      for (const { weekKey: wk, datemin, datemax, metas, fat } of results) {
        const canais = new Set([
          ...Object.keys(metas),
          ...Object.keys(fat),
        ]);
        for (const canal of canais) {
          const m = Number(metas[canal] || 0);
          const f = Number(fat[canal] || 0);
          if (m <= 0) continue; // sem meta → não conta faltante
          const falt = Math.max(0, m - f);
          if (!accByCanal[canal]) {
            accByCanal[canal] = { faltante: 0, breakdown: [] };
          }
          accByCanal[canal].faltante += falt;
          accByCanal[canal].breakdown.push({
            weekKey: wk,
            datemin,
            datemax,
            meta: m,
            fat: f,
            faltante: falt,
          });
        }
      }
      if (isStale()) return;
      setAcumuladoFaltante(accByCanal);
    } finally {
      if (!isStale()) setLoadingAcumulado(false);
    }
  }, [selectedWeekKey, selectedMonthKey]);

  // Carrega acumulado quando entra na aba 'vendedores' ou muda período.
  // ATRASA 3s: deixa loadMetaData + buscarVendedores carregarem primeiro
  // (ambos chamam fat-seg/canal-totals). Sem o delay, 4 semanas × fat-seg
  // disputavam com 11 canais × canal-totals → ~17 queries TOTVS simultâneas
  // → timeout em cascata. Com delay, o acumulado começa quando a UI já tem
  // dados primários, e o cache TOTVS já cobre algumas chamadas.
  useEffect(() => {
    // Carrega acumulado em qualquer aba (Faturamento × Meta pode renderizar
    // em outras tabs). Atrasa 3s pra deixar metas/fat primários carregarem.
    const id = setTimeout(() => {
      loadAcumuladoFaltante();
    }, 3000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, selectedWeekKey, selectedMonthKey]);

  // Carrega breakdown (per_branch ou per_seller) de um canal para o período
  // selecionado. Cacheia para evitar refetch ao alternar canais.
  const loadCanalBreakdown = useCallback(
    async (canal, periodo /* 'semanal' | 'mensal' | 'anual' */) => {
      const cacheKey = `${canal}|${periodo}|${selectedWeekKey}|${selectedMonthKey}`;
      // Range = semana, mês ou ano selecionado
      let range;
      const todayIso = toLocalIso(new Date());
      if (periodo === 'semanal') {
        range = weekKeyRange(selectedWeekKey) || currentWeekRange();
      } else if (periodo === 'anual') {
        // Ano atual: 01/jan/(ano corrente) → hoje. Sempre usa o ano do
        // calendário (não do mês filtrado), pra refletir a visão YTD real.
        const anoAtual = new Date().getFullYear();
        range = {
          datemin: `${anoAtual}-01-01`,
          datemax: todayIso,
        };
      } else {
        const monthKey = selectedMonthKey || currentMonthKey();
        const [mY, mM] = monthKey.split('-').map(Number);
        const monthFirst = `${mY}-${String(mM).padStart(2, '0')}-01`;
        const lastDay = new Date(mY, mM, 0).getDate();
        const monthLast = `${mY}-${String(mM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        range = {
          datemin: monthFirst,
          datemax: monthLast < todayIso ? monthLast : todayIso,
        };
      }
      // Se já temos cache válido, pula
      if (breakdownCache[cacheKey] && !breakdownCache[cacheKey].loading) return;
      // Coalescing: se já tem fetch em andamento pra essa chave, aguarda ele
      if (breakdownInflightRef.current.has(cacheKey)) {
        try {
          await breakdownInflightRef.current.get(cacheKey);
        } catch {
          // Se a inflight anterior falhou, prossegue pra retry
        }
        return;
      }
      setBreakdownCache((s) => ({
        ...s,
        [cacheKey]: { loading: true, per_branch: [], per_seller: [] },
      }));

      // Canal virtual "fabrica" = soma de showroom + novidadesfranquia
      const fontes = canal === 'fabrica' ? FABRICA_SOURCES : [canal];
      const inflightPromise = (async () => {
        // TOTVS canal-totals com timeout 8s. Se TOTVS retornar primeiro, ótimo
        // (per_seller mais preciso com credev). Se não, fallback Supabase assume.
        const fetchComTimeout = (mod) => {
          return new Promise((resolve) => {
            const t = setTimeout(() => {
              console.warn(`[canal-breakdown] ${mod}: TOTVS timeout 8s, usa fallback`);
              resolve(null);
            }, 8000);
            apiPost('/api/crm/canal-totals?lite=true', {
              datemin: range.datemin,
              datemax: range.datemax,
              modulo: mod,
              lite: true,
            })
              .then((r) => { clearTimeout(t); resolve(r); })
              .catch(() => { clearTimeout(t); resolve(null); });
          });
        };
        const results = await Promise.all(fontes.map(fetchComTimeout));
        return results;
      })();

      // Em paralelo, dispara fallback Supabase pra canais com vendedor — é
      // rápido (<2s) e garante que algo apareça mesmo se TOTVS estiver lento.
      const canaisComVendedorPreFetch = new Set(['revenda', 'multimarcas', 'inbound_david', 'inbound_rafael', 'varejo']);
      const fallbackPromise = canaisComVendedorPreFetch.has(canal)
        ? apiPost('/api/crm/canal-per-seller-fallback', {
            datemin: range.datemin,
            datemax: range.datemax,
            modulo: canal,
          }).catch(() => null)
        : Promise.resolve(null);
      breakdownInflightRef.current.set(cacheKey, inflightPromise);
      try {
        const results = await inflightPromise;
        if (!results || !Array.isArray(results)) throw new Error('no results');
        // Merge per_branch e per_seller dos múltiplos canais
        const mergedBranch = new Map();
        const mergedSeller = new Map();
        for (const r of results) {
          if (!r) continue;
          for (const b of r.per_branch || []) {
            const k = String(b.branch_code);
            const cur = mergedBranch.get(k) || {
              branch_code: b.branch_code,
              branch_name: b.branch_name,
              invoice_value: 0,
              invoice_qty: 0,
              itens_qty: 0,
            };
            cur.invoice_value += Number(b.invoice_value || 0);
            cur.invoice_qty += Number(b.invoice_qty || 0);
            cur.itens_qty += Number(b.itens_qty || 0);
            mergedBranch.set(k, cur);
          }
          for (const s of r.per_seller || []) {
            const k = String(s.seller_code);
            const cur = mergedSeller.get(k) || {
              seller_code: s.seller_code,
              seller_name: s.seller_name,
              invoice_value: 0,
              invoice_qty: 0,
              itens_qty: 0,
            };
            cur.invoice_value += Number(s.invoice_value || 0);
            cur.invoice_qty += Number(s.invoice_qty || 0);
            cur.itens_qty += Number(s.itens_qty || 0);
            mergedSeller.set(k, cur);
          }
        }
        const per_branch = [...mergedBranch.values()]
          .map((b) => ({
            ...b,
            tm: b.invoice_qty > 0 ? b.invoice_value / b.invoice_qty : 0,
            pa: b.invoice_qty > 0 ? b.itens_qty / b.invoice_qty : 0,
          }))
          .sort((a, b) => b.invoice_value - a.invoice_value);
        // ─── Subtrai credev por vendedor ─────────────────────────────────
        // Como o canal-totals está em modo lite (pula credev em payments
        // pra não bloquear), aqui chamamos /credev-por-vendedor que é mais
        // leve que o full canal-totals. Resultado: per_seller fica LÍQUIDO.
        // Canais sem vendedores (showroom/fabrica/etc) não tem credev por
        // dealer, então pulamos.
        const canaisComVendedor = new Set(['revenda', 'multimarcas', 'inbound_david', 'inbound_rafael', 'varejo']);
        const fontesComVendedor = fontes.filter((m) => canaisComVendedor.has(m));
        const credevByDealer = {};
        if (fontesComVendedor.length > 0) {
          try {
            const credevResults = await Promise.all(
              fontesComVendedor.map((mod) =>
                apiPost('/api/crm/credev-por-vendedor', {
                  datemin: range.datemin,
                  datemax: range.datemax,
                  modulo: mod,
                }).catch(() => null),
              ),
            );
            for (const cr of credevResults) {
              for (const [code, v] of Object.entries(cr?.credev || {})) {
                credevByDealer[String(code)] = (credevByDealer[String(code)] || 0) + Number(v || 0);
              }
            }
          } catch {}
        }
        // payments-mode atribui credev ao dealer correto (vendedor real),
        // diferente do returns-mode que bucketa tudo em GERAL=50. Confirmado
        // com relatório TOTVS 0326 (Vl. Faturado por vendedor).
        for (const [k, s] of mergedSeller.entries()) {
          const cr = credevByDealer[String(s.seller_code)] || 0;
          s.credev_value = cr;
          s.invoice_value_gross = s.invoice_value;
          s.invoice_value = Math.max(0, s.invoice_value - cr);
        }

        let per_seller = [...mergedSeller.values()]
          .map((s) => ({
            ...s,
            tm: s.invoice_qty > 0 ? s.invoice_value / s.invoice_qty : 0,
            pa: s.invoice_qty > 0 ? s.itens_qty / s.invoice_qty : 0,
          }))
          .sort((a, b) => b.invoice_value - a.invoice_value);
        // ── Fallback: se TOTVS retornou per_seller/per_branch vazio (timeout/erro),
        // usa o fallback Supabase que já foi disparado em paralelo no início.
        let per_branch_final = per_branch;
        const isVarejo = canal === 'varejo';
        const precisaFallback = (isVarejo && per_branch.length === 0)
          || (!isVarejo && per_seller.length === 0 && canaisComVendedor.has(canal));
        if (precisaFallback) {
          try {
            const fb = await fallbackPromise;
            if (isVarejo) {
              const fbBranches = fb?.per_branch || [];
              if (fbBranches.length > 0) {
                per_branch_final = fbBranches.map((b) => ({
                  ...b,
                  tm: b.invoice_qty > 0 ? b.invoice_value / b.invoice_qty : 0,
                  pa: 0,
                }));
                console.log(`[canal-breakdown] varejo: fallback notas_fiscais (${fbBranches.length} lojas)`);
              }
            } else {
              const fbList = fb?.per_seller || [];
              if (fbList.length > 0) {
                per_seller = fbList.map((s) => ({
                  ...s,
                  tm: s.invoice_qty > 0 ? s.invoice_value / s.invoice_qty : 0,
                  pa: 0,
                }));
                console.log(`[canal-breakdown] ${canal}: fallback notas_fiscais (${fbList.length} vendedores)`);
              }
            }
          } catch (e) {
            console.warn(`[canal-breakdown] ${canal}: fallback falhou: ${e.message}`);
          }
        }
        setBreakdownCache((s) => {
          const next = { ...s, [cacheKey]: { loading: false, per_branch: per_branch_final, per_seller } };
          // Se ficou vazio mesmo após fallback, NÃO cache — permite retry no próximo click
          if (per_branch_final.length === 0 && per_seller.length === 0) {
            delete next[cacheKey];
            console.warn(`[canal-breakdown] ${canal}: vazio (TOTVS + fallback falharam) — sem cache pra permitir retry`);
          }
          return next;
        });
      } catch (err) {
        console.warn(`[canal-breakdown] ${canal}: ${err.message}`);
        setBreakdownCache((s) => ({
          ...s,
          [cacheKey]: { loading: false, per_branch: [], per_seller: [] },
        }));
      } finally {
        // Cleanup do inflight (importante pra próximo fetch funcionar)
        breakdownInflightRef.current.delete(cacheKey);
      }
    },
    [selectedWeekKey, selectedMonthKey, breakdownCache],
  );

  // Quando muda canal expandido, dispara o fetch
  useEffect(() => {
    if (!canalExpandido) return;
    loadCanalBreakdown(canalExpandido.canal, canalExpandido.periodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalExpandido?.canal, canalExpandido?.periodo, selectedWeekKey, selectedMonthKey]);

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

  // Carrega meta sempre que o período muda. Era condicionado ao aba===vendedores,
  // mas o card "Faturamento × Meta" pode ficar visível em outras abas e precisa
  // dos dados atualizados. Sem isso, clicar "Mês passado" deixava Meta Mês em "—".
  useEffect(() => {
    loadMetaData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, selectedWeekKey, selectedMonthKey]);

  const buscarVendedores = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    const tok = fetchVendedores.run();

    // ─── Stale-while-revalidate ──────────────────────────────────────────
    // Salva último resultado em localStorage. Próxima abertura mostra dados
    // antigos INSTANTANEAMENTE enquanto busca fresco em background.
    //   - TTL stale: 24h pra datas passadas, 1h pra mês corrente
    //   - Mostra indicador "atualizando..." quando exibe stale
    const cacheKey = `canais-totals-all:v3-rev:${dataInicio}:${dataFim}`;
    const todayIso = toLocalIso(new Date());
    const isRealtime = dataFim >= todayIso;
    const staleTtlMs = isRealtime ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    // 1) Tenta usar cache stale
    let hasStale = false;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        const age = Date.now() - (cached?.ts || 0);
        if (age < staleTtlMs && cached?.data) {
          setVendedores([]);
          setRankingFat({ ...cached.data, _stale: true, _staleAge: age });
          hasStale = true;
        }
      }
    } catch {}

    // 2) Busca fresh — sempre, mas com loading só se não tem stale
    if (!hasStale) {
      setLoadingVend(true);
    }
    setErro('');

    try {
      // lite=true → pula a query mais pesada (credev em payments). Ganho
      // gigante de performance e zero risco de bloqueio TOTVS. O líquido fica
      // levemente inflado (sem subtrair credev em payments), mas continua
      // descontando devolução real (SaleReturns) e exclusões (Recife Mall).
      const res = await apiPost('/api/crm/canais-totals-all?lite=true', {
        datemin: dataInicio,
        datemax: dataFim,
        lite: true,
      });
      if (fetchVendedores.isStale(tok)) return;
      setVendedores([]);
      setRankingFat(res ?? null);
      // Salva no cache pra próxima visita
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ ts: Date.now(), data: res }),
        );
        // Limpeza: mantém máx 6 entradas
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith('canais-totals-all:v3-rev:'),
        );
        if (keys.length > 6) {
          keys.slice(0, keys.length - 6).forEach((k) => localStorage.removeItem(k));
        }
      } catch {}
    } catch (e) {
      if (fetchVendedores.isStale(tok)) return;
      // Se temos stale e falhou o refresh, mantém stale (apenas remove flag)
      if (!hasStale) {
        setErro('Erro ao buscar dados: ' + e.message);
      } else {
        console.warn('[buscarVendedores] refresh falhou, mantendo stale:', e.message);
      }
    } finally {
      if (!fetchVendedores.isStale(tok)) setLoadingVend(false);
    }
  }, [dataInicio, dataFim, fetchVendedores]);

  const buscarPagamento = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    const tok = fetchPagamento.run();
    setLoadingPag(true);
    setErro('');
    try {
      const res = await apiPost('/api/crm/faturamento-por-pagamento', {
        datemin: dataInicio,
        datemax: dataFim,
      });
      if (fetchPagamento.isStale(tok)) return;
      setPagamento(res);
    } catch (e) {
      if (fetchPagamento.isStale(tok)) return;
      setErro('Erro ao buscar formas de pagamento: ' + e.message);
    } finally {
      if (!fetchPagamento.isStale(tok)) setLoadingPag(false);
    }
  }, [dataInicio, dataFim, fetchPagamento]);

  const buscarComparativo = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    const tok = fetchComparativo.run();
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

      if (fetchComparativo.isStale(tok)) return;
      setComp({ atual, acumulado, anoCompleto, acumInicio, acumFim });
    } catch (e) {
      if (fetchComparativo.isStale(tok)) return;
      setErro('Erro ao buscar comparativo: ' + e.message);
    } finally {
      if (!fetchComparativo.isStale(tok)) setLoadingComp(false);
    }
  }, [dataInicio, dataFim, anoAnterior, fetchComparativo]);

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

  // Quando o range geral (dataInicio/dataFim) muda (ex: ao clicar "Mês passado"),
  // refaz a busca dos cards principais. Pula a chamada inicial (já feita pelo
  // effect de mount). Inclui um pequeno debounce pra evitar re-fetch em cascata.
  const isFirstRangeChangeRef = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRangeChangeRef.current) {
      isFirstRangeChangeRef.current = false;
      return;
    }
    if (!dataInicio || !dataFim) return;
    const id = setTimeout(() => {
      // Re-fetch o canal principal (top card) e o vendedores (Métricas por Canal)
      buscar();
      if (aba === 'vendedores') buscarVendedores();
      if (aba === 'comparativo') buscarComparativo();
      if (aba === 'pagamento') buscarPagamento();
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim]);

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

  // Auto-busca no mount — UX: não precisa clicar Buscar. Dispara só
  // quando entra na aba canal e ainda não buscou (sem resultado e sem loading).
  useEffect(() => {
    if (aba !== 'canal') return;
    if (!dataInicio || !dataFim) return;
    if (resultado || loading) return;
    console.log('[auto-busca] disparando buscar()', { dataInicio, dataFim, aba });
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

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
        setDataInicio(toLocalIso(lastMonday));
        setDataFim(toLocalIso(lastSunday));
      },
    },
    {
      label: 'Este mês',
      fn: () => {
        const h = new Date();
        setDataInicio(toLocalIso(new Date(h.getFullYear(), h.getMonth(), 1)));
        setDataFim(toLocalIso(h));
      },
    },
    {
      label: 'Mês passado',
      fn: () => {
        const h = new Date();
        setDataInicio(toLocalIso(new Date(h.getFullYear(), h.getMonth() - 1, 1)));
        setDataFim(toLocalIso(new Date(h.getFullYear(), h.getMonth(), 0)));
      },
    },
    {
      label: 'Últimos 3 meses',
      fn: () => {
        const h = new Date();
        setDataInicio(toLocalIso(new Date(h.getFullYear(), h.getMonth() - 2, 1)));
        setDataFim(toLocalIso(h));
      },
    },
    {
      label: 'Este ano',
      fn: () => {
        const h = new Date();
        setDataInicio(`${h.getFullYear()}-01-01`);
        setDataFim(toLocalIso(h));
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
            <div className="flex flex-wrap items-end gap-4 justify-center">
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
                className="flex items-center gap-2 px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-medium hover:bg-[#000638]/90 disabled:opacity-50 transition-colors"
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
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit mx-auto">
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
            { id: 'metricas-diretoria', label: 'Métricas Diretoria', icon: Crown },
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
                <div className="flex flex-col gap-5">
                {/* ─── LINHA 1: Faturamento principal + Devoluções/Líquido ─── */}
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
                        {resultado.credev_total > 0 && (
                          <>
                            <span className="opacity-50">•</span>
                            <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-400/30 text-rose-200 rounded-full px-2.5 py-0.5 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                              Credev − R$ {formatBRL(resultado.credev_total)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                </div>

                {/* ─── LINHA 2: KPIs (WhatsApp · Tráfego · ROI+Clientes) ───
                    3 colunas no desktop. Última coluna empilha ROI + Clientes
                    pra equilibrar altura visual com WhatsApp/Tráfego. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:items-stretch">
                  {/* Custos API WhatsApp + Tráfego */}
                  {(custoWpp || custoAds || erroMeta) && (
                    <div className="contents">
                      {custoWpp && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            // Não abre o modal quando o clique foi em um <details>/<summary>
                            if (e.target.closest('details, summary')) return;
                            setModalWppDetail(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setModalWppDetail(true);
                            }
                          }}
                          className="bg-yellow-500/10 hover:bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/20 hover:border-yellow-400/40 rounded-lg p-3 text-left transition-colors cursor-pointer group"
                          title="Clique para ver o gasto por número"
                        >
                          <p className="text-[10px] text-yellow-200/80 uppercase tracking-wider font-medium mb-1 flex items-center justify-between gap-2">
                            <span>WhatsApp API</span>
                            <span className="text-[9px] text-yellow-300/60 group-hover:text-yellow-200 normal-case tracking-normal font-normal">
                              ver por número →
                            </span>
                          </p>
                          <p className="text-base font-bold text-yellow-200">
                            R${' '}
                            {formatBRL(
                              Number(custoWpp.costBRL ?? ((custoWpp.cost ?? 0) * 5.8)) || 0,
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

                  {/* Coluna 3: ROI Marketing + Clientes empilhados (metade da altura cada) */}
                  <div className="flex flex-col gap-3">
                  {/* Card: ROI / ROAS (Marketing) — clicável → abre modal */}
                  {(custoWpp || custoAds) && resultado && (() => {
                    const wppBRL = Number(custoWpp?.costBRL ?? ((custoWpp?.cost ?? 0) * 5.8)) || 0;
                    const adsBRL = Number(custoAds?.spend || 0);
                    const totMkt = wppBRL + adsBRL;
                    const receita = Number(resultado.total_liquido ?? resultado.total ?? 0);
                    const roi = totMkt > 0 ? ((receita - totMkt) / totMkt) * 100 : 0;
                    const roas = totMkt > 0 ? receita / totMkt : 0;
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setModalROI(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalROI(true); } }}
                        className="bg-cyan-500/10 hover:bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 hover:border-cyan-400/50 rounded-lg px-3 py-2 min-w-0 cursor-pointer transition-colors group flex-1 flex flex-col justify-center"
                        title="Clique para ver ROAS por canal (WhatsApp/Tráfego × Novos/Total)"
                      >
                        <p className="text-[10px] text-cyan-200/80 uppercase tracking-wider font-medium flex items-center justify-between gap-2">
                          <span>ROAS Marketing</span>
                          <span className="text-[9px] text-cyan-300/60 group-hover:text-cyan-200 normal-case tracking-normal font-normal">
                            ver por canal →
                          </span>
                        </p>
                        <p className="text-base font-bold text-cyan-200 mt-1 tabular-nums leading-tight">
                          {roas.toFixed(2)}x
                        </p>
                        <p className="text-[10px] text-cyan-300/80 mt-0.5">
                          invest. R$ {formatBRL(totMkt)}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Card: Clientes Ativos / Novos (clicável → abre modal) */}
                  {clientesCanal && (() => {
                    const CANAIS_EXIBIR = ['varejo', 'revenda', 'multimarcas', 'inbound_david', 'inbound_rafael'];
                    const filtrados = Object.entries(clientesCanal).filter(([c]) => CANAIS_EXIBIR.includes(c));
                    const totAtivos = filtrados.reduce((s, [, v]) => s + Number(v?.ativos || 0), 0);
                    const totNovos = filtrados.reduce((s, [, v]) => s + Number(v?.novos || 0), 0);
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setModalClientesCanal(true)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalClientesCanal(true); } }}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 hover:border-emerald-400/50 rounded-lg px-3 py-2 min-w-0 cursor-pointer transition-colors group flex-1 flex flex-col justify-center"
                        title="Clique para ver clientes por canal"
                      >
                        <p className="text-[10px] text-emerald-200/80 uppercase tracking-wider font-medium flex items-center justify-between gap-2">
                          <span>Clientes</span>
                          <span className="text-[9px] text-emerald-300/60 group-hover:text-emerald-200 normal-case tracking-normal font-normal">
                            ver por canal →
                          </span>
                        </p>
                        <div className="flex items-baseline gap-3 mt-1">
                          <div>
                            <span className="text-[9px] text-emerald-300/70 uppercase tracking-wider">Ativos</span>
                            <p className="text-base font-bold text-emerald-200 tabular-nums leading-tight">{totAtivos.toLocaleString('pt-BR')}</p>
                          </div>
                          <div>
                            <span className="text-[9px] text-emerald-300/70 uppercase tracking-wider">Novos</span>
                            <p className="text-base font-bold text-emerald-200 tabular-nums leading-tight">+{totNovos.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </div>{/* fecha coluna 3 (ROI + Clientes) */}

                </div>
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
                  {/* Card BlueCard — cartões enviados via ClickUp no período */}
                  <BlueCardCard count={bluecardCount} />
                  {/* Card BlueCred — créditos enviados via Autentique no período */}
                  <BlueCredCard stats={bluecredStats} />
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
        {/* Renderiza se temos rankingFat (mesmo que stale + carregando em background) */}
        {aba === 'vendedores' &&
          rankingFat &&
          (!loadingVend || rankingFat?._stale) &&
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
            const canaisMeta = orderWithFabrica.filter((c) => {
              // Inclui se tem meta cadastrada (semanal ou mensal)
              if (canaisMetaSet.has(c)) return true;
              // Inclui se tem fat real no período (mensal ou semanal)
              if ((metaData.fat?.mensal?.[c] ?? 0) > 0) return true;
              if ((metaData.fat?.semanal?.[c] ?? 0) > 0) return true;
              // 'fabrica' (virtual) só aparece se tem fat consolidado
              // (showroom+novidadesfranquia) — evita linha órfã com tudo "—"
              return false;
            });

            const pctColor = (pct) => {
              // Usa o mesmo arredondamento do label (toFixed(1)) pra evitar
              // "100.0% amarelo" quando o valor real é 99.95
              const p = Math.round((pct || 0) * 10) / 10;
              if (p >= 100) return 'text-emerald-600 bg-emerald-50';
              if (p >= 70) return 'text-amber-600 bg-amber-50';
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

                  // Total acumulado de faltante de semanas anteriores
                  const totalAcumFaltante = Object.values(
                    acumuladoFaltante || {},
                  ).reduce((s, v) => s + Number(v?.faltante || 0), 0);

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
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-[11px] text-blue-200 font-semibold uppercase tracking-wider">
                                  Métricas por Canal
                                </p>
                                <span className="text-[10px] text-blue-300/70 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                  TOTVS
                                </span>
                                {rankingFat?._stale && loadingVend && (
                                  <span className="text-[10px] inline-flex items-center gap-1 text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                    <Spinner size={9} className="animate-spin" />
                                    atualizando…
                                  </span>
                                )}
                                {rankingFat?._stale && !loadingVend && (
                                  <span
                                    className="text-[10px] inline-flex items-center gap-1 text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/20 cursor-help"
                                    title={`Dados de cache local (${Math.floor((rankingFat._staleAge || 0) / 1000 / 60)}min atrás). Atualização em background falhou — clique em Buscar pra tentar de novo.`}
                                  >
                                    cache local
                                  </span>
                                )}
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
                            <div className={`grid ${totalAcumFaltante > 0 ? 'grid-cols-2 lg:grid-cols-4 lg:min-w-[600px]' : 'grid-cols-3 lg:min-w-[460px]'} gap-2 lg:gap-3 min-w-0`}>
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

                              {/* FALTANTE ACUMULADO (semanas anteriores) */}
                              {totalAcumFaltante > 0 && (
                                <div className="bg-amber-500/15 backdrop-blur-sm border border-amber-400/30 rounded-lg p-3">
                                  <p className="text-[10px] text-amber-200/90 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                    <ArrowDown size={10} weight="bold" />
                                    Acumulado Anterior
                                  </p>
                                  <p className="text-2xl font-bold text-amber-200">
                                    R$ {formatBRLCompact(totalAcumFaltante)}
                                  </p>
                                  <p className="text-[10px] text-amber-300/80 mt-0.5">
                                    a recuperar nesta semana
                                  </p>
                                </div>
                              )}

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
                <Card className="mb-6 shadow-md">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-start gap-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Target size={18} weight="duotone" className="text-blue-700" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800 leading-tight">
                            Faturamento × Meta
                          </h3>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Acumulado automático: faltante das semanas anteriores
                            soma na meta da semana atual
                          </p>
                        </div>
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
                        <button
                          onClick={() => {
                            const lm = lastMonthKey();
                            setSelectedMonthKey(lm);
                            // Atualiza também o range geral (top "Métricas por
                            // Canal" / Faturamento) pra refletir o mês passado.
                            const [y, m] = lm.split('-').map(Number);
                            const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
                            const fim = new Date(y, m, 0)
                              .toISOString()
                              .split('T')[0]; // último dia do mês
                            setDataInicio(inicio);
                            setDataFim(fim);
                          }}
                          disabled={selectedMonthKey === lastMonthKey()}
                          className="text-xs px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Filtrar pelo mês passado (atualiza tudo: top, faturamento, métricas)"
                        >
                          Mês passado
                        </button>
                        {(selectedWeekKey !== currentWeekKey() || selectedMonthKey !== currentMonthKey()) && (
                          <button
                            onClick={() => {
                              setSelectedWeekKey(currentWeekKey());
                              setSelectedMonthKey(currentMonthKey());
                              // Reseta o range geral (top card) pra mês corrente
                              const h = new Date();
                              setDataInicio(toLocalIso(new Date(h.getFullYear(), h.getMonth(), 1)));
                              setDataFim(toLocalIso(h));
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
                        <a
                          href="/apresentacao/forecast"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold inline-flex items-center gap-1 shadow-sm"
                          title="Abre versão tela cheia pra apresentação (TV/projetor)"
                        >
                          🖥️ Apresentação
                        </a>
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
                      <div className="rounded-lg border border-gray-100 overflow-hidden">
                        <table className="w-full text-xs table-fixed">
                          <colgroup>
                            <col style={{ width: '18%' }} /> {/* Canal */}
                            <col style={{ width: '10%' }} /> {/* Meta Sem */}
                            <col style={{ width: '9%' }} />  {/* +Acum */}
                            <col style={{ width: '10%' }} /> {/* Atingido S */}
                            <col style={{ width: '8%' }} />  {/* % Sem */}
                            <col style={{ width: '8%' }} />  {/* % Acum */}
                            <col style={{ width: '11%' }} /> {/* Meta Mês */}
                            <col style={{ width: '11%' }} /> {/* Atingido M */}
                            <col style={{ width: '8%' }} />  {/* % Mês */}
                            {isAdmin && <col style={{ width: '7%' }} />}
                          </colgroup>
                          <thead>
                            <tr className="border-b-2 border-gray-300">
                              <th className="py-2 px-2 text-left text-[10px] font-bold text-white uppercase tracking-wider bg-slate-700">
                                Canal
                              </th>
                              <th className="py-2 px-1 text-center text-[10px] font-bold text-white uppercase tracking-wider bg-blue-600" colSpan={5}>
                                Sem{' '}
                                <span className="text-blue-100 font-normal normal-case">({selectedWeekKey})</span>
                              </th>
                              <th className="py-2 px-1 text-center text-[10px] font-bold text-white uppercase tracking-wider bg-indigo-600" colSpan={3}>
                                Mês{' '}
                                <span className="text-indigo-100 font-normal normal-case">({selectedMonthKey})</span>
                              </th>
                              {isAdmin && <th className="py-2 px-1 bg-slate-700" />}
                            </tr>
                            <tr className="border-b border-gray-200">
                              <th className="py-1.5 px-2 bg-slate-100"></th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-blue-800 uppercase tracking-wide whitespace-nowrap bg-blue-50" title="Meta original da semana">
                                Meta Sem
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-amber-800 uppercase tracking-wide whitespace-nowrap bg-amber-50" title="Acumulado das semanas anteriores no mês">
                                + Acum
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-blue-800 uppercase tracking-wide whitespace-nowrap bg-blue-50" title="Faturamento da semana">
                                Atingido
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-blue-800 uppercase tracking-wide bg-blue-50" title="Atingido / Meta original da semana">
                                % Sem
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-amber-800 uppercase tracking-wide bg-amber-50" title="Atingido / (Meta + Acumulado)">
                                % Acum
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-indigo-800 uppercase tracking-wide whitespace-nowrap bg-indigo-50" title="Meta do mês">
                                Meta Mês
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-indigo-800 uppercase tracking-wide bg-indigo-50">
                                Atingido
                              </th>
                              <th className="py-1.5 px-1 text-right text-[9px] font-semibold text-indigo-800 uppercase tracking-wide bg-indigo-50">
                                % Mês
                              </th>
                              {isAdmin && <th className="py-1.5 px-1 bg-slate-100" />}
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
                              const acumInfo = acumuladoFaltante[canal];
                              const acumValor = acumInfo?.faltante || 0;
                              const metaSAjustada = metaS + acumValor;
                              // % vs meta original da semana (sem somar acumulado)
                              const pctSOriginal = metaS > 0 ? (fatS / metaS) * 100 : 0;
                              // % vs meta + acumulado (meta ajustada)
                              const pctS = metaSAjustada > 0 ? (fatS / metaSAjustada) * 100 : 0;
                              const pctM = metaM > 0 ? (fatM / metaM) * 100 : 0;
                              const justifS =
                                metaData.justificativas?.semanal?.[canal];
                              const justifM =
                                metaData.justificativas?.mensal?.[canal];
                              const breakdownTooltip = acumInfo?.breakdown
                                ?.filter((b) => b.faltante > 0)
                                .map(
                                  (b) =>
                                    `${b.weekKey}: faltou R$ ${formatBRL(b.faltante)} (meta R$ ${formatBRL(b.meta)} − fat R$ ${formatBRL(b.fat)})`,
                                )
                                .join('\n');
                              const isExpanded =
                                canalExpandido?.canal === canal;
                              const cacheKey = `${canal}|${canalExpandido?.periodo || 'semanal'}|${selectedWeekKey}|${selectedMonthKey}`;
                              const breakdownData = isExpanded
                                ? breakdownCache[cacheKey]
                                : null;
                              // Skeleton enquanto metaData.fat está sendo carregado
                              const isLoadingFat = metaData.loading && !metaData.loaded;
                              const fatCell = (v) =>
                                isLoadingFat ? (
                                  <span className="inline-block w-16 h-3 bg-gray-200 rounded animate-pulse" />
                                ) : (
                                  <>R$ {formatBRL(v)}</>
                                );
                              return (
                                <React.Fragment key={canal}>
                                <tr
                                  className={`border-b border-gray-100 transition-all group cursor-pointer relative ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}
                                  onClick={() => {
                                    if (isExpanded) {
                                      setCanalExpandido(null);
                                    } else {
                                      // Default inteligente: abre em 'mensal' se a semana não teve fat
                                      const defaultPeriodo = fatS > 0 ? 'semanal' : 'mensal';
                                      setCanalExpandido({ canal, periodo: defaultPeriodo });
                                    }
                                  }}
                                >
                                  <td className="py-2 px-2 font-medium text-gray-800 relative">
                                    {/* Faixa lateral colorida do canal */}
                                    <span
                                      className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                                      style={{ backgroundColor: cfg.color || '#94a3b8', opacity: isExpanded ? 1 : 0.6 }}
                                    />
                                    <div className="inline-flex items-center gap-1.5 pl-2 min-w-0">
                                      <CaretRight
                                        size={10}
                                        weight="bold"
                                        className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90 text-blue-600' : 'group-hover:text-gray-600'}`}
                                      />
                                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cfg.bg || 'bg-gray-100'} ring-1 ring-inset ring-black/5 flex-shrink-0`}>
                                        <Icon
                                          size={12}
                                          weight="duotone"
                                          className={cfg.text || 'text-gray-600'}
                                        />
                                      </div>
                                      <span className="font-semibold text-gray-800 text-[12px] truncate">{cfg.label || canal}</span>
                                      {/* Tag ADIANTAMENTO: canais bruto (showroom/novidades/fabrica/bazar) que
                                          tiveram credev em payments — credev aqui é entendido como adiantamento
                                          de cliente (já incluso no faturamento, não subtraído). */}
                                      {(() => {
                                        const CANAIS_ADIANTAMENTO = new Set([
                                          'showroom',
                                          'novidadesfranquia',
                                          'fabrica',
                                          'bazar',
                                        ]);
                                        if (!CANAIS_ADIANTAMENTO.has(canal)) return null;
                                        const adiantM = Number(metaData.adiantamento?.mensal?.[canal] || 0);
                                        const adiantS = Number(metaData.adiantamento?.semanal?.[canal] || 0);
                                        const adiantTotal = Math.max(adiantM, adiantS);
                                        if (adiantTotal <= 0) return null;
                                        return (
                                          <span
                                            className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 ring-1 ring-purple-200 cursor-help"
                                            title={`Adiantamento de cliente (credev em pagamentos) — incluído no faturamento, não subtraído.\n\nMensal: R$ ${formatBRL(adiantM)}\nSemanal: R$ ${formatBRL(adiantS)}`}
                                          >
                                            <CurrencyDollar size={9} weight="fill" />
                                            Adiantamento
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums text-gray-700 text-[11px]" title={metaS > 0 ? `R$ ${formatBRL(metaS)}` : ''}>
                                    {metaS > 0 ? `R$ ${formatBRLCompact(metaS)}` : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {loadingAcumulado ? (
                                      <span className="text-gray-300 text-xs animate-pulse">...</span>
                                    ) : acumValor > 0 ? (
                                      <span
                                        className="inline-flex items-center px-1 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-[10px] cursor-help"
                                        title={`Faltante acumulado de semanas anteriores no mês:\n${breakdownTooltip}\n\nMeta ajustada: R$ ${formatBRL(metaSAjustada)}`}
                                      >
                                        +R$ {formatBRLCompact(acumValor)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums text-gray-800 font-semibold text-[11px]" title={`R$ ${formatBRL(fatS)}`}>
                                    {isLoadingFat ? (
                                      <span className="inline-block w-12 h-3 bg-gray-200 rounded animate-pulse" />
                                    ) : (
                                      <>R$ {formatBRLCompact(fatS)}</>
                                    )}
                                  </td>
                                  {/* % Sem — vs meta ORIGINAL da semana */}
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {metaS > 0 ? (
                                      <div className="inline-flex flex-col items-end gap-0.5">
                                        <span
                                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${pctColor(pctSOriginal)}`}
                                          title={`Atingido R$ ${formatBRL(fatS)} / Meta R$ ${formatBRL(metaS)}`}
                                        >
                                          {pctSOriginal.toFixed(1)}%
                                        </span>
                                        <div className="w-10 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full transition-all ${
                                              pctSOriginal >= 100 ? 'bg-emerald-500'
                                              : pctSOriginal >= 70 ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${Math.min(100, pctSOriginal)}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300 text-xs">—</span>
                                    )}
                                  </td>
                                  {/* % Acum — vs meta + acumulado das semanas anteriores */}
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {metaSAjustada > 0 ? (
                                      <div className="inline-flex flex-col items-end gap-0.5">
                                        <span
                                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${pctColor(pctS)}`}
                                          title={acumValor > 0
                                            ? `Atingido R$ ${formatBRL(fatS)} / Meta+Acum R$ ${formatBRL(metaSAjustada)} (meta R$ ${formatBRL(metaS)} + acum R$ ${formatBRL(acumValor)})`
                                            : `Igual ao % Sem (sem acumulado anterior)`}
                                        >
                                          {pctS.toFixed(1)}%
                                        </span>
                                        <div className="w-10 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full transition-all ${
                                              pctS >= 100 ? 'bg-emerald-500'
                                              : pctS >= 70 ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${Math.min(100, pctS)}%` }}
                                          />
                                        </div>
                                        {pctS < 100 && justifS && (
                                          <span
                                            className="cursor-help text-amber-600 text-[9px]"
                                            title={`Justificativa: ${justifS}`}
                                          >
                                            ℹ️
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-300 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums text-gray-700 text-[11px]" title={metaM > 0 ? `R$ ${formatBRL(metaM)}` : ''}>
                                    {metaM > 0 ? `R$ ${formatBRLCompact(metaM)}` : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums text-gray-800 font-semibold text-[11px]" title={`R$ ${formatBRL(fatM)}`}>
                                    R$ {formatBRLCompact(fatM)}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {metaM > 0 ? (
                                      <div className="inline-flex flex-col items-end gap-0.5">
                                        <span
                                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${pctColor(pctM)}`}
                                        >
                                          {pctM.toFixed(1)}%
                                        </span>
                                        <div className="w-10 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full transition-all ${
                                              pctM >= 100 ? 'bg-emerald-500'
                                              : pctM >= 70 ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${Math.min(100, pctM)}%` }}
                                          />
                                        </div>
                                        {pctM < 100 && justifM && (
                                          <span
                                            className="cursor-help text-amber-600 text-[9px]"
                                            title={`Justificativa: ${justifM}`}
                                          >
                                            ℹ️ justif.
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-300 text-xs">—</span>
                                    )}
                                  </td>
                                  {isAdmin && (
                                    <td className="py-2 px-1 text-right">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMetaEdit({
                                            canal,
                                            label: cfg.label || canal,
                                          });
                                        }}
                                        className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Editar metas"
                                      >
                                        <Pencil size={11} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-gradient-to-b from-blue-50/60 to-white">
                                    <td colSpan={isAdmin ? 9 : 8} className="px-3 py-4">
                                      <CanalDrillDown
                                        canal={canal}
                                        cfg={cfg}
                                        periodo={canalExpandido.periodo}
                                        setPeriodo={(p) =>
                                          setCanalExpandido({ canal, periodo: p })
                                        }
                                        data={breakdownData}
                                        formatBRL={formatBRL}
                                        monthKey={selectedMonthKey || currentMonthKey()}
                                      />
                                    </td>
                                  </tr>
                                )}
                                </React.Fragment>
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
                              const totalAcum = canaisMeta.reduce(
                                (s, c) =>
                                  s + Number(acumuladoFaltante[c]?.faltante || 0),
                                0,
                              );
                              const metaSTotal = sum('semanal', 'metas');
                              const fatSTotal = sum('semanal', 'fat');
                              const metaMTotal = sum('mensal', 'metas');
                              const fatMTotal = sum('mensal', 'fat');
                              // % considera o acumulado faltante somado à meta semana (mesma
                              // lógica das linhas individuais, que usam metaSAjustada)
                              const metaSAjustadaTotal = metaSTotal + totalAcum;
                              const pctSTotal =
                                metaSAjustadaTotal > 0
                                  ? (fatSTotal / metaSAjustadaTotal) * 100
                                  : 0;
                              const pctMTotal =
                                metaMTotal > 0
                                  ? (fatMTotal / metaMTotal) * 100
                                  : 0;
                              // % Sem TOTAL — vs meta original (sem acumulado)
                              const pctSOriginalTotal =
                                metaSTotal > 0 ? (fatSTotal / metaSTotal) * 100 : 0;
                              const PctBadge = ({ pct }) => (
                                <div className="inline-flex flex-col items-end gap-0.5">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${pctColor(pct)}`}
                                  >
                                    {pct.toFixed(1)}%
                                  </span>
                                  <div className="w-10 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all ${
                                        pct >= 100 ? 'bg-emerald-500'
                                        : pct >= 70 ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(100, pct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                              return (
                                <tr className="border-t-2 border-gray-300 bg-gradient-to-r from-slate-50 to-gray-50">
                                  <td className="py-2 px-2 font-bold text-gray-800 uppercase text-[10px] tracking-wider">
                                    Total
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums font-bold text-gray-800 text-[11px]" title={`R$ ${formatBRL(metaSTotal)}`}>
                                    R$ {formatBRLCompact(metaSTotal)}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums font-bold text-amber-700 text-[11px]" title={totalAcum > 0 ? `R$ ${formatBRL(totalAcum)}` : ''}>
                                    {totalAcum > 0 ? `+R$ ${formatBRLCompact(totalAcum)}` : '—'}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums font-bold text-gray-800 text-[11px]" title={`R$ ${formatBRL(fatSTotal)}`}>
                                    R$ {formatBRLCompact(fatSTotal)}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {metaSTotal > 0 ? <PctBadge pct={pctSOriginalTotal} /> : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {metaSAjustadaTotal > 0 ? <PctBadge pct={pctSTotal} /> : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums font-bold text-gray-800 text-[11px]" title={`R$ ${formatBRL(metaMTotal)}`}>
                                    R$ {formatBRLCompact(metaMTotal)}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums font-bold text-gray-800 text-[11px]" title={`R$ ${formatBRL(fatMTotal)}`}>
                                    R$ {formatBRLCompact(fatMTotal)}
                                  </td>
                                  <td className="py-2 px-1 text-right tabular-nums">
                                    {metaMTotal > 0 ? <PctBadge pct={pctMTotal} /> : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
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
          <div className="space-y-4">
            {/* Hero banner com instruções rápidas */}
            <div className="bg-gradient-to-r from-[#000638] via-[#1a2461] to-[#000638] text-white rounded-xl px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2.5 rounded-lg">
                  <Target size={20} weight="duotone" className="text-blue-200" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Métricas Diárias</h2>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Promessa por canal, vendedores B2R/B2M e comparativo ano a ano · atualização em tempo real
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-blue-200">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>≥100%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>70-99%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>&lt;70%</span>
                </div>
              </div>
            </div>
            <PromessaMensal />
            <PromessaSemanal />
            <FaturamentoOntemCanal />
            <PromessaVendedores />
            <VendedoresMensal />
            <ComparativoAnual />
          </div>
        )}

        {/* ─────────────── Aba: MÉTRICAS DIRETORIA ─────────────── */}
        {aba === 'metricas-diretoria' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#1a0b3d] via-[#3b1d70] to-[#1a0b3d] text-white rounded-xl px-5 py-4 shadow-md flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2.5 rounded-lg">
                  <Crown size={20} weight="duotone" className="text-amber-300" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Métricas Diretoria</h2>
                  <p className="text-xs text-purple-200 mt-0.5">
                    Visão executiva consolidada · faturamento de ontem por loja e por vendedor
                  </p>
                </div>
              </div>
            </div>
            {(() => {
              const hoje = new Date();
              const ontem = new Date(hoje);
              ontem.setDate(ontem.getDate() - 1);
              while (ontem.getDay() === 0) ontem.setDate(ontem.getDate() - 1);
              const fimOntem = toLocalIso(ontem);
              const segunda = new Date(hoje);
              const dow = segunda.getDay() === 0 ? 7 : segunda.getDay();
              segunda.setDate(segunda.getDate() - (dow - 1));
              // Se hoje é segunda (dow=1), a semana corrente acabou de começar
              // e fimOntem aponta pro sábado anterior — voltamos 7 dias pra
              // mostrar a semana COMPLETA que acabou (seg→sáb anterior).
              if (toLocalIso(segunda) > fimOntem) {
                segunda.setDate(segunda.getDate() - 7);
              }
              const iniSemana = toLocalIso(segunda);
              const iniMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
              return (
                <>
                  <FaturamentoOntemVendedorLoja
                    titulo="Faturamento Detalhado por Canal — Mês Atual"
                    datemin={iniMes}
                    datemax={fimOntem}
                    periodo="mes"
                    corHeader="amber"
                    cacheOnly
                  />
                  <FaturamentoOntemVendedorLoja
                    titulo="Faturamento Detalhado por Canal — Semana Atual"
                    datemin={iniSemana}
                    datemax={fimOntem}
                    periodo="semana"
                    corHeader="blue"
                    cacheOnly
                    delayMs={30000}
                  />
                  <FaturamentoOntemVendedorLoja
                    titulo="Faturamento Detalhado por Canal — Ontem"
                    periodo="ontem"
                    corHeader="emerald"
                    cacheOnly
                    delayMs={60000}
                  />
                </>
              );
            })()}
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

      {/* Modal: gasto WhatsApp por número/conta */}
      {modalWppDetail && custoWpp && (
        <ModalWhatsappPorNumero
          custoWpp={custoWpp}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onClose={() => setModalWppDetail(false)}
        />
      )}

      {/* Modal: ROI / ROAS por canal */}
      {modalROI && resultado && (() => {
        const CANAIS_EXIBIR = ['varejo', 'revenda', 'multimarcas', 'inbound_david', 'inbound_rafael'];
        const labelMap = {
          varejo: 'Varejo',
          revenda: 'Revenda',
          multimarcas: 'Multimarcas',
          inbound_david: 'MTM Inbound David',
          inbound_rafael: 'MTM Inbound Rafael',
        };
        const corPorCanal = {
          varejo: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
          revenda: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
          multimarcas: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
          inbound_david: { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200' },
          inbound_rafael: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200' },
        };
        // Receita por canal (resultado.por_canal pode vir com diferentes shapes)
        const receitaPorCanal = {};
        const segs = resultado.segmentos || resultado.por_canal || {};
        if (Array.isArray(resultado.canais)) {
          for (const c of resultado.canais) {
            const k = c.canal || c.canal_key || c.key;
            if (k) receitaPorCanal[k] = Number(c.valor || c.fat_realizado || c.realizado || 0);
          }
        } else {
          for (const [k, v] of Object.entries(segs)) {
            receitaPorCanal[k] = Number(typeof v === 'object' ? (v.total || v.valor || 0) : v);
          }
        }
        // Custo marketing por canal
        const wppByCanal = custoWpp?.by_canal || {};
        const adsByCanal = custoAds?.by_canal || {};
        // Receita de novos clientes por canal (do /clientes-por-canal)
        const novosPorCanal = clientesCanal || {};
        const linhas = CANAIS_EXIBIR.map((c) => {
          const receita = Number(receitaPorCanal[c] || 0);
          // Receita só de clientes novos no período
          const receitaNovos = Number(novosPorCanal[c]?.receita_novos || 0);
          const wpp = Number(wppByCanal[c]?.costBRL ?? ((wppByCanal[c]?.cost ?? 0) * 5.8)) || 0;
          const ads = Number(adsByCanal[c]?.spend || 0);
          // ROAS por fonte × público (4 métricas):
          //   Wpp Novos = receita_novos / custo_wpp
          //   Wpp Total = receita_total / custo_wpp
          //   Ads Novos = receita_novos / custo_ads
          //   Ads Total = receita_total / custo_ads
          const roasWppNovos = wpp > 0 ? receitaNovos / wpp : null;
          const roasWppTotal = wpp > 0 ? receita / wpp : null;
          const roasAdsNovos = ads > 0 ? receitaNovos / ads : null;
          const roasAdsTotal = ads > 0 ? receita / ads : null;
          return {
            canal: c, receita, receitaNovos, wpp, ads,
            roasWppNovos, roasWppTotal, roasAdsNovos, roasAdsTotal,
          };
          // Critério único de ordenação: maior (wpp+ads)/receita combinado.
          // Antes misturava wpp vs ads dependendo de qual existia, gerando
          // ranking instável quando canais tinham fontes diferentes.
        }).sort((a, b) => {
          const inv = (l) => (l.wpp + l.ads) > 0 ? l.receita / (l.wpp + l.ads) : 0;
          return inv(b) - inv(a);
        });
        const totReceita = linhas.reduce((s, l) => s + l.receita, 0);
        const totReceitaNovos = linhas.reduce((s, l) => s + l.receitaNovos, 0);
        const totWpp = linhas.reduce((s, l) => s + l.wpp, 0);
        const totAds = linhas.reduce((s, l) => s + l.ads, 0);
        // ROAS consolidados
        const roasWppNovosGeral = totWpp > 0 ? totReceitaNovos / totWpp : 0;
        const roasWppTotalGeral = totWpp > 0 ? totReceita / totWpp : 0;
        const roasAdsNovosGeral = totAds > 0 ? totReceitaNovos / totAds : 0;
        const roasAdsTotalGeral = totAds > 0 ? totReceita / totAds : 0;
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModalROI(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-cyan-700 via-cyan-800 to-cyan-700 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold">ROAS por Canal</h3>
                  <p className="text-xs text-cyan-200 mt-0.5">
                    {dataInicio} → {dataFim} · WhatsApp API e Tráfego (Meta Ads) · novos clientes vs total
                  </p>
                </div>
                <button
                  onClick={() => setModalROI(false)}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {/* Totais geral — 4 cards: Wpp Novos, Wpp Total, Ads Novos, Ads Total */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-yellow-50 rounded-xl p-4 ring-1 ring-yellow-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-yellow-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                      ROAS Wpp · Novos
                    </p>
                    <p className="text-2xl font-extrabold text-yellow-900 tabular-nums mt-1">
                      {totWpp > 0 ? `${roasWppNovosGeral.toFixed(2)}x` : '—'}
                    </p>
                    <p className="text-[10px] text-yellow-600 mt-0.5">
                      receita novos ÷ wpp
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 ring-1 ring-amber-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      ROAS Wpp · Total
                    </p>
                    <p className="text-2xl font-extrabold text-amber-900 tabular-nums mt-1">
                      {totWpp > 0 ? `${roasWppTotalGeral.toFixed(2)}x` : '—'}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      receita total ÷ wpp
                    </p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-4 ring-1 ring-violet-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-violet-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                      ROAS Ads · Novos
                    </p>
                    <p className="text-2xl font-extrabold text-violet-900 tabular-nums mt-1">
                      {totAds > 0 ? `${roasAdsNovosGeral.toFixed(2)}x` : '—'}
                    </p>
                    <p className="text-[10px] text-violet-600 mt-0.5">
                      receita novos ÷ ads
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 ring-1 ring-purple-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-purple-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                      ROAS Ads · Total
                    </p>
                    <p className="text-2xl font-extrabold text-purple-900 tabular-nums mt-1">
                      {totAds > 0 ? `${roasAdsTotalGeral.toFixed(2)}x` : '—'}
                    </p>
                    <p className="text-[10px] text-purple-600 mt-0.5">
                      receita total ÷ ads
                    </p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 mb-5 ring-1 ring-blue-200">
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    <b>Receita total:</b> R$ {formatBRL(totReceita)}
                    <span className="text-emerald-700"> · Novos: R$ {formatBRL(totReceitaNovos)}</span>
                    <span> · </span>
                    <b>Investimento:</b> WhatsApp R$ {formatBRL(totWpp)} + Ads R$ {formatBRL(totAds)}
                  </p>
                </div>
                {/* Tabela por canal — 4 colunas ROAS */}
                <div className="space-y-2">
                  {linhas.map((l) => {
                    const cor = corPorCanal[l.canal] || { bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200' };
                    const corRoas = (v) => v == null ? 'text-gray-300' : (v >= 1 ? 'text-emerald-700' : 'text-rose-700');
                    return (
                      <div
                        key={l.canal}
                        className={`${cor.bg} ring-1 ${cor.ring} rounded-xl px-4 py-3`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                          <div className="min-w-0">
                            <p className={`text-sm font-bold ${cor.text}`}>{labelMap[l.canal]}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Total R$ {formatBRL(l.receita)}
                              <span className="text-emerald-700"> · Novos R$ {formatBRL(l.receitaNovos)}</span>
                              <span className="text-gray-400"> · Wpp R$ {formatBRL(l.wpp)} + Ads R$ {formatBRL(l.ads)}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* ROAS Wpp Novos */}
                            <div className="text-right border-r border-gray-300 pr-2 min-w-[60px]">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-yellow-700 flex items-center justify-end gap-1">
                                <span className="w-1 h-1 rounded-full bg-yellow-500"></span>
                                Wpp Novos
                              </p>
                              <p className={`text-base font-extrabold tabular-nums ${corRoas(l.roasWppNovos)}`}>
                                {l.roasWppNovos != null ? `${l.roasWppNovos.toFixed(2)}x` : '—'}
                              </p>
                            </div>
                            {/* ROAS Wpp Total */}
                            <div className="text-right border-r border-gray-300 pr-2 min-w-[60px]">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-amber-700 flex items-center justify-end gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-600"></span>
                                Wpp Total
                              </p>
                              <p className={`text-base font-extrabold tabular-nums ${corRoas(l.roasWppTotal)}`}>
                                {l.roasWppTotal != null ? `${l.roasWppTotal.toFixed(2)}x` : '—'}
                              </p>
                            </div>
                            {/* ROAS Ads Novos */}
                            <div className="text-right border-r border-gray-300 pr-2 min-w-[60px]">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-violet-700 flex items-center justify-end gap-1">
                                <span className="w-1 h-1 rounded-full bg-violet-500"></span>
                                Ads Novos
                              </p>
                              <p className={`text-base font-extrabold tabular-nums ${corRoas(l.roasAdsNovos)}`}>
                                {l.roasAdsNovos != null ? `${l.roasAdsNovos.toFixed(2)}x` : '—'}
                              </p>
                            </div>
                            {/* ROAS Ads Total */}
                            <div className="text-right min-w-[60px]">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-purple-700 flex items-center justify-end gap-1">
                                <span className="w-1 h-1 rounded-full bg-purple-600"></span>
                                Ads Total
                              </p>
                              <p className={`text-base font-extrabold tabular-nums ${corRoas(l.roasAdsTotal)}`}>
                                {l.roasAdsTotal != null ? `${l.roasAdsTotal.toFixed(2)}x` : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-[11px] text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
                  <p><b>ROAS</b> = Receita ÷ Investimento · acima de 1x = receita maior que investimento.</p>
                  <p><b className="text-yellow-700">Novos</b> usa receita só dos clientes cuja PRIMEIRA NF no canal está dentro do período. <b className="text-amber-700">Total</b> usa receita de todos os clientes no período. Canais sem investimento aparecem como —.</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: clientes ativos/novos por canal */}
      {modalClientesCanal && clientesCanal && (() => {
        const CANAIS_EXIBIR = ['varejo', 'revenda', 'multimarcas', 'inbound_david', 'inbound_rafael'];
        const labelMap = {
          varejo: 'Varejo',
          revenda: 'Revenda',
          multimarcas: 'Multimarcas',
          inbound_david: 'MTM Inbound David',
          inbound_rafael: 'MTM Inbound Rafael',
        };
        const corPorCanal = {
          varejo: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
          revenda: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
          multimarcas: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
          inbound_david: { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200' },
          inbound_rafael: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200' },
        };
        const linhas = CANAIS_EXIBIR
          .map((c) => ({ canal: c, ...(clientesCanal[c] || { ativos: 0, novos: 0, total_clientes_periodo: 0, janela_dias: 60 }) }))
          .sort((a, b) => b.ativos - a.ativos);
        const totAtivos = linhas.reduce((s, l) => s + l.ativos, 0);
        const totNovos = linhas.reduce((s, l) => s + l.novos, 0);
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModalClientesCanal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-700 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold">Clientes por Canal</h3>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    {dataInicio} → {dataFim} · ativos = NF na janela do canal · novos = 1ª compra no mês atual
                  </p>
                </div>
                <button
                  onClick={() => setModalClientesCanal(false)}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {/* Totais */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-emerald-50 rounded-xl p-4 ring-1 ring-emerald-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Total Ativos</p>
                    <p className="text-2xl font-extrabold text-emerald-900 tabular-nums mt-1">{totAtivos.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">clientes com NF na janela do canal</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 ring-1 ring-amber-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Total Novos</p>
                    <p className="text-2xl font-extrabold text-amber-900 tabular-nums mt-1">+{totNovos.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">1ª compra no mês atual ({dataInicio.slice(0,7)})</p>
                  </div>
                </div>
                {/* Linhas por canal — todas clicáveis pra abrir recompra detalhada */}
                <div className="space-y-2">
                  {linhas.map((l) => {
                    const cor = corPorCanal[l.canal] || { bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200' };
                    const dimLabel = l.canal === 'varejo' ? 'loja' : 'vendedor';
                    return (
                      <div
                        key={l.canal}
                        role="button"
                        tabIndex={0}
                        onClick={async () => {
                          setModalRecompraCanal({ canal: l.canal, label: labelMap[l.canal] });
                          setAbaRecompra('breakdown');
                          setFiltroStatusCliente('todos');
                          setVendedorExpandido(null);
                          if (!recompraCanal[l.canal]) {
                            setLoadingRecompra(true);
                            try {
                              const r = await apiPost('/api/crm/recompra-por-canal', {
                                canal: l.canal, datemin: dataInicio, datemax: dataFim,
                              });
                              setRecompraCanal((prev) => ({ ...prev, [l.canal]: r }));
                            } catch (e) {
                              console.warn(`recompra-por-canal ${l.canal} erro:`, e?.message);
                            } finally {
                              setLoadingRecompra(false);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
                        }}
                        className={`${cor.bg} ring-1 ${cor.ring} rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:ring-2 hover:ring-blue-400 transition`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${cor.text}`}>
                            {labelMap[l.canal]}
                            <span className="ml-2 text-[10px] font-medium text-blue-600">→ clique para ver recompra por {dimLabel}</span>
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Janela ativos: {l.janela_dias} dias · {l.total_clientes_periodo?.toLocaleString('pt-BR')} compraram no período
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500">Ativos</p>
                            <p className={`text-lg font-extrabold tabular-nums ${cor.text}`}>{l.ativos.toLocaleString('pt-BR')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-amber-600">Novos</p>
                            <p className="text-lg font-extrabold tabular-nums text-amber-700">+{l.novos.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal aninhado: recompra por canal (loja ou vendedor) */}
      {modalRecompraCanal && (() => {
        const d = recompraCanal[modalRecompraCanal.canal];
        const dimNome = d?.label_dim || (modalRecompraCanal.canal === 'varejo' ? 'Loja' : 'Vendedor');
        const dimLabelLower = dimNome.toLowerCase();
        const conector = dimNome === 'Loja' ? 'na mesma' : 'com o mesmo';
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setModalRecompraCanal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-700 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold">Taxa de Recompra — {modalRecompraCanal.label} por {dimNome}</h3>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    {d?.periodo?.datemin || dataInicio} → {d?.periodo?.datemax || dataFim} · recorrentes = compraram {conector} {dimLabelLower} nos 365 dias anteriores
                  </p>
                </div>
                <button
                  onClick={() => setModalRecompraCanal(null)}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>
              {/* Abas: Por Vendedor/Loja · Clientes (canais não-varejo) */}
              {modalRecompraCanal.canal !== 'varejo' && (
                <div className="px-6 pt-3 bg-white border-b border-gray-100 flex gap-1">
                  {[
                    { key: 'breakdown', label: `Por ${dimNome}` },
                    { key: 'clientes', label: 'Clientes' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={async () => {
                        setAbaRecompra(t.key);
                        if (t.key === 'clientes' && !clientesCanalDetalhe[modalRecompraCanal.canal]) {
                          setLoadingClientesDetalhe(true);
                          try {
                            const r = await apiPost('/api/crm/clientes-do-canal', {
                              canal: modalRecompraCanal.canal,
                              datemin: dataInicio,
                              datemax: dataFim,
                            });
                            setClientesCanalDetalhe((prev) => ({ ...prev, [modalRecompraCanal.canal]: r }));
                          } catch (e) {
                            console.warn(`clientes-do-canal ${modalRecompraCanal.canal} erro:`, e?.message);
                          } finally {
                            setLoadingClientesDetalhe(false);
                          }
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 ${
                        abaRecompra === t.key
                          ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
                {/* ─── ABA CLIENTES ─── */}
                {abaRecompra === 'clientes' && modalRecompraCanal.canal !== 'varejo' && (() => {
                  if (loadingClientesDetalhe) {
                    return <div className="text-center py-12 text-gray-500">Carregando clientes…</div>;
                  }
                  const cd = clientesCanalDetalhe[modalRecompraCanal.canal];
                  if (!cd || !cd.clientes) {
                    return <div className="text-center py-12 text-gray-400 text-sm">Sem dados disponíveis.</div>;
                  }
                  const clientesAll = cd.clientes || [];
                  const filtrados = clientesAll.filter((c) => {
                    if (filtroStatusCliente === 'novos') return c.is_novo;
                    if (filtroStatusCliente === 'recorrentes') return c.is_recorrente;
                    return true;
                  });
                  return (
                    <>
                      {/* Aviso de sub-sincronização */}
                      {cd.sub_sync_warning && (
                        <div className="mb-4 bg-amber-50 ring-1 ring-amber-300 rounded-xl p-3 flex items-start gap-2.5">
                          <span className="text-amber-600 mt-0.5">⚠️</span>
                          <div className="flex-1 text-xs leading-relaxed text-amber-900">
                            <p className="font-bold">Lista parcial — Supabase sub-sincronizado</p>
                            <p className="text-amber-800 mt-0.5">
                              Soma das NFs no Supabase: <b>R$ {Number(cd.sub_sync_warning.supabase_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b><br/>
                              Faturamento real do canal (TOTVS): <b>R$ {Number(cd.sub_sync_warning.canal_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b><br/>
                              Faltam <b>R$ {Number(cd.sub_sync_warning.diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> ({cd.sub_sync_warning.diff_pct.toFixed(1)}%) de NFs ainda não sincronizadas. O sync rodará no próximo ciclo.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* KPIs Clientes */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-emerald-50 rounded-xl p-3 ring-1 ring-emerald-200">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Total Clientes</p>
                          <p className="text-2xl font-extrabold text-emerald-900 tabular-nums mt-1">{cd.total_clientes?.toLocaleString('pt-BR') || 0}</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-3 ring-1 ring-purple-200">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-purple-700">Recorrentes</p>
                          <p className="text-2xl font-extrabold text-purple-900 tabular-nums mt-1">{cd.total_recorrentes?.toLocaleString('pt-BR') || 0}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 ring-1 ring-amber-200">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Novos</p>
                          <p className="text-2xl font-extrabold text-amber-900 tabular-nums mt-1">+{cd.total_novos?.toLocaleString('pt-BR') || 0}</p>
                        </div>
                      </div>
                      {/* Chips de filtro */}
                      <div className="flex gap-2 mb-3">
                        {[
                          { k: 'todos', label: `Todos (${clientesAll.length})`, cor: 'bg-gray-100 text-gray-700' },
                          { k: 'recorrentes', label: `Recorrentes (${cd.total_recorrentes})`, cor: 'bg-purple-100 text-purple-700' },
                          { k: 'novos', label: `Novos (${cd.total_novos})`, cor: 'bg-amber-100 text-amber-700' },
                        ].map((f) => (
                          <button
                            key={f.k}
                            onClick={() => setFiltroStatusCliente(f.k)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold ring-1 transition ${
                              filtroStatusCliente === f.k
                                ? `${f.cor} ring-current/30 shadow-sm`
                                : 'bg-white text-gray-400 ring-gray-200 hover:ring-gray-300'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      {/* Lista de clientes */}
                      <div className="space-y-1.5">
                        {filtrados.map((c) => (
                          <div key={c.person_code} className="bg-white ring-1 ring-gray-100 hover:ring-emerald-300 rounded-lg px-3 py-2 flex items-center gap-3 transition">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-800 truncate">{c.person_name}</p>
                                {c.is_novo ? (
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 tracking-wider">Novo</span>
                                ) : (
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 tracking-wider">Recorrente</span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                #{c.person_code}
                                {c.vendedor_nome && <> · <span className="text-emerald-700 font-semibold">{c.vendedor_nome}</span></>}
                                · {c.num_nfs} NF{c.num_nfs > 1 ? 's' : ''} · última {c.last_purchase}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Total</p>
                              <p className="text-sm font-extrabold tabular-nums text-gray-800">R$ {Number(c.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        ))}
                        {filtrados.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-sm">Nenhum cliente nessa categoria.</div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* ─── ABA BREAKDOWN (por loja/vendedor) ─── */}
                {abaRecompra === 'breakdown' && loadingRecompra && (
                  <div className="text-center py-12 text-gray-500">Carregando…</div>
                )}
                {abaRecompra === 'breakdown' && !loadingRecompra && d && (() => {
                  const itens = d.itens || [];
                  return (
                    <>
                      {/* KPIs — mesmo estilo do modal pai */}
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="bg-emerald-50 rounded-xl p-4 ring-1 ring-emerald-200">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Taxa Geral</p>
                          <p className="text-2xl font-extrabold text-emerald-900 tabular-nums mt-1">{(d.taxa_geral || 0).toFixed(1)}%</p>
                          <p className="text-[10px] text-emerald-600 mt-0.5">média ponderada do canal</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 ring-1 ring-blue-200">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700">Clientes Ativos</p>
                          <p className="text-2xl font-extrabold text-blue-900 tabular-nums mt-1">{(d.total_ativos || 0).toLocaleString('pt-BR')}</p>
                          <p className="text-[10px] text-blue-600 mt-0.5">únicos no período</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4 ring-1 ring-purple-200">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-purple-700">Recorrentes</p>
                          <p className="text-2xl font-extrabold text-purple-900 tabular-nums mt-1">{(d.total_recorrentes || 0).toLocaleString('pt-BR')}</p>
                          <p className="text-[10px] text-purple-600 mt-0.5">já compraram antes</p>
                        </div>
                      </div>

                      {/* Lista por loja/vendedor — clica pra expandir clientes */}
                      <div className="space-y-2">
                        {itens.map((it) => {
                          const high = it.taxa >= 60;
                          const mid = it.taxa >= 40 && it.taxa < 60;
                          const corTaxa = high ? 'text-emerald-700' : mid ? 'text-amber-700' : 'text-rose-700';
                          const corBar = high ? 'bg-emerald-500' : mid ? 'bg-amber-500' : 'bg-rose-500';
                          const corRing = high ? 'ring-emerald-200' : mid ? 'ring-amber-200' : 'ring-rose-200';
                          const corBg = high ? 'bg-emerald-50' : mid ? 'bg-amber-50' : 'bg-rose-50';
                          const expandido = vendedorExpandido === it.key;
                          const cdAtual = clientesCanalDetalhe[modalRecompraCanal.canal];
                          // `it.key` pode ser string ('GERAL' = bucket credev) ou
                          // numérico (dealer_code). Compara como string pra que
                          // 'GERAL' não vire NaN no === e o bucket expanda corretamente.
                          const clientesDoItem = (cdAtual?.clientes || []).filter((c) =>
                            d.dim === 'branch' ? false : String(c.dealer_code) === String(it.key)
                          );
                          return (
                            <div key={it.key}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={async () => {
                                  if (d.dim === 'branch') return; // varejo não expande (muitos clientes)
                                  const novo = expandido ? null : it.key;
                                  setVendedorExpandido(novo);
                                  // Garante que a lista de clientes está carregada
                                  if (novo != null && !cdAtual) {
                                    setLoadingClientesDetalhe(true);
                                    try {
                                      const r = await apiPost('/api/crm/clientes-do-canal', {
                                        canal: modalRecompraCanal.canal,
                                        datemin: dataInicio,
                                        datemax: dataFim,
                                      });
                                      setClientesCanalDetalhe((prev) => ({ ...prev, [modalRecompraCanal.canal]: r }));
                                    } catch (e) {
                                      console.warn('clientes-do-canal erro:', e?.message);
                                    } finally {
                                      setLoadingClientesDetalhe(false);
                                    }
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
                                }}
                                className={`${corBg} ring-1 ${corRing} rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
                                  d.dim === 'branch' ? '' : 'cursor-pointer hover:ring-2 hover:ring-emerald-400 transition'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-bold ${corTaxa} flex items-center gap-2`}>
                                    {d.dim !== 'branch' && (
                                      <span className={`inline-block transition-transform ${expandido ? 'rotate-90' : ''}`}>▶</span>
                                    )}
                                    {it.name}
                                    {d.dim !== 'branch' && !expandido && (
                                      <span className="ml-1 text-[10px] font-medium text-gray-500">clique para ver clientes</span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {d.dim === 'branch' ? 'Filial' : 'Vendedor'} {it.key} · {it.ativos.toLocaleString('pt-BR')} clientes ativos
                                  </p>
                                  <div className="w-full h-1 bg-white/70 rounded-full overflow-hidden mt-2">
                                    <div className={`h-full ${corBar}`} style={{ width: `${Math.min(100, it.taxa)}%` }} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 shrink-0">
                                  <div className="text-right">
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-purple-600">Recor.</p>
                                    <p className="text-lg font-extrabold tabular-nums text-purple-700">{it.recorrentes.toLocaleString('pt-BR')}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-amber-600">Novos</p>
                                    <p className="text-lg font-extrabold tabular-nums text-amber-700">+{it.novos.toLocaleString('pt-BR')}</p>
                                  </div>
                                  <div className="text-right min-w-[70px]">
                                    <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500">Taxa</p>
                                    <p className={`text-lg font-extrabold tabular-nums ${corTaxa}`}>{it.taxa.toFixed(1)}%</p>
                                  </div>
                                </div>
                              </div>
                              {/* Expansão: clientes do vendedor */}
                              {expandido && d.dim !== 'branch' && (
                                <div className="mt-1.5 mb-2 pl-4 pr-1 py-2 bg-white ring-1 ring-gray-100 rounded-lg space-y-1.5">
                                  {cdAtual?.sub_sync_warning && (
                                    <div className="mb-1.5 px-2 py-1.5 bg-amber-50 ring-1 ring-amber-200 rounded text-[10px] text-amber-800 leading-tight">
                                      ⚠️ Lista do Supabase pode estar parcial — faltam <b>R$ {Number(cdAtual.sub_sync_warning.diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> ({cdAtual.sub_sync_warning.diff_pct.toFixed(1)}%) de NFs ainda não sincronizadas
                                    </div>
                                  )}
                                  {loadingClientesDetalhe && !cdAtual && (
                                    <p className="text-center text-xs text-gray-400 py-3">Carregando clientes…</p>
                                  )}
                                  {cdAtual && clientesDoItem.length === 0 && (
                                    <p className="text-center text-xs text-gray-400 py-3">Sem clientes detalhados desse vendedor (pode estar sub-sincronizado).</p>
                                  )}
                                  {cdAtual && clientesDoItem.map((c) => (
                                    <div key={c.person_code} className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 rounded">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-xs font-bold text-gray-800 truncate">{c.person_name}</p>
                                          {c.is_novo ? (
                                            <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 tracking-wider">Novo</span>
                                          ) : (
                                            <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 tracking-wider">Recorrente</span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-0.5">#{c.person_code} · {c.num_nfs} NF{c.num_nfs > 1 ? 's' : ''} · última {c.last_purchase}</p>
                                      </div>
                                      <p className="text-xs font-extrabold tabular-nums text-gray-800 shrink-0">
                                        R$ {Number(c.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {itens.length === 0 && (
                          <div className="text-center py-12 text-gray-400 text-sm">
                            Sem clientes ativos no período.
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-gray-500 mt-4 italic">
                        Histórico: {d.historico?.datemin} → {d.historico?.datemax} (365 dias antes do período).
                        Faixas: <span className="text-emerald-700 font-semibold">≥60%</span> · <span className="text-amber-700 font-semibold">40-60%</span> · <span className="text-rose-700 font-semibold">&lt;40%</span>.
                      </p>
                    </>
                  );
                })()}
                {!loadingRecompra && !d && (
                  <div className="text-center py-12 text-gray-500">
                    Sem dados de recompra disponíveis.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
