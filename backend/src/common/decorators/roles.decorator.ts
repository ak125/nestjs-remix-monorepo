import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour définir les rôles requis sur une route
 * 
 * @param roles - Liste des rôles autorisés
 * 
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @Get('/admin')
 * async adminRoute() {
 *   return 'Admin access';
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
