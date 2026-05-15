// Sub-aba "Competição" dentro de Reunião / Varejo
// Lista competições ativas e histórico, permite criar/encerrar/cancelar (admin)
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, X, Trophy, HandFist, CheckCircle, XCircle, CaretDown, CaretRight, ArrowsClockwise, Spinner, Storefront, Buildings, MapPin, Check } from 'phosphor-react';
import { API_BASE_URL } from '../../config/constants';
import CompeticaoRing from './CompeticaoRing';

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

// Branches varejo (lojas que podem competir)
const VAREJO_BRANCHES = [
  { code: 2, name: 'CROSBY JOAO PESSOA', short: 'João Pessoa', uf: 'PB', type: 'rua' },
  { code: 5, name: 'CROSBY NOVA CRUZ', short: 'Nova Cruz', uf: 'RN', type: 'rua' },
  { code: 55, name: 'CROSBY PARNAMIRIM', short: 'Parnamirim', uf: 'RN', type: 'rua' },
  { code: 65, name: 'CROSBY CANGUARETAMA', short: 'Canguaretama', uf: 'RN', type: 'rua' },
  { code: 87, name: 'CROSBY SHOPPING CIDADE JARDIM', short: 'Cidade Jardim', uf: 'PE', type: 'shopping' },
  { code: 88, name: 'CROSBY SHOPPING GUARARAPES', short: 'Guararapes', uf: 'PE', type: 'shopping' },
  { code: 90, name: 'CROSBY AYRTON SENNA', short: 'Ayrton Senna', uf: 'RN', type: 'rua' },
  { code: 93, name: 'CROSBY IMPERATRIZ', short: 'Imperatriz', uf: 'MA', type: 'rua' },
  { code: 94, name: 'CROSBY SHOPPING PATOS', short: 'Patos', uf: 'PB', type: 'shopping' },
  { code: 95, name: 'CROSBY SHOPPING MIDWAY', short: 'Midway', uf: 'RN', type: 'shopping' },
  { code: 97, name: 'CROSBY SHOPPING TERESINA', short: 'Teresina', uf: 'PI', type: 'shopping' },
  { code: 98, name: 'CROSBY SHOPPING RECIFE', short: 'Shopping Recife', uf: 'PE', type: 'shopping' },
];

// Cores cíclicas dos cantos do ring (mesma do CompeticaoRing)
const RING_CORNER_COLORS = [
  { bg: 'from-red-500 to-red-600', border: 'border-red-300', ring: 'ring-red-400', label: 'Red' },
  { bg: 'from-blue-500 to-blue-600', border: 'border-blue-300', ring: 'ring-blue-400', label: 'Blue' },
  { bg: 'from-green-500 to-green-600', border: 'border-green-300', ring: 'ring-green-400', label: 'Green' },
  { bg: 'from-amber-500 to-amber-600', border: 'border-amber-300', ring: 'ring-amber-400', label: 'Yellow' },
  { bg: 'from-purple-500 to-purple-600', border: 'border-purple-300', ring: 'ring-purple-400', label: 'Purple' },
  { bg: 'from-cyan-500 to-cyan-600', border: 'border-cyan-300', ring: 'ring-cyan-400', label: 'Cyan' },
  { bg: 'from-pink-500 to-pink-600', border: 'border-pink-300', ring: 'ring-pink-400', label: 'Pink' },
  { bg: 'from-orange-500 to-orange-600', border: 'border-orange-300', ring: 'ring-orange-400', label: 'Orange' },
];

const DURACOES_PRESET = [
  { value: '1w', label: '1 semana (7 dias)', days: 7 },
  { value: '15d', label: '15 dias', days: 15 },
  { value: '1m', label: '1 mês (30 dias)', days: 30 },
  { value: 'custom', label: 'Período personalizado', days: 0 },
];

function calcDataFim(dataInicio, duracao) {
  if (!dataInicio || duracao === 'custom') return null;
  const preset = DURACOES_PRESET.find((d) => d.value === duracao);
  if (!preset) return null;
  const d = new Date(dataInicio + 'T00:00:00');
  d.setDate(d.getDate() + preset.days - 1);
  return d.toISOString().split('T')[0];
}

export default function VarejoCompeticao({ isAdmin, userLogin }) {
  const [competicoes, setCompeticoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedHistorico, setExpandedHistorico] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const r = await apiFetch('/api/crm/varejo/competicoes?includeRanking=true');
      setCompeticoes(r.competicoes || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ativas = useMemo(
    () => competicoes.filter((c) => c.status === 'ativa'),
    [competicoes],
  );
  const historico = useMemo(
    () => competicoes.filter((c) => c.status !== 'ativa'),
    [competicoes],
  );

  const onEncerrar = async (id) => {
    if (!confirm('Encerrar a competição? Isso salva o ranking final.')) return;
    try {
      await apiFetch(`/api/crm/varejo/competicoes/${id}`, {
        method: 'PATCH',
        headers: { 'x-user-role': 'admin', 'x-user-login': userLogin || '' },
        body: JSON.stringify({ acao: 'encerrar', user_login: userLogin }),
      });
      await load();
    } catch (e) {
      alert('Erro ao encerrar: ' + e.message);
    }
  };

  const onCancelar = async (id) => {
    if (!confirm('Cancelar a competição? (não conta no histórico de vencedores)')) return;
    try {
      await apiFetch(`/api/crm/varejo/competicoes/${id}`, {
        method: 'PATCH',
        headers: { 'x-user-role': 'admin', 'x-user-login': userLogin || '' },
        body: JSON.stringify({ acao: 'cancelar', user_login: userLogin }),
      });
      await load();
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('REMOVER PERMANENTEMENTE essa competição do banco?')) return;
    try {
      await apiFetch(`/api/crm/varejo/competicoes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'admin' },
      });
      await load();
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[#000638] flex items-center gap-2">
            <HandFist size={18} weight="duotone" className="text-red-600" />
            Competição entre Lojas
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Gerente define quais lojas competem e o período. Vencedor é a com maior faturamento ao fim do round.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? (
              <Spinner size={12} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={12} />
            )}
            Atualizar
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 inline-flex items-center gap-1 font-semibold"
            >
              <Plus size={12} weight="bold" />
              Nova competição
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-sm text-rose-700">
          ❌ {erro}
        </div>
      )}

      {/* Ativas */}
      {loading && competicoes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          <Spinner size={24} className="animate-spin inline mb-2" />
          <p>Carregando competições...</p>
        </div>
      ) : ativas.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <HandFist size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">
            Nenhuma competição ativa
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isAdmin
              ? 'Clique em "Nova competição" pra criar a primeira.'
              : 'Aguardando o gestor configurar uma competição.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ativas.map((c) => (
            <CompeticaoCard
              key={c.id}
              comp={c}
              isAdmin={isAdmin}
              onEncerrar={() => onEncerrar(c.id)}
              onCancelar={() => onCancelar(c.id)}
              onDelete={() => onDelete(c.id)}
            />
          ))}
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedHistorico((v) => !v)}
            className="w-full flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition px-3 py-2 rounded text-sm font-semibold text-gray-700"
          >
            <span className="inline-flex items-center gap-2">
              {expandedHistorico ? (
                <CaretDown size={14} />
              ) : (
                <CaretRight size={14} />
              )}
              <Trophy size={14} className="text-amber-600" />
              Histórico ({historico.length}{' '}
              {historico.length === 1 ? 'competição' : 'competições'})
            </span>
          </button>
          {expandedHistorico && (
            <div className="mt-3 space-y-4">
              {historico.map((c) => (
                <CompeticaoCard
                  key={c.id}
                  comp={c}
                  isAdmin={isAdmin}
                  onDelete={() => onDelete(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de criação */}
      {showForm && (
        <CompeticaoFormModal
          userLogin={userLogin}
          onClose={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ─── Card de uma competição (com ring) ────────────────────────────────
function CompeticaoCard({ comp, isAdmin, onEncerrar, onCancelar, onDelete }) {
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Se a competição já vem com ranking do GET geral, usa direto
  const rankingInicial = comp.ranking || comp.ranking_final || null;
  const ranking = details?.ranking || rankingInicial;

  const refresh = useCallback(async () => {
    setLoadingDetails(true);
    try {
      const d = await apiFetch(`/api/crm/varejo/competicoes/${comp.id}`);
      setDetails(d);
    } catch (e) {
      // mantém o ranking inicial
    } finally {
      setLoadingDetails(false);
    }
  }, [comp.id]);

  return (
    <div className="relative">
      <CompeticaoRing competicao={comp} ranking={ranking} />

      {/* Botões de ação (admin) */}
      {isAdmin && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={refresh}
            disabled={loadingDetails}
            className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
          >
            {loadingDetails ? (
              <Spinner size={10} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={10} />
            )}
            Atualizar dados
          </button>
          {comp.status === 'ativa' && (
            <>
              <button
                onClick={onEncerrar}
                className="text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 inline-flex items-center gap-1"
              >
                <CheckCircle size={10} weight="bold" />
                Encerrar agora
              </button>
              <button
                onClick={onCancelar}
                className="text-xs px-3 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1"
              >
                <XCircle size={10} weight="bold" />
                Cancelar
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded text-gray-400 hover:bg-rose-50 hover:text-rose-600 ml-auto"
            title="Remover permanentemente"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Modal de criação de competição ───────────────────────────────────
function CompeticaoFormModal({ userLogin, onClose, onCreated }) {
  const hoje = new Date().toISOString().split('T')[0];
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [premiacao, setPremiacao] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [duracao, setDuracao] = useState('1w');
  const [dataFimCustom, setDataFimCustom] = useState('');
  const [selectedBranches, setSelectedBranches] = useState(new Set());
  const [metaValor, setMetaValor] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const dataFim =
    duracao === 'custom' ? dataFimCustom : calcDataFim(dataInicio, duracao);

  const toggleBranch = (code) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!nome.trim()) return setErr('Nome obrigatório');
    if (selectedBranches.size < 2) return setErr('Selecione ao menos 2 lojas');
    if (!dataInicio || !dataFim) return setErr('Período inválido');
    if (new Date(dataFim) < new Date(dataInicio))
      return setErr('Data fim deve ser >= data início');

    setSaving(true);
    try {
      await apiFetch('/api/crm/varejo/competicoes', {
        method: 'POST',
        headers: {
          'x-user-role': 'admin',
          'x-user-login': userLogin || '',
        },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          premiacao: premiacao.trim() || null,
          data_inicio: dataInicio,
          data_fim: dataFim,
          duracao_preset: duracao,
          branch_codes: [...selectedBranches],
          meta_tipo: 'faturamento',
          meta_valor: metaValor ? Number(metaValor) : null,
          user_login: userLogin,
        }),
      });
      onCreated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HandFist size={20} className="text-red-600" />
            <h3 className="font-bold text-gray-800">Nova Competição</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
              Nome da competição *
            </label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Round de Maio 2026 — Shoppings"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Premiação (opcional)
              </label>
              <input
                value={premiacao}
                onChange={(e) => setPremiacao(e.target.value)}
                placeholder="Ex: iPhone, PIX R$ 1.000"
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Meta de faturamento (R$, opcional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={metaValor}
                onChange={(e) => setMetaValor(e.target.value)}
                placeholder="Ex: 50000"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
              Descrição (opcional)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Período *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500">Data início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Duração</label>
                <select
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DURACOES_PRESET.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {duracao === 'custom' && (
              <div className="mt-2">
                <label className="text-[10px] text-gray-500">Data fim</label>
                <input
                  type="date"
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  min={dataInicio}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            {dataFim && duracao !== 'custom' && (
              <p className="text-[11px] text-gray-500 mt-1">
                Período: <b>{dataInicio}</b> até <b>{dataFim}</b>
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
                Lutadoras participantes *
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  selectedBranches.size === 0
                    ? 'bg-gray-100 text-gray-500'
                    : selectedBranches.size < 2
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedBranches.size} / {VAREJO_BRANCHES.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedBranches(new Set(VAREJO_BRANCHES.map((b) => b.code)))
                  }
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Todas
                </button>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedBranches(new Set())}
                  className="text-[11px] text-gray-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Grid de cards de lojas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1">
              {VAREJO_BRANCHES.map((b, idx) => {
                const selected = selectedBranches.has(b.code);
                const cornerIdx = [...selectedBranches]
                  .sort()
                  .indexOf(b.code);
                const cor = cornerIdx >= 0
                  ? RING_CORNER_COLORS[cornerIdx % RING_CORNER_COLORS.length]
                  : null;
                const Icon = b.type === 'shopping' ? Buildings : Storefront;
                return (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => toggleBranch(b.code)}
                    className={`group relative text-left rounded-lg overflow-hidden transition-all duration-150 ${
                      selected
                        ? `bg-gradient-to-br ${cor.bg} text-white shadow-lg scale-[1.02] ring-2 ring-offset-1 ${cor.ring}`
                        : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md text-gray-700'
                    }`}
                  >
                    <div className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          selected
                            ? 'bg-white/30 backdrop-blur'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Icon
                            size={14}
                            weight={selected ? 'fill' : 'regular'}
                          />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[9px] font-mono ${selected ? 'opacity-80' : 'text-gray-400'}`}>
                            #{b.code}
                          </span>
                          {selected && (
                            <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                              <Check size={10} weight="bold" className={cor.bg.includes('red') ? 'text-red-600' : cor.bg.includes('blue') ? 'text-blue-600' : cor.bg.includes('green') ? 'text-green-600' : 'text-gray-700'} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`text-xs font-bold leading-tight ${selected ? '' : 'text-gray-800'}`}>
                        {b.short}
                      </div>
                      <div className={`text-[10px] mt-0.5 inline-flex items-center gap-0.5 ${
                        selected ? 'opacity-80' : 'text-gray-400'
                      }`}>
                        <MapPin size={9} weight="bold" />
                        {b.uf} · {b.type === 'shopping' ? 'Shopping' : 'Rua'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBranches.size > 0 && selectedBranches.size < 2 && (
              <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1">
                ⚠ Selecione ao menos 2 lojas pra criar a competição
              </p>
            )}
            {selectedBranches.size >= 2 && (
              <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
                ✓ {selectedBranches.size} lutadoras prontas pro ring
              </p>
            )}
          </div>

          {err && (
            <div className="bg-rose-50 border border-rose-200 rounded p-2 text-sm text-rose-700">
              {err}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 px-3 rounded bg-red-600 text-white text-sm font-bold hover:bg-red-700 inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Spinner size={12} className="animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <HandFist size={12} weight="bold" />
                  Criar competição
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
