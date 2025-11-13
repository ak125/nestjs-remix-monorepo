import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';

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
  ) {
    super();
  }

  /**
   * Récupère les données complètes de page avec cache Redis
   *
   * ⚠️ TEMPORAIRE: Délègue à l'ancienne implémentation
   * TODO: Refactoriser en extrayant le code de .old
   */
  async getCompletePageData(pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    console.log(`🚀 OPTIMISÉ CLASSIQUE - PG_ID=${pgIdNum} (via service)`);

    // Pour l'instant, throw pour forcer l'utilisation de RPC V2
    throw new Error(
      'GammePageDataService.getCompletePageData() pas encore implémenté. ' +
        'Utiliser RPC V2 ou restaurer gamme-rest-optimized.controller.old',
    );

    // TODO: Copier toute la logique depuis gamme-rest-optimized.controller.old ligne 320-1172
  }

  /**
   * Récupère les détails simples d'une gamme
   */
  async getGammeDetails(pgId: string) {
    const pgIdNum = parseInt(pgId, 10);

    const { data, error } = await this.client
      .from('pieces_gamme')
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
