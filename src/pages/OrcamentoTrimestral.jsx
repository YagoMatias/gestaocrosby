// Aba "Orçamento" do Forecast — CRUD do orçamento trimestral por canal.
// Permite cadastrar metas de faturamento + budget de tráfego/marketing
// pra trimestres futuros. Os dados são consumidos pelo card "Orçamento Mkt"
// no Forecast e podem ser comparados contra gasto real (custos-marketing).

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FloppyDisk, Trash, ArrowsClockwise } from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

const formatBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(v || 0));

// Lista de canais conhecidos do sistema (usados em outros lugares do Forecast).
const CANAIS_PADRAO = [
  { canal: 'varejo',          canal_label: 'B2C — Varejo' },
  { canal: 'revenda',         canal_label: 'B2R — Revenda' },
  { canal: 'multimarcas',     canal_label: 'B2M — Multimarcas' },
  { canal: 'inbound_david',   canal_label: 'B2M Inbound — David' },
  { canal: 'inbound_rafael',  canal_label: 'B2M Inbound — Rafael' },
  { canal: 'franquia',        canal_label: 'B2L — Franquia' },
  { canal: 'business',        canal_label: 'B2 Business — Fardamento' },
  { canal: 'bazar',           canal_label: 'Bazar' },
];

export default function OrcamentoTrimestral() {
  const hoje = new Date();
  const trimAtual = Math.ceil((hoje.getMonth() + 1) / 3);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [trimestre, setTrimestre] = useState(trimAtual);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  // Edits locais antes do save (canal → {meta, trafego, marketing, obs})
  const [edits, setEdits] = useState({});

  const carregar = async () => {
    setLoading(true); setMsg('');
    try {
      const url = `${API_BASE_URL}/api/forecast/budget?ano=${ano}&trimestre=${trimestre}`;
      const r = await fetch(url, {});
      const j = await r.json();
      setRows(j?.data?.rows || []);
      setEdits({});
    } catch (e) {
      setMsg('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [ano, trimestre]);

  const linhas = useMemo(() => {
    // Mescla CANAIS_PADRAO com rows do banco — canais cadastrados ganham
    // valores reais; canais novos aparecem zerados pra cadastro.
    const byCanal = new Map();
    for (const r of rows) byCanal.set(r.canal, r);
    return CANAIS_PADRAO.map((c) => {
      const r = byCanal.get(c.canal) || {};
      return {
        canal: c.canal,
        canal_label: r.canal_label || c.canal_label,
        id: r.id || null,
        meta_faturamento: Number(r.meta_faturamento || 0),
        budget_trafego: Number(r.budget_trafego || 0),
        budget_marketing: Number(r.budget_marketing || 0),
        observacao: r.observacao || '',
      };
    });
  }, [rows]);

  const setEdit = (canal, key, val) => {
    setEdits((prev) => ({
      ...prev,
      [canal]: { ...(prev[canal] || {}), [key]: val },
    }));
  };

  const valor = (canal, key, fallback) =>
    edits[canal]?.[key] !== undefined ? edits[canal][key] : fallback;

  const salvarCanal = async (linha) => {
    setMsg('');
    const e = edits[linha.canal] || {};
    const payload = {
      ano, trimestre, canal: linha.canal,
      canal_label: linha.canal_label,
      meta_faturamento: Number(e.meta_faturamento ?? linha.meta_faturamento) || 0,
      budget_trafego: Number(e.budget_trafego ?? linha.budget_trafego) || 0,
      budget_marketing: Number(e.budget_marketing ?? linha.budget_marketing) || 0,
      observacao: e.observacao ?? linha.observacao ?? '',
    };
    try {
      const r = await fetch(`${API_BASE_URL}/api/forecast/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t.slice(0, 200));
      }
      await carregar();
      setMsg(`✅ ${linha.canal_label} salvo`);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(`❌ Erro: ${err.message}`);
    }
  };

  const deletarCanal = async (linha) => {
    if (!linha.id) {
      setEdits((prev) => { const { [linha.canal]: _, ...rest } = prev; return rest; });
      return;
    }
    if (!confirm(`Remover orçamento de ${linha.canal_label}?`)) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/forecast/budget/${linha.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY },
      });
      if (!r.ok) throw new Error('Falha ao remover');
      await carregar();
      setMsg(`✅ ${linha.canal_label} removido`);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(`❌ Erro: ${err.message}`);
    }
  };

  // Aplica 2,5% / 0,5% automaticamente quando muda meta_faturamento.
  const aplicarPercentuais = (canal, novaMeta) => {
    const n = Number(novaMeta || 0);
    setEdit(canal, 'meta_faturamento', n);
    setEdit(canal, 'budget_trafego', Math.round(n * 0.025 * 100) / 100);
    setEdit(canal, 'budget_marketing', Math.round(n * 0.005 * 100) / 100);
  };

  const tot = useMemo(() => {
    return linhas.reduce(
      (acc, l) => {
        acc.meta += Number(valor(l.canal, 'meta_faturamento', l.meta_faturamento));
        acc.traf += Number(valor(l.canal, 'budget_trafego', l.budget_trafego));
        acc.mkt += Number(valor(l.canal, 'budget_marketing', l.budget_marketing));
        return acc;
      },
      { meta: 0, traf: 0, mkt: 0 },
    );
  }, [linhas, edits]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Orçamento Marketing por Trimestre</h1>
        <p className="text-xs text-gray-500 mt-1">
          Meta de faturamento + Budget de tráfego (2,5%) e marketing (0,5%) por canal.
          O sistema sugere 2,5% e 0,5% automaticamente quando você define a meta — pode ajustar.
        </p>
      </div>

      {/* Seletor ano/trimestre */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Ano</label>
          <input
            type="number"
            min="2024" max="2030"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Trimestre</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((t) => (
              <button
                key={t}
                onClick={() => setTrimestre(t)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  trimestre === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >T{t}</button>
            ))}
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
          Recarregar
        </button>
        {msg && <span className="text-xs text-gray-700 ml-2">{msg}</span>}
      </div>

      {/* Tabela de canais */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-[10px] uppercase tracking-wider text-gray-500">
              <th className="text-left px-3 py-2.5">Canal</th>
              <th className="text-right px-3 py-2.5">Meta Faturamento (R$)</th>
              <th className="text-right px-3 py-2.5">Bud. Tráfego (2,5%)</th>
              <th className="text-right px-3 py-2.5">Bud. Marketing (0,5%)</th>
              <th className="text-right px-3 py-2.5">Total Bud.</th>
              <th className="text-center px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const meta = valor(l.canal, 'meta_faturamento', l.meta_faturamento);
              const traf = valor(l.canal, 'budget_trafego', l.budget_trafego);
              const mkt = valor(l.canal, 'budget_marketing', l.budget_marketing);
              const editou = edits[l.canal] !== undefined;
              return (
                <tr key={l.canal} className={`border-b border-gray-100 ${editou ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{l.canal_label}</div>
                    <div className="text-[10px] text-gray-400">{l.canal}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number" min="0" step="100"
                      value={meta}
                      onChange={(e) => aplicarPercentuais(l.canal, e.target.value)}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number" min="0" step="100"
                      value={traf}
                      onChange={(e) => setEdit(l.canal, 'budget_trafego', e.target.value)}
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number" min="0" step="100"
                      value={mkt}
                      onChange={(e) => setEdit(l.canal, 'budget_marketing', e.target.value)}
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">
                    R$ {formatBRL(Number(traf) + Number(mkt))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => salvarCanal(l)}
                        disabled={!editou}
                        className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Salvar"
                      >
                        <FloppyDisk size={16} />
                      </button>
                      {l.id && (
                        <button
                          onClick={() => deletarCanal(l)}
                          className="p-1.5 rounded hover:bg-rose-100 text-rose-600"
                          title="Remover"
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-sm">
              <td className="px-3 py-2.5">TOTAL T{trimestre}/{ano}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">R$ {formatBRL(tot.meta)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-purple-700">R$ {formatBRL(tot.traf)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">R$ {formatBRL(tot.mkt)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">R$ {formatBRL(tot.traf + tot.mkt)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        💡 <b>Dica:</b> alterar a Meta de Faturamento ajusta automaticamente Tráfego (2,5%) e Marketing (0,5%).
        Você pode sobrescrever os valores depois. Salve um canal por vez clicando no ícone <FloppyDisk size={12} className="inline" />.
      </div>
    </div>
  );
}
