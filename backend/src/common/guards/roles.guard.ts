import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard pour vérifier les rôles utilisateur
 * 
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @UseGuards(RolesGuard)
 * @Get('/admin')
 * async adminRoute() {
 *   return 'Admin access';
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les rôles requis depuis le metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle n'est requis, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Récupérer l'utilisateur depuis la requête
    const { user } = context.switchToHttp().getRequest();

    // Si pas d'utilisateur, refuser l'accès
    if (!user) {
      return false;
    }

    // Vérifier si l'utilisateur a au moins un des rôles requis
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
