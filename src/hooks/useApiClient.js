import { useCallback } from 'react';
import { API_BASE_URL } from '../config/constants';

/**
 * Hook personalizado para fazer chamadas à API
 * Padroniza o tratamento de respostas da nova estrutura da API
 */
const useApiClient = () => {
  // Método auxiliar para requisições POST/PUT/DELETE
  const apiMutate = useCallback(
    async (endpoint, method = 'POST', body = null, params = {}) => {
      try {
        // Construir URL com parâmetros (para GET em métodos DELETE)
        const url = new URL(endpoint, API_BASE_URL);
        Object.keys(params).forEach((key) => {
          const value = params[key];
          if (value !== null && value !== undefined && value !== '') {
            url.searchParams.append(key, value);
          }
        });

        console.log(`🌐 API ${method}:`, url.toString(), body ? { body } : '');

        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if (body && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), options);

        if (!response.ok) {
          let errorBody = null;
          try {
            errorBody = await response.json();
          } catch {}
          const message =
            (errorBody && (errorBody.message || errorBody.error)) ||
            response.statusText ||
            'Erro ao processar requisição';

          console.error(`❌ Erro ${method}:`, {
            status: response.status,
            message,
            errorBody,
          });

          throw new Error(message);
        }

        const result = await response.json();
        console.log(`✅ ${method} Response:`, result);

        return result;
      } catch (error) {
        console.error(`❌ Erro na API ${method}:`, error);
        throw error;
      }
    },
    [],
  );

  const apiCall = useCallback(async (endpoint, params = {}) => {
    try {
      // Construir URL com parâmetros
      const url = new URL(endpoint, API_BASE_URL);
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, v));
          } else {
            url.searchParams.append(key, value);
          }
        }
      });

      console.log('🌐 API Call:', url.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {}
        const message =
          (errorBody && (errorBody.message || errorBody.error)) ||
          response.statusText ||
          'Erro ao processar requisição';
        console.warn('⚠️ Resposta não OK da API:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          url: url.toString(),
        });
        return {
          success: false,
          faturamentoBazar: (params) =>
            apiCall('/api/faturamento/fatbazar', params),
          total: 0,
          message,
          status: response.status,
          error: errorBody?.error || null,
        };
      }

      const result = await response.json();
      console.log('📦 API Response:', result);
      console.log('📊 API Response Analysis:', {
        type: typeof result,
        hasSuccess: 'success' in result,
        hasData: 'data' in result,
        dataType: typeof result.data,
        isDataArray: Array.isArray(result.data),
        keys: Object.keys(result),
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
            } else if (
              result.data.data &&
              typeof result.data.data === 'object'
            ) {
              // Estrutura de objeto aninhado: { data: { data: { varejo: {...}, ... } } }
              actualData = result.data.data;
              console.log(
                '🔍 Detectada estrutura de objeto aninhado (data.data como objeto)',
              );
            } else if (Array.isArray(result.data)) {
              // Estrutura direta: { data: [...] }
              actualData = result.data;
              console.log('🔍 Detectada estrutura direta (data)');
            } else if (
              result.data.groupedData &&
              Array.isArray(result.data.groupedData)
            ) {
              // Estrutura de franquias: { data: { groupedData: [...] } }
              // Extrair todas as transações dos grupos
              actualData = result.data.groupedData.reduce((acc, grupo) => {
                if (grupo.transactions && Array.isArray(grupo.transactions)) {
                  return acc.concat(grupo.transactions);
                }
                return acc;
              }, []);
              console.log(
                '🔍 Detectada estrutura de franquias (data.groupedData)',
              );
            } else if (
              typeof result.data === 'object' &&
              !Array.isArray(result.data)
            ) {
              // Estrutura de objeto direto: { data: { varejo: {...}, ... } }
              actualData = result.data;
              console.log('🔍 Detectada estrutura de objeto direto');
            }
          }

          console.log('✅ Processando resposta da nova API:', {
            originalDataType: typeof result.data,
            isNestedStructure:
              result.data &&
              typeof result.data === 'object' &&
              'data' in result.data,
            actualDataLength: actualData.length,
            isArray: Array.isArray(actualData),
            estrutura:
              result.data && typeof result.data === 'object'
                ? Object.keys(result.data)
                : 'N/A',
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
              estatisticas:
                result.data?.estatisticas ||
                result.data?.totais ||
                result.data?.totals ||
                result.estatisticas ||
                result.totais ||
                result.totals,
              totals: result.data?.totals || result.totals,
              optimized: result.data?.optimized || result.optimized,
              queryType: result.data?.queryType || result.queryType,
              operacoes_permitidas:
                result.data?.operacoes_permitidas ||
                result.operacoes_permitidas,
              performance: result.data?.performance || result.performance,
              ...result,
            },
            // Campos específicos da nova rota de faturamento
            periodo: result.data?.periodo || result.periodo,
            empresas: result.data?.empresas || result.empresas,
            operacoes_permitidas:
              result.data?.operacoes_permitidas || result.operacoes_permitidas,
            totals: result.data?.totals || result.totals,
            optimized: result.data?.optimized || result.optimized,
            queryType: result.data?.queryType || result.queryType,
            performance: result.data?.performance || result.performance,
          };
        }

        // Estrutura antiga - compatibilidade
        if (result.data && Array.isArray(result.data)) {
          return {
            success: true,
            data: result.data,
            total: result.total || result.data.length,
            message: 'Dados obtidos com sucesso',
          };
        }

        if (result.rows && Array.isArray(result.rows)) {
          return {
            success: true,
            data: result.rows,
            total: result.total || result.rows.length,
            message: 'Dados obtidos com sucesso',
          };
        }

        // Se for um array direto
        if (Array.isArray(result)) {
          return {
            success: true,
            data: result,
            total: result.length,
            message: 'Dados obtidos com sucesso',
          };
        }
      }

      // Fallback para formatos não reconhecidos
      console.warn('⚠️ Formato de resposta não reconhecido:', result);
      return {
        success: false,
        data: [],
        total: 0,
        message: 'Formato de dados inesperado',
      };
    } catch (error) {
      console.error('❌ Erro na API:', error);
      throw error;
    }
  }, []);

  // Buscar transações por operação
  const transacoesPorOperacao = useCallback(async (params = {}) => {
    const url = new URL('/api/sales/transacoes-por-operacao', API_BASE_URL);
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    });
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Erro ao buscar transações da operação');
    return await response.json();
  }, []);

  // Buscar transações por número da transação
  const transacoesPorNr = useCallback(async (params = {}) => {
    const url = new URL('/api/sales/transacoes-por-nr', API_BASE_URL);
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    });
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Erro ao buscar itens da transação');
    return await response.json();
  }, []);

  // Métodos específicos para cada tipo de endpoint
  const financial = {
    extrato: (params) => apiCall('/api/financial/extrato', params),
    extratoTotvs: (params) => apiCall('/api/financial/extrato-totvs', params),

    contasPagar: (params) => apiCall('/api/financial/contas-pagar', params),
    contasPagarEmissao: (params) =>
      apiCall('/api/financial/contas-pagar-emissao', params),
    contasReceber: (params) => apiCall('/api/financial/contas-receber', params),
    contasReceberEmissao: (params) =>
      apiCall('/api/financial/contas-receberemiss', params),
    fluxoCaixa: (params) => apiCall('/api/financial/fluxo-caixa', params),
    fluxocaixaSaida: (params) =>
      apiCall('/api/financial/fluxo-caixa-saida', params),
    nfManifestacao: (params) =>
      apiCall('/api/financial/nfmanifestacao', params),
    saldoConta: (params) => apiCall('/api/financial/saldo-conta', params),
    credevAdiantamento: (params) =>
      apiCall('/api/financial/credev-adiantamento', params),
    credevRevenda: (params) => apiCall('/api/financial/credev-revenda', params),
    credevVarejo: (params) => apiCall('/api/financial/credev-varejo', params),
    credevMtm: (params) => apiCall('/api/financial/credev-mtm', params),
    auditorCredev: (params) => apiCall('/api/financial/auditor-credev', params),
    fornecedor: (params) => apiCall('/api/financial/fornecedor', params),
    centrocusto: (params) => apiCall('/api/financial/centrocusto', params),
    despesa: (params) => apiCall('/api/financial/despesa', params),
    // 🆕 Nova rota para buscar TODAS as despesas (sem parâmetros obrigatórios)
    despesasTodas: (params = {}) =>
      apiCall('/api/financial/despesas-todas', params),
    inadimplentesMultimarcas: (params) =>
      apiCall('/api/financial/inadimplentes-multimarcas', params),
    // Nova rota para inadimplentes (franquias)
    inadimplentesFranquias: (params) =>
      apiCall('/api/financial/inadimplentes-franquias', params),
    inadimplentesRevenda: (params) =>
      apiCall('/api/financial/inadimplentes-revenda', params),
    // Observações de faturas (obsfati)
    obsFati: (params) => apiCall('/api/financial/obsfati', params),

    // 🆕 CRUD Despesas Manuais DRE
    /**
     * Adicionar despesa manual ao DRE
     * @param {Object} despesa - Dados da despesa
     * @param {string} despesa.dt_inicio - Data início do período (YYYY-MM-DD)
     * @param {string} despesa.dt_fim - Data fim do período (YYYY-MM-DD)
     * @param {string} despesa.categoria_principal - 'OPERACIONAL' ou 'FINANCEIRA'
     * @param {number} despesa.cd_despesaitem - Código da despesa do TOTVS
     * @param {string} despesa.fornecedor - Nome do fornecedor (opcional)
     * @param {number} despesa.cd_fornecedor - Código do fornecedor (opcional)
     * @param {number} despesa.valor - Valor da despesa
     * @param {string} despesa.observacoes - Observações (opcional)
     * @returns {Promise<Object>} Resposta da API
     */
    adicionarDespesaManual: (despesa) =>
      apiMutate('/api/financial/despesas-manuais-dre', 'POST', despesa),

    /**
     * Listar despesas manuais do DRE
     * @param {Object} params - Filtros de busca
     * @param {string} params.dt_inicio - Data início (opcional)
     * @param {string} params.dt_fim - Data fim (opcional)
     * @param {string} params.categoria_principal - Categoria (opcional)
     * @param {boolean} params.ativo - Filtrar por ativo/inativo (opcional)
     * @returns {Promise<Object>} Lista de despesas
     */
    listarDespesasManuais: (params) =>
      apiCall('/api/financial/despesas-manuais-dre', params),

    /**
     * Editar despesa manual existente
     * @param {string} id - UUID da despesa
     * @param {Object} despesa - Dados atualizados da despesa
     * @returns {Promise<Object>} Resposta da API
     */
    editarDespesaManual: (id, despesa) =>
      apiMutate(`/api/financial/despesas-manuais-dre/${id}`, 'PUT', despesa),

    /**
     * Excluir (desativar) despesa manual
     * @param {string} id - UUID da despesa
     * @returns {Promise<Object>} Resposta da API
     */
    excluirDespesaManual: (id) =>
      apiMutate(`/api/financial/despesas-manuais-dre/${id}`, 'DELETE'),
  };

  const sales = {
    // Rotas de faturamento usando views materializadas (otimizadas)
    faturamentoVarejo: (params) =>
      apiCall('/api/faturamento/fat-varejo', params),
    faturamentoMtm: (params) =>
      apiCall('/api/faturamento/fat-multimarcas', params),
    // Novo: faturamento Bazar
    faturamentoBazar: (params) => apiCall('/api/faturamento/fatbazar', params),
    // Novo: faturamento Fatsellect
    faturamentoFatsellect: (params) =>
      apiCall('/api/faturamento/fatsellect', params),
    faturamentoFranquias: (params) =>
      apiCall('/api/faturamento/fat-franquias', params),
    faturamentoRevenda: (params) =>
      apiCall('/api/faturamento/fat-revenda', params),
    faturamentoConsolidado: (params) =>
      apiCall('/api/faturamento/consolidado', params),
    // Rotas antigas mantidas para compatibilidade (caso precisem ser usadas novamente)
    faturamentoVarejoOld: (params) =>
      apiCall('/api/faturamento/varejo', params),
    faturamentoMtmOld: (params) => apiCall('/api/faturamento/mtm', params),
    faturamentoFranquiasOld: (params) =>
      apiCall('/api/faturamento/franquias', params),
    faturamentoRevendaOld: (params) =>
      apiCall('/api/faturamento/revenda', params),

    // Rotas de CMV usando views materializadas (otimizadas)
    cmvVarejo: (params) => apiCall('/api/faturamento/cmv-varejo', params),
    cmvMultimarcas: (params) =>
      apiCall('/api/faturamento/cmv-multimarcas', params),
    cmvFranquias: (params) => apiCall('/api/faturamento/cmv-franquias', params),
    cmvRevenda: (params) => apiCall('/api/faturamento/cmv-revenda', params),

    // Rotas antigas mantidas para compatibilidade (deprecadas)
    faturamento: (params) => apiCall('/api/sales/faturamento', params),
    faturamentoFranquia: (params) =>
      apiCall('/api/sales/faturamento-franquia', params),
    receitaliquidaFaturamento: (params) =>
      apiCall('/api/sales/receitaliquida-faturamento', params),
    receitaliquidaFranquias: (params) =>
      apiCall('/api/sales/receitaliquida-franquias', params),
    receitaliquidaMtm: (params) =>
      apiCall('/api/sales/receitaliquida-mtm', params),
    receitaliquidaRevenda: (params) =>
      apiCall('/api/sales/receitaliquida-revenda', params),
    rankingVendedores: (params) =>
      apiCall('/api/sales/ranking-vendedores', params),
    vlimposto: (params) => apiCall('/api/sales/vlimposto', params),
    cmvtest: (params) => apiCall('/api/sales/cmvtest', params),
    cmv: (params) => apiCall('/api/sales/cmv', params),
    // Rotas antigas de CMV removidas (cmvvarejo, cmvfranquia, cmvmultimarcas, cmvrevenda)
    // Use as novas rotas com views materializadas: cmvVarejo, cmvFranquias, cmvMultimarcas, cmvRevenda
    // Nova rota consolidada DRE - substitui as 4 consultas CMV paralelas
    dreData: (params) => apiCall('/api/sales/dre-data', params),
    // Versão RAW: retorna a resposta bruta da API, sem processamento
    dreDataRaw: async (params) => {
      // Construir URL com parâmetros
      const url = new URL('/api/sales/dre-data', API_BASE_URL);
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, v));
          } else {
            url.searchParams.append(key, value);
          }
        }
      });
      const response = await fetch(url.toString());
      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {}
        throw new Error(
          (errorBody && (errorBody.message || errorBody.error)) ||
            response.statusText ||
            'Erro ao processar requisição',
        );
      }
      return await response.json();
    },
    // Rotas de cache DRE
    dreCacheClear: () => apiCall('/api/sales/dre-cache', {}, 'DELETE'),
    dreCacheStats: () => apiCall('/api/sales/dre-cache/stats'),
    // Nova rota de auditoria de transações (similar ao DADOSTOTVS.TXT)
    auditoriaTransacoes: async (params) => {
      // Fazer a chamada diretamente sem o processamento padrão do apiCall
      const url = new URL(`${API_BASE_URL}/api/sales/auditoria-transacoes`);
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => url.searchParams.append(key, v));
          } else {
            url.searchParams.append(key, value);
          }
        }
      });

      console.log('🌐 API Call auditoriaTransacoes:', url.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {}
        throw new Error(
          (errorBody && (errorBody.message || errorBody.error)) ||
            response.statusText ||
            'Erro ao processar requisição',
        );
      }

      const result = await response.json();
      console.log('📦 Auditoria Response:', result);

      // Retornar a resposta original sem transformação
      return result;
    },
    // Rotas de impostos
    impostosPorCanal: (params) =>
      apiCall('/api/faturamento/impostos-por-canal', params),
    impostosDetalhados: (params) =>
      apiCall('/api/faturamento/impostos-detalhados', params),
  };

  const company = {
    empresas: (params) => apiCall('/api/company/empresas', params),
    grupoEmpresas: (params) => apiCall('/api/company/grupo-empresas', params),
    faturamentoLojas: (params) =>
      apiCall('/api/company/faturamento-lojas', params),
    expedicao: (params) => apiCall('/api/company/expedicao', params),
    pcp: (params) => apiCall('/api/company/pcp', params),
  };

  const franchise = {
    franquiasCredev: (params) =>
      apiCall('/api/franchise/franquias-credev', params),
    meusPedidos: (params) => apiCall('/api/franchise/meuspedidos', params),
  };

  const utils = {
    health: () => apiCall('/api/utils/health'),
    stats: () => apiCall('/api/utils/stats'),
    autocompleteFantasia: (q) =>
      apiCall('/api/utils/autocomplete/nm_fantasia', { q }),
    autocompleteGrupoEmpresa: (q) =>
      apiCall('/api/utils/autocomplete/nm_grupoempresa', { q }),
    cadastroPessoa: (params) => apiCall('/api/utils/cadastropessoa', params),
  };

  return {
    apiCall,
    apiMutate,
    transacoesPorOperacao,
    transacoesPorNr,
    financial,
    sales,
    company,
    franchise,
    utils,
  };
};

export default useApiClient;
