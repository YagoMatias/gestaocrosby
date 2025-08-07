import React from 'react';
import { CaretDown, CaretRight, Spinner } from '@phosphor-icons/react';

function formatarDataBR(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('pt-BR');
}

const ExtratoTotvsTable = ({ 
  dados, 
  dadosCompletos,
  loading, 
  erro, 
  expandTabela, 
  setExpandTabela, 
  contas, 
  corConta,
  currentPage,
  totalPages,
  totalRegistros,
  onPageChange,
  pageSize
}) => (
  <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
    <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
      <div>
        <h2 className="text-xl font-bold text-[#000638]">Extrato TOTVS</h2>
        {totalRegistros > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            {totalRegistros} registros encontrados
            {totalPages > 1 && ` - Página ${currentPage} de ${totalPages} (${pageSize} por página)`}
          </p>
        )}
      </div>
      <span className="flex items-center">
        {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
      </span>
    </div>
    {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
    {expandTabela && (
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-3">
              <Spinner size={32} className="animate-spin text-blue-600" />
              <span className="text-gray-600">Carregando dados...</span>
            </div>
          </div>
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

        {/* Paginação TOTVS */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Informações da página */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <span className="text-gray-500">
                  {totalRegistros} registros • {pageSize} por página
                </span>
              </div>

              {/* Controles de navegação */}
              <div className="flex items-center gap-2">
                {/* Botão Primeira Página */}
                <button
                  onClick={() => onPageChange(1)}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Primeira
                </button>

                {/* Botão Anterior */}
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                {/* Números das páginas */}
                <div className="flex items-center gap-1">
                  {(() => {
                    const pages = [];
                    const maxVisiblePages = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                    
                    if (endPage - startPage + 1 < maxVisiblePages) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1);
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => onPageChange(i)}
                          disabled={loading}
                          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                            currentPage === i
                              ? 'bg-[#000638] text-white border border-[#000638]'
                              : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}
                </div>

                {/* Botão Próxima */}
                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>

                {/* Botão Última Página */}
                <button
                  onClick={() => onPageChange(totalPages)}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Última
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);

export default ExtratoTotvsTable; 