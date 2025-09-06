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
    
    // TODO: Implémenter la vraie logique d'authentification admin
    // Pour l'instant, on simule qu'on a un utilisateur admin connecté
    const user = this.extractUserFromRequest(request);
    
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

  private extractUserFromRequest(_request: any): any {
    // TODO: Extraire l'utilisateur depuis le token JWT, session, etc.
    // Pour l'instant, on simule un utilisateur admin
    return {
      id: 'admin-1',
      email: 'admin@example.com',
      roles: ['admin', 'manager'],
      isAdmin: true,
    };
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
