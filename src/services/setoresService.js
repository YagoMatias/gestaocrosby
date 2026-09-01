import { supabase } from '../lib/supabase';

/**
 * Serviço de gerenciamento de Setores e Gestores
 * Tabelas: setores (nome, ordem, gestor_id) e setor_usuarios (setor_id, user_id)
 * Todas as funções retornam { data, error } seguindo o padrão Supabase
 */

/**
 * Busca todos os setores ordenados
 */
export const getSetores = async () => {
  try {
    const { data, error } = await supabase
      .from('setores')
      .select('*')
      .order('ordem', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar setores:', error);
    return { data: [], error };
  }
};

/**
 * Busca todos os vínculos usuário ↔ setor
 */
export const getSetorUsuarios = async () => {
  try {
    const { data, error } = await supabase
      .from('setor_usuarios')
      .select('id, setor_id, user_id, created_at');

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar vínculos de setor:', error);
    return { data: [], error };
  }
};

/**
 * Busca setores já com a lista de membros embutida
 * Retorna: [{ ...setor, membros: [{ user_id, vinculo_id }] }]
 */
export const getSetoresComMembros = async () => {
  const [setoresRes, vinculosRes] = await Promise.all([
    getSetores(),
    getSetorUsuarios(),
  ]);

  if (setoresRes.error) return setoresRes;
  if (vinculosRes.error) return vinculosRes;

  const data = setoresRes.data.map((setor) => ({
    ...setor,
    membros: vinculosRes.data
      .filter((v) => v.setor_id === setor.id)
      .map((v) => ({ user_id: v.user_id, vinculo_id: v.id })),
  }));

  return { data, error: null };
};

/**
 * Define (ou remove, passando null) o gestor de um setor
 */
export const setGestorSetor = async (setorId, gestorId) => {
  try {
    const { error } = await supabase
      .from('setores')
      .update({ gestor_id: gestorId })
      .eq('id', setorId);

    if (error) throw error;
    return { data: true, error: null };
  } catch (error) {
    console.error('Erro ao definir gestor do setor:', error);
    return { data: false, error };
  }
};

/**
 * Adiciona usuários a setores em massa (ignora vínculos duplicados)
 * @param {Array<string>} userIds
 * @param {Array<string>} setorIds
 */
export const addUsersToSetores = async (userIds, setorIds) => {
  try {
    if (!userIds?.length || !setorIds?.length) {
      return { data: 0, error: null };
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    const rows = [];
    for (const setorId of setorIds) {
      for (const userId of userIds) {
        rows.push({
          setor_id: setorId,
          user_id: userId,
          created_by: currentUser?.id,
        });
      }
    }

    const { error } = await supabase
      .from('setor_usuarios')
      .upsert(rows, { onConflict: 'setor_id,user_id', ignoreDuplicates: true });

    if (error) throw error;
    return { data: rows.length, error: null };
  } catch (error) {
    console.error('Erro ao adicionar usuários aos setores:', error);
    return { data: 0, error };
  }
};

/**
 * Remove um usuário de um setor
 */
export const removeUserFromSetor = async (setorId, userId) => {
  try {
    const { error } = await supabase
      .from('setor_usuarios')
      .delete()
      .eq('setor_id', setorId)
      .eq('user_id', userId);

    if (error) throw error;
    return { data: true, error: null };
  } catch (error) {
    console.error('Erro ao remover usuário do setor:', error);
    return { data: false, error };
  }
};

/**
 * Remove um usuário de TODOS os setores (útil ao desligar/excluir usuário)
 */
export const removeUserFromAllSetores = async (userId) => {
  try {
    const { error } = await supabase
      .from('setor_usuarios')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return { data: true, error: null };
  } catch (error) {
    console.error('Erro ao remover usuário dos setores:', error);
    return { data: false, error };
  }
};

/**
 * Mapa user_id → [nomes de setores] (inclui setores em que o usuário é gestor)
 * Útil para exibir badges de setor nas listagens de usuários.
 */
export const getUserSetoresMap = async () => {
  const { data: setores, error } = await getSetoresComMembros();
  if (error) return { data: {}, error };

  const map = {};
  const add = (userId, nome) => {
    if (!userId) return;
    if (!map[userId]) map[userId] = [];
    if (!map[userId].includes(nome)) map[userId].push(nome);
  };

  for (const setor of setores) {
    add(setor.gestor_id, setor.nome);
    for (const membro of setor.membros) {
      add(membro.user_id, setor.nome);
    }
  }

  return { data: map, error: null };
};

/**
 * Retorna os NOMES dos setores de um usuário (como membro ou como gestor).
 * Leitura liberada para qualquer usuário autenticado pelas policies de RLS.
 * @param {string} userId
 * @returns {Promise<{data: Array<string>, error: Error}>}
 */
export const getSetoresDoUsuario = async (userId) => {
  if (!userId) return { data: [], error: null };

  try {
    const [vinculosRes, setoresRes] = await Promise.all([
      supabase.from('setor_usuarios').select('setor_id').eq('user_id', userId),
      supabase.from('setores').select('id, nome, gestor_id'),
    ]);

    if (vinculosRes.error) throw vinculosRes.error;
    if (setoresRes.error) throw setoresRes.error;

    const idsComoMembro = new Set(
      (vinculosRes.data || []).map((v) => v.setor_id),
    );

    const nomes = (setoresRes.data || [])
      .filter((s) => idsComoMembro.has(s.id) || s.gestor_id === userId)
      .map((s) => s.nome);

    return { data: nomes, error: null };
  } catch (error) {
    console.error('Erro ao buscar setores do usuário:', error);
    return { data: [], error };
  }
};
