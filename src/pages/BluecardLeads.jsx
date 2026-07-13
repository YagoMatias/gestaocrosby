// Admin — gerenciamento dos leads capturados pela LP /lp/bluecard
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  MapPin,
  Calendar,
  PaperPlaneTilt,
  ClipboardText,
  Package,
  PaperPlaneRight,
  ShoppingCart,
  SealCheck,
  CaretRight,
  CaretDown,
  CaretUp,
  Share,
  LinkSimple,
  Copy,
  Check,
  Upload,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

// Status do pipeline — replicando o board do ClickUp (cores e ordem)
const STATUS_OPTIONS = [
  { v: '', label: 'Todos', icon: ListChecks, cor: 'bg-slate-100 text-slate-700 ring-slate-200', barra: 'bg-slate-500' },
  { v: '1_msg_enviada',     label: '1ª Mensagem Enviada',  icon: PaperPlaneTilt,  cor: 'bg-gray-100 text-gray-700 ring-gray-300',         barra: 'bg-gray-500' },
  { v: 'info_completas',    label: 'Informações Completas',icon: ClipboardText,   cor: 'bg-blue-100 text-blue-700 ring-blue-200',         barra: 'bg-blue-500' },
  { v: 'presskit_montado',  label: 'Presskit Montado',     icon: Package,         cor: 'bg-slate-200 text-slate-700 ring-slate-300',      barra: 'bg-slate-600' },
  { v: 'cartao_feito',      label: 'Cartão Feito',         icon: CreditCard,      cor: 'bg-violet-100 text-violet-700 ring-violet-200',   barra: 'bg-violet-500' },
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
  const [gerarLinkAberto, setGerarLinkAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  // Multi-select: Set<leadId>
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Limpa seleção quando filtros mudam
  useEffect(() => { setSelecionados(new Set()); }, [filtros.status, filtros.busca]);

  const toggleSelecao = useCallback((leadId) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      n.has(leadId) ? n.delete(leadId) : n.add(leadId);
      return n;
    });
  }, []);

  const selecionarTodos = useCallback((leadIds, marcar) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      for (const id of leadIds) marcar ? n.add(id) : n.delete(id);
      return n;
    });
  }, []);

  const limparSelecao = useCallback(() => setSelecionados(new Set()), []);

  // Bulk: trocar status de N leads selecionados de uma vez
  const bulkTrocarStatus = useCallback(async (novoStatus) => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    if (!window.confirm(`Trocar status de ${ids.length} lead${ids.length > 1 ? 's' : ''} para "${STATUS_MAP[novoStatus]?.label}"?`)) return;
    setBulkBusy(true);
    let ok = 0, falha = 0;
    const atualizados = [];
    await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: novoStatus }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Erro');
        if (j.lead) atualizados.push(j.lead);
        ok++;
      } catch {
        falha++;
      }
    }));
    setLeads((arr) => arr.map((l) => atualizados.find((u) => u.id === l.id) || l));
    setBulkBusy(false);
    limparSelecao();
    if (falha > 0) alert(`✓ ${ok} atualizados\n✗ ${falha} falharam`);
  }, [selecionados, limparSelecao]);

  // Bulk: deletar
  const bulkDeletar = useCallback(async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    if (!window.confirm(`Remover ${ids.length} lead${ids.length > 1 ? 's' : ''}? Esta ação NÃO pode ser desfeita.`)) return;
    setBulkBusy(true);
    let ok = 0, falha = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error();
        ok++;
      } catch { falha++; }
    }));
    setLeads((arr) => arr.filter((l) => !ids.includes(l.id)));
    setBulkBusy(false);
    limparSelecao();
    if (falha > 0) alert(`✓ ${ok} removidos\n✗ ${falha} falharam`);
  }, [selecionados, limparSelecao]);

  // Carrega TODOS os leads sem filtro de status (filtro aplicado client-side
  // pra KPIs sempre verem o total real de cada status, mesmo com filtro ativo).
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      // status NÃO vai pro backend — é client-side
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
  }, [filtros.busca]);

  // Lista efetivamente exibida (com filtro de status aplicado client-side)
  const leadsExibidos = useMemo(() => {
    if (!filtros.status) return leads;
    return leads.filter((l) => l.status === filtros.status);
  }, [leads, filtros.status]);

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
    const headers = ['ID', 'Criado em', 'Status', 'Indicado por', 'Nome', 'CVV', 'Email', 'CPF', 'WhatsApp', 'Empresa', 'Instagram', 'Data Nasc.', 'CEP', 'Endereço', 'Nº', 'Complemento', 'Cidade', 'Estado', 'Observação'];
    const rows = leads.map((l) => [
      l.id, fmtDate(l.criado_em), l.status, l.indicado_por || '', l.nome, l.cvv || '', l.email, fmtCPF(l.cpf), fmtPhone(l.whatsapp),
      l.empresa || '', l.instagram || '', l.data_nasc || '', l.cep || '', l.endereco || '', l.numero || '', l.complemento || '', l.cidade || '', l.estado || '', l.observacao || '',
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
        {/* ─── Header centralizado (estilo PageTitle das outras páginas) ─── */}
        <div className="text-center mb-6">
          <div className="flex justify-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm">
              <CreditCard size={24} weight="light" className="text-[#000638]" />
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[#000638] tracking-tight">
              BlueCard — Leads
            </h1>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto leading-relaxed inline-flex items-center gap-2 flex-wrap justify-center">
            <span>Cadastros recebidos pela LP pública</span>
            <a
              href="/lp/bluecard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-mono text-[11px] px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100"
            >
              /lp/bluecard ↗
            </a>
          </p>
        </div>

        {/* ─── KPIs por status (pipeline ClickUp) ────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 mb-5">
          {kpis.map((k) => {
            const dot = STATUS_DOT[k.v] || STATUS_DOT['1_msg_enviada'];
            const ativo = filtros.status === k.v;
            const pct = total > 0 ? (k.count / total) * 100 : 0;
            const vazio = k.count === 0;
            return (
              <button
                key={k.v}
                onClick={() => setFiltros((s) => ({ ...s, status: ativo ? '' : k.v }))}
                className={`relative overflow-hidden text-left p-3 rounded-xl transition-all group ${
                  ativo
                    ? 'bg-white ring-2 ring-blue-400 shadow-md'
                    : vazio
                      ? 'bg-white/60 ring-1 ring-gray-200/70 hover:ring-gray-300 hover:bg-white'
                      : 'bg-white ring-1 ring-gray-200 hover:ring-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Pill colorido do status */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${dot.bg} ${dot.text} mb-2`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                  <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                    {k.label.length > 16 ? k.label.split(' ')[0] : k.label}
                  </span>
                </span>

                {/* Número + % */}
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold tabular-nums leading-none ${vazio ? 'text-gray-300' : 'text-gray-900'}`}>
                    {k.count}
                  </span>
                  {!vazio && (
                    <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Barra de progresso sutil no rodapé */}
                {!vazio && (
                  <div className="mt-2 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${dot.bg} transition-all`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Toolbar (busca, refresh, export) ──────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[280px]">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar nome, email, CPF, telefone, empresa…"
              value={filtros.busca}
              onChange={(e) => setFiltros((s) => ({ ...s, busca: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 placeholder:text-gray-400 transition-colors"
            />
          </div>
          {filtros.status && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200/60">
              {STATUS_MAP[filtros.status]?.label}
              <button
                onClick={() => setFiltros((s) => ({ ...s, status: '' }))}
                className="text-blue-500 hover:text-blue-700 text-base leading-none"
                title="Limpar filtro"
              >
                ×
              </button>
            </span>
          )}
          <button
            onClick={() => setImportarAberto(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-colors"
            title="Importar lista (CSV/planilha)"
          >
            <Upload size={14} weight="bold" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => setGerarLinkAberto(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
            title="Gerar link de indicação"
          >
            <Share size={14} weight="bold" />
            <span className="hidden sm:inline">Gerar link</span>
          </button>
          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 text-gray-700 transition-colors"
            title="Atualizar"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            onClick={exportarCsv}
            disabled={!leads.length}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Exportar CSV"
          >
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
            <XCircle size={18} weight="duotone" />
            {erro}
          </div>
        )}

        {/* ─── Lista agrupada por status (estilo ClickUp) ────────────────── */}
        {loading && !leads.length ? (
          <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <ArrowsClockwise size={18} className="animate-spin" />
              Carregando leads…
            </div>
          </div>
        ) : leadsExibidos.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
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
          </div>
        ) : (
          <ListaAgrupada
            leads={leadsExibidos}
            atualizarStatus={atualizarStatus}
            sincronizarTotvs={sincronizarTotvs}
            setEditLead={setEditLead}
            remover={remover}
            selecionados={selecionados}
            toggleSelecao={toggleSelecao}
            selecionarTodos={selecionarTodos}
          />
        )}
      </div>

      {/* Barra de ações em massa (flutuante no rodapé) */}
      {selecionados.size > 0 && (
        <BulkActionBar
          count={selecionados.size}
          busy={bulkBusy}
          onTrocarStatus={bulkTrocarStatus}
          onDeletar={bulkDeletar}
          onCancelar={limparSelecao}
        />
      )}

      {/* Modal: gerador de link de indicação */}
      {gerarLinkAberto && (
        <GerarLinkIndicacaoModal onClose={() => setGerarLinkAberto(false)} />
      )}
      {importarAberto && (
        <ImportarLeadsModal
          onClose={() => setImportarAberto(false)}
          onImportado={() => { setImportarAberto(false); carregar(); }}
        />
      )}

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

// ────────────────────────────────────────────────────────────────────────
// Lista agrupada por status (estilo ClickUp List View — dark theme)
// ────────────────────────────────────────────────────────────────────────
// Cor do "dot" + badge do header de cada grupo (estilo ClickUp List)
const STATUS_DOT = {
  '1_msg_enviada':     { bg: 'bg-gray-700',     text: 'text-gray-100',     ring: 'ring-gray-400' },
  'info_completas':    { bg: 'bg-blue-600',     text: 'text-blue-50',      ring: 'ring-blue-400' },
  'presskit_montado':  { bg: 'bg-indigo-600',   text: 'text-indigo-50',    ring: 'ring-indigo-400' },
  'cartao_feito':      { bg: 'bg-violet-600',   text: 'text-violet-50',    ring: 'ring-violet-400' },
  'enviado':           { bg: 'bg-teal-600',     text: 'text-teal-50',      ring: 'ring-teal-400' },
  'analise_compra':    { bg: 'bg-pink-600',     text: 'text-pink-50',      ring: 'ring-pink-400' },
  'credito_utilizado': { bg: 'bg-emerald-600',  text: 'text-emerald-50',   ring: 'ring-emerald-400' },
  'revisado':          { bg: 'bg-green-600',    text: 'text-green-50',     ring: 'ring-green-400' },
  'descartado':        { bg: 'bg-rose-600',     text: 'text-rose-50',      ring: 'ring-rose-400' },
};

// Paleta para badges de "indicado_por" — cor estável por hash do nome.
// Tons médios pra ficar legível sobre fundo branco (como no ClickUp light).
const INDICACAO_PALETTE = [
  { bg: 'bg-amber-300',   text: 'text-amber-950' },
  { bg: 'bg-emerald-300', text: 'text-emerald-950' },
  { bg: 'bg-sky-300',     text: 'text-sky-950' },
  { bg: 'bg-pink-300',    text: 'text-pink-950' },
  { bg: 'bg-violet-300',  text: 'text-violet-950' },
  { bg: 'bg-lime-300',    text: 'text-lime-950' },
  { bg: 'bg-orange-300',  text: 'text-orange-950' },
  { bg: 'bg-cyan-300',    text: 'text-cyan-950' },
];
function corPorIndicacao(nome) {
  if (!nome) return INDICACAO_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) | 0;
  return INDICACAO_PALETTE[Math.abs(hash) % INDICACAO_PALETTE.length];
}

// Slug pro badge (lowercase, sem espaço/acento) — ClickUp style ex: "collabluminova"
function slugificarIndicacao(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function fmtWhatsappBR(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (!d) return '—';
  // tira DDI 55 se vier
  const semDdi = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (semDdi.length === 11)
    return `+55(${semDdi.slice(0, 2)})${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
  if (semDdi.length === 10)
    return `+55(${semDdi.slice(0, 2)})${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
  return d;
}

function fmtNasc(s) {
  if (!s) return '—';
  // Vem como string "DD/MM/YYYY" ou "DDMMYYYY" ou ISO
  const raw = String(s).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  return raw;
}
// Checkbox custom — branco/azul, com estado indeterminate visual.
// Quando onChange é fornecido, intercepta o click e para a propagação (linha
// inteira ficaria selecionável). Sem onChange, deixa o click passar pro pai
// (caso o checkbox esteja DENTRO de outro botão que faz a ação).
function CheckSquareInput({ checked, indeterminate, onChange }) {
  const interativo = typeof onChange === 'function';
  const handleClick = interativo
    ? (e) => { e.stopPropagation(); onChange(e); }
    : undefined;
  return (
    <span
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={handleClick}
      className={`inline-flex items-center justify-center w-4 h-4 rounded border transition-all ${
        interativo ? 'cursor-pointer' : ''
      } ${
        checked || indeterminate
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-300 hover:border-blue-400'
      }`}
    >
      {indeterminate ? (
        <span className="w-2 h-[2px] bg-white rounded-full" />
      ) : checked ? (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 8 7 12 13 5" />
        </svg>
      ) : null}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Barra flutuante de ações em massa (aparece quando há seleção)
// ────────────────────────────────────────────────────────────────────────
function BulkActionBar({ count, busy, onTrocarStatus, onDeletar, onCancelar }) {
  const [statusOpen, setStatusOpen] = useState(false);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl shadow-black/30 ring-1 ring-white/10 px-3 py-2 flex items-center gap-2">
        {/* Counter */}
        <div className="inline-flex items-center gap-2 pl-2 pr-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-[12px] font-bold">
            {count}
          </span>
          <span className="text-[13px] font-medium">
            {count === 1 ? 'lead selecionado' : 'leads selecionados'}
          </span>
        </div>

        <div className="w-px h-6 bg-white/15" />

        {/* Trocar status */}
        <div className="relative">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Trocar status
            <CaretDown size={11} weight="bold" className={`transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
          {statusOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setStatusOpen(false)}
              />
              <div className="absolute bottom-full mb-2 left-0 z-20 bg-white text-gray-900 rounded-xl shadow-2xl ring-1 ring-gray-200 py-1.5 min-w-[220px]">
                {STATUS_OPTIONS.slice(1).map((o) => {
                  const dot = STATUS_DOT[o.v] || STATUS_DOT['1_msg_enviada'];
                  return (
                    <button
                      key={o.v}
                      onClick={() => { setStatusOpen(false); onTrocarStatus(o.v); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-gray-50 text-left transition-colors"
                    >
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${dot.bg} ${dot.text}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{o.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Deletar */}
        <button
          onClick={onDeletar}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-rose-300 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
        >
          <Trash size={13} weight="duotone" />
          Remover
        </button>

        <div className="w-px h-6 bg-white/15" />

        {/* Cancelar */}
        <button
          onClick={onCancelar}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          title="Limpar seleção"
        >
          <XCircle size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

// Comparators por chave de ordenação. Retorna função (a,b) → -1/0/1.
const SORT_COMPARATORS = {
  nome:        (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'),
  cod_cliente: (a, b) => (Number(a.totvs_person_code) || 0) - (Number(b.totvs_person_code) || 0),
  cpf:         (a, b) => String(a.cpf || '').localeCompare(String(b.cpf || '')),
  whatsapp:    (a, b) => String(a.whatsapp || '').localeCompare(String(b.whatsapp || '')),
  data_nasc:   (a, b) => {
    // Normaliza "DD/MM/YYYY" → "YYYYMMDD" pra comparar como string
    const norm = (s) => {
      const d = String(s || '').replace(/\D/g, '');
      if (d.length === 8) return d.slice(4) + d.slice(2, 4) + d.slice(0, 2);
      return d;
    };
    return norm(a.data_nasc).localeCompare(norm(b.data_nasc));
  },
  empresa:     (a, b) => String(a.empresa || '').localeCompare(String(b.empresa || ''), 'pt-BR'),
  instagram:   (a, b) => String(a.instagram || '').localeCompare(String(b.instagram || ''), 'pt-BR'),
  cvv:         (a, b) => Number(a.cvv || 0) - Number(b.cvv || 0),
  criado_em:   (a, b) => String(a.criado_em || '').localeCompare(String(b.criado_em || '')),
};

// Cabeçalho de coluna clicável c/ indicador de sort
function SortHeader({ label, sortKey, sortBy, sortDir, onSort, align = 'left' }) {
  const ativo = sortBy === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 group hover:text-gray-700 transition-colors ${
        align === 'center' ? 'justify-center w-full' : ''
      } ${ativo ? 'text-gray-700' : ''}`}
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      <span className={`flex flex-col -space-y-1 ${ativo ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'} transition-opacity`}>
        <CaretUp size={8} weight="bold" className={ativo && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-400'} />
        <CaretDown size={8} weight="bold" className={ativo && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-400'} />
      </span>
    </button>
  );
}

function ListaAgrupada({ leads, atualizarStatus, sincronizarTotvs, setEditLead, remover, selecionados, toggleSelecao, selecionarTodos }) {
  // Sort: key (coluna) + dir ('asc'|'desc'). null = ordem padrão (criado_em desc)
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  // Cycle: null → asc → desc → null
  const onSort = useCallback((key) => {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy(null);
      setSortDir('asc');
    }
  }, [sortBy, sortDir]);
  // Todos os grupos começam RECOLHIDOS (agrupados) ao abrir a página —
  // usuário expande só o que quiser ver. Inicializa o Set com todos os
  // status keys do pipeline (pula o '' de "Todos").
  const [colapsados, setColapsados] = useState(
    () => new Set(STATUS_OPTIONS.slice(1).map((s) => s.v)),
  );
  const toggle = (s) =>
    setColapsados((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });

  // Agrupa leads por status, respeitando a ORDEM definida em STATUS_OPTIONS
  const grupos = useMemo(() => {
    const buckets = new Map();
    STATUS_OPTIONS.slice(1).forEach((s) => buckets.set(s.v, []));
    for (const l of leads) {
      const key = STATUS_MAP[l.status] ? l.status : '1_msg_enviada';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(l);
    }
    // Aplica ordenação dentro de cada grupo
    const cmp = sortBy ? SORT_COMPARATORS[sortBy] : null;
    return [...buckets.entries()].map(([statusKey, arr]) => {
      let sorted = arr;
      if (cmp) {
        sorted = [...arr].sort((a, b) => {
          const r = cmp(a, b);
          return sortDir === 'desc' ? -r : r;
        });
      }
      return { statusKey, leads: sorted };
    });
  }, [leads, sortBy, sortDir]);

  return (
    <div className="space-y-5">
      {grupos.map(({ statusKey, leads: gLeads }) => {
        const s = STATUS_MAP[statusKey];
        const dot = STATUS_DOT[statusKey] || STATUS_DOT['1_msg_enviada'];
        const colapsado = colapsados.has(statusKey);
        // Cor textual suave do status pra header (sem fundo carregado)
        const textKey = (dot.bg || 'bg-gray-500').replace('bg-', '').replace('-700', '-700').replace('-600', '-600');
        return (
          <section key={statusKey}>
            {/* Header de grupo — balão colorido estilo ClickUp + master checkbox */}
            {(() => {
              const idsGrupo = gLeads.map((l) => l.id);
              const todosSelecionados = idsGrupo.length > 0 && idsGrupo.every((id) => selecionados.has(id));
              const algunsSelecionados = idsGrupo.some((id) => selecionados.has(id));
              return (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => toggle(statusKey)}
                    className="inline-flex items-center gap-2 group"
                  >
                    <CaretRight
                      size={11}
                      weight="bold"
                      className={`text-gray-400 transition-transform duration-200 ${colapsado ? '' : 'rotate-90'}`}
                    />
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${dot.bg} ${dot.text} shadow-sm`}
                    >
                      <span className="w-2 h-2 rounded-full bg-white/90" />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.06em]">
                        {s.label}
                      </span>
                    </span>
                    <span className="text-[12px] text-gray-500 font-semibold tabular-nums">
                      {gLeads.length}
                    </span>
                  </button>
                  {/* Master checkbox: marca/desmarca todos do grupo */}
                  {!colapsado && (
                    <button
                      onClick={() => selecionarTodos(idsGrupo, !todosSelecionados)}
                      className="ml-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                      title={todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}
                    >
                      <CheckSquareInput checked={todosSelecionados} indeterminate={algunsSelecionados && !todosSelecionados} />
                      <span>{todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {!colapsado && gLeads.length > 0 && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden">
                {/* Header de colunas — cliques ordenam */}
                <div className="grid grid-cols-[28px_1.7fr_120px_140px_160px_110px_1fr_120px_70px_70px] items-center gap-2 px-5 py-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <div></div>
                  <SortHeader label="Nome" sortKey="nome" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="Cod. Cliente" sortKey="cod_cliente" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="CPF" sortKey="cpf" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="WhatsApp" sortKey="whatsapp" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="Data Nasc." sortKey="data_nasc" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="Empresa" sortKey="empresa" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="Instagram" sortKey="instagram" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader label="CVV" sortKey="cvv" sortBy={sortBy} sortDir={sortDir} onSort={onSort} align="center" />
                  <div></div>
                </div>

                {gLeads.map((l, idx) => {
                  const codCli = l.totvs_person_code
                    ? `COD. ${String(l.totvs_person_code).padStart(4, '0')}`
                    : null;
                  const cor = corPorIndicacao(l.indicado_por);
                  const slug = slugificarIndicacao(l.indicado_por);
                  const isLast = idx === gLeads.length - 1;
                  const isSel = selecionados.has(l.id);
                  return (
                    <div
                      key={l.id}
                      onClick={() => setEditLead(l)}
                      className={`grid grid-cols-[28px_1.7fr_120px_140px_160px_110px_1fr_120px_70px_70px] items-center gap-2 px-5 py-3 transition-colors cursor-pointer ${
                        isSel ? 'bg-blue-50/60' : 'hover:bg-blue-50/30'
                      } ${!isLast ? 'border-b border-gray-50' : ''}`}
                    >
                      {/* Checkbox de seleção */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <CheckSquareInput
                          checked={isSel}
                          onChange={() => toggleSelecao(l.id)}
                        />
                      </div>

                      {/* Nome */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full ${dot.bg} shrink-0`}
                          title={s.label}
                        />
                        <span className="font-semibold text-gray-800 text-[13px] truncate">
                          {l.nome}
                        </span>
                        {l.indicado_por && (
                          <span
                            className={`inline-flex items-center px-2 py-[1px] rounded-md text-[10px] font-bold ${cor.bg} ${cor.text} whitespace-nowrap shrink-0`}
                            title={`Indicado por ${l.indicado_por}`}
                          >
                            {slug || l.indicado_por}
                          </span>
                        )}
                        {l.totvs_sync_error && (
                          <button
                            onClick={(e) => { e.stopPropagation(); sincronizarTotvs(l); }}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 shrink-0"
                            title={l.totvs_sync_error}
                          >
                            retry
                          </button>
                        )}
                      </div>

                      {/* Cod cliente */}
                      <div className="text-[12px] text-gray-400 font-mono truncate" title={codCli || ''}>
                        {codCli || <span className="text-gray-300">—</span>}
                      </div>

                      {/* CPF */}
                      <div className="text-[12px] text-gray-600 font-mono tabular-nums">
                        {fmtCPF(l.cpf)}
                      </div>

                      {/* WhatsApp */}
                      <div className="text-[12px] text-gray-600 font-mono tabular-nums">
                        {fmtWhatsappBR(l.whatsapp)}
                      </div>

                      {/* Data Nasc */}
                      <div className="text-[12px] text-gray-600 tabular-nums">
                        {fmtNasc(l.data_nasc)}
                      </div>

                      {/* Empresa */}
                      <div className="text-[12px] text-gray-600 truncate" title={l.empresa || ''}>
                        {l.empresa || <span className="text-gray-300">—</span>}
                      </div>

                      {/* Instagram */}
                      <div className="text-[12px]">
                        {l.instagram ? (
                          <a
                            href={`https://instagram.com/${(l.instagram || '').replace(/[@\s]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-pink-600 hover:text-pink-700 hover:underline truncate block max-w-[110px]"
                            title={l.instagram}
                          >
                            {l.instagram.startsWith('@') ? l.instagram : `@${l.instagram.replace(/\s/g, '')}`}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>

                      {/* CVV */}
                      <div className="text-center">
                        {l.cvv ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-semibold text-[11px] tabular-nums">
                            {l.cvv}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>

                      {/* Ações — só aparecem no hover, mais discreto */}
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                        <select
                          value={l.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); atualizarStatus(l, e.target.value); }}
                          className="text-[10px] rounded-md bg-transparent text-gray-500 hover:text-gray-700 px-1 py-0.5 cursor-pointer focus:outline-none w-[18px]"
                          title="Trocar status"
                        >
                          {STATUS_OPTIONS.slice(1).map((o) => (
                            <option key={o.v} value={o.v}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => { e.stopPropagation(); remover(l); }}
                          className="text-gray-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                          title="Remover"
                        >
                          <Trash size={13} weight="duotone" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Reusable input com label
function CampoEdit({ label, value, onChange, placeholder, type = 'text', mono, icon: Icon, helper }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        )}
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder:text-gray-300 ${mono ? 'font-mono tabular-nums' : ''}`}
        />
      </div>
      {helper && <p className="text-[11px] text-gray-400 mt-1">{helper}</p>}
    </div>
  );
}

function DetalhesModal({ lead, onClose, onSaved, onSyncTotvs }) {
  // Estado de edição — começa com os valores atuais do lead
  const [form, setForm] = useState({
    nome: lead.nome || '',
    email: lead.email || '',
    whatsapp: lead.whatsapp || '',
    cpf: lead.cpf || '',
    empresa: lead.empresa || '',
    instagram: lead.instagram || '',
    data_nasc: lead.data_nasc || '',
    sexo: lead.sexo || '',
    cep: lead.cep || '',
    endereco: lead.endereco || '',
    numero: lead.numero || '',
    complemento: lead.complemento || '',
    cidade: lead.cidade || '',
    estado: lead.estado || '',
    indicado_por: lead.indicado_por || '',
    cvv: lead.cvv || '',
    observacao: lead.observacao || '',
  });
  const [salvando, setSalv] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Busca cidade/estado/endereço pelo CEP via ViaCEP (API pública gratuita).
  // Preenche cidade e estado sempre; endereço/bairro só se estiverem vazios
  // (não sobrescreve o que o usuário já digitou).
  const buscarCep = async (cepRaw) => {
    const cep = String(cepRaw || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j && !j.erro) {
        setForm((f) => ({
          ...f,
          cidade: j.localidade || f.cidade,
          estado: j.uf || f.estado,
          endereco: f.endereco?.trim() ? f.endereco : (j.logradouro || f.endereco),
          complemento: f.complemento?.trim() ? f.complemento : (j.bairro || f.complemento),
        }));
      }
    } catch {
      /* silencioso — CEP inválido/offline não bloqueia edição manual */
    } finally {
      setBuscandoCep(false);
    }
  };

  // Detecta o que mudou em relação ao lead original
  const camposAlterados = useMemo(() => {
    const diff = {};
    for (const k of Object.keys(form)) {
      const original = lead[k] ?? '';
      if (String(form[k]).trim() !== String(original).trim()) diff[k] = form[k];
    }
    return diff;
  }, [form, lead]);
  const temAlteracao = Object.keys(camposAlterados).length > 0;

  const salvar = async () => {
    if (!temAlteracao) { onClose(); return; }
    setSalv(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camposAlterados),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erro');
      onSaved(j.lead);
    } catch (e) {
      alert('Falha ao salvar: ' + e.message);
    } finally {
      setSalv(false);
    }
  };

  const s = STATUS_MAP[lead.status] || STATUS_MAP['1_msg_enviada'];
  const StatusIcon = s.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — compacto, com indicador de mudanças */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <CreditCard size={20} weight="duotone" className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">
                {form.nome || 'Editar lead'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.cor}`}>
                  <StatusIcon size={9} weight="duotone" /> {s.label}
                </span>
                <span className="text-[11px] text-gray-400">#{lead.id} · {fmtDate(lead.criado_em)}</span>
                {temAlteracao && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                    ● {Object.keys(camposAlterados).length} alteração(ões)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-700 leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body — formulário de edição */}
        <div className="p-6 space-y-5">
          {/* Seção: identificação */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Identificação</legend>
            <CampoEdit
              label="Nome completo"
              value={form.nome}
              onChange={(v) => setField('nome', v)}
              placeholder="Nome do lead"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CampoEdit
                label="CPF"
                value={form.cpf}
                onChange={(v) => setField('cpf', v)}
                placeholder="000.000.000-00"
                mono
                icon={CreditCard}
              />
              <CampoEdit
                label="Data de nascimento"
                value={form.data_nasc}
                onChange={(v) => setField('data_nasc', v)}
                placeholder="DD/MM/AAAA"
                icon={Calendar}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Sexo
                {!form.sexo && (
                  <span className="ml-2 text-[10px] font-bold text-amber-600">
                    ⚠ obrigatório p/ cadastrar no TOTVS
                  </span>
                )}
              </label>
              <select
                value={form.sexo}
                onChange={(e) => setField('sexo', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 ${form.sexo ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}
              >
                <option value="">— Selecione —</option>
                <option value="Female">Feminino</option>
                <option value="Male">Masculino</option>
              </select>
            </div>
          </fieldset>

          {/* Seção: contato */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Contato</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CampoEdit
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => setField('whatsapp', v)}
                placeholder="83998888777"
                mono
                icon={WhatsappLogo}
                helper="Só dígitos. DDI 55 opcional."
              />
              <CampoEdit
                label="Email"
                value={form.email}
                onChange={(v) => setField('email', v)}
                placeholder="email@exemplo.com"
                type="email"
                icon={At}
              />
            </div>
            <CampoEdit
              label="Instagram"
              value={form.instagram}
              onChange={(v) => setField('instagram', v)}
              placeholder="@usuario"
              icon={InstagramLogo}
            />
          </fieldset>

          {/* Seção: profissional */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Profissional</legend>
            <CampoEdit
              label="Empresa / Profissão"
              value={form.empresa}
              onChange={(v) => setField('empresa', v)}
              placeholder="Nome da empresa ou profissão"
              icon={Buildings}
            />
          </fieldset>

          {/* Seção: endereço */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Endereço</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CampoEdit
                label={buscandoCep ? 'CEP (buscando…)' : 'CEP'}
                value={form.cep}
                onChange={(v) => {
                  setField('cep', v);
                  if (String(v).replace(/\D/g, '').length === 8) buscarCep(v);
                }}
                placeholder="00000000"
                mono
              />
              <div className="sm:col-span-2">
                <CampoEdit
                  label="Endereço"
                  value={form.endereco}
                  onChange={(v) => setField('endereco', v)}
                  placeholder="Rua, avenida…"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <CampoEdit
                  label="Cidade"
                  value={form.cidade}
                  onChange={(v) => setField('cidade', v)}
                  placeholder="Preenchida pelo CEP"
                  icon={MapPin}
                />
              </div>
              <CampoEdit
                label="Estado (UF)"
                value={form.estado}
                onChange={(v) => setField('estado', v.toUpperCase().slice(0, 2))}
                placeholder="UF"
                mono
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CampoEdit
                label="Número"
                value={form.numero}
                onChange={(v) => setField('numero', v)}
                placeholder="123"
              />
              <div className="sm:col-span-2">
                <CampoEdit
                  label="Complemento"
                  value={form.complemento}
                  onChange={(v) => setField('complemento', v)}
                  placeholder="Apto, bloco, bairro…"
                />
              </div>
            </div>
          </fieldset>

          {/* Seção: rastreamento BlueCard */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">BlueCard</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CampoEdit
                label="Indicado por"
                value={form.indicado_por}
                onChange={(v) => setField('indicado_por', v)}
                placeholder="Nome de quem indicou"
              />
              <CampoEdit
                label="CVV (código)"
                value={form.cvv}
                onChange={(v) => setField('cvv', v)}
                placeholder="000"
                mono
              />
            </div>
          </fieldset>

          {/* Integração TOTVS — apenas leitura */}
          <div className={`rounded-xl p-3 border ${lead.totvs_person_code ? 'bg-emerald-50 border-emerald-200' : lead.totvs_sync_error ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600">Cadastro TOTVS</p>
              {lead.totvs_synced_at && (
                <p className="text-[10px] text-gray-500">{fmtDate(lead.totvs_synced_at)}</p>
              )}
            </div>
            {lead.totvs_person_code ? (
              <p className="text-sm text-emerald-800 font-semibold flex items-center gap-1.5">
                <CheckCircle size={15} weight="fill" />
                PersonCode: <span className="font-mono bg-white px-1.5 py-0.5 rounded">{lead.totvs_person_code}</span>
              </p>
            ) : lead.totvs_sync_error ? (
              <>
                <p className="text-xs text-rose-800 mb-2">
                  ❌ {lead.totvs_sync_error}
                </p>
                <button
                  onClick={() => onSyncTotvs?.()}
                  className="text-xs px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Tentar sincronizar de novo
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-600">
                Será cadastrado automaticamente ao mover pra <b>Informações Completas</b>.
              </p>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
              Observações internas
            </label>
            <textarea
              value={form.observacao}
              onChange={(e) => setField('observacao', e.target.value)}
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder:text-gray-300"
              placeholder="Anotações, próximos passos…"
            />
          </div>

          {/* Metadata read-only */}
          <div className="text-[11px] text-gray-400 flex items-center gap-3 flex-wrap pt-1">
            <span>Origem: <span className="text-gray-600 font-medium">{lead.origem}</span></span>
            <span className="text-gray-300">·</span>
            <span>IP: <span className="font-mono">{lead.ip || '—'}</span></span>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !temAlteracao}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {salvando ? 'Salvando…' : temAlteracao ? `Salvar (${Object.keys(camposAlterados).length})` : 'Sem alterações'}
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

// ────────────────────────────────────────────────────────────────────────
// Modal: importa lista de contatos (CSV/paste) com status "1ª Mensagem"
// ────────────────────────────────────────────────────────────────────────
// Normaliza cabeçalho: minúsculo, sem acento, sem pontuação extra.
// Mapeia os títulos usados nas planilhas reais (ex: "Data de Nascimento",
// "Nome da empresa/négocio", "Nº", "E-mail") pros campos do backend.
function mapHeaderLead(h) {
  const k = String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9_/ ]/g, '')
    .trim();
  if (!k) return null;
  if (k === 'nome') return 'nome';
  if (k.includes('whatsapp') || k === 'telefone' || k === 'celular' || k === 'fone') return 'whatsapp';
  if (k === 'cpf') return 'cpf';
  if (k.includes('indicado')) return 'indicado_por';
  if (k.includes('nascimento') || k === 'data_nasc' || k === 'nasc') return 'data_nasc';
  if (k.includes('mail')) return 'email';
  if (k === 'instagram' || k === 'insta') return 'instagram';
  if (k.includes('empresa') || k.includes('negocio')) return 'empresa';
  if (k === 'cep') return 'cep';
  if (k.includes('endereco')) return 'endereco';
  if (k === 'n' || k === 'no' || k === 'num' || k === 'numero') return 'numero';
  if (k.includes('complemento')) return 'complemento';
  if (k === 'cidade') return 'cidade';
  if (k === 'estado' || k === 'uf') return 'estado';
  return k.replace(/[/ ]+/g, '_'); // fallback: mantém como veio (normalizado)
}

// Converte valor de célula pra string. Date do Excel vira dd/mm/aaaa.
function cellToStr(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const d = String(v.getDate()).padStart(2, '0');
    const m = String(v.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${v.getFullYear()}`;
  }
  return String(v).trim();
}

function ImportarLeadsModal({ onClose, onImportado }) {
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [arquivoNome, setArquivoNome] = useState('');
  const [erroArquivo, setErroArquivo] = useState('');

  // Parser simples: aceita CSV ou colado do Excel (separador vírgula ou tab).
  // Cabeçalho obrigatório na 1ª linha: nome,whatsapp[,email,cpf,empresa,instagram,data_nasc,cep,endereco,numero,complemento,indicado_por]
  const parseTexto = (raw) => {
    const linhas = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) return [];
    // Detecta separador: se a 1ª linha tem tab, usa tab; senão vírgula ou ponto-e-vírgula.
    const primeira = linhas[0];
    const sep = primeira.includes('\t') ? '\t' : primeira.includes(';') ? ';' : ',';
    const header = primeira.split(sep).map((h) => mapHeaderLead(h) || h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(sep).map((c) => c.trim());
      const obj = {};
      header.forEach((h, idx) => {
        obj[h] = cols[idx] || '';
      });
      rows.push(obj);
    }
    return rows;
  };

  // Upload de arquivo Excel (.xlsx/.xls) ou CSV — lê a 1ª aba e mapeia os
  // cabeçalhos automaticamente (aceita "Data de Nascimento", "Nº", "E-mail" etc).
  const onArquivo = async (file) => {
    if (!file) return;
    setErroArquivo('');
    setTexto('');
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      // header:1 → matriz crua; 1ª linha = cabeçalhos
      const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (matriz.length < 2) throw new Error('Planilha sem linhas de dados');
      const headers = matriz[0].map((h) => mapHeaderLead(h));
      const rows = [];
      for (let i = 1; i < matriz.length; i++) {
        const linha = matriz[i];
        if (!linha || linha.every((c) => cellToStr(c) === '')) continue;
        const obj = {};
        headers.forEach((h, idx) => {
          if (!h) return;
          obj[h] = cellToStr(linha[idx]);
        });
        rows.push(obj);
      }
      if (rows.length === 0) throw new Error('Nenhuma linha com dados');
      if (!headers.includes('nome') || !headers.includes('whatsapp')) {
        throw new Error('Planilha precisa ter as colunas Nome e Whatsapp');
      }
      setArquivoNome(file.name);
      setPreview(rows);
    } catch (e) {
      setArquivoNome('');
      setPreview([]);
      setErroArquivo(e.message);
    }
  };

  React.useEffect(() => {
    if (!texto.trim()) {
      // Sem texto: mantém preview do arquivo (se houver)
      if (!arquivoNome) setPreview([]);
      return;
    }
    try {
      const rows = parseTexto(texto);
      setArquivoNome('');
      setPreview(rows);
    } catch {
      setPreview([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const importar = async () => {
    if (preview.length === 0) return;
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview, status: '1_msg_enviada' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setResultado(j);
    } catch (e) {
      setResultado({ error: e.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={18} weight="duotone" className="text-emerald-600" />
            <h2 className="font-bold text-gray-800">Importar Lista de Leads</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/60 flex items-center justify-center text-gray-500">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {!resultado && (
            <>
              {/* Upload de arquivo Excel/CSV */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onArquivo(e.dataTransfer.files?.[0]); }}
                className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl px-4 py-6 cursor-pointer transition-colors mb-3"
              >
                <Upload size={22} weight="duotone" className="text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">
                  {arquivoNome ? arquivoNome : 'Clique ou arraste o arquivo Excel aqui'}
                </span>
                <span className="text-[11px] text-gray-500">
                  .xlsx, .xls ou .csv — 1ª aba, cabeçalhos na 1ª linha
                  (Nome, Whatsapp, CPF, Cidade, Estado…)
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { onArquivo(e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
              {erroArquivo && (
                <p className="text-xs text-rose-600 mb-2">Erro no arquivo: {erroArquivo}</p>
              )}

              <p className="text-xs text-gray-600 mb-2">
                Ou cole abaixo a lista (CSV, TSV ou copiado do Excel). A 1ª linha
                deve ter os cabeçalhos: <code className="bg-gray-100 px-1 rounded">nome,whatsapp,cidade,email,cpf,empresa,instagram</code>.
                Todos serão criados no status <b>1ª Mensagem Enviada</b>.
              </p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={`nome,whatsapp,cidade,email\nJoão Silva,83999999999,João Pessoa,joao@ex.com\nMaria Souza,84988888888,Natal,maria@ex.com`}
                className="w-full h-28 border border-gray-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              {preview.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Preview: {preview.length} linhas detectadas
                  </p>
                  <div className="max-h-40 overflow-auto border border-gray-200 rounded-lg text-xs">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {Object.keys(preview[0]).map((h) => (
                            <th key={h} className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 10).map((r, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            {Object.keys(preview[0]).map((h) => (
                              <td key={h} className="px-2 py-1 text-gray-600">{r[h] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.length > 10 && (
                    <p className="text-[10px] text-gray-400 mt-1">…e mais {preview.length - 10} linhas</p>
                  )}
                </div>
              )}
            </>
          )}
          {resultado && !resultado.error && (
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                <div className="font-bold">✓ Importação concluída</div>
                <ul className="text-xs mt-2 space-y-1">
                  <li>Recebidos: {resultado.recebidos}</li>
                  <li>Inseridos: <b>{resultado.inseridos}</b></li>
                  <li>Ignorados (duplicados): {resultado.ignorados_duplicados}</li>
                  <li>Status aplicado: {resultado.status_aplicado}</li>
                </ul>
              </div>
              {resultado.erros?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                  <div className="font-bold">Avisos ({resultado.erros.length})</div>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                    {resultado.erros.slice(0, 20).map((e, i) => (
                      <li key={i}>Linha {e.linha}: {e.motivo}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {resultado?.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
              Erro: {resultado.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          {resultado ? (
            <button
              onClick={onImportado}
              className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Fechar e atualizar
            </button>
          ) : (
            <>
              <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={preview.length === 0 || enviando}
                className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
              >
                {enviando ? 'Importando…' : `Importar ${preview.length} lead${preview.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal: gera link de indicação personalizado com nome do referrer
// ────────────────────────────────────────────────────────────────────────
function GerarLinkIndicacaoModal({ onClose }) {
  const [nome, setNome] = useState('');
  const [copiado, setCopiado] = useState(false);

  // Capitaliza primeira letra de cada palavra (mesma lógica da LP)
  const nomeFormatado = useMemo(() => {
    return nome
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }, [nome]);

  // Encoded pra URL (espaços viram +)
  const linkPath = useMemo(() => {
    if (!nomeFormatado) return '/lp/bluecard/indicacao';
    const encoded = encodeURIComponent(nomeFormatado).replace(/%20/g, '+');
    return `/lp/bluecard/indicacao?indicado_por=${encoded}`;
  }, [nomeFormatado]);

  const linkCompleto = `${window.location.origin}${linkPath}`;

  const mensagemWhatsapp = nomeFormatado
    ? `Olá! Você foi indicado(a) por *${nomeFormatado}* pra receber o cartão *BlueCard* exclusivo da Crosby 🎁\n\nÉ um presente em reconhecimento ao seu trabalho. Cadastre-se aqui:\n\n${linkCompleto}`
    : `Olá! Cadastre-se pra receber o cartão *BlueCard* exclusivo da Crosby 🎁\n\n${linkCompleto}`;

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(mensagemWhatsapp)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback: seleciona o input
      alert('Copia manualmente: ' + linkCompleto);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Share size={18} weight="duotone" className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">
              Gerar link de indicação
            </h2>
            <p className="text-[12px] text-gray-500 leading-tight">
              Compartilhe pra rastrear quem indicou o lead
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none p-1"
            title="Fechar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Input nome */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gray-500 font-bold block mb-1.5">
              Nome de quem está indicando
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              autoFocus
              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
            {nomeFormatado && nomeFormatado !== nome.trim() && (
              <p className="text-[11px] text-gray-400 mt-1">
                Aparecerá como: <strong className="text-gray-700">{nomeFormatado}</strong>
              </p>
            )}
          </div>

          {/* Link gerado */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gray-500 font-bold block mb-1.5 flex items-center gap-1.5">
              <LinkSimple size={12} weight="bold" />
              Link gerado
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={linkCompleto}
                className="w-full px-3 py-2.5 pr-12 text-[12px] bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-700 focus:outline-none cursor-text"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={copiar}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                  copiado
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-white border border-gray-300 hover:bg-gray-100 text-gray-700'
                }`}
                title="Copiar link"
              >
                {copiado ? (
                  <span className="inline-flex items-center gap-1">
                    <Check size={11} weight="bold" /> Copiado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Copy size={11} weight="bold" /> Copiar
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Preview da mensagem WhatsApp */}
          {nomeFormatado && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-gray-500 font-bold block mb-1.5">
                Mensagem pré-pronta
              </label>
              <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-lg p-3 text-[12px] text-gray-700 whitespace-pre-line max-h-32 overflow-y-auto">
                {mensagemWhatsapp}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-sm transition-colors min-w-[180px]"
            >
              <WhatsappLogo size={16} weight="fill" />
              Abrir WhatsApp
            </a>
            <a
              href={linkPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
              title="Abrir a LP em nova aba"
            >
              Visualizar LP ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
