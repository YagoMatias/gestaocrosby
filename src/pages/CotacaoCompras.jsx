// Página: Tecnologia → Cotação de Compras
// 1 item por cotação, N fornecedores, anexos via Supabase Storage.
// Status: rascunho → cotando → escolhido → comprado (e cancelado).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingCart, Plus, PencilSimple, Trash, MagnifyingGlass, Spinner,
  CheckCircle, X, Package, Buildings, Link as LinkIcon, MapPin,
  Paperclip, DownloadSimple, Crown, ArrowRight, Calendar, Truck, Receipt,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';

const BUCKET = 'tech-cotacoes-anexos';

const STATUS = [
  { value: 'rascunho',  label: 'Rascunho',  color: 'bg-gray-100 text-gray-700 ring-gray-200',   dot: 'bg-gray-400'   },
  { value: 'cotando',   label: 'Cotando',   color: 'bg-blue-100 text-blue-700 ring-blue-200',   dot: 'bg-blue-500'   },
  { value: 'escolhido', label: 'Escolhido', color: 'bg-amber-100 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  { value: 'comprado',  label: 'Comprado',  color: 'bg-emerald-100 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-rose-100 text-rose-700 ring-rose-200',   dot: 'bg-rose-500'   },
];

const URGENCIA = [
  { value: 'baixa',  label: 'Baixa',  color: 'bg-gray-100 text-gray-600'   },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700'   },
  { value: 'alta',   label: 'Alta',   color: 'bg-rose-100 text-rose-700'   },
];

const CATEGORIA = [
  { value: 'compras',     label: 'Compras',         color: 'bg-blue-100 text-blue-700 ring-blue-200',     emoji: '🛒' },
  { value: 'patrimonio',  label: 'Patrimônio',      color: 'bg-indigo-100 text-indigo-700 ring-indigo-200', emoji: '🏛️' },
  { value: 'uso_consumo', label: 'Uso e Consumo',   color: 'bg-teal-100 text-teal-700 ring-teal-200',     emoji: '📦' },
  { value: 'tecnologia',  label: 'Tecnologia',      color: 'bg-purple-100 text-purple-700 ring-purple-200', emoji: '💻' },
];

const fmtBRL = (v) =>
  v == null ? 'R$ —' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusInfo = (s) => STATUS.find((o) => o.value === s) || STATUS[0];
const urgenciaInfo = (s) => URGENCIA.find((o) => o.value === s) || URGENCIA[1];
const categoriaInfo = (s) => CATEGORIA.find((o) => o.value === s) || CATEGORIA[0];

const totalFornecedor = (f) =>
  (Number(f.valor_unitario) || 0) + (Number(f.frete) || 0) + (Number(f.taxas) || 0);

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#000638]/30 focus:border-[#000638]/60 outline-none transition';
const labelCls = 'block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1';
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#000638] text-white text-sm font-semibold hover:bg-[#000638]/90 transition disabled:opacity-50';
const btnGhost = 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition';

// ────────────────────────────────────────────────────────────────
// MODAL: criar/editar cotação
// ────────────────────────────────────────────────────────────────
function CotacaoModal({ cotacao, onClose, onSaved }) {
  const isNew = !cotacao;
  const { user } = useAuth() || {};
  const userLogin = user?.email || user?.user_metadata?.login || '';
  const [form, setForm] = useState({
    titulo: cotacao?.titulo || '',
    descricao: cotacao?.descricao || '',
    quantidade: cotacao?.quantidade ?? 1,
    unidade: cotacao?.unidade || 'un',
    categoria: cotacao?.categoria || 'compras',
    solicitante: cotacao?.solicitante || '',
    urgencia: cotacao?.urgencia || 'normal',
    data_necessidade: cotacao?.data_necessidade || '',
    observacao: cotacao?.observacao || '',
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!form.titulo.trim()) { setErro('Título obrigatório'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.data_necessidade) payload.data_necessidade = null;
      const url = isNew
        ? `${API_BASE_URL}/api/tech/cotacoes`
        : `${API_BASE_URL}/api/tech/cotacoes/${cotacao.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-login': userLogin },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro ao salvar');
      onSaved(j.data);
    } catch (e) { setErro(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[#000638] to-[#0a1450] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Package size={18} weight="fill" className="text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{isNew ? 'Nova cotação' : 'Editar cotação'}</h3>
              <p className="text-[11px] text-white/70">{isNew ? 'Dados do material' : `ID #${cotacao.id}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-5 space-y-4">
          <div>
            <label className={labelCls}>Título / material *</label>
            <input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Notebook Dell Latitude i7" className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Descrição detalhada</label>
            <textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} rows={3} placeholder="Especificações técnicas, modelo, cor, etc." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Categoria</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIA.map((c) => (
                <button type="button" key={c.value} onClick={() => set('categoria', c.value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-1.5 ${form.categoria === c.value ? 'bg-[#000638] text-white border-[#000638]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quantidade</label>
              <input type="number" min="1" step="0.01" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unidade</label>
              <input value={form.unidade} onChange={(e) => set('unidade', e.target.value)} placeholder="un, m, kg…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Urgência</label>
              <select value={form.urgencia} onChange={(e) => set('urgencia', e.target.value)} className={inputCls}>
                {URGENCIA.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Solicitante</label>
              <input value={form.solicitante} onChange={(e) => set('solicitante', e.target.value)} placeholder="Quem pediu" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Necessário até</label>
              <input type="date" value={form.data_necessidade || ''} onChange={(e) => set('data_necessidade', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Observação</label>
            <textarea value={form.observacao} onChange={(e) => set('observacao', e.target.value)} rows={2} className={inputCls} />
          </div>

          {erro && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm">{erro}</div>}

          <div className="flex gap-2 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="fill" />}
              {saving ? 'Salvando…' : (isNew ? 'Criar' : 'Salvar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// MODAL: criar/editar fornecedor (com upload anexo)
// ────────────────────────────────────────────────────────────────
function FornecedorModal({ cotacaoId, fornecedor, onClose, onSaved }) {
  const isNew = !fornecedor;
  const [form, setForm] = useState({
    fornecedor_nome: fornecedor?.fornecedor_nome || '',
    fornecedor_contato: fornecedor?.fornecedor_contato || '',
    tipo_compra: fornecedor?.tipo_compra || 'online',
    link: fornecedor?.link || '',
    endereco: fornecedor?.endereco || '',
    valor_unitario: fornecedor?.valor_unitario ?? '',
    frete: fornecedor?.frete ?? '',
    taxas: fornecedor?.taxas ?? '',
    prazo_entrega: fornecedor?.prazo_entrega || '',
    condicao_pagamento: fornecedor?.condicao_pagamento || '',
    garantia: fornecedor?.garantia || '',
    anexo_path: fornecedor?.anexo_path || '',
    anexo_nome: fornecedor?.anexo_nome || '',
    observacao: fornecedor?.observacao || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true); setErro('');
    try {
      const ext = file.name.split('.').pop();
      const path = `cot${cotacaoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      // Remove anexo antigo do storage se existia
      if (form.anexo_path) {
        await supabase.storage.from(BUCKET).remove([form.anexo_path]);
      }
      setForm((s) => ({ ...s, anexo_path: path, anexo_nome: file.name }));
    } catch (e) { setErro('Falha no upload: ' + e.message); }
    finally { setUploading(false); }
  };

  const removeAnexo = async () => {
    if (!form.anexo_path) return;
    await supabase.storage.from(BUCKET).remove([form.anexo_path]);
    setForm((s) => ({ ...s, anexo_path: '', anexo_nome: '' }));
  };

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!form.fornecedor_nome.trim()) { setErro('Nome do fornecedor obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        valor_unitario: Number(String(form.valor_unitario).replace(',', '.')) || 0,
        frete: Number(String(form.frete).replace(',', '.')) || 0,
        taxas: Number(String(form.taxas).replace(',', '.')) || 0,
      };
      const url = isNew
        ? `${API_BASE_URL}/api/tech/cotacoes/${cotacaoId}/fornecedores`
        : `${API_BASE_URL}/api/tech/cotacoes/fornecedores/${fornecedor.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      onSaved();
    } catch (e) { setErro(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[#000638] to-[#0a1450] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Buildings size={18} weight="fill" className="text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{isNew ? 'Novo fornecedor' : 'Editar fornecedor'}</h3>
              <p className="text-[11px] text-white/70">Orçamento, frete, anexo e contato</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fornecedor *</label>
              <input value={form.fornecedor_nome} onChange={(e) => set('fornecedor_nome', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Contato (tel/email)</label>
              <input value={form.fornecedor_contato} onChange={(e) => set('fornecedor_contato', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tipo de compra</label>
            <div className="flex gap-2">
              {[{ v: 'online', l: 'Online', icon: LinkIcon }, { v: 'presencial', l: 'Presencial', icon: MapPin }].map(({ v, l, icon: Icon }) => (
                <button type="button" key={v} onClick={() => set('tipo_compra', v)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${form.tipo_compra === v ? 'bg-[#000638] text-white border-[#000638]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  <Icon size={14} weight="bold" /> {l}
                </button>
              ))}
            </div>
          </div>

          {form.tipo_compra === 'online' ? (
            <div>
              <label className={labelCls}>Link</label>
              <input type="url" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://…" className={inputCls} />
            </div>
          ) : (
            <div>
              <label className={labelCls}>Endereço</label>
              <input value={form.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, nº, bairro…" className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Valor unitário *</label>
              <input type="number" step="0.01" min="0" value={form.valor_unitario} onChange={(e) => set('valor_unitario', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Frete</label>
              <input type="number" step="0.01" min="0" value={form.frete} onChange={(e) => set('frete', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Taxas</label>
              <input type="number" step="0.01" min="0" value={form.taxas} onChange={(e) => set('taxas', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Prazo entrega</label>
              <input value={form.prazo_entrega} onChange={(e) => set('prazo_entrega', e.target.value)} placeholder="5 dias úteis" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pagamento</label>
              <input value={form.condicao_pagamento} onChange={(e) => set('condicao_pagamento', e.target.value)} placeholder="À vista, 30/60/90…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Garantia</label>
              <input value={form.garantia} onChange={(e) => set('garantia', e.target.value)} placeholder="12 meses" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Anexo (PDF/imagem)</label>
            {form.anexo_path ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Paperclip size={14} className="text-emerald-700" />
                <span className="text-sm text-emerald-700 flex-1 truncate">{form.anexo_nome}</span>
                <button type="button" onClick={removeAnexo} className="text-rose-600 hover:bg-rose-100 rounded p-1">
                  <Trash size={14} />
                </button>
              </div>
            ) : (
              <label className={`${inputCls} cursor-pointer flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-100`}>
                {uploading ? <><Spinner size={14} className="animate-spin" /> Enviando…</> : <><Paperclip size={14} /> Anexar arquivo</>}
                <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
              </label>
            )}
          </div>

          <div>
            <label className={labelCls}>Observação</label>
            <textarea value={form.observacao} onChange={(e) => set('observacao', e.target.value)} rows={2} className={inputCls} />
          </div>

          {erro && <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm">{erro}</div>}

          <div className="flex gap-2 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
            <button type="submit" disabled={saving || uploading} className={btnPrimary}>
              {saving ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="fill" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// DETALHE: drawer lateral com fornecedores e comparação
// ────────────────────────────────────────────────────────────────
function CotacaoDetalhe({ cotacaoId, onClose, onChanged }) {
  const [cot, setCot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editarCot, setEditarCot] = useState(false);
  const [editarForn, setEditarForn] = useState(null); // { id?: } ou {} pra novo
  const [novoForn, setNovoForn] = useState(false);

  const fetchDetalhe = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/tech/cotacoes/${cotacaoId}`);
      const j = await r.json();
      if (j?.success) setCot(j.data);
    } finally { setLoading(false); }
  }, [cotacaoId]);

  useEffect(() => { fetchDetalhe(); }, [fetchDetalhe]);

  const escolherFornecedor = async (fornId) => {
    await fetch(`${API_BASE_URL}/api/tech/cotacoes/${cotacaoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fornecedor_escolhido_id: fornId, status: 'escolhido' }),
    });
    await fetchDetalhe(); onChanged?.();
  };

  const mudarStatus = async (novo) => {
    await fetch(`${API_BASE_URL}/api/tech/cotacoes/${cotacaoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novo }),
    });
    await fetchDetalhe(); onChanged?.();
  };

  const removerFornecedor = async (id) => {
    if (!window.confirm('Remover este fornecedor?')) return;
    await fetch(`${API_BASE_URL}/api/tech/cotacoes/fornecedores/${id}`, { method: 'DELETE' });
    await fetchDetalhe(); onChanged?.();
  };

  const excluirCotacao = async () => {
    if (!window.confirm(`Excluir a cotação "${cot?.titulo}" e todos os fornecedores/anexos? Esta ação não pode ser desfeita.`)) return;
    const r = await fetch(`${API_BASE_URL}/api/tech/cotacoes/${cotacaoId}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) {
      alert('Falha ao excluir: ' + (j?.message || r.statusText));
      return;
    }
    onClose(); onChanged?.();
  };

  const baixarAnexo = async (fornId) => {
    const r = await fetch(`${API_BASE_URL}/api/tech/cotacoes/anexo/${fornId}`);
    const j = await r.json();
    if (j?.success && j.data?.url) window.open(j.data.url, '_blank');
  };

  if (loading || !cot) {
    return (
      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
        <Spinner size={32} className="animate-spin text-white" />
      </div>
    );
  }

  const fornecedores = cot.fornecedores || [];
  const melhorPreco = fornecedores.length > 0
    ? Math.min(...fornecedores.map(totalFornecedor))
    : null;
  const si = statusInfo(cot.status);
  const ui = urgenciaInfo(cot.urgencia);
  const ci = categoriaInfo(cot.categoria);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-3xl bg-white z-40 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#000638] to-[#0a1450] px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ${ci.color}`}>
                  {ci.emoji} {ci.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ${si.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} /> {si.label}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ui.color}`}>{ui.label}</span>
                <span className="text-[10px] text-white/50">#{cot.id}</span>
              </div>
              <h2 className="text-xl font-bold text-white truncate">{cot.titulo}</h2>
              <p className="text-sm text-white/70 mt-1">
                {cot.quantidade} {cot.unidade}
                {cot.solicitante && ` · solicitado por ${cot.solicitante}`}
                {cot.data_necessidade && ` · até ${new Date(cot.data_necessidade).toLocaleDateString('pt-BR')}`}
              </p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5">
              <X size={20} />
            </button>
          </div>

          {cot.descricao && (
            <p className="mt-3 text-sm text-white/80 bg-white/5 rounded-lg p-3">{cot.descricao}</p>
          )}

          <div className="flex gap-2 mt-4 flex-wrap">
            <button onClick={() => setEditarCot(true)} className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-medium hover:bg-white/25 flex items-center gap-1.5">
              <PencilSimple size={12} /> Editar dados
            </button>
            {cot.status !== 'comprado' && cot.status !== 'cancelado' && (
              <>
                {cot.status === 'escolhido' && (
                  <button onClick={() => mudarStatus('comprado')} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 flex items-center gap-1.5">
                    <CheckCircle size={12} weight="fill" /> Marcar como comprado
                  </button>
                )}
                <button onClick={() => mudarStatus('cancelado')} className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-white text-xs font-medium hover:bg-rose-500/40 flex items-center gap-1.5">
                  <X size={12} /> Cancelar
                </button>
              </>
            )}
            <button onClick={excluirCotacao} className="ml-auto px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5">
              <Trash size={12} weight="fill" /> Excluir cotação
            </button>
          </div>
        </div>

        {/* Lista fornecedores */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Fornecedores ({fornecedores.length})
            </h3>
            <button onClick={() => setNovoForn(true)} className={btnPrimary}>
              <Plus size={14} weight="bold" /> Adicionar
            </button>
          </div>

          {fornecedores.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Buildings size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nenhum fornecedor cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Clique em "Adicionar" para começar a cotar</p>
            </div>
          )}

          {fornecedores.map((f) => {
            const total = totalFornecedor(f);
            const isMelhor = total === melhorPreco && fornecedores.length > 1;
            const isEscolhido = cot.fornecedor_escolhido_id === f.id;
            return (
              <div key={f.id}
                className={`bg-white rounded-xl border-2 transition shadow-sm ${
                  isEscolhido ? 'border-amber-400 ring-2 ring-amber-200' :
                  isMelhor ? 'border-emerald-300' : 'border-gray-200'
                }`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isEscolhido && <Crown size={16} weight="fill" className="text-amber-500" />}
                        {isMelhor && !isEscolhido && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                            MELHOR PREÇO
                          </span>
                        )}
                        <h4 className="text-base font-bold text-gray-900 truncate">{f.fornecedor_nome}</h4>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          {f.tipo_compra === 'online' ? <LinkIcon size={12} /> : <MapPin size={12} />}
                          {f.tipo_compra}
                        </span>
                        {f.fornecedor_contato && <span>📞 {f.fornecedor_contato}</span>}
                        {f.prazo_entrega && <span className="flex items-center gap-1"><Calendar size={12} />{f.prazo_entrega}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total</div>
                      <div className={`text-xl font-black tabular-nums ${isMelhor ? 'text-emerald-600' : 'text-gray-900'}`}>{fmtBRL(total)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                    <div className="bg-gray-50 rounded px-2 py-1.5">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Valor</div>
                      <div className="font-bold text-gray-900 tabular-nums">{fmtBRL(f.valor_unitario)}</div>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1.5">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1"><Truck size={10} />Frete</div>
                      <div className="font-bold text-gray-900 tabular-nums">{fmtBRL(f.frete)}</div>
                    </div>
                    <div className="bg-gray-50 rounded px-2 py-1.5">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1"><Receipt size={10} />Taxas</div>
                      <div className="font-bold text-gray-900 tabular-nums">{fmtBRL(f.taxas)}</div>
                    </div>
                  </div>

                  {(f.link || f.endereco) && (
                    <div className="text-xs text-gray-600 mb-2 truncate">
                      {f.tipo_compra === 'online' && f.link && (
                        <a href={f.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                          <LinkIcon size={11} /> {f.link}
                        </a>
                      )}
                      {f.tipo_compra === 'presencial' && f.endereco && (
                        <span className="flex items-center gap-1"><MapPin size={11} /> {f.endereco}</span>
                      )}
                    </div>
                  )}

                  {(f.condicao_pagamento || f.garantia) && (
                    <div className="text-xs text-gray-500 mb-2 flex gap-3">
                      {f.condicao_pagamento && <span>💳 {f.condicao_pagamento}</span>}
                      {f.garantia && <span>🛡️ {f.garantia}</span>}
                    </div>
                  )}

                  {f.observacao && <p className="text-xs text-gray-600 italic mb-2 bg-yellow-50 rounded px-2 py-1.5">{f.observacao}</p>}

                  <div className="flex gap-1.5 pt-2 border-t border-gray-100 flex-wrap">
                    {f.anexo_path && (
                      <button onClick={() => baixarAnexo(f.id)} className="text-xs px-2 py-1 rounded text-blue-700 hover:bg-blue-50 flex items-center gap-1">
                        <DownloadSimple size={12} /> {f.anexo_nome || 'Anexo'}
                      </button>
                    )}
                    <button onClick={() => setEditarForn(f)} className="text-xs px-2 py-1 rounded text-gray-700 hover:bg-gray-100 flex items-center gap-1">
                      <PencilSimple size={12} /> Editar
                    </button>
                    <button onClick={() => removerFornecedor(f.id)} className="text-xs px-2 py-1 rounded text-rose-700 hover:bg-rose-50 flex items-center gap-1">
                      <Trash size={12} /> Remover
                    </button>
                    {!isEscolhido && cot.status !== 'comprado' && cot.status !== 'cancelado' && (
                      <button onClick={() => escolherFornecedor(f.id)} className="ml-auto text-xs px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 font-semibold flex items-center gap-1">
                        <Crown size={12} weight="fill" /> Escolher este
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editarCot && <CotacaoModal cotacao={cot} onClose={() => setEditarCot(false)} onSaved={() => { setEditarCot(false); fetchDetalhe(); onChanged?.(); }} />}
      {(novoForn || editarForn) && (
        <FornecedorModal
          cotacaoId={cotacaoId}
          fornecedor={editarForn}
          onClose={() => { setNovoForn(false); setEditarForn(null); }}
          onSaved={() => { setNovoForn(false); setEditarForn(null); fetchDetalhe(); onChanged?.(); }}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// PÁGINA
// ────────────────────────────────────────────────────────────────
export default function CotacaoCompras() {
  const [cotacoes, setCotacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [novaCot, setNovaCot] = useState(false);
  const [detalheId, setDetalheId] = useState(null);

  const fetchLista = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set('q', busca);
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroCategoria) params.set('categoria', filtroCategoria);
      const r = await fetch(`${API_BASE_URL}/api/tech/cotacoes?${params}`);
      const j = await r.json();
      if (j?.success) setCotacoes(j.data?.cotacoes || []);
    } finally { setLoading(false); }
  }, [busca, filtroStatus, filtroCategoria]);

  useEffect(() => { fetchLista(); }, [fetchLista]);

  const stats = useMemo(() => {
    const out = { total: cotacoes.length, rascunho: 0, cotando: 0, escolhido: 0, comprado: 0 };
    for (const c of cotacoes) if (c.status in out) out[c.status]++;
    return out;
  }, [cotacoes]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-barlow">
      <PageTitle
        title="Cotação de Compras"
        subtitle="Cotações de TI — material, fornecedores e comparativo"
        icon={ShoppingCart}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { l: 'Total',     v: stats.total,     c: 'text-gray-900' },
          { l: 'Rascunho',  v: stats.rascunho,  c: 'text-gray-600' },
          { l: 'Cotando',   v: stats.cotando,   c: 'text-blue-600' },
          { l: 'Escolhido', v: stats.escolhido, c: 'text-amber-600' },
          { l: 'Comprado',  v: stats.comprado,  c: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.l} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{s.l}</div>
            <div className={`text-2xl font-black tabular-nums ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar título, descrição ou solicitante" className={`${inputCls} pl-9`} />
        </div>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={`${inputCls} max-w-[180px]`}>
          <option value="">Todas categorias</option>
          {CATEGORIA.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={`${inputCls} max-w-[180px]`}>
          <option value="">Todos status</option>
          {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setNovaCot(true)} className={btnPrimary}>
          <Plus size={14} weight="bold" /> Nova cotação
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12"><Spinner size={28} className="animate-spin text-gray-400 mx-auto" /></div>
      ) : cotacoes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <ShoppingCart size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma cotação cadastrada</p>
          <p className="text-sm text-gray-400 mt-1">Clique em "Nova cotação" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cotacoes.map((c) => {
            const si = statusInfo(c.status);
            const ui = urgenciaInfo(c.urgencia);
            const ci = categoriaInfo(c.categoria);
            const totais = (c.fornecedores || []).map((f) => totalFornecedor(f));
            const menor = totais.length ? Math.min(...totais) : null;
            const escolhidoId = c.fornecedor_escolhido_id;
            const escolhido = (c.fornecedores || []).find((f) => f.id === escolhidoId);
            return (
              <button key={c.id} onClick={() => setDetalheId(c.id)} className="text-left bg-white rounded-xl border border-gray-200 hover:border-[#000638]/40 hover:shadow-md transition p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ${ci.color}`}>
                    {ci.emoji} {ci.label}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ${si.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} /> {si.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ui.color}`}>{ui.label}</span>
                  <span className="ml-auto text-[10px] text-gray-400 font-mono">#{c.id}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">{c.titulo}</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {c.quantidade} {c.unidade}
                  {c.solicitante && ` · ${c.solicitante}`}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-500">
                    <Buildings size={12} className="inline mr-1" />
                    {(c.fornecedores?.length || 0)} fornec.
                  </div>
                  {escolhido ? (
                    <div className="text-right">
                      <div className="text-[10px] text-amber-700 uppercase font-bold">Escolhido</div>
                      <div className="font-bold text-gray-900 tabular-nums">{fmtBRL(totalFornecedor(escolhido))}</div>
                    </div>
                  ) : menor != null ? (
                    <div className="text-right">
                      <div className="text-[10px] text-emerald-700 uppercase font-bold">Menor</div>
                      <div className="font-bold text-emerald-700 tabular-nums">{fmtBRL(menor)}</div>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {novaCot && <CotacaoModal onClose={() => setNovaCot(false)} onSaved={(c) => { setNovaCot(false); fetchLista(); setDetalheId(c.id); }} />}
      {detalheId && <CotacaoDetalhe cotacaoId={detalheId} onClose={() => setDetalheId(null)} onChanged={fetchLista} />}
    </div>
  );
}
