import { TABLES } from '@repo/database-types';
import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import {
  CatalogFamily,
  CatalogFamilyWithGammes,
  CatalogGamme,
  CatalogFamiliesResponse,
} from '../interfaces/catalog-family.interface';

@Injectable()
export class CatalogFamilyService extends SupabaseBaseService {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Reproduction exacte de la logique PHP index.php
   * 🚀 AVEC CACHE REDIS pour éviter timeouts
   */
  async getCatalogFamiliesPhpLogic(): Promise<CatalogFamiliesResponse> {
    return this.cacheService.cached(
      'families:php-logic',
      () => this.fetchCatalogFamiliesPhpLogic(),
      3600, // TTL: 1 heure
      'catalog',
    );
  }

  /**
   * Récupère les données via RPC optimisée (1 requête SQL au lieu de 39)
   * Fallback sur l'ancienne méthode N+1 en cas d'échec RPC
   */
  private async fetchCatalogFamiliesPhpLogic(): Promise<CatalogFamiliesResponse> {
    try {
      this.logger.log(
        'Récupération des familles de catalogue (RPC optimisée)...',
      );

      const { data: rows, error: rpcError } = await this.callRpc<any[]>(
        'get_catalog_hierarchy_optimized',
        {},
        { source: 'api' },
      );

      if (rpcError || !rows) {
        this.logger.warn('RPC échouée, fallback N+1:', rpcError?.message);
        return this.fetchCatalogFamiliesN1Fallback();
      }

      // Transformer le résultat plat en structure families[] + gammes[]
      const familyMap = new Map<number, CatalogFamilyWithGammes>();

      for (const row of rows) {
        const mfId = parseInt(row.mf_id, 10);

        if (!familyMap.has(mfId)) {
          familyMap.set(mfId, {
            mf_id: mfId,
            mf_name: row.mf_name,
            mf_name_system: row.mf_name,
            mf_description: undefined,
            mf_pic: row.mf_image,
            mf_display: row.mf_display,
            mf_sort: row.mf_sort,
            gammes: [],
            gammes_count: 0,
          });
        }

        if (row.pg_id) {
          familyMap.get(mfId)!.gammes.push({
            pg_id: row.pg_id,
            pg_alias: row.pg_alias,
            pg_name: row.pg_name,
            pg_name_url: undefined,
            pg_name_meta: undefined,
            pg_pic: undefined,
            pg_img: row.pg_img,
            mc_sort: row.mc_sort ? parseInt(row.mc_sort, 10) : 0,
          });
        }
      }

      const familiesWithGammes = Array.from(familyMap.values())
        .sort((a, b) => a.mf_sort - b.mf_sort)
        .map((f) => ({ ...f, gammes_count: f.gammes.length }));

      this.logger.log(`${familiesWithGammes.length} familles récupérées (RPC)`);

      return {
        families: familiesWithGammes,
        success: true,
        totalFamilies: familiesWithGammes.length,
        message: `${familiesWithGammes.length} familles récupérées avec succès`,
      };
    } catch (error) {
      this.logger.error('Erreur familles catalogue:', error);
      return {
        families: [],
        success: false,
        totalFamilies: 0,
        message: 'Erreur lors de la récupération des familles',
      };
    }
  }

  /**
   * Fallback N+1 : ancienne méthode avec boucle (utilisée si RPC échoue)
   */
  private async fetchCatalogFamiliesN1Fallback(): Promise<CatalogFamiliesResponse> {
    const { data: familiesData, error: familiesError } = await this.supabase
      .from('catalog_family')
      .select(
        'mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_display, mf_sort',
      )
      .eq('mf_display', '1')
      .order('mf_sort', { ascending: true });

    if (familiesError) {
      this.logger.error(
        'Erreur récupération familles (fallback):',
        familiesError,
      );
      throw new BadRequestException(
        'Erreur lors de la récupération des familles',
      );
    }

    const families: CatalogFamily[] = (familiesData || []).map((f) => ({
      mf_id: parseInt(f.mf_id, 10),
      mf_name: f.mf_name_system || f.mf_name,
      mf_name_system: f.mf_name_system,
      mf_description: f.mf_description,
      mf_pic: f.mf_pic,
      mf_display: f.mf_display,
      mf_sort: parseInt(f.mf_sort, 10),
    }));

    const familiesWithGammes: CatalogFamilyWithGammes[] = [];
    for (const family of families) {
      const gammes = await this.getGammesForFamily(family.mf_id);
      familiesWithGammes.push({
        ...family,
        gammes,
        gammes_count: gammes.length,
      });
    }

    this.logger.log(
      `${familiesWithGammes.length} familles récupérées (fallback N+1)`,
    );

    return {
      families: familiesWithGammes,
      success: true,
      totalFamilies: familiesWithGammes.length,
      message: `${familiesWithGammes.length} familles récupérées avec succès`,
    };
  }

  private async getGammesForFamily(mf_id: number): Promise<CatalogGamme[]> {
    try {
      // Récupérer les IDs de gammes liées à cette famille via catalog_gamme
      const { data: linkData, error: linkError } = await this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id, mc_sort')
        .eq('mc_mf_id', mf_id.toString())
        .order('mc_sort', { ascending: true });

      if (linkError || !linkData?.length) {
        return [];
      }

      const pgIds = linkData.map((l) => l.mc_pg_id);
      const sortMap = new Map(
        linkData.map((l) => [l.mc_pg_id, parseInt(l.mc_sort, 10)]),
      );

      // Récupérer les gammes correspondantes
      const { data: gammesData, error: gammesError } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          'pg_id, pg_alias, pg_name, pg_name_url, pg_name_meta, pg_pic, pg_img',
        )
        .in('pg_id', pgIds)
        .eq('pg_display', '1')
        .eq('pg_level', '1');

      if (gammesError) {
        this.logger.error(
          `Erreur récupération gammes pour famille ${mf_id}:`,
          gammesError,
        );
        return [];
      }

      const gammes: CatalogGamme[] = (gammesData || [])
        .map((item) => ({
          pg_id: item.pg_id,
          pg_alias: item.pg_alias,
          pg_name: item.pg_name,
          pg_name_url: item.pg_name_url,
          pg_name_meta: item.pg_name_meta,
          pg_pic: item.pg_pic,
          pg_img: item.pg_img,
          mc_sort: sortMap.get(item.pg_id) || 0,
        }))
        .sort((a, b) => a.mc_sort - b.mc_sort);

      return gammes;
    } catch (error) {
      this.logger.error(`Erreur gammes pour famille ${mf_id}:`, error);
      return [];
    }
  }

  /**
   * Alias pour compatibilité - appelle getCatalogFamiliesPhpLogic
   */
  async getFamiliesWithGammes(): Promise<CatalogFamiliesResponse> {
    return this.getCatalogFamiliesPhpLogic();
  }
}
