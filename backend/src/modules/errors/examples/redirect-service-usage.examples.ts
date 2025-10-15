/**
 * Exemple d'utilisation du Service de Redirection Amélioré
 *
 * Ce fichier montre comment utiliser le RedirectService optimisé
 * avec compatibilité totale pour l'ancien code utilisateur.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  RedirectService,
  RedirectEntry,
  RedirectRule,
} from '../services/redirect.service';

@Injectable()
export class RedirectServiceUsageExamples {
  private readonly logger = new Logger(RedirectServiceUsageExamples.name);

  constructor(private readonly redirectService: RedirectService) {}

  /**
   * Exemple 1: Utilisation simple avec l'interface RedirectEntry (code utilisateur)
   */
  async useOriginalInterface() {
    // Création d'une redirection avec l'ancienne interface
    const redirect: RedirectEntry = {
      old_path: '/old-product/*',
      new_path: '/products/$1',
      redirect_type: 301,
      reason: 'Migration vers nouvelle structure',
    };

    const created = await this.redirectService.createRedirect(redirect);
    this.logger.log('Redirection créée:', created);

    // Recherche avec l'ancienne méthode
    const found = await this.redirectService.findRedirect(
      '/old-product/smartphone',
    );
    if (found) {
      this.logger.log(
        `Redirection trouvée: ${found.old_path || found.source_path} → ${found.new_path || found.destination_path}`,
      );
    }
  }

  /**
   * Exemple 2: Gestion 410 Gone avec markAsGone (code utilisateur)
   */
  async handleGonePages() {
    // Marquer des pages comme définitivement supprimées
    const gonePages = [
      '/discontinued-product/old-model',
      '/legacy/admin/panel',
      '/temp/promo/expired',
    ];

    for (const page of gonePages) {
      await this.redirectService.markAsGone(
        page,
        'Page supprimée lors de la refonte 2025',
      );
      this.logger.log(`Page marquée comme 410: ${page}`);
    }
  }

  /**
   * Exemple 3: Middleware de redirection pour Express/NestJS
   */
  async redirectionMiddleware(req: Request, res: Response, next: Function) {
    try {
      const redirect = await this.redirectService.findRedirect(req.path);

      if (redirect) {
        const statusCode =
          redirect.redirect_type || redirect.status_code || 301;
        const destination = redirect.new_path || redirect.destination_path;

        if (statusCode === 410) {
          // Ressource supprimée définitivement
          return res.status(410).json({
            error: 'Cette page a été définitivement supprimée',
            reason: redirect.reason || redirect.description,
            alternatives: ['/products', '/search', '/contact'],
          });
        }

        // Redirection normale
        this.logger.log(
          `Redirection ${statusCode}: ${req.path} → ${destination}`,
        );
        return res.redirect(statusCode, destination);
      }

      next();
    } catch (error) {
      this.logger.error('Erreur dans le middleware de redirection:', error);
      next();
    }
  }

  /**
   * Exemple 4: Migration de masse avec patterns
   */
  async bulkMigration() {
    const migrations = [
      {
        pattern: '/blog/category/*/post/*',
        replacement: '/blog/$2/category/$1',
        reason: 'Réorganisation structure blog',
      },
      {
        pattern: '/user/*/profile',
        replacement: '/users/$1',
        reason: 'Simplification URLs utilisateur',
      },
      {
        pattern: '/admin/legacy/*',
        replacement: '/dashboard/$1',
        reason: 'Migration interface admin',
      },
    ];

    for (const migration of migrations) {
      const redirect: RedirectEntry = {
        old_path: migration.pattern,
        new_path: migration.replacement,
        redirect_type: 301,
        reason: migration.reason,
      };

      await this.redirectService.createRedirect(redirect);
      this.logger.log(
        `Migration créée: ${migration.pattern} → ${migration.replacement}`,
      );
    }
  }

  /**
   * Exemple 5: Utilisation avancée avec la nouvelle interface RedirectRule
   */
  async useAdvancedFeatures() {
    const advancedRule: Partial<RedirectRule> = {
      source_path: '^/api/v([0-9]+)/(.*)$', // Regex pattern
      destination_path: '/api/latest/$2',
      status_code: 308, // Permanent redirect avec préservation méthode
      is_active: true,
      is_regex: true,
      priority: 100,
      description: 'Redirection API vers dernière version',
    };

    const created = await this.redirectService.createRedirectRule(advancedRule);
    this.logger.log('Règle avancée créée:', created);
  }

  /**
   * Exemple 6: Surveillance et statistiques
   */
  async monitorRedirections() {
    try {
      // Récupérer les statistiques
      const stats = await this.redirectService.getRedirectStats();

      this.logger.log('=== Statistiques de Redirection ===');
      this.logger.log(`Total des règles: ${stats.total_rules}`);
      this.logger.log(`Règles actives: ${stats.active_rules}`);
      this.logger.log(`Total des hits: ${stats.total_hits}`);

      // Afficher les redirections les plus utilisées
      this.logger.log('\n=== Top 5 Redirections ===');
      stats.top_redirects.slice(0, 5).forEach((redirect, index) => {
        this.logger.log(
          `${index + 1}. ${redirect.source_path} → ${redirect.destination_path} (${redirect.hit_count} hits)`,
        );
      });

      // Alerter si trop de redirections
      if (stats.total_hits > 10000) {
        this.logger.warn(
          '⚠️  Nombre élevé de redirections détecté. Considérer la mise à jour des liens.',
        );
      }

      return stats;
    } catch (error) {
      this.logger.error('Erreur lors de la surveillance:', error);
      return null;
    }
  }

  /**
   * Exemple 7: Nettoyage automatique des redirections obsolètes
   */
  async cleanupObsoleteRedirections() {
    try {
      const allRules = await this.redirectService.getAllRedirectRules();
      const obsoleteThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 jours

      for (const rule of allRules) {
        // Supprimer les règles sans hits depuis 90 jours
        if (rule.hit_count === 0 && rule.msg_date < obsoleteThreshold) {
          await this.redirectService.deleteRedirectRule(rule.msg_id!);
          this.logger.log(`Règle obsolète supprimée: ${rule.source_path}`);
        }

        // Désactiver les règles 410 anciennes
        if (rule.status_code === 410 && rule.msg_date < obsoleteThreshold) {
          await this.redirectService.updateRedirectRule(rule.msg_id!, {
            is_active: false,
          });
          this.logger.log(`Règle 410 désactivée: ${rule.source_path}`);
        }
      }
    } catch (error) {
      this.logger.error('Erreur lors du nettoyage:', error);
    }
  }

  /**
   * Exemple 8: Import/Export de redirections
   */
  async importRedirectionsFromCSV(csvData: string) {
    const lines = csvData.split('\n').slice(1); // Skip header

    for (const line of lines) {
      const [oldPath, newPath, statusCode, reason] = line.split(',');

      if (oldPath && newPath) {
        const redirect: RedirectEntry = {
          old_path: oldPath.trim(),
          new_path: newPath.trim(),
          redirect_type: parseInt(statusCode) || 301,
          reason: reason?.trim() || 'Import CSV',
        };

        await this.redirectService.createRedirect(redirect);
        this.logger.log(`Imported: ${oldPath} → ${newPath}`);
      }
    }
  }

  async exportRedirectionsToCSV(): Promise<string> {
    const rules = await this.redirectService.getAllRedirectRules();

    const csvLines = [
      'Source Path,Destination Path,Status Code,Description,Hit Count,Last Hit',
    ];

    for (const rule of rules) {
      csvLines.push(
        [
          rule.source_path,
          rule.destination_path,
          rule.status_code.toString(),
          rule.description || '',
          (rule.hit_count || 0).toString(),
          rule.last_hit?.toISOString() || '',
        ].join(','),
      );
    }

    return csvLines.join('\n');
  }

  /**
   * Exemple 9: Tests automatisés des redirections
   */
  async testRedirections() {
    const testCases = [
      { input: '/old-product/123', expected: '/products/123' },
      {
        input: '/blog/category/tech/post/ai-future',
        expected: '/blog/ai-future/category/tech',
      },
      { input: '/user/john/profile', expected: '/users/john' },
      { input: '/api/v1/users', expected: '/api/latest/users' },
    ];

    const results = [];

    for (const testCase of testCases) {
      const redirect = await this.redirectService.findRedirect(testCase.input);
      const actual = redirect
        ? redirect.new_path || redirect.destination_path
        : null;

      const result = {
        input: testCase.input,
        expected: testCase.expected,
        actual,
        success: actual === testCase.expected,
      };

      results.push(result);

      if (result.success) {
        this.logger.log(`✅ ${testCase.input} → ${actual}`);
      } else {
        this.logger.error(
          `❌ ${testCase.input}: attendu ${testCase.expected}, reçu ${actual}`,
        );
      }
    }

    const successRate =
      results.filter((r) => r.success).length / results.length;
    this.logger.log(
      `Taux de réussite des tests: ${(successRate * 100).toFixed(1)}%`,
    );

    return results;
  }

  /**
   * Exemple 10: Intégration avec analytics
   */
  async trackRedirectionAnalytics(
    req: Request,
    redirect: RedirectEntry | RedirectRule,
  ) {
    const analyticsData = {
      event: 'redirection',
      source_path: redirect.old_path || redirect.source_path,
      destination_path: redirect.new_path || redirect.destination_path,
      status_code: redirect.redirect_type || redirect.status_code,
      user_agent: req.get('User-Agent'),
      referer: req.get('Referer'),
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    };

    // Envoyer vers service d'analytics
    try {
      // await this.analyticsService.track(analyticsData);
      this.logger.log('Analytics tracked:', analyticsData);
    } catch (error) {
      this.logger.error('Erreur analytics:', error);
    }
  }
}

/**
 * Exemple d'intégration dans un contrôleur NestJS
 */
/*
@Controller('admin/redirections')
export class RedirectionsController {
  constructor(
    private readonly redirectService: RedirectService,
    private readonly examples: RedirectServiceUsageExamples
  ) {}

  @Get('stats')
  async getStats() {
    return this.examples.monitorRedirections();
  }

  @Post('test')
  async testAll() {
    return this.examples.testRedirections();
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCSV(@UploadedFile() file: Express.Multer.File) {
    const csvData = file.buffer.toString();
    await this.examples.importRedirectionsFromCSV(csvData);
    return { success: true };
  }

  @Get('export')
  async exportCSV(@Res() res: Response) {
    const csv = await this.examples.exportRedirectionsToCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="redirections.csv"');
    return res.send(csv);
  }
}
*/

/**
 * Exemple de tâche cron pour maintenance automatique
 */
/*
@Injectable()
export class RedirectionMaintenanceService {
  constructor(private readonly examples: RedirectServiceUsageExamples) {}

  @Cron('0 2 * * 0') // Tous les dimanches à 2h
  async weeklyMaintenance() {
    await this.examples.cleanupObsoleteRedirections();
    await this.examples.monitorRedirections();
  }

  @Cron('0 0/6 * * *') // Toutes les 6 heures
  async testRedirections() {
    const results = await this.examples.testRedirections();
    const failureRate = results.filter(r => !r.success).length / results.length;
    
    if (failureRate > 0.1) { // Plus de 10% d'échecs
      // Envoyer alerte
      console.warn('Taux d\'échec élevé détecté dans les redirections');
    }
  }
}
*/
