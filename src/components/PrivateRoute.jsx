import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  console.log('🛡️ PrivateRoute - Status:', { 
    loading, 
    hasUser: !!user, 
    userRole: user?.role, 
    allowedRoles 
  });

  // Se ainda está carregando, mostra loading
  if (loading) {
    console.log('⏳ PrivateRoute - Mostrando loading...');
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
    console.log('🚫 PrivateRoute - Usuário não autenticado, redirecionando para login');
    return <Navigate to="/" replace />;
  }

  // Se há roles específicos e o usuário não tem role ou não está na lista permitida
  if (allowedRoles && (!user.role || !allowedRoles.includes(user.role))) {
    console.log('🚫 PrivateRoute - Usuário sem permissão, redirecionando para login');
    console.log('👤 Role do usuário:', user.role);
    console.log('✅ Roles permitidos:', allowedRoles);
    return <Navigate to="/" replace />;
  }

  console.log('✅ PrivateRoute - Acesso permitido, renderizando componente');
  return children;
};

export default PrivateRoute; 