import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const useClassificacoesInadimplentes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Salvar ou atualizar classificação de um cliente
   * @param {Object} classificacao - Dados da classificação
   * @returns {Object} - Resultado da operação
   */
  const salvarClassificacao = async (classificacao) => {
    setLoading(true);
    setError(null);

    try {
      const dadosParaSalvar = {
        cd_cliente: classificacao.cd_cliente,
        nm_cliente: classificacao.nm_cliente,
        valor_total: classificacao.valor_total,
        ds_siglaest: classificacao.ds_siglaest,
        situacao: classificacao.situacao,
        feeling: classificacao.feeling || null,
        status: classificacao.status || null,
        usuario: classificacao.usuario,
        data_alteracao: new Date().toISOString(),
      };

      // Usar UPSERT para inserir ou atualizar
      const { data, error: upsertError } = await supabase
        .from('classificacoes_inadimplentes')
        .upsert(dadosParaSalvar, {
          onConflict: 'cd_cliente',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        throw upsertError;
      }

      return { success: true, data };
    } catch (err) {
      console.error('Erro ao salvar classificação:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Buscar todas as classificações
   * @returns {Object} - Lista de classificações
   */
  const buscarClassificacoes = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('classificacoes_inadimplentes')
        .select('*')
        .order('data_alteracao', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, data };
    } catch (err) {
      console.error('Erro ao buscar classificações:', err);
      setError(err.message);
      return { success: false, error: err.message, data: [] };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Buscar classificação de um cliente específico
   * @param {string} cdCliente - Código do cliente
   * @returns {Object} - Classificação do cliente
   */
  const buscarClassificacaoPorCliente = async (cdCliente) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('classificacoes_inadimplentes')
        .select('*')
        .eq('cd_cliente', cdCliente)
        .maybeSingle(); // Retorna null se não encontrar

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, data };
    } catch (err) {
      console.error('Erro ao buscar classificação do cliente:', err);
      setError(err.message);
      return { success: false, error: err.message, data: null };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Deletar classificação de um cliente
   * @param {string} cdCliente - Código do cliente
   * @returns {Object} - Resultado da operação
   */
  const deletarClassificacao = async (cdCliente) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('classificacoes_inadimplentes')
        .delete()
        .eq('cd_cliente', cdCliente);

      if (deleteError) {
        throw deleteError;
      }

      return { success: true };
    } catch (err) {
      console.error('Erro ao deletar classificação:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salvar múltiplas classificações em lote
   * @param {Array} classificacoes - Array de classificações
   * @returns {Object} - Resultado da operação
   */
  const salvarClassificacoesEmLote = async (classificacoes) => {
    setLoading(true);
    setError(null);

    try {
      const dadosParaSalvar = classificacoes.map((c) => ({
        cd_cliente: c.cd_cliente,
        nm_cliente: c.nm_cliente,
        valor_total: c.valor_total,
        ds_siglaest: c.ds_siglaest,
        situacao: c.situacao,
        feeling: c.feeling || null,
        status: c.status || null,
        usuario: c.usuario,
        data_alteracao: new Date().toISOString(),
      }));

      const { data, error: upsertError } = await supabase
        .from('classificacoes_inadimplentes')
        .upsert(dadosParaSalvar, {
          onConflict: 'cd_cliente',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        throw upsertError;
      }

      return { success: true, data };
    } catch (err) {
      console.error('Erro ao salvar classificações em lote:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Buscar histórico de alterações (log)
   * @param {string} cdCliente - Código do cliente (opcional)
   * @returns {Object} - Histórico de alterações
   */
  const buscarHistorico = async (cdCliente = null) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('classificacoes_inadimplentes')
        .select('*')
        .order('data_alteracao', { ascending: false });

      if (cdCliente) {
        query = query.eq('cd_cliente', cdCliente);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, data };
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      setError(err.message);
      return { success: false, error: err.message, data: [] };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    salvarClassificacao,
    buscarClassificacoes,
    buscarClassificacaoPorCliente,
    deletarClassificacao,
    salvarClassificacoesEmLote,
    buscarHistorico,
  };
};

export default useClassificacoesInadimplentes;
