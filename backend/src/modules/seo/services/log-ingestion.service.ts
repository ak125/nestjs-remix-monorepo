import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';

export interface CaddyLogEntry {
  timestamp: string;
  request_id: string;
  method: string;
  uri: string;
  status: number;
  duration_ms: number;
  bytes_read: number;
  bytes_written: number;
  user_agent: string;
  referer: string;
  client_ip: string;
  protocol: string;
  tls_version?: string;
  error?: string;
}

export interface SeoLogEntry {
  id: string; // request_id
  timestamp: number; // Unix timestamp pour tri
  url: string; // uri nettoyé
  status: number;
  duration_ms: number;
  referer: string;
  user_agent: string;
  is_bot: boolean; // Détection crawler
  bot_name?: string; // Googlebot, Bingbot, etc.
  is_sitemap: boolean; // URL /sitemap*.xml
  is_robots: boolean; // URL /robots.txt
  response_size: number; // bytes_written
}

export interface LogIngestionStats {
  totalProcessed: number;
  sentToLoki: number;
  indexedInMeilisearch: number;
  errors: number;
  processingTime: number;
}

@Injectable()
export class LogIngestionService {
  private readonly logger = new Logger(LogIngestionService.name);
  private readonly meilisearch: MeiliSearch;
  private readonly lokiUrl: string;
  private readonly caddyLogPath: string;

  constructor(private configService: ConfigService) {
    // Meilisearch client
    this.meilisearch = new MeiliSearch({
      host: this.configService.get<string>(
        'MEILISEARCH_HOST',
        'http://localhost:7700',
      ),
      apiKey: this.configService.get<string>('MEILISEARCH_API_KEY', ''),
    });

    // Loki endpoint
    this.lokiUrl = this.configService.get<string>(
      'LOKI_URL',
      'http://localhost:3100',
    );

    // Caddy logs path
    this.caddyLogPath = this.configService.get<string>(
      'CADDY_LOG_PATH',
      '/var/log/caddy/access.json',
    );
  }

  /**
   * Initialiser l'index Meilisearch pour les logs SEO
   */
  async onModuleInit(): Promise<void> {
    try {
      const index = this.meilisearch.index('access_logs');

      // Configuration de l'index
      await index.updateSettings({
        searchableAttributes: ['path', 'route', 'referer', 'ua'],
        filterableAttributes: [
          'status',
          'method',
          'day',
          'country',
          'brand',
          'gamme',
          'bot',
        ],
        sortableAttributes: ['ts', 'latency_ms'],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],
        faceting: {
          maxValuesPerFacet: 100,
        },
      });

      this.logger.log('✅ Meilisearch index "access_logs" configuré');
    } catch (error) {
      this.logger.error('❌ Erreur init Meilisearch:', error);
    }
  }

  /**
   * Ingérer logs Caddy (appel manuel ou via worker)
   */
  async ingestCaddyLogs(): Promise<LogIngestionStats> {
    const startTime = Date.now();
    this.logger.log('🔄 Démarrage ingestion logs Caddy...');

    const stats: LogIngestionStats = {
      totalProcessed: 0,
      sentToLoki: 0,
      indexedInMeilisearch: 0,
      errors: 0,
      processingTime: 0,
    };

    try {
      // 1. Lire logs Caddy (nouvelles entrées depuis dernier run)
      const logs = await this.readCaddyLogs();
      stats.totalProcessed = logs.length;

      if (logs.length === 0) {
        this.logger.debug('ℹ️ Aucun nouveau log à traiter');
        return stats;
      }

      // 2. Paralléliser : Loki + Meilisearch
      const [lokiResult, meilisearchResult] = await Promise.allSettled([
        this.sendLogsToLoki(logs),
        this.indexLogsInMeilisearch(logs),
      ]);

      // Stats Loki
      if (lokiResult.status === 'fulfilled') {
        stats.sentToLoki = lokiResult.value;
      } else {
        this.logger.error('❌ Erreur envoi Loki:', lokiResult.reason);
        stats.errors++;
      }

      // Stats Meilisearch
      if (meilisearchResult.status === 'fulfilled') {
        stats.indexedInMeilisearch = meilisearchResult.value;
      } else {
        this.logger.error(
          '❌ Erreur indexation Meilisearch:',
          meilisearchResult.reason,
        );
        stats.errors++;
      }

      stats.processingTime = Date.now() - startTime;

      this.logger.log('✅ Ingestion terminée:');
      this.logger.log(`   • Logs traités: ${stats.totalProcessed}`);
      this.logger.log(`   • Envoyés à Loki: ${stats.sentToLoki}`);
      this.logger.log(
        `   • Indexés Meilisearch: ${stats.indexedInMeilisearch}`,
      );
      this.logger.log(`   • Temps: ${stats.processingTime}ms`);

      return stats;
    } catch (error) {
      this.logger.error('❌ Erreur ingestion logs:', error);
      stats.errors++;
      stats.processingTime = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * Lire les logs Caddy (JSON)
   * TODO: Implémenter tail -f avec position cursor
   */
  private async readCaddyLogs(): Promise<CaddyLogEntry[]> {
    // TODO: Lire depuis le fichier avec cursor position
    // Pour l'instant, retour vide (à implémenter avec fs.readFile + tail)

    /*
    const fs = require('fs');
    const readline = require('readline');
    
    const fileStream = fs.createReadStream(this.caddyLogPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    const logs: CaddyLogEntry[] = [];
    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        logs.push(log);
      } catch (error) {
        this.logger.warn(`Invalid JSON line: ${line}`);
      }
    }
    
    return logs;
    */

    this.logger.debug('📡 [TODO] Lecture logs Caddy depuis fichier');
    return [];
  }

  /**
   * Envoyer les logs à Loki (time-series)
   */
  private async sendLogsToLoki(logs: CaddyLogEntry[]): Promise<number> {
    if (logs.length === 0) return 0;

    try {
      // Format Loki : https://grafana.com/docs/loki/latest/api/#push-log-entries-to-loki
      const streams = logs.map((log) => ({
        stream: {
          job: 'caddy',
          environment: this.configService.get('NODE_ENV', 'development'),
          status: log.status.toString(),
          method: log.method,
        },
        values: [
          [
            // Timestamp en nanosecondes
            `${new Date(log.timestamp).getTime()}000000`,
            // Log line (JSON stringifié)
            JSON.stringify({
              request_id: log.request_id,
              uri: log.uri,
              status: log.status,
              duration_ms: log.duration_ms,
              user_agent: log.user_agent,
              referer: log.referer,
              client_ip: log.client_ip,
              error: log.error,
            }),
          ],
        ],
      }));

      const response = await fetch(`${this.lokiUrl}/loki/api/v1/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams }),
      });

      if (!response.ok) {
        throw new Error(`Loki API error: ${response.status}`);
      }

      this.logger.debug(`✅ ${logs.length} logs envoyés à Loki`);
      return logs.length;
    } catch (error) {
      this.logger.error('❌ Erreur envoi Loki:', error);
      throw error;
    }
  }

  /**
   * Indexer les logs dans Meilisearch (recherche SEO)
   * Filtrer : seulement logs pertinents SEO
   */
  private async indexLogsInMeilisearch(logs: CaddyLogEntry[]): Promise<number> {
    if (logs.length === 0) return 0;

    try {
      // Filtrer : seulement URLs SEO importantes
      const seoLogs = logs
        .filter((log) => this.isSeoRelevant(log))
        .map((log) => this.transformToSeoLog(log));

      if (seoLogs.length === 0) {
        this.logger.debug('ℹ️ Aucun log SEO pertinent à indexer');
        return 0;
      }

      const index = this.meilisearch.index('access_logs');
      await index.addDocuments(seoLogs, { primaryKey: 'id' });

      this.logger.debug(`✅ ${seoLogs.length} logs SEO indexés`);
      return seoLogs.length;
    } catch (error) {
      this.logger.error('❌ Erreur indexation Meilisearch:', error);
      throw error;
    }
  }

  /**
   * Filtrer logs pertinents pour SEO
   */
  private isSeoRelevant(log: CaddyLogEntry): boolean {
    // Exclure : assets statiques, API interne
    if (
      log.uri.match(/\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot)$/)
    ) {
      return false;
    }

    if (log.uri.startsWith('/api/') && !log.uri.includes('/sitemap')) {
      return false;
    }

    // Inclure : crawlers, sitemaps, robots.txt, pages publiques
    return (
      this.isBot(log.user_agent) ||
      log.uri.includes('sitemap') ||
      log.uri === '/robots.txt' ||
      log.status === 301 ||
      log.status === 302 ||
      log.status === 404 ||
      log.status === 410
    );
  }

  /**
   * Transformer en entrée SEO log
   */
  private transformToSeoLog(log: CaddyLogEntry): SeoLogEntry {
    const isBot = this.isBot(log.user_agent);
    const botName = isBot ? this.detectBotName(log.user_agent) : undefined;

    return {
      id: log.request_id,
      timestamp: new Date(log.timestamp).getTime(),
      url: log.uri,
      status: log.status,
      duration_ms: log.duration_ms,
      referer: log.referer || '',
      user_agent: log.user_agent,
      is_bot: isBot,
      bot_name: botName,
      is_sitemap: log.uri.includes('sitemap'),
      is_robots: log.uri === '/robots.txt',
      response_size: log.bytes_written,
    };
  }

  /**
   * Détecter si user-agent est un bot
   */
  private isBot(userAgent: string): boolean {
    const botPatterns = [
      'googlebot',
      'bingbot',
      'slurp', // Yahoo
      'duckduckbot',
      'baiduspider',
      'yandexbot',
      'sogou',
      'exabot',
      'facebot',
      'ia_archiver', // Alexa
      'semrushbot',
      'ahrefsbot',
      'dotbot',
      'mj12bot',
      'crawler',
      'spider',
      'bot',
    ];

    const ua = userAgent.toLowerCase();
    return botPatterns.some((pattern) => ua.includes(pattern));
  }

  /**
   * Détecter le nom du bot
   */
  private detectBotName(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('googlebot')) return 'Googlebot';
    if (ua.includes('bingbot')) return 'Bingbot';
    if (ua.includes('slurp')) return 'Yahoo';
    if (ua.includes('duckduckbot')) return 'DuckDuckBot';
    if (ua.includes('baiduspider')) return 'Baidu';
    if (ua.includes('yandexbot')) return 'Yandex';
    if (ua.includes('facebot')) return 'Facebook';
    if (ua.includes('semrushbot')) return 'SEMrush';
    if (ua.includes('ahrefsbot')) return 'Ahrefs';

    return 'Unknown Bot';
  }

  /**
   * Rechercher dans les logs SEO (API publique)
   */
  async searchSeoLogs(query: {
    q?: string;
    status?: number;
    method?: string;
    day?: string;
    country?: string;
    brand?: string;
    gamme?: string;
    bot?: string;
    from?: number; // timestamp
    to?: number; // timestamp
    limit?: number;
    offset?: number;
  }) {
    try {
      const index = this.meilisearch.index('access_logs');

      // Construire filtres
      const filters: string[] = [];

      if (query.status) {
        filters.push(`status = ${query.status}`);
      }

      if (query.method) {
        filters.push(`method = "${query.method}"`);
      }

      if (query.day) {
        filters.push(`day = "${query.day}"`);
      }

      if (query.country) {
        filters.push(`country = "${query.country}"`);
      }

      if (query.brand) {
        filters.push(`brand = "${query.brand}"`);
      }

      if (query.gamme) {
        filters.push(`gamme = "${query.gamme}"`);
      }

      if (query.bot) {
        filters.push(`bot = "${query.bot}"`);
      }

      if (query.from) {
        filters.push(`ts >= ${query.from}`);
      }

      if (query.to) {
        filters.push(`ts <= ${query.to}`);
      }

      const results = await index.search(query.q || '', {
        filter: filters.length > 0 ? filters : undefined,
        limit: query.limit || 100,
        offset: query.offset || 0,
        sort: ['ts:desc'],
        facets: ['status', 'method', 'country', 'brand', 'gamme', 'bot'],
      });

      return {
        hits: results.hits,
        total: results.estimatedTotalHits,
        facets: results.facetDistribution,
        processingTime: results.processingTimeMs,
        query: query.q,
      };
    } catch (error) {
      this.logger.error('❌ Erreur recherche logs SEO:', error);
      throw error;
    }
  }

  /**
   * Analytics : Top URLs crawlées
   */
  async getTopCrawledUrls(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _limit = 20,
  ): Promise<Array<{ url: string; count: number }>> {
    // TODO: Implémenter avec aggregation Meilisearch ou query directe
    // Pour l'instant, retour vide
    this.logger.debug('📡 [TODO] Top URLs crawlées');
    return [];
  }

  /**
   * Analytics : Top bots
   */
  async getTopBots(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _limit = 10,
  ): Promise<Array<{ bot_name: string; count: number }>> {
    this.logger.debug('📡 [TODO] Top bots');
    return [];
  }

  /**
   * Analytics : Erreurs 4xx/5xx récentes
   */
  async getRecentErrors(limit = 50) {
    try {
      const index = this.meilisearch.index('access_logs');

      const results = await index.search('', {
        filter: 'status >= 400',
        limit,
        sort: ['ts:desc'],
      });

      return {
        errors: results.hits,
        total: results.estimatedTotalHits,
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération erreurs:', error);
      throw error;
    }
  }

  /**
   * Analytics : Dashboard trafic e-commerce
   */
  async getTrafficAnalytics(period: 'today' | 'yesterday' | '7days' | '30days' = 'today') {
    try {
      const index = this.meilisearch.index('access_logs');
      
      // Calculer le filtre de date
      let dayFilter: string;
      const today = new Date().toISOString().split('T')[0];
      
      switch (period) {
        case 'yesterday':
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          dayFilter = `day = "${yesterday}"`;
          break;
        case '7days':
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
          dayFilter = `day >= "${sevenDaysAgo}"`;
          break;
        case '30days':
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
          dayFilter = `day >= "${thirtyDaysAgo}"`;
          break;
        default: // today
          dayFilter = `day = "${today}"`;
      }

      // Requêtes parallèles pour les différentes facettes
      const [brandsResult, gammesResult, countriesResult, botsResult, statusResult, methodResult] = await Promise.all([
        // Top brands
        index.search('', {
          filter: `${dayFilter} AND brand EXISTS`,
          facets: ['brand'],
          limit: 0,
        }),
        // Top gammes
        index.search('', {
          filter: `${dayFilter} AND gamme EXISTS`,
          facets: ['gamme'],
          limit: 0,
        }),
        // Distribution pays
        index.search('', {
          filter: `${dayFilter} AND country EXISTS`,
          facets: ['country'],
          limit: 0,
        }),
        // Bots vs humains
        index.search('', {
          filter: dayFilter,
          facets: ['bot'],
          limit: 0,
        }),
        // Statuts HTTP
        index.search('', {
          filter: dayFilter,
          facets: ['status'],
          limit: 0,
        }),
        // Méthodes HTTP
        index.search('', {
          filter: dayFilter,
          facets: ['method'],
          limit: 0,
        }),
      ]);

      // Top combos brand + gamme
      const combosResult = await index.search('', {
        filter: `${dayFilter} AND brand EXISTS AND gamme EXISTS`,
        limit: 1000,
        attributesToRetrieve: ['brand', 'gamme'],
      });

      // Calculer les combos
      const combos = new Map<string, number>();
      combosResult.hits.forEach((hit: any) => {
        const key = `${hit.brand}|${hit.gamme}`;
        combos.set(key, (combos.get(key) || 0) + 1);
      });

      const topCombos = Array.from(combos.entries())
        .map(([combo, count]) => {
          const [brand, gamme] = combo.split('|');
          return { brand, gamme, hits: count };
        })
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 15);

      // Calculer bots vs humains
      const botHits = Object.values(botsResult.facetDistribution?.bot || {})
        .reduce((sum: number, val: any) => sum + val, 0);
      const totalHits = botsResult.estimatedTotalHits || 0;
      const humanHits = totalHits - botHits;

      return {
        period,
        totalHits,
        topBrands: Object.entries(brandsResult.facetDistribution?.brand || {})
          .map(([brand, count]) => ({ brand, hits: count }))
          .sort((a, b) => (b.hits as number) - (a.hits as number))
          .slice(0, 15),
        topGammes: Object.entries(gammesResult.facetDistribution?.gamme || {})
          .map(([gamme, count]) => ({ gamme, hits: count }))
          .sort((a, b) => (b.hits as number) - (a.hits as number))
          .slice(0, 15),
        topCountries: Object.entries(countriesResult.facetDistribution?.country || {})
          .map(([country, count]) => ({ country, hits: count }))
          .sort((a, b) => (b.hits as number) - (a.hits as number))
          .slice(0, 10),
        topCombos,
        traffic: {
          human: humanHits,
          bots: botHits,
          humanPercent: totalHits > 0 ? Math.round((humanHits / totalHits) * 100) : 0,
          botsPercent: totalHits > 0 ? Math.round((botHits / totalHits) * 100) : 0,
        },
        topBots: Object.entries(botsResult.facetDistribution?.bot || {})
          .map(([bot, count]) => ({ bot, hits: count }))
          .sort((a, b) => (b.hits as number) - (a.hits as number))
          .slice(0, 10),
        statusDistribution: Object.entries(statusResult.facetDistribution?.status || {})
          .map(([status, count]) => ({ status: parseInt(status), hits: count }))
          .sort((a, b) => a.status - b.status),
        methodDistribution: Object.entries(methodResult.facetDistribution?.method || {})
          .map(([method, count]) => ({ method, hits: count }))
          .sort((a, b) => (b.hits as number) - (a.hits as number)),
      };
    } catch (error) {
      this.logger.error('❌ Erreur analytics trafic:', error);
      throw error;
    }
  }

  /**
   * Analytics : Chemins lents (> seuil latence)
   */
  async getSlowPaths(thresholdMs = 800, limit = 50, day?: string) {
    try {
      const index = this.meilisearch.index('access_logs');
      
      const today = day || new Date().toISOString().split('T')[0];
      
      const results = await index.search('', {
        filter: `latency_ms >= ${thresholdMs} AND day = "${today}"`,
        limit: 1000,
        sort: ['latency_ms:desc'],
        attributesToRetrieve: ['path', 'route', 'latency_ms', 'status', 'method', 'brand', 'gamme', 'country', 'bot'],
        facets: ['route', 'brand', 'status', 'method'],
      });

      // Statistiques globales
      const latencies = results.hits.map((hit: any) => hit.latency_ms).filter((l: number) => l);
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      
      const stats = {
        total: results.estimatedTotalHits,
        avgLatency: latencies.length > 0 ? Math.floor(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
        p50: sortedLatencies[Math.floor(sortedLatencies.length * 0.50)] || 0,
        p95: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
        p99: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0,
        maxLatency: Math.max(...latencies, 0),
      };

      // Grouper par route pour calculer stats par route
      const routeGroups = new Map<string, number[]>();
      results.hits.forEach((hit: any) => {
        const route = hit.route || 'unknown';
        if (!routeGroups.has(route)) {
          routeGroups.set(route, []);
        }
        if (hit.latency_ms) {
          routeGroups.get(route)!.push(hit.latency_ms);
        }
      });

      const topSlowRoutes = Array.from(routeGroups.entries())
        .map(([route, latencies]) => {
          const sorted = [...latencies].sort((a, b) => a - b);
          return {
            route,
            count: latencies.length,
            avgLatency: Math.floor(latencies.reduce((a, b) => a + b, 0) / latencies.length),
            p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
            maxLatency: Math.max(...latencies),
          };
        })
        .sort((a, b) => b.avgLatency - a.avgLatency)
        .slice(0, 10);

      return {
        threshold: thresholdMs,
        day: today,
        stats,
        topSlowPaths: results.hits.slice(0, limit),
        topSlowRoutes,
        byBrand: results.facetDistribution?.brand || {},
        byStatus: results.facetDistribution?.status || {},
        byMethod: results.facetDistribution?.method || {},
      };
    } catch (error) {
      this.logger.error('❌ Erreur chemins lents:', error);
      throw error;
    }
  }

  /**
   * Analytics : Hits par bot
   */
  async getBotHits(botName?: string, limit = 100, offset = 0) {
    try {
      const index = this.meilisearch.index('access_logs');
      
      const filter = botName ? `bot = "${botName}"` : 'bot EXISTS';
      
      const results = await index.search('', {
        filter,
        limit,
        offset,
        sort: ['ts:desc'],
        attributesToRetrieve: ['ts', 'bot', 'path', 'status', 'method', 'brand', 'gamme', 'country', 'latency_ms', 'referer'],
        facets: ['bot', 'status', 'brand', 'country'],
      });

      return {
        filter: botName || 'all_bots',
        total: results.estimatedTotalHits,
        processingTime: results.processingTimeMs,
        hits: results.hits,
        facets: {
          bots: results.facetDistribution?.bot || {},
          status: results.facetDistribution?.status || {},
          brands: results.facetDistribution?.brand || {},
          countries: results.facetDistribution?.country || {},
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur bot hits:', error);
      throw error;
    }
  }
}
