// Aba "Reunião → Fila da Vez" — visualização (dashboard somente)
// Os dados de configuração/cadastro ficam fora da Reunião,
// dentro do menu principal de Varejo (VarejoFilaAdmin)
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ChartBar,
  CurrencyDollar,
  Clock,
  Target,
  ArrowClockwise,
  XCircle,
} from 'phosphor-react';
import { API_BASE_URL } from '../../config/constants';

const fmtMoeda = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;
const fmtDur = (segs) => {
  const s = Math.floor(Number(segs || 0));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}min` : `${s}s`;
};

async function apiReq(path) {
  const r = await fetch(`${API_BASE_URL}/api/fila${path}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
  return j.data;
}

function CardMetric({ icon: Icon, label, value, color }) {
  return (
    <div className={`p-3 rounded-xl border ${color}`}>
      <div className="flex items-center gap-2 text-xs uppercase opacity-80">
        <Icon size={14} weight="bold" /> {label}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function VarejoFilaDashboard() {
  const [lojas, setLojas] = useState([]);
  const [filtroLoja, setFiltroLoja] = useState('');
  const hoje = new Date().toISOString().slice(0, 10);
  const semanaAtras = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [datemin, setDatemin] = useState(semanaAtras);
  const [datemax, setDatemax] = useState(hoje);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    apiReq('/lojas')
      .then((d) => setLojas((d.lojas || []).filter((l) => l.configurada)))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtroLoja) qs.set('branch', filtroLoja);
      if (datemin) qs.set('datemin', datemin);
      if (datemax) qs.set('datemax', datemax);
      const d = await apiReq(`/dashboard?${qs.toString()}`);
      setDash(d);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroLoja, datemin, datemax]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const setPeriodo = (preset) => {
    const now = new Date();
    if (preset === 'hoje') {
      setDatemin(hoje);
      setDatemax(hoje);
    } else if (preset === '7d') {
      setDatemin(new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
      setDatemax(hoje);
    } else if (preset === '30d') {
      setDatemin(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
      setDatemax(hoje);
    } else if (preset === 'mes') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setDatemin(first);
      setDatemax(hoje);
    }
  };

  const resumo = dash?.resumo || {};
  const porVendedora = dash?.por_vendedora || [];
  const topMotivos = dash?.top_motivos || [];

  return (
    <div className="space-y-4 font-barlow">
      {/* Filtros */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-md border border-[#000638]/10">
        <div className="flex items-center gap-2 mb-2">
          <ChartBar size={18} weight="bold" className="text-[#000638]" />
          <h3 className="text-base font-bold text-[#000638]">Fila da Vez — Performance</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroLoja}
            onChange={(e) => setFiltroLoja(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Todas as lojas</option>
            {lojas.map((l) => (
              <option key={l.branch_code} value={l.branch_code}>
                {l.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={datemin}
            onChange={(e) => setDatemin(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
          <span className="text-gray-500">→</span>
          <input
            type="date"
            value={datemax}
            onChange={(e) => setDatemax(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
          <div className="flex gap-1 ml-auto">
            <button onClick={() => setPeriodo('hoje')} className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg">Hoje</button>
            <button onClick={() => setPeriodo('7d')} className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg">7 dias</button>
            <button onClick={() => setPeriodo('30d')} className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg">30 dias</button>
            <button onClick={() => setPeriodo('mes')} className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg">Mês</button>
            <button
              onClick={carregar}
              className="inline-flex items-center gap-1 bg-[#000638] hover:bg-[#0a1450] text-white text-xs px-3 py-1.5 rounded-lg"
            >
              <ArrowClockwise size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>}

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CardMetric
          icon={Users}
          label="Atendimentos"
          value={resumo.total_atendimentos || 0}
          color="bg-blue-50 text-blue-700 border-blue-200"
        />
        <CardMetric
          icon={Target}
          label="Conversão"
          value={fmtPct(resumo.taxa_conversao)}
          color="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <CardMetric
          icon={CurrencyDollar}
          label="Ticket médio"
          value={fmtMoeda(resumo.ticket_medio)}
          color="bg-amber-50 text-amber-700 border-amber-200"
        />
        <CardMetric
          icon={Clock}
          label="Tempo médio"
          value={fmtDur(resumo.tempo_medio_segundos)}
          color="bg-purple-50 text-purple-700 border-purple-200"
        />
      </div>

      {/* Por vendedora */}
      <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 overflow-hidden">
        <div className="px-4 py-3 bg-[#000638] text-white">
          <h3 className="font-bold flex items-center gap-2">
            <Users size={16} weight="bold" /> Performance por vendedora
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left">Pos</th>
                <th className="px-3 py-2 text-left">Vendedora</th>
                <th className="px-3 py-2 text-right">Atendimentos</th>
                <th className="px-3 py-2 text-right">Vendas</th>
                <th className="px-3 py-2 text-right">Conversão</th>
                <th className="px-3 py-2 text-right">Ticket Médio</th>
                <th className="px-3 py-2 text-right">Tempo Médio</th>
              </tr>
            </thead>
            <tbody>
              {porVendedora.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                    Sem atendimentos no período
                  </td>
                </tr>
              )}
              {porVendedora.map((v, idx) => {
                const posColor =
                  idx === 0 ? 'bg-yellow-100 text-yellow-800'
                  : idx === 1 ? 'bg-slate-100 text-slate-700'
                  : idx === 2 ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600';
                return (
                  <tr key={v.vendedora_id} className={idx % 2 ? 'bg-gray-50/50' : 'bg-white'}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${posColor}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{v.vendedora_nome}</td>
                    <td className="px-3 py-2 text-right">{v.atendimentos}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">{v.vendas}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmtPct(v.conversao)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoeda(v.ticket_medio)}</td>
                    <td className="px-3 py-2 text-right">{fmtDur(v.tempo_medio)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top motivos */}
      <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 overflow-hidden">
        <div className="px-4 py-3 bg-[#000638] text-white">
          <h3 className="font-bold flex items-center gap-2">
            <XCircle size={16} weight="bold" /> Top motivos de não-venda
          </h3>
        </div>
        <div className="p-3 space-y-1">
          {topMotivos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sem dados no período</p>
          )}
          {topMotivos.map((m, idx) => {
            const max = topMotivos[0]?.total || 1;
            const pct = (m.total / max) * 100;
            return (
              <div key={idx} className="flex items-center gap-2 py-1.5">
                <span className="text-xs text-gray-500 w-6 text-right">{idx + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-0.5">
                    <span className="font-medium">{m.motivo}</span>
                    <span className="text-gray-600">{m.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
