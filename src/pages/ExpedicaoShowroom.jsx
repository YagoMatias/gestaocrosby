// Expedição Showroom — controle de envio das NFs showroom/novidades
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package,
  MagnifyingGlass,
  ArrowsClockwise,
  Download,
  Truck,
  CheckCircle,
  XCircle,
  AirplaneTilt,
  EnvelopeSimple,
  HandHeart,
  Storefront,
  Car,
  Motorcycle,
  User,
  WhatsappLogo,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import useFreshFetch from '../hooks/useFreshFetch';
import PageTitle from '../components/ui/PageTitle';

const STATUS_OPTIONS = [
  { v: '', label: 'Todos', cor: 'bg-slate-100 text-slate-700 ring-slate-200', row: '', dot: 'bg-slate-400', border: 'border-slate-300' },
  { v: 'enviado_blue',    label: 'Enviado p/ Blue',   cor: 'bg-blue-100 text-blue-700 ring-blue-200',       row: 'bg-blue-50/40 hover:bg-blue-50',       dot: 'bg-blue-500',    border: 'border-blue-500' },
  { v: 'recebido_blue',   label: 'Recebido na Blue',  cor: 'bg-amber-100 text-amber-700 ring-amber-200',    row: 'bg-amber-50/40 hover:bg-amber-50',     dot: 'bg-amber-500',   border: 'border-amber-500' },
  { v: 'enviado_cliente', label: 'Enviado p/ Cliente',cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200', row: 'bg-emerald-50/40 hover:bg-emerald-50', dot: 'bg-emerald-500', border: 'border-emerald-500' },
];
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.v, s]));

const TRANSPORTADORAS = [
  { v: '',          label: '—' },
  { v: 'latam',     label: 'LATAM',     icon: AirplaneTilt, cor: 'text-rose-700' },
  { v: 'azul',      label: 'Azul',      icon: AirplaneTilt, cor: 'text-blue-700' },
  { v: 'correios',  label: 'Correios',  icon: EnvelopeSimple, cor: 'text-yellow-700' },
  { v: 'retirada',  label: 'Retirada',  icon: Storefront,   cor: 'text-purple-700' },
  { v: 'taxista',   label: 'Taxista',   icon: Car,          cor: 'text-orange-700' },
  { v: 'paulao',    label: 'Paulão',    icon: User,         cor: 'text-emerald-700' },
  { v: 'bee',       label: 'Bee',       icon: Motorcycle,   cor: 'text-amber-600' },
  { v: 'uber',      label: 'Uber',      icon: Car,          cor: 'text-gray-800' },
];
const TRANSP_MAP = Object.fromEntries(TRANSPORTADORAS.map((t) => [t.v, t]));

function fmtBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}
// Formata timestamp pra "DD/MM HH:mm" em BRT
function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

// Monta a URL do WhatsApp com mensagem pré-preenchida pra franquia.
// Sem telefone fixo — abre o seletor de contato do WhatsApp Web.
function buildWhatsappUrl(item) {
  const loja = item.person_fantasy_name || item.person_name || '';
  const transacao = item.transaction_code || item.invoice_code || '';
  const statusLabel = {
    enviado_blue: 'Enviado para Blue',
    recebido_blue: 'Recebido na Blue',
    enviado_cliente: 'Enviado para o cliente',
  }[item.status] || item.status || '';
  const transpLabel = {
    latam: 'LATAM', azul: 'Azul', correios: 'Correios',
    retirada: 'Retirada', taxista: 'Taxista', paulao: 'Paulão',
  }[item.transportadora] || (item.transportadora || '—');
  const rastreio = item.codigo_rastreio || '';
  const caixas = item.volume_caixas || 0;

  const msg =
`Olá, ${loja}! 👋

Atualização do seu pedido *${transacao}*:

📦 Status: *${statusLabel}*
🚚 Transportadora: *${transpLabel}*
📍 Código de rastreio: *${rastreio}*
📐 Volume: ${caixas} ${caixas === 1 ? 'caixa' : 'caixas'}

Qualquer dúvida estamos à disposição.
— Equipe Crosby`;

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

export default function ExpedicaoShowroom() {
  // itemsAll = NFs SEM filtro de status (alimenta os KPIs). O status é
  // filtrado APENAS no frontend pra evitar bug: quando filtrado no backend,
  // os outros KPIs zeravam (porque eram derivados de items já filtrado).
  const [itemsAll, setItemsAll] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [erro, setErro] = useState('');
  // Filtros — data_inicio/data_fim defaultam pro mês corrente
  const [filtros, setFiltros] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return {
      status: '', transportadora: '', busca: '',
      dataInicio: `${yyyy}-${mm}-01`,
      dataFim: `${yyyy}-${mm}-${dd}`,
    };
  });
  const { run, isStale } = useFreshFetch();

  const carregar = useCallback(async () => {
    const tok = run();
    setLoading(true);
    setErro('');
    try {
      // NÃO manda filtro de status pro backend — frontend aplica abaixo.
      const qs = new URLSearchParams();
      if (filtros.transportadora) qs.set('transportadora', filtros.transportadora);
      if (filtros.busca) qs.set('busca', filtros.busca);
      if (filtros.dataInicio) qs.set('data_inicio', filtros.dataInicio);
      if (filtros.dataFim) qs.set('data_fim', filtros.dataFim);
      const r = await fetch(`${API_BASE_URL}/api/expedicao-showroom?${qs}`);
      const j = await r.json();
      if (isStale(tok)) return;
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setItemsAll(j.items || []);
      setTotal(j.total || 0);
    } catch (e) {
      if (isStale(tok)) return;
      setErro(e.message);
    } finally {
      if (!isStale(tok)) setLoading(false);
    }
    // Dep só busca/transportadora/datas — status filtra no frontend.
  }, [filtros.transportadora, filtros.busca, filtros.dataInicio, filtros.dataFim, run, isStale]);

  useEffect(() => {
    const id = setTimeout(carregar, 300);
    return () => clearTimeout(id);
  }, [carregar]);

  // ─── Credev de franquia do mês corrente ───────────────────────────────
  // Busca em /faturamento-por-segmento que retorna `credev_por_segmento.franquia`.
  const [credevFranquia, setCredevFranquia] = useState(null);
  const [credevLoading, setCredevLoading] = useState(true);
  const credevFetch = useFreshFetch();
  const carregarCredev = useCallback(async () => {
    if (!filtros.dataInicio || !filtros.dataFim) return;
    const tok = credevFetch.run();
    setCredevLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/crm/faturamento-por-segmento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datemin: filtros.dataInicio, datemax: filtros.dataFim }),
      });
      const j = await r.json();
      if (credevFetch.isStale(tok)) return;
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      const val = Number(
        j?.data?.credev_por_segmento?.franquia ??
        j?.credev_por_segmento?.franquia ??
        0,
      );
      setCredevFranquia(val);
    } catch (_) {
      if (credevFetch.isStale(tok)) return;
      setCredevFranquia(0);
    } finally {
      if (!credevFetch.isStale(tok)) setCredevLoading(false);
    }
  }, [filtros.dataInicio, filtros.dataFim, credevFetch]);
  useEffect(() => { carregarCredev(); }, [carregarCredev]);

  // items = itemsAll filtrado por status no frontend.
  // KPIs continuam usando itemsAll (sem zerar quando troca status).
  const STATUS_CONHECIDOS_SET = useMemo(
    () => new Set(STATUS_OPTIONS.slice(1).map((s) => s.v)),
    [],
  );
  const items = useMemo(() => {
    if (!filtros.status) return itemsAll;
    if (filtros.status === '__sem_status__') {
      return itemsAll.filter((i) => !i.status || !STATUS_CONHECIDOS_SET.has(i.status));
    }
    return itemsAll.filter((i) => i.status === filtros.status);
  }, [itemsAll, filtros.status, STATUS_CONHECIDOS_SET]);

  const syncTotvs = async () => {
    if (!window.confirm('Puxar novas NFs de showroom/novidades do TOTVS dos últimos 60 dias?')) return;
    setSyncing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/expedicao-showroom/sync-totvs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      alert(`✅ Sync completo!\n\nTotal NFs: ${j.total_nfs}\nNovas: ${j.novos}\nAtualizadas: ${j.atualizados}\nPuladas (canceladas): ${j.pulados}`);
      carregar();
    } catch (e) {
      alert('❌ Falha no sync: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const atualizar = async (item, patch) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/expedicao-showroom/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setItemsAll((arr) => arr.map((x) => (x.id === item.id ? j.item : x)));
    } catch (e) {
      alert('Falha: ' + e.message);
    }
  };

  const exportarCsv = () => {
    if (!items.length) return;
    const headers = ['Loja', 'Transação', 'Data', 'Valor', 'Caixas', 'Peças', 'Status', 'Transportadora', 'Rastreio', 'Observação'];
    const rows = items.map((i) => [
      i.person_fantasy_name || i.person_name || '',
      i.transaction_code || i.invoice_code,
      fmtDate(i.issue_date),
      fmtBRL(i.total_value),
      i.volume_caixas || 0,
      i.volume_qty || 0,
      STATUS_MAP[i.status]?.label || i.status,
      TRANSP_MAP[i.transportadora]?.label || '',
      i.codigo_rastreio || '',
      i.observacao || '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expedicao-showroom-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // KPIs por status (incluindo "Sem status").
  // Derivam de `itemsAll` (sem filtro de status no front) — assim, ao clicar
  // num card pra filtrar a tabela, os outros KPIs NÃO zeram.
  const semStatusItems = itemsAll.filter((i) => !i.status || !STATUS_CONHECIDOS_SET.has(i.status));
  const kpis = [
    ...STATUS_OPTIONS.slice(1).map((s) => ({
      ...s,
      count: itemsAll.filter((i) => i.status === s.v).length,
      caixas: itemsAll.filter((i) => i.status === s.v).reduce((a, i) => a + (i.volume_caixas || 0), 0),
      pecas: itemsAll.filter((i) => i.status === s.v).reduce((a, i) => a + (i.volume_qty || 0), 0),
      valor: itemsAll.filter((i) => i.status === s.v).reduce((a, i) => a + Number(i.total_value || 0), 0),
    })),
    // 4º card: Sem status (NFs que ainda não foram classificadas)
    {
      v: '__sem_status__',
      label: 'Sem Status',
      cor: 'bg-gray-100 text-gray-700 ring-gray-200',
      row: '',
      dot: 'bg-gray-400',
      border: 'border-gray-400',
      count: semStatusItems.length,
      caixas: semStatusItems.reduce((a, i) => a + (i.volume_caixas || 0), 0),
      pecas: semStatusItems.reduce((a, i) => a + (i.volume_qty || 0), 0),
      valor: semStatusItems.reduce((a, i) => a + Number(i.total_value || 0), 0),
    },
  ];

  // Total faturado (soma de TODAS as NFs — não muda ao clicar nos KPIs)
  const totalFaturado = itemsAll.reduce((a, i) => a + Number(i.total_value || 0), 0);

  // Cor do dot baseado no status (pra usar no select inline)
  const k_dot = (st) => {
    if (st === 'enviado_blue') return 'bg-blue-500';
    if (st === 'recebido_blue') return 'bg-amber-500';
    if (st === 'enviado_cliente') return 'bg-emerald-500';
    return 'bg-gray-400';
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col items-stretch justify-start py-3 px-2 sm:px-4 font-barlow">
      <div>
        {/* Título centralizado (padrão das outras páginas) */}
        <PageTitle
          title="Expedição Franquias"
          subtitle="Controle de envios — Showroom + Novidades + Venda/Promo/Suframa · ops 7254 · 7007 · 7255 · 7234 · 7240 · 7259"
          icon={Package}
          iconColor="text-blue-600"
        />

        {/* Totais — Total NFs + Total Faturado + Credev Franquia (mês corrente) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Total NFs</p>
            <p className="text-3xl font-black text-[#000638] tabular-nums leading-none mt-1.5">{total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Total Faturado
            </p>
            <p className="text-3xl font-black text-emerald-600 tabular-nums leading-none mt-1.5">R$ {fmtBRL(totalFaturado)}</p>
            <p className="text-[10px] text-gray-500 mt-1.5">
              {items.length} {items.length === 1 ? 'pedido faturado' : 'pedidos faturados'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-rose-700 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Credev Franquia
            </p>
            <p className="text-3xl font-black text-rose-600 tabular-nums leading-none mt-1.5">
              {credevLoading ? (
                <span className="inline-block w-32 h-7 bg-rose-100 rounded animate-pulse" />
              ) : (
                <>R$ {fmtBRL(credevFranquia || 0)}</>
              )}
            </p>
            <p className="text-[10px] text-gray-500 mt-1.5">
              Devoluções/credev do mês corrente
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {kpis.map((k) => {
            const isSemStatus = k.v === '__sem_status__';
            const ativo = filtros.status === k.v;
            const colorGradient = isSemStatus
              ? 'from-gray-100 to-gray-50'
              : k.v === 'enviado_blue'
                ? 'from-blue-50 to-white'
                : k.v === 'recebido_blue'
                  ? 'from-amber-50 to-white'
                  : 'from-emerald-50 to-white';
            const accentColor = isSemStatus
              ? 'text-gray-500'
              : k.v === 'enviado_blue'
                ? 'text-blue-600'
                : k.v === 'recebido_blue'
                  ? 'text-amber-600'
                  : 'text-emerald-600';
            return (
              <button
                key={k.v}
                onClick={() => setFiltros((s) => ({ ...s, status: ativo ? '' : k.v }))}
                className={`group relative overflow-hidden text-left p-4 rounded-2xl border transition-all duration-200 ${
                  ativo
                    ? 'bg-gradient-to-br from-blue-50 to-white border-blue-300 shadow-lg ring-2 ring-blue-200/60 scale-[1.02]'
                    : `bg-gradient-to-br ${colorGradient} border-gray-200 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5`
                }`}
              >
                {/* glow decoration */}
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-current opacity-5 ${accentColor}`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${k.dot} ${ativo ? 'ring-2 ring-current ring-offset-1' : ''}`} />
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                        {k.label}
                      </p>
                    </div>
                    {ativo && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                        Filtrado
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className={`text-3xl font-black tabular-nums ${ativo ? 'text-blue-700' : 'text-gray-900'}`}>
                      {k.count}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">
                      NFs · <span className="text-gray-700">{k.caixas}</span> cx · <span className="text-gray-700">{k.pecas}</span> pç
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-200/60`}>
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${accentColor}`}>
                      Faturado
                    </span>
                    <span className={`text-base font-black tabular-nums ${accentColor}`}>
                      R$ {fmtBRL(k.valor)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl shadow-sm mb-4 p-3 flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por loja, transação ou rastreio…"
              value={filtros.busca}
              onChange={(e) => setFiltros((s) => ({ ...s, busca: e.target.value }))}
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition"
            />
          </div>
          {/* Filtro de data (faturamento) */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Faturamento</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros((s) => ({ ...s, dataInicio: e.target.value }))}
              max={filtros.dataFim || undefined}
              className="text-sm border border-gray-200 rounded-xl px-2.5 py-2.5 bg-gray-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer tabular-nums"
              title="Data inicial (issue_date)"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros((s) => ({ ...s, dataFim: e.target.value }))}
              min={filtros.dataInicio || undefined}
              className="text-sm border border-gray-200 rounded-xl px-2.5 py-2.5 bg-gray-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer tabular-nums"
              title="Data final (issue_date)"
            />
          </div>
          <div className="relative">
            <Truck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={filtros.transportadora}
              onChange={(e) => setFiltros((s) => ({ ...s, transportadora: e.target.value }))}
              className="text-sm border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 bg-gray-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <option value="">Todas transportadoras</option>
              {TRANSPORTADORAS.slice(1).map((t) => (
                <option key={t.v} value={t.v}>{t.label}</option>
              ))}
            </select>
          </div>
          <span className="h-8 w-px bg-gray-200 mx-1" />
          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 font-medium text-gray-700 transition"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} weight="bold" />
            Atualizar
          </button>
          <button
            onClick={syncTotvs}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
          >
            <Truck size={14} weight="fill" />
            {syncing ? 'Sincronizando…' : 'Puxar TOTVS'}
          </button>
          <button
            onClick={exportarCsv}
            disabled={!items.length}
            className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            <Download size={14} weight="bold" />
            CSV
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            Erro: {erro}
          </div>
        )}

        {/* Tabela — table-fixed pra evitar scroll horizontal */}
        <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div>
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-gradient-to-b from-slate-50 via-slate-50 to-white border-b-2 border-gray-200">
                  <th className="py-3.5 px-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-[18%]">Loja</th>
                  <th className="py-3.5 px-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-[11%]">Transação</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[8%]">Datas</th>
                  <th className="py-3.5 px-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest w-[8%]">Valor</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[8%]">Volume</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[13%]">Status</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[11%]">Transportadora</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[23%]">Rastreio</th>
                </tr>
              </thead>
              <tbody>
                {loading && !items.length ? (
                  <tr><td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                    <div className="inline-flex items-center gap-2">
                      <ArrowsClockwise size={18} className="animate-spin" />
                      Carregando…
                    </div>
                  </td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                    <div className="inline-flex flex-col items-center gap-3">
                      <Package size={32} weight="duotone" className="text-gray-300" />
                      <span>Nenhuma NF encontrada. Clique em <b>Puxar TOTVS</b> pra importar.</span>
                    </div>
                  </td></tr>
                ) : items.map((i) => {
                  const semStatus = !i.status;
                  const s = STATUS_MAP[i.status] || {
                    cor: 'bg-gray-100 text-gray-500 ring-gray-200',
                    row: 'bg-gray-50/40 hover:bg-gray-50',
                    border: 'border-gray-300',
                  };
                  const t = TRANSP_MAP[i.transportadora];
                  const Ticon = t?.icon;
                  const temRastreio = !!(i.codigo_rastreio && String(i.codigo_rastreio).trim());
                  const borderClass = s.border || 'border-transparent';
                  return (
                    <tr
                      key={i.id}
                      className={`border-b border-gray-100 transition-all duration-150 group ${s.row || 'hover:bg-blue-50/40 bg-white'}`}
                    >
                      <td className={`py-2.5 px-3 align-middle border-l-4 ${borderClass}`}>
                        <p className="font-semibold text-gray-900 text-sm leading-tight truncate" title={i.person_name || ''}>
                          {i.person_fantasy_name || i.person_name || '—'}
                        </p>
                        {i.person_fantasy_name && i.person_name && i.person_fantasy_name !== i.person_name && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={i.person_name}>
                            {i.person_name}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-0.5">Filial #{i.branch_code}{i.person_code ? ` · PC ${i.person_code}` : ''}</p>
                      </td>
                      <td className="py-2.5 px-3 text-xs align-middle">
                        <p className="font-mono text-gray-700 leading-tight">{i.transaction_code || i.invoice_code}</p>
                        <p className="text-[10px] text-gray-400 truncate leading-tight mt-0.5" title={i.operation_name || `op ${i.operation_code}`}>
                          {i.operation_name || `op ${i.operation_code}`}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-center align-middle">
                        <div className="font-mono text-xs text-gray-700 leading-tight" title="Data de faturamento">
                          {fmtDate(i.issue_date)}
                        </div>
                        <div className="font-mono text-[9px] text-gray-400 leading-tight mt-0.5" title={`Última atualização: ${i.atualizado_em || ''}`}>
                          atu. {fmtDateTime(i.atualizado_em)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800 whitespace-nowrap align-middle">R$&nbsp;{fmtBRL(i.total_value)}</td>
                      <td className="py-2.5 px-3 text-center align-middle">
                        <div className="inline-flex items-center gap-1.5 group/vol">
                          <button
                            type="button"
                            onClick={() => {
                              const v = Math.max(0, (i.volume_caixas ?? 0) - 1);
                              setItemsAll((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                              atualizar(i, { volume_caixas: v });
                            }}
                            disabled={(i.volume_caixas ?? 0) <= 0}
                            className="w-5 h-5 rounded-full text-gray-400 hover:bg-blue-100 hover:text-blue-700 transition flex items-center justify-center text-xs font-black disabled:opacity-20 disabled:hover:bg-transparent"
                            title="Diminuir"
                          >−</button>

                          <div className="flex flex-col items-center min-w-[44px]">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={i.volume_caixas ?? 0}
                              onFocus={(e) => { e.target.dataset.orig = String(e.target.value); e.target.select(); }}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                                setItemsAll((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                              }}
                              onBlur={(e) => {
                                const v = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                                const orig = Number(e.target.dataset.orig || 0);
                                if (v !== orig) atualizar(i, { volume_caixas: v });
                              }}
                              title="Qtd. caixas enviadas"
                              className="w-12 text-center tabular-nums font-extrabold text-blue-700 text-base leading-none px-1 py-0.5 rounded bg-transparent hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold leading-none mt-0.5">
                              cx · <span className="text-gray-500">{i.volume_qty || 0}</span> pç
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const v = (i.volume_caixas ?? 0) + 1;
                              setItemsAll((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                              atualizar(i, { volume_caixas: v });
                            }}
                            className="w-5 h-5 rounded-full text-gray-400 hover:bg-blue-100 hover:text-blue-700 transition flex items-center justify-center text-xs font-black"
                            title="Adicionar"
                          >+</button>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 align-middle">
                        <div className="relative">
                          {/* Badge visual (sempre visível) */}
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg ring-1 ring-inset cursor-pointer transition-all hover:brightness-95"
                            style={{
                              backgroundColor: semStatus
                                ? '#f3f4f6'
                                : i.status === 'enviado_blue'
                                  ? '#dbeafe'
                                  : i.status === 'recebido_blue'
                                    ? '#fef3c7'
                                    : '#d1fae5',
                              color: semStatus
                                ? '#4b5563'
                                : i.status === 'enviado_blue'
                                  ? '#1d4ed8'
                                  : i.status === 'recebido_blue'
                                    ? '#b45309'
                                    : '#047857',
                            }}
                          >
                            <span className={`shrink-0 w-2 h-2 rounded-full ${k_dot(i.status)}`} />
                            <span className="flex-1 text-[11px] font-bold whitespace-nowrap">
                              {semStatus
                                ? 'Sem status'
                                : i.status === 'enviado_blue'
                                  ? 'Enviado p/ Blue'
                                  : i.status === 'recebido_blue'
                                    ? 'Recebido na Blue'
                                    : 'Enviado p/ Cliente'}
                            </span>
                            <svg className="shrink-0 w-3 h-3 opacity-70" viewBox="0 0 12 12">
                              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          {/* Select transparente por cima pra interação nativa */}
                          <select
                            value={i.status || ''}
                            onChange={(e) => atualizar(i, { status: e.target.value || null })}
                            className="absolute inset-0 opacity-0 cursor-pointer focus:outline-none"
                            title="Trocar status"
                          >
                            <option value="">— Sem status —</option>
                            {STATUS_OPTIONS.slice(1).map((o) => (
                              <option key={o.v} value={o.v}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 align-middle">
                        <div className="relative">
                          {/* Display visível */}
                          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition">
                            {Ticon ? (
                              <Ticon size={14} weight="duotone" className={`shrink-0 ${t?.cor || ''}`} />
                            ) : (
                              <span className="shrink-0 w-2 h-2 rounded-full bg-gray-300" />
                            )}
                            <span className="flex-1 text-xs font-semibold whitespace-nowrap text-gray-700">
                              {t?.label && t.label !== '—' ? t.label : 'Selecionar'}
                            </span>
                            <svg className="shrink-0 w-3 h-3 text-gray-400" viewBox="0 0 12 12">
                              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <select
                            value={i.transportadora || ''}
                            onChange={(e) => atualizar(i, { transportadora: e.target.value || null })}
                            className="absolute inset-0 opacity-0 cursor-pointer focus:outline-none"
                            title="Trocar transportadora"
                          >
                            {TRANSPORTADORAS.map((o) => (
                              <option key={o.v} value={o.v}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-[160px] relative">
                            <input
                              type="text"
                              value={i.codigo_rastreio || ''}
                              onFocus={(e) => { e.target.dataset.orig = e.target.value; }}
                              onChange={(e) => {
                                const v = e.target.value;
                                setItemsAll((arr) => arr.map((x) => x.id === i.id ? { ...x, codigo_rastreio: v } : x));
                              }}
                              placeholder="Cole o código aqui…"
                              className={`w-full text-sm font-mono border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition placeholder:text-gray-400 placeholder:font-sans placeholder:text-xs ${
                                temRastreio
                                  ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900 font-semibold'
                                  : 'border-gray-300 bg-white text-gray-800'
                              }`}
                              onBlur={(e) => {
                                const orig = e.target.dataset.orig || '';
                                if (e.target.value !== orig) {
                                  atualizar(i, { codigo_rastreio: e.target.value || null });
                                }
                              }}
                            />
                            {temRastreio && (
                              <CheckCircle size={14} weight="fill" className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                            )}
                          </div>
                          {temRastreio ? (
                            <a
                              href={buildWhatsappUrl(i)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar atualização para a franquia via WhatsApp"
                              className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/40 transition-all hover:scale-105"
                            >
                              <WhatsappLogo size={18} weight="fill" />
                            </a>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-gray-100 text-gray-300 cursor-not-allowed"
                              title="Adicione um código de rastreio pra liberar o WhatsApp"
                            >
                              <WhatsappLogo size={18} weight="fill" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div className="bg-gradient-to-b from-white to-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-4 text-gray-500">
                <span className="font-semibold text-gray-700">{items.length}</span>
                <span>{items.length === 1 ? 'NF exibida' : 'NFs exibidas'}</span>
                <span className="text-gray-300">·</span>
                <span>
                  <span className="font-semibold text-gray-700 tabular-nums">{items.reduce((a, i) => a + (i.volume_caixas || 0), 0)}</span> caixas
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  <span className="font-semibold text-gray-700 tabular-nums">{items.reduce((a, i) => a + (i.volume_qty || 0), 0)}</span> peças
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                <CurrencyDollar size={14} weight="fill" />
                <span className="tabular-nums">R$ {fmtBRL(totalFaturado)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
