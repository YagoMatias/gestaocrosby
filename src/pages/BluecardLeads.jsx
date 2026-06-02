// Admin — gerenciamento dos leads capturados pela LP /lp/bluecard
import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  MagnifyingGlass,
  ArrowsClockwise,
  Download,
  Trash,
  Eye,
  CheckCircle,
  XCircle,
  ListChecks,
  At,
  WhatsappLogo,
  InstagramLogo,
  Buildings,
  Calendar,
  PaperPlaneTilt,
  ClipboardText,
  Package,
  PaperPlaneRight,
  ShoppingCart,
  SealCheck,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

// Status do pipeline — replicando o board do ClickUp (cores e ordem)
const STATUS_OPTIONS = [
  { v: '', label: 'Todos', icon: ListChecks, cor: 'bg-slate-100 text-slate-700 ring-slate-200', barra: 'bg-slate-500' },
  { v: '1_msg_enviada',     label: '1ª Mensagem Enviada',  icon: PaperPlaneTilt,  cor: 'bg-gray-100 text-gray-700 ring-gray-300',         barra: 'bg-gray-500' },
  { v: 'info_completas',    label: 'Informações Completas',icon: ClipboardText,   cor: 'bg-blue-100 text-blue-700 ring-blue-200',         barra: 'bg-blue-500' },
  { v: 'presskit_montado',  label: 'Presskit Montado',     icon: Package,         cor: 'bg-slate-200 text-slate-700 ring-slate-300',      barra: 'bg-slate-600' },
  { v: 'enviado',           label: 'Enviado',              icon: PaperPlaneRight, cor: 'bg-teal-100 text-teal-700 ring-teal-200',         barra: 'bg-teal-500' },
  { v: 'analise_compra',    label: 'Análise de Compra',    icon: ShoppingCart,    cor: 'bg-pink-100 text-pink-700 ring-pink-200',         barra: 'bg-pink-500' },
  { v: 'credito_utilizado', label: 'Crédito Utilizado',    icon: CheckCircle,     cor: 'bg-emerald-100 text-emerald-700 ring-emerald-200',barra: 'bg-emerald-500' },
  { v: 'revisado',          label: 'Revisado',             icon: SealCheck,       cor: 'bg-green-100 text-green-800 ring-green-300',      barra: 'bg-green-600' },
  { v: 'descartado',        label: 'Descartado',           icon: XCircle,         cor: 'bg-rose-100 text-rose-700 ring-rose-200',         barra: 'bg-rose-500' },
];
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.v, s]));

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtCPF(s) {
  if (!s) return '—';
  const d = String(s).replace(/\D/g, '');
  if (d.length !== 11) return s;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
function fmtPhone(s) {
  if (!s) return '—';
  const d = String(s).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return s;
}

export default function BluecardLeads() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({ status: '', busca: '' });
  const [editLead, setEditLead] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtros.status) qs.set('status', filtros.status);
      if (filtros.busca) qs.set('busca', filtros.busca);
      qs.set('limit', '500');
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads?${qs}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setLeads(j.leads || []);
      setTotal(j.total || 0);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtros.status, filtros.busca]);

  useEffect(() => {
    const id = setTimeout(carregar, 300);
    return () => clearTimeout(id);
  }, [carregar]);

  const atualizarStatus = async (lead, status) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      setLeads((arr) => arr.map((l) => (l.id === lead.id ? j.lead : l)));
      // Feedback da automação TOTVS
      if (j.totvs) {
        if (j.totvs.ok) {
          if (j.totvs.created) {
            alert(`✅ Cadastrado no TOTVS\nPersonCode: ${j.totvs.personCode}`);
          } else if (j.totvs.existed) {
            alert(`ℹ️ Cliente já existia no TOTVS (CPF)\nPersonCode: ${j.totvs.personCode}`);
          }
        } else {
          alert(`⚠️ Status atualizado, mas TOTVS falhou:\n${j.totvs.error}\n\nVocê pode tentar novamente no botão "Sync TOTVS" nos detalhes.`);
        }
      }
    } catch (e) {
      alert('Falha ao atualizar: ' + e.message);
    }
  };

  const sincronizarTotvs = async (lead) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${lead.id}/sync-totvs`, {
        method: 'POST',
      });
      const j = await r.json();
      if (j.lead) setLeads((arr) => arr.map((l) => (l.id === lead.id ? j.lead : l)));
      if (j.totvs?.ok) {
        alert(`✅ Sincronizado\nPersonCode TOTVS: ${j.totvs.personCode}`);
      } else {
        alert(`❌ Falha ao sincronizar TOTVS:\n${j.totvs?.error || 'erro desconhecido'}`);
      }
      return j.lead;
    } catch (e) {
      alert('Falha: ' + e.message);
    }
  };

  const remover = async (lead) => {
    if (!window.confirm(`Remover lead ${lead.nome}?`)) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${lead.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLeads((arr) => arr.filter((l) => l.id !== lead.id));
      setTotal((t) => t - 1);
    } catch (e) {
      alert('Falha ao remover: ' + e.message);
    }
  };

  const exportarCsv = () => {
    if (!leads.length) return;
    const headers = ['ID', 'Criado em', 'Status', 'Nome', 'Email', 'CPF', 'WhatsApp', 'Empresa', 'Instagram', 'Data Nasc.', 'CEP', 'Endereço', 'Nº', 'Complemento', 'Observação'];
    const rows = leads.map((l) => [
      l.id, fmtDate(l.criado_em), l.status, l.nome, l.email, fmtCPF(l.cpf), fmtPhone(l.whatsapp),
      l.empresa || '', l.instagram || '', l.data_nasc || '', l.cep || '', l.endereco || '', l.numero || '', l.complemento || '', l.observacao || '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bluecard-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // KPIs por status (excluindo "Todos")
  const kpis = STATUS_OPTIONS.slice(1).map((s) => ({
    ...s,
    count: leads.filter((l) => l.status === s.v).length,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 py-6">
      <div className="max-w-7xl mx-auto px-6">
        {/* ─── Hero header ───────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#000638] via-[#0a1a5c] to-[#001a8a] shadow-xl mb-6">
          {/* Decoração de fundo */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative px-6 py-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <CreditCard size={28} weight="duotone" className="text-blue-200" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  BlueCard — Leads
                </h1>
                <p className="text-sm text-blue-200/80 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Cadastros recebidos pela LP pública</span>
                  <a
                    href="/lp/bluecard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-blue-100 font-mono text-[11px] transition"
                  >
                    /lp/bluecard ↗
                  </a>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-blue-300/80 font-bold">Total geral</p>
              <p className="text-4xl font-black text-white tabular-nums leading-none mt-1">
                {total}
              </p>
            </div>
          </div>
        </div>

        {/* ─── KPIs por status (pipeline ClickUp) ────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
          {kpis.map((k) => {
            const Icon = k.icon;
            const ativo = filtros.status === k.v;
            return (
              <button
                key={k.v}
                onClick={() => setFiltros((s) => ({ ...s, status: ativo ? '' : k.v }))}
                className={`relative overflow-hidden text-left p-4 rounded-xl border transition-all group ${
                  ativo
                    ? 'bg-white border-blue-300 shadow-md ring-2 ring-blue-200'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* Barra colorida lateral */}
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${k.barra}`} />
                <div className="flex items-start justify-between mb-2">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${k.cor.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')}`}>
                    <Icon size={18} weight="duotone" />
                  </span>
                  {ativo && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      Filtrando
                    </span>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                  {k.label}
                </p>
                <p className="text-3xl font-black text-gray-900 tabular-nums leading-none">
                  {k.count}
                </p>
              </button>
            );
          })}
        </div>

        {/* ─── Toolbar (busca, refresh, export) ──────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 p-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar (nome, email, CPF, telefone, empresa)…"
              value={filtros.busca}
              onChange={(e) => setFiltros((s) => ({ ...s, busca: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
          {filtros.status && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              Filtrando: {STATUS_MAP[filtros.status]?.label}
              <button
                onClick={() => setFiltros((s) => ({ ...s, status: '' }))}
                className="text-blue-500 hover:text-blue-800 text-base leading-none"
                title="Limpar filtro"
              >
                ×
              </button>
            </span>
          )}
          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 font-medium text-gray-700"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
          <button
            onClick={exportarCsv}
            disabled={!leads.length}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} weight="bold" />
            Exportar CSV
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
            <XCircle size={18} weight="duotone" />
            {erro}
          </div>
        )}

        {/* ─── Tabela ────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Data</th>
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Nome</th>
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Contato</th>
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">CPF</th>
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Empresa</th>
                  <th className="py-3 px-4 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider">Instagram</th>
                  <th className="py-3 px-4 text-right text-[10px] font-black text-gray-600 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && !leads.length ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                        <ArrowsClockwise size={18} className="animate-spin" />
                        Carregando leads…
                      </div>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="inline-flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <CreditCard size={28} weight="duotone" className="text-blue-300" />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">
                          {filtros.status || filtros.busca
                            ? 'Nenhum lead encontrado com esse filtro.'
                            : 'Ainda sem cadastros — compartilhe a LP em /lp/bluecard'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leads.map((l, idx) => {
                    const s = STATUS_MAP[l.status] || STATUS_MAP['novo'];
                    return (
                      <tr
                        key={l.id}
                        className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-blue-50/40 ${
                          idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                        }`}
                      >
                        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap tabular-nums">
                          {fmtDate(l.criado_em)}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={l.status}
                            onChange={(e) => atualizarStatus(l, e.target.value)}
                            className={`text-[11px] font-bold rounded-md px-2 py-1 ring-1 ${s.cor} cursor-pointer focus:outline-none`}
                          >
                            {STATUS_OPTIONS.slice(1).map((o) => (
                              <option key={o.v} value={o.v}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{l.nome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-gray-400">#{l.id}</span>
                            {l.totvs_person_code ? (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                title={`Cadastrado no TOTVS em ${fmtDate(l.totvs_synced_at)}`}
                              >
                                <CheckCircle size={9} weight="fill" />
                                TOTVS #{l.totvs_person_code}
                              </span>
                            ) : l.totvs_sync_error ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); sincronizarTotvs(l); }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                                title={`Falha: ${l.totvs_sync_error}\n\nClique pra tentar de novo.`}
                              >
                                <XCircle size={9} weight="fill" />
                                Retry TOTVS
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-700 mb-0.5">
                            <At size={11} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{l.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                            <WhatsappLogo size={11} className="text-emerald-500 flex-shrink-0" />
                            {fmtPhone(l.whatsapp)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-700">
                          {fmtCPF(l.cpf)}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-700">
                          {l.empresa ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Buildings size={11} className="text-gray-400" />
                              <span className="truncate max-w-[140px]">{l.empresa}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {l.instagram ? (
                            <a
                              href={`https://instagram.com/${(l.instagram || '').replace(/[@\s]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-pink-600 hover:text-pink-800 hover:underline"
                            >
                              <InstagramLogo size={12} weight="fill" />
                              {l.instagram}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditLead(l)}
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 px-2 py-1.5 rounded mr-1 font-medium"
                            title="Ver detalhes"
                          >
                            <Eye size={14} weight="duotone" />
                            Ver
                          </button>
                          <button
                            onClick={() => remover(l)}
                            className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 hover:bg-rose-50 px-2 py-1.5 rounded"
                            title="Remover"
                          >
                            <Trash size={14} weight="duotone" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {leads.length > 0 && (
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 text-center">
              {leads.length} {leads.length === 1 ? 'lead' : 'leads'} exibidos
              {filtros.status && ` · filtro: ${STATUS_MAP[filtros.status]?.label}`}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhes */}
      {editLead && (
        <DetalhesModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(l) => {
            setLeads((arr) => arr.map((x) => (x.id === l.id ? l : x)));
            setEditLead(null);
          }}
          onSyncTotvs={async () => {
            const updated = await sincronizarTotvs(editLead);
            if (updated) setEditLead(updated);
          }}
        />
      )}
    </div>
  );
}

function DetalhesModal({ lead, onClose, onSaved, onSyncTotvs }) {
  const [observacao, setObs] = useState(lead.observacao || '');
  const [salvando, setSalv] = useState(false);

  const salvar = async () => {
    setSalv(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      onSaved(j.lead);
    } catch (e) {
      alert('Falha: ' + e.message);
    } finally {
      setSalv(false);
    }
  };

  const s = STATUS_MAP[lead.status] || STATUS_MAP['novo'];
  const StatusIcon = s.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div className="relative bg-gradient-to-br from-[#000638] to-[#001a8a] p-6 text-white">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <CreditCard size={24} weight="duotone" className="text-blue-200" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">{lead.nome}</h3>
                <p className="text-xs text-blue-200/80 mt-0.5 flex items-center gap-2">
                  <Calendar size={11} /> {fmtDate(lead.criado_em)} · ID #{lead.id}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-3xl text-white/60 hover:text-white leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div className="mt-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ring-1 ${s.cor} text-xs font-bold`}>
              <StatusIcon size={12} weight="duotone" /> {s.label}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Cards de contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard icon={At} label="Email" value={lead.email} color="blue" />
            <InfoCard icon={WhatsappLogo} label="WhatsApp" value={fmtPhone(lead.whatsapp)} color="emerald" />
            <InfoCard icon={CreditCard} label="CPF" value={fmtCPF(lead.cpf)} color="slate" mono />
            <InfoCard icon={Calendar} label="Data nasc." value={lead.data_nasc || '—'} color="purple" />
          </div>

          {/* Empresa + Instagram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard icon={Buildings} label="Empresa / Profissão" value={lead.empresa || '—'} color="amber" />
            <InfoCard
              icon={InstagramLogo}
              label="Instagram"
              value={lead.instagram || '—'}
              link={lead.instagram ? `https://instagram.com/${lead.instagram.replace(/[@\s]/g, '')}` : null}
              color="pink"
            />
          </div>

          {/* Endereço */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">📍 Endereço</p>
            <p className="text-sm text-gray-700">
              <b>CEP:</b> {lead.cep || '—'} <br />
              <b>Endereço:</b> {lead.endereco || '—'}, Nº {lead.numero || '—'} <br />
              <b>Complemento:</b> {lead.complemento || '—'}
            </p>
          </div>

          {/* Integração TOTVS */}
          <div className={`rounded-xl p-4 border ${lead.totvs_person_code ? 'bg-emerald-50 border-emerald-200' : lead.totvs_sync_error ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-600">
                💼 Cadastro TOTVS
              </p>
              {lead.totvs_synced_at && (
                <p className="text-[10px] text-gray-500">
                  {fmtDate(lead.totvs_synced_at)}
                </p>
              )}
            </div>
            {lead.totvs_person_code ? (
              <p className="text-sm text-emerald-800 font-semibold flex items-center gap-1.5">
                <CheckCircle size={16} weight="fill" />
                PersonCode TOTVS:{' '}
                <span className="font-mono bg-white px-2 py-0.5 rounded">{lead.totvs_person_code}</span>
              </p>
            ) : lead.totvs_sync_error ? (
              <>
                <p className="text-sm text-rose-800 font-medium mb-2">
                  ❌ Falha no cadastro: <span className="font-mono text-xs">{lead.totvs_sync_error}</span>
                </p>
                <button
                  onClick={() => onSyncTotvs?.()}
                  className="text-xs px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  🔄 Tentar de novo
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                Ainda não cadastrado. Será cadastrado automaticamente ao mover pra <b>Informações Completas</b>.
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div>
              <span className="font-bold text-gray-600">Origem:</span> {lead.origem}
            </div>
            <div>
              <span className="font-bold text-gray-600">IP:</span>{' '}
              <span className="font-mono text-[11px]">{lead.ip || '—'}</span>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
              📝 Observações internas
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObs(e.target.value)}
              rows={4}
              className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              placeholder="Anotações sobre o lead, próximos passos…"
            />
          </div>
        </div>

        {/* Footer do modal */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 shadow-sm"
          >
            {salvando ? 'Salvando…' : 'Salvar observação'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, color = 'blue', mono = false, link = null }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    slate: 'bg-slate-50 border-slate-100 text-slate-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    pink: 'bg-pink-50 border-pink-100 text-pink-700',
  };
  const content = (
    <>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} weight="duotone" />
        <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</span>
      </div>
      <p className={`text-sm font-semibold text-gray-800 break-words ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </>
  );
  const className = `p-3 rounded-xl border ${colorMap[color]} block`;
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={`${className} hover:shadow-md transition`}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}
