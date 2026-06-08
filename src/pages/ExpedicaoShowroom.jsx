// Expedição Showroom — controle de envio das NFs showroom/novidades
import React, { useEffect, useState, useCallback } from 'react';
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
  User,
  WhatsappLogo,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

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
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({ status: '', transportadora: '', busca: '' });

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtros.status) qs.set('status', filtros.status);
      if (filtros.transportadora) qs.set('transportadora', filtros.transportadora);
      if (filtros.busca) qs.set('busca', filtros.busca);
      const r = await fetch(`${API_BASE_URL}/api/expedicao-showroom?${qs}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setItems(j.items || []);
      setTotal(j.total || 0);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtros.status, filtros.transportadora, filtros.busca]);

  useEffect(() => {
    const id = setTimeout(carregar, 300);
    return () => clearTimeout(id);
  }, [carregar]);

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
      setItems((arr) => arr.map((x) => (x.id === item.id ? j.item : x)));
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

  // KPIs por status (incluindo "Sem status")
  const STATUS_CONHECIDOS = new Set(STATUS_OPTIONS.slice(1).map((s) => s.v));
  const semStatusItems = items.filter((i) => !i.status || !STATUS_CONHECIDOS.has(i.status));
  const kpis = [
    ...STATUS_OPTIONS.slice(1).map((s) => ({
      ...s,
      count: items.filter((i) => i.status === s.v).length,
      caixas: items.filter((i) => i.status === s.v).reduce((a, i) => a + (i.volume_caixas || 0), 0),
      pecas: items.filter((i) => i.status === s.v).reduce((a, i) => a + (i.volume_qty || 0), 0),
      valor: items.filter((i) => i.status === s.v).reduce((a, i) => a + Number(i.total_value || 0), 0),
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

  // Total faturado (soma de total_value de todas as NFs do filtro)
  const totalFaturado = items.reduce((a, i) => a + Number(i.total_value || 0), 0);

  // Cor do dot baseado no status (pra usar no select inline)
  const k_dot = (st) => {
    if (st === 'enviado_blue') return 'bg-blue-500';
    if (st === 'recebido_blue') return 'bg-amber-500';
    if (st === 'enviado_cliente') return 'bg-emerald-500';
    return 'bg-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 py-6">
      <div className="max-w-[1600px] mx-auto px-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#000638] via-[#0a1a5c] to-[#001a8a] shadow-2xl mb-6 ring-1 ring-blue-900/40">
          {/* Glow effects */}
          <div className="absolute -right-32 -top-32 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_45%,rgba(255,255,255,0.03)_50%,transparent_55%)] pointer-events-none" />

          <div className="relative px-7 py-7 flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-5">
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-xl">
                <Package size={32} weight="duotone" className="text-blue-200 drop-shadow" />
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-400/20 to-transparent pointer-events-none" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight drop-shadow">
                  Expedição Showroom
                </h1>
                <p className="text-sm text-blue-200/80 mt-1.5 flex items-center gap-2">
                  <span>Controle de envios</span>
                  <span className="w-1 h-1 rounded-full bg-blue-400/60" />
                  <span>Showroom + Novidades Franquia</span>
                  <span className="w-1 h-1 rounded-full bg-blue-400/60" />
                  <span className="font-mono text-blue-300/70">ops 7254 · 7007 · 7255</span>
                </p>
              </div>
            </div>
            <div className="flex items-stretch gap-5">
              <div className="text-right border-r border-white/15 pr-5 flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-blue-300/80 font-bold">Total NFs</p>
                <p className="text-4xl font-black text-white tabular-nums leading-none mt-1.5">{total}</p>
              </div>
              <div className="text-right flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold flex items-center justify-end gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Total Faturado
                </p>
                <p className="text-3xl lg:text-4xl font-black text-emerald-300 tabular-nums leading-none mt-1.5 drop-shadow">
                  R$ {fmtBRL(totalFaturado)}
                </p>
                <p className="text-[10px] text-blue-300/70 mt-1.5">
                  {items.length} {items.length === 1 ? 'pedido faturado' : 'pedidos faturados'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {kpis.map((k) => {
            const isSemStatus = k.v === '__sem_status__';
            const ativo = !isSemStatus && filtros.status === k.v;
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
                onClick={() => {
                  if (isSemStatus) return;
                  setFiltros((s) => ({ ...s, status: ativo ? '' : k.v }));
                }}
                disabled={isSemStatus}
                className={`group relative overflow-hidden text-left p-4 rounded-2xl border transition-all duration-200 ${
                  ativo
                    ? 'bg-gradient-to-br from-blue-50 to-white border-blue-300 shadow-lg ring-2 ring-blue-200/60 scale-[1.02]'
                    : isSemStatus
                      ? 'bg-gradient-to-br from-gray-100 to-gray-50 border-gray-200 cursor-default opacity-90'
                      : `bg-gradient-to-br ${colorGradient} border-gray-200 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5`
                }`}
              >
                {/* glow decoration */}
                {!isSemStatus && (
                  <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-current opacity-5 ${accentColor}`} />
                )}
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
          <div className="relative flex-1 min-w-[280px]">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por loja, transação ou rastreio…"
              value={filtros.busca}
              onChange={(e) => setFiltros((s) => ({ ...s, busca: e.target.value }))}
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-300 transition"
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

        {/* Tabela */}
        <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-b from-slate-50 via-slate-50 to-white border-b-2 border-gray-200">
                  <th className="py-3.5 px-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-[210px]">Loja</th>
                  <th className="py-3.5 px-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-[150px]">Transação</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[85px]">Data</th>
                  <th className="py-3.5 px-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest w-[105px]">Valor</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[95px]">Volume</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[185px]">Status</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest w-[140px]">Transportadora</th>
                  <th className="py-3.5 px-3 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[240px]">Rastreio</th>
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
                      <td className="py-2.5 px-3 text-xs text-gray-600 text-center whitespace-nowrap align-middle font-mono">{fmtDate(i.issue_date)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-800 whitespace-nowrap align-middle">R$&nbsp;{fmtBRL(i.total_value)}</td>
                      <td className="py-2.5 px-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <div className="inline-flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => {
                                const v = Math.max(0, (i.volume_caixas ?? 0) - 1);
                                setItems((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                                atualizar(i, { volume_caixas: v });
                              }}
                              className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-blue-700 transition disabled:opacity-30"
                              disabled={(i.volume_caixas ?? 0) <= 0}
                              title="Diminuir"
                            >
                              <span className="text-xs font-black">−</span>
                            </button>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={i.volume_caixas ?? 0}
                              onFocus={(e) => { e.target.dataset.orig = String(e.target.value); e.target.select(); }}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                                setItems((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                              }}
                              onBlur={(e) => {
                                const v = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                                const orig = Number(e.target.dataset.orig || 0);
                                if (v !== orig) atualizar(i, { volume_caixas: v });
                              }}
                              title="Qtd. caixas enviadas"
                              className="w-10 text-center tabular-nums font-bold text-blue-700 border-x border-gray-200 px-1 py-1.5 text-sm focus:outline-none focus:bg-blue-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const v = (i.volume_caixas ?? 0) + 1;
                                setItems((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                                atualizar(i, { volume_caixas: v });
                              }}
                              className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-blue-700 transition"
                              title="Adicionar"
                            >
                              <span className="text-xs font-black">+</span>
                            </button>
                          </div>
                          <p className="text-[9px] text-gray-400">{i.volume_qty || 0} pç</p>
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
                                setItems((arr) => arr.map((x) => x.id === i.id ? { ...x, codigo_rastreio: v } : x));
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
