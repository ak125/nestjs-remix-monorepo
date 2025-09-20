import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionService } from '../services/session.service';

export const REQUIRE_AUTH = 'require_auth';
export const REQUIRE_ROLES = 'require_roles';
export const REQUIRE_PERMISSIONS = 'require_permissions';

// Décorateurs pour définir les exigences d'accès
export const RequireAuth = () =>
  Reflector.createDecorator<boolean>({ key: REQUIRE_AUTH });

export const RequireRoles = (..._roles: string[]) =>
  Reflector.createDecorator<string[]>({ key: REQUIRE_ROLES });

export const RequirePermissions = (..._permissions: string[]) =>
  Reflector.createDecorator<string[]>({ key: REQUIRE_PERMISSIONS });

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Vérifier si l'authentification est requise
    const requireAuth =
      this.reflector.get(REQUIRE_AUTH, context.getHandler()) ||
      this.reflector.get(REQUIRE_AUTH, context.getClass());

    if (!requireAuth) {
      return true; // Pas d'authentification requise
    }

    // Extraire le session ID depuis les cookies ou headers
    const sessionId = this.extractSessionId(request);
    if (!sessionId) {
      throw new UnauthorizedException('Session manquante');
    }

    // Vérifier la validité de la session
    const sessionData = await this.sessionService.getSession(sessionId);
    if (!sessionData) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    // Mettre à jour l'activité de la session
    await this.sessionService.updateSessionActivity(sessionId);

    // Attacher les données utilisateur à la request
    request.user = sessionData;
    request.sessionId = sessionId;

    // Vérifier les rôles requis
    const requiredRoles =
      this.reflector.get(REQUIRE_ROLES, context.getHandler()) ||
      this.reflector.get(REQUIRE_ROLES, context.getClass());

    if (requiredRoles && requiredRoles.length > 0) {
      if (!this.hasRequiredRole(sessionData.role, requiredRoles)) {
        throw new ForbiddenException(
          `Rôle requis: ${requiredRoles.join(' ou ')}`,
        );
      }
    }

    // Vérifier les permissions requises
    const requiredPermissions =
      this.reflector.get(REQUIRE_PERMISSIONS, context.getHandler()) ||
      this.reflector.get(REQUIRE_PERMISSIONS, context.getClass());

    if (requiredPermissions && requiredPermissions.length > 0) {
      if (
        !this.hasRequiredPermissions(
          sessionData.permissions,
          requiredPermissions,
        )
      ) {
        throw new ForbiddenException(
          `Permissions requises: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }

  /**
   * Extraire le session ID de la request
   */
  private extractSessionId(request: any): string | null {
    // Essayer depuis les cookies
    if (request.cookies && request.cookies.sessionId) {
      return request.cookies.sessionId;
    }

    // Essayer depuis les headers
    if (request.headers.authorization) {
      const token = request.headers.authorization.replace('Bearer ', '');
      return token;
    }

    // Essayer depuis les headers personnalisés
    if (request.headers['x-session-id']) {
      return request.headers['x-session-id'];
    }

    return null;
  }

  /**
   * Vérifier si l'utilisateur a le rôle requis
   */
  private hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole);
  }

  /**
   * Vérifier si l'utilisateur a toutes les permissions requises
   */
  private hasRequiredPermissions(
    userPermissions: string[],
    requiredPermissions: string[],
  ): boolean {
    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}
