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
  const [dadosCredev, setDadosCredev] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtrosAtuais, setFiltrosAtuais] = useState({});

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
      
      // Define datas padrão se estiverem vazias
      // Datas padrão: primeiro dia do mês até hoje
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const fmt = (d) => d.toISOString().split('T')[0];
      const dt_inicio = params.dt_inicio || fmt(firstDay);
      const dt_fim = params.dt_fim || fmt(today);
      
      // Adiciona filtros de data
      urlParams.append('dt_inicio', dt_inicio);
      urlParams.append('dt_fim', dt_fim);
      
      // Não filtra por nome fantasia no backend; filtro será apenas no cliente

      const url = `${API_BASE_URL}/api/sales/faturamento-franquia?${urlParams.toString()}`;
      console.log('🔍 URL Compras:', url);
      console.log('📋 Parâmetros Compras:', { ...params, dt_inicio, dt_fim });

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Dados Compras Recebidos:', data);
      
      // A rota retorna { success: true, data: { groupedData: [...] } }
      if (data && data.success && data.data && data.data.groupedData) {
        console.log('✅ Dados agrupados encontrados:', data.data.groupedData.length, 'grupos');
        return data.data.groupedData;
      }
      
      // Fallback para estrutura antiga
      if (data && data.groupedData) {
        console.log('✅ Dados agrupados encontrados (estrutura antiga):', data.groupedData.length, 'grupos');
        return data.groupedData;
      }
      
      // Se não tem groupedData, mas tem data direto
      if (data && data.data) {
        console.log('✅ Dados diretos encontrados:', data.data.length, 'registros');
        return data.data;
      }
      
      // Se é um array direto
      if (Array.isArray(data)) {
        console.log('✅ Array direto encontrado:', data.length, 'registros');
        return data;
      }
      
      console.log('⚠️ Estrutura de dados inesperada:', data);
      return [];
    } catch (error) {
      console.error('❌ Erro ao buscar dados de compras:', error);
      throw error;
    }
  }, []);

  /**
   * Busca dados de crédito/débito (CREDEV) das franquias
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Dados de credev (linhas da API)
   */
  const buscarDadosCredev = useCallback(async (params) => {
    try {
      const urlParams = new URLSearchParams();

      // Define datas padrão se estiverem vazias
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const fmt = (d) => d.toISOString().split('T')[0];
      const dt_inicio = params.dt_inicio || fmt(firstDay);
      const dt_fim = params.dt_fim || fmt(today);

      urlParams.append('dt_inicio', dt_inicio);
      urlParams.append('dt_fim', dt_fim);

      // Não enviar cd_cliente; filtro será aplicado no cliente

      const url = `${API_BASE_URL}/api/franchise/franquias-credev?${urlParams.toString()}`;
      console.log('🔍 URL Credev:', url);

      const response = await fetch(url);
      if (!response.ok) {
        console.warn('⚠️ Erro ao buscar dados de CREDEV:', response.status);
        return [];
      }

      const data = await response.json();
      console.log('📊 Dados CREDEV Recebidos:', data);

      // Nova API padronizada: { success, data: { data: rows } } ou { success, data: rows }
      if (data && data.success) {
        if (data.data && Array.isArray(data.data)) return data.data;
        if (data.data && Array.isArray(data.data.data)) return data.data.data;
      }

      // Fallbacks
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;

      console.log('⚠️ Estrutura de CREDEV inesperada:', data);
      return [];
    } catch (error) {
      console.error('❌ Erro ao buscar dados de CREDEV:', error);
      return [];
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
      
      // Define datas padrão se estiverem vazias
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const fmt = (d) => d.toISOString().split('T')[0];
      const dt_inicio = params.dt_inicio || fmt(firstDay);
      const dt_fim = params.dt_fim || fmt(today);
      
      urlParams.append('dt_inicio', dt_inicio);
      urlParams.append('dt_fim', dt_fim);

      const url = `${API_BASE_URL}/api/company/faturamento-lojas?${urlParams.toString()}`;
      console.log('🔍 URL Vendas:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('⚠️ Erro ao buscar dados de vendas:', response.status);
        return [];
      }
      
      const data = await response.json();
      console.log('📊 Dados Vendas Recebidos:', data);
      
      // A rota retorna { success: true, data: { data: [...] } }
      if (data && data.success && data.data && data.data.data) {
        console.log('✅ Dados de vendas encontrados:', data.data.data.length, 'registros');
        return data.data.data;
      }
      
      // Fallback para estrutura antiga
      if (data && data.data) {
        console.log('✅ Dados de vendas encontrados (estrutura antiga):', data.data.length, 'registros');
        return data.data;
      }
      
      console.log('⚠️ Estrutura de dados de vendas inesperada:', data);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Erro ao buscar dados de vendas:', error);
      return [];
    }
  }, []);

  /**
   * Função principal para buscar todos os dados
   * @param {Object} filtros - Objeto com todos os filtros
   */
  const buscarDados = useCallback(async (filtros) => {
    console.log('🚀 Iniciando busca de dados com filtros:', filtros);
    
    if (!filtros.empresasSelecionadas?.length) {
      console.log('❌ Nenhuma empresa selecionada');
      setErro('Selecione pelo menos uma loja para consultar!');
      return;
    }

    setErro('');
    setLoading(true);
    setFiltrosAtuais(filtros || {});

    try {
      // Busca dados em paralelo para melhor performance
      const [dadosComprasResult, dadosVendasResult, dadosCredevResult] = await Promise.all([
        buscarDadosCompras(filtros),
        buscarDadosVendas(filtros),
        buscarDadosCredev(filtros)
      ]);

      console.log('📦 Resultado Compras:', dadosComprasResult);
      console.log('📦 Resultado Vendas:', dadosVendasResult);
      console.log('📦 Resultado CREDEV:', dadosCredevResult);

      setDados(dadosComprasResult);
      setDadosVendas(dadosVendasResult);
      setDadosCredev(dadosCredevResult);
    } catch (error) {
      console.error('❌ Erro na busca principal:', error);
      setErro('Erro ao buscar dados do servidor. Tente novamente.');
      setDados([]);
      setDadosVendas([]);
      setDadosCredev([]);
    } finally {
      setLoading(false);
    }
  }, [buscarDadosCompras, buscarDadosVendas, buscarDadosCredev]);

  /**
   * Função para agrupar dados por nome fantasia e calcular totais
   * Memoizada para evitar recálculos desnecessários
   */
  const dadosAgrupados = useMemo(() => {
    console.log('🔄 Processando dados agrupados...');
    console.log('📊 Dados compras:', dados);
    console.log('📊 Dados vendas:', dadosVendas);
    console.log('📊 Dados CREDEV:', dadosCredev);
    
    if (!dados.length && !dadosVendas.length) {
      console.log('⚠️ Nenhum dado para processar');
      return [];
    }

    // Se os dados não estão no formato agrupado, vamos agrupá-los
    let dadosProcessados = dados;
    
    // Se os dados são um array simples de transações, vamos agrupá-los
    if (dados.length > 0 && !dados[0].transactions) {
      console.log('🔄 Agrupando dados simples...');
      const grupos = {};
      
      dados.forEach(row => {
        const fantasia = row.nm_fantasia || 'Sem Fantasia';
        if (!grupos[fantasia]) {
          grupos[fantasia] = {
            nm_fantasia: fantasia,
            transactions: [],
            totals: { bruto: 0, liquido: 0, quantidade: 0 }
          };
        }
        grupos[fantasia].transactions.push(row);
      });
      
      dadosProcessados = Object.values(grupos);
      console.log('✅ Dados agrupados:', dadosProcessados);
    }

    // Mapa de CREDEV por fantasia (soma de vl_pago, considerando sinal)
    const credevPorFantasia = (dadosCredev || []).reduce((acc, row) => {
      const fantasia = row.nm_fantasia || 'Sem Fantasia';
      const valor = Number(row.vl_pago) || 0;
      acc[fantasia] = (acc[fantasia] || 0) + valor;
      return acc;
    }, {});

    const resultado = dadosProcessados.map(comprasGrupo => {
      const nm_fantasia = comprasGrupo.nm_fantasia;
      console.log('🏢 Processando franquia:', nm_fantasia);
      
      // Processa transações de compras
      const transactions = comprasGrupo.transactions || [];
      console.log('📋 Transações encontradas:', transactions.length);
      
      // Calcula devoluções (operação entrada)
      const devolucao = transactions
        .filter(row => row.tp_operacao === 'E')
        .reduce((acc, row) => {
          const valor = Number(row.vl_unitliquido) * Number(row.qt_faturado);
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);
      
      // Calcula compras (operação saída)
      const compras = transactions
        .filter(row => row.tp_operacao === 'S')
        .reduce((acc, row) => {
          const valor = Number(row.vl_unitliquido) * Number(row.qt_faturado);
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);

      // Pega grupo empresa do primeiro registro
      const nm_grupoempresa = transactions[0]?.nm_grupoempresa || '';

      // Calcula vendas correspondentes - busca por nome_fantasia
      console.log('🔍 Procurando vendas para:', nm_fantasia);
      console.log('📋 Dados de vendas disponíveis:', dadosVendas.map(v => ({
        nome_fantasia: v.nome_fantasia,
        nm_fantasia: v.nm_fantasia,
        fantasia: v.fantasia,
        faturamento: v.faturamento
      })));
      
      const vendas = dadosVendas
        .filter(v => {
          // Tenta diferentes campos possíveis para nome fantasia
          const fantasiaVenda = v.nome_fantasia || v.nm_fantasia || v.fantasia;
          const match = fantasiaVenda === nm_fantasia;
          if (match) {
            console.log('✅ Match encontrado:', fantasiaVenda, '=', nm_fantasia);
          }
          return match;
        })
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

      const resultadoItem = {
        nm_grupoempresa,
        nm_fantasia,
        devolucao,
        compras,
        total: compras - devolucao,
        vendasTotal: vendasTotalStr,
        credev: credevPorFantasia[nm_fantasia] || 0
      };
      
      console.log('✅ Resultado para', nm_fantasia, ':', resultadoItem);
      return resultadoItem;
    }).sort((a, b) => b.compras - a.compras);
    
    console.log('🎯 Resultado final agrupado:', resultado);
    return resultado;
  }, [dados, dadosVendas, dadosCredev, filtrosAtuais]);

  // Opções de nomes fantasia disponíveis (geradas do que já foi carregado)
  // Removido nomesFantasiaDisponiveis e qualquer lógica associada

  return {
    // Estados
    dados,
    dadosVendas,
    dadosCredev,
    filtrosAtuais,
    dadosAgrupados,
    loading,
    erro,
    
    // Ações
    buscarDados,
    setErro
  };
};