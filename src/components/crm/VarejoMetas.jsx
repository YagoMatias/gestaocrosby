// Sub-aba "Metas" — padrão visual da página Ranking de Faturamento
// Cor primária #000638, font-barlow, cards rounded-xl shadow-md
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Target,
  Medal,
  Trophy,
  Diamond,
  ArrowsClockwise,
  Spinner,
  Storefront,
  Buildings,
  Info,
  Funnel,
  ChartBar,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

function formatBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function formatBRLCompact(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
  return `R$ ${formatBRL(n)}`;
}

// Cores das medalhas mantendo padrão Crosby
const MEDAL = {
  diamante: {
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    pill: 'bg-cyan-600 text-white',
    icon: Diamond,
    emoji: '💎',
    label: 'DIAMANTE',
    rank: 4,
    textColor: 'text-cyan-700',
    bgCard: 'bg-cyan-50',
    borderCard: 'border-cyan-200',
  },
  ouro: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    pill: 'bg-yellow-500 text-white',
    icon: Trophy,
    emoji: '🥇',
    label: 'OURO',
    rank: 3,
    textColor: 'text-yellow-700',
    bgCard: 'bg-yellow-50',
    borderCard: 'border-yellow-200',
  },
  prata: {
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    pill: 'bg-slate-500 text-white',
    icon: Medal,
    emoji: '🥈',
    label: 'PRATA',
    rank: 2,
    textColor: 'text-slate-700',
    bgCard: 'bg-slate-50',
    borderCard: 'border-slate-200',
  },
  bronze: {
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    pill: 'bg-amber-600 text-white',
    icon: Medal,
    emoji: '🥉',
    label: 'BRONZE',
    rank: 1,
    textColor: 'text-amber-700',
    bgCard: 'bg-amber-50',
    borderCard: 'border-amber-200',
  },
};

const NIVEIS = ['diamante', 'ouro', 'prata', 'bronze'];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function VarejoMetas() {
  const [mes, setMes] = useState(currentMonthKey());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [filtroNivel, setFiltroNivel] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/crm/varejo/metas-reuniao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ mes }),
      });
      const j = await res.json();
      if (!res.ok || j?.success === false) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      setData(j.data ?? j);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const lojas = data?.lojas || [];
  const totais = data?.totais || {};
  const dist = data?.distribuicao || {};

  const lojasFiltradas = useMemo(() => {
    if (filtroNivel === 'all') return lojas;
    if (filtroNivel === 'sem_meta') return lojas.filter((l) => !l.tem_meta);
    if (filtroNivel === 'nao_atingiu')
      return lojas.filter((l) => l.tem_meta && !l.nivel_alcancado);
    return lojas.filter((l) => l.nivel_alcancado === filtroNivel);
  }, [lojas, filtroNivel]);

  const pctTotalDiamante = useMemo(() => {
    if (!totais.metas || totais.metas.diamante === 0) return null;
    return (totais.faturamento / totais.metas.diamante) * 100;
  }, [totais]);

  const mesesOpcoes = useMemo(() => {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
      out.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  const nomeMes = useMemo(() => {
    const [a, m] = mes.split('-');
    const dt = new Date(Number(a), Number(m) - 1, 1);
    const label = dt.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [mes]);

  return (
    <div className="font-barlow space-y-4">
      {/* ───────── HEADER + Filtros ───────── */}
      <div className="flex flex-col bg-white p-3 sm:p-4 rounded-xl shadow-md w-full mx-auto border border-[#000638]/10">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <span className="text-sm sm:text-base font-bold text-[#000638] flex items-center gap-1.5 mb-0.5">
              <Target size={16} weight="bold" />
              Metas vs Realizado
            </span>
            <span className="text-xs text-gray-500">
              Faturamento de cada loja comparado às metas Bronze / Prata / Ouro /
              Diamante cadastradas em <b>Metas Varejo</b>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Mês de referência
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            >
              {mesesOpcoes.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1 flex items-end text-[11px] text-gray-500">
            {data?.periodo && (
              <span>
                Apurado:{' '}
                <b className="text-[#000638]">
                  {data.periodo.datemin} → {data.periodo.datemax}
                </b>
              </span>
            )}
          </div>
          <div className="flex items-end">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 transition-colors text-xs font-bold shadow-md tracking-wide uppercase w-full sm:w-auto"
            >
              {loading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={14} weight="bold" />
              )}
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* ───────── Erro ───────── */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs sm:text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* ───────── Loading ───────── */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Spinner size={36} className="animate-spin mb-3" />
          <p className="text-sm font-medium">Calculando metas...</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ───────── Cards de resumo (4 medalhas + total) ───────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {/* Card 1: Faturamento total */}
            <div className="rounded-xl bg-white shadow-md border border-[#000638]/10 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
              <div className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar
                    size={14}
                    weight="bold"
                    className="text-green-600"
                  />
                  <span className="text-[10px] sm:text-xs font-bold text-green-700">
                    Faturamento {nomeMes}
                  </span>
                </div>
              </div>
              <div className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-green-600 break-words">
                  R$ {formatBRL(totais.faturamento || 0)}
                </div>
                <div className="text-[10px] text-gray-500 hidden sm:block">
                  {lojas.length} lojas
                </div>
              </div>
            </div>

            {/* Cards 2-5: Medalhas */}
            {NIVEIS.map((nivel) => {
              const style = MEDAL[nivel];
              const Icon = style.icon;
              const n = dist[nivel] || 0;
              const active = filtroNivel === nivel;
              return (
                <button
                  key={nivel}
                  onClick={() => setFiltroNivel(active ? 'all' : nivel)}
                  className={`text-left rounded-xl bg-white shadow-md border transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${
                    active
                      ? 'border-[#000638] ring-2 ring-[#000638]'
                      : 'border-[#000638]/10'
                  }`}
                >
                  <div className="pb-1 pt-2.5 px-2.5 sm:px-3">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        size={14}
                        weight="bold"
                        className={style.textColor}
                      />
                      <span
                        className={`text-[10px] sm:text-xs font-bold ${style.textColor}`}
                      >
                        {style.emoji} {style.label}
                      </span>
                    </div>
                  </div>
                  <div className="pt-0 px-2.5 sm:px-3 pb-2.5">
                    <div
                      className={`text-sm sm:text-base font-extrabold break-words ${style.textColor}`}
                    >
                      {n} {n === 1 ? 'loja' : 'lojas'}
                    </div>
                    <div className="text-[10px] text-gray-500 hidden sm:block">
                      Meta total: {formatBRLCompact(totais.metas?.[nivel] || 0)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ───────── Barra de progresso coletivo ───────── */}
          {pctTotalDiamante != null && (
            <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <span className="text-xs font-bold text-[#000638] flex items-center gap-1.5">
                  <ChartBar size={14} weight="bold" />
                  Progresso coletivo até 💎 Diamante
                </span>
                <span className="text-sm font-extrabold text-[#000638]">
                  {pctTotalDiamante.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden border border-[#000638]/10">
                {/* marcadores dos níveis */}
                {[
                  { key: 'bronze', valor: totais.metas?.bronze },
                  { key: 'prata', valor: totais.metas?.prata },
                  { key: 'ouro', valor: totais.metas?.ouro },
                ].map((m) => {
                  if (!m.valor || !totais.metas?.diamante) return null;
                  const pos = (m.valor / totais.metas.diamante) * 100;
                  return (
                    <div
                      key={m.key}
                      className="absolute top-0 bottom-0 w-px bg-[#000638]/40"
                      style={{ left: `${pos}%` }}
                      title={`${MEDAL[m.key].label}: R$ ${formatBRL(m.valor)}`}
                    >
                      <span className="absolute -top-0.5 -translate-x-1/2 text-[9px]">
                        {MEDAL[m.key].emoji}
                      </span>
                    </div>
                  );
                })}
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, pctTotalDiamante)}%` }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs">
                  💎
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>R$ 0</span>
                <span>R$ {formatBRL(totais.metas?.diamante || 0)}</span>
              </div>
            </div>
          )}

          {/* ───────── Filtros de status ───────── */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#000638] flex items-center gap-1">
              <Funnel size={12} weight="bold" />
              Filtrar:
            </span>
            {[
              { key: 'all', label: `Todas (${lojas.length})` },
              {
                key: 'nao_atingiu',
                label: `⚠ Não atingiram (${dist.nao_atingiu || 0})`,
              },
              {
                key: 'sem_meta',
                label: `Sem meta (${dist.sem_meta || 0})`,
              },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltroNivel(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-150 ${
                  filtroNivel === f.key
                    ? 'bg-[#000638] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
            {filtroNivel !== 'all' && (
              <button
                onClick={() => setFiltroNivel('all')}
                className="text-[11px] text-[#fe0000] hover:underline ml-1"
              >
                limpar filtro
              </button>
            )}
          </div>

          {/* ───────── Tabela ───────── */}
          <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 w-full overflow-hidden">
            {/* Header da tabela */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#000638]/10 flex items-center gap-2">
              <Target size={16} weight="bold" className="text-[#000638]" />
              <h2 className="text-xs sm:text-sm font-bold text-[#000638]">
                Por Loja
              </h2>
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400">
                {lojasFiltradas.length} de {lojas.length}
              </span>
            </div>

            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-[#000638] text-white text-[10px] font-bold uppercase tracking-wider">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-3">Loja</div>
              <div className="col-span-2 text-right">Faturamento</div>
              <div className="col-span-1 text-right">🥉 Bronze</div>
              <div className="col-span-1 text-right">🥈 Prata</div>
              <div className="col-span-1 text-right">🥇 Ouro</div>
              <div className="col-span-1 text-right">💎 Diamante</div>
              <div className="col-span-2 text-center">Nível / Progresso</div>
            </div>

            {/* Rows */}
            {lojasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Info size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhuma loja nesse filtro</p>
              </div>
            ) : (
              lojasFiltradas.map((l, idx) => (
                <LojaRow key={l.store_id} loja={l} index={idx} />
              ))
            )}
          </div>

          {dist.sem_meta > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
              <Info
                size={14}
                weight="bold"
                className="flex-shrink-0 mt-0.5 text-blue-600"
              />
              <div>
                <b>{dist.sem_meta} loja(s) sem meta</b> em {nomeMes}. Cadastre em{' '}
                <a
                  href="/metas-varejo"
                  className="underline font-bold hover:text-[#000638]"
                >
                  Metas Varejo
                </a>
                .
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !data && !erro && (
        <div className="text-center py-16 text-gray-400">
          <Target size={48} weight="light" className="mx-auto mb-3 opacity-30" />
          <p className="text-xs sm:text-sm font-medium">
            Selecione um mês e clique em Atualizar.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Linha da tabela (uma loja) ────────────────────────────────────────
function LojaRow({ loja, index }) {
  const Icon = loja.type === 'shopping' ? Buildings : Storefront;
  const nivelStyle = loja.nivel_alcancado ? MEDAL[loja.nivel_alcancado] : null;
  const fat = loja.faturamento || 0;
  const metas = loja.metas;
  const escalaMax = Math.max(metas.diamante || 1, fat, 1);
  const posFat = Math.min(100, (fat / escalaMax) * 100);

  const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

  const niveis = [
    { key: 'bronze', valor: metas.bronze, batida: fat >= metas.bronze && metas.bronze > 0 },
    { key: 'prata', valor: metas.prata, batida: fat >= metas.prata && metas.prata > 0 },
    { key: 'ouro', valor: metas.ouro, batida: fat >= metas.ouro && metas.ouro > 0 },
    {
      key: 'diamante',
      valor: metas.diamante,
      batida: fat >= metas.diamante && metas.diamante > 0,
    },
  ];

  // Badge da posição (1, 2, 3 destacados; demais cinza)
  const positionBadge = (() => {
    const cores = [
      'bg-yellow-400 text-yellow-900',
      'bg-gray-300 text-gray-700',
      'bg-amber-600 text-white',
    ];
    const cor = cores[index] || 'bg-gray-100 text-gray-500';
    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold ${cor}`}
      >
        {index + 1}
      </span>
    );
  })();

  return (
    <div
      className={`w-full transition-all duration-150 border-b border-gray-100 last:border-b-0 ${rowBg}`}
    >
      {/* Mobile */}
      <div className="md:hidden p-3 flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5">{positionBadge}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon size={12} className="text-gray-500 flex-shrink-0" />
            <p
              className={`text-xs font-semibold truncate ${
                index < 3 ? 'text-[#000638]' : 'text-gray-700'
              }`}
            >
              {loja.shortName}
            </p>
            {nivelStyle && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${nivelStyle.pill}`}
              >
                {nivelStyle.emoji} {nivelStyle.label}
              </span>
            )}
            {loja.tem_meta && !nivelStyle && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                ⚠
              </span>
            )}
          </div>
          <p className="text-sm font-bold font-mono text-green-700 mt-0.5">
            R$ {formatBRL(fat)}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-500">
            {niveis.map((n) => (
              <span key={n.key} className={n.batida ? 'text-emerald-700 font-bold' : ''}>
                {MEDAL[n.key].emoji}{' '}
                <strong>{n.valor > 0 ? formatBRLCompact(n.valor) : '—'}</strong>
                {n.batida && ' ✓'}
              </span>
            ))}
          </div>
          {/* Barra mobile */}
          {loja.tem_meta && (
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className={`h-full ${
                  nivelStyle
                    ? 'bg-gradient-to-r from-amber-500 to-cyan-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${Math.max(2, posFat)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
        <div className="col-span-1 text-center">{positionBadge}</div>

        <div className="col-span-3 flex items-center gap-2 min-w-0">
          <Icon size={14} className="text-gray-500 flex-shrink-0" />
          <div className="min-w-0">
            <div
              className={`font-semibold truncate text-xs ${
                index < 3 ? 'text-[#000638]' : 'text-gray-700'
              }`}
            >
              {loja.shortName}
            </div>
            <div className="text-[10px] text-gray-400">
              #{loja.store_id} · {loja.uf} ·{' '}
              {loja.type === 'shopping' ? 'Shopping' : 'Rua'}
            </div>
          </div>
        </div>

        <div className="col-span-2 text-right">
          <span className="font-bold font-mono text-xs text-green-700">
            R$ {formatBRL(fat)}
          </span>
          {loja.invoice_qty > 0 && (
            <div className="text-[10px] text-gray-400 font-mono">
              {loja.invoice_qty} NFs
            </div>
          )}
        </div>

        {niveis.map((n) => (
          <div
            key={n.key}
            className={`col-span-1 text-right text-xs font-mono ${
              n.valor === 0
                ? 'text-gray-300'
                : n.batida
                  ? 'text-emerald-700 font-bold'
                  : 'text-gray-500'
            }`}
          >
            {n.valor === 0 ? '—' : (
              <>
                {n.batida && '✓ '}
                {formatBRLCompact(n.valor)}
              </>
            )}
          </div>
        ))}

        {/* Nível + progresso */}
        <div className="col-span-2 flex flex-col items-end gap-1">
          {!loja.tem_meta ? (
            <span className="text-[10px] text-gray-400 italic">sem meta</span>
          ) : nivelStyle ? (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${nivelStyle.pill}`}
            >
              {nivelStyle.emoji} {nivelStyle.label}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
              ⚠ não atingiu
            </span>
          )}
          {loja.tem_meta && (
            <div className="relative w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              {/* Marcadores dos níveis */}
              {niveis
                .filter((n) => n.valor > 0 && n.valor < escalaMax)
                .map((n) => {
                  const pos = (n.valor / escalaMax) * 100;
                  return (
                    <div
                      key={n.key}
                      className="absolute top-0 bottom-0 w-px bg-[#000638]/30"
                      style={{ left: `${pos}%` }}
                    />
                  );
                })}
              <div
                className={`h-full transition-all duration-700 ${
                  nivelStyle
                    ? 'bg-gradient-to-r from-amber-500 to-cyan-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${Math.max(2, posFat)}%` }}
              />
            </div>
          )}
          {loja.proximo_nivel && (
            <div className="text-[9px] text-gray-500">
              faltam{' '}
              <b className="text-[#000638]">
                {formatBRLCompact(loja.proximo_nivel.falta)}
              </b>{' '}
              p/ {MEDAL[loja.proximo_nivel.nivel]?.emoji}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
