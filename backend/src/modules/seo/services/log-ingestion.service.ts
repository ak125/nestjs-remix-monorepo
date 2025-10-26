import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
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
      const index = this.meilisearch.index('seo_logs');

      // Configuration de l'index
      await index.updateSettings({
        searchableAttributes: ['url', 'referer', 'user_agent', 'bot_name'],
        filterableAttributes: [
          'status',
          'is_bot',
          'is_sitemap',
          'is_robots',
          'timestamp',
          'bot_name',
        ],
        sortableAttributes: ['timestamp', 'duration_ms', 'response_size'],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],
      });

      this.logger.log('✅ Meilisearch index "seo_logs" configuré');
    } catch (error) {
      this.logger.error('❌ Erreur init Meilisearch:', error);
    }
  }

  /**
   * Cron job : Ingérer logs Caddy toutes les 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'ingest-caddy-logs',
    timeZone: 'Europe/Paris',
  })
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

      const index = this.meilisearch.index('seo_logs');
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
    is_bot?: boolean;
    bot_name?: string;
    is_sitemap?: boolean;
    from?: number; // timestamp
    to?: number; // timestamp
    limit?: number;
    offset?: number;
  }) {
    try {
      const index = this.meilisearch.index('seo_logs');

      // Construire filtres
      const filters: string[] = [];

      if (query.status) {
        filters.push(`status = ${query.status}`);
      }

      if (query.is_bot !== undefined) {
        filters.push(`is_bot = ${query.is_bot}`);
      }

      if (query.bot_name) {
        filters.push(`bot_name = "${query.bot_name}"`);
      }

      if (query.is_sitemap !== undefined) {
        filters.push(`is_sitemap = ${query.is_sitemap}`);
      }

      if (query.from) {
        filters.push(`timestamp >= ${query.from}`);
      }

      if (query.to) {
        filters.push(`timestamp <= ${query.to}`);
      }

      const results = await index.search(query.q || '', {
        filter: filters.length > 0 ? filters : undefined,
        limit: query.limit || 100,
        offset: query.offset || 0,
        sort: ['timestamp:desc'],
      });

      return {
        hits: results.hits,
        total: results.estimatedTotalHits,
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
      const index = this.meilisearch.index('seo_logs');

      const results = await index.search('', {
        filter: 'status >= 400',
        limit,
        sort: ['timestamp:desc'],
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
}
