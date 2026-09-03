import React from 'react';
import { useDespesasGerais, fmtBRL } from './store';
import { CardBox } from './comum';

export default function HeadcoachContas() {
  const { hcRows } = useDespesasGerais();

  return (
    <CardBox
      title="Contas a Pagar — Conta Sintética / Analítica"
      subtitle="Análise Janeiro · sintéticas em destaque, analíticas identadas"
    >
      <div
        className="overflow-x-auto"
        style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#000638] text-white">
              <th className="px-3 py-2 text-left font-semibold">
                Conta Sintética / Analítica
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                Análise Janeiro
              </th>
            </tr>
          </thead>
          <tbody>
            {hcRows.map((r, i) =>
              r.type === 'sintetica' ? (
                <tr key={i} className="bg-gray-100 border-b border-gray-200">
                  <td className="px-3 py-2 font-bold text-[#000638] uppercase">
                    {r.label}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[#000638]">
                    {fmtBRL(r.total)}
                  </td>
                </tr>
              ) : (
                <tr
                  key={i}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-3 py-1.5 pl-8 text-gray-600">{r.label}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700">
                    {fmtBRL(r.total)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </CardBox>
  );
}
