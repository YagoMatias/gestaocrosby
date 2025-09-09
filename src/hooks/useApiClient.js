import { useCallback } from 'react';
import { API_BASE_URL } from '../config/constants';

/**
 * Hook personalizado para fazer chamadas à API
 * Padroniza o tratamento de respostas da nova estrutura da API
 */
const useApiClient = () => {
  const apiCall = useCallback(async (endpoint, params = {}) => {
    try {
      // Construir URL com parâmetros
      const url = new URL(endpoint, API_BASE_URL);
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, v));
          } else {
            url.searchParams.append(key, value);
          }
        }
      });

      console.log('🌐 API Call:', url.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📦 API Response:', result);
      console.log('📊 API Response Analysis:', {
        type: typeof result,
        hasSuccess: 'success' in result,
        hasData: 'data' in result,
        dataType: typeof result.data,
        isDataArray: Array.isArray(result.data),
        keys: Object.keys(result)
      });

      // Verificar se a resposta está na estrutura da nova API
      if (result && typeof result === 'object') {
        // Nova estrutura da API com successResponse()
        if (result.success !== undefined) {
          // Verificar se data é um objeto com propriedade data aninhada (estrutura real da API)
          let actualData = [];
          
                     if (result.data && typeof result.data === 'object') {
             if (Array.isArray(result.data.data)) {
               // Estrutura aninhada: { data: { data: [...] } }
               actualData = result.data.data;
               console.log('🔍 Detectada estrutura aninhada (data.data)');
             } else if (Array.isArray(result.data)) {
               // Estrutura direta: { data: [...] }
               actualData = result.data;
               console.log('🔍 Detectada estrutura direta (data)');
             } else if (result.data.groupedData && Array.isArray(result.data.groupedData)) {
               // Estrutura de franquias: { data: { groupedData: [...] } }
               // Extrair todas as transações dos grupos
               actualData = result.data.groupedData.reduce((acc, grupo) => {
                 if (grupo.transactions && Array.isArray(grupo.transactions)) {
                   return acc.concat(grupo.transactions);
                 }
                 return acc;
               }, []);
               console.log('🔍 Detectada estrutura de franquias (data.groupedData)');
             } else if (result.data.data && typeof result.data.data === 'object' && result.data.data.saldo !== undefined) {
               // Estrutura de saldo-conta: { data: { data: { saldo: number } } }
               actualData = result.data.data;
               console.log('🔍 Detectada estrutura de saldo-conta (data.data.saldo)');
             }
           }
          
          console.log('✅ Processando resposta da nova API:', {
            originalDataType: typeof result.data,
            isNestedStructure: result.data && typeof result.data === 'object' && 'data' in result.data,
            actualDataLength: actualData.length,
            isArray: Array.isArray(actualData),
            estrutura: result.data && typeof result.data === 'object' ? Object.keys(result.data) : 'N/A'
          });
          
          return {
            success: result.success,
            data: actualData,
            total: result.data?.total || result.total || actualData.length,
            limit: result.data?.limit || result.limit || 50,
            offset: result.data?.offset || result.offset || 0,
            hasMore: result.data?.hasMore || result.hasMore || false,
            message: result.message || '',
            filtros: result.data?.filtros || result.filtros || {},
            metadata: {
              count: result.data?.count || result.count,
              periodo: result.data?.periodo || result.periodo,
              empresas: result.data?.empresas || result.empresas,
              estatisticas: result.data?.estatisticas || result.data?.totais || result.data?.totals || result.estatisticas || result.totais || result.totals,
              totals: result.data?.totals || result.totals,
              optimized: result.data?.optimized || result.optimized,
              queryType: result.data?.queryType || result.queryType,
              operacoes_permitidas: result.data?.operacoes_permitidas || result.operacoes_permitidas,
              performance: result.data?.performance || result.performance,
              ...result
            },
            // Campos específicos da nova rota de faturamento
            periodo: result.data?.periodo || result.periodo,
            empresas: result.data?.empresas || result.empresas,
            operacoes_permitidas: result.data?.operacoes_permitidas || result.operacoes_permitidas,
            totals: result.data?.totals || result.totals,
            optimized: result.data?.optimized || result.optimized,
            queryType: result.data?.queryType || result.queryType,
            performance: result.data?.performance || result.performance
          };
        }
        
        // Estrutura antiga - compatibilidade
        if (result.data && Array.isArray(result.data)) {
          return {
            success: true,
            data: result.data,
            total: result.total || result.data.length,
            message: 'Dados obtidos com sucesso'
          };
        }
        
        if (result.rows && Array.isArray(result.rows)) {
          return {
            success: true,
            data: result.rows,
            total: result.total || result.rows.length,
            message: 'Dados obtidos com sucesso'
          };
        }

        // Se for um array direto
        if (Array.isArray(result)) {
          return {
            success: true,
            data: result,
            total: result.length,
            message: 'Dados obtidos com sucesso'
          };
        }
      }

      // Fallback para formatos não reconhecidos
      console.warn('⚠️ Formato de resposta não reconhecido:', result);
      return {
        success: false,
        data: [],
        total: 0,
        message: 'Formato de dados inesperado'
      };

    } catch (error) {
      console.error('❌ Erro na API:', error);
      throw error;
    }
  }, []);

  // Métodos específicos para cada tipo de endpoint
  const financial = {
    extrato: (params) => apiCall('/api/financial/extrato', params),
    extratoTotvs: (params) => apiCall('/api/financial/extrato-totvs', params),
  
    contasPagar: (params) => apiCall('/api/financial/contas-pagar', params),
    contasReceber: (params) => apiCall('/api/financial/contas-receber', params),
    fluxoCaixa: (params) => apiCall('/api/financial/fluxo-caixa', params),
    fluxocaixaSaida: (params) => apiCall('/api/financial/fluxo-caixa-saida', params),
    nfManifestacao: (params) => apiCall('/api/financial/nfmanifestacao', params),
    saldoConta: (params) => apiCall('/api/financial/saldo-conta', params),
    credevAdiantamento: (params) => apiCall('/api/financial/credev-adiantamento', params),
    auditorCredev: (params) => apiCall('/api/financial/auditor-credev', params),
    fornecedor: (params) => apiCall('/api/financial/fornecedor', params),
    centrocusto: (params) => apiCall('/api/financial/centrocusto', params),
    despesa: (params) => apiCall('/api/financial/despesa', params)
  };

  const sales = {
    faturamento: (params) => apiCall('/api/sales/faturamento', params),
    faturamentoFranquia: (params) => apiCall('/api/sales/faturamento-franquia', params),
    faturamentoMtm: (params) => apiCall('/api/sales/faturamento-mtm', params),
    faturamentoRevenda: (params) => apiCall('/api/sales/faturamento-revenda', params),
    receitaliquidaFaturamento: (params) => apiCall('/api/sales/receitaliquida-faturamento', params),
    receitaliquidaFranquias: (params) => apiCall('/api/sales/receitaliquida-franquias', params),
    receitaliquidaMtm: (params) => apiCall('/api/sales/receitaliquida-mtm', params),
    receitaliquidaRevenda: (params) => apiCall('/api/sales/receitaliquida-revenda', params),
    rankingVendedores: (params) => apiCall('/api/sales/ranking-vendedores', params)
  };

  const company = {
    empresas: (params) => apiCall('/api/company/empresas', params),
    grupoEmpresas: (params) => apiCall('/api/company/grupo-empresas', params),
    faturamentoLojas: (params) => apiCall('/api/company/faturamento-lojas', params),
    expedicao: (params) => apiCall('/api/company/expedicao', params),
    pcp: (params) => apiCall('/api/company/pcp', params)
  };

  const franchise = {

  
    franquiasCredev: (params) => apiCall('/api/franchise/franquias-credev', params)
  };

  const utils = {
    health: () => apiCall('/api/utils/health'),
    stats: () => apiCall('/api/utils/stats'),
    autocompleteFantasia: (q) => apiCall('/api/utils/autocomplete/nm_fantasia', { q }),
    autocompleteGrupoEmpresa: (q) => apiCall('/api/utils/autocomplete/nm_grupoempresa', { q })
  };

  return {
    apiCall,
    financial,
    sales,
    company,
    franchise,
    utils
  };
};

export default useApiClient;