import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();



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

    return <Navigate to="/" replace />;
  }

  // Se há roles específicos e o usuário não tem role ou não está na lista permitida
  if (allowedRoles && (!user.role || !allowedRoles.includes(user.role))) {

    return <Navigate to="/" replace />;
  }


  return children;
};

export default PrivateRoute; 