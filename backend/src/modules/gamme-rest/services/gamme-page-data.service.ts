import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';
import { VehiclePiecesCompatibilityService } from '../../catalog/services/vehicle-pieces-compatibility.service';
import { GammeUnifiedService } from '../../catalog/services/gamme-unified.service';

/**
 * 🚀 Service optimisé pour récupérer les données de page gamme
 * 
 * OPTIMISATIONS:
 * 1. Cache Redis avec TTL intelligent
 * 2. Appels parallèles (Promise.all) pour SEO + Pièces
 * 3. Pattern stale-while-revalidate sur les données
 */
@Injectable()
export class GammePageDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(GammePageDataService.name);
  
  // TTL Cache: 30 min pour données page complètes
  private readonly CACHE_TTL_SECONDS = 1800;

  constructor(
    private readonly cacheService: CacheService,
    private readonly transformer: GammeDataTransformerService,
    private readonly vehiclePiecesCompatibilityService: VehiclePiecesCompatibilityService,
    private readonly gammeUnifiedService: GammeUnifiedService,
  ) {
    super();
  }

  /**
   * 🔑 Génère la clé de cache pour page complète
   */
  private getCacheKey(pgId: number, typeId: number | null, marqueId: number | null, modeleId: number | null): string {
    return `gamme:page:${pgId}:${typeId || 0}:${marqueId || 0}:${modeleId || 0}`;
  }

  /**
   * ⚡ Récupère les données complètes de page avec cache Redis et appels parallèles
   */
  async getCompletePageData(pgId: string, query: any = {}) {
    const startTime = performance.now();
    const pgIdNum = parseInt(pgId, 10);
    const typeId = query.typeId ? parseInt(query.typeId, 10) : null;
    const marqueId = query.marqueId ? parseInt(query.marqueId, 10) : null;
    const modeleId = query.modeleId ? parseInt(query.modeleId, 10) : null;

    const cacheKey = this.getCacheKey(pgIdNum, typeId, marqueId, modeleId);

    // 1. Vérifier le cache Redis d'abord
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      const cacheTime = performance.now() - startTime;
      this.logger.debug(`🎯 CACHE HIT page gamme ${pgIdNum} en ${cacheTime.toFixed(1)}ms`);
      return {
        ...cached,
        _cacheHit: true,
        _responseTime: cacheTime,
      };
    }

    this.logger.log(`🚀 OPTIMISÉ PARALLÈLE - PG_ID=${pgIdNum} typeId=${typeId || 'none'}`);

    // 2. ⚡ APPELS PARALLÈLES - SEO + Pièces en même temps
    const [seoContent, piecesData] = await Promise.all([
      // Appel SEO
      this.gammeUnifiedService.getGammeSeoContent(
        pgIdNum, 
        typeId || 0, 
        marqueId, 
        modeleId
      ),
      // Appel Pièces (seulement si véhicule spécifié)
      typeId 
        ? this.vehiclePiecesCompatibilityService.getPiecesViaRPC(typeId, pgIdNum)
        : Promise.resolve({ pieces: [], count: 0, minPrice: null, grouped_pieces: [] }),
    ]);

    const parallelTime = performance.now() - startTime;
    this.logger.log(`⚡ Appels parallèles terminés en ${parallelTime.toFixed(1)}ms`);

    // 3. Construire la réponse
    const response = {
        status: 200,
        pieces: piecesData.pieces || [],
        count: piecesData.count || 0,
        minPrice: piecesData.minPrice || null,
        seo: {
          h1: seoContent.h1 || undefined,
          content: seoContent.content || undefined,
          title: seoContent.title || undefined,
          description: seoContent.description || undefined,
        },
        crossSelling: [], // TODO: Implémenter cross-selling
        validation: {
          valid: (piecesData.count || 0) > 0,
          relationsCount: piecesData.count || 0,
        },
        success: true,
        timestamp: new Date().toISOString(),
        source: 'optimized_parallel',
        _responseTime: performance.now() - startTime,
    };

    // 4. Stocker en cache (async, non-bloquant)
    this.cacheService.set(cacheKey, response, this.CACHE_TTL_SECONDS).catch(err => 
      this.logger.error(`Erreur cache page gamme ${pgIdNum}:`, err)
    );

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
