import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  CrawlBudgetOrchestratorService,
  SitemapGeneratorService,
} from '../services/crawl-budget-integrations.service';
import { CrawlBudgetSupabaseService } from '../services/crawl-budget-supabase.service';
import { CrawlBudgetAuditService } from '../services/crawl-budget-audit.service';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  CreateCrawlBudgetExperimentDto,
  CreateCrawlBudgetExperimentSchema,
  UpdateExperimentStatusDto,
  UpdateExperimentStatusSchema,
  ExperimentStatus,
} from '../dto/crawl-budget-experiment.dto';

/**
 * 🧪 A/B Testing du Crawl Budget
 *
 * Permet de créer des expériences pour mesurer l'impact d'inclure/exclure
 * certaines familles de produits sur l'indexation et le trafic organique.
 */
@Controller('seo-logs/crawl-budget')
export class CrawlBudgetExperimentController {
  constructor(
    private readonly orchestrator: CrawlBudgetOrchestratorService,
    private readonly sitemapGen: SitemapGeneratorService,
    private readonly supabase: CrawlBudgetSupabaseService,
    private readonly auditService: CrawlBudgetAuditService,
  ) {}

  /**
   * 🆕 Créer une nouvelle expérience A/B
   */
  @Post('experiments')
  @HttpCode(HttpStatus.CREATED)
  async createExperiment(
    @Body(new ZodValidationPipe(CreateCrawlBudgetExperimentSchema))
    dto: CreateCrawlBudgetExperimentDto,
  ) {
    const experiment = await this.orchestrator.createExperiment(dto);

    return {
      success: true,
      message: 'Expérience créée avec succès',
      data: experiment,
    };
  }

  /**
   * 📋 Liste toutes les expériences
   */
  @Get('experiments')
  async listExperiments(
    @Query('status') status?: ExperimentStatus,
    @Query('limit') limit: number = 20,
  ) {
    const experiments = await this.supabase.listExperiments({
      status: status as string,
      limit,
    });

    return {
      success: true,
      data: experiments,
    };
  }

  /**
   * 🔍 Détails d'une expérience
   */
  @Get('experiments/:id')
  async getExperiment(@Param('id') id: string) {
    const experiment = await this.supabase.getExperiment(id);

    return {
      success: true,
      data: experiment,
    };
  }

  /**
   * 📊 Métriques en temps réel de l'expérience
   */
  @Get('experiments/:id/metrics')
  async getExperimentMetrics(
    @Param('id') id: string,
    @Query('period') period: string = '7d',
  ) {
    const daysAgo = parseInt(period.replace('d', '')) || 7;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const metrics = await this.supabase.getMetrics(id, startDate);

    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * 🎛️ Changer le statut de l'expérience
   */
  @Patch('experiments/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateExperimentStatusSchema))
    dto: UpdateExperimentStatusDto,
  ) {
    const experiment = await this.supabase.updateStatus(id, dto.status);

    return {
      success: true,
      message: `Expérience ${dto.status === 'paused' ? 'mise en pause' : 'reprise'}`,
      data: experiment,
    };
  }

  /**
   * 🗑️ Générer un sitemap filtré pour l'expérience
   */
  @Get('experiments/:id/sitemap.xml')
  async getExperimentSitemap(@Param('id') id: string) {
    const sitemap = await this.sitemapGen.generateFilteredSitemap(id);

    return sitemap; // Raw XML
  }

  /**
   * 🎯 Recommandations basées sur les résultats
   */
  @Get('experiments/:id/recommendations')
  async getRecommendations(@Param('id') id: string) {
    const recommendations = await this.orchestrator.getRecommendations(id);

    return {
      success: true,
      data: recommendations,
    };
  }

  /**
   * 📈 Collecter métriques manuellement
   */
  @Post('experiments/:id/collect-metrics')
  async collectMetrics(@Param('id') id: string) {
    const metric = await this.orchestrator.collectDailyMetrics(id);

    return {
      success: true,
      message: 'Métriques collectées avec succès',
      data: metric,
    };
  }

  /**
   * 📊 Statistiques globales
   */
  @Get('stats')
  async getStats() {
    const stats = await this.supabase.getStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 🔍 Audit de cohérence URLs (App vs GSC vs GA4)
   *
   * Compare les URLs générées par l'app avec les données réelles
   * de Google Search Console et Google Analytics.
   *
   * ⚠️ IMPORTANT : Normalise automatiquement .fr ↔ .com
   */
  @Post('audit')
  async runAudit(
    @Body()
    body: {
      gammeIds?: number[];
      sampleSize?: number;
      domain?: 'com' | 'fr';
    },
  ) {
    const { gammeIds, sampleSize = 1000, domain = 'com' } = body;

    const auditResults = await this.auditService.auditUrlConsistency({
      gammeIds,
      sampleSize,
      domain,
    });

    return {
      success: true,
      message: 'Audit terminé',
      data: auditResults,
    };
  }

  /**
   * 🎯 Audit d'une gamme spécifique
   */
  @Get('audit/gamme/:gammeId')
  async auditGamme(@Param('gammeId') gammeId: string) {
    const results = await this.auditService.auditGamme(parseInt(gammeId, 10));

    return {
      success: true,
      data: results,
    };
  }
}
