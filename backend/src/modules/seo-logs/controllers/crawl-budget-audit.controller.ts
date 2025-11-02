import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CrawlBudgetAuditService } from '../services/crawl-budget-audit.service';

/**
 * 🔍 CONTRÔLEUR AUDIT CRAWL BUDGET
 *
 * Endpoints pour auditer la cohérence entre :
 * - URLs générées par l'app
 * - URLs crawlées par Google Search Console
 * - Top pages dans Google Analytics
 *
 * ⚠️ Prend en compte la différence .com (production) vs .fr (dev/test)
 */
@ApiTags('SEO Logs - Audit Crawl Budget')
@Controller('seo-logs/crawl-budget/audit')
export class CrawlBudgetAuditController {
  private readonly logger = new Logger(CrawlBudgetAuditController.name);

  constructor(private readonly auditService: CrawlBudgetAuditService) {}

  /**
   * 🎯 AUDIT GLOBAL : Comparer URLs app vs GSC vs GA4
   *
   * @example
   * GET /seo-logs/crawl-budget/audit/consistency?domain=com&sampleSize=1000
   */
  @Get('consistency')
  @ApiOperation({
    summary: 'Audit de cohérence URLs (App vs GSC vs GA4)',
    description: `
      Croise les URLs générées par l'application avec les données Google
      pour identifier les incohérences et opportunités d'optimisation.
      
      Retourne :
      - URLs présentes partout (perfect_match)
      - URLs uniquement dans l'app (app_only) → Pas crawlées
      - URLs uniquement dans GSC (gsc_only) → Anciennes URLs ou erreurs
      - URLs avec mauvais domaine (domain_mismatch) → .com vs .fr
      
      Cas d'usage :
      - Avant de lancer une expérience A/B
      - Pour identifier gammes peu performantes
      - Pour détecter problèmes de sitemap
    `,
  })
  @ApiQuery({
    name: 'domain',
    required: false,
    enum: ['com', 'fr'],
    description: 'Domaine de référence (com=production, fr=dev/test)',
  })
  @ApiQuery({
    name: 'sampleSize',
    required: false,
    type: Number,
    description: "Nombre d'URLs à auditer (défaut: 1000)",
  })
  @ApiQuery({
    name: 'gammeIds',
    required: false,
    type: String,
    description: 'IDs gammes séparés par virgule (ex: 1234,5678)',
  })
  async auditConsistency(
    @Query('domain') domain?: 'com' | 'fr',
    @Query('sampleSize') sampleSize?: string,
    @Query('gammeIds') gammeIds?: string,
  ) {
    this.logger.log('📊 Audit de cohérence URLs...');

    const parsedGammeIds = gammeIds
      ? gammeIds.split(',').map((id) => parseInt(id.trim()))
      : undefined;

    const results = await this.auditService.auditUrlConsistency({
      domain: domain || 'com',
      sampleSize: sampleSize ? parseInt(sampleSize) : 1000,
      gammeIds: parsedGammeIds,
    });

    return {
      success: true,
      data: results,
    };
  }

  /**
   * 🎯 AUDIT GAMME SPÉCIFIQUE
   *
   * @example
   * GET /seo-logs/crawl-budget/audit/gamme/1234
   */
  @Get('gamme/:gammeId')
  @ApiOperation({
    summary: 'Audit détaillé pour une gamme spécifique',
    description: `
      Analyse approfondie d'une gamme :
      - Nombre URLs générées par l'app
      - Taux de crawl par Google
      - Sessions organiques (GA4)
      - Position moyenne (GSC)
      - Recommandations (exclude/include/reduce)
      
      Exemple de recommandation :
      - Crawl rate < 30% → Candidat pour exclusion
      - Sessions > 1000/mois → À inclure prioritairement
      - Crawl rate élevé + faible trafic → Candidat pour réduction
    `,
  })
  async auditGamme(@Query('gammeId') gammeId: string) {
    this.logger.log(`🔍 Audit gamme ${gammeId}...`);

    const results = await this.auditService.auditGamme(parseInt(gammeId));

    return {
      success: true,
      data: results,
    };
  }

  /**
   * 🎯 RAPPORT DOMAINE (.com vs .fr)
   *
   * @example
   * GET /seo-logs/crawl-budget/audit/domain-report
   */
  @Get('domain-report')
  @ApiOperation({
    summary: 'Rapport de cohérence domaine .com vs .fr',
    description: `
      Identifie les problèmes de domaine :
      - URLs en .com dans GSC alors que app génère .fr
      - URLs dupliquées sur les 2 domaines
      - Redirections manquantes
      
      Utile pour :
      - Migration .fr → .com
      - Détecter duplicate content
      - Vérifier redirections
    `,
  })
  async domainReport() {
    this.logger.log('🌐 Rapport cohérence domaines...');

    // Auditer les 2 domaines
    const [comResults, frResults] = await Promise.all([
      this.auditService.auditUrlConsistency({ domain: 'com', sampleSize: 500 }),
      this.auditService.auditUrlConsistency({ domain: 'fr', sampleSize: 500 }),
    ]);

    const report = {
      timestamp: new Date().toISOString(),
      com_domain: {
        app_urls: comResults.app_urls.total,
        gsc_urls: comResults.gsc_urls.total,
        match_rate:
          (comResults.comparison.perfect_match.length /
            comResults.app_urls.total) *
          100,
      },
      fr_domain: {
        app_urls: frResults.app_urls.total,
        gsc_urls: frResults.gsc_urls.total,
        match_rate:
          (frResults.comparison.perfect_match.length /
            frResults.app_urls.total) *
          100,
      },
      domain_issues: {
        com_urls_in_fr_gsc: comResults.comparison.domain_mismatch.length,
        fr_urls_in_com_gsc: frResults.comparison.domain_mismatch.length,
      },
      recommendations: [] as string[],
    };

    // Recommandations
    if (report.com_domain.match_rate < 50) {
      report.recommendations.push(
        '🚨 .com : Faible taux de crawl. Vérifier sitemap et redirections.',
      );
    }

    if (report.domain_issues.com_urls_in_fr_gsc > 50) {
      report.recommendations.push(
        `⚠️ ${report.domain_issues.com_urls_in_fr_gsc} URLs .com trouvées dans GSC .fr. Mettre en place redirections 301.`,
      );
    }

    if (report.com_domain.match_rate > 80 && report.fr_domain.match_rate < 30) {
      report.recommendations.push(
        '✅ .com bien indexé. .fr est environnement de test → Normal.',
      );
    }

    return {
      success: true,
      data: report,
    };
  }

  /**
   * 🎯 TOP GAMMES PAR PERFORMANCE
   *
   * @example
   * GET /seo-logs/crawl-budget/audit/top-gammes?metric=sessions&limit=10
   */
  @Get('top-gammes')
  @ApiOperation({
    summary: 'Top gammes par métrique (sessions, crawl rate, etc.)',
    description: `
      Classe les gammes par performance pour identifier :
      - Meilleures gammes (à inclure prioritairement)
      - Pires gammes (candidats pour exclusion)
      - Gammes moyennes (candidats pour réduction)
      
      Métriques disponibles :
      - sessions : Trafic organique (GA4)
      - crawl_rate : % URLs crawlées (GSC)
      - urls_count : Nombre URLs générées
    `,
  })
  @ApiQuery({
    name: 'metric',
    required: false,
    enum: ['sessions', 'crawl_rate', 'urls_count'],
    description: 'Métrique de tri',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de gammes (défaut: 20)',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Ordre de tri (défaut: desc)',
  })
  async topGammes(
    @Query('metric') metric = 'sessions',
    @Query('limit') limit = '20',
    @Query('order') order = 'desc',
  ) {
    this.logger.log(`📊 Top gammes par ${metric}...`);

    // TODO: Implémenter logique de ranking
    // Pour l'instant, retourne structure exemple

    const mockResults = [
      {
        gamme_id: 1234,
        gamme_name: 'Filtres à huile',
        urls_count: 8500,
        crawl_rate: 85.2,
        sessions_30d: 12500,
        recommendation: 'include',
        priority: 'high',
      },
      {
        gamme_id: 5678,
        gamme_name: 'Pneus anciens',
        urls_count: 12000,
        crawl_rate: 22.5,
        sessions_30d: 850,
        recommendation: 'exclude',
        priority: 'low',
      },
      {
        gamme_id: 9012,
        gamme_name: 'Pièces moteur standard',
        urls_count: 15000,
        crawl_rate: 65.8,
        sessions_30d: 8500,
        recommendation: 'reduce',
        priority: 'medium',
      },
    ];

    return {
      success: true,
      data: {
        metric,
        limit: parseInt(limit),
        order,
        results: mockResults,
      },
    };
  }
}
