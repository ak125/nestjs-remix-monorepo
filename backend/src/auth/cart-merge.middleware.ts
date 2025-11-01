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
    const isAuthRoute = req.path === '/authenticate' || req.path === '/register-and-login';
    const isAuthenticated = !!(req as any).user;

    if (isAuthRoute && isAuthenticated) {
      // Récupérer l'ancienne session depuis un cookie temporaire ou session
      const oldSessionId = (req as any).session?.__oldSessionId;
      const newSessionId = (req as any).session?.id;

      this.logger.log(`🔍 Auth détectée - Old: ${oldSessionId}, New: ${newSessionId}`);

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
          delete (req as any).session.__oldSessionId;
        } catch (error) {
          this.logger.error('⚠️ [Middleware] Erreur fusion panier:', error);
        }
      }
    }

    next();
  }
}
