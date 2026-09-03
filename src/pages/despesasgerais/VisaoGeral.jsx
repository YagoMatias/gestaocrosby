import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { CurrencyDollar, TrendUp, TrendDown, Coins } from '@phosphor-icons/react';
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
  const { months, fcTotalFor, mesesAtivos } = useDespesasGerais();
  const MESES = mesesAtivos.length ? mesesAtivos : MONTH_KEYS.slice(0, 1);

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
    const best = comp.length
      ? comp.slice().sort((a, b) => b.pct - a.pct)[0]
      : null;
    return { rows, comp, sr, sf, se, pctAcc, best };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, fcTotalFor, mesesAtivos]);

  const { rows, comp, sr, sf, se, pctAcc, best } = dados;
  const nMeses = MESES.length;
  const labels = MESES.map((m) => MES_SHORT[m]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: { label: (c) => `${c.dataset.label}: ${fmtBRL(c.raw)}` },
      },
      datalabels: { display: false },
    },
    scales: {
      y: { ticks: { font: { size: 10 }, callback: (v) => fmtBRL0(v) } },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label={`Realizado — ${nMeses} meses`}
          value={fmtBRL0(sr)}
          sub={`${nMeses} ${nMeses === 1 ? 'mês' : 'meses'} · ${MES_NOME[MESES[0]]} a ${MES_NOME[MESES[nMeses - 1]]}`}
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
          value={
            <span style={{ color: se >= 0 ? VERDE : VERMELHO }}>{fmtBRL0(se)}</span>
          }
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
          sub={
            best
              ? `melhor mês: ${MES_NOME[best.m]} (+${best.pct.toFixed(1)}%)`
              : '—'
          }
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
                {
                  label: 'Realizado',
                  data: rows.map((x) => x.r),
                  backgroundColor: AZUL,
                  borderRadius: 4,
                },
                {
                  label: 'Previsto',
                  data: rows.map((x) => (x.tem ? x.f : null)),
                  backgroundColor: ROXO + '99',
                  borderRadius: 4,
                },
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
                  backgroundColor: rows.map((x) =>
                    x.eco >= 0 ? VERDE : VERMELHO,
                  ),
                  borderRadius: 4,
                },
              ],
            }}
            options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: false } } }}
          />
        </div>
      </CardBox>

      <CardBox
        title="Detalhamento mês a mês"
        subtitle="valores consolidados de todas as despesas do mês"
      >
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
                  <td className="px-3 py-2 font-medium text-[#000638]">
                    {MES_NOME[x.m]}
                  </td>
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
                <td
                  className="px-3 py-2 text-right"
                  style={{ color: se >= 0 ? VERDE : VERMELHO }}
                >
                  {fmtBRL(se)}
                </td>
                <td
                  className="px-3 py-2 text-right"
                  style={{ color: se >= 0 ? VERDE : VERMELHO }}
                >
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
