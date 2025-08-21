import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import { USER_ROLES, ERROR_MESSAGES } from '../config/constants';

// Cria contexto com tipo de dados esperado
const AuthContext = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
  login: () => {},
  isAuthenticated: false,
  hasRole: () => false,
  loading: false,
  error: null
});

// Validação dos dados do usuário
const validateUserData = (userData) => {
  if (!userData || typeof userData !== 'object') return false;
  
  const requiredFields = ['id', 'email', 'role'];
  return requiredFields.every(field => userData[field]);
};

export function AuthProvider({ children }) {
  // Usa hook personalizado para localStorage com validação
  const [user, setUser, removeUser] = useLocalStorage('user', null, {
    validateValue: validateUserData
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Função de login otimizada
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      // Autentica no Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // Busca dados do usuário
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profile_antiga')
        .select('id, name, email, role, active')
        .eq('email', email)
        .single();

      if (profileError) {
        throw new Error('Perfil de usuário não encontrado');
      }

      if (!userProfile.active) {
        throw new Error('Usuário inativo');
      }

      // Valida e salva dados do usuário
      const userData = {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        active: userProfile.active,
        lastLogin: new Date().toISOString()
      };

      if (validateUserData(userData)) {
        setUser(userData);
        return userData;
      } else {
        throw new Error('Dados de usuário inválidos');
      }

    } catch (err) {
      const errorMessage = err.message || ERROR_MESSAGES.SERVER_ERROR;
      setError(errorMessage);
      setToast({
        type: 'error',
        message: errorMessage
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  // Função de logout otimizada
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao fazer logout do Supabase:', err);
    } finally {
      setUser(null);
      removeUser();
      setLoading(false);
      
      setToast({
        type: 'success',
        message: 'Logout realizado com sucesso'
      });
    }
  }, [setUser, removeUser]);

  // Verificação de sessão inicial
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session?.user) {
          // Se há sessão do Supabase, buscar dados do usuário
          const { data: userProfile, error: profileError } = await supabase
            .from('user_profile_antiga')
            .select('id, name, email, role, active')
            .eq('email', session.user.email)
            .single();
          
          if (profileError) {
            console.warn('Erro ao buscar perfil do usuário:', profileError);
            await supabase.auth.signOut();
            removeUser();
          } else if (userProfile && userProfile.active) {
            const userData = {
              id: userProfile.id,
              name: userProfile.name,
              email: userProfile.email,
              role: userProfile.role,
              active: userProfile.active,
              lastLogin: new Date().toISOString()
            };
            
            if (validateUserData(userData)) {
              setUser(userData);
            }
          } else {
            await supabase.auth.signOut();
            removeUser();
          }
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
        setError('Erro ao verificar autenticação');
        removeUser();
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [setUser, removeUser]);

  // Verifica se usuário tem role específica
  const hasRole = useCallback((requiredRoles) => {
    if (!user || !user.role) return false;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(user.role);
  }, [user]);

  // Estado de autenticação computado
  const isAuthenticated = useMemo(() => {
    return !!(user && user.active);
  }, [user]);

  // Valor do contexto memoizado
  const contextValue = useMemo(() => ({
    user,
    setUser,
    logout,
    login,
    isAuthenticated,
    hasRole,
    loading,
    error
  }), [user, setUser, logout, login, isAuthenticated, hasRole, loading, error]);

  // Renderiza loading durante inicialização
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Inicializando sistema..." />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      
      {/* Toast de notificação */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

// Hook customizado com validação
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
}

// Hook para verificar autenticação
export function useRequireAuth(redirectTo = '/') {
  const { isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, loading, redirectTo]);
  
  return { isAuthenticated, loading };
}

// Hook para verificar role
export function useRequireRole(requiredRoles, redirectTo = '/') {
  const { hasRole, isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && isAuthenticated && !hasRole(requiredRoles)) {
      window.location.href = redirectTo;
    }
  }, [hasRole, requiredRoles, isAuthenticated, loading, redirectTo]);
  
  return { hasRole: hasRole(requiredRoles), loading };
} 