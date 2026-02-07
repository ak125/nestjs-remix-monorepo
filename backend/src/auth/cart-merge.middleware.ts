import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CartDataService } from '../database/services/cart-data.service';

/**
 * 🔄 Middleware de fusion de panier
 *
 * S'exécute APRÈS l'authentification pour fusionner automatiquement
 * le panier anonyme avec le panier de l'utilisateur authentifié.
 */
@Injectable()
export class CartMergeMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CartMergeMiddleware.name);

  constructor(private readonly cartDataService: CartDataService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Vérifier si c'est une requête d'authentification réussie
    const isAuthRoute =
      req.path === '/authenticate' || req.path === '/register-and-login';
    const isAuthenticated = !!req.user;

    if (isAuthRoute && isAuthenticated) {
      // Récupérer l'ancienne session depuis un cookie temporaire ou session
      const session = req.session as unknown as
        | Record<string, unknown>
        | undefined;
      const oldSessionId = session?.__oldSessionId as string | undefined;
      const newSessionId = session?.id as string | undefined;

      this.logger.log(
        `🔍 Auth détectée - Old: ${oldSessionId}, New: ${newSessionId}`,
      );

      if (oldSessionId && newSessionId && oldSessionId !== newSessionId) {
        try {
          const mergedCount = await this.cartDataService.mergeCart(
            oldSessionId,
            newSessionId,
          );

          if (mergedCount > 0) {
            this.logger.log(
              `✅ [Middleware] Panier fusionné: ${mergedCount} articles transférés`,
            );
          }

          // Nettoyer le marqueur temporaire
          delete (req.session as unknown as Record<string, unknown>)
            .__oldSessionId;
        } catch (error) {
          this.logger.error('⚠️ [Middleware] Erreur fusion panier:', error);
        }
      }
    }

    next();
  }
}
