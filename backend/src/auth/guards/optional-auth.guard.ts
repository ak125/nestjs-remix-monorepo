/**
 * 🔒 OPTIONAL AUTH GUARD - Authentification optionnelle
 *
 * Guard permettant l'accès avec ou sans authentification :
 * ✅ N'interrompt pas la requête si l'utilisateur n'est pas connecté
 * ✅ Enrichit req.user si l'utilisateur est connecté
 * ✅ Idéal pour les endpoints publics avec fonctionnalités enrichies
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      // Vérifier s'il y a une session active
      if (request.isAuthenticated && request.isAuthenticated()) {
        // L'utilisateur est déjà authentifié via passport session
        // this.logger.debug(
        //   `Optional auth: User authenticated via session - ${request.user?.email}`,
        // );
        return true;
      }

      // Vérifier l'en-tête Authorization pour JWT
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const _token = authHeader.substring(7);

        try {
          // Ici on pourrait ajouter la validation JWT si nécessaire
          // Pour l'instant, on laisse passer
          // this.logger.debug('Optional auth: Bearer token detected');
        } catch (_error) {
          this.logger.warn('Optional auth: Invalid bearer token');
        }
      }

      // Pas d'authentification trouvée, mais on laisse passer quand même
      // this.logger.debug(
      //   'Optional auth: No authentication found, proceeding without user',
      // );
      return true;
    } catch (error) {
      this.logger.warn(
        `Optional auth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Même en cas d'erreur, on laisse passer (c'est optionnel)
      return true;
    }
  }
}
