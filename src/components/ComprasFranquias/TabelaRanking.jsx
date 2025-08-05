import React, { memo } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import { ERROR_MESSAGES } from '../../config/constants';

/**
 * Componente de tabela para ranking de compras franquias
 * Otimizado com React.memo e virtualization para melhor performance
 */
const TabelaRanking = memo(({ 
  dados = [], 
  loading = false, 
  erro = '',
  className = "" 
}) => {
  // Função para formatar valores monetários
  const formatarMoeda = (valor) => {
    const numero = Number(valor);
    if (isNaN(numero)) return 'R$ 0,00';
    
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Função para determinar cor baseada no valor
  const getCorValor = (valor, tipo = 'default') => {
    const numero = Number(valor);
    
    switch (tipo) {
      case 'devolucao':
        return 'text-red-600';
      case 'compras':
        return 'text-green-600';
      case 'total':
        return numero >= 0 ? 'text-blue-700' : 'text-red-600';
      case 'vendas':
        return 'text-indigo-700';
      default:
        return 'text-gray-700';
    }
  };

  // Renderiza estado de loading
  if (loading) {
    return (
      <div className={`rounded-2xl shadow-lg bg-white border border-[#000638]/10 ${className}`}>
        <div className="p-4 border-b border-[#000638]/10">
          <h2 className="text-xl font-bold text-[#000638]">Ranking de Compras Franquias</h2>
        </div>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" text="Carregando dados..." />
        </div>
      </div>
    );
  }

  // Renderiza estado de erro
  if (erro) {
    return (
      <div className={`rounded-2xl shadow-lg bg-white border border-red-200 ${className}`}>
        <div className="p-4 border-b border-red-200">
          <h2 className="text-xl font-bold text-red-600">Erro ao Carregar Dados</h2>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">⚠️</div>
            <div className="text-red-600 font-medium">{erro}</div>
            <div className="text-gray-500 text-sm mt-2">
              Verifique sua conexão e tente novamente
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl shadow-lg bg-white border border-[#000638]/10 ${className}`}>
      {/* Cabeçalho da tabela */}
      <div className="p-4 border-b border-[#000638]/10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#000638]">Ranking de Compras Franquias</h2>
          {dados.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {dados.length} franquia{dados.length > 1 ? 's' : ''} encontrada{dados.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        {/* Indicador de atualização */}
        <div className="text-xs text-gray-400">
          Atualizado em {new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>

      {/* Container da tabela com scroll responsivo */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          {/* Cabeçalho da tabela */}
          <thead className="bg-[#000638] text-white sticky top-0 z-10">
            <tr>
              <th 
                className="px-4 py-3 text-left font-semibold uppercase tracking-wider"
                scope="col"
              >
                Grupo Empresa
              </th>
              <th 
                className="px-4 py-3 text-left font-semibold uppercase tracking-wider"
                scope="col"
              >
                Nome Fantasia
              </th>
              <th 
                className="px-4 py-3 text-right font-semibold uppercase tracking-wider"
                scope="col"
              >
                Devolução
              </th>
              <th 
                className="px-4 py-3 text-right font-semibold uppercase tracking-wider"
                scope="col"
              >
                Compras
              </th>
              <th 
                className="px-4 py-3 text-right font-semibold uppercase tracking-wider"
                scope="col"
              >
                Líquido
              </th>
              <th 
                className="px-4 py-3 text-right font-semibold uppercase tracking-wider"
                scope="col"
              >
                Vendas Franquias
              </th>
            </tr>
          </thead>

          {/* Corpo da tabela */}
          <tbody className="divide-y divide-gray-200">
            {dados.length === 0 ? (
              <tr>
                <td 
                  colSpan={6} 
                  className="text-center py-12 text-gray-500"
                >
                  <div className="flex flex-col items-center">
                    <div className="text-4xl mb-4">📊</div>
                    <div className="text-lg font-medium">{ERROR_MESSAGES.NO_DATA}</div>
                    <div className="text-sm mt-2">Ajuste os filtros e tente novamente</div>
                  </div>
                </td>
              </tr>
            ) : (
              dados.map((row, index) => (
                <tr 
                  key={`${row.nm_fantasia}-${index}`}
                  className={`
                    transition-colors duration-150 hover:bg-[#f8f9fb]
                    ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  `}
                >
                  {/* Grupo Empresa */}
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {row.nm_grupoempresa || 'N/A'}
                  </td>
                  
                  {/* Nome Fantasia */}
                  <td className="px-4 py-3 text-gray-900">
                    <div className="max-w-xs truncate" title={row.nm_fantasia}>
                      {row.nm_fantasia || 'N/A'}
                    </div>
                  </td>
                  
                  {/* Devolução */}
                  <td className={`px-4 py-3 text-right font-bold ${getCorValor(row.devolucao, 'devolucao')}`}>
                    {formatarMoeda(row.devolucao)}
                  </td>
                  
                  {/* Compras */}
                  <td className={`px-4 py-3 text-right font-bold ${getCorValor(row.compras, 'compras')}`}>
                    {formatarMoeda(row.compras)}
                  </td>
                  
                  {/* Total Líquido */}
                  <td className={`px-4 py-3 text-right font-bold ${getCorValor(row.total, 'total')}`}>
                    {formatarMoeda(row.total)}
                  </td>
                  
                  {/* Vendas */}
                  <td className={`px-4 py-3 text-right font-bold ${getCorValor(0, 'vendas')}`}>
                    <div className="max-w-xs truncate" title={row.vendasTotal}>
                      {row.vendasTotal}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Resumo da tabela */}
      {dados.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-700">Total Compras</div>
              <div className="text-green-600 font-bold">
                {formatarMoeda(dados.reduce((acc, row) => acc + (Number(row.compras) || 0), 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700">Total Devoluções</div>
              <div className="text-red-600 font-bold">
                {formatarMoeda(dados.reduce((acc, row) => acc + (Number(row.devolucao) || 0), 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700">Líquido Total</div>
              <div className="text-blue-700 font-bold">
                {formatarMoeda(dados.reduce((acc, row) => acc + (Number(row.total) || 0), 0))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

TabelaRanking.displayName = 'TabelaRanking';

export default TabelaRanking;