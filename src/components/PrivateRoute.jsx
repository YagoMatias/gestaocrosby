import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  console.log('PrivateRoute - user:', user, 'loading:', loading);

  // Se ainda está carregando, mostra loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário, redireciona para login
  if (!user) {
    console.log('Usuário não autenticado, redirecionando para login');
    return <Navigate to="/" replace />;
  }

  // Se há roles específicos e o usuário não tem role ou não está na lista permitida
  if (allowedRoles && (!user.role || !allowedRoles.includes(user.role))) {
    console.log('Acesso negado. Usuário:', user.email, 'Role:', user.role, 'Permitido:', allowedRoles);
    return <Navigate to="/" replace />;
  }

  console.log('Usuário autenticado, permitindo acesso:', user.email, 'Role:', user.role);
  return children;
};

export default PrivateRoute; 