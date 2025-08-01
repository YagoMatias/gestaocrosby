// Constantes do sistema

export const USER_ROLES = {
  ADM: 'ADM',
  DIRETOR: 'DIRETOR',
  FINANCEIRO: 'FINANCEIRO',
  FRANQUIA: 'FRANQUIA'
};

export const USER_ROLE_LABELS = {
  [USER_ROLES.ADM]: 'Administrador',
  [USER_ROLES.DIRETOR]: 'Diretor',
  [USER_ROLES.FINANCEIRO]: 'Financeiro',
  [USER_ROLES.FRANQUIA]: 'Franquia'
};

export const USER_ROLE_COLORS = {
  [USER_ROLES.ADM]: 'bg-red-100 text-red-800',
  [USER_ROLES.DIRETOR]: 'bg-blue-100 text-blue-800',
  [USER_ROLES.FINANCEIRO]: 'bg-green-100 text-green-800',
  [USER_ROLES.FRANQUIA]: 'bg-purple-100 text-purple-800'
};

export const PERMISSIONS = {
  [USER_ROLES.ADM]: ['*'], // Acesso total
  [USER_ROLES.DIRETOR]: ['reports', 'analytics', 'management'],
  [USER_ROLES.FINANCEIRO]: ['financial', 'reports'],
  [USER_ROLES.FRANQUIA]: ['franchise_data', 'basic_reports']
};

export const APP_CONFIG = {
  name: 'Gestão Crosby',
  version: '1.0.0',
  defaultPageSize: 10,
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  maxLoginAttempts: 3
};

export const API_ENDPOINTS = {
  users: '/users',
  auth: '/auth',
  reports: '/reports'
}; 