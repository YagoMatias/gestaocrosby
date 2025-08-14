import { supabase } from './supabase';

// Nome da tabela no Supabase
const TABLE_NAME = 'retorno_bancario';

/**
 * Verifica se um arquivo já foi processado
 * @param {string} nomeArquivo - Nome do arquivo
 * @param {number} valor - Valor do saldo
 * @param {string} bancoNome - Nome do banco
 * @param {string} bancoCodigo - Código do banco
 * @param {string} dataGeracao - Data de geração do arquivo
 * @returns {Promise<boolean>} - true se já existe, false se não
 */
export const verificarArquivoExistente = async (nomeArquivo, valor, bancoNome, bancoCodigo, dataGeracao) => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('nome_arquivo', nomeArquivo)
      .eq('valor', valor)
      .eq('banco_nome', bancoNome)
      .eq('banco_codigo', bancoCodigo)
      .eq('data_geracao', dataGeracao)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PGRST116 = no rows returned
        return false; // Arquivo não existe
      }
      if (error.code === '42501') { // Erro de permissão RLS
        console.warn('Erro de permissão RLS - assumindo que arquivo não existe:', error.message);
        return false; // Assumir que não existe para permitir inserção
      }
      console.error('Erro ao verificar arquivo existente:', error);
      throw error;
    }

    return !!data; // Retorna true se encontrou, false se não
  } catch (error) {
    console.error('Erro na verificação de arquivo existente:', error);
    // Em caso de erro, assumir que arquivo não existe para permitir inserção
    return false;
  }
};

/**
 * Salva os dados do arquivo .RET no Supabase
 * @param {Object} dados - Dados do arquivo processado
 * @returns {Promise<Object>} - Resultado da operação
 */
export const salvarRetornoBancario = async (dados) => {
  try {
    // Verificar se o arquivo já existe
    const arquivoExiste = await verificarArquivoExistente(
      dados.nomeArquivo,
      dados.valor,
      dados.banco.nome,
      dados.banco.codigo,
      dados.dataGeracao
    );

    if (arquivoExiste) {
      return {
        success: false,
        message: `Arquivo "${dados.nomeArquivo}" já foi processado anteriormente`,
        duplicate: true
      };
    }

    // Preparar dados para inserção
    const dadosParaInserir = {
      nome_arquivo: dados.nomeArquivo,
      data_upload: dados.dataUpload,
      valor: dados.valor,
      banco_nome: dados.banco.nome,
      banco_codigo: dados.banco.codigo,
      banco_layout: dados.banco.layout,
      agencia: dados.agencia,
      conta: dados.conta,
      saldo_formatado: dados.saldoFormatado,
      data_processamento: new Date().toISOString(),
      data_geracao: dados.dataGeracao,
      created_at: new Date().toISOString()
    };

    // Inserir no Supabase
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([dadosParaInserir])
      .select()
      .single();

    if (error) {
      if (error.code === '42501') { // Erro de permissão RLS
        console.error('Erro de permissão RLS - verifique se a tabela está configurada corretamente:', error.message);
        throw new Error('Erro de permissão no banco de dados. Verifique a configuração da tabela.');
      }
      if (error.code === '23505') { // Violação de chave única
        console.warn('Arquivo duplicado detectado pelo banco:', error.message);
        return {
          success: false,
          message: `Arquivo "${dados.nomeArquivo}" com valor ${dados.valor} do banco ${dados.banco.nome} e data de geração ${new Date(dados.dataGeracao).toLocaleString('pt-BR')} já foi processado anteriormente`,
          duplicate: true
        };
      }
      console.error('Erro ao salvar retorno bancário:', error);
      throw error;
    }

    return {
      success: true,
      message: 'Arquivo salvo com sucesso no banco de dados',
      data: data
    };

  } catch (error) {
    console.error('Erro ao salvar retorno bancário:', error);
    return {
      success: false,
      message: 'Erro ao salvar no banco de dados: ' + error.message,
      error: error
    };
  }
};

/**
 * Busca todos os retornos bancários salvos
 * @param {Object} filtros - Filtros opcionais
 * @returns {Promise<Array>} - Lista de retornos bancários
 */
export const buscarRetornosBancarios = async (filtros = {}) => {
  try {
    let query = supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    // Aplicar filtros se fornecidos
    if (filtros.banco) {
      query = query.eq('banco_nome', filtros.banco);
    }

    if (filtros.dataInicio) {
      query = query.gte('data_upload', filtros.dataInicio);
    }

    if (filtros.dataFim) {
      query = query.lte('data_upload', filtros.dataFim);
    }

    if (filtros.limit) {
      query = query.limit(filtros.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar retornos bancários:', error);
      throw error;
    }

    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Erro ao buscar retornos bancários:', error);
    return {
      success: false,
      message: 'Erro ao buscar dados: ' + error.message,
      error: error
    };
  }
};

/**
 * Busca estatísticas dos retornos bancários
 * @returns {Promise<Object>} - Estatísticas
 */
export const buscarEstatisticasRetornos = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('valor, banco_nome, data_upload');

    if (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }

    // Calcular estatísticas
    const totalArquivos = data.length;
    const saldoTotal = data.reduce((sum, item) => sum + parseFloat(item.valor), 0);
    const bancosUnicos = [...new Set(data.map(item => item.banco_nome))];
    
    // Agrupar por banco
    const porBanco = {};
    data.forEach(item => {
      if (!porBanco[item.banco_nome]) {
        porBanco[item.banco_nome] = {
          total: 0,
          valor: 0
        };
      }
      porBanco[item.banco_nome].total++;
      porBanco[item.banco_nome].valor += parseFloat(item.valor);
    });

    return {
      success: true,
      data: {
        totalArquivos,
        saldoTotal,
        saldoTotalFormatado: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(saldoTotal),
        bancosUnicos,
        porBanco
      }
    };

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return {
      success: false,
      message: 'Erro ao buscar estatísticas: ' + error.message,
      error: error
    };
  }
};

/**
 * Remove um retorno bancário específico
 * @param {number} id - ID do registro
 * @returns {Promise<Object>} - Resultado da operação
 */
export const removerRetornoBancario = async (id) => {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover retorno bancário:', error);
      throw error;
    }

    return {
      success: true,
      message: 'Registro removido com sucesso'
    };

  } catch (error) {
    console.error('Erro ao remover retorno bancário:', error);
    return {
      success: false,
      message: 'Erro ao remover registro: ' + error.message,
      error: error
    };
  }
};

/**
 * Busca saldos por conta e período na tabela retorno_bancario
 * @param {Object} filtros - Filtros de busca
 * @param {Array} contas - Array de números de conta
 * @param {string} dataInicio - Data de início (YYYY-MM-DD)
 * @param {string} dataFim - Data de fim (YYYY-MM-DD)
 * @returns {Promise<Object>} - Resultado da busca
 */
export const buscarSaldosPorConta = async (filtros = {}) => {
  try {
    let query = supabase
      .from(TABLE_NAME)
      .select('*')
      .order('data_upload', { ascending: false });

    // Aplicar filtros se fornecidos
    if (filtros.contas && filtros.contas.length > 0) {
      query = query.in('conta', filtros.contas);
    }

    if (filtros.dataInicio) {
      query = query.gte('data_upload', filtros.dataInicio + 'T00:00:00');
    }

    if (filtros.dataFim) {
      query = query.lte('data_upload', filtros.dataFim + 'T23:59:59');
    }

    if (filtros.banco) {
      query = query.eq('banco_nome', filtros.banco);
    }

    // Se não há filtros, retornar todos os dados
    if (Object.keys(filtros).length === 0) {
      query = supabase
        .from(TABLE_NAME)
        .select('*')
        .order('data_upload', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar saldos por conta:', error);
      throw error;
    }

    // Processar os dados para agrupar por conta
    const saldosPorConta = {};
    
    data.forEach(item => {
      const conta = item.conta;
      if (!saldosPorConta[conta]) {
        saldosPorConta[conta] = {
          numero: conta,
          nome: `Conta ${conta}`,
          saldo: 0,
          ultimaAtualizacao: null,
          banco: item.banco_nome,
          agencia: item.agencia,
          registros: []
        };
      }
      
      // Usar o valor mais recente como saldo atual
      const dataUpload = new Date(item.data_upload);
      if (!saldosPorConta[conta].ultimaAtualizacao || dataUpload > saldosPorConta[conta].ultimaAtualizacao) {
        saldosPorConta[conta].saldo = parseFloat(item.valor);
        saldosPorConta[conta].ultimaAtualizacao = dataUpload;
        saldosPorConta[conta].banco = item.banco_nome;
        saldosPorConta[conta].agencia = item.agencia;
      }
      
      saldosPorConta[conta].registros.push(item);
    });

    // Converter para array e ordenar por saldo
    const resultado = Object.values(saldosPorConta).sort((a, b) => b.saldo - a.saldo);

    return {
      success: true,
      data: resultado,
      totalRegistros: data.length,
      totalContas: resultado.length
    };

  } catch (error) {
    console.error('Erro ao buscar saldos por conta:', error);
    return {
      success: false,
      message: 'Erro ao buscar dados: ' + error.message,
      error: error
    };
  }
};


