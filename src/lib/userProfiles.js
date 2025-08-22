import { supabase, supabaseAdmin } from './supabase';

// Função para testar conectividade com o Supabase
export const testSupabaseConnection = async () => {
  try {
    // Teste simples para verificar se conseguimos conectar
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Erro na conexão com Supabase:', error);
      
      // Tenta com o cliente admin
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      if (error2) {
        return { 
          success: false, 
          error: `Normal: ${error.message}, Admin: ${error2.message}`,
          suggestion: 'Verifique se a tabela user_profiles existe no projeto Supabase'
        };
      }
      
      return { success: true, data: data2, warning: 'Usando cliente admin' };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return { success: false, error: error.message };
  }
};

// Funções para gerenciar perfis de usuário na tabela user_profiles

// Buscar todos os perfis
export const fetchUserProfiles = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('level', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Buscar perfil por nome
export const fetchUserProfileByName = async (name) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      console.error('Erro com supabase normal:', error);
      // Se falhar, tenta com o cliente admin
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('name', name)
        .single();
      
      if (error2) throw error2;
      return data2;
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

// Criar novo perfil
export const createUserProfile = async (profileData) => {
  try {
    // Remove o campo id se estiver presente (para evitar erro de NOT NULL)
    const { id, ...profileDataWithoutId } = profileData;
    
    // Validar level antes de inserir
    validateLevel(profileDataWithoutId.level);
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert([profileDataWithoutId])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Atualizar perfil
export const updateUserProfile = async (id, profileData) => {
  try {
    // Remove o campo id dos dados de atualização (não deve ser atualizado)
    const { id: _, ...profileDataWithoutId } = profileData;
    
    // Validar level se estiver sendo atualizado
    if (profileDataWithoutId.level) {
      validateLevel(profileDataWithoutId.level);
    }
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(profileDataWithoutId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Deletar perfil
export const deleteUserProfile = async (id) => {
  try {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

// Verificar se nome já existe
export const checkProfileNameExists = async (name, excludeId = null) => {
  try {
    let query = supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('name', name);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data.length > 0;
  } catch (error) {
    throw error;
  }
};

// Função para obter perfil do usuário autenticado
export const getUserProfile = async (userRole) => {
  try {
    console.log('🔍 getUserProfile: Buscando perfil para role:', userRole);
    
    if (!userRole) {
      console.warn('⚠️ getUserProfile: userRole é undefined ou null');
      throw new Error('userRole é obrigatório');
    }
    
    console.log('🔍 getUserProfile: Fazendo query na tabela user_profiles...');
    
    // Adicionar timeout para evitar travamento
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: Query demorou mais de 5 segundos')), 5000);
    });
    
    const queryPromise = supabase
      .from('user_profiles')
      .select('*')
      .eq('name', userRole)
      .single();
    
    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      console.error('❌ getUserProfile: Erro ao buscar perfil:', error);
      
      // Se for erro de "no rows returned", tenta com supabaseAdmin
      if (error.code === 'PGRST116') {
        console.log('🔄 getUserProfile: Tentando com supabaseAdmin...');
        const { data: data2, error: error2 } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('name', userRole)
          .single();
          
        if (error2) {
          console.error('❌ getUserProfile: Erro também com supabaseAdmin:', error2);
          throw error2;
        }
        
        console.log('✅ getUserProfile: Perfil encontrado com supabaseAdmin:', data2);
        return data2;
      }
      
      throw error;
    }

    console.log('✅ getUserProfile: Perfil encontrado:', data);
    return data;
  } catch (error) {
    console.error('❌ getUserProfile: Erro geral:', error);
    throw error;
  }
};

// Função para verificar se usuário tem permissão baseada no level
export const hasPermission = (userLevel, requiredLevel) => {
  return userLevel >= requiredLevel;
};

// Função para testar criação de perfil
export const testCreateUserProfile = async () => {
  try {
    const testProfileData = {
      name: 'TESTE_PERFIL',
      label: 'Perfil de Teste',
      color: '#FF0000',
      description: 'Perfil criado para teste',
      level: 50
    };
    
    const result = await createUserProfile(testProfileData);
    console.log('Teste de criação de perfil bem-sucedido:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Erro no teste de criação de perfil:', error);
    return { success: false, error: error.message };
  }
}; 

// Função para verificar valores permitidos para level
export const getValidLevels = () => {
  return { min: 1, max: 99 };
};

// Função para validar level antes de inserir
export const validateLevel = (level) => {
  const validLevels = getValidLevels();
  if (level < validLevels.min || level > validLevels.max) {
    throw new Error(`Level inválido: ${level}. Deve estar entre ${validLevels.min} e ${validLevels.max}`);
  }
  return true;
};

// Função para obter todos os perfis ordenados por level
export const getAllProfilesOrdered = async () => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('level', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// ===== FUNÇÕES PARA GERENCIAMENTO DE USUÁRIOS (auth.users) =====

// Função para buscar todos os usuários do auth.users
export const fetchUsers = async () => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) throw error;
    
    // Mapear os dados para o formato esperado pelo PainelAdmin
    return data.users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || 'Sem nome',
      role: user.user_metadata?.role || 'guest',
      active: user.email_confirmed_at ? true : false,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at
    }));
  } catch (error) {
    throw error;
  }
};

// Função para criar um novo usuário no auth.users
export const createUser = async (userData) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        role: userData.role
      }
    });

    if (error) throw error;
    
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      role: data.user.user_metadata?.role,
      active: true,
      created_at: data.user.created_at
    };
  } catch (error) {
    throw error;
  }
};

// Função para atualizar um usuário no auth.users
export const updateUser = async (userId, userData) => {
  try {
    // Primeiro, buscar o usuário atual para obter os dados existentes
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) throw listError;
    
    const currentUser = users.users.find(user => user.id === userId);
    if (!currentUser) {
      throw new Error('Usuário não encontrado');
    }

    // Preparar dados de atualização
    const updateData = {
      user_metadata: {
        name: userData.name,
        role: userData.role
      }
    };

    // Se uma nova senha foi fornecida, incluí-la na atualização
    if (userData.password) {
      updateData.password = userData.password;
    }

    // Atualizar o usuário usando a API correta
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

    if (error) throw error;
    
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      role: data.user.user_metadata?.role,
      active: data.user.email_confirmed_at ? true : false,
      created_at: data.user.created_at
    };
  } catch (error) {
    throw error;
  }
};

// Função para deletar um usuário do auth.users
export const deleteUser = async (userId) => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    throw error;
  }
};

// Função para verificar se um email já existe no auth.users
export const checkEmailExists = async (email, excludeUserId = null) => {
  try {
    // Listar todos os usuários e verificar se o email existe
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      throw error;
    }
    
    // Procurar por um usuário com o email especificado
    const userWithEmail = data.users.find(user => user.email === email);
    
    if (!userWithEmail) {
      return false; // Email não existe
    }
    
    // Se encontrou um usuário, verificar se não é o mesmo que está sendo editado
    if (excludeUserId && userWithEmail.id === excludeUserId) {
      return false; // É o mesmo usuário sendo editado, então não é duplicado
    }
    
    return true; // Email já existe
  } catch (error) {
    throw error;
  }
}; 

// Função para verificar se a tabela user_profiles existe e criar perfis padrão
export const ensureDefaultProfiles = async () => {
  try {
    console.log('🔍 Verificando se a tabela user_profiles existe...');
    
    // Tentar buscar um perfil para ver se a tabela existe
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Tabela user_profiles não existe ou erro de acesso:', error);
      return false;
    }

    console.log('✅ Tabela user_profiles existe');
    
    // Verificar se existem perfis
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('name')
      .limit(10);

    if (profilesError) {
      console.error('❌ Erro ao verificar perfis:', profilesError);
      return false;
    }

    console.log('📊 Perfis encontrados:', profiles?.length || 0);
    
    // Se não há perfis, criar os padrão
    if (!profiles || profiles.length === 0) {
      console.log('🔄 Nenhum perfil encontrado, criando perfis padrão...');
      
      const defaultProfiles = [
        {
          name: 'FRANQUIA',
          label: 'Franquia',
          color: '#3B82F6',
          description: 'Usuário de franquia com acesso limitado',
          level: 1
        },
        {
          name: 'FINANCEIRO',
          label: 'Financeiro',
          color: '#10B981',
          description: 'Usuário financeiro com acesso a relatórios',
          level: 2
        },
        {
          name: 'DIRETOR',
          label: 'Diretor',
          color: '#F59E0B',
          description: 'Diretor com acesso amplo ao sistema',
          level: 3
        },
        {
          name: 'ADM',
          label: 'Administrador',
          color: '#EF4444',
          description: 'Administrador com acesso total ao sistema',
          level: 4
        }
      ];

      for (const profile of defaultProfiles) {
        try {
          await createUserProfile(profile);
          console.log(`✅ Perfil ${profile.name} criado`);
        } catch (error) {
          console.error(`❌ Erro ao criar perfil ${profile.name}:`, error);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar/criar perfis padrão:', error);
    return false;
  }
}; 