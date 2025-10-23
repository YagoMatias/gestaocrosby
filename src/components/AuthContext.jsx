import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseSession } from '../lib/supabase';
import { getUserPermissions } from '../services/permissionsService';

// Roles disponíveis no sistema (ordenados por hierarquia)
const ROLES = ['owner', 'admin', 'manager', 'user', 'guest', 'vendedor'];

// Configuração de roles com labels e níveis
const ROLE_CONFIG = {
  owner: {
    label: 'Proprietário',
    level: 1,
    color: '#9c27b0',
  },
  admin: {
    label: 'Administrador',
    level: 2,
    color: '#ff4747',
  },
  manager: {
    label: 'Gerente',
    level: 3,
    color: '#ff6b35',
  },
  user: {
    label: 'Financeiro',
    level: 4,
    color: '#4CAF50',
  },
  guest: {
    label: 'Convidado',
    level: 5,
    color: '#757575',
  },
  vendedor: {
    label: 'Vendedor',
    level: 60,
    color: '#10b981',
  },
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Função auxiliar para carregar permissões do banco
  const loadUserPermissions = async (userId, userRole) => {
    try {
      // Owner tem acesso a todas as páginas (não precisa carregar do banco)
      if (userRole === 'owner') {
        console.log('👑 Owner detectado - acesso total concedido');
        return '*'; // '*' significa acesso a todas as páginas
      }

      // Para outros usuários, buscar permissões do banco
      console.log('📋 Carregando permissões do banco para:', userId);

      // Adicionar timeout de 8 segundos para evitar travamentos
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => {
          console.warn(
            '⏱️ TIMEOUT: Permissões demoraram mais de 8s para carregar',
          );
          resolve({ data: [], error: new Error('Timeout') });
        }, 8000),
      );

      const permissionsPromise = getUserPermissions(userId);

      try {
        const result = await Promise.race([permissionsPromise, timeoutPromise]);

        const { data, error } = result;

        if (error) {
          console.error('❌ Erro ao carregar permissões:', error);
          console.log('⚠️ Usuário continuará sem permissões customizadas');
          return []; // Sem permissões em caso de erro
        }

        // getUserPermissions já retorna array de strings (ex: ['/home', '/crosby-bot'])
        console.log('✅ Permissões carregadas:', data);

        return data || [];
      } catch (err) {
        console.error('❌ Erro ao aguardar permissões:', err);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro crítico ao carregar permissões:', error);
      console.log('⚠️ Usuário continuará sem permissões customizadas');
      return [];
    }
  };

  // Função de login
  const login = async (email, password, rememberMe = true) => {
    try {
      console.log('🔐 Tentando login com:', email);
      setLoading(true);

      const client = rememberMe ? supabase : supabaseSession;

      const { data: authData, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error);
        throw error;
      }

      console.log('✅ Login bem-sucedido:', authData.user.email);

      // Obter role do metadata do usuário
      const userRole = authData.user.user_metadata?.role || 'guest';
      console.log('👤 Role do usuário:', userRole);

      // Verificar se o role é válido
      const validRole = ROLES.includes(userRole) ? userRole : 'guest';
      const roleConfig = ROLE_CONFIG[validRole];

      // Carregar permissões do banco
      console.log('🔄 Iniciando carregamento de permissões...');
      const allowedPages = await loadUserPermissions(
        authData.user.id,
        validRole,
      );
      console.log('✅ Permissões carregadas, configurando usuário...');

      // Configurar usuário
      const userData = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || 'Usuário',
        role: validRole,
        allowedPages, // Adicionar permissões customizadas
        profile: {
          name: validRole,
          label: roleConfig.label,
          level: roleConfig.level,
          color: roleConfig.color,
        },
      };

      console.log('✅ Dados do usuário configurados:', userData);
      console.log('🎯 Setando usuário e finalizando login...');
      setUser(userData);
      setLoading(false);

      console.log('✅ Login finalizado com sucesso!');
      return { success: true, user: userData };
    } catch (error) {
      console.error('❌ Erro no login:', error);
      setLoading(false);
      throw error;
    }
  };

  // Função de logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await supabaseSession.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  // Função para recarregar permissões (sem fazer logout)
  const refreshPermissions = async () => {
    if (!user) return;

    try {
      console.log('🔄 Recarregando permissões...');
      const allowedPages = await loadUserPermissions(user.id, user.role);

      setUser((prev) => ({
        ...prev,
        allowedPages,
      }));

      console.log('✅ Permissões atualizadas');
    } catch (error) {
      console.error('❌ Erro ao recarregar permissões:', error);
    }
  };

  // Verificar sessão inicial
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('🔄 Verificando sessão inicial...');
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('✅ Sessão encontrada:', session.user.email);
          const userRole = session.user.user_metadata?.role || 'guest';

          // Verificar se o role é válido
          const validRole = ROLES.includes(userRole) ? userRole : 'guest';
          const roleConfig = ROLE_CONFIG[validRole];

          // Carregar permissões do banco
          const allowedPages = await loadUserPermissions(
            session.user.id,
            validRole,
          );

          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 'Usuário',
            role: validRole,
            allowedPages, // Adicionar permissões customizadas
            profile: {
              name: validRole,
              label: roleConfig.label,
              level: roleConfig.level,
              color: roleConfig.color,
            },
          });
        } else {
          console.log('❌ Nenhuma sessão encontrada');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar sessão:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listener para mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Evento de autenticação:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ Usuário fez login:', session.user.email);
        const userRole = session.user.user_metadata?.role || 'guest';

        // Verificar se o role é válido
        const validRole = ROLES.includes(userRole) ? userRole : 'guest';
        const roleConfig = ROLE_CONFIG[validRole];

        // Carregar permissões do banco
        const allowedPages = await loadUserPermissions(
          session.user.id,
          validRole,
        );

        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Usuário',
          role: validRole,
          allowedPages, // Adicionar permissões customizadas
          profile: {
            name: validRole,
            label: roleConfig.label,
            level: roleConfig.level,
            color: roleConfig.color,
          },
        });
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 Usuário fez logout');
        setUser(null);
        setLoading(false);
      }
    });

    // Também ouvir mudanças do cliente baseado em sessionStorage
    const {
      data: { subscription: subscriptionSession },
    } = supabaseSession.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Evento de autenticação (session):', event);
      if (event === 'SIGNED_IN' && session?.user) {
        const userRole = session.user.user_metadata?.role || 'guest';
        const validRole = ROLES.includes(userRole) ? userRole : 'guest';
        const roleConfig = ROLE_CONFIG[validRole];

        // Carregar permissões do banco
        const allowedPages = await loadUserPermissions(
          session.user.id,
          validRole,
        );

        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Usuário',
          role: validRole,
          allowedPages, // Adicionar permissões customizadas
          profile: {
            name: validRole,
            label: roleConfig.label,
            level: roleConfig.level,
            color: roleConfig.color,
          },
        });
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      subscriptionSession.unsubscribe();
    };
  }, []);

  // Funções de verificação de permissão
  const hasRole = (requiredRole) => {
    // Se for um array, usar hasAnyRole
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user?.role);
    }
    // Se for uma string, verificar se o role é igual
    return user?.role === requiredRole;
  };

  const hasAnyRole = (requiredRoles) => {
    return requiredRoles.includes(user?.role);
  };

  const hasPermission = (requiredLevel) => {
    return user?.profile?.level >= requiredLevel;
  };

  const getRoleConfig = (role) => {
    return ROLE_CONFIG[role] || ROLE_CONFIG.guest;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshPermissions,
    hasRole,
    hasAnyRole,
    hasPermission,
    getRoleConfig,
    ROLES,
    ROLE_CONFIG,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
