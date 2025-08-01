import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Carrega usuário do localStorage ao iniciar
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Verificar sessão do Supabase ao carregar
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Se há sessão do Supabase, buscar dados do usuário na tabela user_profiles
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('id, name, email, role, active, password')
            .eq('email', session.user.email)
            .single();
          
          if (userProfile) {
            setUser(userProfile);
          }
        }
      } catch (error) {
        // Erro silencioso ao verificar sessão
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Sempre que user mudar, salva no localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Erro silencioso ao fazer logout
    }
    setUser(null);
    localStorage.removeItem('user');
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Inicializando sistema..." />;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
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

export function useAuth() {
  return useContext(AuthContext);
} 