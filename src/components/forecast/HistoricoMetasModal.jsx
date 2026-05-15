// Modal de histórico de alterações em forecast_canal_metas
import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ClockCounterClockwise,
  ArrowsClockwise,
  Plus,
  Trash,
  PencilSimple,
  ArrowRight,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const formatBRL = (v) =>
  v == null
    ? '—'
    : `R$ ${Number(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

const fmtData = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const ACAO_INFO = {
  create: { label: 'Criou', icon: Plus, color: 'text-emerald-600 bg-emerald-50' },
  update: { label: 'Alterou', icon: PencilSimple, color: 'text-blue-600 bg-blue-50' },
  delete: { label: 'Removeu', icon: Trash, color: 'text-rose-600 bg-rose-50' },
};

const CANAL_LABEL = {
  varejo: 'Varejo',
  revenda: 'Revenda',
  multimarcas: 'Multimarcas',
  inbound_david: 'Inbound David',
  inbound_rafael: 'Inbound Rafael',
  franquia: 'Franquia',
  bazar: 'Bazar',
  fabrica: 'Fábrica (Kleiton)',
  business: 'Business',
  ricardoeletro: 'Ricardo Eletro',
  showroom: 'Showroom',
  novidadesfranquia: 'Novidades Franquia',
};

export default function HistoricoMetasModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [filtroPeriod, setFiltroPeriod] = useState(''); // '' | 'mensal' | 'semanal'

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = new URLSearchParams();
      if (filtroCanal) qs.set('canal', filtroCanal);
      if (filtroPeriod) qs.set('period_type', filtroPeriod);
      qs.set('limit', '300');
      const r = await fetch(`${API_BASE_URL}/api/crm/canal-metas-log?${qs.toString()}`, {
        headers: { 'x-api-key': API_KEY },
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setLogs(j.data?.logs || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtroCanal, filtroPeriod]);

  useEffect(() => { carregar(); }, [carregar]);

  const canais = Array.from(
    new Set(Object.keys(CANAL_LABEL)),
  ).sort();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise size={22} className="text-blue-700" weight="bold" />
            <h3 className="text-lg font-bold text-gray-800">Histórico de alterações</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={filtroCanal}
            onChange={(e) => setFiltroCanal(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
          >
            <option value="">Todos os canais</option>
            {canais.map((c) => (
              <option key={c} value={c}>{CANAL_LABEL[c] || c}</option>
            ))}
          </select>
          <select
            value={filtroPeriod}
            onChange={(e) => setFiltroPeriod(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
          >
            <option value="">Mensal + Semanal</option>
            <option value="mensal">Apenas mensal</option>
            <option value="semanal">Apenas semanal</option>
          </select>
          <button
            onClick={carregar}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">{erro}</div>}

        {loading && logs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Nenhuma alteração registrada.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Quando</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Canal</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Período</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Ação</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Por</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ai = ACAO_INFO[log.acao] || ACAO_INFO.update;
                  const Icon = ai.icon;
                  const ant = log.valor_meta_anterior;
                  const novo = log.valor_meta_novo;
                  const dif = ant != null && novo != null ? Number(novo) - Number(ant) : null;
                  return (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {fmtData(log.alterado_em)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {CANAL_LABEL[log.canal] || log.canal}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{log.period_type}</span>{' '}
                        <span className="font-mono">{log.period_key}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${ai.color}`}>
                          <Icon size={12} weight="bold" /> {ai.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {log.acao === 'create' ? (
                          <span className="text-emerald-700 font-semibold">{formatBRL(novo)}</span>
                        ) : log.acao === 'delete' ? (
                          <span className="text-rose-700 line-through">{formatBRL(ant)}</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-gray-500">{formatBRL(ant)}</span>
                            <ArrowRight size={10} className="text-gray-400" />
                            <span className="text-gray-800 font-semibold">{formatBRL(novo)}</span>
                            {dif != null && (
                              <span
                                className={`text-[10px] ${dif >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                              >
                                ({dif >= 0 ? '+' : ''}{formatBRL(dif).replace('R$ ', '')})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {log.alterado_por || '—'}
                        {log.user_role && (
                          <span className="ml-1 text-[10px] text-gray-400">({log.user_role})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[10px] text-gray-400 mt-3 text-right">
          {logs.length} alteração{logs.length !== 1 ? 'ões' : ''} carregada{logs.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
