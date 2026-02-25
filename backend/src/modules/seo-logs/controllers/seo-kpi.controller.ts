import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage } from '../../../common/utils/error.utils';

const execAsync = promisify(exec);

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
@Controller('seo-logs/kpi')
export class SeoKpiController {
  /**
   * 🤖 KPI: Taux de crawl du sitemap
   *
   * Mesure le % d'URLs du sitemap crawlées dans une fenêtre de temps
   * Objectif: >80% des URLs crawlées en <72h
   *
   * @param timeWindow Fenêtre de temps (ex: 72h, 7d, 30d)
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
    type: String,
    description: 'Fenêtre de temps (72h, 7d, 30d)',
    example: '72h',
  })
  async getCrawlRate(@Query('timeWindow') timeWindow: string = '72h') {
    const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';
    const SITEMAP_URL =
      process.env.SITEMAP_URL || 'https://automecanik.fr/sitemap.xml';

    try {
      // 1. Récupérer les URLs du sitemap
      const { stdout: sitemapXml } = await execAsync(
        `curl -s "${SITEMAP_URL}"`,
      );
      const sitemapUrls = (sitemapXml.match(/<loc>/g) || []).length;

      // 2. Query Loki pour les URLs crawlées
      const logqlQuery = `count(count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [${timeWindow}])) by (path)`;
      const lokiUrl = `${LOKI_URL}/loki/api/v1/query`;

      const { stdout: lokiResponse } = await execAsync(
        `curl -s -G "${lokiUrl}" --data-urlencode "query=${logqlQuery}" --data-urlencode "time=$(date +%s)"`,
      );

      const lokiData = JSON.parse(lokiResponse);
      const crawledUrls = lokiData.data?.result?.length || 0;

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
   * @param timeWindow Fenêtre de temps
   * @param limit Nombre de bots à retourner
   * @returns Top N des bots crawlers
   */
  @Get('top-crawlers')
  @ApiOperation({
    summary: 'Top des crawlers actifs',
    description: 'Liste les bots qui crawlent le plus activement le site',
  })
  @ApiQuery({ name: 'timeWindow', required: false, example: '72h' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getTopCrawlers(
    @Query('timeWindow') timeWindow: string = '72h',
    @Query('limit') limit: number = 10,
  ) {
    const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';

    try {
      const logqlQuery = `topk(${limit}, sum by (bot) (count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [${timeWindow}])))`;
      const lokiUrl = `${LOKI_URL}/loki/api/v1/query`;

      const { stdout: lokiResponse } = await execAsync(
        `curl -s -G "${lokiUrl}" --data-urlencode "query=${logqlQuery}" --data-urlencode "time=$(date +%s)"`,
      );

      const lokiData = JSON.parse(lokiResponse);
      const crawlers: CrawlerEntry[] = (lokiData.data?.result || []).map(
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
  @ApiQuery({ name: 'timeWindow', required: false, example: '72h' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getMostCrawledUrls(
    @Query('timeWindow') timeWindow: string = '72h',
    @Query('limit') limit: number = 20,
  ) {
    const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';

    try {
      const logqlQuery = `topk(${limit}, sum by (path) (count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [${timeWindow}])))`;
      const lokiUrl = `${LOKI_URL}/loki/api/v1/query`;

      const { stdout: lokiResponse } = await execAsync(
        `curl -s -G "${lokiUrl}" --data-urlencode "query=${logqlQuery}" --data-urlencode "time=$(date +%s)"`,
      );

      const lokiData = JSON.parse(lokiResponse);
      const urls = (lokiData.data?.result || []).map(
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
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
