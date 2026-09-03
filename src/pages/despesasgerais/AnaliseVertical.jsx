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
const COLS = ['#2b4fd0', '#12a150', '#c07d00', '#0e9aa0', '#7c3aed', '#dc2626'];

export default function AnaliseVertical() {
  const { months, mesesAtivos } = useDespesasGerais();
  const MESES = mesesAtivos.length ? mesesAtivos : MONTH_KEYS.slice(0, 1);
  const [search, setSearch] = useState('');

  const { rows, grand, maxAv, monthTot } = useMemo(() => {
    const monthTot = {};
    MESES.forEach((k) => (monthTot[k] = months[k].total));
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
    const rows = Array.from(allCats.entries())
      .map(([cat, v]) => ({
        cat,
        v,
        tot: MESES.reduce((s, k) => s + v[k], 0),
      }))
      .filter((r) => r.tot > 0)
      .sort((a, b) => b.tot - a.tot);
    const grand = rows.reduce((s, r) => s + r.tot, 0);
    const maxAv =
      grand > 0
        ? rows.reduce((m, r) => Math.max(m, (r.tot / grand) * 100), 0)
        : 1;
    return { rows, grand, maxAv, monthTot };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, mesesAtivos]);

  const sq = search.toLowerCase();
  const shown = sq ? rows.filter((r) => r.cat.toLowerCase().includes(sq)) : rows;

  return (
    <CardBox
      title="Análise vertical — composição das despesas"
      subtitle="peso de cada despesa no total · participação % (AV) acumulada e por mês"
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
              <th className="px-2 py-2 text-right font-semibold">
                Total período
              </th>
              <th className="px-2 py-2 text-left font-semibold min-w-[220px]">
                Participação (AV acumulada)
              </th>
              {MESES.map((k) => (
                <th key={k} className="px-2 py-2 text-right font-semibold">
                  % {MES_SHORT[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const av = grand > 0 ? (r.tot / grand) * 100 : 0;
              const barW = maxAv > 0 ? (av / maxAv) * 100 : 0;
              const color = COLS[i % COLS.length];
              const avm = (k) =>
                monthTot[k] > 0 ? (r.v[k] / monthTot[k]) * 100 : 0;
              return (
                <tr
                  key={r.cat}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-1.5 font-medium text-[#000638] max-w-[260px] truncate" title={r.cat}>
                    {r.cat}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-[#000638]">
                    {fmtBRL(r.tot)}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${barW}%`, background: color }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold w-11 text-right" style={{ color }}>
                        {av.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  {MESES.map((k) => {
                    const p = avm(k);
                    return (
                      <td
                        key={k}
                        className="px-2 py-1.5 text-right"
                        style={{ color: p ? MCOLS[k] : '#d1d5db' }}
                      >
                        {p ? p.toFixed(1) + '%' : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="bg-gray-100 font-bold text-[#000638]">
              <td className="px-3 py-2">Total</td>
              <td className="px-2 py-2 text-right">{fmtBRL(grand)}</td>
              <td className="px-2 py-2 text-[10px] text-gray-500">100%</td>
              {MESES.map((k) => (
                <td key={k} className="px-2 py-2 text-right">
                  100%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </CardBox>
  );
}
