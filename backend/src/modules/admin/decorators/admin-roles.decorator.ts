import { SetMetadata } from '@nestjs/common';

/**
 * Décorateur pour définir les rôles admin requis pour accéder à un endpoint
 *
 * @param roles - Liste des rôles autorisés (admin, manager, stock_manager, viewer, etc.)
 *
 * @example
 * @AdminRoles('admin', 'manager')
 * async deleteProduct() { ... }
 *
 * @example
 * @AdminRoles('admin', 'manager', 'stock_manager')
 * async updateStock() { ... }
 */
export const AdminRoles = (...roles: string[]) =>
  SetMetadata('admin-roles', roles);
