import { useState, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config/constants';

/**
 * Custom Hook para gerenciar dados de compras de franquias
 * Encapsula a lógica de estado, chamadas de API e processamento de dados
 */
export const useComprasFranquias = () => {
  // Estados principais
  const [dados, setDados] = useState([]);
  const [dadosVendas, setDadosVendas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  /**
   * Busca dados de compras das franquias
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Dados de compras
   */
  const buscarDadosCompras = useCallback(async (params) => {
    try {
      const urlParams = new URLSearchParams();
      
      // Adiciona empresas selecionadas
      if (params.empresasSelecionadas?.length > 0) {
        params.empresasSelecionadas.forEach(emp => {
          urlParams.append('cd_empresa', emp.cd_empresa);
        });
      }
      
      // Adiciona filtros de data
      if (params.dt_inicio) urlParams.append('dt_inicio', params.dt_inicio);
      if (params.dt_fim) urlParams.append('dt_fim', params.dt_fim);
      
      // Adiciona filtro de nome fantasia
      if (params.nmFantasiaSelecionados?.length > 0) {
        urlParams.append('nm_fantasia', params.nmFantasiaSelecionados[0]);
      }

      const response = await fetch(`${API_BASE_URL}/api/sales/faturamento-franquia?${urlParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao buscar dados de compras:', error);
      throw error;
    }
  }, []);

  /**
   * Busca dados de vendas das franquias
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Dados de vendas
   */
  const buscarDadosVendas = useCallback(async (params) => {
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('cd_grupoempresa_ini', '1');
      urlParams.append('cd_grupoempresa_fim', '8000');
      
      if (params.dt_inicio) urlParams.append('dt_inicio', params.dt_inicio);
      if (params.dt_fim) urlParams.append('dt_fim', params.dt_fim);
      
      if (params.nmFantasiaSelecionados?.length > 0) {
        urlParams.append('nm_fantasia', params.nmFantasiaSelecionados[0]);
      }

      const response = await fetch(`${API_BASE_URL}/api/company/faturamento-lojas?${urlParams.toString()}`);
      
      if (!response.ok) {
        console.warn('Erro ao buscar dados de vendas:', response.status);
        return [];
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao buscar dados de vendas:', error);
      return [];
    }
  }, []);

  /**
   * Função principal para buscar todos os dados
   * @param {Object} filtros - Objeto com todos os filtros
   */
  const buscarDados = useCallback(async (filtros) => {
    if (!filtros.empresasSelecionadas?.length) {
      setErro('Selecione pelo menos uma loja para consultar!');
      return;
    }

    setErro('');
    setLoading(true);

    try {
      // Busca dados em paralelo para melhor performance
      const [dadosComprasResult, dadosVendasResult] = await Promise.all([
        buscarDadosCompras(filtros),
        buscarDadosVendas(filtros)
      ]);

      setDados(dadosComprasResult);
      setDadosVendas(dadosVendasResult);
    } catch (error) {
      setErro('Erro ao buscar dados do servidor. Tente novamente.');
      setDados([]);
      setDadosVendas([]);
    } finally {
      setLoading(false);
    }
  }, [buscarDadosCompras, buscarDadosVendas]);

  /**
   * Função para agrupar dados por nome fantasia e calcular totais
   * Memoizada para evitar recálculos desnecessários
   */
  const dadosAgrupados = useMemo(() => {
    if (!dados.length && !dadosVendas.length) return [];

    // Pega todos os nomes fantasia únicos de compras
    const nomes = new Set(dados.map(row => row.nm_fantasia));

    return Array.from(nomes).map(nm_fantasia => {
      // Filtra compras por nome fantasia
      const comprasRows = dados.filter(row => row.nm_fantasia === nm_fantasia);
      
      // Calcula devoluções (operação entrada)
      const devolucao = comprasRows
        .filter(row => row.tp_operacao === 'E')
        .reduce((acc, row) => {
          const valor = Number(row.vl_unitliquido) * Number(row.qt_faturado);
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);
      
      // Calcula compras (operação saída)
      const compras = comprasRows
        .filter(row => row.tp_operacao === 'S')
        .reduce((acc, row) => {
          const valor = Number(row.vl_unitliquido) * Number(row.qt_faturado);
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);

      // Pega grupo empresa do primeiro registro
      const nm_grupoempresa = comprasRows[0]?.nm_grupoempresa || '';

      // Calcula vendas correspondentes
      const vendas = dadosVendas
        .filter(v => v.nm_fantasia === nm_fantasia)
        .map(v => Number(v.faturamento || 0))
        .filter(val => !isNaN(val));

      const vendasTotalStr = vendas.length
        ? vendas.map(val => 
            val.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            })
          ).join(', ')
        : '-';

      return {
        nm_grupoempresa,
        nm_fantasia,
        devolucao,
        compras,
        total: compras - devolucao,
        vendasTotal: vendasTotalStr
      };
    }).sort((a, b) => b.compras - a.compras);
  }, [dados, dadosVendas]);

  return {
    // Estados
    dados,
    dadosVendas,
    dadosAgrupados,
    loading,
    erro,
    
    // Ações
    buscarDados,
    setErro
  };
};