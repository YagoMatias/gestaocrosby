// Página: Tecnologia → Monitoramento TOTVS
// Mostra em tempo real o consumo de queries ao TOTVS para identificar:
//   - Picos de chamadas (risco de bloqueio do usuário API)
//   - Queries lentas (>5s — candidatas a otimização)
//   - Cache hit rate (saúde do cache server-side)
//   - Chamadas com expand=items (causam full scan FIS_NFITEMPROD)
//   - Histórico de auth (falhas que poderiam levar a bloqueio)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChartLineUp,
  ArrowsClockwise,
  Database,
  Lightning,
  Warning,
  CheckCircle,
  XCircle,
  Spinner,
  Trash,
  Pulse,
  Clock,
  Cpu,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

const WINDOW_OPTIONS = [
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 h' },
];

const REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1min' },
];

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatCard({ icon: Icon, label, value, subtext, color = 'blue', tone }) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600', border: 'border-blue-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600', border: 'border-emerald-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600', border: 'border-amber-200' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-600', border: 'border-rose-200' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-700', icon: 'text-slate-600', border: 'border-slate-200' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', icon: 'text-cyan-600', border: 'border-cyan-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-600', border: 'border-violet-200' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <Icon size={16} weight="duotone" className={c.icon} />
      </div>
      <div className={`text-2xl font-bold ${c.text} tabular-nums leading-tight`}>{value}</div>
      {subtext && <div className="text-[11px] text-gray-500">{subtext}</div>}
      {tone && (
        <div className={`text-[10px] font-semibold mt-1 ${
          tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-rose-600'
        }`}>
          {tone === 'good' && '✓ Saudável'}
          {tone === 'warn' && '⚠ Atenção'}
          {tone === 'bad' && '✗ Crítico'}
        </div>
      )}
    </div>
  );
}

export default function MonitoramentoTotvs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [windowSec, setWindowSec] = useState(60);
  const [refreshSec, setRefreshSec] = useState(10);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const refreshTimer = useRef(null);

  const fetchData = useCallback(async () => {
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/monitoring/totvs-usage?window=${windowSec}`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setData(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [windowSec]);

  // Carrega ao montar e ao mudar windowSec
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    if (refreshSec > 0) {
      refreshTimer.current = setInterval(fetchData, refreshSec * 1000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [refreshSec, fetchData]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await fetch(`${API_BASE_URL}/api/monitoring/totvs-usage/reset`, { method: 'POST' });
      setConfirmReset(false);
      await fetchData();
    } catch (e) {
      setErro(e.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Spinner size={28} className="animate-spin mr-2" />
        <span className="text-sm">Carregando monitoramento...</span>
      </div>
    );
  }

  if (erro && !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm">
        Erro: {erro}
      </div>
    );
  }

  const recent = data?.recent || {};
  const totals = data?.totals_since_boot || {};
  const auth = data?.auth || {};
  const topEndpoints = data?.top_endpoints || [];
  const slowQueries = data?.slow_queries || [];
  const errors = data?.recent_errors || [];

  // Cálculo dos status visuais (good/warn/bad)
  const cacheHitTone = recent.cache_hit_rate >= 0.7 ? 'good' : recent.cache_hit_rate >= 0.4 ? 'warn' : 'bad';
  const slowTone = recent.slow_queries === 0 ? 'good' : recent.slow_queries <= 2 ? 'warn' : 'bad';
  const fullScanTone = recent.full_scan_candidates <= 5 ? 'good' : recent.full_scan_candidates <= 20 ? 'warn' : 'bad';
  const authTone = auth.total_failures === 0 ? 'good' : auth.total_failures <= 2 ? 'warn' : 'bad';

  return (
    <div className="w-full max-w-7xl mx-auto py-3 px-2 flex flex-col gap-4">
      <PageTitle
        title="Monitoramento TOTVS"
        subtitle="Consumo, performance e saúde da integração TOTVS Moda"
        icon={ChartLineUp}
        iconColor="text-emerald-600"
      />

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-500" />
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Janela</label>
          <select
            value={windowSec}
            onChange={(e) => setWindowSec(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowsClockwise size={14} className="text-gray-500" />
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Auto-refresh</label>
          <select
            value={refreshSec}
            onChange={(e) => setRefreshSec(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          <ArrowsClockwise size={12} weight="bold" />
          Atualizar
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
          <span>Uptime backend: <b className="text-gray-700">{formatUptime(data?.server_uptime_seconds || 0)}</b></span>
          <span className="opacity-40">•</span>
          <span>Atualizado às {new Date(data?.timestamp || Date.now()).toLocaleTimeString('pt-BR')}</span>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-rose-600 transition"
              title="Reset dos contadores"
            >
              <Trash size={11} />
              Reset
            </button>
          ) : (
            <span className="ml-2 inline-flex items-center gap-1">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded disabled:opacity-50"
              >
                {resetting ? '...' : 'Confirmar reset'}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-[10px] text-gray-500 hover:text-gray-700 px-1"
              >
                cancelar
              </button>
            </span>
          )}
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Pulse}
          label="Reqs (janela)"
          value={recent.total_requests || 0}
          subtext={`${recent.totvs_calls || 0} TOTVS + ${recent.cache_hits || 0} cache`}
          color="blue"
        />
        <StatCard
          icon={Database}
          label="Cache hit rate"
          value={`${Math.round((recent.cache_hit_rate || 0) * 100)}%`}
          subtext="ideal ≥ 70%"
          color={cacheHitTone === 'good' ? 'emerald' : cacheHitTone === 'warn' ? 'amber' : 'rose'}
          tone={cacheHitTone}
        />
        <StatCard
          icon={Clock}
          label="Latência P95"
          value={formatDuration(recent.p95_duration_ms || 0)}
          subtext={`P50: ${formatDuration(recent.p50_duration_ms || 0)}`}
          color={recent.p95_duration_ms > 10000 ? 'rose' : recent.p95_duration_ms > 5000 ? 'amber' : 'emerald'}
        />
        <StatCard
          icon={Warning}
          label="Slow queries"
          value={recent.slow_queries || 0}
          subtext="> 5 segundos"
          color={slowTone === 'good' ? 'emerald' : slowTone === 'warn' ? 'amber' : 'rose'}
          tone={slowTone}
        />
        <StatCard
          icon={Cpu}
          label="Full scan candidates"
          value={recent.full_scan_candidates || 0}
          subtext="expand=items (pesado)"
          color={fullScanTone === 'good' ? 'emerald' : fullScanTone === 'warn' ? 'amber' : 'rose'}
          tone={fullScanTone}
        />
        <StatCard
          icon={Lightning}
          label="Auth"
          value={`${auth.total_attempts || 0} / ${auth.total_failures || 0}`}
          subtext="total / falhas"
          color={authTone === 'good' ? 'emerald' : authTone === 'warn' ? 'amber' : 'rose'}
          tone={authTone}
        />
      </div>

      {/* Auth + Totais cumulativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auth status */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightning size={16} weight="duotone" className="text-amber-600" />
            <h3 className="text-sm font-bold text-gray-700">Autenticação TOTVS</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Tentativas totais</span>
              <span className="font-semibold text-gray-700 tabular-nums">{auth.total_attempts || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Falhas totais</span>
              <span className={`font-semibold tabular-nums ${(auth.total_failures || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {auth.total_failures || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Último sucesso</span>
              <span className="text-gray-700">
                {auth.last_success_at ? new Date(auth.last_success_at).toLocaleString('pt-BR') : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Última falha</span>
              <span className="text-gray-700">
                {auth.last_failure_at ? new Date(auth.last_failure_at).toLocaleString('pt-BR') : '—'}
              </span>
            </div>
            {auth.last_failure_reason && (
              <div className="mt-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[11px] font-mono">
                <XCircle size={11} className="inline mr-1" />
                {auth.last_failure_reason}
              </div>
            )}
          </div>
        </div>

        {/* Totais desde o boot */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Pulse size={16} weight="duotone" className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-700">Desde o boot</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Chamadas TOTVS reais</span>
              <span className="font-semibold text-gray-700 tabular-nums">{(totals.totvs_calls || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cache hits</span>
              <span className="font-semibold text-emerald-600 tabular-nums">{(totals.cache_hits || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Coalesces (requests economizadas)</span>
              <span className="font-semibold text-cyan-600 tabular-nums">{(totals.coalesces || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Auth attempts</span>
              <span className="font-semibold text-gray-700 tabular-nums">{(totals.auth_attempts || 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top endpoints */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ChartLineUp size={16} weight="duotone" className="text-violet-600" />
          <h3 className="text-sm font-bold text-gray-700">Top endpoints na janela</h3>
        </div>
        {topEndpoints.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Sem chamadas TOTVS na janela.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Endpoint</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold text-right">Reqs</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold text-right">Média</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold text-right">Slow</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold text-right">Com items</th>
                </tr>
              </thead>
              <tbody>
                {topEndpoints.map((e) => (
                  <tr key={e.endpoint} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-[11px] text-gray-700">{e.endpoint}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-700">{e.count}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-600">{formatDuration(e.avg_ms)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${e.slow_count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {e.slow_count}
                    </td>
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${e.with_items > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                      {e.with_items}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slow queries */}
      {slowQueries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Warning size={16} weight="duotone" className="text-amber-600" />
            <h3 className="text-sm font-bold text-gray-700">Queries lentas (&gt; 5s)</h3>
            <span className="ml-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              {slowQueries.length} {slowQueries.length === 1 ? 'ocorrência' : 'ocorrências'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Hora</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Endpoint</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Expand</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold text-right">Duração</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.slice().reverse().map((q, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 px-3 text-gray-500">{new Date(q.ts).toLocaleTimeString('pt-BR')}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-gray-700">{q.endpoint}</td>
                    <td className={`py-2 px-3 text-[10px] ${q.expand && /items/i.test(q.expand) ? 'text-rose-600 font-semibold' : 'text-gray-500'}`}>
                      {q.expand || '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-amber-700">{formatDuration(q.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Erros recentes */}
      {errors.length > 0 && (
        <div className="bg-white border border-rose-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-rose-100 flex items-center gap-2 bg-rose-50">
            <XCircle size={16} weight="duotone" className="text-rose-600" />
            <h3 className="text-sm font-bold text-rose-700">Erros recentes</h3>
            <span className="ml-1 text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
              {errors.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Hora</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Endpoint</th>
                  <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice().reverse().map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 px-3 text-gray-500">{new Date(e.ts).toLocaleTimeString('pt-BR')}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-gray-700">{e.endpoint}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-rose-600">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dicas pra interpretação */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
        <div className="font-bold mb-2 flex items-center gap-2">
          <CheckCircle size={14} weight="fill" className="text-blue-600" />
          Como interpretar
        </div>
        <ul className="space-y-1 list-disc list-inside text-[11px]">
          <li><b>Cache hit rate</b> alto (&gt;70%) é bom — a maioria dos pedidos é servida sem bater no TOTVS.</li>
          <li><b>Full scan candidates</b> são chamadas com <code className="bg-blue-100 px-1 rounded">expand=items</code> — elas tocam <code className="bg-blue-100 px-1 rounded">FIS_NFITEMPROD</code> e foram a causa do bloqueio anterior. Quanto menor, melhor.</li>
          <li><b>Slow queries</b> &gt; 5s indicam que o TOTVS está lento ou as queries estão pesadas. Se aparecerem muitas, é hora de revisar.</li>
          <li><b>Auth failures</b> com motivo <code className="bg-blue-100 px-1 rounded">ApiUser ... is Blocked</code> indicam que o usuário TOTVS foi suspenso pela DBA e precisa ser desbloqueado.</li>
          <li><b>Coalesces</b> é o número de requests TOTVS economizadas porque outra request idêntica já estava em andamento. Quanto maior, melhor.</li>
        </ul>
      </div>
    </div>
  );
}
