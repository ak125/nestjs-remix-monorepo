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
   * Récupère les données depuis Supabase (logique interne)
   */
  private async fetchCatalogFamiliesPhpLogic(): Promise<CatalogFamiliesResponse> {
    try {
      this.logger.log(
        'Récupération des familles de catalogue (logique PHP)...',
      );

      // Récupérer les familles avec la même logique que le PHP
      const { data: familiesData, error: familiesError } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          `
          catalog_gamme!inner(
            mc_mf_id,
            mc_sort,
            catalog_family!inner(
              mf_id,
              mf_name,
              mf_name_system,
              mf_description,
              mf_pic,
              mf_display,
              mf_sort
            )
          )
        `,
        )
        .eq('pg_display', 1)
        .eq('pg_level', 1)
        .eq('catalog_gamme.catalog_family.mf_display', 1);

      if (familiesError) {
        this.logger.error('Erreur récupération familles:', familiesError);
        throw new BadRequestException(
          'Erreur lors de la récupération des familles',
        );
      }

      // Extraire les familles uniques (logique DISTINCT du PHP)
      const uniqueFamilies = new Map<number, CatalogFamily>();

      familiesData?.forEach((item: any) => {
        const family = item.catalog_gamme?.[0]?.catalog_family?.[0];
        if (family && !uniqueFamilies.has(family.mf_id)) {
          uniqueFamilies.set(family.mf_id, {
            mf_id: family.mf_id,
            mf_name: family.mf_name_system || family.mf_name,
            mf_name_system: family.mf_name_system,
            mf_description: family.mf_description,
            mf_pic: family.mf_pic,
            mf_display: family.mf_display,
            mf_sort: family.mf_sort,
          });
        }
      });

      // Trier les familles par mf_sort
      const families = Array.from(uniqueFamilies.values()).sort(
        (a, b) => a.mf_sort - b.mf_sort,
      );
      this.logger.log(`${families.length} familles trouvées`);

      // Pour chaque famille, récupérer ses gammes (reproduction de la boucle PHP)
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
      const { data: gammesData, error: gammesError } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          `
          pg_id,
          pg_alias,
          pg_name,
          pg_name_url,
          pg_name_meta,
          pg_pic,
          pg_img,
          catalog_gamme!inner(
            mc_sort
          )
        `,
        )
        .eq('pg_display', 1)
        .eq('pg_level', 1)
        .eq('catalog_gamme.mc_mf_id', mf_id)
        .order('catalog_gamme.mc_sort', { ascending: true });

      if (gammesError) {
        this.logger.error(
          `Erreur récupération gammes pour famille ${mf_id}:`,
          gammesError,
        );
        return [];
      }

      const gammes: CatalogGamme[] =
        gammesData?.map((item: any) => ({
          pg_id: item.pg_id,
          pg_alias: item.pg_alias,
          pg_name: item.pg_name,
          pg_name_url: item.pg_name_url,
          pg_name_meta: item.pg_name_meta,
          pg_pic: item.pg_pic,
          pg_img: item.pg_img,
          mc_sort: item.catalog_gamme?.[0]?.mc_sort,
        })) || [];

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
