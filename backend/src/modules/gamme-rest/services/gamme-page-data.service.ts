import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';
import { VehiclePiecesCompatibilityService } from '../../catalog/services/vehicle-pieces-compatibility.service';
import { GammeUnifiedService } from '../../catalog/services/gamme-unified.service';

/**
 * Service pour récupérer les données de page gamme (méthode classique avec cache)
 *
 * ⚠️ TODO: Migrer toute la logique de gamme-rest-optimized.controller.old ici
 * Pour l'instant, retourne une implémentation temporaire
 */
@Injectable()
export class GammePageDataService extends SupabaseBaseService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly transformer: GammeDataTransformerService,
    private readonly vehiclePiecesCompatibilityService: VehiclePiecesCompatibilityService,
    private readonly gammeUnifiedService: GammeUnifiedService,
  ) {
    super();
  }

  /**
   * Récupère les données complètes de page avec cache Redis
   *
   * ⚠️ TEMPORAIRE: Délègue à l'ancienne implémentation
   * TODO: Refactoriser en extrayant le code de .old
   */
  async getCompletePageData(pgId: string, query: any = {}) {
    const pgIdNum = parseInt(pgId, 10);
    const typeId = query.typeId ? parseInt(query.typeId, 10) : null;
    const marqueId = query.marqueId ? parseInt(query.marqueId, 10) : null;
    const modeleId = query.modeleId ? parseInt(query.modeleId, 10) : null;

    console.log(`🚀 OPTIMISÉ CLASSIQUE - PG_ID=${pgIdNum} (via service)`);

    // 1. Get Gamme Details & SEO
    // Si typeId est présent, on récupère le SEO spécifique, sinon générique (à implémenter si besoin)
    const seoContent = await this.gammeUnifiedService.getGammeSeoContent(
      pgIdNum, 
      typeId || 0, 
      marqueId, 
      modeleId
    );
    
    // 2. Get Pieces (si véhicule spécifié)
    let piecesData: any = { pieces: [], count: 0, minPrice: null, grouped_pieces: [] };
    if (typeId) {
        piecesData = await this.vehiclePiecesCompatibilityService.getPiecesExactPHP(typeId, pgIdNum);
    }

    // 3. Construct Response (Format compatible BatchLoaderResponse pour les pages véhicules)
    return {
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
        source: 'fallback_optimized_controller'
    };
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
