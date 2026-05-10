/**
 * 📊 SERVICE DATA SITEMAP V10 - Data fetching, caching, pagination
 *
 * Responsabilités:
 * - Récupération des gammes INDEX (avec cache)
 * - Pagination générique Supabase (bypass limite 1000)
 * - Récupération d'URLs par type d'entité (scoring)
 * - Logging d'audit (__seo_generation_log)
 * - Gestion du cache de déduplication inter-familles
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import {
  type TemperatureBucket,
  type SitemapUrl,
  type EntityType,
  BUCKET_CONFIG,
  ENTITY_PAGE_TYPES,
  MAX_URLS_PER_FILE,
} from './sitemap-v10.types';

@Injectable()
export class SitemapV10DataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10DataService.name);

  // Cache des pg_id INDEX (évite double requête DB)
  private indexPgIdsCache: Set<string> | null = null;

  // Cache global pour déduplication inter-familles
  private processedUrlsCache: Set<string> | null = null;

  constructor(configService: ConfigService, rpcGate: RpcGateService) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  /**
   * Reset tous les caches (appelé en début de génération)
   */
  resetCaches(): void {
    this.indexPgIdsCache = null;
    this.processedUrlsCache = null;
  }

  /**
   * Initialise le cache de déduplication inter-familles
   */
  initDeduplicationCache(): void {
    this.processedUrlsCache = new Set<string>();
  }

  /**
   * Retourne le cache de déduplication (pour usage par PiecesService)
   */
  getProcessedUrlsCache(): Set<string> | null {
    return this.processedUrlsCache;
  }

  /**
   * Libère la mémoire des caches (après génération)
   */
  clearCaches(): void {
    this.indexPgIdsCache = null;
    this.processedUrlsCache = null;
  }

  /**
   * 🎯 Récupère les pg_id des gammes INDEX (avec cache) - LOGIQUE V9
   */
  async getIndexGammeIds(): Promise<Set<string>> {
    if (this.indexPgIdsCache) {
      return this.indexPgIdsCache;
    }

    const { data: indexGammes, error } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id')
      .eq('pg_display', '1')
      .eq('pg_relfollow', '1');

    if (error) {
      this.logger.error(`❌ Error fetching INDEX gammes: ${error.message}`);
      return new Set();
    }

    this.indexPgIdsCache = new Set(
      (indexGammes || []).map((g) => String(g.pg_id)),
    );
    this.logger.log(`  🎯 ${this.indexPgIdsCache.size} gammes INDEX en cache`);

    return this.indexPgIdsCache;
  }

  /**
   * 📄 Récupère des données avec pagination - LOGIQUE V9
   * Contourne la limite Supabase de 1000 lignes
   */
  async fetchWithPagination<T>(
    table: string,
    columns: string,
    totalLimit: number,
    startOffset = 0,
    filter?: {
      column: string;
      operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
      value: number | string;
    },
  ): Promise<T[]> {
    const PAGE_SIZE = 1000;
    const allData: T[] = [];
    let currentOffset = startOffset;
    let fetchedCount = 0;

    while (fetchedCount < totalLimit) {
      const remaining = totalLimit - fetchedCount;
      const batchSize = Math.min(PAGE_SIZE, remaining);

      let query = this.supabase.from(table).select(columns);

      if (filter) {
        switch (filter.operator) {
          case 'gt':
            query = query.gt(filter.column, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.column, filter.value);
            break;
          case 'lt':
            query = query.lt(filter.column, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.column, filter.value);
            break;
          case 'eq':
            query = query.eq(filter.column, filter.value);
            break;
          case 'neq':
            query = query.neq(filter.column, filter.value);
            break;
        }
      }

      const { data, error } = await query.range(
        currentOffset,
        currentOffset + batchSize - 1,
      );

      if (error) {
        this.logger.error(
          `❌ Pagination error on ${table} at offset ${currentOffset}: ${error.message}`,
        );
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      allData.push(...(data as T[]));
      fetchedCount += data.length;
      currentOffset += data.length;

      if (data.length < batchSize) {
        break;
      }
    }

    return allData;
  }

  /**
   * Récupère les URLs par type d'entité pour un bucket donné
   * Utilise la table de scoring pour filtrer par température
   */
  async getUrlsByEntityType(
    bucket: TemperatureBucket,
    entityType: EntityType,
  ): Promise<SitemapUrl[]> {
    const pageTypes = ENTITY_PAGE_TYPES[entityType];
    const config = BUCKET_CONFIG[bucket];

    const { data: scoredUrls, error: scoreError } = await this.supabase
      .from('__seo_entity_score_v10')
      .select('url')
      .eq('bucket', bucket)
      .limit(MAX_URLS_PER_FILE * 2);

    if (scoreError) {
      this.logger.warn(
        `Score fetch failed for ${bucket}: ${scoreError.message}`,
      );
      return [];
    }

    if (!scoredUrls || scoredUrls.length === 0) {
      return [];
    }

    const urlList = scoredUrls.map((s) => s.url);

    const { data, error } = await this.supabase
      .from('__seo_page')
      .select('url, page_type, last_modified_at')
      .in('url', urlList)
      .in('page_type', pageTypes)
      .eq('is_indexable_hint', true)
      .limit(MAX_URLS_PER_FILE);

    if (error) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
        message: `Entity type fetch error: ${error.message}`,
        details: error.message,
      });
    }

    return (data || []).map((row) => ({
      url: row.url,
      page_type: row.page_type,
      changefreq: config.changefreq,
      priority: config.priority,
      last_modified_at: row.last_modified_at,
    }));
  }

  /**
   * Logger une génération dans __seo_generation_log
   */
  async logGeneration(
    runId: string,
    bucket: TemperatureBucket,
    status: 'success' | 'failed',
    urlsTotal: number,
    filesGenerated: number,
    durationMs: number,
    error?: string,
  ): Promise<void> {
    try {
      await this.supabase.from('__seo_generation_log').insert({
        run_id: runId,
        generation_type: 'sitemap',
        bucket,
        status,
        urls_total: urlsTotal,
        files_generated: filesGenerated,
        duration_ms: durationMs,
        error_message: error || null,
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`Failed to log generation: ${err}`);
    }
  }
}
