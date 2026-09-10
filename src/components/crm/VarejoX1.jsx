// Sub-aba "X1" dentro de Reunião / Varejo
// Uma "programação" X1 tem até 10 confrontos 1v1 (vendedor A × vendedor B, de
// lojas diferentes). Vencedor de cada confronto = maior faturamento no período.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  HandFist,
  Crown,
  Spinner,
  Trash,
  Storefront,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
} from 'phosphor-react';
import { API_BASE_URL } from '../../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(opts.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json.data ?? json;
}

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

// ─── Card de um confronto (A × B) ─────────────────────────────────────────
function ConfrontoCard({ c }) {
  const a = c.a || {};
  const b = c.b || {};
  const max = Math.max(a.invoice_value || 0, b.invoice_value || 0, 1);
  const winA = c.vencedor === 'a';
  const winB = c.vencedor === 'b';
  const empate = c.vencedor === 'empate';

  const pctA = ((a.invoice_value || 0) / max) * 100;
  const pctB = ((b.invoice_value || 0) / max) * 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0b14] shadow-lg">
      {/* Glow vermelho (esquerda) × azul (direita) — estilo card de luta */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-red-600/35 via-red-600/8 to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-3/5 bg-gradient-to-l from-blue-600/35 via-blue-600/8 to-transparent" />
      <span className="pointer-events-none absolute inset-y-3 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent" />

      <div className="relative px-3 py-3">
        {/* Branding X1 */}
        <div className="flex items-center justify-center gap-1 mb-2">
          <Crown size={10} weight="fill" className="text-amber-400/70" />
          <span className="text-[10px] font-black tracking-[0.25em] text-white/80">X1</span>
          <span className="text-[8px] font-bold tracking-widest text-white/30">CROSBY</span>
        </div>

        <div className="flex items-stretch gap-2">
          {/* Canto vermelho — A */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1">
              {winA && <Crown size={13} weight="fill" className="text-amber-400 shrink-0" />}
              <span
                className="text-sm font-black uppercase tracking-wide text-red-400 truncate"
                style={{ textShadow: '0 1px 10px rgba(239,68,68,.55)' }}
              >
                {a.seller_name || '—'}
              </span>
            </div>
            <div className="text-[9px] text-white/40 flex items-center gap-1 truncate">
              <Storefront size={9} /> {a.branch_name || '—'}
            </div>
            <div className={`mt-1 text-base font-extrabold tabular-nums ${winA ? 'text-white' : 'text-white/55'}`}>
              {fmtBRL(a.invoice_value)}
            </div>
          </div>

          {/* VS */}
          <div className="shrink-0 self-center flex flex-col items-center px-1">
            <span
              className="text-xl font-black italic text-white leading-none"
              style={{ textShadow: '0 2px 12px rgba(255,255,255,.35)' }}
            >
              VS
            </span>
            {empate && <span className="text-[8px] font-bold text-amber-400 uppercase mt-0.5">empate</span>}
          </div>

          {/* Canto azul — B */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-1 justify-end">
              <span
                className="text-sm font-black uppercase tracking-wide text-blue-400 truncate"
                style={{ textShadow: '0 1px 10px rgba(59,130,246,.55)' }}
              >
                {b.seller_name || '—'}
              </span>
              {winB && <Crown size={13} weight="fill" className="text-amber-400 shrink-0" />}
            </div>
            <div className="text-[9px] text-white/40 flex items-center gap-1 justify-end truncate">
              {b.branch_name || '—'} <Storefront size={9} />
            </div>
            <div className={`mt-1 text-base font-extrabold tabular-nums ${winB ? 'text-white' : 'text-white/55'}`}>
              {fmtBRL(b.invoice_value)}
            </div>
          </div>
        </div>

        {/* Barras: vermelha cresce pra esquerda, azul pra direita */}
        <div className="flex items-center gap-1 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden flex justify-end">
            <div className="h-full rounded-full bg-gradient-to-l from-red-500 to-red-700" style={{ width: `${pctA}%` }} />
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700" style={{ width: `${pctB}%` }} />
          </div>
        </div>

        <div className="text-center mt-1.5">
          <span className="text-[8px] font-bold tracking-[0.2em] text-white/40 uppercase">Só um vence!</span>
        </div>
      </div>
    </div>
  );
}

// ─── Card de uma programação X1 ───────────────────────────────────────────
function X1Card({ x1, isAdmin, onEncerrar, onCancelar, onExcluir }) {
  const resultados = x1.resultados || x1.ranking_final || [];
  const statusBadge = {
    ativa: 'bg-emerald-100 text-emerald-700',
    encerrada: 'bg-gray-200 text-gray-600',
    cancelada: 'bg-rose-100 text-rose-600',
  }[x1.status] || 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-[#000638] to-[#1a1f5a] text-white flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HandFist size={16} weight="fill" className="text-red-300" />
            <h3 className="text-sm font-bold truncate">{x1.nome}</h3>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusBadge}`}>
              {x1.status}
            </span>
          </div>
          <p className="text-[11px] text-blue-100 mt-0.5">
            {fmtData(x1.data_inicio)} — {fmtData(x1.data_fim)} · {resultados.length}{' '}
            {resultados.length === 1 ? 'confronto' : 'confrontos'}
            {x1.premiacao && <> · 🏆 {x1.premiacao}</>}
          </p>
        </div>
        {isAdmin && x1.status === 'ativa' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEncerrar(x1)}
              className="text-[10px] font-bold px-2 py-1 rounded bg-white/15 hover:bg-white/25 inline-flex items-center gap-1"
              title="Encerrar (salva o resultado final)"
            >
              <CheckCircle size={12} /> Encerrar
            </button>
            <button
              onClick={() => onCancelar(x1)}
              className="text-[10px] font-bold px-2 py-1 rounded bg-white/15 hover:bg-white/25 inline-flex items-center gap-1"
            >
              <XCircle size={12} /> Cancelar
            </button>
          </div>
        )}
        {isAdmin && x1.status !== 'ativa' && (
          <button
            onClick={() => onExcluir(x1)}
            className="text-[10px] font-bold px-2 py-1 rounded bg-white/15 hover:bg-white/25 inline-flex items-center gap-1"
          >
            <Trash size={12} /> Excluir
          </button>
        )}
      </div>
      <div className="p-3 bg-[#05060c]">
        {x1.resultados_error && (
          <div className="text-[11px] text-rose-400 mb-2">
            Erro ao calcular faturamento: {x1.resultados_error}
          </div>
        )}
        {resultados.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-4">Sem confrontos.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {resultados.map((c, i) => (
              <ConfrontoCard key={i} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form de nova programação X1 ──────────────────────────────────────────
function X1Form({ vendedores, loadingVend, onClose, onCreated, userLogin }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [nome, setNome] = useState('');
  const [premiacao, setPremiacao] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [confrontos, setConfrontos] = useState([{ a: '', b: '' }]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const vendByCode = useMemo(() => {
    const m = new Map();
    for (const v of vendedores) m.set(String(v.seller_code), v);
    return m;
  }, [vendedores]);

  const setLado = (idx, lado, code) =>
    setConfrontos((cs) =>
      cs.map((c, i) => (i === idx ? { ...c, [lado]: code } : c)),
    );
  const addConfronto = () =>
    setConfrontos((cs) => (cs.length >= 10 ? cs : [...cs, { a: '', b: '' }]));
  const rmConfronto = (idx) =>
    setConfrontos((cs) => cs.filter((_, i) => i !== idx));

  const salvar = async () => {
    setErro('');
    if (!nome.trim()) return setErro('Dê um nome à programação.');
    const validos = confrontos.filter((c) => c.a && c.b);
    if (validos.length === 0) return setErro('Adicione ao menos 1 confronto completo.');
    for (const c of validos) {
      if (String(c.a) === String(c.b))
        return setErro('Um confronto não pode ter o mesmo vendedor dos dois lados.');
    }
    if (new Date(dataFim) < new Date(dataInicio))
      return setErro('Data fim deve ser ≥ data início.');

    const toPart = (code) => {
      const v = vendByCode.get(String(code));
      return {
        seller_code: Number(code),
        seller_name: v?.seller_name || null,
        branch_code: v?.branch_code ?? null,
        branch_name: v?.branch_name || null,
      };
    };
    setSaving(true);
    try {
      await apiFetch('/api/crm/varejo/x1', {
        method: 'POST',
        headers: { 'x-user-role': 'admin', 'x-user-login': userLogin || '' },
        body: JSON.stringify({
          nome: nome.trim(),
          premiacao: premiacao.trim() || null,
          data_inicio: dataInicio,
          data_fim: dataFim,
          user_login: userLogin,
          confrontos: validos.map((c) => ({ a: toPart(c.a), b: toPart(c.b) })),
        }),
      });
      onCreated();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  const VendSelect = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loadingVend}
      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#000638]"
    >
      <option value="">{loadingVend ? 'Carregando…' : 'Selecione o vendedor'}</option>
      {vendedores.map((v) => (
        <option key={v.seller_code} value={v.seller_code}>
          {v.seller_name} — {v.branch_name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-[#000638] flex items-center gap-2">
            <HandFist size={16} weight="fill" className="text-red-600" /> Nova programação X1
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: X1 da semana"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#000638]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Premiação (opcional)</label>
              <input value={premiacao} onChange={(e) => setPremiacao(e.target.value)}
                placeholder="Ex: R$ 200 + folga"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#000638]" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-500">
                Confrontos ({confrontos.length}/10)
              </label>
              <button
                onClick={addConfronto}
                disabled={confrontos.length >= 10}
                className="text-[11px] font-bold text-[#000638] hover:underline disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Plus size={12} weight="bold" /> Adicionar confronto
              </button>
            </div>
            <div className="space-y-2">
              {confrontos.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1"><VendSelect value={c.a} onChange={(v) => setLado(idx, 'a', v)} /></div>
                  <span className="text-[10px] font-black text-gray-300">VS</span>
                  <div className="flex-1"><VendSelect value={c.b} onChange={(v) => setLado(idx, 'b', v)} /></div>
                  <button
                    onClick={() => rmConfronto(idx)}
                    disabled={confrontos.length <= 1}
                    className="p-1.5 text-gray-400 hover:text-rose-600 disabled:opacity-30"
                    title="Remover confronto"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {erro && (
            <div className="bg-rose-50 border border-rose-200 rounded-md px-3 py-2 text-xs text-rose-700">{erro}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#000638] hover:bg-[#1a1f5a] text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {saving ? <Spinner size={13} className="animate-spin" /> : <HandFist size={13} weight="fill" />}
            {saving ? 'Criando…' : 'Criar X1'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────
export default function VarejoX1({ isAdmin, userLogin }) {
  const [x1s, setX1s] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loadingVend, setLoadingVend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const d = await apiFetch('/api/crm/varejo/x1?includeRanking=true');
      setX1s(d.x1s || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarVendedores = useCallback(async () => {
    setLoadingVend(true);
    try {
      const d = await apiFetch('/api/crm/varejo/x1-vendedores');
      setVendedores(d.vendedores || []);
    } catch {
      setVendedores([]);
    } finally {
      setLoadingVend(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirForm = () => {
    if (vendedores.length === 0) carregarVendedores();
    setShowForm(true);
  };

  const encerrar = async (x1) => {
    if (!confirm(`Encerrar "${x1.nome}"? O resultado atual será salvo como final.`)) return;
    try {
      await apiFetch(`/api/crm/varejo/x1/${x1.id}`, {
        method: 'PATCH',
        headers: { 'x-user-role': 'admin', 'x-user-login': userLogin || '' },
        body: JSON.stringify({ acao: 'encerrar' }),
      });
      carregar();
    } catch (e) {
      alert(e.message);
    }
  };
  const cancelar = async (x1) => {
    if (!confirm(`Cancelar "${x1.nome}"?`)) return;
    try {
      await apiFetch(`/api/crm/varejo/x1/${x1.id}`, {
        method: 'PATCH',
        headers: { 'x-user-role': 'admin', 'x-user-login': userLogin || '' },
        body: JSON.stringify({ acao: 'cancelar' }),
      });
      carregar();
    } catch (e) {
      alert(e.message);
    }
  };
  const excluir = async (x1) => {
    if (!confirm(`Excluir "${x1.nome}" definitivamente?`)) return;
    try {
      await apiFetch(`/api/crm/varejo/x1/${x1.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'admin' },
      });
      carregar();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-[#000638] flex items-center gap-2">
            <HandFist size={16} weight="fill" className="text-red-600" /> X1 — Vendedor × Vendedor
          </h3>
          <p className="text-[11px] text-gray-500">
            Até 10 confrontos 1v1 por programação. Vencedor = maior faturamento no período.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1"
            title="Atualizar"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button
              onClick={abrirForm}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-[#000638] hover:bg-[#1a1f5a] text-white inline-flex items-center gap-1.5"
            >
              <Plus size={14} weight="bold" /> Nova programação
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-700">{erro}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <Spinner size={20} className="animate-spin" />
          <span className="text-xs">Carregando X1…</span>
        </div>
      ) : x1s.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <HandFist size={36} weight="duotone" className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Nenhuma programação X1 ainda.</p>
          {isAdmin && (
            <p className="text-[11px] text-gray-400 mt-1">
              Clique em "Nova programação" para montar os confrontos.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {x1s.map((x1) => (
            <X1Card
              key={x1.id}
              x1={x1}
              isAdmin={isAdmin}
              onEncerrar={encerrar}
              onCancelar={cancelar}
              onExcluir={excluir}
            />
          ))}
        </div>
      )}

      {showForm && (
        <X1Form
          vendedores={vendedores}
          loadingVend={loadingVend}
          userLogin={userLogin}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
