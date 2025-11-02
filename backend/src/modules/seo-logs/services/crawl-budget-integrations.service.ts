import { Injectable, Logger } from '@nestjs/common';
import { CrawlBudgetSupabaseService } from './crawl-budget-supabase.service';
import {
  CreateCrawlBudgetExperimentDto,
  ExperimentStatus,
} from '../dto/crawl-budget-experiment.dto';

/**
 * 🔌 Intégration Google Search Console API
 */
@Injectable()
export class GoogleSearchConsoleService {
  private readonly logger = new Logger(GoogleSearchConsoleService.name);

  /**
   * 📊 Récupérer les stats de crawl via GSC API
   *
   * Utilise l'API URL Inspection pour obtenir:
   * - Nombre de pages crawlées
   * - Fréquence de crawl
   * - Indexation status
   */
  async getCrawlStats(
    siteUrl: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    totalCrawledUrls: number;
    crawlRequestsCount: number;
    avgCrawlRate: number;
    indexedUrls: number;
    indexationRate: number;
  }> {
    // TODO: Implémenter avec googleapis
    // Requires: OAuth2 credentials + Search Console API enabled

    this.logger.warn('🚧 GSC API not yet implemented, returning mock data');

    return {
      totalCrawledUrls: 1200,
      crawlRequestsCount: 450,
      avgCrawlRate: 1.5,
      indexedUrls: 1050,
      indexationRate: 87.5,
    };
  }

  /**
   * 📄 Soumettre un sitemap via GSC API
   */
  async submitSitemap(siteUrl: string, sitemapUrl: string): Promise<void> {
    // TODO: Implémenter
    // POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{sitemapUrl}

    this.logger.log(`📤 Sitemap soumis: ${sitemapUrl} (mock)`);
  }
}

/**
 * 📈 Intégration Google Analytics 4 API
 */
@Injectable()
export class GoogleAnalyticsService {
  private readonly logger = new Logger(GoogleAnalyticsService.name);

  /**
   * 🔍 Récupérer le trafic organique via GA4 API
   */
  async getOrganicTraffic(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    organicSessions: number;
    organicConversions: number;
    organicRevenue?: number;
  }> {
    // TODO: Implémenter avec @google-analytics/data
    // Requires: Service Account credentials + GA4 API enabled

    this.logger.warn('🚧 GA4 API not yet implemented, returning mock data');

    return {
      organicSessions: 4500,
      organicConversions: 125,
      organicRevenue: 15000,
    };
  }
}

/**
 * 🗺️ Service de génération de sitemaps filtrés
 */
@Injectable()
export class SitemapGeneratorService {
  private readonly logger = new Logger(SitemapGeneratorService.name);

  constructor(private readonly supabase: CrawlBudgetSupabaseService) {}

  /**
   * 🏗️ Générer un sitemap filtré basé sur l'expérience
   */
  async generateFilteredSitemap(experimentId: string): Promise<string> {
    const experiment = await this.supabase.getExperiment(experimentId);

    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    // TODO: Récupérer toutes les URLs depuis Supabase
    // SELECT url FROM products WHERE gamme_code NOT IN (experiment.target_families)

    const allUrls = await this.getAllProductUrls();
    const filteredUrls = this.applyFilter(
      allUrls,
      experiment.action,
      experiment.target_families,
      experiment.reduction_percent,
    );

    this.logger.log(
      `🗺️ Sitemap filtré généré: ${filteredUrls.length} URLs (${experiment.action})`,
    );

    return this.buildSitemapXml(filteredUrls);
  }

  /**
   * 📦 Récupérer toutes les URLs produits depuis Supabase
   */
  private async getAllProductUrls(): Promise<
    Array<{ url: string; familyCode: string; priority: number }>
  > {
    // TODO: Query Supabase
    // const { data } = await this.supabase.from('products').select('url, gamme_code, views_count');

    // Mock data
    return [
      {
        url: 'https://automecanik.com/products/piece-1',
        familyCode: 'PIECE_MOTEUR',
        priority: 0.8,
      },
      {
        url: 'https://automecanik.com/products/piece-2',
        familyCode: 'PNEU_VIEUX',
        priority: 0.5,
      },
    ];
  }

  /**
   * 🎯 Appliquer le filtre selon l'action
   */
  private applyFilter(
    urls: Array<{ url: string; familyCode: string; priority: number }>,
    action: string,
    targetFamilies: string[],
    reductionPercent?: number,
  ): Array<{ url: string; priority: number }> {
    if (action === 'exclude') {
      // Exclure les familles ciblées
      return urls
        .filter((item) => !targetFamilies.includes(item.familyCode))
        .map((item) => ({ url: item.url, priority: item.priority }));
    }

    if (action === 'include') {
      // N'inclure que les familles ciblées
      return urls
        .filter((item) => targetFamilies.includes(item.familyCode))
        .map((item) => ({ url: item.url, priority: item.priority }));
    }

    if (action === 'reduce' && reductionPercent) {
      // Réduire le % d'URLs des familles ciblées (garder les plus prioritaires)
      const targetUrls = urls.filter((item) =>
        targetFamilies.includes(item.familyCode),
      );
      const otherUrls = urls.filter(
        (item) => !targetFamilies.includes(item.familyCode),
      );

      const keepCount = Math.floor(
        (targetUrls.length * reductionPercent) / 100,
      );
      const reducedTargetUrls = targetUrls
        .sort((a, b) => b.priority - a.priority)
        .slice(0, keepCount);

      return [...otherUrls, ...reducedTargetUrls].map((item) => ({
        url: item.url,
        priority: item.priority,
      }));
    }

    return urls.map((item) => ({ url: item.url, priority: item.priority }));
  }

  /**
   * 🏗️ Construire le XML sitemap
   */
  private buildSitemapXml(
    urls: Array<{ url: string; priority: number }>,
  ): string {
    const urlsXml = urls
      .map(
        (item) => `
  <url>
    <loc>${item.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${item.priority.toFixed(1)}</priority>
  </url>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }
}

/**
 * 📊 Service principal orchestrant toutes les intégrations
 */
@Injectable()
export class CrawlBudgetOrchestratorService {
  private readonly logger = new Logger(CrawlBudgetOrchestratorService.name);

  constructor(
    private readonly supabase: CrawlBudgetSupabaseService,
    private readonly gsc: GoogleSearchConsoleService,
    private readonly ga: GoogleAnalyticsService,
    private readonly sitemapGen: SitemapGeneratorService,
  ) {}

  /**
   * 🆕 Créer expérience avec baseline
   */
  async createExperiment(dto: CreateCrawlBudgetExperimentDto) {
    const baseline = await this.collectBaseline(dto.targetFamilies);

    return this.supabase.createExperiment({
      name: dto.name,
      description: dto.description,
      action: dto.action,
      target_families: dto.targetFamilies,
      reduction_percent: dto.reductionPercent,
      duration_days: dto.durationDays || 30,
      baseline,
    });
  }

  /**
   * 📊 Collecter baseline (30j avant)
   */
  private async collectBaseline(families: string[]) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const gscStats = await this.gsc.getCrawlStats(
      process.env.GSC_SITE_URL || 'https://automecanik.com',
      startDate,
      endDate,
    );

    const gaStats = await this.ga.getOrganicTraffic(
      process.env.GA4_PROPERTY_ID || '0',
      startDate,
      endDate,
    );

    return {
      period: '30d',
      families,
      crawl: gscStats,
      traffic: gaStats,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * 📈 Collecter métriques quotidiennes
   */
  async collectDailyMetrics(experimentId: string) {
    const today = new Date().toISOString().split('T')[0];

    const gscStats = await this.gsc.getCrawlStats(
      process.env.GSC_SITE_URL || 'https://automecanik.com',
      today,
      today,
    );

    const gaStats = await this.ga.getOrganicTraffic(
      process.env.GA4_PROPERTY_ID || '0',
      today,
      today,
    );

    return this.supabase.addMetric({
      experiment_id: experimentId,
      date: today,
      total_crawled_urls: gscStats.totalCrawledUrls,
      crawl_requests_count: gscStats.crawlRequestsCount,
      avg_crawl_rate: gscStats.avgCrawlRate,
      indexed_urls: gscStats.indexedUrls,
      indexation_rate: gscStats.indexationRate,
      organic_sessions: gaStats.organicSessions,
      organic_conversions: gaStats.organicConversions,
    });
  }

  /**
   * 🎯 Générer recommandations
   */
  async getRecommendations(experimentId: string) {
    const experiment = await this.supabase.getExperiment(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const metrics = await this.supabase.getMetrics(experimentId);

    if (metrics.length === 0) {
      return [
        {
          action: 'WAIT',
          reason: 'Pas encore de données collectées',
          confidence: 1.0,
        },
      ];
    }

    // Calculer les deltas
    const baseline = experiment.baseline?.crawl || {};
    const avgIndexation =
      metrics.reduce((sum, m) => sum + m.indexation_rate, 0) / metrics.length;
    const avgSessions =
      metrics.reduce((sum, m) => sum + (m.organic_sessions || 0), 0) /
      metrics.length;

    const indexationDelta =
      ((avgIndexation - (baseline.indexationRate || 0)) /
        (baseline.indexationRate || 1)) *
      100;
    const sessionsDelta =
      ((avgSessions - (experiment.baseline?.traffic?.organicSessions || 0)) /
        (experiment.baseline?.traffic?.organicSessions || 1)) *
      100;

    const recommendations: Array<{
      action: string;
      reason: string;
      confidence: number;
    }> = [];

    if (indexationDelta > 5) {
      recommendations.push({
        action: 'KEEP_EXCLUSION',
        reason: `L'indexation s'est améliorée de +${indexationDelta.toFixed(1)}%`,
        confidence: 0.9,
      });
    }

    if (sessionsDelta < -10) {
      recommendations.push({
        action: 'REVERT',
        reason: `Le trafic organique a chuté de ${sessionsDelta.toFixed(1)}%`,
        confidence: 0.85,
      });
    }

    if (Math.abs(indexationDelta) < 2 && Math.abs(sessionsDelta) < 5) {
      recommendations.push({
        action: 'NEUTRAL',
        reason: "Pas d'impact significatif détecté",
        confidence: 0.7,
      });
    }

    return recommendations;
  }
}
