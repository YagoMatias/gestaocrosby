import React, { useState, useMemo } from 'react';
import { useDespesasGerais, MONTH_KEYS, MES_SHORT, fmtBRL } from './store';
import { CardBox } from './comum';

const MCOLS = {
  jan: '#2b4fd0',
  fev: '#0e9aa0',
  mar: '#c07d00',
  abr: '#7c3aed',
  mai: '#12a150',
  jun: '#e0533f',
  jul: '#7c4a03',
  ago: '#2b4fd0',
  set: '#0e9aa0',
  out: '#c07d00',
  nov: '#7c3aed',
  dez: '#12a150',
};

function Spark({ vals, color }) {
  const mx = Math.max(...vals, 1);
  const W = 78;
  const H = 22;
  const n = vals.length;
  const pts = vals
    .map((val, i) => {
      const x = (i / (n - 1)) * (W - 6) + 3;
      const y = H - 3 - (val / mx) * (H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const last = vals[n - 1];
  const lx = W - 3;
  const ly = H - 3 - (last / mx) * (H - 6);
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}

// primeiro/último mês com valor > 0 e variação entre eles
function seqInfo(v, meses) {
  const seq = meses.map((k) => v[k]);
  const fi = seq.findIndex((x) => x > 0);
  let li = -1;
  for (let i = seq.length - 1; i >= 0; i--)
    if (seq[i] > 0) {
      li = i;
      break;
    }
  return { seq, fi, li };
}

function Tendencia({ v, meses }) {
  const { seq, fi, li } = seqInfo(v, meses);
  if (fi < 0 || li <= fi)
    return <span className="text-gray-300 text-[10px]">—</span>;
  const pct = ((seq[li] - seq[fi]) / seq[fi]) * 100;
  const up = pct > 0.5;
  const down = pct < -0.5;
  return (
    <span
      className="text-[11px] font-semibold whitespace-nowrap"
      style={{ color: up ? '#dc2626' : down ? '#12a150' : '#6b7392' }}
    >
      {up ? '▲' : down ? '▼' : '■'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function AnaliseHorizontal() {
  const { months, mesesAtivos } = useDespesasGerais();
  const MESES = mesesAtivos.length ? mesesAtivos : MONTH_KEYS.slice(0, 1);
  const [search, setSearch] = useState('');

  const { rows, totals, grand } = useMemo(() => {
    const allCats = new Map();
    MESES.forEach((m) => {
      months[m].summary.forEach((s) => {
        if (!allCats.has(s.cat)) {
          const v = {};
          MESES.forEach((k) => (v[k] = 0));
          allCats.set(s.cat, v);
        }
        allCats.get(s.cat)[m] = s.total;
      });
    });
    let rows = Array.from(allCats.entries())
      .map(([cat, v]) => ({
        cat,
        v,
        tot: MESES.reduce((s, k) => s + v[k], 0),
      }))
      .filter((r) => r.tot > 0)
      .sort((a, b) => b.tot - a.tot);
    const totals = {};
    MESES.forEach((k) => (totals[k] = 0));
    rows.forEach((r) => MESES.forEach((k) => (totals[k] += r.v[k])));
    const grand = rows.reduce((s, r) => s + r.tot, 0);
    return { rows, totals, grand };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, mesesAtivos]);

  const sq = search.toLowerCase();
  const shown = sq ? rows.filter((r) => r.cat.toLowerCase().includes(sq)) : rows;

  return (
    <CardBox
      title="Análise horizontal — evolução por despesa"
      subtitle={`como cada despesa variou de ${MES_SHORT[MESES[0]]} a ${MES_SHORT[MESES[MESES.length - 1]]} · ordenado pelo total do período`}
      actions={
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar despesa…"
          className="border border-[#000638]/20 rounded-lg px-2.5 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-1 focus:ring-[#000638] w-48"
        />
      }
    >
      <div
        className="overflow-x-auto"
        style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}
      >
        <table className="w-full text-[11px] whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#000638] text-white">
              <th className="px-3 py-2 text-left font-semibold">Despesa</th>
              {MESES.map((k) => (
                <th key={k} className="px-2 py-2 text-right font-semibold">
                  {MES_SHORT[k]}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">
                Total período
              </th>
              <th className="px-2 py-2 text-right font-semibold">%</th>
              <th className="px-2 py-2 text-center font-semibold">Evolução</th>
              <th className="px-2 py-2 text-right font-semibold">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const { seq, fi, li } = seqInfo(r.v, MESES);
              let sc = '#6b7392';
              if (fi >= 0 && li > fi)
                sc =
                  seq[li] > seq[fi]
                    ? '#dc2626'
                    : seq[li] < seq[fi]
                      ? '#12a150'
                      : '#6b7392';
              return (
                <tr
                  key={r.cat}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-1.5 font-medium text-[#000638] max-w-[260px] truncate" title={r.cat}>
                    {r.cat}
                  </td>
                  {MESES.map((k) => (
                    <td
                      key={k}
                      className="px-2 py-1.5 text-right"
                      style={{ color: r.v[k] ? MCOLS[k] : '#d1d5db' }}
                    >
                      {r.v[k] ? fmtBRL(r.v[k]) : '—'}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-bold text-[#000638]">
                    {fmtBRL(r.tot)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-400">
                    {grand > 0 ? ((r.tot / grand) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-2 py-1 text-center">
                    <Spark vals={MESES.map((k) => r.v[k])} color={sc} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Tendencia v={r.v} meses={MESES} />
                  </td>
                </tr>
              );
            })}
            <tr className="bg-gray-100 font-bold text-[#000638]">
              <td className="px-3 py-2">Total</td>
              {MESES.map((k) => (
                <td key={k} className="px-2 py-2 text-right">
                  {fmtBRL(totals[k])}
                </td>
              ))}
              <td className="px-2 py-2 text-right">{fmtBRL(grand)}</td>
              <td className="px-2 py-2 text-right">100%</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardBox>
  );
}
