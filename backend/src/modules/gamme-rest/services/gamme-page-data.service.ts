import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';
import { UnifiedPageDataService } from '../../catalog/services/unified-page-data.service';

/**
 * 🚀 Service optimisé pour récupérer les données de page gamme
 *
 * OPTIMISATIONS V2:
 * 1. Utilise UnifiedPageDataService (RPC V3 avec SEO intégré PostgreSQL)
 * 2. 1 seul appel RPC au lieu de 2 (SEO + Pièces)
 * 3. Cache Redis 1h TTL
 */
@Injectable()
export class GammePageDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(GammePageDataService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly transformer: GammeDataTransformerService,
    private readonly unifiedPageDataService: UnifiedPageDataService,
  ) {
    super();
  }

  /**
   * ⚡ Récupère les données complètes de page via RPC V3 (UnifiedPageDataService)
   *
   * Utilise 1 seul appel RPC V3 au lieu de 2 appels parallèles (SEO + Pièces).
   * Le cache est géré par UnifiedPageDataService (1h TTL).
   */
  async getCompletePageData(pgId: string, query: any = {}) {
    const startTime = performance.now();
    const pgIdNum = parseInt(pgId, 10);
    const typeId = query.typeId ? parseInt(query.typeId, 10) : 0;

    this.logger.log(
      `🚀 RPC V3 UNIFIED - PG_ID=${pgIdNum} typeId=${typeId || 'none'}`,
    );

    // 1. Appel unique via UnifiedPageDataService (RPC V3 + cache intégré)
    const pageData = await this.unifiedPageDataService.getPageData(
      typeId,
      pgIdNum,
    );

    const responseTime = performance.now() - startTime;
    this.logger.log(
      `⚡ RPC V3 terminé en ${responseTime.toFixed(1)}ms - ${pageData.count} pièces`,
    );

    // 2. Adapter la réponse au format attendu par le frontend
    const response = {
      status: 200,
      pieces: pageData.pieces || [],
      count: pageData.count || 0,
      minPrice: pageData.minPrice || null,
      seo: {
        h1: pageData.seo?.h1 || undefined,
        content: pageData.seo?.content || undefined,
        title: pageData.seo?.title || undefined,
        description: pageData.seo?.description || undefined,
      },
      crossSelling: [], // TODO: Implémenter cross-selling
      validation: {
        valid: (pageData.count || 0) > 0,
        relationsCount: pageData.count || 0,
      },
      success: pageData.success,
      timestamp: new Date().toISOString(),
      source: 'rpc_v3_unified',
      _responseTime: responseTime,
      _cacheHit: pageData.cacheHit,
    };

    return response;
  }

  /**
   * Récupère les détails simples d'une gamme
   */
  async getGammeDetails(pgId: string) {
    const pgIdNum = parseInt(pgId, 10);

    const { data, error } = await this.client
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_name_meta, pg_img, pg_wall')
      .eq('pg_id', pgIdNum)
      .single();

    if (error || !data) {
      return {
        status: 404,
        error: 'Gamme non trouvée',
      };
    }

    return {
      status: 200,
      data: {
        id: data.pg_id,
        name: data.pg_name,
        alias: data.pg_alias,
        name_meta: data.pg_name_meta,
        image: data.pg_img,
        wall: data.pg_wall,
      },
    };
  }
}
