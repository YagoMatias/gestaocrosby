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

// Funções para gerenciar usuários na tabela user_profiles

// Buscar todos os usuários
export const fetchUsers = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, email, role, active, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Buscar usuário por email
export const fetchUserByEmail = async (email) => {
  try {
    // Tenta com o cliente normal primeiro (mais seguro)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, email, password, role, active')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Erro com supabase normal:', error);
      // Se falhar, tenta com o cliente admin
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('user_profiles')
        .select('id, name, email, password, role, active')
        .eq('email', email)
        .single();
      
      if (error2) throw error2;
      return data2;
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

// Criar novo usuário
export const createUser = async (userData) => {
  try {
    // Remove o campo id se estiver presente (para evitar erro de NOT NULL)
    const { id, ...userDataWithoutId } = userData;
    
    // Validar role antes de inserir
    validateRole(userDataWithoutId.role);
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert([userDataWithoutId])
      .select('id, name, email, role, active')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Atualizar usuário
export const updateUser = async (id, userData) => {
  try {
    // Remove o campo id dos dados de atualização (não deve ser atualizado)
    const { id: _, ...userDataWithoutId } = userData;
    
    // Validar role se estiver sendo atualizado
    if (userDataWithoutId.role) {
      validateRole(userDataWithoutId.role);
    }
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(userDataWithoutId)
      .eq('id', id)
      .select('id, name, email, role, active')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Deletar usuário
export const deleteUser = async (id) => {
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

// Autenticar usuário
export const authenticateUser = async (email, password) => {
  try {
    // Buscar usuário por email
    const user = await fetchUserByEmail(email);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se o usuário está ativo
    if (!user.active) {
      throw new Error('Usuário inativo');
    }

    // Verificar senha (em produção, use bcrypt ou similar)
    if (user.password !== password) {
      throw new Error('Senha incorreta');
    }

    // Retornar dados do usuário (incluindo a senha para verificar se é primeiro login)
    return user;
  } catch (error) {
    throw error;
  }
};

// Verificar se email já existe
export const checkEmailExists = async (email, excludeId = null) => {
  try {
    let query = supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', email);

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

// Alterar senha do usuário
export const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    // Primeiro, verificar se a senha atual está correta
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('password')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    if (user.password !== currentPassword) {
      throw new Error('Senha atual incorreta');
    }

    // Atualizar a senha
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ password: newPassword })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Verificar se é o primeiro login (senha padrão)
export const isFirstLogin = (user) => {
  // Lista de senhas padrão comuns
  const defaultPasswords = [
    '123456',
    'password',
    'admin',
    'user',
    'senha',
    '123123',
    'qwerty',
    'abc123',
    '123456789',
    'password123'
  ];
  
  return defaultPasswords.includes(user?.password);
}; 

// Função para testar criação de usuário
export const testCreateUser = async () => {
  try {
    const testUserData = {
      id: null, // Simula o problema que estava ocorrendo
      name: 'Teste Usuário',
      email: 'teste@exemplo.com',
      password: '123456', // Senha padrão que será detectada como primeiro login
      role: 'FRANQUIA', // Testando com o valor correto
      active: true
    };
    
    const result = await createUser(testUserData);
    console.log('Teste de criação de usuário bem-sucedido:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Erro no teste de criação de usuário:', error);
    return { success: false, error: error.message };
  }
}; 

// Função para verificar valores permitidos para role
export const getValidRoles = () => {
  return ['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA'];
};

// Função para validar role antes de inserir
export const validateRole = (role) => {
  const validRoles = getValidRoles();
  if (!validRoles.includes(role)) {
    throw new Error(`Role inválido: ${role}. Valores permitidos: ${validRoles.join(', ')}`);
  }
  return true;
}; 