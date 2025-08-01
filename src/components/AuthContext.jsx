import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from './LoadingSpinner';
import { isFirstLogin, changePassword } from '../lib/userProfiles';
import ChangePasswordModal from './ChangePasswordModal';
import Toast from './Toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Carrega usuário do localStorage ao iniciar
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
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
            
            // Verificar se é o primeiro login
            if (isFirstLogin(userProfile)) {
              setShowPasswordModal(true);
            }
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
    setShowPasswordModal(false);
    localStorage.removeItem('user');
  }

  // Função para alterar senha
  const handleChangePassword = async (formData) => {
    setPasswordModalLoading(true);
    try {
      await changePassword(user.id, formData.currentPassword, formData.newPassword);
      
      // Atualizar o usuário no estado (sem a senha)
      const { password: _, ...userWithoutPassword } = user;
      const updatedUser = { ...userWithoutPassword, password: formData.newPassword };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Fechar o modal
      setShowPasswordModal(false);
      
      // Mostrar mensagem de sucesso
      setToast({
        message: 'Senha alterada com sucesso!',
        type: 'success'
      });
    } catch (error) {
      setToast({
        message: `Erro ao alterar senha: ${error.message}`,
        type: 'error'
      });
    } finally {
      setPasswordModalLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" text="Inicializando sistema..." />;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
      
      {/* Modal de alteração de senha */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handleChangePassword}
        loading={passwordModalLoading}
      />
      
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