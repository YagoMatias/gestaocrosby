import { supabase } from '../lib/supabase';

/**
 * Serviço para gerenciar observações de despesas do TOTVS
 *
 * Tabela: observacoes_despesas_totvs
 * Campos:
 * - id (UUID, primary key)
 * - cd_empresa (integer)
 * - cd_despesaitem (integer)
 * - cd_fornecedor (integer)
 * - nr_duplicata (text)
 * - nr_parcela (integer)
 * - observacao (text)
 * - dt_inicio (date) - período da DRE
 * - dt_fim (date) - período da DRE
 * - cd_usuario (UUID, fk para auth.users)
 * - created_at (timestamp)
 * - updated_at (timestamp)
 */

/**
 * Cria ou atualiza uma observação para uma despesa do TOTVS
 * @param {Object} dados - Dados da observação
 * @param {number} dados.cd_empresa - Código da empresa
 * @param {number} dados.cd_despesaitem - Código do item de despesa
 * @param {number} dados.cd_fornecedor - Código do fornecedor
 * @param {string} dados.nr_duplicata - Número da duplicata
 * @param {number} dados.nr_parcela - Número da parcela
 * @param {string} dados.observacao - Texto da observação
 * @param {string} dados.dt_inicio - Data inicial do período DRE
 * @param {string} dados.dt_fim - Data final do período DRE
 * @returns {Promise<Object>} Resultado da operação
 */
export const salvarObservacaoDespesa = async (dados) => {
  try {
    console.log('💾 Salvando observação de despesa TOTVS:', dados);

    // Obter usuário atual
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se já existe uma observação para esta despesa neste período
    const { data: existente, error: buscaError } = await supabase
      .from('observacoes_despesas_totvs')
      .select('id')
      .eq('cd_empresa', dados.cd_empresa)
      .eq('cd_despesaitem', dados.cd_despesaitem)
      .eq('cd_fornecedor', dados.cd_fornecedor)
      .eq('nr_duplicata', dados.nr_duplicata)
      .eq('nr_parcela', dados.nr_parcela)
      .eq('dt_inicio', dados.dt_inicio)
      .eq('dt_fim', dados.dt_fim)
      .maybeSingle();

    if (buscaError) {
      console.error('❌ Erro ao buscar observação existente:', buscaError);
      throw buscaError;
    }

    if (existente) {
      // Atualizar observação existente
      console.log('🔄 Atualizando observação existente:', existente.id);
      const { data, error } = await supabase
        .from('observacoes_despesas_totvs')
        .update({
          observacao: dados.observacao,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar observação:', error);
        throw error;
      }

      // 🆕 Buscar informações do usuário separadamente
      if (data && data.cd_usuario) {
        const { data: userData, error: userError } = await supabase
          .from('usuarios_view')
          .select('id, email, raw_user_meta_data')
          .eq('id', data.cd_usuario)
          .single();

        if (!userError && userData) {
          data.usuario = userData;
        }
      }

      console.log('✅ Observação atualizada:', data);
      return { success: true, data, isNew: false };
    } else {
      // Criar nova observação
      console.log('✨ Criando nova observação');
      const { data, error } = await supabase
        .from('observacoes_despesas_totvs')
        .insert({
          cd_empresa: dados.cd_empresa,
          cd_despesaitem: dados.cd_despesaitem,
          cd_fornecedor: dados.cd_fornecedor,
          nr_duplicata: dados.nr_duplicata,
          nr_parcela: dados.nr_parcela,
          observacao: dados.observacao,
          dt_inicio: dados.dt_inicio,
          dt_fim: dados.dt_fim,
          cd_usuario: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar observação:', error);
        throw error;
      }

      // 🆕 Buscar informações do usuário separadamente
      if (data && data.cd_usuario) {
        const { data: userData, error: userError } = await supabase
          .from('usuarios_view')
          .select('id, email, raw_user_meta_data')
          .eq('id', data.cd_usuario)
          .single();

        if (!userError && userData) {
          data.usuario = userData;
        }
      }

      console.log('✅ Observação criada:', data);
      return { success: true, data, isNew: true };
    }
  } catch (error) {
    console.error('❌ Erro ao salvar observação de despesa:', error);
    throw error;
  }
};

/**
 * Busca observações de despesas do TOTVS para um período
 * @param {string} dt_inicio - Data inicial do período
 * @param {string} dt_fim - Data final do período
 * @returns {Promise<Array>} Array de observações
 */
export const buscarObservacoesPeriodo = async (dt_inicio, dt_fim) => {
  try {
    console.log('🔍 Buscando observações do período:', { dt_inicio, dt_fim });

    const { data, error } = await supabase
      .from('observacoes_despesas_totvs')
      .select('*')
      .eq('dt_inicio', dt_inicio)
      .eq('dt_fim', dt_fim);

    if (error) {
      console.error('❌ Erro ao buscar observações:', error);
      throw error;
    }

    // 🆕 Buscar informações dos usuários separadamente
    if (data && data.length > 0) {
      const userIds = [
        ...new Set(data.map((d) => d.cd_usuario).filter(Boolean)),
      ];

      if (userIds.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('usuarios_view')
          .select('id, email, raw_user_meta_data')
          .in('id', userIds);

        if (!userError && users) {
          // Criar mapa de usuários
          const userMap = new Map(users.map((u) => [u.id, u]));

          // Adicionar informações do usuário a cada observação
          data.forEach((obs) => {
            if (obs.cd_usuario) {
              obs.usuario = userMap.get(obs.cd_usuario);
            }
          });
        }
      }
    }

    console.log(`✅ ${data.length} observações encontradas`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao buscar observações:', error);
    return [];
  }
};

/**
 * Deleta uma observação de despesa
 * @param {string} id - UUID da observação
 * @returns {Promise<Object>} Resultado da operação
 */
export const deletarObservacaoDespesa = async (id) => {
  try {
    console.log('🗑️ Deletando observação:', id);

    const { error } = await supabase
      .from('observacoes_despesas_totvs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Erro ao deletar observação:', error);
      throw error;
    }

    console.log('✅ Observação deletada com sucesso');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao deletar observação:', error);
    throw error;
  }
};
