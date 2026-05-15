// Página: Tecnologia → Controle de Chips
// Gerencia chips/linhas telefônicas da empresa (CRUD + filtros + estatísticas)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DeviceMobile,
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
  Phone,
  SimCard,
  Plugs,
  WhatsappLogo,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';

const OPERADORAS = [
  { value: 'claro', label: 'Claro' },
  { value: 'vivo', label: 'Vivo' },
  { value: 'tim', label: 'TIM' },
  { value: 'oi', label: 'Oi' },
  { value: 'pague_menos', label: 'Pague Menos' },
  { value: 'outras', label: 'Outras' },
];

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'inativo', label: 'Inativo', color: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200', dot: 'bg-gray-400' },
  { value: 'bloqueado', label: 'Bloqueado', color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-500' },
];

// Cor por operadora (badge na linha da tabela)
const OPERADORA_COLOR = {
  claro: 'bg-red-100 text-red-700 ring-red-200',
  vivo: 'bg-purple-100 text-purple-700 ring-purple-200',
  tim: 'bg-blue-100 text-blue-700 ring-blue-200',
  oi: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  pague_menos: 'bg-orange-100 text-orange-700 ring-orange-200',
  outras: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const SETORES_PADRAO = [
  'TI', 'RH', 'Vendas', 'Financeiro', 'Marketing', 'Operações',
  'Diretoria', 'Loja', 'Frota', 'Outros',
];

const MOTIVOS_CANCELAMENTO = [
  'Demissão do responsável',
  'Troca de operadora',
  'Linha não utilizada',
  'Redução de custos',
  'Perda/Roubo do aparelho',
  'Fim do contrato',
  'Solicitação do setor',
  'Outros',
];

const fmtBRL = (v) =>
  v == null || v === ''
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function maskPhone(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function statusInfo(s) {
  return STATUS_OPTIONS.find((o) => o.value === s) || STATUS_OPTIONS[0];
}

function operadoraLabel(v) {
  return OPERADORAS.find((o) => o.value === v)?.label || v || '';
}

// ──────────────────────────────────────────────
// Modal de cadastro/edição
// ──────────────────────────────────────────────
function ChipModal({ chip, onClose, onSaved }) {
  const isNew = !chip;
  const { user } = useAuth() || {};
  const userLogin = user?.email || user?.user_metadata?.login || '';

  const [form, setForm] = useState({
    numero: chip?.numero || '',
    responsavel: chip?.responsavel || '',
    setor: chip?.setor || '',
    local_uso: chip?.local_uso || '',
    operadora: chip?.operadora || '',
    plano: chip?.plano || '',
    valor_plano: chip?.valor_plano || '',
    iccid: chip?.iccid || '',
    status: chip?.status || 'ativo',
    data_aquisicao: chip?.data_aquisicao || '',
    data_cancelamento: chip?.data_cancelamento || '',
    motivo_cancelamento: chip?.motivo_cancelamento || '',
    observacao: chip?.observacao || '',
    tem_api: !!chip?.tem_api,
    tem_whatsapp: !!chip?.tem_whatsapp,
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!form.numero) { setErro('Número obrigatório'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      // Remove campos vazios pra null
      ['data_aquisicao', 'data_cancelamento'].forEach((k) => {
        if (!payload[k]) payload[k] = null;
      });
      // valor_plano: converte pra number ou null
      payload.valor_plano = payload.valor_plano !== '' && payload.valor_plano != null
        ? Number(String(payload.valor_plano).replace(',', '.')) : null;
      const url = isNew
        ? `${API_BASE_URL}/api/tech/chips`
        : `${API_BASE_URL}/api/tech/chips/${chip.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-login': userLogin },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      onSaved();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Classes de input/select padrão (visual unificado)
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 outline-none transition font-barlow';
  const labelCls = 'block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-barlow';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-hidden font-barlow flex flex-col">
        {/* Header gradiente */}
        <div className="bg-gradient-to-r from-[#000638] to-[#0a1450] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <SimCard size={18} weight="fill" className="text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{isNew ? 'Novo chip' : 'Editar chip'}</h3>
              <p className="text-[11px] text-white/70">{isNew ? 'Cadastre um novo número/linha' : `ID #${chip.id}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-5 space-y-5">
          {/* Seção: Identificação */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Phone size={14} weight="bold" className="text-cyan-600" />
              <h4 className="text-xs font-bold text-[#000638] uppercase tracking-wider">Identificação</h4>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Número *</label>
                <input
                  type="tel"
                  value={form.numero}
                  onChange={(e) => set('numero', maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`${inputCls} font-mono`}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className={inputCls}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seção: Plano */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SimCard size={14} weight="bold" className="text-emerald-600" />
              <h4 className="text-xs font-bold text-[#000638] uppercase tracking-wider">Plano & Operadora</h4>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Operadora</label>
                <select
                  value={form.operadora}
                  onChange={(e) => set('operadora', e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Selecione —</option>
                  {OPERADORAS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Plano</label>
                <input
                  type="text"
                  value={form.plano}
                  onChange={(e) => set('plano', e.target.value)}
                  placeholder="Ex: Pós-pago 20GB"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Valor (R$/mês)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_plano}
                  onChange={(e) => set('valor_plano', e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} tabular-nums`}
                />
              </div>
            </div>
          </div>

          {/* Seção: Atribuição */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User size={14} weight="bold" className="text-blue-600" />
              <h4 className="text-xs font-bold text-[#000638] uppercase tracking-wider">Atribuição</h4>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Responsável</label>
                <input
                  type="text"
                  value={form.responsavel}
                  onChange={(e) => set('responsavel', e.target.value)}
                  placeholder="Nome da pessoa"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Setor responsável</label>
                <input
                  type="text"
                  value={form.setor}
                  onChange={(e) => set('setor', e.target.value)}
                  placeholder="TI, RH, Vendas..."
                  list="setores-padrao"
                  className={inputCls}
                />
                <datalist id="setores-padrao">
                  {SETORES_PADRAO.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className={labelCls}>Local de uso</label>
              <input
                type="text"
                value={form.local_uso}
                onChange={(e) => set('local_uso', e.target.value)}
                placeholder="Loja Midway, Carro 003, Escritório RN..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Seção: Integrações */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Plugs size={14} weight="bold" className="text-indigo-600" />
              <h4 className="text-xs font-bold text-[#000638] uppercase tracking-wider">Integrações</h4>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-2.5 px-4 py-3 border-2 rounded-xl text-sm cursor-pointer transition ${form.tem_api ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                <input
                  type="checkbox"
                  checked={form.tem_api}
                  onChange={(e) => set('tem_api', e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <Plugs size={18} weight={form.tem_api ? 'fill' : 'bold'} />
                <div className="flex-1">
                  <div className="font-bold text-xs uppercase tracking-wider">Possui API</div>
                  <div className="text-[10px] opacity-70 font-normal">Integração programática</div>
                </div>
              </label>
              <label className={`flex items-center gap-2.5 px-4 py-3 border-2 rounded-xl text-sm cursor-pointer transition ${form.tem_whatsapp ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                <input
                  type="checkbox"
                  checked={form.tem_whatsapp}
                  onChange={(e) => set('tem_whatsapp', e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <WhatsappLogo size={18} weight="fill" />
                <div className="flex-1">
                  <div className="font-bold text-xs uppercase tracking-wider">Possui WhatsApp</div>
                  <div className="text-[10px] opacity-70 font-normal">Conta WhatsApp ativa</div>
                </div>
              </label>
            </div>
          </div>

          {/* Seção: Detalhes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Buildings size={14} weight="bold" className="text-gray-500" />
              <h4 className="text-xs font-bold text-[#000638] uppercase tracking-wider">Detalhes adicionais</h4>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>ICCID (chip físico)</label>
                <input
                  type="text"
                  value={form.iccid}
                  onChange={(e) => set('iccid', e.target.value)}
                  placeholder="89550..."
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data de aquisição</label>
                  <input
                    type="date"
                    value={form.data_aquisicao || ''}
                    onChange={(e) => set('data_aquisicao', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Data de cancelamento</label>
                  <input
                    type="date"
                    value={form.data_cancelamento || ''}
                    onChange={(e) => set('data_cancelamento', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Motivo do cancelamento — em destaque quando status é cancelado/bloqueado */}
              <div className={`${(form.status === 'cancelado' || form.status === 'bloqueado') ? 'p-3 -mx-1 rounded-lg bg-rose-50/50 border border-rose-200' : ''}`}>
                <label className={`${labelCls} ${(form.status === 'cancelado' || form.status === 'bloqueado') ? 'text-rose-700' : ''} flex items-center gap-1.5`}>
                  Motivo do cancelamento
                  {(form.status === 'cancelado' || form.status === 'bloqueado') && (
                    <span className="text-rose-500 font-bold normal-case tracking-normal">• recomendado</span>
                  )}
                </label>
                <input
                  type="text"
                  value={form.motivo_cancelamento}
                  onChange={(e) => set('motivo_cancelamento', e.target.value)}
                  placeholder="Selecione ou descreva..."
                  list="motivos-cancelamento"
                  className={inputCls}
                />
                <datalist id="motivos-cancelamento">
                  {MOTIVOS_CANCELAMENTO.map((m) => <option key={m} value={m} />)}
                </datalist>
                <div className="flex flex-wrap gap-1 mt-2">
                  {MOTIVOS_CANCELAMENTO.slice(0, 5).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => set('motivo_cancelamento', m)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
                        form.motivo_cancelamento === m
                          ? 'bg-[#000638] text-white border-[#000638]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Observação</label>
                <textarea
                  value={form.observacao}
                  onChange={(e) => set('observacao', e.target.value)}
                  rows={2}
                  placeholder="Notas sobre o chip..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <X size={14} weight="bold" /> {erro}
            </div>
          )}
        </form>

        {/* Footer fixo */}
        <div className="border-t border-gray-200 px-5 py-3 flex gap-2 flex-shrink-0 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition font-barlow"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-[#000638] to-[#0a1450] hover:from-[#0a1450] hover:to-[#1a2570] text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-md transition font-barlow"
          >
            {saving ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />}
            {saving ? 'Salvando...' : 'Salvar chip'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────
export default function ControleChips() {
  const { user } = useAuth() || {};
  const userLogin = user?.email || user?.user_metadata?.login || '';

  const [chips, setChips] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroOperadora, setFiltroOperadora] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtroStatus) qs.set('status', filtroStatus);
      if (filtroOperadora) qs.set('operadora', filtroOperadora);
      if (filtroSetor) qs.set('setor', filtroSetor);
      if (busca) qs.set('q', busca);
      const [chipsResp, statsResp] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tech/chips?${qs.toString()}`).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/tech/chips-stats`).then((r) => r.json()),
      ]);
      if (!chipsResp?.success) throw new Error(chipsResp?.message || 'Erro');
      setChips(chipsResp.data?.chips || []);
      setStats(statsResp?.data || null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [busca, filtroStatus, filtroOperadora, filtroSetor]);

  useEffect(() => { carregar(); }, [carregar]);

  const remover = async (chip) => {
    if (!confirm(`Remover o chip ${chip.numero}?`)) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/tech/chips/${chip.id}`, {
        method: 'DELETE',
        headers: { 'x-user-login': userLogin },
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      await carregar();
    } catch (e) {
      alert(e.message);
    }
  };

  // Toggle rápido entre Ativo ↔ Inativo (clique no badge da tabela)
  const toggleStatus = async (chip) => {
    const novoStatus = chip.status === 'ativo' ? 'inativo' : 'ativo';
    // Atualização otimista — atualiza UI antes da resposta
    setChips((arr) => arr.map((c) => (c.id === chip.id ? { ...c, status: novoStatus } : c)));
    try {
      const r = await fetch(`${API_BASE_URL}/api/tech/chips/${chip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-login': userLogin },
        body: JSON.stringify({ status: novoStatus }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      await carregar();
    } catch (e) {
      alert(e.message);
      await carregar(); // rollback
    }
  };

  const setoresDisponiveis = useMemo(
    () => Array.from(new Set(chips.map((c) => c.setor).filter(Boolean))).sort(),
    [chips],
  );

  // Filtros ativos (para mostrar como chips removíveis)
  const filtrosAtivos = [
    filtroStatus && { key: 'status', label: statusInfo(filtroStatus).label, clear: () => setFiltroStatus('') },
    filtroOperadora && { key: 'op', label: OPERADORAS.find((o) => o.value === filtroOperadora)?.label, clear: () => setFiltroOperadora('') },
    filtroSetor && { key: 'set', label: filtroSetor, clear: () => setFiltroSetor('') },
    busca && { key: 'q', label: `"${busca}"`, clear: () => setBusca('') },
  ].filter(Boolean);

  // Configuração visual dos cards de KPI
  const kpiCards = stats ? [
    { label: 'Total', value: stats.total, icon: SimCard, color: 'cyan', desc: `${stats.por_status?.ativo || 0} ativos` },
    { label: 'Ativos', value: stats.por_status?.ativo || 0, icon: CheckCircle, color: 'emerald', desc: `${stats.por_status?.inativo || 0} inativos` },
    { label: 'Custo mensal', value: fmtBRL(stats.custo_mensal_ativos), icon: SimCard, color: 'green', desc: `Total: ${fmtBRL(stats.custo_mensal_total)}`, isMoney: true },
    { label: 'Com API', value: stats.com_api || 0, icon: Plugs, color: 'indigo', desc: `${stats.total ? Math.round(((stats.com_api || 0) / stats.total) * 100) : 0}% do total` },
    { label: 'Com WhatsApp', value: stats.com_whatsapp || 0, icon: WhatsappLogo, color: 'teal', desc: `${stats.total ? Math.round(((stats.com_whatsapp || 0) / stats.total) * 100) : 0}% do total` },
    { label: 'Setores', value: Object.keys(stats.por_setor || {}).filter((k) => k !== 'sem_setor').length, icon: Buildings, color: 'blue', desc: `${Object.keys(stats.por_operadora || {}).filter((k) => k !== 'sem_operadora').length} operadoras` },
  ] : [];

  // Mapeia color name → classes tailwind (Tailwind v3 não suporta interpolação dinâmica)
  const colorMap = {
    cyan: { text: 'text-cyan-700', accent: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', iconBg: 'bg-cyan-100' },
    emerald: { text: 'text-emerald-700', accent: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
    green: { text: 'text-green-700', accent: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', iconBg: 'bg-green-100' },
    indigo: { text: 'text-indigo-700', accent: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-100' },
    teal: { text: 'text-teal-700', accent: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', iconBg: 'bg-teal-100' },
    blue: { text: 'text-blue-700', accent: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100' },
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 sm:px-4 font-barlow">
      {/* Título centralizado (padrão das outras páginas) */}
      <PageTitle
        title="Controle de Chips"
        subtitle="Gerenciamento dos chips telefônicos da empresa"
        icon={DeviceMobile}
        iconColor="text-cyan-600"
      />

      {/* Cards de resumo — 6 KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
          {kpiCards.map((k) => {
            const Icon = k.icon;
            const cl = colorMap[k.color];
            return (
              <div
                key={k.label}
                className={`relative overflow-hidden rounded-xl bg-white shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 border ${cl.border} border-opacity-40`}
              >
                {/* Barra colorida superior */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${cl.accent.replace('text-', 'bg-')}`} />
                <div className="p-3 pt-3.5">
                  <div className="flex items-start justify-between mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${cl.text} font-barlow`}>{k.label}</span>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${cl.iconBg}`}>
                      <Icon size={14} weight="bold" className={cl.accent} />
                    </span>
                  </div>
                  <div className={`${k.isMoney ? 'text-base' : 'text-2xl'} font-extrabold ${cl.accent} leading-tight font-barlow tabular-nums break-words`}>
                    {k.value}
                  </div>
                  {k.desc && (
                    <div className="text-[10px] text-gray-500 mt-1 font-barlow truncate" title={k.desc}>{k.desc}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar de busca + filtros */}
      <div className="bg-white rounded-xl shadow-md w-full border border-[#000638]/10 mb-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-2 p-3">
          {/* Busca */}
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, responsável, setor ou local..."
              className="border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 bg-gray-50 text-[#000638] text-sm font-barlow transition"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {/* Selects */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2 sm:flex-shrink-0">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 bg-gray-50 text-[#000638] text-xs font-semibold font-barlow"
            >
              <option value="">Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={filtroOperadora}
              onChange={(e) => setFiltroOperadora(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 bg-gray-50 text-[#000638] text-xs font-semibold font-barlow"
            >
              <option value="">Operadora</option>
              {OPERADORAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 bg-gray-50 text-[#000638] text-xs font-semibold font-barlow"
            >
              <option value="">Setor</option>
              {setoresDisponiveis.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Botão "Novo chip" — ação primária */}
          <button
            onClick={() => { setEditando(null); setShowModal(true); }}
            className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#000638] to-[#0a1450] hover:from-[#0a1450] hover:to-[#1a2570] text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all uppercase tracking-wide font-barlow whitespace-nowrap"
          >
            <Plus size={14} weight="bold" /> Novo chip
          </button>
        </div>

        {/* Chips de filtros ativos */}
        {filtrosAtivos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-3 pb-3 border-t border-gray-100 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 font-barlow">
              <Funnel size={11} weight="bold" /> Filtros ativos:
            </span>
            {filtrosAtivos.map((f) => (
              <button
                key={f.key}
                onClick={f.clear}
                className="inline-flex items-center gap-1 bg-[#000638]/10 hover:bg-[#000638]/20 text-[#000638] text-xs font-semibold px-2 py-0.5 rounded-full transition font-barlow"
              >
                {f.label}
                <X size={10} weight="bold" />
              </button>
            ))}
            <button
              onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroOperadora(''); setFiltroSetor(''); }}
              className="ml-auto text-[10px] font-semibold text-gray-500 hover:text-rose-600 uppercase tracking-wide font-barlow"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3 font-barlow">{erro}</div>}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 w-full overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-[#000638] to-[#0a1450] flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/10">
            <SimCard size={14} weight="bold" className="text-cyan-300" />
          </div>
          <h2 className="text-sm font-bold text-white font-barlow">Chips cadastrados</h2>
          <span className="ml-auto inline-flex items-center gap-1.5 bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full font-barlow">
            {chips.length} chip{chips.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading && chips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Spinner size={36} className="animate-spin mb-3 text-[#000638]/40" />
            <p className="text-sm font-semibold font-barlow">Carregando chips...</p>
          </div>
        ) : chips.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-3">
              <DeviceMobile size={32} weight="light" className="text-gray-400" />
            </div>
            <p className="text-base font-bold text-gray-600 font-barlow">Nenhum chip encontrado</p>
            <p className="text-xs mt-1 text-gray-400 font-barlow">
              {filtrosAtivos.length > 0 ? 'Tente ajustar os filtros' : 'Clique em "Novo chip" pra cadastrar o primeiro'}
            </p>
          </div>
        ) : (
          <>
            {/* Header desktop */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-barlow">
              <div className="col-span-3">Chip / Responsável</div>
              <div className="col-span-2">Setor / Local</div>
              <div className="col-span-1">Operadora</div>
              <div className="col-span-2 text-right">Valor mensal</div>
              <div className="col-span-1 text-center">Integrações</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            <div className="divide-y divide-gray-100">
              {chips.map((c) => {
                const st = statusInfo(c.status);
                const opColor = OPERADORA_COLOR[c.operadora] || OPERADORA_COLOR.outras;
                return (
                  <div
                    key={c.id}
                    className="group hover:bg-[#000638]/[0.025] transition-colors"
                  >
                    {/* Mobile card */}
                    <div className="md:hidden p-3 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-sm">
                          <Phone size={16} weight="fill" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#000638] text-sm font-mono">{c.numero}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {c.responsavel || <span className="italic text-gray-400">Sem responsável</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleStatus(c)}
                          title={c.motivo_cancelamento ? `Motivo: ${c.motivo_cancelamento}` : `Marcar como ${c.status === 'ativo' ? 'Inativo' : 'Ativo'}`}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${st.color} hover:opacity-80 transition cursor-pointer flex-shrink-0`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 pl-12">
                        {c.setor && <div className="flex items-center gap-1"><Buildings size={10} className="text-gray-400" />{c.setor}</div>}
                        {c.local_uso && <div className="flex items-center gap-1 truncate" title={c.local_uso}>📍 {c.local_uso}</div>}
                      </div>
                      {c.motivo_cancelamento && c.status !== 'ativo' && (
                        <div className="pl-12 text-[11px] text-rose-600 italic">
                          ⚠ {c.motivo_cancelamento}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap pl-12">
                        {c.operadora && (
                          <span className={`uppercase text-[9px] font-bold px-2 py-0.5 rounded-full ring-1 ${opColor}`}>
                            {operadoraLabel(c.operadora)}
                          </span>
                        )}
                        {c.valor_plano != null && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                            {fmtBRL(c.valor_plano)}/mês
                          </span>
                        )}
                        {c.tem_api && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200">
                            <Plugs size={9} weight="bold" /> API
                          </span>
                        )}
                        {c.tem_whatsapp && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                            <WhatsappLogo size={9} weight="fill" /> WhatsApp
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button onClick={() => { setEditando(c); setShowModal(true); }} className="flex-1 px-3 py-1.5 bg-[#000638]/5 hover:bg-[#000638]/10 text-[#000638] text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 transition">
                          <PencilSimple size={12} weight="bold" /> Editar
                        </button>
                        <button onClick={() => remover(c)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs rounded-lg inline-flex items-center justify-center transition">
                          <Trash size={12} weight="bold" />
                        </button>
                      </div>
                    </div>

                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 items-center">
                      {/* Chip + Responsável */}
                      <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                          <Phone size={14} weight="fill" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-[#000638] text-xs leading-tight">{c.numero}</div>
                          <div className="text-[11px] text-gray-500 truncate" title={c.responsavel}>
                            {c.responsavel || <span className="italic text-gray-400">—</span>}
                          </div>
                        </div>
                      </div>
                      {/* Setor / Local */}
                      <div className="col-span-2 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 truncate" title={c.setor}>
                          {c.setor || <span className="font-normal text-gray-400">—</span>}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate" title={c.local_uso}>
                          {c.local_uso || <span className="text-gray-400">—</span>}
                        </div>
                      </div>
                      {/* Operadora */}
                      <div className="col-span-1">
                        {c.operadora ? (
                          <span className={`inline-block uppercase text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${opColor}`}>
                            {operadoraLabel(c.operadora)}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </div>
                      {/* Valor */}
                      <div className="col-span-2 text-right">
                        {c.valor_plano != null && Number(c.valor_plano) > 0 ? (
                          <span className="inline-block text-xs font-bold text-emerald-700 tabular-nums">
                            {fmtBRL(c.valor_plano)}
                          </span>
                        ) : c.valor_plano === 0 ? (
                          <span className="text-[10px] font-semibold text-gray-400 italic">Grátis</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                      {/* Integrações */}
                      <div className="col-span-1 flex items-center justify-center gap-1">
                        {c.tem_api && (
                          <span title="Possui API" className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200">
                            <Plugs size={12} weight="bold" />
                          </span>
                        )}
                        {c.tem_whatsapp && (
                          <span title="Possui WhatsApp" className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                            <WhatsappLogo size={12} weight="fill" />
                          </span>
                        )}
                        {!c.tem_api && !c.tem_whatsapp && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                      {/* Status */}
                      <div className="col-span-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleStatus(c)}
                          title={c.motivo_cancelamento ? `Motivo: ${c.motivo_cancelamento}` : `Clique para marcar como ${c.status === 'ativo' ? 'Inativo' : 'Ativo'}`}
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${st.color} hover:opacity-80 transition cursor-pointer`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </button>
                        {c.motivo_cancelamento && c.status !== 'ativo' && (
                          <div className="text-[10px] text-rose-600 italic truncate mt-1" title={c.motivo_cancelamento}>
                            {c.motivo_cancelamento}
                          </div>
                        )}
                      </div>
                      {/* Ações */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditando(c); setShowModal(true); }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#000638] bg-[#000638]/0 hover:bg-[#000638]/10 px-2.5 py-1.5 rounded-lg transition opacity-70 group-hover:opacity-100"
                          title="Editar"
                        >
                          <PencilSimple size={13} weight="bold" /> Editar
                        </button>
                        <button
                          onClick={() => remover(c)}
                          className="inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 hover:text-rose-700 p-1.5 rounded-lg transition opacity-70 group-hover:opacity-100"
                          title="Remover"
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <ChipModal
          chip={editando}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onSaved={() => { setShowModal(false); setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}
