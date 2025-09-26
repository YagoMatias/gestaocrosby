import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseSession } from '../lib/supabase';

// Roles disponíveis no sistema (ordenados por hierarquia)
const ROLES = ['owner', 'admin', 'manager', 'user', 'guest'];

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

      // Configurar usuário
      const userData = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || 'Usuário',
        role: validRole,
        profile: {
          name: validRole,
          label: roleConfig.label,
          level: roleConfig.level,
          color: roleConfig.color,
        },
      };

      console.log('✅ Dados do usuário configurados:', userData);
      setUser(userData);
      setLoading(false);

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

          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 'Usuário',
            role: validRole,
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

        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Usuário',
          role: validRole,
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
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Usuário',
          role: validRole,
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
    hasRole,
    hasAnyRole,
    hasPermission,
    getRoleConfig,
    ROLES,
    ROLE_CONFIG,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
