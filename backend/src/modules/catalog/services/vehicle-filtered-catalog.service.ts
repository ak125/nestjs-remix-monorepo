// 🚗 Service pour filtrer le catalogue par véhicule
// Utilise cross_gamme_car pour ne montrer que les pièces compatibles

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogFamily, CatalogGamme, CatalogFamiliesResponse, CatalogFamilyWithGammes } from '../interfaces/catalog-family.interface';

@Injectable()
export class VehicleFilteredCatalogService extends SupabaseBaseService {

  /**
   * 🚗 Récupère les familles de catalogue filtrées par véhicule
   * Basé sur la logique PHP qui utilise cross_gamme_car
   */
  async getCatalogFamiliesForVehicle(typeId: number): Promise<CatalogFamiliesResponse> {
    try {
      this.logger.log(`🚗 Récupération catalogue filtré pour type_id: ${typeId}`);

      // 1. Récupérer les pg_id compatibles avec ce véhicule depuis cross_gamme_car
      const { data: compatibleGammes, error: crossError } = await this.supabase
        .from('__cross_gamme_car')
        .select('cgc_pg_id')
        .eq('cgc_type_id', typeId)
        .eq('cgc_level', 1);

      if (crossError) {
        this.logger.error('Erreur récupération cross_gamme_car:', crossError);
        throw new BadRequestException('Erreur lors de la récupération des compatibilités véhicule');
      }

      if (!compatibleGammes || compatibleGammes.length === 0) {
        this.logger.warn(`Aucune pièce compatible trouvée pour type_id: ${typeId}`);
        return {
          families: [],
          success: false,
          totalFamilies: 0,
          message: 'Aucune pièce compatible trouvée pour ce véhicule'
        };
      }

      const compatiblePgIds = compatibleGammes.map(item => item.cgc_pg_id);
      this.logger.log(`✅ ${compatiblePgIds.length} pièces compatibles trouvées`);

      // 2. Récupérer les familles qui ont des gammes compatibles
      const { data: familiesData, error: familiesError } = await this.supabase
        .from('pieces_gamme')
        .select(`
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
        `)
        .eq('pg_display', 1)
        .eq('pg_level', 1)
        .eq('catalog_gamme.catalog_family.mf_display', 1)
        .in('pg_id', compatiblePgIds)
        .order('catalog_gamme.catalog_family.mf_sort', { ascending: true });

      if (familiesError) {
        this.logger.error('Erreur récupération familles filtrées:', familiesError);
        throw new BadRequestException('Erreur lors de la récupération des familles filtrées');
      }

      // 3. Extraire les familles uniques
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
            mf_sort: family.mf_sort
          });
        }
      });

      const families = Array.from(uniqueFamilies.values());

      // 4. Pour chaque famille, récupérer ses gammes compatibles
      const familiesWithGammes: CatalogFamilyWithGammes[] = [];

      for (const family of families) {
        const gammes = await this.getCompatibleGammesForFamily(family.mf_id, compatiblePgIds);
        if (gammes.length > 0) { // Seulement les familles qui ont des gammes compatibles
          familiesWithGammes.push({
            ...family,
            gammes,
            gammes_count: gammes.length,
          });
        }
      }

      this.logger.log(`✅ ${familiesWithGammes.length} familles filtrées avec gammes compatibles`);

      return {
        families: familiesWithGammes,
        success: true,
        totalFamilies: familiesWithGammes.length,
        message: `${familiesWithGammes.length} familles compatibles avec le véhicule`
      };

    } catch (error) {
      this.logger.error('Erreur catalogue filtré par véhicule:', error);
      return {
        families: [],
        success: false,
        totalFamilies: 0,
        message: 'Erreur lors de la récupération du catalogue filtré'
      };
    }
  }

  /**
   * 🔧 Récupère les gammes compatibles pour une famille donnée
   */
  private async getCompatibleGammesForFamily(mf_id: number, compatiblePgIds: string[]): Promise<CatalogGamme[]> {
    try {
      const { data: gammesData, error: gammesError } = await this.supabase
        .from('pieces_gamme')
        .select(`
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
        `)
        .eq('pg_display', 1)
        .eq('pg_level', 1)
        .eq('catalog_gamme.mc_mf_id', mf_id)
        .in('pg_id', compatiblePgIds)
        .order('catalog_gamme.mc_sort', { ascending: true });

      if (gammesError) {
        this.logger.error(`Erreur récupération gammes pour famille ${mf_id}:`, gammesError);
        return [];
      }

      const gammes: CatalogGamme[] = gammesData?.map((item: any) => ({
        pg_id: parseInt(item.pg_id),
        pg_alias: item.pg_alias,
        pg_name: item.pg_name,
        pg_name_url: item.pg_name_url,
        pg_name_meta: item.pg_name_meta,
        pg_pic: item.pg_pic,
        pg_img: item.pg_img
      })) || [];

      this.logger.debug(`Familie ${mf_id}: ${gammes.length} gammes compatibles`);
      return gammes;

    } catch (error) {
      this.logger.error(`Erreur gammes famille ${mf_id}:`, error);
      return [];
    }
  }
}