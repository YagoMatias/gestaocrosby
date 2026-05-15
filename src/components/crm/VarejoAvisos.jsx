// Sub-aba "Avisos" — Reunião do Varejo
// Gerente cadastra avisos semanais. Vendedoras/gerentes leem.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  PencilSimple,
  Trash,
  Warning,
  Info,
  Fire,
  X,
  CheckCircle,
  CalendarBlank,
  Funnel,
  Spinner,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { ano: d.getUTCFullYear(), semana: weekNo };
}

const PRIORIDADES = {
  normal:  { label: 'Normal',  icon: Info,     bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',     iconColor: 'text-blue-500',    chip: 'bg-blue-100 text-blue-700' },
  alta:    { label: 'Alta',    icon: Warning,  bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-800',    iconColor: 'text-amber-500',   chip: 'bg-amber-100 text-amber-800' },
  urgente: { label: 'Urgente', icon: Fire,     bg: 'bg-rose-50 border-rose-300',     text: 'text-rose-800',     iconColor: 'text-rose-500',    chip: 'bg-rose-100 text-rose-700' },
};

// ──────────────────────────────────────────────────────────────
// Modal de cadastro/edição
// ──────────────────────────────────────────────────────────────
function AvisoModal({ aviso, onClose, onSaved }) {
  const cur = isoWeek(new Date());
  const isNew = !aviso;
  const [titulo, setTitulo] = useState(aviso?.titulo || '');
  const [conteudo, setConteudo] = useState(aviso?.conteudo || '');
  const [prioridade, setPrioridade] = useState(aviso?.prioridade || 'normal');
  const [ano, setAno] = useState(aviso?.ano ?? cur.ano);
  const [semana, setSemana] = useState(aviso?.semana_iso ?? cur.semana);
  const [expira, setExpira] = useState(aviso?.expira_em || '');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    if (!titulo.trim() || !conteudo.trim()) {
      setErro('Título e conteúdo obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        prioridade,
        ano: ano ? Number(ano) : null,
        semana_iso: semana ? Number(semana) : null,
        expira_em: expira || null,
      };
      const url = isNew
        ? `${API_BASE_URL}/api/crm/varejo/avisos`
        : `${API_BASE_URL}/api/crm/varejo/avisos/${aviso.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto font-barlow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[#000638] flex items-center gap-2">
            <Megaphone size={20} weight="fill" className="text-indigo-600" />
            {isNew ? 'Novo aviso' : 'Editar aviso'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#000638] outline-none"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Conteúdo *</label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#000638] outline-none font-barlow"
              required
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Quebras de linha são preservadas</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Object.entries(PRIORIDADES).map(([v, p]) => (
                  <option key={v} value={v}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Expira em (opcional)</label>
              <input
                type="date"
                value={expira}
                onChange={(e) => setExpira(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ano (opcional)</label>
              <input
                type="number"
                value={ano || ''}
                onChange={(e) => setAno(e.target.value ? Number(e.target.value) : '')}
                placeholder="2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Semana ISO (opcional)</label>
              <input
                type="number"
                min="1"
                max="53"
                value={semana || ''}
                onChange={(e) => setSemana(e.target.value ? Number(e.target.value) : '')}
                placeholder="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 -mt-1">Vazio = aviso geral (não amarrado a uma semana específica).</p>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#000638] hover:bg-[#0a1450] text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <CheckCircle size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────
export default function VarejoAvisos() {
  const cur = isoWeek(new Date());
  const [filtroSemana, setFiltroSemana] = useState(''); // '' | 'atual' | numero
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams({ ativo: 'true', limit: '100' });
      if (filtroSemana === 'atual') {
        qs.set('ano', String(cur.ano));
        qs.set('semana', String(cur.semana));
      }
      const r = await fetch(`${API_BASE_URL}/api/crm/varejo/avisos?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setAvisos(j.data?.avisos || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroSemana, cur.ano, cur.semana]);

  useEffect(() => { carregar(); }, [carregar]);

  const remover = async (a) => {
    if (!confirm(`Remover "${a.titulo}"?`)) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/crm/varejo/avisos/${a.id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      await carregar();
    } catch (e) {
      alert(e.message);
    }
  };

  // Agrupa avisos por semana_iso (null = geral no topo)
  const grupos = useMemo(() => {
    const map = new Map();
    for (const a of avisos) {
      const key = a.semana_iso ? `${a.ano}-W${String(a.semana_iso).padStart(2, '0')}` : '__geral__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    // Ordena chaves: geral primeiro, depois semanas em ordem desc
    const entries = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === '__geral__') return -1;
      if (b[0] === '__geral__') return 1;
      return b[0].localeCompare(a[0]);
    });
    return entries;
  }, [avisos]);

  return (
    <div className="space-y-3 font-barlow">
      {/* Header / filtros */}
      <div className="flex flex-col bg-white p-3 sm:p-4 rounded-xl shadow-md border border-[#000638]/10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#000638] flex items-center gap-1.5">
              <Megaphone size={16} weight="fill" className="text-indigo-600" />
              Avisos da Reunião
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cadastrados pelo gerente — visíveis para o time de varejo
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-500 inline-flex items-center gap-1 mr-1">
              <Funnel size={12} weight="bold" /> Filtro:
            </span>
            <button
              onClick={() => setFiltroSemana('')}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                filtroSemana === '' ? 'bg-[#000638] text-white font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroSemana('atual')}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                filtroSemana === 'atual' ? 'bg-[#000638] text-white font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Semana {cur.semana}
            </button>
            <button
              onClick={() => { setEditando(null); setShowModal(true); }}
              className="ml-2 inline-flex items-center gap-1 bg-[#000638] hover:bg-[#0a1450] text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
            >
              <Plus size={12} weight="bold" /> Novo aviso
            </button>
          </div>
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{erro}</div>}

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
          <Spinner size={20} className="animate-spin" /> <span className="text-sm">Carregando avisos...</span>
        </div>
      )}

      {!loading && avisos.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Megaphone size={42} weight="light" className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhum aviso publicado.</p>
          <p className="text-xs mt-1">Clique em "Novo aviso" pra cadastrar o primeiro.</p>
        </div>
      )}

      {/* Avisos agrupados */}
      {grupos.map(([groupKey, lista]) => (
        <div key={groupKey} className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {groupKey === '__geral__' ? (
                <span className="inline-flex items-center gap-1">
                  <Info size={11} /> Avisos gerais
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <CalendarBlank size={11} /> {groupKey}
                </span>
              )}
            </h4>
            <span className="text-[10px] text-gray-400">({lista.length})</span>
          </div>
          {lista.map((a) => {
            const p = PRIORIDADES[a.prioridade] || PRIORIDADES.normal;
            const Icon = p.icon;
            return (
              <div key={a.id} className={`border ${p.bg} rounded-xl p-3 sm:p-4 shadow-sm transition hover:shadow-md`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <Icon size={18} weight="fill" className={`${p.iconColor} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0">
                      <h5 className={`text-sm font-bold ${p.text} leading-snug`}>{a.titulo}</h5>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${p.chip}`}>
                          {p.label}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {fmtData(a.criado_em)}
                          {a.criado_por && <> · {a.criado_por}</>}
                        </span>
                        {a.expira_em && (
                          <span className="text-[10px] text-rose-600 inline-flex items-center gap-0.5">
                            <CalendarBlank size={10} /> expira {new Date(a.expira_em + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditando(a); setShowModal(true); }}
                      className="p-1.5 text-gray-500 hover:text-[#000638]"
                      title="Editar"
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      onClick={() => remover(a)}
                      className="p-1.5 text-gray-500 hover:text-red-600"
                      title="Remover"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
                <p className={`text-sm text-gray-700 whitespace-pre-wrap mt-1`}>{a.conteudo}</p>
              </div>
            );
          })}
        </div>
      ))}

      {showModal && (
        <AvisoModal
          aviso={editando}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onSaved={() => { setShowModal(false); setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}
