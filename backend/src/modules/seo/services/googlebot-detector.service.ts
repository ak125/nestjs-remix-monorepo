/**
 * GooglebotDetectorService - Detection et logging des crawls Googlebot
 *
 * Objectif: Logging passif uniquement, PAS d'actions automatiques
 *
 * Features:
 * - Détection user-agent Googlebot
 * - Logging dans __seo_crawl_log
 * - Mise à jour __seo_index_status.last_crawl_at
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface GooglebotInfo {
  isGooglebot: boolean;
  botName: string | null;
  userAgent: string;
  clientIp: string;
}

export interface CrawlLogEntry {
  url: string;
  userAgent: string;
  botName: string | null;
  isGooglebot: boolean;
  statusCode: number;
  responseMs?: number;
  bytesSent?: number;
  contentType?: string;
  referer?: string;
  requestMethod?: string;
}

interface CrawlStats {
  last24h: number;
  last7d: number;
  uniqueUrls24h: number;
  avgResponseMs: number;
}

@Injectable()
export class GooglebotDetectorService {
  private readonly logger = new Logger(GooglebotDetectorService.name);
  private readonly supabase: SupabaseClient;

  // Patterns for bot detection (reused from LogIngestionService)
  private readonly googlebotPatterns = [
    'googlebot',
    'googlebot-image',
    'googlebot-news',
    'googlebot-video',
    'google-inspectiontool',
    'storebot-google',
    'google-extended',
    'adsbot-google',
    'mediapartners-google',
    'apis-google',
  ];

  private readonly otherBotPatterns = [
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
  ];

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '');
  }

  /**
   * Detect if request is from Googlebot
   */
  detectGooglebot(
    userAgent: string,
    clientIp: string = 'unknown',
  ): GooglebotInfo {
    const ua = userAgent.toLowerCase();
    const isGooglebot = this.googlebotPatterns.some((pattern) =>
      ua.includes(pattern),
    );
    const botName = this.detectBotName(ua);

    return {
      isGooglebot,
      botName,
      userAgent,
      clientIp,
    };
  }

  /**
   * Check if user-agent is any known bot
   */
  isBot(userAgent: string): boolean {
    const ua = userAgent.toLowerCase();
    const allPatterns = [
      ...this.googlebotPatterns,
      ...this.otherBotPatterns,
      'crawler',
      'spider',
      'bot',
    ];
    return allPatterns.some((pattern) => ua.includes(pattern));
  }

  /**
   * Detect specific bot name from user-agent
   */
  detectBotName(userAgent: string): string | null {
    const ua = userAgent.toLowerCase();

    // Googlebot variants
    if (ua.includes('googlebot-image')) return 'Googlebot-Image';
    if (ua.includes('googlebot-news')) return 'Googlebot-News';
    if (ua.includes('googlebot-video')) return 'Googlebot-Video';
    if (ua.includes('storebot-google')) return 'Storebot-Google';
    if (ua.includes('adsbot-google')) return 'AdsBot-Google';
    if (ua.includes('googlebot')) return 'Googlebot';

    // Other bots
    if (ua.includes('bingbot')) return 'Bingbot';
    if (ua.includes('slurp')) return 'Yahoo';
    if (ua.includes('duckduckbot')) return 'DuckDuckBot';
    if (ua.includes('baiduspider')) return 'Baidu';
    if (ua.includes('yandexbot')) return 'Yandex';
    if (ua.includes('facebot')) return 'Facebook';
    if (ua.includes('semrushbot')) return 'SEMrush';
    if (ua.includes('ahrefsbot')) return 'Ahrefs';

    // Generic
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'Unknown Bot';
    }

    return null;
  }

  /**
   * Log crawl to __seo_crawl_log and update __seo_index_status
   */
  async logCrawl(entry: CrawlLogEntry): Promise<void> {
    try {
      // 1. Insert into __seo_crawl_log
      const { error: crawlError } = await this.supabase
        .from('__seo_crawl_log')
        .insert({
          url: entry.url,
          user_agent: entry.userAgent,
          bot_name: entry.botName,
          is_googlebot: entry.isGooglebot,
          status_code: entry.statusCode,
          response_ms: entry.responseMs,
          bytes_sent: entry.bytesSent,
          content_type: entry.contentType,
          referer: entry.referer,
          request_method: entry.requestMethod || 'GET',
          crawled_at: new Date().toISOString(),
        });

      if (crawlError) {
        this.logger.error(
          `Failed to log crawl: ${crawlError.message}`,
          crawlError,
        );
      }

      // 2. If Googlebot, update __seo_index_status.last_crawl_at
      if (entry.isGooglebot && entry.statusCode === 200) {
        await this.updateIndexStatus(entry.url);
      }
    } catch (error) {
      this.logger.error(
        `Error logging crawl: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Update index_status when Googlebot crawls successfully
   */
  private async updateIndexStatus(url: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('__seo_index_status').upsert(
        {
          url,
          last_crawl_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'url',
        },
      );

      if (error) {
        this.logger.debug(`Failed to update index status: ${error.message}`);
      }
    } catch (error) {
      this.logger.debug(
        `Error updating index status: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Get crawl statistics for dashboard
   */
  async getCrawlStats(): Promise<CrawlStats> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Count last 24h
      const { count: count24h } = await this.supabase
        .from('__seo_crawl_log')
        .select('*', { count: 'exact', head: true })
        .eq('is_googlebot', true)
        .gte('crawled_at', yesterday.toISOString());

      // Count last 7 days
      const { count: count7d } = await this.supabase
        .from('__seo_crawl_log')
        .select('*', { count: 'exact', head: true })
        .eq('is_googlebot', true)
        .gte('crawled_at', lastWeek.toISOString());

      // Unique URLs last 24h
      const { data: uniqueData } = await this.supabase.rpc(
        'count_distinct_crawled_urls',
        { since: yesterday.toISOString() },
      );

      // Average response time
      const { data: avgData } = await this.supabase
        .from('__seo_crawl_log')
        .select('response_ms')
        .eq('is_googlebot', true)
        .gte('crawled_at', yesterday.toISOString())
        .not('response_ms', 'is', null)
        .limit(1000);

      const avgResponseMs =
        avgData && avgData.length > 0
          ? avgData.reduce((sum, r) => sum + (r.response_ms || 0), 0) /
            avgData.length
          : 0;

      return {
        last24h: count24h || 0,
        last7d: count7d || 0,
        uniqueUrls24h: uniqueData || 0,
        avgResponseMs: Math.round(avgResponseMs),
      };
    } catch (error) {
      this.logger.error(
        `Error getting crawl stats: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return {
        last24h: 0,
        last7d: 0,
        uniqueUrls24h: 0,
        avgResponseMs: 0,
      };
    }
  }

  /**
   * Get recent Googlebot crawls
   */
  async getRecentCrawls(limit: number = 50): Promise<CrawlLogEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('__seo_crawl_log')
        .select('*')
        .eq('is_googlebot', true)
        .order('crawled_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(`Failed to get recent crawls: ${error.message}`);
        return [];
      }

      return (data || []).map((row) => ({
        url: row.url,
        userAgent: row.user_agent,
        botName: row.bot_name,
        isGooglebot: row.is_googlebot,
        statusCode: row.status_code,
        responseMs: row.response_ms,
        bytesSent: row.bytes_sent,
        contentType: row.content_type,
        referer: row.referer,
        requestMethod: row.request_method,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting recent crawls: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }

  /**
   * Get URLs not crawled by Googlebot in X days
   */
  async getUrlsNotCrawled(
    days: number = 14,
    limit: number = 100,
  ): Promise<
    {
      url: string;
      lastCrawlAt: Date | null;
      daysSinceLastCrawl: number;
    }[]
  > {
    try {
      const cutoffDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await this.supabase
        .from('__seo_index_status')
        .select('url, last_crawl_at')
        .eq('is_indexed', true)
        .or(`last_crawl_at.lt.${cutoffDate},last_crawl_at.is.null`)
        .limit(limit);

      if (error) {
        this.logger.error(`Failed to get uncrawled URLs: ${error.message}`);
        return [];
      }

      const now = Date.now();
      return (data || []).map((row) => {
        const lastCrawl = row.last_crawl_at
          ? new Date(row.last_crawl_at)
          : null;
        const daysSince = lastCrawl
          ? Math.floor((now - lastCrawl.getTime()) / (24 * 60 * 60 * 1000))
          : 999;
        return {
          url: row.url,
          lastCrawlAt: lastCrawl,
          daysSinceLastCrawl: daysSince,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting uncrawled URLs: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }
}
