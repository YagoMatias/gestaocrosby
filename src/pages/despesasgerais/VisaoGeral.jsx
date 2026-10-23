import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  CurrencyDollar,
  TrendUp,
  TrendDown,
  Coins,
  CheckCircle,
  LockSimple,
  Warning,
  Flag,
  Scissors,
  Scales,
  CaretRight,
} from '@phosphor-icons/react';
import {
  useDespesasGerais,
  MONTH_KEYS,
  MES_NOME,
  MES_SHORT,
  fmtBRL,
  fmtBRL0,
} from './store';
import { CardBox } from './comum';

const AZUL = '#000638';
const ROXO = '#7c3aed';
const VERDE = '#12a150';
const VERMELHO = '#dc2626';

function Kpi({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={16} className={color} weight="bold" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold text-[#000638]">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function VisaoGeral() {
  const {
    months,
    forecasts,
    fcTotalFor,
    forecastPadraoFor,
    fcKeyFor,
    mesesAtivos,
    activeMonth,
    catAnalisada,
    catTravada,
    flagCounts,
  } = useDespesasGerais();
  const navigate = useNavigate();
  const MESES = mesesAtivos.length ? mesesAtivos : MONTH_KEYS.slice(0, 1);

  // ── Mês selecionado (barra de cima) ───────────────────────────────
  const mesAtual = useMemo(() => {
    const mo = months[activeMonth];
    const real = mo ? mo.total : 0;
    const fc = fcTotalFor(activeMonth);
    const temFc = fc > 0;
    const eco = temFc ? fc - real : 0;
    const pct = temFc ? (eco / fc) * 100 : 0;

    // agrupa por unidade de forecast (grupos de "forecast único" somam juntos)
    const porFc = new Map();
    (mo ? mo.summary : []).forEach((s) => {
      const key = fcKeyFor(s.cat, activeMonth);
      const cur = porFc.get(key) || { label: s.cat, real: 0, fc: null };
      cur.real += s.total;
      if (cur.fc == null) {
        cur.fc =
          forecasts[key] !== undefined
            ? parseFloat(forecasts[key])
            : forecastPadraoFor(s.cat, activeMonth);
      }
      porFc.set(key, cur);
    });
    const linhas = [...porFc.values()].map((l) => ({
      ...l,
      fc: l.fc || 0,
      dif: l.real - (l.fc || 0),
    }));
    const top5 = linhas.slice().sort((a, b) => b.real - a.real).slice(0, 5);
    const estouraram = linhas
      .filter((l) => l.fc > 0 && l.real > l.fc)
      .sort((a, b) => b.dif - a.dif);

    const cats = mo ? mo.summary.map((s) => s.cat) : [];
    const nTotal = cats.length;
    const nAnalisadas = cats.filter((c) => catAnalisada(activeMonth, c)).length;
    const nTravadas = cats.filter((c) => catTravada(activeMonth, c)).length;

    return {
      real,
      fc,
      temFc,
      eco,
      pct,
      top5,
      estouraram,
      nTotal,
      nAnalisadas,
      nTravadas,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, forecasts, activeMonth]);

  // ── Acumulado do ano (meses ativos) ───────────────────────────────
  const dados = useMemo(() => {
    const rows = MESES.map((m) => {
      const r = months[m].total;
      const f = fcTotalFor(m);
      const tem = f > 0;
      return { m, r, f, tem, eco: tem ? f - r : 0, pct: tem ? ((f - r) / f) * 100 : 0 };
    });
    const comp = rows.filter((x) => x.tem);
    const sr = rows.reduce((s, x) => s + x.r, 0);
    const sf = comp.reduce((s, x) => s + x.f, 0);
    const srComp = comp.reduce((s, x) => s + x.r, 0);
    const se = sf - srComp;
    const pctAcc = sf > 0 ? (se / sf) * 100 : 0;
    const best = comp.length ? comp.slice().sort((a, b) => b.pct - a.pct)[0] : null;
    return { rows, comp, sr, sf, se, pctAcc, best };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, fcTotalFor, mesesAtivos]);

  const { rows, comp, sr, sf, se, pctAcc, best } = dados;
  const nMeses = MESES.length;
  const labels = MESES.map((m) => MES_SHORT[m]);
  const naoAnalisadas = mesAtual.nTotal - mesAtual.nAnalisadas;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtBRL(c.raw)}` } },
      datalabels: { display: false },
    },
    scales: {
      y: { ticks: { font: { size: 10 }, callback: (v) => fmtBRL0(v) } },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  const Atalho = ({ cor, icon: Icon, label, valor, to }) => (
    <button
      onClick={() => navigate(to)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:shadow-sm ${cor}`}
    >
      <Icon size={18} weight="bold" />
      <div className="leading-tight">
        <div className="text-sm font-bold">{valor}</div>
        <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      </div>
      <CaretRight size={14} className="ml-auto opacity-60" />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ── Cartões do mês selecionado ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label={`Realizado — ${MES_NOME[activeMonth]}`}
          value={fmtBRL0(mesAtual.real)}
          sub={`${mesAtual.nTotal} despesa${mesAtual.nTotal === 1 ? '' : 's'} no mês`}
          icon={CurrencyDollar}
          color="text-blue-700"
        />
        <Kpi
          label="Forecast do mês"
          value={mesAtual.temFc ? fmtBRL0(mesAtual.fc) : '—'}
          sub={mesAtual.temFc ? 'orçado para o mês' : 'sem forecast no mês'}
          icon={TrendUp}
          color="text-violet-600"
        />
        <Kpi
          label="Economia do mês"
          value={
            mesAtual.temFc ? (
              <span style={{ color: mesAtual.eco >= 0 ? VERDE : VERMELHO }}>
                {fmtBRL0(mesAtual.eco)}
              </span>
            ) : (
              '—'
            )
          }
          sub={
            mesAtual.temFc
              ? mesAtual.eco >= 0
                ? `▼ ${mesAtual.pct.toFixed(1)}% abaixo do previsto`
                : `▲ ${Math.abs(mesAtual.pct).toFixed(1)}% acima do previsto`
              : '—'
          }
          icon={mesAtual.eco >= 0 ? TrendDown : TrendUp}
          color={mesAtual.eco >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <Kpi
          label="Análise do mês"
          value={`${mesAtual.nAnalisadas} / ${mesAtual.nTotal} ✔`}
          sub={`${mesAtual.nTravadas} travada${mesAtual.nTravadas === 1 ? '' : 's'} 🔒 · ${naoAnalisadas} a analisar`}
          icon={CheckCircle}
          color="text-emerald-600"
        />
      </div>

      {/* ── Atalhos / pendências ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Atalho
          cor="bg-blue-50 border-blue-200 text-blue-800"
          icon={LockSimple}
          valor={`${naoAnalisadas} a analisar`}
          label="ir para a DRE Analítica"
          to="/despesas-gerais/dre-analitica"
        />
        <Atalho
          cor="bg-amber-50 border-amber-200 text-amber-800"
          icon={Flag}
          valor={`${flagCounts.correcao} correç${flagCounts.correcao === 1 ? 'ão' : 'ões'}`}
          label="Correções DRE"
          to="/despesas-gerais/correcoes"
        />
        <Atalho
          cor="bg-red-50 border-red-200 text-red-800"
          icon={Scissors}
          valor={`${flagCounts.corte} corte${flagCounts.corte === 1 ? '' : 's'}`}
          label="Corte de custo"
          to="/despesas-gerais/corte"
        />
        <Atalho
          cor="bg-emerald-50 border-emerald-200 text-emerald-800"
          icon={Scales}
          valor="Auditoria"
          label="DRE × Dryland"
          to="/despesas-gerais/auditoria"
        />
      </div>

      {/* ── Top 5 e despesas estouradas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardBox
          title={`Top 5 despesas — ${MES_NOME[activeMonth]}`}
          subtitle="maiores gastos do mês e a diferença vs o forecast"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#000638] text-white">
                  <th className="px-3 py-2 text-left font-semibold">Despesa</th>
                  <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                  <th className="px-3 py-2 text-right font-semibold">vs Forecast</th>
                </tr>
              </thead>
              <tbody>
                {mesAtual.top5.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-400">
                      Sem despesas no mês.
                    </td>
                  </tr>
                ) : (
                  mesAtual.top5.map((l) => (
                    <tr key={l.label} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium text-[#000638] max-w-[220px] truncate" title={l.label}>
                        {l.label}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmtBRL(l.real)}</td>
                      <td
                        className="px-3 py-1.5 text-right font-semibold"
                        style={{ color: l.fc <= 0 ? '#9ca3af' : l.dif > 0 ? VERMELHO : VERDE }}
                      >
                        {l.fc <= 0 ? '—' : `${l.dif > 0 ? '+' : ''}${fmtBRL(l.dif)}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBox>

        <CardBox
          title={`Despesas acima do forecast — ${MES_NOME[activeMonth]}`}
          subtitle="gastaram mais do que o orçado no mês"
          actions={
            mesAtual.estouraram.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                <Warning size={12} weight="bold" /> {mesAtual.estouraram.length}
              </span>
            )
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[#000638] text-white">
                  <th className="px-3 py-2 text-left font-semibold">Despesa</th>
                  <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                  <th className="px-3 py-2 text-right font-semibold">Forecast</th>
                  <th className="px-3 py-2 text-right font-semibold">Estouro</th>
                </tr>
              </thead>
              <tbody>
                {mesAtual.estouraram.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-green-600">
                      Nenhuma despesa acima do forecast. 🎉
                    </td>
                  </tr>
                ) : (
                  mesAtual.estouraram.slice(0, 8).map((l) => (
                    <tr key={l.label} className="border-b border-gray-100 hover:bg-red-50/40">
                      <td className="px-3 py-1.5 font-medium text-[#000638] max-w-[200px] truncate" title={l.label}>
                        {l.label}
                      </td>
                      <td className="px-3 py-1.5 text-right">{fmtBRL(l.real)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{fmtBRL(l.fc)}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-red-600">
                        +{fmtBRL(l.dif)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBox>
      </div>

      {/* ── Acumulado do ano ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label={`Realizado — ${nMeses} ${nMeses === 1 ? 'mês' : 'meses'}`}
          value={fmtBRL0(sr)}
          sub={`${MES_NOME[MESES[0]]} a ${MES_NOME[MESES[nMeses - 1]]}`}
          icon={CurrencyDollar}
          color="text-blue-700"
        />
        <Kpi
          label="Previsto (forecast)"
          value={fmtBRL0(sf)}
          sub={`${comp.length} ${comp.length === 1 ? 'mês' : 'meses'} com forecast`}
          icon={TrendUp}
          color="text-violet-600"
        />
        <Kpi
          label="Economia acumulada"
          value={<span style={{ color: se >= 0 ? VERDE : VERMELHO }}>{fmtBRL0(se)}</span>}
          sub={
            se >= 0
              ? `▼ ${pctAcc.toFixed(1)}% abaixo do previsto`
              : `▲ ${Math.abs(pctAcc).toFixed(1)}% acima do previsto`
          }
          icon={se >= 0 ? TrendDown : TrendUp}
          color={se >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <Kpi
          label="Economia média / mês"
          value={fmtBRL0(comp.length ? se / comp.length : 0)}
          sub={best ? `melhor mês: ${MES_NOME[best.m]} (+${best.pct.toFixed(1)}%)` : '—'}
          icon={Coins}
          color="text-teal-600"
        />
      </div>

      <CardBox
        title="Realizado × Previsto por mês"
        subtitle="azul = gasto real · roxo = orçado (forecast)"
      >
        <div className="p-4" style={{ height: 300 }}>
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Realizado', data: rows.map((x) => x.r), backgroundColor: AZUL, borderRadius: 4 },
                { label: 'Previsto', data: rows.map((x) => (x.tem ? x.f : null)), backgroundColor: ROXO + '99', borderRadius: 4 },
              ],
            }}
            options={chartOpts}
          />
        </div>
      </CardBox>

      <CardBox
        title="Economia por mês (Previsto − Realizado)"
        subtitle="verde = gastou menos que o previsto · vermelho = acima do previsto"
      >
        <div className="p-4" style={{ height: 240 }}>
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: 'Economia',
                  data: rows.map((x) => (x.tem ? x.eco : null)),
                  backgroundColor: rows.map((x) => (x.eco >= 0 ? VERDE : VERMELHO)),
                  borderRadius: 4,
                },
              ],
            }}
            options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: false } } }}
          />
        </div>
      </CardBox>

      <CardBox title="Detalhamento mês a mês" subtitle="valores consolidados de todas as despesas do mês">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-3 py-2 text-left font-semibold">Mês</th>
                <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                <th className="px-3 py-2 text-right font-semibold">Previsto</th>
                <th className="px-3 py-2 text-right font-semibold">Economia</th>
                <th className="px-3 py-2 text-right font-semibold">% Economia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.m} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-[#000638]">{MES_NOME[x.m]}</td>
                  <td className="px-3 py-2 text-right">{fmtBRL(x.r)}</td>
                  <td className="px-3 py-2 text-right">
                    {x.tem ? fmtBRL(x.f) : <span className="text-gray-300">—</span>}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-semibold"
                    style={{ color: !x.tem ? '#9ca3af' : x.eco >= 0 ? VERDE : VERMELHO }}
                  >
                    {x.tem ? fmtBRL(x.eco) : '—'}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-semibold"
                    style={{ color: !x.tem ? '#9ca3af' : x.eco >= 0 ? VERDE : VERMELHO }}
                  >
                    {x.tem ? `${x.pct >= 0 ? '+' : ''}${x.pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold text-[#000638]">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{fmtBRL(sr)}</td>
                <td className="px-3 py-2 text-right">{fmtBRL(sf)}</td>
                <td className="px-3 py-2 text-right" style={{ color: se >= 0 ? VERDE : VERMELHO }}>
                  {fmtBRL(se)}
                </td>
                <td className="px-3 py-2 text-right" style={{ color: se >= 0 ? VERDE : VERMELHO }}>
                  {`${pctAcc >= 0 ? '+' : ''}${pctAcc.toFixed(1)}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardBox>
    </div>
  );
}
