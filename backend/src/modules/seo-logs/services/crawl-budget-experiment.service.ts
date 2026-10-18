import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CreateCrawlBudgetExperimentDto,
  ExperimentStatus,
  CrawlBudgetMetrics,
} from '../dto/crawl-budget-experiment.dto';
import { CrawlBudgetSupabaseService } from './crawl-budget-supabase.service';
import { randomBytes } from 'crypto';

/**
 * 🧪 Service de gestion des expériences A/B sur le crawl budget
 *
 * Workflow:
 * 1. Créer expérience → génère sitemap filtré
 * 2. Soumettre sitemap filtré à Google Search Console
 * 3. Collecter métriques quotidiennes (crawl + indexation)
 * 4. Analyser impact après N jours
 * 5. Recommandations automatiques
 */
@Injectable()
export class CrawlBudgetExperimentService {
  private readonly logger = new Logger(CrawlBudgetExperimentService.name);

  constructor(private readonly supabase: CrawlBudgetSupabaseService) {}

  /**
   * 🆕 Créer une nouvelle expérience
   */
  async createExperiment(dto: CreateCrawlBudgetExperimentDto) {
    const experimentId = randomBytes(8).toString('hex');

    // Récupérer baseline (métriques 30j avant)
    const baseline = await this.collectBaselineMetrics(dto.targetFamilies);

    const experiment = {
      id: experimentId,
      name: dto.name,
      description: dto.description,
      action: dto.action,
      targetFamilies: dto.targetFamilies,
      reductionPercent: dto.reductionPercent,
      durationDays: dto.durationDays || 30,
      status: ExperimentStatus.DRAFT,
      baseline,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    };

    // Sauvegarder dans un JSON temporaire (TODO: table Prisma)
    this.logger.log(
      `✅ Expérience créée: ${experiment.name} (${experimentId})`,
    );

    return experiment;
  }

  /**
   * 📊 Collecter les métriques de baseline (30j avant)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async collectBaselineMetrics(_families: string[]) {
    // TODO: Query Loki pour récupérer crawl stats des 30 derniers jours
    // TODO: Query sitemap actuel pour compter URLs par famille
    // TODO: Query Google Analytics pour trafic organique baseline

    return {
      period: '30d',
      totalUrls: 0,
      avgCrawlRate: 0,
      avgIndexationRate: 0,
      organicSessions: 0,
    };
  }

  /**
   * 📋 Liste des expériences
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listExperiments(_filters: {
    status?: ExperimentStatus;
    limit: number;
  }) {
    // TODO: Récupérer depuis table Prisma ou JSON store
    return [];
  }

  /**
   * 🔍 Détails d'une expérience
   */
  async getExperiment(id: string): Promise<Record<string, unknown>> {
    // TODO: Fetch depuis DB
    throw new NotFoundException(`Experiment ${id} not found`);
  }

  /**
   * 📊 Métriques en temps réel
   */
  async getExperimentMetrics(
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _period: string,
  ): Promise<CrawlBudgetMetrics> {
    // TODO: Collecter depuis Loki + GSC API
    return {
      experimentId: id,
      date: new Date().toISOString(),
      totalCrawledUrls: 0,
      crawlRequestsCount: 0,
      avgCrawlRate: 0,
      indexedUrls: 0,
      indexationRate: 0,
      familyMetrics: [],
    };
  }

  /**
   * 📈 Comparaison avant/pendant/après
   */
  async getComparison(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _experiment = await this.getExperiment(id);

    return {
      baseline: {
        /* métriques 30j avant */
      },
      during: {
        /* métriques pendant expérience */
      },
      after: {
        /* métriques 30j après si complété */
      },
      delta: {
        crawlRateChange: 0,
        indexationRateChange: 0,
        organicSessionsChange: 0,
      },
    };
  }

  /**
   * 🎛️ Changer le statut
   */
  async updateStatus(id: string, status: ExperimentStatus) {
    const experiment = await this.getExperiment(id);

    if (status === ExperimentStatus.RUNNING && !experiment.startedAt) {
      experiment.startedAt = new Date();
    }

    if (status === ExperimentStatus.COMPLETED) {
      experiment.completedAt = new Date();
    }

    experiment.status = status;

    this.logger.log(`🎛️ Expérience ${id} → ${status}`);

    return experiment;
  }

  /**
   * 🗺️ Générer sitemap filtré
   */
  async generateFilteredSitemap(id: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _experiment = await this.getExperiment(id);

    // TODO: Récupérer toutes les URLs du sitemap actuel
    // TODO: Filtrer selon action (exclude/include/reduce)
    // TODO: Générer XML sitemap

    const filteredUrls: string[] = [];

    const xml = this.buildSitemapXml(filteredUrls);

    return xml;
  }

  /**
   * 🏗️ Construire XML sitemap
   */
  private buildSitemapXml(urls: string[]): string {
    const urlsXml = urls
      .map(
        (url) => `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }

  /**
   * 🎯 Recommandations automatiques
   */
  async getRecommendations(id: string) {
    const comparison = await this.getComparison(id);

    const recommendations: {
      action: string;
      reason: string;
      confidence: number;
    }[] = [];

    // Logique de décision
    if (comparison.delta.indexationRateChange > 5) {
      recommendations.push({
        action: 'KEEP_EXCLUSION',
        reason: "L'indexation s'est améliorée de +5%",
        confidence: 0.9,
      });
    }

    if (comparison.delta.organicSessionsChange < -10) {
      recommendations.push({
        action: 'REVERT',
        reason: 'Le trafic organique a chuté de -10%',
        confidence: 0.85,
      });
    }

    if (
      Math.abs(comparison.delta.indexationRateChange) < 2 &&
      Math.abs(comparison.delta.organicSessionsChange) < 5
    ) {
      recommendations.push({
        action: 'NEUTRAL',
        reason: "Pas d'impact significatif détecté",
        confidence: 0.7,
      });
    }

    return recommendations;
  }
}
