// Modo Apresentação — Faturamento × Meta em tela cheia (TV/projetor)
// Auto-refresh a cada 5 min · fontes grandes · dark theme.
// Pública (mesmo padrão do /print/forecast). Usa lite mode no fat-seg.
import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const CANAL_LABELS = {
  varejo: 'Varejo',
  revenda: 'Revenda',
  multimarcas: 'Multimarcas',
  inbound_david: 'MTM Inbound David',
  inbound_rafael: 'MTM Inbound Rafael',
  franquia: 'Franquia',
  business: 'Business',
  bazar: 'Bazar',
  fabrica: 'Fábrica',
  ricardoeletro: 'Ricardo Eletro',
};

const ORDEM = [
  'varejo', 'revenda', 'multimarcas', 'inbound_david', 'inbound_rafael',
  'franquia', 'bazar', 'fabrica', 'ricardoeletro',
];

const FABRICA_SOURCES = ['showroom', 'novidadesfranquia'];

function fmtBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
function fmtBRLCompact(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace('.', ',') + 'k';
  return fmtBRL(v);
}
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentWeekKey() {
  const d = new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
function weekKeyRange(key) {
  if (!key) return null;
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const [, y, w] = m;
  const jan4 = new Date(Date.UTC(+y, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (+w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    datemin: monday.toISOString().slice(0, 10),
    datemax: sunday.toISOString().slice(0, 10),
  };
}

function pctTone(pct) {
  if (pct >= 100) return 'bg-emerald-500/30 text-emerald-200 ring-emerald-400/50';
  if (pct >= 70) return 'bg-amber-500/30 text-amber-200 ring-amber-400/50';
  return 'bg-rose-500/30 text-rose-200 ring-rose-400/50';
}
function barColor(pct) {
  if (pct >= 100) return 'bg-emerald-400';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-rose-400';
}

export default function ApresentacaoForecast() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [weekKey, setWeekKey] = useState(currentWeekKey());
  const [data, setData] = useState({
    metasMensal: {}, metasSemanal: {}, fatMensal: {}, fatSemanal: {},
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const wRange = weekKeyRange(weekKey);
      const [y, m] = monthKey.split('-').map(Number);
      const today = new Date().toISOString().slice(0, 10);
      const monthFirst = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const monthLast = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const mRange = { datemin: monthFirst, datemax: monthLast < today ? monthLast : today };
      const wRange2 = wRange ? { datemin: wRange.datemin, datemax: wRange.datemax < today ? wRange.datemax : today } : mRange;

      const [metasMRes, metasSRes, fatM, fatS] = await Promise.all([
        fetch(`${API_BASE_URL}/api/crm/canal-metas?period_type=mensal&period_key=${monthKey}`, { headers: { 'x-api-key': API_KEY } }).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/crm/canal-metas?period_type=semanal&period_key=${weekKey}`, { headers: { 'x-api-key': API_KEY } }).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/crm/faturamento-por-segmento?lite=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ ...mRange, lite: true }),
        }).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/crm/faturamento-por-segmento?lite=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ ...wRange2, lite: true }),
        }).then(r => r.json()),
      ]);

      const metasMensal = {};
      for (const m of metasMRes?.data?.metas || []) metasMensal[m.canal] = Number(m.valor_meta);
      const metasSemanal = {};
      for (const m of metasSRes?.data?.metas || []) metasSemanal[m.canal] = Number(m.valor_meta);
      const fatMensal = { ...(fatM?.data?.segmentos || fatM?.segmentos || {}) };
      const fatSemanal = { ...(fatS?.data?.segmentos || fatS?.segmentos || {}) };
      fatMensal.fabrica = FABRICA_SOURCES.reduce((s, c) => s + Number(fatMensal[c] || 0), 0);
      fatSemanal.fabrica = FABRICA_SOURCES.reduce((s, c) => s + Number(fatSemanal[c] || 0), 0);

      setData({ metasMensal, metasSemanal, fatMensal, fatSemanal });
      setLastUpdate(new Date());
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [monthKey, weekKey]);

  useEffect(() => { carregar(); }, [carregar]);

  // Auto-refresh a cada 5 min (não busca se data está em estado de erro/carregando)
  useEffect(() => {
    const id = setInterval(() => carregar(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [carregar]);

  // Auto-fullscreen: tenta na carga; se browser bloquear, ativa no 1º clique
  // (qualquer lugar da página conta como user gesture).
  useEffect(() => {
    const tryFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    };
    // Tenta automático (funciona se a janela foi aberta com user gesture)
    const t = setTimeout(tryFullscreen, 200);

    // Fallback: ativa no 1º clique em qualquer lugar
    const onFirstClick = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
      window.removeEventListener('click', onFirstClick);
    };
    window.addEventListener('click', onFirstClick, { once: false });

    return () => {
      clearTimeout(t);
      window.removeEventListener('click', onFirstClick);
    };
  }, []);

  // Calcula linhas visíveis (canais com meta ou fat)
  const canais = ORDEM.filter((c) => {
    return (data.metasMensal[c] || 0) > 0
      || (data.metasSemanal[c] || 0) > 0
      || (data.fatMensal[c] || 0) > 0
      || (data.fatSemanal[c] || 0) > 0;
  });

  // Totais
  const totMetaSem = canais.reduce((s, c) => s + (data.metasSemanal[c] || 0), 0);
  const totFatSem = canais.reduce((s, c) => s + (data.fatSemanal[c] || 0), 0);
  const totMetaMes = canais.reduce((s, c) => s + (data.metasMensal[c] || 0), 0);
  const totFatMes = canais.reduce((s, c) => s + (data.fatMensal[c] || 0), 0);
  const pctSemTotal = totMetaSem > 0 ? (totFatSem / totMetaSem) * 100 : 0;
  const pctMesTotal = totMetaMes > 0 ? (totFatMes / totMetaMes) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b1e] via-[#0f1029] to-[#1a1b3a] text-white p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            Faturamento <span className="text-blue-400">×</span> Meta
          </h1>
          <p className="text-blue-300/80 text-sm mt-1">
            Semana <b className="text-blue-200">{weekKey}</b> · Mês <b className="text-indigo-200">{monthKey}</b>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-blue-300/70">
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {loading && (
            <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded animate-pulse">
              atualizando…
            </span>
          )}
          <button
            onClick={carregar}
            className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 border border-white/20"
          >
            ↻ Atualizar
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}
            className="text-xs px-3 py-1.5 rounded bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/40 text-blue-100"
          >
            ⛶ Tela cheia
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-rose-900/40 border border-rose-500/40 rounded p-3 mb-4 text-rose-200 text-sm">
          Erro: {erro}
        </div>
      )}

      {/* KPIs gigantes */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white/5 backdrop-blur-sm border border-blue-400/30 rounded-2xl p-5">
          <p className="text-[11px] text-blue-300 uppercase tracking-wider font-bold mb-1">Semana {weekKey}</p>
          <p className="text-5xl font-black tabular-nums">R$ {fmtBRLCompact(totFatSem)}</p>
          <p className="text-sm text-blue-200/80 mt-1">
            de R$ {fmtBRLCompact(totMetaSem)} · <b className={pctSemTotal >= 100 ? 'text-emerald-300' : pctSemTotal >= 70 ? 'text-amber-300' : 'text-rose-300'}>{pctSemTotal.toFixed(1)}%</b>
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-indigo-400/30 rounded-2xl p-5">
          <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-bold mb-1">Mês {monthKey}</p>
          <p className="text-5xl font-black tabular-nums">R$ {fmtBRLCompact(totFatMes)}</p>
          <p className="text-sm text-indigo-200/80 mt-1">
            de R$ {fmtBRLCompact(totMetaMes)} · <b className={pctMesTotal >= 100 ? 'text-emerald-300' : pctMesTotal >= 70 ? 'text-amber-300' : 'text-rose-300'}>{pctMesTotal.toFixed(1)}%</b>
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03]">
        <table className="w-full">
          <thead>
            <tr>
              <th className="py-3 px-4 text-left text-[11px] font-black text-slate-300 uppercase tracking-wider bg-slate-800/60">Canal</th>
              <th className="py-3 px-4 text-right text-[11px] font-black text-blue-200 uppercase tracking-wider bg-blue-600/30" colSpan={3}>Semana</th>
              <th className="py-3 px-4 text-right text-[11px] font-black text-indigo-200 uppercase tracking-wider bg-indigo-600/30" colSpan={3}>Mês</th>
            </tr>
            <tr className="text-[10px] text-blue-200/80 font-bold uppercase tracking-wider bg-white/[0.02]">
              <th className="py-2 px-4 text-left"></th>
              <th className="py-2 px-4 text-right">Meta</th>
              <th className="py-2 px-4 text-right">Realizado</th>
              <th className="py-2 px-4 text-right">%</th>
              <th className="py-2 px-4 text-right text-indigo-200/80">Meta</th>
              <th className="py-2 px-4 text-right text-indigo-200/80">Realizado</th>
              <th className="py-2 px-4 text-right text-indigo-200/80">%</th>
            </tr>
          </thead>
          <tbody>
            {canais.map((c, idx) => {
              const metaS = data.metasSemanal[c] || 0;
              const fatS = data.fatSemanal[c] || 0;
              const metaM = data.metasMensal[c] || 0;
              const fatM = data.fatMensal[c] || 0;
              const pctS = metaS > 0 ? (fatS / metaS) * 100 : 0;
              const pctM = metaM > 0 ? (fatM / metaM) * 100 : 0;
              return (
                <tr key={c} className={`border-t border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="py-3 px-4 font-bold text-base">{CANAL_LABELS[c] || c}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-blue-200/80">
                    {metaS > 0 ? `R$ ${fmtBRLCompact(metaS)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-base">
                    R$ {fmtBRLCompact(fatS)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {metaS > 0 ? (
                      <div className="inline-flex flex-col items-end gap-1">
                        <span className={`text-sm font-black px-2 py-0.5 rounded ring-1 ${pctTone(pctS)}`}>
                          {pctS.toFixed(1)}%
                        </span>
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor(pctS)}`} style={{ width: `${Math.min(100, pctS)}%` }} />
                        </div>
                      </div>
                    ) : <span className="text-white/30">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-indigo-200/80">
                    {metaM > 0 ? `R$ ${fmtBRLCompact(metaM)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-base">
                    R$ {fmtBRLCompact(fatM)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {metaM > 0 ? (
                      <div className="inline-flex flex-col items-end gap-1">
                        <span className={`text-sm font-black px-2 py-0.5 rounded ring-1 ${pctTone(pctM)}`}>
                          {pctM.toFixed(1)}%
                        </span>
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor(pctM)}`} style={{ width: `${Math.min(100, pctM)}%` }} />
                        </div>
                      </div>
                    ) : <span className="text-white/30">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/20 bg-white/5 font-black">
              <td className="py-4 px-4 uppercase text-sm tracking-widest">Total</td>
              <td className="py-4 px-4 text-right tabular-nums text-base">R$ {fmtBRLCompact(totMetaSem)}</td>
              <td className="py-4 px-4 text-right tabular-nums text-lg">R$ {fmtBRLCompact(totFatSem)}</td>
              <td className="py-4 px-4 text-right">
                <span className={`text-base font-black px-3 py-1 rounded ring-1 ${pctTone(pctSemTotal)}`}>
                  {pctSemTotal.toFixed(1)}%
                </span>
              </td>
              <td className="py-4 px-4 text-right tabular-nums text-base text-indigo-200/80">R$ {fmtBRLCompact(totMetaMes)}</td>
              <td className="py-4 px-4 text-right tabular-nums text-lg">R$ {fmtBRLCompact(totFatMes)}</td>
              <td className="py-4 px-4 text-right">
                <span className={`text-base font-black px-3 py-1 rounded ring-1 ${pctTone(pctMesTotal)}`}>
                  {pctMesTotal.toFixed(1)}%
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-center text-[10px] text-white/30 mt-3">
        Auto-refresh a cada 5min · líquido aproximado (modo lite — sem credev em payments) · franquia em modo full
      </p>
    </div>
  );
}
