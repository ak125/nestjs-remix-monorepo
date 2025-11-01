import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UrlAuditService } from '../services/url-audit.service';
import { SitemapGeneratorService } from '../services/crawl-budget-integrations.service';

/**
 * 🔍 Contrôleur d'audit des URLs
 *
 * Endpoints pour comparer les URLs générées avec GSC/GA4
 * et détecter les différences .com/.fr
 */
@ApiTags('SEO - URL Audit')
@Controller('seo-logs/url-audit')
export class UrlAuditController {
  private readonly logger = new Logger(UrlAuditController.name);

  constructor(
    private readonly urlAuditService: UrlAuditService,
    private readonly sitemapService: SitemapGeneratorService,
  ) {}

  /**
   * Audit complet : compare URLs générées avec GSC + GA4
   */
  @Get('compare')
  @ApiOperation({
    summary: 'Compare URLs générées avec Google Search Console et GA4',
    description:
      "Analyse les URLs générées par l'application et les croise avec les données GSC (crawl) et GA4 (trafic). Prend en compte les anciennes URLs .com vs nouvelles .fr",
  })
  @ApiQuery({
    name: 'gammeIds',
    required: false,
    description: 'pg_id des gammes à auditer (séparés par virgules)',
    example: '1303,3352,4715',
  })
  async compareUrls(@Query('gammeIds') gammeIds?: string): Promise<{
    success: boolean;
    data: {
      audit_date: string;
      gammes_analyzed: number[];
      summary: any;
      details: any;
      gsc_exclusive_sample: any[];
      ga4_exclusive_sample: any[];
      recommendations: string[];
    };
  }> {
    try {
      const parsedGammeIds = gammeIds
        ? gammeIds.split(',').map((id) => parseInt(id.trim()))
        : undefined;

      this.logger.log(
        `🔍 Audit URLs - Gammes: ${parsedGammeIds?.join(', ') || 'TOUTES'}`,
      );

      // Générer les URLs depuis l'application
      const generatedUrls = await this.sitemapService['getAllProductUrls']();
      const urlStrings = generatedUrls.map((u) => u.url);

      // Comparer avec GSC + GA4
      const audit = await this.urlAuditService.auditUrls(urlStrings);

      // Générer recommandations
      const recommendations: string[] = [];

      if (audit.summary.missing_in_both > 0) {
        recommendations.push(
          `⚠️ ${audit.summary.missing_in_both} URLs générées n'apparaissent ni dans GSC ni dans GA4 - URLs probablement nouvelles ou jamais crawlées`,
        );
      }

      if (audit.gsc_exclusive.length > 50) {
        recommendations.push(
          `🔧 ${audit.gsc_exclusive.length} URLs dans GSC mais pas dans votre sitemap - anciennes URLs .com à rediriger ?`,
        );
      }

      if (audit.summary.found_in_both / audit.summary.total_generated < 0.5) {
        const coverage = (
          (audit.summary.found_in_both / audit.summary.total_generated) *
          100
        ).toFixed(1);
        recommendations.push(
          `📊 Seulement ${coverage}% des URLs générées sont indexées ET visitées - considérer A/B test pour améliorer crawl budget`,
        );
      }

      if (audit.ga4_exclusive.length > 0) {
        recommendations.push(
          `✅ ${audit.ga4_exclusive.length} URLs visitées (GA4) mais pas crawlées (GSC) - vérifier redirections ou sitemap`,
        );
      }

      return {
        success: true,
        data: {
          audit_date: new Date().toISOString(),
          gammes_analyzed: parsedGammeIds || [],
          summary: audit.summary,
          details: {
            in_gsc_only_count: audit.details.in_gsc_only.length,
            in_ga4_only_count: audit.details.in_ga4_only.length,
            in_both_count: audit.details.in_both.length,
            missing_count: audit.details.missing.length,
            // Exemples de chaque catégorie
            in_gsc_only_sample: audit.details.in_gsc_only.slice(0, 5),
            in_ga4_only_sample: audit.details.in_ga4_only.slice(0, 5),
            in_both_sample: audit.details.in_both.slice(0, 5),
            missing_sample: audit.details.missing.slice(0, 5),
          },
          gsc_exclusive_sample: audit.gsc_exclusive.slice(0, 10),
          ga4_exclusive_sample: audit.ga4_exclusive.slice(0, 10),
          recommendations,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur audit URLs:', error);
      throw error;
    }
  }

  /**
   * Détecte les différences .com vs .fr
   */
  @Get('detect-domain-differences')
  @ApiOperation({
    summary: 'Détecte les URLs .com vs .fr dans Google Search Console',
    description:
      'Analyse les URLs crawlées par Google et identifie les patterns .com (anciennes) vs .fr (nouvelles)',
  })
  async detectDomainDifferences(): Promise<{
    success: boolean;
    data: {
      audit_date: string;
      com_urls: number;
      fr_urls: number;
      com_percentage: number;
      fr_percentage: number;
      pattern_analysis: any[];
      recommendations: string[];
    };
  }> {
    try {
      const analysis = await this.urlAuditService.detectUrlFormatDifferences();

      const total = analysis.com_urls + analysis.fr_urls;
      const comPercentage = total > 0 ? (analysis.com_urls / total) * 100 : 0;
      const frPercentage = total > 0 ? (analysis.fr_urls / total) * 100 : 0;

      const recommendations: string[] = [];

      if (analysis.com_urls > analysis.fr_urls) {
        recommendations.push(
          `⚠️ Plus d'URLs .com (${analysis.com_urls}) que .fr (${analysis.fr_urls}) dans GSC - migration incomplète ?`,
        );
        recommendations.push(
          `🔧 Vérifier redirections 301 : .com → .fr pour toutes anciennes URLs`,
        );
      }

      if (comPercentage > 20) {
        recommendations.push(
          `📊 ${comPercentage.toFixed(1)}% des URLs crawlées sont encore en .com - considérer exclusion dans A/B test`,
        );
      }

      if (frPercentage > 80) {
        recommendations.push(
          `✅ ${frPercentage.toFixed(1)}% des URLs crawlées sont en .fr - migration réussie !`,
        );
      }

      // Analyser patterns les plus impactés
      const topComPatterns = analysis.pattern_differences
        .filter((p) => p.com_count > 10)
        .slice(0, 5);

      if (topComPatterns.length > 0) {
        recommendations.push(
          `🎯 Patterns .com à prioriser pour nettoyage : ${topComPatterns.map((p) => `/${p.pattern}/`).join(', ')}`,
        );
      }

      return {
        success: true,
        data: {
          audit_date: new Date().toISOString(),
          com_urls: analysis.com_urls,
          fr_urls: analysis.fr_urls,
          com_percentage: parseFloat(comPercentage.toFixed(2)),
          fr_percentage: parseFloat(frPercentage.toFixed(2)),
          pattern_analysis: analysis.pattern_differences.slice(0, 20),
          recommendations,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur détection différences domaine:', error);
      throw error;
    }
  }

  /**
   * Récupère les URLs exclusives de GSC (anciennes URLs non générées)
   */
  @Get('gsc-exclusive')
  @ApiOperation({
    summary: 'URLs crawlées par Google mais absentes du sitemap généré',
    description:
      "Identifie les URLs présentes dans GSC mais non générées par l'application (anciennes URLs .com, pages obsolètes, etc.)",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre max d'URLs à retourner",
    example: 50,
  })
  async getGscExclusiveUrls(@Query('limit') limit?: string): Promise<{
    success: boolean;
    data: {
      total_exclusive: number;
      exclusive_urls: Array<{
        url: string;
        clicks: number;
        impressions: number;
        is_com: boolean;
      }>;
      summary: {
        com_count: number;
        fr_count: number;
        total_clicks: number;
        total_impressions: number;
      };
    };
  }> {
    try {
      const maxLimit = limit ? parseInt(limit) : 100;

      // Générer URLs actuelles
      const generatedUrls = await this.sitemapService['getAllProductUrls']();
      const urlStrings = generatedUrls.map((u) => u.url);

      const audit = await this.urlAuditService.auditUrls(urlStrings);

      const exclusiveUrls = audit.gsc_exclusive.slice(0, maxLimit).map((u) => ({
        ...u,
        is_com: u.url.includes('.com'),
      }));

      const comCount = exclusiveUrls.filter((u) => u.is_com).length;
      const frCount = exclusiveUrls.filter((u) => !u.is_com).length;
      const totalClicks = exclusiveUrls.reduce((sum, u) => sum + u.clicks, 0);
      const totalImpressions = exclusiveUrls.reduce(
        (sum, u) => sum + u.impressions,
        0,
      );

      return {
        success: true,
        data: {
          total_exclusive: audit.gsc_exclusive.length,
          exclusive_urls: exclusiveUrls,
          summary: {
            com_count: comCount,
            fr_count: frCount,
            total_clicks: totalClicks,
            total_impressions: totalImpressions,
          },
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération URLs exclusives GSC:', error);
      throw error;
    }
  }
}
