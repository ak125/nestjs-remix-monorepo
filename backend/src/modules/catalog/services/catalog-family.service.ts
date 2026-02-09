import { TABLES } from '@repo/database-types';
import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RedisCacheService } from '../../../database/services/redis-cache.service';
import {
  CatalogFamily,
  CatalogFamilyWithGammes,
  CatalogGamme,
  CatalogFamiliesResponse,
} from '../interfaces/catalog-family.interface';

@Injectable()
export class CatalogFamilyService extends SupabaseBaseService {
  constructor(private readonly cacheService: RedisCacheService) {
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
   * Récupère les données depuis Supabase (logique simplifiée sans FK)
   */
  private async fetchCatalogFamiliesPhpLogic(): Promise<CatalogFamiliesResponse> {
    try {
      this.logger.log('Récupération des familles de catalogue...');

      // Récupérer directement les familles actives
      const { data: familiesData, error: familiesError } = await this.supabase
        .from('catalog_family')
        .select(
          'mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_display, mf_sort',
        )
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true });

      if (familiesError) {
        this.logger.error('Erreur récupération familles:', familiesError);
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

      this.logger.log(`${families.length} familles trouvées`);

      // Pour chaque famille, récupérer ses gammes
      const familiesWithGammes: CatalogFamilyWithGammes[] = [];

      for (const family of families) {
        const gammes = await this.getGammesForFamily(family.mf_id);
        familiesWithGammes.push({
          ...family,
          gammes,
          gammes_count: gammes.length,
        });
      }

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
