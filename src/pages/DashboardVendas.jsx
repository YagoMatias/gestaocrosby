// Dashboard Vendas Crosby — réplica do dash do Data Studio (tema dark).
// Lê de faturamento_diario_canal via /api/faturamento-historico/dashboard
import React, { useEffect, useState, useCallback } from 'react';
import {
  ChartPieSlice,
  CalendarBlank,
  ArrowsClockwise,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import useFreshFetch from '../hooks/useFreshFetch';

const CANAIS = {
  varejo:         { label: 'VAREJO',         color: '#3b82f6' },
  revenda:        { label: 'REVENDEDOR',     color: '#22c55e' },
  multimarcas:    { label: 'MULTIMARCA',     color: '#a855f7' },
  inbound_david:  { label: 'MTM DAVID',      color: '#ec4899' },
  inbound_rafael: { label: 'MTM RAFAEL',     color: '#d946ef' },
  franquia:       { label: 'FRANQUIA',       color: '#f59e0b' },
  bazar:          { label: 'BAZAR',          color: '#f97316' },
  fabrica:        { label: 'FÁBRICA',        color: '#06b6d4' },
  business:       { label: 'BUSINESS',       color: '#64748b' },
  ricardoeletro:  { label: 'RICARDO ELETRO', color: '#ef4444' },
  bluecard:       { label: 'BLUECARD',       color: '#0ea5e9' },
};

const fmtBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => Number(n || 0).toFixed(2) + '%';

// Datas padrão: 2024-01-01 → hoje
const hoje = new Date();
const hojeIso = hoje.toISOString().slice(0, 10);

// Atalhos de período
const ATALHOS = [
  { label: 'Hoje', calc: () => [hojeIso, hojeIso] },
  { label: 'Ontem', calc: () => {
    const d = new Date(hoje); d.setUTCDate(d.getUTCDate() - 1);
    const iso = d.toISOString().slice(0, 10);
    return [iso, iso];
  }},
  { label: 'Últimos 7 dias', calc: () => {
    const d = new Date(hoje); d.setUTCDate(d.getUTCDate() - 7);
    return [d.toISOString().slice(0, 10), hojeIso];
  }},
  { label: 'Este mês', calc: () => {
    const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    return [ini.toISOString().slice(0, 10), hojeIso];
  }},
  { label: 'Mês passado', calc: () => {
    const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
    const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0));
    return [ini.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)];
  }},
  { label: 'Este ano', calc: () => [`${hoje.getUTCFullYear()}-01-01`, hojeIso] },
  { label: 'Ano passado', calc: () => {
    const a = hoje.getUTCFullYear() - 1;
    return [`${a}-01-01`, `${a}-12-31`];
  }},
  { label: '2024', calc: () => ['2024-01-01', '2024-12-31'] },
  { label: '2025', calc: () => ['2025-01-01', '2025-12-31'] },
  { label: '2026', calc: () => [`2026-01-01`, hojeIso] },
  { label: 'Todo histórico', calc: () => ['2024-01-01', hojeIso] },
];

// ─── Pie chart SVG ───────────────────────────────────────────────────────────
function PieDonut({ items, total, canalAtivo, onToggle }) {
  if (!items.length) return null;
  const cx = 120, cy = 120, r = 95, ir = 55;
  let cum = -Math.PI / 2;

  const arcs = items.map((it) => {
    const angle = (it.percentual / 100) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cum);
    const y1 = cy + r * Math.sin(cum);
    const x2 = cx + r * Math.cos(cum + angle);
    const y2 = cy + r * Math.sin(cum + angle);
    const xi1 = cx + ir * Math.cos(cum);
    const yi1 = cy + ir * Math.sin(cum);
    const xi2 = cx + ir * Math.cos(cum + angle);
    const yi2 = cy + ir * Math.sin(cum + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path =
      `M ${x1} ${y1} ` +
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} ` +
      `L ${xi2} ${yi2} ` +
      `A ${ir} ${ir} 0 ${largeArc} 0 ${xi1} ${yi1} Z`;
    const cfg = CANAIS[it.canal] || { color: '#9ca3af', label: it.canal.toUpperCase() };
    cum += angle;
    return { path, color: cfg.color, label: cfg.label, percentual: it.percentual, valor: it.valor, canal: it.canal };
  });

  return (
    <div className="flex items-center justify-center gap-8 flex-wrap">
      <svg width="240" height="240" viewBox="0 0 240 240">
        {arcs.map((a, i) => {
          const ativo = canalAtivo === a.canal;
          const opacity = !canalAtivo || ativo ? 1 : 0.25;
          return (
            <path
              key={i}
              d={a.path}
              fill={a.color}
              stroke={ativo ? '#fff' : '#0f172a'}
              strokeWidth={ativo ? 2.5 : 1.5}
              opacity={opacity}
              className="cursor-pointer transition-opacity"
              onClick={() => onToggle?.(a.canal)}
            >
              <title>{a.label} · R$ {fmtBRL(a.valor)} · {a.percentual.toFixed(1)}%</title>
            </path>
          );
        })}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          className="fill-slate-300"
          style={{ fontSize: 11, fontWeight: 600 }}
        >
          TOTAL
        </text>
        <text
          x={cx} y={cy + 16}
          textAnchor="middle"
          className="fill-white"
          style={{ fontSize: 16, fontWeight: 800 }}
        >
          {total >= 1_000_000 ? `R$ ${(total/1_000_000).toFixed(1)}M` : `R$ ${(total/1000).toFixed(0)}k`}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-[160px]">
        {arcs.map((a, i) => {
          const ativo = canalAtivo === a.canal;
          const dim = canalAtivo && !ativo;
          return (
            <button
              type="button"
              key={i}
              onClick={() => onToggle?.(a.canal)}
              className={`flex items-center gap-2 text-xs px-1.5 py-1 rounded transition ${
                ativo ? 'bg-slate-700/60 ring-1 ring-emerald-500/40' : 'hover:bg-slate-800/60'
              } ${dim ? 'opacity-40' : ''}`}
            >
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
              <span className="text-slate-300 flex-1 truncate text-left">{a.label}</span>
              <span className="text-white font-bold tabular-nums">{a.percentual.toFixed(1)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tabela canais (com % e barra de gradient) ───────────────────────────────
function TabelaCanais({ items, canalAtivo, onToggle }) {
  const max = Math.max(...items.map((i) => i.percentual), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">#</th>
            <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ds. Tipo Cliente</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">%</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={4} className="py-8 text-center text-slate-500 text-xs">Sem dados</td></tr>
          ) : items.map((it, idx) => {
            const cfg = CANAIS[it.canal] || { label: it.canal.toUpperCase(), color: '#9ca3af' };
            const barPct = (it.percentual / max) * 100;
            const ativo = canalAtivo === it.canal;
            const dim = canalAtivo && !ativo;
            return (
              <tr
                key={it.canal}
                onClick={() => onToggle?.(it.canal)}
                className={`border-b border-slate-800/50 cursor-pointer transition ${
                  ativo ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'hover:bg-slate-800/50'
                } ${dim ? 'opacity-40' : ''}`}
              >
                <td className="py-2 px-2 text-slate-400 text-xs tabular-nums">{idx + 1}.</td>
                <td className="py-2 px-2 text-white font-semibold text-xs">{cfg.label}</td>
                <td className="py-2 px-2 text-right relative">
                  <div
                    className="absolute inset-y-1 right-0 rounded opacity-30"
                    style={{ width: `${barPct}%`, backgroundColor: cfg.color }}
                  />
                  <span className="relative text-white tabular-nums font-mono">{fmtBRL(it.valor)}</span>
                </td>
                <td className="py-2 px-2 text-right">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums"
                    style={{ backgroundColor: cfg.color + '40', color: cfg.color }}
                  >
                    {fmtPct(it.percentual)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Mini-tabela compacta ────────────────────────────────────────────────────
function MiniTabela({ items, canalAtivo, onToggle }) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-1.5 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Ds. Tipo Cliente</th>
            <th className="text-right py-1.5 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Total</th>
            <th className="text-right py-1.5 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">%</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={3} className="py-6 text-center text-slate-500">Sem dados</td></tr>
          ) : items.map((it) => {
            const cfg = CANAIS[it.canal] || { label: it.canal.toUpperCase(), color: '#9ca3af' };
            const ativo = canalAtivo === it.canal;
            const dim = canalAtivo && !ativo;
            return (
              <tr
                key={it.canal}
                onClick={() => onToggle?.(it.canal)}
                className={`border-b border-slate-800/50 cursor-pointer transition ${
                  ativo ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'hover:bg-slate-800/50'
                } ${dim ? 'opacity-40' : ''}`}
              >
                <td className="py-1.5 px-2 text-white font-medium">{cfg.label}</td>
                <td className="py-1.5 px-2 text-right text-white tabular-nums font-mono">{fmtBRL(it.valor)}</td>
                <td className="py-1.5 px-2 text-right">
                  <span style={{ color: cfg.color }} className="font-bold tabular-nums">{fmtPct(it.percentual)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function DashboardVendas() {
  // Default: ESTE MÊS (1º dia do mês corrente → hoje)
  const inicioMesIso = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
    .toISOString().slice(0, 10);
  const [datemin, setDatemin] = useState(inicioMesIso);
  const [datemax, setDatemax] = useState(hojeIso);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  // Filtro interativo: clicar em pizza/ranking/mini-cards filtra os KPIs e
  // destaca os outros componentes pelo canal selecionado.
  const [canalAtivo, setCanalAtivo] = useState(null);
  const toggleCanal = useCallback((c) => {
    setCanalAtivo((cur) => (cur === c ? null : c));
  }, []);
  const { run, isStale } = useFreshFetch();

  const carregar = useCallback(async () => {
    const tok = run();
    setLoading(true);
    setErro('');
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/faturamento-historico/dashboard?datemin=${datemin}&datemax=${datemax}`,
      );
      // Lê body como text antes pra evitar "Unexpected end of JSON input" se vier vazio
      const txt = await r.text();
      if (isStale(tok)) return;
      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try { msg = JSON.parse(txt)?.error || msg; } catch (_) {}
        throw new Error(msg);
      }
      if (!txt || txt.trim() === '') {
        throw new Error('Servidor retornou resposta vazia. Tente reduzir o período.');
      }
      let j;
      try { j = JSON.parse(txt); }
      catch (_) { throw new Error('Resposta inválida do servidor (não-JSON).'); }
      setData(j);
    } catch (e) {
      if (isStale(tok)) return;
      setErro(e.message);
    } finally {
      if (!isStale(tok)) setLoading(false);
    }
  }, [datemin, datemax, run, isStale]);

  useEffect(() => { carregar(); }, [carregar]);

  const aplicarAtalho = (a) => {
    const [d1, d2] = a.calc();
    setDatemin(d1);
    setDatemax(d2);
  };

  // KPIs visíveis: quando há canal ativo, mostra apenas valor desse canal
  const canalSelecionado = canalAtivo
    ? (data?.por_canal || []).find((c) => c.canal === canalAtivo)
    : null;
  const kpisVisiveis = canalSelecionado
    ? {
        vl_fat: canalSelecionado.valor_bruto || (canalSelecionado.valor + (canalSelecionado.credev || 0)),
        credev: canalSelecionado.credev || 0,
        total: canalSelecionado.valor,
      }
    : data?.kpis || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-[1700px] mx-auto">

        {/* ── Header (faixa superior estilo print) ── */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
              <CurrencyDollar size={26} weight="duotone" className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
                DASHBOARD VENDAS CROSBY
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Grupo empresa por VL.FAT.</p>
            </div>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium disabled:opacity-50"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* ── Filtro de período ── */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3 mb-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Seletor de range compacto */}
            <div className="flex items-center gap-2 bg-slate-800/60 ring-1 ring-slate-700 rounded-lg px-3 py-1.5">
              <CalendarBlank size={16} className="text-emerald-400 shrink-0" weight="duotone" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1">Período</span>
              <input
                type="date"
                value={datemin}
                onChange={(e) => setDatemin(e.target.value)}
                className="text-sm bg-transparent text-white font-semibold tabular-nums focus:outline-none w-[120px] [color-scheme:dark]"
                title="Data inicial"
              />
              <span className="text-slate-600 font-bold">—</span>
              <input
                type="date"
                value={datemax}
                onChange={(e) => setDatemax(e.target.value)}
                className="text-sm bg-transparent text-white font-semibold tabular-nums focus:outline-none w-[120px] [color-scheme:dark]"
                title="Data final"
              />
            </div>

            {/* Badge mostrando duração */}
            {datemin && datemax && (
              <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                {(() => {
                  const d1 = new Date(datemin);
                  const d2 = new Date(datemax);
                  const dias = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
                  if (dias <= 31) return `${dias} dia${dias > 1 ? 's' : ''}`;
                  const meses = Math.round(dias / 30);
                  if (meses < 12) return `${meses} mês${meses > 1 ? 'es' : ''}`;
                  return `${(dias / 365).toFixed(1)} anos`;
                })()}
              </span>
            )}

            {/* Atalhos rápidos */}
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {ATALHOS.map((a) => {
                const [d1, d2] = a.calc();
                const ativo = datemin === d1 && datemax === d2;
                return (
                  <button
                    key={a.label}
                    onClick={() => aplicarAtalho(a)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-md font-semibold transition-all ${
                      ativo
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : 'bg-slate-800/60 ring-1 ring-slate-700 text-slate-300 hover:ring-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300'
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {erro && (
          <div className="bg-rose-950 border border-rose-800 text-rose-300 rounded p-3 mb-3 text-sm">
            Erro: {erro}
          </div>
        )}

        {/* ── Grid principal ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-3 mb-3">

          {/* KPIs lateral esquerda */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 flex flex-col gap-4">
            {canalAtivo && (
              <button
                onClick={() => setCanalAtivo(null)}
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center justify-between"
                title="Clique pra limpar o filtro"
              >
                <span>Filtrado: {(CANAIS[canalAtivo] || {}).label || canalAtivo}</span>
                <span className="ml-2">×</span>
              </button>
            )}
            <KpiBox label="VL.FAT." valor={kpisVisiveis.vl_fat} color="text-white" />
            <KpiBox label="CREDEV"  valor={kpisVisiveis.credev}  color="text-rose-400" />
            <div className="border-t border-slate-800 pt-3">
              <KpiBox label="Total" valor={kpisVisiveis.total} color="text-emerald-400" big />
            </div>
          </div>

          {/* Pizza */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ChartPieSlice size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-200">Distribuição por canal</h3>
              <span className="text-[10px] text-slate-500 ml-auto">Clique pra filtrar</span>
            </div>
            {data?.por_canal?.length
              ? <PieDonut items={data.por_canal} total={data.kpis?.total || 0} canalAtivo={canalAtivo} onToggle={toggleCanal} />
              : <div className="py-12 text-center text-slate-500 text-sm">Sem dados no período</div>}
          </div>

          {/* Tabela canais */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-4 bg-emerald-400 rounded" />
              <h3 className="text-sm font-bold text-slate-200">Ranking por canal</h3>
              <span className="text-[10px] text-slate-500 ml-auto">Clique pra filtrar</span>
            </div>
            <TabelaCanais items={data?.por_canal || []} canalAtivo={canalAtivo} onToggle={toggleCanal} />
          </div>
        </div>

        {/* ── Mini-tabelas: Este Mês / 7 dias / Ontem ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MiniCard titulo="Este Mês"        items={data?.este_mes || []}   canalAtivo={canalAtivo} onToggle={toggleCanal} />
          <MiniCard titulo="Últimos 7 Dias"  items={data?.ultimos_7 || []}  canalAtivo={canalAtivo} onToggle={toggleCanal} />
          <MiniCard titulo="Ontem"           items={data?.ontem || []}      canalAtivo={canalAtivo} onToggle={toggleCanal} />
        </div>

      </div>
    </div>
  );
}

function KpiBox({ label, valor, color = 'text-white', big = false }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</div>
      <div className={`tabular-nums font-black mt-0.5 ${big ? 'text-3xl' : 'text-2xl'} ${color}`}>
        {valor != null ? fmtBRL(valor) : '—'}
      </div>
    </div>
  );
}

function MiniCard({ titulo, items, canalAtivo, onToggle }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <h4 className="text-sm font-bold text-slate-200 mb-2 text-center">{titulo}</h4>
      <MiniTabela items={items} canalAtivo={canalAtivo} onToggle={onToggle} />
    </div>
  );
}
