import React from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import LoadingCircle from './LoadingCircle';

function formatarDataBR(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('pt-BR');
}

const ExtratoTotvsTable = ({ dados, loading, erro, expandTabela, setExpandTabela, contas, corConta }) => (
  <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
    <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
      <h2 className="text-xl font-bold text-[#000638]">Extrato TOTVS</h2>
      <span className="flex items-center">
        {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
      </span>
    </div>
    {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
    {expandTabela && (
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-8"><LoadingCircle size={32} /></div>
        ) : (
          <table className="w-full border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-4 py-2 font-semibold">Conta</th>
                <th className="px-4 py-2 font-semibold">Data Lançamento</th>
                <th className="px-4 py-2 font-semibold">Documento</th>
                <th className="px-4 py-2 font-semibold">Estorno</th>
                <th className="px-4 py-2 font-semibold">Operação</th>
                <th className="px-4 py-2 font-semibold">Auxiliar</th>
                <th className="px-4 py-2 font-semibold">Valor</th>
                <th className="px-4 py-2 font-semibold">Data Liquidação</th>
              </tr>
            </thead>
            <tbody>
              {dados.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8">Nenhum dado encontrado.</td></tr>
              ) : (
                dados.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                    <td className={`px-4 py-2 text-center text-xs ${(() => {
                      const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                      return conta ? corConta(conta.nome) : '';
                    })()}`}>{
                      (() => {
                        const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                        return conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes;
                      })()
                    }</td>
                    <td className="px-4 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_movim)}</td>
                    <td className="px-4 py-2 text-[#000000]">{row.ds_doc}</td>
                    <td className="px-4 py-2 text-center text-[#000000]">{row.in_estorno}</td>
                    <td className="px-4 py-2 text-center text-[#000000]">{row.tp_operacao}</td>
                    <td className="px-4 py-2 text-[#000000]">{row.ds_aux}</td>
                    <td className={`px-4 py-2 text-right font-bold ${row.tp_operacao === 'D' ? 'text-[#fe0000]' : row.tp_operacao === 'C' ? 'text-green-600' : ''}`}>{row.vl_lancto !== null && row.vl_lancto !== undefined ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                    <td className="px-4 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_liq)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    )}
  </div>
);

export default ExtratoTotvsTable; 