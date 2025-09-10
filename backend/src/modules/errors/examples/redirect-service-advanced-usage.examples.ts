/**
 * Exemples d'utilisation du Service de Redirection Amélioré
 *
 * Ce fichier montre comment utiliser le RedirectService optimisé
 * qui combine le code utilisateur original avec les améliorations modernes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedirectService } from '../services/redirect.service';

@Injectable()
export class RedirectServiceUsageExamples {
  private readonly logger = new Logger(RedirectServiceUsageExamples.name);

  constructor(private readonly redirectService: RedirectService) {}

  /**
   * Exemple 1: Utilisation du code utilisateur original (100% compatible)
   */
  async useOriginalUserCode() {
    // Code utilisateur fonctionne EXACTEMENT comme avant
    const redirect = await this.redirectService.findRedirect('/old-page');

    if (redirect) {
      // Gérer les deux types de retour possibles
      if ('old_path' in redirect) {
        // RedirectEntry
        this.logger.log(
          `Redirection trouvée: ${redirect.old_path} -> ${redirect.new_path}`,
        );
        this.logger.log(
          `Type: ${redirect.redirect_type}, Raison: ${redirect.reason}`,
        );
      } else {
        // RedirectRule
        this.logger.log(
          `Redirection trouvée: ${redirect.source_path} -> ${redirect.destination_path}`,
        );
        this.logger.log(
          `Type: ${redirect.status_code}, Description: ${redirect.description}`,
        );
      }
    }

    // Créer une redirection avec l'interface originale
    await this.redirectService.createRedirect({
      old_path: '/old-blog/*',
      new_path: '/blog/$1',
      redirect_type: 301,
      reason: 'Migration du blog',
    });

    // Marquer une page comme supprimée (410 Gone)
    await this.redirectService.markAsGone(
      '/deprecated-page',
      'Feature retirée',
    );
  }

  /**
   * Exemple 2: Gestion des redirections dans un middleware Express
   */
  async handleRedirectMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const redirect = await this.redirectService.findRedirect(req.path);

      if (redirect) {
        // Le service gère automatiquement l'incrémentation des hits
        const statusCode =
          'redirect_type' in redirect
            ? redirect.redirect_type
            : redirect.status_code || 301;

        const newPath =
          'new_path' in redirect
            ? redirect.new_path
            : redirect.destination_path;

        this.logger.log(
          `Redirection ${req.path} -> ${newPath} (${statusCode})`,
        );
        return res.redirect(statusCode, newPath);
      }

      next();
    } catch (error) {
      this.logger.error('Erreur dans le middleware de redirection:', error);
      next();
    }
  }

  /**
   * Exemple 3: Utilisation des nouvelles fonctionnalités avancées
   */
  async useAdvancedFeatures() {
    // Créer une règle avancée avec regex
    const advancedRule = await this.redirectService.createRedirectRule({
      source_path: '/api/v1/(.*)',
      destination_path: '/api/v2/$1',
      status_code: 301,
      is_regex: true,
      priority: 100,
      description: 'Migration API v1 vers v2',
      msg_cnfa_id: 'admin-user-id',
    });

    // Créer une redirection avec priorité
    await this.redirectService.createRedirectRule({
      source_path: '/products/category/(.*)',
      destination_path: '/categories/$1',
      status_code: 302,
      is_regex: true,
      priority: 50,
      description: 'Restructuration des catégories',
    });

    // Mise à jour d'une règle existante
    if (advancedRule?.msg_id) {
      await this.redirectService.updateRedirectRule(advancedRule.msg_id, {
        redirectMetadata: {
          ...advancedRule.redirectMetadata!,
          description: 'Migration API v1 vers v2 - Mise à jour',
          priority: 150,
        },
        msg_cnfa_id: 'another-admin-id',
      });
    }
  }

  /**
   * Exemple 4: Analytics et monitoring des redirections
   */
  async analyzeRedirections() {
    try {
      // Obtenir les statistiques globales
      const stats = await this.redirectService.getRedirectStats();

      this.logger.log('📊 Statistiques des redirections:');
      this.logger.log(`Total des règles: ${stats.total_rules}`);
      this.logger.log(`Règles actives: ${stats.active_rules}`);
      this.logger.log(`Total des hits: ${stats.total_hits}`);

      // Analyser les redirections les plus populaires
      this.logger.log('\n🔥 Top redirections:');
      stats.top_redirects.forEach((redirect, index) => {
        this.logger.log(
          `${index + 1}. ${redirect.source_path} → ${redirect.destination_path} (${redirect.hit_count} hits)`,
        );
      });

      return {
        stats,
        efficiency:
          stats.total_hits > 0
            ? (stats.active_rules / stats.total_rules) * 100
            : 0,
      };
    } catch (error) {
      this.logger.error("Erreur lors de l'analyse:", error);
      return null;
    }
  }

  /**
   * Exemple 5: Contrôleur NestJS avec redirections
   */
  async controllerExample(path: string) {
    const redirect = await this.redirectService.findRedirect(path);

    if (redirect) {
      const url =
        'new_path' in redirect ? redirect.new_path : redirect.destination_path;
      const status =
        'redirect_type' in redirect
          ? redirect.redirect_type
          : redirect.status_code;
      const reason =
        'reason' in redirect
          ? redirect.reason
          : 'description' in redirect
            ? redirect.description
            : undefined;

      return {
        redirect: true,
        url,
        status,
        reason,
      };
    }

    return { redirect: false };
  }
}

/*
 * Exemple d'intégration dans un module NestJS
 */
/*
@Module({
  imports: [ErrorsModule],
  providers: [RedirectServiceUsageExamples],
  exports: [RedirectServiceUsageExamples],
})
export class RedirectUsageModule {}
*/
