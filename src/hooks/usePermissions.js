import { useAuth } from '../components/AuthContext';

const usePermissions = () => {
  const { user } = useAuth();

  // Verificações de roles específicos
  const isOwner = () => user?.role === 'owner';
  const isAdmin = () => user?.role === 'admin';
  const isManager = () => user?.role === 'manager';
  const isUser = () => user?.role === 'user';
  const isGuest = () => user?.role === 'guest';
  const isVendedor = () => user?.role === 'vendedor';

  // Verificações de permissões baseadas em níveis
  const canAccessAdmin = () => isOwner() || isAdmin();
  const canAccessManager = () => isOwner() || isAdmin() || isManager();
  const canAccessFinancial = () =>
    isOwner() || isAdmin() || isManager() || isUser(); // User tem acesso ao financeiro
  const canAccessCMV = () => isOwner() || isAdmin() || isManager(); // Manager tem acesso ao CMV
  const canAccessFranchise = () =>
    isOwner() || isAdmin() || isManager() || isUser() || isGuest(); // Guest tem acesso às franquias
  const canAccessComprasFranquias = () =>
    isOwner() || isAdmin() || isManager() || isUser() || isGuest(); // Guest tem acesso às compras franquias
  const canAccessDashboard = () => true; // Todos os roles podem acessar o dashboard

  // Permissão específica para Crosby Bot (Vendedor tem acesso apenas a isso)
  const canAccessCrosbyBot = () =>
    isOwner() ||
    isAdmin() ||
    isManager() ||
    isUser() ||
    isGuest() ||
    isVendedor();

  // Funções auxiliares
  const hasRole = (role) => user?.role === role;
  const hasAnyRole = (roles) => roles.includes(user?.role);
  const hasPermissionLevel = (minLevel) => {
    const levelMap = {
      owner: 1,
      admin: 2,
      manager: 3,
      user: 4,
      guest: 5,
      vendedor: 6, // Vendedor tem nível mais baixo, acesso apenas ao Crosby Bot
    };
    return (levelMap[user?.role] || 7) <= minLevel;
  };

  return {
    user,
    isOwner,
    isAdmin,
    isManager,
    isUser,
    isGuest,
    isVendedor,
    canAccessAdmin,
    canAccessManager,
    canAccessFinancial,
    canAccessCMV,
    canAccessFranchise,
    canAccessComprasFranquias,
    canAccessDashboard,
    canAccessCrosbyBot,
    hasRole,
    hasAnyRole,
    hasPermissionLevel,
  };
};

export default usePermissions;
export { usePermissions };
