/**
 * Exemple d'utilisation du Service d'Erreur Amélioré
 *
 * Ce fichier montre comment utiliser le nouveau ErrorService optimisé
 * dans différents contextes de l'application NestJS+Remix.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorService } from '../services/error.service';

@Injectable()
export class ErrorServiceUsageExamples {
  private readonly logger = new Logger(ErrorServiceUsageExamples.name);

  constructor(private readonly errorService: ErrorService) {}

  /**
   * Exemple 1: Gestion d'une erreur 404 dans un middleware
   */
  async handle404Middleware(req: Request, res: Response) {
    const result = await this.errorService.handle404(req);

    if (result.shouldRedirect) {
      return res.redirect(result.statusCode || 301, result.redirectUrl!);
    }

    // Renvoyer la page 404 avec suggestions
    return res.status(404).json({
      error: 'Page non trouvée',
      path: req.path,
      suggestions: result.suggestions || [],
      context: result.context,
    });
  }

  /**
   * Exemple 2: Gestion d'une ressource supprimée (410)
   */
  async handleDeletedResource(req: Request, res: Response) {
    const result = await this.errorService.handle410(req);

    if (result.shouldRedirect) {
      return res.redirect(result.statusCode || 301, result.redirectUrl!);
    }

    return res.status(410).json({
      error: 'Cette ressource a été définitivement supprimée',
      message: result.message,
      alternatives: [
        '/products', // Page produits générale
        '/search?q=' + encodeURIComponent(req.path.split('/').pop() || ''),
      ],
    });
  }

  /**
   * Exemple 3: Gestion d'une condition préalable échouée (412)
   */
  async handlePreconditionFailed(
    req: Request,
    res: Response,
    condition: string,
  ) {
    const result = await this.errorService.handle412(req, condition);

    return res.status(412).json({
      error: 'Condition préalable non remplie',
      message: result.message,
      shouldRetry: result.shouldRetry,
      retryAfter: result.retryAfter,
      condition: condition,
    });
  }

  /**
   * Exemple 4: Logging d'erreur personnalisée avec contexte
   */
  async logCustomError(error: Error, req: Request, customContext: any) {
    await this.errorService.logError(error, req, {
      ...customContext,
      customField: 'valeur personnalisée',
      userId: req.user?.id || 'anonymous',
      sessionId: req.sessionID,
    });
  }

  /**
   * Exemple 5: Utilisation dans un filtre d'exception global
   */
  async handleGlobalException(exception: any, req: Request, res: Response) {
    try {
      // Logger l'erreur avec contexte complet
      await this.errorService.logError(exception, req, {
        handler: 'GlobalExceptionFilter',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });

      // Déterminer le type de réponse
      if (exception.status === 404) {
        return this.handle404Middleware(req, res);
      } else if (exception.status === 410) {
        return this.handleDeletedResource(req, res);
      } else if (exception.status === 412) {
        return this.handlePreconditionFailed(req, res, exception.message);
      }

      // Erreur générique
      return res.status(exception.status || 500).json({
        error: 'Erreur interne du serveur',
        message: exception.message,
        timestamp: new Date().toISOString(),
        path: req.url,
      });
    } catch (error) {
      // Fallback si le service d'erreur lui-même échoue
      this.logger.error("Erreur dans le gestionnaire d'exception:", error);
      return res.status(500).json({
        error: 'Erreur critique du serveur',
      });
    }
  }

  /**
   * Exemple 6: Utilisation dans un contrôleur REST
   */
  async productController(req: Request, res: Response) {
    try {
      const productId = req.params.id;
      // const product = await this.productService.findById(productId);

      // Simuler que le produit n'existe pas
      const product = null;

      if (!product) {
        // Au lieu de juste retourner 404, utiliser le service amélioré
        const errorResult = await this.errorService.handle404(req);

        return res.status(404).json({
          error: 'Produit non trouvé',
          productId,
          suggestions: errorResult.suggestions,
          alternativeProducts: [
            '/products/similar?id=' + productId,
            '/products/category/same-category',
          ],
        });
      }

      return res.json({ product });
    } catch (error) {
      await this.logCustomError(error, req, {
        controller: 'ProductController',
        action: 'getProduct',
        productId: req.params.id,
      });

      return res.status(500).json({
        error: 'Erreur lors de la récupération du produit',
      });
    }
  }

  /**
   * Exemple 7: Génération de rapport d'erreurs pour dashboard admin
   */
  async generateErrorReport() {
    try {
      // Récupérer les métriques générales
      const metrics = await this.errorService.getErrorMetrics('24h');

      // Récupérer le rapport des erreurs fréquentes
      const frequentErrors = await this.errorService.getFrequentErrorsReport();

      // Récupérer les erreurs récentes
      const recentErrors = await this.errorService.getErrors({
        page: 1,
        limit: 50,
        resolved: false,
      });

      return {
        summary: {
          total_errors_24h: metrics.total_errors,
          error_rate: metrics.error_rate_24h,
          most_critical: metrics.errors_by_severity.critical || 0,
        },
        frequent_404s: frequentErrors.frequent_404s,
        frequent_errors: frequentErrors.frequent_errors,
        recent_unresolved: recentErrors.data,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la génération du rapport:', error);
      throw error;
    }
  }

  /**
   * Exemple 8: Résolution d'erreur par un administrateur
   */
  async resolveError(errorId: string, adminUserId: string, resolution: string) {
    try {
      const resolved = await this.errorService.resolveError(
        errorId,
        adminUserId,
      );

      if (resolved) {
        this.logger.log(
          `Erreur ${errorId} résolue par ${adminUserId}: ${resolution}`,
        );
        return {
          success: true,
          message: 'Erreur marquée comme résolue',
          resolvedBy: adminUserId,
          resolvedAt: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          message: "Impossible de résoudre l'erreur",
        };
      }
    } catch (error) {
      this.logger.error('Erreur lors de la résolution:', error);
      throw error;
    }
  }

  /**
   * Exemple 9: Intégration avec Remix pour SSR
   */
  async remixErrorBoundary(error: Error, request: Request) {
    // Logger l'erreur côté serveur
    await this.errorService.logError(error, request, {
      context: 'RemixErrorBoundary',
      ssr: true,
      userAgent: request.headers['user-agent'],
    });

    // Retourner les données pour la page d'erreur Remix
    if (error.message.includes('404')) {
      const result = await this.errorService.handle404(request);
      return {
        errorType: '404',
        suggestions: result.suggestions,
        showSuggestions: true,
      };
    }

    return {
      errorType: 'generic',
      message: 'Une erreur est survenue',
      showContactSupport: true,
    };
  }

  /**
   * Exemple 10: Hook pour analyser les patterns d'erreurs
   */
  async analyzeErrorPatterns() {
    try {
      const report = await this.generateErrorReport();

      // Analyser les patterns pour détecter des problèmes systémiques
      const patterns = {
        high_404_rate: report.frequent_404s.length > 20,
        database_issues: report.frequent_errors.some(
          (e) =>
            e.code.includes('Database') || e.message.includes('connection'),
        ),
        auth_problems: report.frequent_errors.some(
          (e) =>
            e.code.includes('Auth') || e.message.includes('authentication'),
        ),
      };

      // Alerter si des patterns critiques sont détectés
      if (patterns.database_issues) {
        this.logger.warn('🚨 Pattern détecté: Problèmes de base de données');
      }

      if (patterns.high_404_rate) {
        this.logger.warn("🚨 Pattern détecté: Taux élevé d'erreurs 404");
      }

      return patterns;
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse des patterns:", error);
      return null;
    }
  }
}

/**
 * Exemple d'intégration dans un module NestJS
 */
/*
@Module({
  imports: [ErrorsModule],
  providers: [ErrorServiceUsageExamples],
  exports: [ErrorServiceUsageExamples],
})
export class ErrorUsageModule {}
*/

/**
 * Exemple d'utilisation dans un middleware Express/NestJS
 */
/*
@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  constructor(private readonly errorService: ErrorService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Capturer les erreurs non gérées
    res.on('error', async (error) => {
      await this.errorService.logError(error, req, {
        middleware: 'ErrorHandlingMiddleware',
        level: 'middleware',
      });
    });

    next();
  }
}
*/
