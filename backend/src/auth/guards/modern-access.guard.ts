import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';

export const REQUIRE_MODULE_ACCESS = 'require_module_access';

// Décorateur pour définir l'accès module requis
export const RequireModuleAccess = (module: string, action: string = 'read') =>
  Reflector.createDecorator<{ module: string; action: string }>({
    key: REQUIRE_MODULE_ACCESS,
  });

// Fonction helper pour obtenir la valeur du décorateur
export const getModuleAccessData = (module: string, action: string = 'read') => ({
  module,
  action,
});

@Injectable()
export class ModernAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Récupérer les exigences d'accès depuis le décorateur
    const moduleAccess =
      this.reflector.get(REQUIRE_MODULE_ACCESS, context.getHandler()) ||
      this.reflector.get(REQUIRE_MODULE_ACCESS, context.getClass());

    if (!moduleAccess) {
      return true; // Pas de restriction spécifiée
    }

    // Récupérer les informations de session
    const sessionInfo = await this.authService.getSessionFromRequest(request);
    if (!sessionInfo) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    // Vérifier l'accès au module
    const accessResult = await this.authService.checkModuleAccess(
      sessionInfo.user.id,
      moduleAccess.module,
      moduleAccess.action,
    );

    if (!accessResult.hasAccess) {
      // Utiliser la méthode du service pour gérer l'erreur
      this.authService.handleNoPrivilege(
        moduleAccess.module,
        accessResult.requiredRole,
      );
    }

    // Attacher les infos utilisateur à la request pour les contrôleurs
    request.user = sessionInfo.user;
    request.sessionId = sessionInfo.sessionId;
    request.moduleAccess = accessResult;

    return true;
  }
}
