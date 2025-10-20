/**
 * Query Builder API - Render
 * Consulta metadados e executa queries no banco ERP (READ-ONLY)
 * API: https://apigestaocrosby-bw2v.onrender.com
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://apigestaocrosby-bw2v.onrender.com';

// =============================================================================
// METADADOS (Tabelas e Colunas)
// =============================================================================

/**
 * Buscar lista de todas as tabelas disponíveis
 * @returns {Promise} Lista de tabelas
 */
export async function fetchTables() {
  console.log('🌐 [API] fetchTables iniciado');
  console.log('🌐 [API] URL:', `${API_BASE_URL}/api/querybuilder/tables`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/querybuilder/tables`);
    console.log('🌐 [API] Response status:', response.status);
    console.log('🌐 [API] Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [API] Response error:', errorText);
      throw new Error(
        `Erro ao buscar tabelas: ${response.status} - ${errorText}`,
      );
    }

    const result = await response.json();
    console.log('📦 [API] Result completo:', result);
    console.log('📊 [API] Tables data:', result.data?.tables);

    return { success: true, data: result.data.tables };
  } catch (error) {
    console.error('💥 [API] Exception em fetchTables:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar colunas de uma tabela específica
 * @param {string} tableName - Nome da tabela
 * @returns {Promise} Lista de colunas com metadados
 */
export async function fetchTableColumns(tableName) {
  console.log('🌐 [API] fetchTableColumns iniciado para:', tableName);
  console.log(
    '🌐 [API] URL:',
    `${API_BASE_URL}/api/querybuilder/tables/${tableName}/columns`,
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/querybuilder/tables/${tableName}/columns`,
    );
    console.log('🌐 [API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [API] Response error:', errorText);
      throw new Error(`Erro ao buscar colunas: ${response.status}`);
    }

    const result = await response.json();
    console.log('📦 [API] Colunas resultado:', result);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('💥 [API] Exception em fetchTableColumns:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// EXECUÇÃO DE QUERIES
// =============================================================================

/**
 * Executar query customizada
 * @param {object} queryConfig - Configuração da query
 * @param {Array} queryConfig.select - Colunas a selecionar
 * @param {string} queryConfig.from - Tabela
 * @param {Array} queryConfig.where - Condições WHERE
 * @param {Array} queryConfig.groupBy - Agrupamento
 * @param {Array} queryConfig.orderBy - Ordenação
 * @param {number} queryConfig.limit - Limite de registros
 * @returns {Promise} Resultado da query
 */
export async function executeQuery(queryConfig) {
  try {
    console.log('🌐 [executeQuery] Executando query:', queryConfig);

    const response = await fetch(`${API_BASE_URL}/api/querybuilder/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryConfig),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao executar query');
    }

    const result = await response.json();

    console.log('✅ [executeQuery] Resultado:', result);

    return {
      success: true,
      data: {
        rows: result.data?.rows || result.data || [],
        total: result.data?.total || result.total || 0,
      },
      executionTime: result.executionTime,
    };
  } catch (error) {
    console.error('❌ [executeQuery] Erro:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Executar preview da query (limite 10 registros)
 * @param {object} queryConfig - Configuração da query
 * @returns {Promise} Preview dos dados
 */
export async function previewQuery(queryConfig) {
  console.log('🌐 [API] previewQuery iniciado');
  console.log('🌐 [API] URL:', `${API_BASE_URL}/api/querybuilder/preview`);
  console.log('🌐 [API] Query Config:', queryConfig);

  try {
    const startTime = Date.now();
    console.log('🌐 [API] Enviando requisição POST...');

    const response = await fetch(`${API_BASE_URL}/api/querybuilder/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryConfig),
    });

    const fetchTime = Date.now() - startTime;
    console.log(`🌐 [API] Response recebido em ${fetchTime}ms`);
    console.log('🌐 [API] Response status:', response.status);
    console.log('🌐 [API] Response ok:', response.ok);

    if (!response.ok) {
      console.error('❌ [API] Response não OK, tentando ler erro...');
      const errorText = await response.text();
      console.error('❌ [API] Error response:', errorText);

      try {
        const error = JSON.parse(errorText);
        throw new Error(
          error.message || `Erro ${response.status}: ${errorText}`,
        );
      } catch (parseErr) {
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
    }

    console.log('📦 [API] Parseando JSON...');
    const result = await response.json();
    console.log('📦 [API] Result completo:', result);
    console.log('📦 [API] Rows:', result.data?.rows?.length || 0, 'registros');

    return {
      success: true,
      data: result.data.rows,
      total: result.data.total,
      executionTime: result.executionTime,
    };
  } catch (error) {
    console.error('💥 [API] Exception em previewQuery:', error);
    console.error('💥 [API] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Validar configuração de query
 * @param {object} queryConfig - Configuração da query
 * @returns {object} { valid: boolean, errors: Array }
 */
export function validateQueryConfig(queryConfig) {
  const errors = [];

  if (!queryConfig.from || typeof queryConfig.from !== 'string') {
    errors.push('Campo "from" é obrigatório e deve ser uma string');
  }

  if (
    !queryConfig.select ||
    !Array.isArray(queryConfig.select) ||
    queryConfig.select.length === 0
  ) {
    errors.push(
      'Campo "select" é obrigatório e deve ter pelo menos uma coluna',
    );
  }

  if (queryConfig.where && !Array.isArray(queryConfig.where)) {
    errors.push('Campo "where" deve ser um array');
  }

  if (queryConfig.groupBy && !Array.isArray(queryConfig.groupBy)) {
    errors.push('Campo "groupBy" deve ser um array');
  }

  if (queryConfig.orderBy && !Array.isArray(queryConfig.orderBy)) {
    errors.push('Campo "orderBy" deve ser um array');
  }

  if (queryConfig.limit && typeof queryConfig.limit !== 'number') {
    errors.push('Campo "limit" deve ser um número');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Construir filtro WHERE simples
 * @param {string} column - Coluna
 * @param {string} operator - Operador (=, >, <, LIKE, etc)
 * @param {any} value - Valor
 * @returns {object} Objeto de filtro
 */
export function buildWhereFilter(column, operator, value) {
  return {
    column,
    operator,
    value,
  };
}

/**
 * Construir ordenação
 * @param {string} column - Coluna
 * @param {string} direction - Direção ('ASC' ou 'DESC')
 * @returns {object} Objeto de ordenação
 */
export function buildOrderBy(column, direction = 'ASC') {
  return {
    column,
    direction: direction.toUpperCase(),
  };
}
