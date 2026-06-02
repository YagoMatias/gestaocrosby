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

  // KPIs por status
  const kpis = STATUS_OPTIONS.slice(1).map((s) => ({
    ...s,
    count: items.filter((i) => i.status === s.v).length,
    caixas: items.filter((i) => i.status === s.v).reduce((a, i) => a + (i.volume_caixas || 0), 0),
    pecas: items.filter((i) => i.status === s.v).reduce((a, i) => a + (i.volume_qty || 0), 0),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 py-6">
      <div className="max-w-[1600px] mx-auto px-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#000638] via-[#0a1a5c] to-[#001a8a] shadow-xl mb-6">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative px-6 py-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <Package size={28} weight="duotone" className="text-blue-200" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  Expedição Showroom
                </h1>
                <p className="text-sm text-blue-200/80 mt-1">
                  Controle de envios — Showroom + Novidades Franquia · ops 7254, 7007, 7255
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-blue-300/80 font-bold">Total NFs</p>
              <p className="text-4xl font-black text-white tabular-nums leading-none mt-1">{total}</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {kpis.map((k) => {
            const ativo = filtros.status === k.v;
            return (
              <button
                key={k.v}
                onClick={() => setFiltros((s) => ({ ...s, status: ativo ? '' : k.v }))}
                className={`text-left p-4 rounded-xl border transition-all ${
                  ativo
                    ? 'bg-white border-blue-300 shadow-md ring-2 ring-blue-200'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${k.dot}`} />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    {k.label}
                  </p>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-3xl font-black text-gray-900 tabular-nums">{k.count}</p>
                  <p className="text-xs text-gray-500">NFs · {k.caixas} cx · {k.pecas} pç</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 p-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar (loja, transação, rastreio)…"
              value={filtros.busca}
              onChange={(e) => setFiltros((s) => ({ ...s, busca: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <select
            value={filtros.transportadora}
            onChange={(e) => setFiltros((s) => ({ ...s, transportadora: e.target.value }))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Todas transportadoras</option>
            {TRANSPORTADORAS.slice(1).map((t) => (
              <option key={t.v} value={t.v}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 font-medium text-gray-700"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={syncTotvs}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm disabled:opacity-50"
          >
            <Truck size={14} weight="bold" />
            {syncing ? 'Sincronizando…' : 'Puxar TOTVS'}
          </button>
          <button
            onClick={exportarCsv}
            disabled={!items.length}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-50"
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="py-3 px-3 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Loja</th>
                  <th className="py-3 px-3 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Transação</th>
                  <th className="py-3 px-3 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Data</th>
                  <th className="py-3 px-3 text-right text-[10px] font-black text-gray-600 uppercase tracking-wider">Valor</th>
                  <th className="py-3 px-3 text-right text-[10px] font-black text-gray-600 uppercase tracking-wider">Volume</th>
                  <th className="py-3 px-3 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-3 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Transportadora</th>
                  <th className="py-3 px-3 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Rastreio</th>
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
                  const s = STATUS_MAP[i.status] || STATUS_MAP['enviado_blue'];
                  const t = TRANSP_MAP[i.transportadora];
                  const Ticon = t?.icon;
                  const temRastreio = !!(i.codigo_rastreio && String(i.codigo_rastreio).trim());
                  const borderClass = s.border || 'border-transparent';
                  return (
                    <tr
                      key={i.id}
                      className={`border-b border-gray-100 transition-colors ${s.row || 'hover:bg-blue-50/40 bg-white'}`}
                    >
                      <td className={`py-3 px-3 max-w-[260px] border-l-4 ${borderClass}`}>
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
                      <td className="py-3 px-3 text-xs">
                        <p className="font-mono text-gray-700">{i.transaction_code || i.invoice_code}</p>
                        <p className="text-[10px] text-gray-400">{i.operation_name || `op ${i.operation_code}`}</p>
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(i.issue_date)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-gray-800">R$ {fmtBRL(i.total_value)}</td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={i.volume_caixas ?? 0}
                          onChange={(e) => {
                            const v = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                            setItems((arr) => arr.map((x) => x.id === i.id ? { ...x, volume_caixas: v } : x));
                          }}
                          onBlur={(e) => {
                            const v = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                            if (v !== (i.volume_caixas ?? 0)) atualizar(i, { volume_caixas: v });
                          }}
                          title="Qtd. caixas enviadas"
                          className="w-16 text-right tabular-nums font-bold text-blue-700 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        />
                        <p className="text-[9px] text-gray-400 mt-0.5">{i.volume_qty || 0} pç</p>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={i.status}
                          onChange={(e) => atualizar(i, { status: e.target.value })}
                          className={`text-[11px] font-bold rounded-md px-2 py-1 ring-1 ${s.cor} cursor-pointer focus:outline-none`}
                        >
                          {STATUS_OPTIONS.slice(1).map((o) => (
                            <option key={o.v} value={o.v}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={i.transportadora || ''}
                          onChange={(e) => atualizar(i, { transportadora: e.target.value || null })}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          {TRANSPORTADORAS.map((o) => (
                            <option key={o.v} value={o.v}>{o.label}</option>
                          ))}
                        </select>
                        {Ticon && (
                          <Ticon size={12} weight="duotone" className={`inline ml-1 ${t.cor}`} />
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={i.codigo_rastreio || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setItems((arr) => arr.map((x) => x.id === i.id ? { ...x, codigo_rastreio: v } : x));
                            }}
                            placeholder="Código…"
                            className="text-xs font-mono border border-gray-300 rounded px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                            onBlur={(e) => {
                              if (e.target.value !== (i.codigo_rastreio || '')) {
                                atualizar(i, { codigo_rastreio: e.target.value || null });
                              }
                            }}
                          />
                          {temRastreio && (
                            <a
                              href={buildWhatsappUrl(i)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar atualização para a franquia via WhatsApp"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors"
                            >
                              <WhatsappLogo size={15} weight="fill" />
                            </a>
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
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 text-center">
              {items.length} {items.length === 1 ? 'NF exibida' : 'NFs exibidas'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
