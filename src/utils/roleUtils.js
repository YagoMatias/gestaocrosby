/**
 * Utilitários para gerenciamento de roles de usuários
 */

/**
 * Normaliza o role do usuário para o formato do banco de dados
 * Aceita 'proprietário' (com acento), 'proprietario' e 'owner' e converte para 'ownier'
 *
 * @param {string} role - Role do usuário (admin, ownier, owner, proprietário, proprietario, usuario, etc)
 * @returns {string} Role normalizado
 */
export function normalizeRole(role) {
  if (!role) return 'usuario';

  const normalized = role.toLowerCase().trim();

  // Normalizar variações de proprietário/owner para 'ownier'
  if (
    normalized === 'proprietário' ||
    normalized === 'proprietario' ||
    normalized === 'owner'
  ) {
    return 'ownier';
  }

  return normalized;
}

/**
 * Verifica se o usuário tem permissão de admin ou proprietário
 *
 * @param {string} role - Role do usuário
 * @returns {boolean} true se for admin ou ownier
 */
export function isAdminOrOwner(role) {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'ownier';
}

/**
 * Verifica se o role é válido para criar dashboards
 *
 * @param {string} role - Role do usuário
 * @returns {boolean} true se o role é válido (admin ou ownier)
 */
export function canCreateDashboard(role) {
  return isAdminOrOwner(role);
}

/**
 * Lista de roles válidos do sistema
 */
export const VALID_ROLES = {
  ADMIN: 'admin',
  PROPRIETARIO: 'ownier',
  USUARIO: 'usuario',
};

/**
 * Valida se o role é um dos valores válidos
 *
 * @param {string} role - Role a validar
 * @returns {boolean} true se for válido
 */
export function isValidRole(role) {
  const normalized = normalizeRole(role);
  return Object.values(VALID_ROLES).includes(normalized);
}
