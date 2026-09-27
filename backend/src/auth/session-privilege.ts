/**
 * Niveau de privilège porté par une session.
 *
 * Deux échelles partagent les mêmes chiffres sans partager leur sens :
 * - `___config_admin.cnfa_level` : droits du personnel (3 commercial, 5 manager,
 *   7 administrateur, 9 super-administrateur) ;
 * - `___xtr_customer.cst_level` : palier d'un compte client, affiché et édité
 *   comme tel dans l'administration des clients.
 *
 * Gardes (`IsAdminGuard`, `AdminSessionGuard`, `PermissionsGuard`) et interface
 * lisent `level` et `isAdmin` d'une session comme des droits. Seule une session
 * du personnel porte donc un niveau de l'échelle des droits ; une session
 * client porte le niveau de base, quel que soit son palier.
 */

/** Échelle des droits du personnel — seuils de `PermissionsService`. */
export const STAFF_LEVEL = {
  COMMERCIAL: 3,
  MANAGER: 5,
  ADMIN: 7,
  SUPER_ADMIN: 9,
} as const;

/** Niveau de droits de toute session client (aucun droit d'équipe). */
export const CUSTOMER_SESSION_LEVEL = 1;

export type AuthSource = 'admin' | 'customer';

/** Niveau de droits d'une session, selon la table qui l'a authentifiée. */
export function sessionPrivilegeLevel(
  authSource: AuthSource,
  storedLevel: number,
): number {
  return authSource === 'admin' ? storedLevel : CUSTOMER_SESSION_LEVEL;
}

/** Une session est administratrice seulement si elle vient du personnel. */
export function isAdminSession(
  authSource: AuthSource,
  storedLevel: number,
): boolean {
  return authSource === 'admin' && storedLevel >= STAFF_LEVEL.ADMIN;
}
