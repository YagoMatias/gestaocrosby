import { supabase } from '../lib/supabase';

/**
 * Salvar nova observação na tabela observacoes_despesas_manuais
 * @param {Object} dados - { id_despesa_manual, observacao }
 */
export const salvarObservacaoDespesaManualChat = async (dados) => {
  try {
    console.log('💬 Salvando observação de despesa manual (CHAT):', dados);

    // Buscar usuário autenticado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Erro ao buscar usuário:', userError);
      throw new Error('Usuário não autenticado');
    }

    // INSERT na tabela observacoes_despesas_manuais
    const { data, error } = await supabase
      .from('observacoes_despesas_manuais')
      .insert({
        cd_usuario: user.id,
        id_despesa_manual: dados.id_despesa_manual,
        observacao: dados.observacao,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ Erro ao inserir observação:', error);
      throw error;
    }

    console.log('✅ Observação inserida com sucesso:', data);

    // Buscar dados do usuário
    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuarios_view')
      .select('*')
      .eq('id', user.id)
      .single();

    if (usuarioError) {
      console.warn('⚠️ Erro ao buscar dados do usuário:', usuarioError);
    }

    console.log('👤 Dados do usuário:', usuarioData);

    return {
      success: true,
      data: {
        ...data,
        usuario: usuarioData || null,
      },
    };
  } catch (error) {
    console.error('❌ Erro ao salvar observação de despesa manual:', error);
    throw error;
  }
};

/**
 * Buscar todas as observações de uma despesa manual
 * @param {string} idDespesaManual - UUID da despesa manual
 */
export const buscarObservacoesDespesaManual = async (idDespesaManual) => {
  try {
    console.log('🔍 Buscando observações da despesa manual:', idDespesaManual);

    const { data: observacoes, error } = await supabase
      .from('observacoes_despesas_manuais')
      .select('*')
      .eq('id_despesa_manual', idDespesaManual)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar observações:', error);
      throw error;
    }

    // Buscar dados dos usuários
    const usuariosIds = [...new Set(observacoes.map((o) => o.cd_usuario))];
    
    if (usuariosIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data: usuariosData } = await supabase
      .from('usuarios_view')
      .select('*')
      .in('id', usuariosIds);

    const usuariosMap = new Map(usuariosData?.map((u) => [u.id, u]) || []);

    const observacoesCompletas = observacoes.map((obs) => ({
      ...obs,
      usuario: usuariosMap.get(obs.cd_usuario) || null,
    }));

    console.log(`✅ ${observacoesCompletas.length} observações encontradas`);

    return {
      success: true,
      data: observacoesCompletas,
    };
  } catch (error) {
    console.error('❌ Erro ao buscar observações:', error);
    throw error;
  }
};

/**
 * Deletar observação (soft delete)
 * @param {string} idObservacao - UUID da observação
 */
export const deletarObservacaoDespesaManual = async (idObservacao) => {
  try {
    const { error } = await supabase
      .from('observacoes_despesas_manuais')
      .update({ is_active: false })
      .eq('id', idObservacao);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao deletar observação:', error);
    throw error;
  }
};
