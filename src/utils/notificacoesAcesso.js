/**
 * Segmentação de notificações de sistema por usuário/papel.
 *
 * As notificações ficam na tabela `notificacoes_sistema`, que suporta dois
 * modos de destinatário (não exclusivos):
 *   - destinatario_roles: text[]  → segmentação por papel (ex.: {owner,admin})
 *   - destinatario_id: uuid       → um usuário específico (ex.: o solicitante)
 *
 * Papéis do sistema (AuthContext): owner, admin, manager, user (=Financeiro),
 * guest, vendedor, franquias.
 */

/**
 * Monta o filtro `.or()` do PostgREST para trazer as notificações que
 * pertencem ao usuário: as endereçadas ao seu id OU ao seu papel.
 * Retorna `null` se não houver usuário identificável.
 */
export function filtroNotificacaoSistema(user) {
  if (!user?.id && !user?.role) return null;
  const ors = [];
  if (user?.id) ors.push(`destinatario_id.eq.${user.id}`);
  if (user?.role) ors.push(`destinatario_roles.cs.{${user.role}}`);
  return ors.join(',');
}
