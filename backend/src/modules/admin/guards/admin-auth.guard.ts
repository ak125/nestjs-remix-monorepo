import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // DEPRECATED: Ce guard est déprécié, utiliser AuthenticatedGuard + IsAdminGuard
    // extractUserFromRequest() lance une exception pour bloquer toute utilisation
    const user = this.extractUserFromRequest();

    if (!user) {
      throw new UnauthorizedException('Authentification requise');
    }

    if (!this.isAdmin(user)) {
      throw new UnauthorizedException('Accès administrateur requis');
    }

    // Récupérer les rôles requis depuis les métadonnées
    const requiredRoles = this.reflector.get<string[]>(
      'admin-roles',
      context.getHandler(),
    );

    if (requiredRoles && !this.hasRequiredRole(user, requiredRoles)) {
      throw new UnauthorizedException('Permissions insuffisantes');
    }

    // Attacher l'utilisateur à la requête pour usage ultérieur
    request.user = user;

    return true;
  }

  private extractUserFromRequest(): any {
    // SECURITY: Ce guard est déprécié - utiliser IsAdminGuard + AuthenticatedGuard
    // Ne jamais retourner de credentials hardcodés
    throw new UnauthorizedException(
      'AdminAuthGuard is deprecated. Use AuthenticatedGuard + IsAdminGuard instead.',
    );
  }

  private isAdmin(user: any): boolean {
    return user.isAdmin === true || user.roles?.includes('admin');
  }

  private hasRequiredRole(user: any, requiredRoles: string[]): boolean {
    if (!user.roles || !Array.isArray(user.roles)) {
      return false;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
