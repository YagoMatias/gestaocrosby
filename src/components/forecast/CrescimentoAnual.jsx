// Crescimento YTD vs Ano Anterior — card executivo para Métricas Diretoria.
// Compara faturamento acumulado do ano corrente (01/jan → hoje) com o
// MESMO período do ano anterior. Fonte: /api/crm/canais-totals-all (Supabase
// cache canal_totals_cache + snapshots + overrides).
//
// Mostra: total geral com Δ%, tabela por canal com Δ absoluto e Δ%.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendUp, TrendDown, ArrowsClockwise, DownloadSimple } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import useDownloadAsImage from '../../hooks/useDownloadAsImage';

// Consolidação de canais pra comparação ano a ano: em 2025 alguns canais
// que hoje são separados eram tratados como um só. Agrupamos aqui pra que
// o crescimento fique justo (comparando apples-to-apples).
//   - Multimarcas + Inbound David + Inbound Rafael → "Multimarcas"
//   - Franquia + Showroom + Novidades Franquia → "Franquia"
//   - Business é excluído da visão de crescimento (não é vendas).
const CANAL_GRUPO = {
  varejo: 'varejo',
  revenda: 'revenda',
  multimarcas: 'multimarcas',
  inbound_david: 'multimarcas',
  inbound_rafael: 'multimarcas',
  franquia: 'franquia',
  showroom: 'franquia',
  novidadesfranquia: 'franquia',
  bazar: 'bazar',
  ricardoeletro: 'ricardoeletro',
  // business: excluído
};
const CANAL_LABEL = {
  varejo: 'Varejo',
  revenda: 'Revenda',
  multimarcas: 'Multimarcas (+ Inbound David/Rafael)',
  franquia: 'Franquia (+ Showroom/Novidades)',
  bazar: 'Bazar',
  ricardoeletro: 'Ricardo Eletro',
};

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

async function fetchCrescimento(ano) {
  const r = await fetch(`${API_BASE_URL}/api/forecast/crescimento-anual?ano=${ano}`);
  const j = await r.json();
  if (!j?.success) throw new Error(j?.message || 'erro fetch');
  return j.data || j;
}

export default function CrescimentoAnual() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const reqIdRef = useRef(0);
  const { ref: downloadRef, baixar: baixarImagem } = useDownloadAsImage(
    () => `crescimento-anual-ytd-${new Date().getFullYear()}`,
  );

  const carregar = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    setErro('');
    try {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      const anoAnterior = anoAtual - 1;
      // Endpoint dedicado /crescimento-anual: agrega direto do Supabase
      // notas_fiscais e retorna ambos os anos numa única chamada rápida.
      const resp = await fetchCrescimento(anoAtual);
      if (myId !== reqIdRef.current) return;
      const segAtual = resp.segmentos_atual || {};
      const segAnterior = resp.segmentos_anterior || {};
      const { ini_atual: iniAtual, fim_atual: fimAtual, ini_anterior: iniAnterior, fim_anterior: fimAnterior } = resp.periodo || {};

      // Agrupa por CANAL_GRUPO — combina multimarcas+inbound e franquia+
      // showroom+novidades pra bater com a estrutura antiga. Business
      // é excluído (não entra em CANAL_GRUPO).
      const agregar = (seg) => {
        const grupos = {};
        for (const [canal, valor] of Object.entries(seg)) {
          const grupo = CANAL_GRUPO[canal];
          if (!grupo) continue;
          grupos[grupo] = (grupos[grupo] || 0) + Number(valor || 0);
        }
        return grupos;
      };
      const grpAtual = agregar(segAtual);
      const grpAnterior = agregar(segAnterior);
      const canais = new Set([...Object.keys(grpAtual), ...Object.keys(grpAnterior)]);
      const linhas = [];
      let totAtual = 0;
      let totAnterior = 0;
      for (const c of canais) {
        const at = Number(grpAtual[c] || 0);
        const an = Number(grpAnterior[c] || 0);
        if (at <= 0 && an <= 0) continue;
        totAtual += at;
        totAnterior += an;
        const delta = at - an;
        const pct = an > 0 ? (delta / an) * 100 : (at > 0 ? 100 : 0);
        linhas.push({ canal: c, label: CANAL_LABEL[c] || c, atual: at, anterior: an, delta, pct });
      }
      linhas.sort((a, b) => b.atual - a.atual);
      const totDelta = totAtual - totAnterior;
      const totPct = totAnterior > 0 ? (totDelta / totAnterior) * 100 : 0;
      setData({
        anoAtual,
        anoAnterior,
        periodo: { iniAtual, fimAtual, iniAnterior, fimAnterior },
        linhas,
        total: { atual: totAtual, anterior: totAnterior, delta: totDelta, pct: totPct },
      });
    } catch (e) {
      if (myId === reqIdRef.current) setErro(e.message);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const totalPct = Number(data?.total?.pct || 0);
  const positivo = totalPct >= 0;

  return (
    <div
      ref={downloadRef}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 text-white px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
            {positivo ? (
              <TrendUp size={20} weight="duotone" className="text-emerald-300" />
            ) : (
              <TrendDown size={20} weight="duotone" className="text-rose-300" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">Crescimento Ano a Ano — YTD</h3>
            {data && (
              <p className="text-xs text-indigo-200 mt-0.5">
                {data.anoAtual} vs {data.anoAnterior} · comparação até hoje
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" data-h2c-ignore="true">
          <button
            onClick={baixarImagem}
            disabled={loading || !data}
            title="Baixar PNG"
            className="text-[11px] px-2.5 py-1.5 rounded bg-white/15 hover:bg-white/25 text-white inline-flex items-center gap-1.5 font-semibold shadow-sm transition disabled:opacity-50"
          >
            <DownloadSimple size={14} weight="bold" /> PNG
          </button>
          <button
            onClick={carregar}
            disabled={loading}
            title="Atualizar"
            className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition disabled:opacity-50"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI total */}
      <div className="px-5 py-4 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              {data?.anoAtual || '—'} YTD
            </p>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums leading-tight mt-1">
              {loading ? '—' : `R$ ${fmtBRL(data?.total?.atual)}`}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              {data?.anoAnterior || '—'} YTD (mesmo período)
            </p>
            <p className="text-2xl font-extrabold text-gray-500 tabular-nums leading-tight mt-1">
              {loading ? '—' : `R$ ${fmtBRL(data?.total?.anterior)}`}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              Crescimento
            </p>
            <p
              className={`text-2xl font-extrabold tabular-nums leading-tight mt-1 ${
                positivo ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {loading
                ? '—'
                : `${positivo ? '+' : ''}${totalPct.toFixed(1)}%`}
            </p>
            {!loading && data && (
              <p
                className={`text-[11px] tabular-nums ${
                  positivo ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {positivo ? '+' : ''}R$ {fmtBRL(data.total.delta)}
              </p>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <div className="px-5 py-3 text-xs text-rose-700 bg-rose-50 border-b border-rose-200">
          Erro: {erro}
        </div>
      )}

      {/* Tabela por canal */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <th className="py-2 px-4 text-left">Canal</th>
              <th className="py-2 px-4 text-right">{data?.anoAtual || 'Atual'}</th>
              <th className="py-2 px-4 text-right">{data?.anoAnterior || 'Anterior'}</th>
              <th className="py-2 px-4 text-right">Δ R$</th>
              <th className="py-2 px-4 text-right w-[80px]">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td colSpan={5} className="py-3 px-4">
                    <div className="h-3 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            )}
            {!loading && data?.linhas.map((l) => {
              // Se ano anterior tem 0 (ou próximo) e atual tem venda: canal novo
              const isNovo = l.anterior <= 0 && l.atual > 0;
              return (
                <tr key={l.canal} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="py-2.5 px-4 font-semibold text-gray-800 text-[13px]">
                    <span className="inline-flex items-center gap-2">
                      {l.label}
                      {isNovo && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                          Novo
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-gray-900 font-semibold">
                    R$ {fmtBRL(l.atual)}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-gray-500">
                    {isNovo ? (
                      <span className="text-[11px] italic text-gray-400">sem histórico</span>
                    ) : (
                      <>R$ {fmtBRL(l.anterior)}</>
                    )}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right tabular-nums text-[12px] ${
                      isNovo ? 'text-gray-400' : l.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isNovo ? '—' : `${l.delta >= 0 ? '+' : ''}R$ ${fmtBRL(l.delta)}`}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right tabular-nums text-[12px] font-bold ${
                      isNovo ? 'text-gray-400' : l.pct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isNovo ? '—' : `${l.pct >= 0 ? '+' : ''}${l.pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
