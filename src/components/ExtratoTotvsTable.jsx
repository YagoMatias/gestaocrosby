import React, { useMemo, useState } from 'react';
import { CaretDown, CaretRight, CaretUp, Spinner } from '@phosphor-icons/react';

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
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'dt_movim', direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <CaretDown size={12} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <CaretUp size={12} className="ml-1" /> : <CaretDown size={12} className="ml-1" />;
  };

  const dadosOrdenados = useMemo(() => {
    const arr = Array.isArray(dados) ? [...dados] : [];
    return arr.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key.startsWith('dt_')) {
        aValue = aValue ? new Date(aValue) : new Date(0);
        bValue = bValue ? new Date(bValue) : new Date(0);
      } else if (sortConfig.key === 'vl_lancto') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      if (sortConfig.direction === 'asc') return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    });
  }, [dados, sortConfig]);

  return (
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
      <div className="varejo-table-container overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-3">
              <Spinner size={32} className="animate-spin text-blue-600" />
              <span className="text-gray-600">Carregando dados...</span>
            </div>
          </div>
        ) : (
          <table className="varejo-table w-full border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-3 py-2 font-semibold">Conta</th>
                <th onClick={() => handleSort('dt_movim')} className="px-3 py-2 font-semibold cursor-pointer">
                  <div className="flex items-center justify-center gap-1">Data Lançamento {getSortIcon('dt_movim')}</div>
                </th>
                <th className="px-3 py-2 font-semibold">Documento</th>
                <th className="px-3 py-2 font-semibold">Estorno</th>
                <th className="px-3 py-2 font-semibold">Operação</th>
                <th className="px-3 py-2 font-semibold">Auxiliar</th>
                <th onClick={() => handleSort('vl_lancto')} className="px-3 py-2 font-semibold cursor-pointer">
                  <div className="flex items-center justify-center gap-1">Valor {getSortIcon('vl_lancto')}</div>
                </th>
                <th onClick={() => handleSort('dt_liq')} className="px-3 py-2 font-semibold cursor-pointer">
                  <div className="flex items-center justify-center gap-1">Data Liquidação {getSortIcon('dt_liq')}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {dadosOrdenados.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8">Nenhum dado encontrado.</td></tr>
              ) : (
                dadosOrdenados.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                    <td className={`px-3 py-2 text-center text-xs ${(() => {
                      const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                      return conta ? corConta(conta.nome) : '';
                    })()}`}>{
                      (() => {
                        const conta = contas.find(c => c.numero === String(row.nr_ctapes));
                        return conta ? `${conta.numero} - ${conta.nome}` : row.nr_ctapes;
                      })()
                    }</td>
                    <td className="px-3 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_movim)}</td>
                    <td className="px-3 py-2 text-[#000000]">{row.ds_doc}</td>
                    <td className="px-3 py-2 text-center text-[#000000]">{row.in_estorno}</td>
                    <td className="px-3 py-2 text-center text-[#000000]">{row.tp_operacao}</td>
                    <td className="px-3 py-2 text-[#000000]">{row.ds_aux}</td>
                    <td className={`px-3 py-2 text-right font-bold ${row.tp_operacao === 'D' ? 'text-[#fe0000]' : row.tp_operacao === 'C' ? 'text-green-600' : ''}`}>{row.vl_lancto !== null && row.vl_lancto !== undefined ? Number(row.vl_lancto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                    <td className="px-3 py-2 text-center text-[#000638]">{formatarDataBR(row.dt_liq)}</td>
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
}

export default ExtratoTotvsTable; 