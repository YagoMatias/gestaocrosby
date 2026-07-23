// RH / Banco de Talentos → Vagas
// Cria/edita vagas e gera o link público exclusivo de cada uma (/vagas/<slug>).
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Plus,
  PencilSimple,
  Trash,
  Copy,
  Check,
  Users,
  Eye,
  X,
  MapPin,
  Spinner,
  LinkSimple,
  ToggleLeft,
  ToggleRight,
} from '@phosphor-icons/react';
import PageTitle from '../../components/ui/PageTitle';
import { API_BASE_URL } from '../../config/constants';

// Domínio público das vagas (link exclusivo compartilhado com o candidato).
// Sobrescreva com VITE_LP_VAGAS_BASE caso o domínio mude.
const LP_BASE = import.meta.env.VITE_LP_VAGAS_BASE || 'https://vagas.crosbyoficial.com.br';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TIPOS = ['CLT', 'Estágio', 'Aprendiz', 'PJ', 'Temporário', 'Freelance'];

const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 outline-none transition font-barlow';
const labelCls =
  'block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1 font-barlow';

// ──────────────────────────────────────────────
// Modal cadastro/edição de vaga
// ──────────────────────────────────────────────
function VagaModal({ vaga, onClose, onSaved }) {
  const isNew = !vaga;
  const [form, setForm] = useState({
    titulo: vaga?.titulo || '',
    cargo: vaga?.cargo || '',
    cidade: vaga?.cidade || '',
    estado: vaga?.estado || '',
    tipo_contratacao: vaga?.tipo_contratacao || '',
    descricao: vaga?.descricao || '',
    requisitos: vaga?.requisitos || '',
    beneficios: vaga?.beneficios || '',
    ativo: vaga ? !!vaga.ativo : true,
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!form.titulo.trim()) {
      setErro('O título da vaga é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const url = isNew
        ? `${API_BASE_URL}/api/vagas`
        : `${API_BASE_URL}/api/vagas/${vaga.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro ao salvar');
      onSaved();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-hidden font-barlow flex flex-col">
        <div className="bg-gradient-to-r from-[#000638] to-[#0a1450] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Briefcase size={18} weight="fill" className="text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isNew ? 'Nova vaga' : 'Editar vaga'}
              </h3>
              <p className="text-[11px] text-white/70">
                {isNew ? 'Cadastre uma vaga e gere o link público' : `ID #${vaga.id} · /${vaga.slug}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-5 space-y-4">
          <div>
            <label className={labelCls}>Título da vaga *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              placeholder="Ex: Vendedor(a) — Loja Natal Shopping"
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cargo</label>
              <input
                type="text"
                value={form.cargo}
                onChange={(e) => set('cargo', e.target.value)}
                placeholder="Ex: Vendedor(a)"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Tipo de contratação</label>
              <select
                value={form.tipo_contratacao}
                onChange={(e) => set('tipo_contratacao', e.target.value)}
                className={inputCls}
              >
                <option value="">— Selecione —</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <label className={labelCls}>Cidade</label>
              <input
                type="text"
                value={form.cidade}
                onChange={(e) => set('cidade', e.target.value)}
                placeholder="Ex: Natal"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Estado (UF)</label>
              <select
                value={form.estado}
                onChange={(e) => set('estado', e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Descrição da vaga</label>
            <textarea
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              rows={3}
              placeholder="O que a pessoa vai fazer no dia a dia…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Requisitos</label>
            <textarea
              value={form.requisitos}
              onChange={(e) => set('requisitos', e.target.value)}
              rows={2}
              placeholder="Experiência, escolaridade, habilidades…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Benefícios</label>
            <textarea
              value={form.beneficios}
              onChange={(e) => set('beneficios', e.target.value)}
              rows={2}
              placeholder="Vale-transporte, comissão, plano de saúde…"
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => set('ativo', e.target.checked)}
              className="w-4 h-4 accent-[#000638]"
            />
            <span className="text-sm text-gray-700">
              Vaga ativa (link público aceita novas inscrições)
            </span>
          </label>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-[#000638] hover:bg-[#0a1450] rounded-lg transition disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Spinner size={16} className="animate-spin" />}
              {isNew ? 'Criar vaga' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Card de vaga
// ──────────────────────────────────────────────
function VagaCard({ vaga, onEdit, onDelete, onToggle, onVerInscricoes }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${LP_BASE}/vagas/${vaga.slug}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt('Copie o link da vaga:', link);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition p-5 flex flex-col font-barlow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#000638] truncate">{vaga.titulo}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {vaga.cargo && <span>{vaga.cargo}</span>}
            {(vaga.cidade || vaga.estado) && (
              <span className="flex items-center gap-1">
                <MapPin size={12} weight="fill" />
                {[vaga.cidade, vaga.estado].filter(Boolean).join(' / ')}
              </span>
            )}
            {vaga.tipo_contratacao && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{vaga.tipo_contratacao}</span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
            vaga.ativo
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {vaga.ativo ? 'ATIVA' : 'INATIVA'}
        </span>
      </div>

      {/* Link público */}
      <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
        <LinkSimple size={14} className="text-gray-400 shrink-0" />
        <span className="text-xs text-gray-600 truncate flex-1" title={link}>/vagas/{vaga.slug}</span>
        <button
          onClick={copiar}
          className={`shrink-0 text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-md transition ${
            copiado ? 'bg-emerald-100 text-emerald-700' : 'bg-[#000638] text-white hover:bg-[#0a1450]'
          }`}
        >
          {copiado ? <Check size={12} weight="bold" /> : <Copy size={12} weight="bold" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {/* Ações */}
      <div className="mt-4 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onVerInscricoes(vaga)}
          className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-[#000638] hover:bg-[#0a1450] rounded-lg py-2 transition"
        >
          <Users size={16} weight="fill" />
          Inscrições
          <span className="ml-0.5 bg-white/20 rounded-full px-1.5 text-xs">{vaga.total_inscricoes ?? 0}</span>
        </button>
        <a
          href={`${window.location.origin}/vagas/${vaga.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir LP (pré-visualizar neste ambiente)"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#000638] hover:border-[#000638]/40 transition"
        >
          <Eye size={16} />
        </a>
        <button onClick={() => onToggle(vaga)} title={vaga.ativo ? 'Desativar' : 'Ativar'} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#000638] hover:border-[#000638]/40 transition">
          {vaga.ativo ? <ToggleRight size={16} weight="fill" className="text-emerald-600" /> : <ToggleLeft size={16} />}
        </button>
        <button onClick={() => onEdit(vaga)} title="Editar" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#000638] hover:border-[#000638]/40 transition">
          <PencilSimple size={16} />
        </button>
        <button onClick={() => onDelete(vaga)} title="Excluir" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 transition">
          <Trash size={16} />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────
export default function Vagas() {
  const navigate = useNavigate();
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null); // null | {} (nova) | vaga (editar)

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/vagas`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro ao carregar');
      setVagas(j.data || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const excluir = async (vaga) => {
    if (!window.confirm(`Excluir a vaga "${vaga.titulo}"? As inscrições ficam salvas, mas o link deixa de funcionar.`)) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/vagas/${vaga.id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      carregar();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggle = async (vaga) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/vagas/${vaga.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !vaga.ativo }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      carregar();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <PageTitle
        title="Banco de Talentos — Vagas"
        subtitle="Crie vagas, gere o link exclusivo de cada uma e acompanhe as inscrições."
        icon={Briefcase}
      />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 text-sm font-bold text-white bg-[#000638] hover:bg-[#0a1450] rounded-lg px-4 py-2.5 transition shadow-sm"
        >
          <Plus size={18} weight="bold" />
          Nova vaga
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Spinner size={28} className="animate-spin" />
        </div>
      ) : vagas.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-barlow">
          <Briefcase size={44} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nenhuma vaga cadastrada ainda.</p>
          <p className="text-sm">Clique em “Nova vaga” para criar a primeira e gerar o link.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vagas.map((v) => (
            <VagaCard
              key={v.id}
              vaga={v}
              onEdit={(vaga) => setModal(vaga)}
              onDelete={excluir}
              onToggle={toggle}
              onVerInscricoes={(vaga) => navigate(`/rh/inscricoes?vaga=${vaga.id}`)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <VagaModal
          vaga={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
