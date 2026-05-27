// Página: Tecnologia → Inventário de Patrimônio
// Gerencia bens da empresa (ar condicionado, celular, computador, etc).
// Cada item tem um código de patrimônio único (PAT-XXXXXX).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  Funnel,
  Spinner,
  CheckCircle,
  X,
  Buildings,
  User,
  Tag,
  MapPin,
  DeviceMobile,
  Desktop,
  Wind,
  Printer,
  Television,
  Monitor,
  Couch,
  WifiHigh,
  Question,
  CurrencyDollar,
  CalendarBlank,
  Rows,
  SquaresFour,
  ArrowsClockwise,
  Stack,
  Hash,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';

// ─── Configuração ──────────────────────────────────────────────────────────
const TIPOS = [
  { value: 'ar_condicionado', label: 'Ar Condicionado', icon: Wind, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { value: 'celular', label: 'Celular', icon: DeviceMobile, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'computador', label: 'Computador', icon: Desktop, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'notebook', label: 'Notebook', icon: Desktop, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { value: 'impressora', label: 'Impressora', icon: Printer, color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'monitor', label: 'Monitor', icon: Monitor, color: 'text-sky-600', bg: 'bg-sky-50' },
  { value: 'televisor', label: 'Televisor', icon: Television, color: 'text-rose-600', bg: 'bg-rose-50' },
  { value: 'mobiliario', label: 'Mobiliário', icon: Couch, color: 'text-amber-700', bg: 'bg-amber-50' },
  { value: 'roteador', label: 'Roteador', icon: WifiHigh, color: 'text-teal-600', bg: 'bg-teal-50' },
  { value: 'outro', label: 'Outro', icon: Question, color: 'text-gray-600', bg: 'bg-gray-50' },
];

const STATUS_OPTS = [
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'em_manutencao', label: 'Em Manutenção', color: 'bg-amber-100 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  { value: 'emprestado', label: 'Emprestado', color: 'bg-blue-100 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  { value: 'descartado', label: 'Descartado', color: 'bg-gray-200 text-gray-600 ring-gray-300', dot: 'bg-gray-400' },
  { value: 'extraviado', label: 'Extraviado', color: 'bg-rose-100 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
];

const SETORES = [
  'TI', 'RH', 'Vendas', 'Financeiro', 'Marketing', 'Operações',
  'Diretoria', 'Loja', 'Logística', 'Outros',
];

const fmtBRL = (v) =>
  v == null || v === ''
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('pt-BR');
};

function tipoInfo(t) {
  return TIPOS.find((x) => x.value === t) || TIPOS[TIPOS.length - 1];
}
function statusInfo(s) {
  return STATUS_OPTS.find((x) => x.value === s) || STATUS_OPTS[0];
}

// ─── Modal de cadastro/edição ──────────────────────────────────────────────
function PatrimonioModal({ item, onClose, onSaved }) {
  const isNew = !item;
  const { user } = useAuth() || {};
  const userLogin = user?.email || user?.user_metadata?.login || '';

  const [form, setForm] = useState({
    codigo_patrimonio: item?.codigo_patrimonio || '',
    tipo: item?.tipo || 'computador',
    descricao: item?.descricao || '',
    marca: item?.marca || '',
    modelo: item?.modelo || '',
    numero_serie: item?.numero_serie || '',
    local: item?.local || '',
    setor: item?.setor || '',
    responsavel: item?.responsavel || '',
    responsavel_cpf: item?.responsavel_cpf || '',
    responsavel_email: item?.responsavel_email || '',
    data_aquisicao: item?.data_aquisicao
      ? String(item.data_aquisicao).slice(0, 10)
      : '',
    valor_aquisicao: item?.valor_aquisicao || '',
    fornecedor: item?.fornecedor || '',
    nota_fiscal: item?.nota_fiscal || '',
    status: item?.status || 'ativo',
    observacao: item?.observacao || '',
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  // Pré-popula com próximo código se novo
  useEffect(() => {
    if (!isNew) return;
    fetch(`${API_BASE_URL}/api/tech/patrimonio/proximo-codigo`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j.data?.proximo && !form.codigo_patrimonio) {
          set('codigo_patrimonio', j.data.proximo);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!form.codigo_patrimonio?.trim()) {
      setErro('Código de patrimônio obrigatório');
      return;
    }
    if (!form.tipo) {
      setErro('Tipo obrigatório');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Normalizações
      payload.valor_aquisicao =
        payload.valor_aquisicao !== '' && payload.valor_aquisicao != null
          ? Number(String(payload.valor_aquisicao).replace(',', '.'))
          : null;
      payload.data_aquisicao = payload.data_aquisicao || null;
      const url = isNew
        ? `${API_BASE_URL}/api/tech/patrimonio`
        : `${API_BASE_URL}/api/tech/patrimonio/${item.id}`;
      const userField = isNew ? 'criado_por' : 'atualizado_por';
      payload[userField] = userLogin;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        throw new Error(j?.message || `Erro ${r.status}`);
      }
      onSaved?.(j.data);
      onClose?.();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSaving(false);
    }
  };

  const tInfo = tipoInfo(form.tipo);
  const TIcon = tInfo.icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${tInfo.bg}`}>
              <TIcon size={20} weight="duotone" className={tInfo.color} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#000638]">
                {isNew ? 'Novo Patrimônio' : `Editar — ${item.codigo_patrimonio}`}
              </h2>
              <p className="text-[11px] text-gray-500">
                {isNew ? 'Cadastrar novo item no inventário' : `Atualizado ${fmtDate(item.atualizado_em)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-5 space-y-4">
          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          {/* Identificação */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Identificação
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">
                  Cód. Patrimônio *
                </label>
                <input
                  value={form.codigo_patrimonio}
                  onChange={(e) => set('codigo_patrimonio', e.target.value.toUpperCase())}
                  placeholder="PAT-000001"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">
                  Tipo *
                </label>
                <select
                  value={form.tipo}
                  onChange={(e) => set('tipo', e.target.value)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] font-semibold text-gray-600 uppercase">
                  Descrição
                </label>
                <input
                  value={form.descricao}
                  onChange={(e) => set('descricao', e.target.value)}
                  placeholder="Ex: Notebook Dell Latitude para uso da diretoria"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Equipamento */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Equipamento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Marca</label>
                <input
                  value={form.marca}
                  onChange={(e) => set('marca', e.target.value)}
                  placeholder="Dell, Samsung, Carrier…"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Modelo</label>
                <input
                  value={form.modelo}
                  onChange={(e) => set('modelo', e.target.value)}
                  placeholder="Latitude 5420, Galaxy S24…"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Nº de Série</label>
                <input
                  value={form.numero_serie}
                  onChange={(e) => set('numero_serie', e.target.value)}
                  placeholder="serial number"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
            </div>
          </section>

          {/* Localização e responsável */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Localização e Responsável
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Local</label>
                <input
                  value={form.local}
                  onChange={(e) => set('local', e.target.value)}
                  placeholder="Sala da Diretoria, Filial Recife…"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Setor</label>
                <input
                  list="setores-list"
                  value={form.setor}
                  onChange={(e) => set('setor', e.target.value)}
                  placeholder="TI, Financeiro…"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <datalist id="setores-list">
                  {SETORES.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Responsável</label>
                <input
                  value={form.responsavel}
                  onChange={(e) => set('responsavel', e.target.value)}
                  placeholder="Nome do responsável"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">CPF do Responsável</label>
                <input
                  value={form.responsavel_cpf}
                  onChange={(e) => set('responsavel_cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-semibold text-gray-600 uppercase">E-mail do Responsável</label>
                <input
                  type="email"
                  value={form.responsavel_email}
                  onChange={(e) => set('responsavel_email', e.target.value)}
                  placeholder="responsavel@empresa.com"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Aquisição */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Aquisição
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Data Aquisição</label>
                <input
                  type="date"
                  value={form.data_aquisicao}
                  onChange={(e) => set('data_aquisicao', e.target.value)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_aquisicao}
                  onChange={(e) => set('valor_aquisicao', e.target.value)}
                  placeholder="0,00"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Fornecedor</label>
                <input
                  value={form.fornecedor}
                  onChange={(e) => set('fornecedor', e.target.value)}
                  placeholder="Empresa que vendeu"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase">Nº NF</label>
                <input
                  value={form.nota_fiscal}
                  onChange={(e) => set('nota_fiscal', e.target.value)}
                  placeholder="123456"
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
            </div>
          </section>

          {/* Observação */}
          <section>
            <label className="text-[10px] font-semibold text-gray-600 uppercase">Observação</label>
            <textarea
              value={form.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              rows={2}
              placeholder="Observações livres"
              className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm resize-none"
            />
          </section>
        </form>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#000638] hover:bg-[#fe0000] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide"
          >
            {saving ? (
              <>
                <Spinner size={12} className="animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <CheckCircle size={12} weight="fill" />
                {isNew ? 'Cadastrar' : 'Salvar alterações'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600', border: 'border-blue-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600', border: 'border-emerald-200' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', icon: 'text-cyan-600', border: 'border-cyan-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600', border: 'border-amber-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600', border: 'border-purple-200' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-3 flex flex-col gap-0.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <Icon size={14} weight="duotone" className={c.icon} />
      </div>
      <div className={`text-xl font-bold ${c.text} tabular-nums leading-tight`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────
export default function InventarioPatrimonio() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');

  // UI: view (tabela | cards), filtros expandidos
  const [view, setView] = useState('cards');
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { user } = useAuth() || {};
  const userLogin = user?.email || user?.user_metadata?.login || '';

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroSetor) params.set('setor', filtroSetor);
      if (busca) params.set('q', busca);
      const [listR, statsR] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tech/patrimonio?${params.toString()}`),
        fetch(`${API_BASE_URL}/api/tech/patrimonio/estatisticas`),
      ]);
      const listJ = await listR.json();
      const statsJ = await statsR.json();
      if (!listJ?.success) throw new Error(listJ?.message || 'Erro ao carregar');
      setItems(listJ.data?.items || []);
      if (statsJ?.success) setStats(statsJ.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, filtroStatus, filtroSetor, busca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/tech/patrimonio/${confirmDelete.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deletado_por: userLogin }),
        },
      );
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setConfirmDelete(null);
      carregar();
    } catch (e) {
      alert(`Erro ao deletar: ${e.message}`);
    }
  };

  // Top setores/tipos para stats
  const topTipo = useMemo(() => {
    if (!stats?.por_tipo) return null;
    const e = Object.entries(stats.por_tipo).sort((a, b) => b[1] - a[1])[0];
    return e ? { tipo: e[0], count: e[1] } : null;
  }, [stats]);

  const ativos = stats?.por_status?.ativo || 0;
  const manutencao = stats?.por_status?.em_manutencao || 0;

  const setoresCadastrados = Object.keys(stats?.por_setor || {}).filter(
    (k) => k !== 'sem_info',
  ).length;
  const hasFiltros = !!(busca || filtroTipo || filtroStatus || filtroSetor);

  return (
    <div className="w-full max-w-7xl mx-auto py-4 px-3 flex flex-col gap-4">
      {/* ─── HERO HEADER ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg border-0">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-700 via-cyan-800 to-blue-900" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Esquerda: título */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
                <Package size={28} weight="duotone" className="text-cyan-200" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">Inventário de Patrimônio</h1>
                <p className="text-xs text-cyan-200 mt-0.5 max-w-xl">
                  Controle centralizado de todos os bens da Crosby — equipamentos, mobiliário, climatização e eletrônicos
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2">
              <button
                onClick={carregar}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 backdrop-blur-sm disabled:opacity-50 transition-colors"
                title="Atualizar lista"
              >
                <ArrowsClockwise size={14} weight="bold" className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-cyan-700 hover:bg-cyan-50 text-xs font-bold uppercase tracking-wide shadow-md transition-colors"
              >
                <Plus size={14} weight="bold" />
                Novo Item
              </button>
            </div>
          </div>

          {/* KPIs inline no hero */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cyan-200 uppercase tracking-wider font-semibold">Total</span>
                  <Package size={14} weight="duotone" className="text-cyan-300" />
                </div>
                <p className="text-2xl font-bold mt-0.5 tabular-nums">{stats.total || 0}</p>
                <p className="text-[10px] text-cyan-200/70">itens cadastrados</p>
              </div>

              <div className="bg-emerald-500/15 backdrop-blur-sm border border-emerald-300/25 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">Ativos</span>
                  <CheckCircle size={14} weight="duotone" className="text-emerald-300" />
                </div>
                <p className="text-2xl font-bold mt-0.5 tabular-nums text-emerald-100">{ativos}</p>
                <p className="text-[10px] text-emerald-200/70">
                  {stats.total > 0 ? `${Math.round((ativos / stats.total) * 100)}% do total` : '—'}
                </p>
              </div>

              <div className={`${manutencao > 0 ? 'bg-amber-500/15 border-amber-300/25' : 'bg-white/10 border-white/15'} backdrop-blur-sm border rounded-xl px-3 py-2.5`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${manutencao > 0 ? 'text-amber-200' : 'text-cyan-200'}`}>Manutenção</span>
                  <Tag size={14} weight="duotone" className={manutencao > 0 ? 'text-amber-300' : 'text-cyan-300'} />
                </div>
                <p className={`text-2xl font-bold mt-0.5 tabular-nums ${manutencao > 0 ? 'text-amber-100' : 'text-cyan-100'}`}>
                  {manutencao}
                </p>
                <p className={`text-[10px] ${manutencao > 0 ? 'text-amber-200/70' : 'text-cyan-200/70'}`}>
                  {manutencao > 0 ? 'precisam atenção' : 'tudo em ordem'}
                </p>
              </div>

              <div className="bg-violet-500/15 backdrop-blur-sm border border-violet-300/25 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-violet-200 uppercase tracking-wider font-semibold">Valor Ativos</span>
                  <CurrencyDollar size={14} weight="duotone" className="text-violet-300" />
                </div>
                <p className="text-lg font-bold mt-0.5 tabular-nums text-violet-100 truncate">
                  {fmtBRL(stats.valor_ativos).replace('R$', 'R$ ')}
                </p>
                <p className="text-[10px] text-violet-200/70">
                  Total geral: {fmtBRL(stats.valor_total)}
                </p>
              </div>

              <div className="bg-sky-500/15 backdrop-blur-sm border border-sky-300/25 rounded-xl px-3 py-2.5 hidden lg:block">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-sky-200 uppercase tracking-wider font-semibold">Cobertura</span>
                  <Buildings size={14} weight="duotone" className="text-sky-300" />
                </div>
                <p className="text-2xl font-bold mt-0.5 tabular-nums text-sky-100">{setoresCadastrados}</p>
                <p className="text-[10px] text-sky-200/70">setores ativos</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Distribuição por tipo (gráfico de pills) ────────────────────── */}
      {stats?.por_tipo && Object.keys(stats.por_tipo).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Stack size={14} weight="duotone" className="text-cyan-600" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Distribuição por tipo
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.por_tipo)
              .sort((a, b) => b[1] - a[1])
              .map(([tipo, count]) => {
                const t = tipoInfo(tipo);
                const TIcon = t.icon;
                const active = filtroTipo === tipo;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <button
                    key={tipo}
                    onClick={() => setFiltroTipo(active ? '' : tipo)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      active
                        ? `${t.bg} ${t.color} border-current shadow-sm ring-2 ring-current/20`
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <TIcon size={13} weight={active ? 'fill' : 'duotone'} className={active ? t.color : 'text-gray-500'} />
                    <span className="text-xs font-semibold">{t.label}</span>
                    <span className={`text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/50' : 'bg-white text-gray-500'
                    }`}>
                      {count}
                    </span>
                    <span className={`text-[9px] ${active ? 'opacity-80' : 'text-gray-400'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            {filtroTipo && (
              <button
                onClick={() => setFiltroTipo('')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-rose-600 hover:bg-rose-50 text-xs font-semibold"
              >
                <X size={11} weight="bold" />
                limpar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Barra de busca + filtros avançados + toggle view ────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-cyan-500 focus-within:bg-white transition-colors">
            <MagnifyingGlass size={14} className="text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, descrição, marca, modelo, responsável, local..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtros avançados toggle */}
          <button
            onClick={() => setFiltrosOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              filtrosOpen || filtroStatus || filtroSetor
                ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Funnel size={13} weight="duotone" />
            Filtros
            {(filtroStatus || filtroSetor) && (
              <span className="bg-cyan-600 text-white text-[9px] rounded-full px-1.5 py-0.5 ml-0.5">
                {[filtroStatus, filtroSetor].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* View toggle (cards | tabela) */}
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('cards')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                view === 'cards' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Visão em cards"
            >
              <SquaresFour size={12} weight="bold" />
              Cards
            </button>
            <button
              onClick={() => setView('tabela')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                view === 'tabela' ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Visão em tabela"
            >
              <Rows size={12} weight="bold" />
              Tabela
            </button>
          </div>
        </div>

        {/* Filtros avançados expandido */}
        {filtrosOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-1">
                Status
              </label>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTS.map((s) => {
                  const active = filtroStatus === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setFiltroStatus(active ? '' : s.value)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ring-1 transition-all ${
                        active ? `${s.color} ring-2` : 'bg-gray-50 text-gray-600 ring-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-1">
                Setor
              </label>
              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white w-full max-w-xs"
              >
                <option value="">Todos os setores</option>
                {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {hasFiltros && (
              <button
                onClick={() => {
                  setBusca('');
                  setFiltroTipo('');
                  setFiltroStatus('');
                  setFiltroSetor('');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold"
              >
                <X size={11} weight="bold" />
                Limpar todos
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Lista ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 flex items-center justify-center text-gray-400">
          <Spinner size={24} className="animate-spin mr-2" />
          <span className="text-sm">Carregando inventário…</span>
        </div>
      ) : erro ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm flex items-center gap-2">
          <X size={16} weight="bold" />
          Erro: {erro}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-50 flex items-center justify-center mb-4">
            <Package size={32} weight="duotone" className="text-cyan-600" />
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-1">
            {hasFiltros ? 'Nenhum item encontrado' : 'Inventário vazio'}
          </h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            {hasFiltros
              ? 'Nenhum item bate com os filtros aplicados. Tente limpar os filtros ou usar outros critérios.'
              : 'Comece cadastrando o primeiro item do inventário. Ar-condicionados, computadores, celulares e outros bens.'}
          </p>
          <button
            onClick={() => {
              if (hasFiltros) {
                setBusca('');
                setFiltroTipo('');
                setFiltroStatus('');
                setFiltroSetor('');
              } else {
                setEditing(null);
                setModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold uppercase tracking-wide shadow-md"
          >
            {hasFiltros ? <X size={12} weight="bold" /> : <Plus size={12} weight="bold" />}
            {hasFiltros ? 'Limpar filtros' : 'Cadastrar primeiro item'}
          </button>
        </div>
      ) : view === 'cards' ? (
        // ─── VIEW CARDS ────────────────────────────────────────────────
        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 flex items-center gap-1.5 px-1">
            <Hash size={11} weight="bold" />
            <span>
              <strong>{items.length}</strong> {items.length === 1 ? 'item' : 'itens'}
              {hasFiltros ? ' (filtrado)' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((it) => {
              const tInfo = tipoInfo(it.tipo);
              const TIcon = tInfo.icon;
              const sInfo = statusInfo(it.status);
              return (
                <div
                  key={it.id}
                  className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-cyan-300 transition-all flex flex-col"
                >
                  {/* Faixa lateral colorida */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${tInfo.bg.replace('bg-', 'bg-').replace('-50', '-500')}`} />

                  {/* Header do card */}
                  <div className={`${tInfo.bg} px-4 py-3 flex items-center justify-between border-b border-black/5`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                        <TIcon size={18} weight="duotone" className={tInfo.color} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[9px] uppercase tracking-wider font-bold ${tInfo.color} opacity-80`}>
                          {tInfo.label}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-gray-800 truncate">
                          {it.codigo_patrimonio}
                        </p>
                      </div>
                    </div>
                    {/* Status badge */}
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ring-1 ${sInfo.color}`}>
                      <span className={`w-1 h-1 rounded-full ${sInfo.dot}`} />
                      {sInfo.label}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3 flex-1 flex flex-col gap-2">
                    {/* Descrição/Marca/Modelo */}
                    {(it.descricao || it.marca || it.modelo) && (
                      <div>
                        {it.descricao && (
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight" title={it.descricao}>
                            {it.descricao}
                          </p>
                        )}
                        {(it.marca || it.modelo) && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {[it.marca, it.modelo].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Linhas de info */}
                    <div className="space-y-1 text-[11px]">
                      {it.local && (
                        <div className="flex items-start gap-1.5 text-gray-600">
                          <MapPin size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1" title={it.local}>{it.local}</span>
                        </div>
                      )}
                      {it.setor && (
                        <div className="flex items-start gap-1.5 text-gray-600">
                          <Buildings size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <span>{it.setor}</span>
                        </div>
                      )}
                      {it.responsavel && (
                        <div className="flex items-start gap-1.5 text-gray-600">
                          <User size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1" title={it.responsavel}>{it.responsavel}</span>
                        </div>
                      )}
                      {it.numero_serie && (
                        <div className="flex items-start gap-1.5 text-gray-500">
                          <Hash size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="font-mono text-[10px] line-clamp-1" title={`SN: ${it.numero_serie}`}>{it.numero_serie}</span>
                        </div>
                      )}
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Footer com valor + ações */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Valor</p>
                        <p className={`text-sm font-bold tabular-nums ${it.valor_aquisicao > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                          {fmtBRL(it.valor_aquisicao)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditing(it);
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <PencilSimple size={13} weight="bold" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(it)}
                          className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash size={13} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ─── VIEW TABELA ───────────────────────────────────────────────
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr className="text-left">
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Cód.</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Tipo</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Descrição</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Marca / Modelo</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Local</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Setor</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Responsável</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold text-right">Valor</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Status</th>
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const tInfo = tipoInfo(it.tipo);
                  const TIcon = tInfo.icon;
                  const sInfo = statusInfo(it.status);
                  return (
                    <tr
                      key={it.id}
                      className={`border-b border-gray-100 hover:bg-cyan-50/30 transition-colors group ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-700">{it.codigo_patrimonio}</td>
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${tInfo.bg}`}>
                            <TIcon size={12} weight="duotone" className={tInfo.color} />
                          </div>
                          <span className="text-gray-700 font-medium">{tInfo.label}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 max-w-[220px] truncate" title={it.descricao}>
                        {it.descricao || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {it.marca || it.modelo ? (
                          <span>
                            {it.marca || ''}
                            {it.modelo ? <span className="text-gray-400"> · {it.modelo}</span> : ''}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {it.local ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} className="text-gray-400" />
                            {it.local}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">{it.setor || <span className="text-gray-300">—</span>}</td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {it.responsavel ? (
                          <span className="inline-flex items-center gap-1">
                            <User size={11} className="text-gray-400" />
                            {it.responsavel}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-700">
                        {it.valor_aquisicao > 0 ? fmtBRL(it.valor_aquisicao) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ${sInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sInfo.dot}`} />
                          {sInfo.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditing(it);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <PencilSimple size={12} weight="bold" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(it)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash size={12} weight="bold" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-500 bg-gray-50/50 flex items-center gap-1.5">
            <Hash size={11} weight="bold" />
            <strong>{items.length}</strong> {items.length === 1 ? 'item' : 'itens'}
            {hasFiltros ? ' (filtrado)' : ''}
          </div>
        </div>
      )}

      {/* Modal cadastro/edição */}
      {modalOpen && (
        <PatrimonioModal
          item={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={() => carregar()}
        />
      )}

      {/* Confirmação de delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#000638] mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-600 mb-4">
              Tem certeza que deseja excluir o item{' '}
              <strong className="font-mono">{confirmDelete.codigo_patrimonio}</strong>?
              {confirmDelete.descricao && ` (${confirmDelete.descricao})`}
            </p>
            <p className="text-xs text-rose-600 mb-4">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
