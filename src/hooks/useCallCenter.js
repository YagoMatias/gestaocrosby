import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook de persistência do módulo Call Center (cobrança Multimarcas).
 *
 * Tabelas (ver database/schema-call-center.sql):
 *  - call_center_contatos: estado atual por cliente (telefone, última ligação, próximo contato)
 *  - call_center_ligacoes: histórico append-only de cada ligação registrada
 */
export const useCallCenter = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Buscar o estado de contato de todos os clientes
   * @returns {Object} - { success, data: [] }
   */
  const buscarContatos = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('call_center_contatos')
        .select('*');

      if (fetchError) throw fetchError;

      return { success: true, data: data || [] };
    } catch (err) {
      console.error('Erro ao buscar contatos do call center:', err);
      setError(err.message);
      return { success: false, error: err.message, data: [] };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salvar (upsert) o estado de contato de um cliente
   * @param {Object} contato - { cd_cliente, nm_cliente, telefone, ultima_ligacao, proximo_contato, status_contato, observacao, usuario }
   * @returns {Object} - { success, data }
   */
  const salvarContato = async (contato) => {
    setLoading(true);
    setError(null);

    try {
      const dadosParaSalvar = {
        cd_cliente: String(contato.cd_cliente),
        usuario: contato.usuario || null,
        data_alteracao: new Date().toISOString(),
      };

      // Só grava as colunas realmente informadas — um upsert parcial (ex.: apenas
      // o telefone) não pode zerar a última ligação já salva.
      const CAMPOS = [
        'nm_cliente',
        'telefone',
        'ultima_ligacao',
        'proximo_contato',
        'status_contato',
        'observacao',
      ];
      CAMPOS.forEach((campo) => {
        if (campo in contato) dadosParaSalvar[campo] = contato[campo] || null;
      });

      const { data, error: upsertError } = await supabase
        .from('call_center_contatos')
        .upsert(dadosParaSalvar, {
          onConflict: 'cd_cliente',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) throw upsertError;

      return { success: true, data: data?.[0] || null };
    } catch (err) {
      console.error('Erro ao salvar contato do call center:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Registrar uma ligação no histórico
   * @param {Object} ligacao - { cd_cliente, nm_cliente, telefone, data_ligacao, status_ligacao, proximo_contato, observacao, valor_vencido, usuario }
   * @returns {Object} - { success, data }
   */
  const registrarLigacao = async (ligacao) => {
    setLoading(true);
    setError(null);

    try {
      const dadosParaSalvar = {
        cd_cliente: String(ligacao.cd_cliente),
        nm_cliente: ligacao.nm_cliente || null,
        telefone: ligacao.telefone || null,
        data_ligacao: ligacao.data_ligacao,
        status_ligacao: ligacao.status_ligacao,
        proximo_contato: ligacao.proximo_contato || null,
        observacao: ligacao.observacao || null,
        valor_vencido: ligacao.valor_vencido ?? null,
        usuario: ligacao.usuario,
        data_criacao: new Date().toISOString(),
      };

      const { data, error: insertError } = await supabase
        .from('call_center_ligacoes')
        .insert(dadosParaSalvar)
        .select();

      if (insertError) throw insertError;

      return { success: true, data: data?.[0] || null };
    } catch (err) {
      console.error('Erro ao registrar ligação:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Buscar histórico de ligações de um cliente (ou de todos)
   * @param {string|null} cdCliente - Código do cliente (opcional)
   * @returns {Object} - { success, data: [] }
   */
  const buscarLigacoes = async (cdCliente = null) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('call_center_ligacoes')
        .select('*')
        .order('data_ligacao', { ascending: false })
        .order('data_criacao', { ascending: false });

      if (cdCliente) query = query.eq('cd_cliente', String(cdCliente));

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      return { success: true, data: data || [] };
    } catch (err) {
      console.error('Erro ao buscar ligações:', err);
      setError(err.message);
      return { success: false, error: err.message, data: [] };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Excluir uma ligação do histórico
   * @param {number} id - ID da ligação
   * @returns {Object} - { success }
   */
  const deletarLigacao = async (id) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('call_center_ligacoes')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir ligação:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    buscarContatos,
    salvarContato,
    registrarLigacao,
    buscarLigacoes,
    deletarLigacao,
  };
};

export default useCallCenter;
