import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  console.log('🛡️ PrivateRoute - Status:', {
    loading,
    hasUser: !!user,
    userRole: user?.role,
    currentPath,
    allowedPages: user?.allowedPages,
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
    console.log(
      '🚫 PrivateRoute - Usuário não autenticado, redirecionando para login',
    );
    return <Navigate to="/" replace />;
  }

  // Verificar permissões customizadas
  const hasPermission = () => {
    // Owner tem acesso total
    if (user.allowedPages === '*') {
      console.log('👑 Owner - Acesso total permitido');
      return true;
    }

    // Verificar se a página atual está nas permissões do usuário
    if (!user.allowedPages || !Array.isArray(user.allowedPages)) {
      console.log('⚠️ Usuário sem permissões definidas');
      return false;
    }

    const hasAccess = user.allowedPages.includes(currentPath);
    console.log(`🔍 Verificando acesso à ${currentPath}:`, hasAccess);

    return hasAccess;
  };

  // Se não tem permissão, redireciona para /home ou /
  if (!hasPermission()) {
    console.log('🚫 PrivateRoute - Usuário sem permissão para esta página');

    // Redirecionar para /home se tiver permissão, senão para login
    if (
      user.allowedPages &&
      Array.isArray(user.allowedPages) &&
      user.allowedPages.includes('/home')
    ) {
      return <Navigate to="/home" replace />;
    }

    return <Navigate to="/" replace />;
  }

  console.log('✅ PrivateRoute - Acesso permitido, renderizando componente');
  return children;
};

export default PrivateRoute;
