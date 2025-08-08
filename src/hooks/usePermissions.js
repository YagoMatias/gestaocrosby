import { useAuth } from '../components/AuthContext';

export const usePermissions = () => {
  const { user } = useAuth();

  const isAdmin = () => user?.role === 'ADM';
  const isDirector = () => user?.role === 'DIRETOR';
  const isFinancial = () => user?.role === 'FINANCEIRO';
  const isFranchise = () => user?.role === 'FRANQUIA';

  const canAccessAdmin = () => isAdmin();
  const canAccessFinancial = () => isAdmin() || isFinancial();
  const canAccessDirector = () => isAdmin() || isDirector();
  const canAccessFranchise = () => isAdmin() || isFranchise();
  const canAccessComprasFranquias = () => isAdmin() || isDirector() || isFranchise();

  const hasRole = (role) => user?.role === role;
  const hasAnyRole = (roles) => roles.includes(user?.role);

  return {
    user,
    isAdmin,
    isDirector,
    isFinancial,
    isFranchise,
    canAccessAdmin,
    canAccessFinancial,
    canAccessDirector,
    canAccessFranchise,
    canAccessComprasFranquias,
    hasRole,
    hasAnyRole
  };
}; 