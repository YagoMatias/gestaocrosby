// Sub-aba "Crescimento" — compara faturamento varejo período atual vs ano anterior.
// Lojas que mudaram de branch_code (eram franquias 6xxx) somam ambos os códigos
// no período anterior pra ter base de comparação correta.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  TrendUp,
  TrendDown,
  ArrowsClockwise,
  Spinner,
  CalendarBlank,
  Storefront,
  Buildings,
  Sparkle,
  Info,
} from 'phosphor-react';
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

// Defaults: este mês até hoje vs mesmo intervalo no ano anterior
function defaultRange() {
  const hoje = new Date();
  const firstDay = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    datemin: firstDay.toISOString().split('T')[0],
    datemax: hoje.toISOString().split('T')[0],
  };
}

const ATALHOS = [
  {
    label: 'Este mês',
    fn: () => defaultRange(),
  },
  {
    label: 'Mês passado',
    fn: () => {
      const h = new Date();
      return {
        datemin: new Date(h.getFullYear(), h.getMonth() - 1, 1)
          .toISOString()
          .split('T')[0],
        datemax: new Date(h.getFullYear(), h.getMonth(), 0)
          .toISOString()
          .split('T')[0],
      };
    },
  },
  {
    label: 'Últimos 30 dias',
    fn: () => {
      const h = new Date();
      const ini = new Date(h);
      ini.setDate(h.getDate() - 29);
      return {
        datemin: ini.toISOString().split('T')[0],
        datemax: h.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'Este ano',
    fn: () => {
      const h = new Date();
      return {
        datemin: `${h.getFullYear()}-01-01`,
        datemax: h.toISOString().split('T')[0],
      };
    },
  },
];

export default function VarejoCrescimento() {
  const [range, setRange] = useState(defaultRange());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/crm/varejo/crescimento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify(range),
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
  }, [range]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lojas = data?.lojas || [];
  const totais = data?.totais || {};
  const maxFat = useMemo(() => {
    if (lojas.length === 0) return 1;
    return Math.max(
      1,
      ...lojas.map((l) =>
        Math.max(l.faturamento_atual || 0, l.faturamento_anterior || 0),
      ),
    );
  }, [lojas]);

  const formatPeriodLabel = (p) => {
    if (!p) return '';
    const [, m, d] = p.datemin.split('-');
    const [yy] = p.datemin.split('-');
    const [, m2, d2] = p.datemax.split('-');
    return `${d}/${m}/${yy} → ${d2}/${m2}`;
  };

  return (
    <div className="space-y-5">
      {/* Header + filtros */}
      <div>
        <h3 className="text-base font-bold text-[#000638] flex items-center gap-2 mb-1">
          <TrendUp size={18} weight="duotone" className="text-emerald-600" />
          Crescimento vs Ano Anterior
        </h3>
        <p className="text-xs text-gray-500">
          Compara faturamento de cada loja varejo no período selecionado com o
          mesmo intervalo do ano anterior. Lojas que mudaram de código (eram
          franquias 6xxx e viraram loja própria) somam ambos os códigos no
          comparativo.
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap bg-gray-50 border border-gray-200 rounded p-3">
          <CalendarBlank size={14} className="text-gray-500" />
          <input
            type="date"
            value={range.datemin}
            onChange={(e) => setRange({ ...range, datemin: e.target.value })}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={range.datemax}
            onChange={(e) => setRange({ ...range, datemax: e.target.value })}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          />
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1 disabled:opacity-50 ml-1"
          >
            {loading ? (
              <Spinner size={12} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={12} />
            )}
            Carregar
          </button>
          <span className="ml-2 text-[10px] text-gray-400">Atalhos:</span>
          {ATALHOS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setRange(a.fn())}
              className="text-[11px] px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-sm text-rose-700">
          ❌ {erro}
        </div>
      )}

      {loading && !data ? (
        <div className="text-center py-12 text-gray-400">
          <Spinner size={24} className="animate-spin inline mb-2" />
          <p className="text-sm">Comparando períodos...</p>
        </div>
      ) : data ? (
        <>
          {/* TOTAIS — 3 cards big */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              title="Atual"
              subtitle={formatPeriodLabel(data.periodo_atual)}
              valor={totais.atual}
              color="emerald"
            />
            <SummaryCard
              title="Ano anterior"
              subtitle={formatPeriodLabel(data.periodo_anterior)}
              valor={totais.anterior}
              color="gray"
            />
            <SummaryGrowthCard
              delta={totais.delta}
              pct={totais.crescimento_pct}
            />
          </div>

          {/* Tabela por loja */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-2">
              <span>Por loja ({lojas.length})</span>
              <span className="text-[10px] font-normal text-gray-400">
                ordenado por crescimento %
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-[11px] text-gray-500 uppercase tracking-wider">
                    <th className="py-2 px-3 text-left">Loja</th>
                    <th className="py-2 px-3 text-right">
                      Ant. ({data.periodo_anterior.datemin.slice(0, 4)})
                    </th>
                    <th className="py-2 px-3 text-right">
                      Atual ({data.periodo_atual.datemin.slice(0, 4)})
                    </th>
                    <th className="py-2 px-3 text-right">Δ R$</th>
                    <th className="py-2 px-3 text-right">Cresc. %</th>
                    <th className="py-2 px-3 w-48">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((l) => (
                    <LojaRow key={l.store_id} loja={l} maxFat={maxFat} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td className="py-2 px-3">TOTAL</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      R$ {formatBRL(totais.anterior)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      R$ {formatBRL(totais.atual)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right tabular-nums ${
                        totais.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {totais.delta >= 0 ? '+' : ''}
                      R$ {formatBRL(totais.delta)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right tabular-nums ${
                        totais.crescimento_pct == null
                          ? 'text-gray-400'
                          : totais.crescimento_pct >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                      }`}
                    >
                      {totais.crescimento_pct == null
                        ? '—'
                        : `${totais.crescimento_pct >= 0 ? '+' : ''}${totais.crescimento_pct.toFixed(1)}%`}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Lojas com migração */}
          {lojas.some((l) => l.teve_migracao) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              <Info size={14} weight="duotone" className="inline mr-1" />
              <b>Lojas com migração de código:</b> algumas filiais eram
              franquias em 2025 (códigos 6xxx) e viraram loja própria. Nessas, o
              "Ano anterior" soma o faturamento de ambos os códigos:
              <ul className="mt-2 space-y-0.5 pl-4">
                {lojas
                  .filter((l) => l.teve_migracao)
                  .map((l) => (
                    <li key={l.store_id} className="list-disc">
                      <b>{l.shortName}</b>: atual #{l.store_id} (
                      <span className="font-mono">{l.codes_atual.join(', ')}</span>)
                      ← legado{l.codes_legados.length > 1 ? 's' : ''}:{' '}
                      <span className="font-mono">
                        {l.codes_legados.join(', ')}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ─── Cards de resumo ───────────────────────────────────────────────────
function SummaryCard({ title, subtitle, valor, color = 'emerald' }) {
  const colorMap = {
    emerald: 'from-emerald-500 to-emerald-700 text-emerald-50',
    gray: 'from-gray-500 to-gray-700 text-gray-50',
  };
  return (
    <div
      className={`bg-gradient-to-br ${colorMap[color]} rounded-lg p-4 shadow-md`}
    >
      <p className="text-[11px] uppercase tracking-wider opacity-80 mb-0.5">
        {title}
      </p>
      <p className="text-[10px] opacity-70 mb-1">{subtitle}</p>
      <p className="text-2xl font-bold tabular-nums">R$ {formatBRL(valor || 0)}</p>
    </div>
  );
}

function SummaryGrowthCard({ delta, pct }) {
  const positive = (delta ?? 0) >= 0;
  const isFlat = pct == null;
  const colorBase = isFlat
    ? 'from-gray-500 to-gray-700'
    : positive
      ? 'from-emerald-500 to-emerald-700'
      : 'from-rose-500 to-rose-700';
  const Icon = positive ? TrendUp : TrendDown;
  return (
    <div
      className={`bg-gradient-to-br ${colorBase} text-white rounded-lg p-4 shadow-md relative overflow-hidden`}
    >
      <div className="absolute -right-6 -top-6 opacity-20">
        <Icon size={100} weight="duotone" />
      </div>
      <p className="text-[11px] uppercase tracking-wider opacity-80 mb-0.5">
        Crescimento
      </p>
      <p className="text-[10px] opacity-70 mb-1">vs ano anterior</p>
      <p className="text-2xl font-bold tabular-nums">
        {isFlat ? '—' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
      </p>
      <p className="text-xs opacity-90 mt-0.5">
        {positive ? '+' : ''}R$ {formatBRL(delta || 0)}
      </p>
    </div>
  );
}

// ─── Linha da tabela por loja ──────────────────────────────────────────
function LojaRow({ loja, maxFat }) {
  const positive = (loja.delta ?? 0) >= 0;
  const isNew = loja.faturamento_anterior === 0 && loja.faturamento_atual > 0;
  const isGone = loja.faturamento_atual === 0 && loja.faturamento_anterior > 0;
  const Icon = loja.type === 'shopping' ? Buildings : Storefront;

  const pctAtual = (loja.faturamento_atual / maxFat) * 100;
  const pctAnterior = (loja.faturamento_anterior / maxFat) * 100;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center ${
              loja.teve_migracao
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            title={loja.teve_migracao ? 'Loja com migração de código' : ''}
          >
            <Icon size={13} weight={loja.teve_migracao ? 'fill' : 'regular'} />
          </div>
          <div>
            <div className="font-semibold text-gray-800 text-sm flex items-center gap-1">
              {loja.shortName}
              {loja.teve_migracao && (
                <Sparkle size={10} weight="fill" className="text-amber-500" />
              )}
            </div>
            <div className="text-[10px] text-gray-400">
              #{loja.store_id} · {loja.uf} ·{' '}
              {loja.type === 'shopping' ? 'Shopping' : 'Rua'}
            </div>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
        {loja.faturamento_anterior > 0 ? (
          <>R$ {formatBRL(loja.faturamento_anterior)}</>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-800">
        {loja.faturamento_atual > 0 ? (
          <>R$ {formatBRL(loja.faturamento_atual)}</>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
      <td
        className={`py-2.5 px-3 text-right tabular-nums font-medium ${
          loja.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
        }`}
      >
        {loja.delta >= 0 ? '+' : ''}R$ {formatBRL(loja.delta)}
      </td>
      <td className="py-2.5 px-3 text-right">
        {isNew ? (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
            NOVO
          </span>
        ) : isGone ? (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600">
            SEM VENDA
          </span>
        ) : loja.crescimento_pct == null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
              loja.crescimento_pct >= 0
                ? loja.crescimento_pct >= 10
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-emerald-50 text-emerald-700'
                : loja.crescimento_pct <= -10
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-rose-50 text-rose-700'
            }`}
          >
            {loja.crescimento_pct >= 0 ? (
              <TrendUp size={10} weight="bold" />
            ) : (
              <TrendDown size={10} weight="bold" />
            )}
            {loja.crescimento_pct >= 0 ? '+' : ''}
            {loja.crescimento_pct.toFixed(1)}%
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 w-48">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <div className="w-12 text-[9px] text-gray-400">Ant.</div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-400"
                style={{ width: `${Math.max(2, pctAnterior)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-12 text-[9px] text-gray-400">Atual</div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  positive ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(2, pctAtual)}%` }}
              />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
