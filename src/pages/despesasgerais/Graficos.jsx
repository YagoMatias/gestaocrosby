import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  useDespesasGerais,
  groupOf,
  MONTH_KEYS,
  MES_SHORT,
  MES_PREFIX,
  fmtBRL,
  fmtBRL0,
} from './store';
import { CardBox } from './comum';

const AZUL = '#000638';
const ROXO = '#7c3aed';
const VERDE = '#12a150';
const VERMELHO = '#dc2626';

const clip = (s) => (s.length > 26 ? s.slice(0, 24) + '…' : s);

export default function Graficos() {
  const { months, forecasts, fcTotalFor, mesesAtivos } = useDespesasGerais();
  const MESES = mesesAtivos.length ? mesesAtivos : MONTH_KEYS.slice(0, 1);

  const { units, mreals, mfcs, ecoAcc } = useMemo(() => {
    // rótulo por "unidade" (grupos mesclados contam como um só)
    const unitLabel = (cat) => {
      const g = groupOf(cat);
      return g ? g.canon : cat;
    };
    const realized = {};
    const forecast = {};
    MESES.forEach((m) => {
      const mo = months[m];
      const seen = new Set();
      mo.summary.forEach((s) => {
        const l = unitLabel(s.cat);
        realized[l] = (realized[l] || 0) + s.total;
        const key = MES_PREFIX[m] + l;
        if (seen.has(key)) return;
        seen.add(key);
        const v = forecasts[key];
        if (v !== undefined && v !== null && v !== '')
          forecast[l] = (forecast[l] || 0) + (parseFloat(v) || 0);
      });
    });
    const units = Object.keys(realized).map((l) => ({
      l,
      r: realized[l],
      f: forecast[l] || 0,
      v: realized[l] - (forecast[l] || 0),
    }));
    const mreals = MESES.map((k) => months[k].total);
    const mfcs = MESES.map((k) => {
      const t = fcTotalFor(k);
      return t > 0 ? t : null;
    });
    let acc = 0;
    const ecoAcc = MESES.map((k) => {
      const f = fcTotalFor(k);
      if (f > 0) acc += f - months[k].total;
      return Math.round(acc * 100) / 100;
    });
    return { units, mreals, mfcs, ecoAcc };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, forecasts, fcTotalFor, mesesAtivos]);

  const top = units.slice().sort((a, b) => b.r - a.r).slice(0, 12);
  const dev = units
    .filter((u) => Math.abs(u.v) >= 0.01)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 12);
  const labels = MESES.map((k) => MES_SHORT[k]);

  const hOpts = {
    indexAxis: 'y',
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
      x: { ticks: { font: { size: 9 }, callback: (v) => fmtBRL0(v) } },
      y: { ticks: { font: { size: 10 } } },
    },
  };

  const vOpts = {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardBox
          title="Onde o dinheiro foi — Top 12 despesas"
          subtitle={`realizado acumulado no período (${MES_SHORT[MESES[0]]} a ${MES_SHORT[MESES[MESES.length - 1]]})`}
        >
          <div className="p-4" style={{ height: 420 }}>
            <Bar
              data={{
                labels: top.map((u) => clip(u.l)),
                datasets: [
                  {
                    label: 'Realizado',
                    data: top.map((u) => u.r),
                    backgroundColor: AZUL,
                    borderRadius: 3,
                  },
                  {
                    label: 'Previsto',
                    data: top.map((u) => u.f || null),
                    backgroundColor: ROXO + '99',
                    borderRadius: 3,
                  },
                ],
              }}
              options={hOpts}
            />
          </div>
        </CardBox>
        <CardBox
          title="Maiores desvios do orçamento"
          subtitle="Realizado − Previsto · vermelho = estourou · verde = economizou"
        >
          <div className="p-4" style={{ height: 420 }}>
            <Bar
              data={{
                labels: dev.map((u) => clip(u.l)),
                datasets: [
                  {
                    label: 'Desvio',
                    data: dev.map((u) => u.v),
                    backgroundColor: dev.map((u) =>
                      u.v > 0 ? VERMELHO : VERDE,
                    ),
                    borderRadius: 3,
                  },
                ],
              }}
              options={{
                ...hOpts,
                plugins: { ...hOpts.plugins, legend: { display: false } },
              }}
            />
          </div>
        </CardBox>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardBox
          title="Evolução mensal — Realizado × Previsto"
          subtitle="azul = gasto real · roxo tracejado = orçado"
        >
          <div className="p-4" style={{ height: 300 }}>
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: 'Realizado',
                    data: mreals,
                    borderColor: AZUL,
                    backgroundColor: AZUL + '22',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                  },
                  {
                    label: 'Previsto',
                    data: mfcs,
                    borderColor: ROXO,
                    borderDash: [6, 4],
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: 3,
                  },
                ],
              }}
              options={vOpts}
            />
          </div>
        </CardBox>
        <CardBox
          title="Economia acumulada no período"
          subtitle="soma da economia mês a mês (Previsto − Realizado)"
        >
          <div className="p-4" style={{ height: 300 }}>
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: 'Economia acumulada',
                    data: ecoAcc,
                    borderColor: VERDE,
                    backgroundColor: VERDE + '22',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                  },
                ],
              }}
              options={{
                ...vOpts,
                plugins: { ...vOpts.plugins, legend: { display: false } },
              }}
            />
          </div>
        </CardBox>
      </div>
    </div>
  );
}
