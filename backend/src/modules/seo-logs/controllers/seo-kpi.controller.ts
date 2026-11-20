import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { getErrorMessage } from '@common/utils/error.utils';
import { StrictZodQueryValidationPipe } from '@common/pipes/strict-zod-query-validation.pipe';
import {
  SEO_KPI_MOST_CRAWLED_URLS_MAX_LIMIT,
  SEO_KPI_TIME_WINDOWS,
  SEO_KPI_TOP_CRAWLERS_MAX_LIMIT,
  SeoKpiCrawlRateQuerySchema,
  SeoKpiMostCrawledUrlsQuerySchema,
  SeoKpiTopCrawlersQuerySchema,
  type SeoKpiCrawlRateQueryDto,
  type SeoKpiMostCrawledUrlsQueryDto,
  type SeoKpiTopCrawlersQueryDto,
} from '../dto/seo-logs-query.schema';

// Paramètres de requête validés avant l'entrée dans la route : toute valeur
// hors contrat reçoit un 400. Voir `../dto/seo-logs-query.schema.ts`.
const crawlRateQueryPipe = new StrictZodQueryValidationPipe(
  SeoKpiCrawlRateQuerySchema,
);
const topCrawlersQueryPipe = new StrictZodQueryValidationPipe(
  SeoKpiTopCrawlersQuerySchema,
);
const mostCrawledUrlsQueryPipe = new StrictZodQueryValidationPipe(
  SeoKpiMostCrawledUrlsQuerySchema,
);

// Délais bornés des appels sortants (cibles fixes, lues dans la configuration).
const SITEMAP_FETCH_TIMEOUT_MS = 15_000;
const LOKI_QUERY_TIMEOUT_MS = 30_000;

interface LokiResultRow {
  metric: Record<string, string>;
  value: [string, string];
  [key: string]: unknown;
}

interface CrawlerEntry {
  name: string;
  hits: number;
  percentage: number;
  [key: string]: unknown;
}

/**
 * 📊 Contrôleur pour les KPIs SEO avancés
 *
 * Analyse les logs de crawl et génère des métriques SEO
 */
@ApiTags('SEO Analytics')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@Controller('seo-logs/kpi')
export class SeoKpiController {
  private readonly logger = new Logger(SeoKpiController.name);

  /**
   * GET HTTP vers une cible fixe : délai borné, redirection non suivie.
   * Un statut hors 2xx est une erreur, jamais un résultat vide.
   */
  private async fetchText(
    target: URL,
    label: string,
    timeoutMs: number,
  ): Promise<string> {
    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`${label} : réponse HTTP ${response.status}`);
    }
    return response.text();
  }

  /**
   * Requête instantanée Loki. L'hôte et le chemin viennent de la
   * configuration (`LOKI_URL`) ; la requête LogQL part en paramètre d'URL
   * encodé.
   */
  private async queryLoki(logqlQuery: string): Promise<LokiResultRow[]> {
    const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';
    const target = new URL(`${LOKI_URL}/loki/api/v1/query`);
    target.searchParams.set('query', logqlQuery);
    target.searchParams.set('time', String(Math.floor(Date.now() / 1000)));

    const body = await this.fetchText(target, 'Loki', LOKI_QUERY_TIMEOUT_MS);
    return JSON.parse(body).data?.result || [];
  }

  /**
   * 🤖 KPI: Taux de crawl du sitemap
   *
   * Mesure le % d'URLs du sitemap crawlées dans une fenêtre de temps
   * Objectif: >80% des URLs crawlées en <72h
   *
   * @param query.timeWindow Fenêtre de temps (24h, 72h, 7d, 30d)
   * @returns KPI de taux de crawl
   */
  @Get('crawl-rate')
  @ApiOperation({
    summary: 'Taux de crawl du sitemap',
    description:
      "Calcule le % d'URLs du sitemap crawlées par les moteurs de recherche dans une fenêtre de temps donnée",
  })
  @ApiQuery({
    name: 'timeWindow',
    required: false,
    enum: SEO_KPI_TIME_WINDOWS,
    description: 'Fenêtre de temps (liste fermée ; autre valeur : 400)',
    example: '72h',
  })
  async getCrawlRate(
    @Query(crawlRateQueryPipe) { timeWindow }: SeoKpiCrawlRateQueryDto,
  ) {
    const SITEMAP_URL =
      process.env.SITEMAP_URL || 'https://automecanik.fr/sitemap.xml';

    try {
      // 1. Récupérer les URLs du sitemap
      const sitemapXml = await this.fetchText(
        new URL(SITEMAP_URL),
        'Sitemap',
        SITEMAP_FETCH_TIMEOUT_MS,
      );
      const sitemapUrls = (sitemapXml.match(/<loc>/g) || []).length;

      // 2. Query Loki pour les URLs crawlées
      const logqlQuery = `count(count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [${timeWindow}])) by (path)`;
      const crawledUrls = (await this.queryLoki(logqlQuery)).length;

      // 3. Calculer le KPI
      const crawlRate = sitemapUrls > 0 ? (crawledUrls / sitemapUrls) * 100 : 0;

      // 4. Évaluation
      let status: 'excellent' | 'good' | 'warning' | 'critical';
      let recommendation: string;

      if (crawlRate >= 80) {
        status = 'excellent';
        recommendation =
          'Excellent taux de crawl! Les moteurs de recherche indexent activement votre site.';
      } else if (crawlRate >= 60) {
        status = 'good';
        recommendation =
          'Bon taux de crawl. Continuez à mettre à jour régulièrement votre sitemap.';
      } else if (crawlRate >= 40) {
        status = 'warning';
        recommendation =
          'Taux de crawl moyen. Recommandations: soumettez le sitemap à Google Search Console, améliorez le temps de chargement.';
      } else {
        status = 'critical';
        recommendation =
          'Taux de crawl faible! Actions urgentes: vérifiez robots.txt, soumettez le sitemap, améliorez les performances.';
      }

      return {
        success: true,
        data: {
          timeWindow,
          sitemap: {
            url: SITEMAP_URL,
            totalUrls: sitemapUrls,
          },
          crawl: {
            crawledUrls,
            crawlRate: Number(crawlRate.toFixed(2)),
            status,
            threshold: 80,
          },
          evaluation: {
            status,
            recommendation,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.warn(
        `KPI crawl-rate indisponible (${timeWindow}) : ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
        message: 'Erreur lors du calcul du KPI de crawl',
      };
    }
  }

  /**
   * 🤖 Top crawlers actifs
   *
   * Liste les bots qui ont le plus crawlé le site
   *
   * @param query.timeWindow Fenêtre de temps (24h, 72h, 7d, 30d)
   * @param query.limit Nombre de bots à retourner (1 à 50)
   * @returns Top N des bots crawlers
   */
  @Get('top-crawlers')
  @ApiOperation({
    summary: 'Top des crawlers actifs',
    description: 'Liste les bots qui crawlent le plus activement le site',
  })
  @ApiQuery({
    name: 'timeWindow',
    required: false,
    enum: SEO_KPI_TIME_WINDOWS,
    example: '72h',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: SEO_KPI_TOP_CRAWLERS_MAX_LIMIT,
    example: 10,
  })
  async getTopCrawlers(
    @Query(topCrawlersQueryPipe)
    { timeWindow, limit }: SeoKpiTopCrawlersQueryDto,
  ) {
    try {
      const logqlQuery = `topk(${limit}, sum by (bot) (count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [${timeWindow}])))`;

      const crawlers: CrawlerEntry[] = (await this.queryLoki(logqlQuery)).map(
        (r: LokiResultRow, index: number) => ({
          name: r.metric.bot,
          rank: index + 1,
          bot: r.metric.bot,
          hits: parseInt(r.value[1]),
          percentage: 0, // Calculé après
        }),
      );

      // Calculer les pourcentages
      const totalHits = crawlers.reduce(
        (sum: number, c: CrawlerEntry) => sum + c.hits,
        0,
      );
      crawlers.forEach((c: CrawlerEntry) => {
        c.percentage = Number(((c.hits / totalHits) * 100).toFixed(2));
      });

      return {
        success: true,
        data: {
          timeWindow,
          totalCrawlers: crawlers.length,
          totalHits,
          crawlers,
        },
      };
    } catch (error) {
      this.logger.warn(
        `KPI top-crawlers indisponible (${timeWindow}) : ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * 📄 URLs les plus crawlées
   *
   * Liste des pages les plus visitées par les crawlers
   */
  @Get('most-crawled-urls')
  @ApiOperation({
    summary: 'URLs les plus crawlées',
    description: "Pages qui attirent le plus l'attention des crawlers",
  })
  @ApiQuery({
    name: 'timeWindow',
    required: false,
    enum: SEO_KPI_TIME_WINDOWS,
    example: '72h',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: SEO_KPI_MOST_CRAWLED_URLS_MAX_LIMIT,
    example: 20,
  })
  async getMostCrawledUrls(
    @Query(mostCrawledUrlsQueryPipe)
    { timeWindow, limit }: SeoKpiMostCrawledUrlsQueryDto,
  ) {
    try {
      const logqlQuery = `topk(${limit}, sum by (path) (count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [${timeWindow}])))`;

      const urls = (await this.queryLoki(logqlQuery)).map(
        (r: LokiResultRow, index: number) => ({
          rank: index + 1,
          path: r.metric.path,
          crawls: parseInt(r.value[1]),
        }),
      );

      return {
        success: true,
        data: {
          timeWindow,
          totalUrls: urls.length,
          urls,
        },
      };
    } catch (error) {
      this.logger.warn(
        `KPI most-crawled-urls indisponible (${timeWindow}) : ${getErrorMessage(error)}`,
      );
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
