// 🚗 Service pour filtrer le catalogue par véhicule - VERSION PHP EXACTE
// Reproduit exactement la requête PHP avec CGC_LEVEL = 3

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogFamily, CatalogGamme, CatalogFamiliesResponse, CatalogFamilyWithGammes } from '../interfaces/catalog-family.interface';

@Injectable()
export class VehicleFilteredCatalogService extends SupabaseBaseService {

  /**
   * 🚗 Récupère les familles de catalogue filtrées par véhicule
   * Reproduit EXACTEMENT la requête PHP avec CGC_LEVEL = 3
   */
  async getCatalogFamiliesForVehicle(typeId: number): Promise<CatalogFamiliesResponse> {
    try {
      this.logger.log(`🚗 Récupération catalogue filtré pour type_id: ${typeId} (CGC_LEVEL=3)`);

      // Requête PHP exacte avec CGC_LEVEL = 3 et PG_LEVEL IN (1,2)
      const { data: compatiblePieces, error: crossError } = await this.supabase
        .from('__cross_gamme_car_new')
        .select(`
          cgc_pg_id,
          pieces_gamme!inner(
            pg_id,
            pg_alias,
            pg_name,
            pg_name_meta,
            pg_pic,
            pg_img,
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
          )
        `)
        .eq('cgc_type_id', typeId)
        .eq('cgc_level', '3') // PHP: CGC_LEVEL = 3 (string car les colonnes sont text)
        .eq('pieces_gamme.pg_display', '1')
        .in('pieces_gamme.pg_level', ['1', '2']) // PHP: PG_LEVEL IN (1,2)
        .eq('pieces_gamme.catalog_gamme.catalog_family.mf_display', '1')
        .order('pieces_gamme.catalog_gamme.mc_mf_id', { ascending: true })
        .order('pieces_gamme.catalog_gamme.mc_sort', { ascending: true });

      if (crossError) {
        this.logger.error('Erreur récupération pièces compatibles:', crossError);
        return {
          families: [],
          success: false,
          totalFamilies: 0,
          message: 'Erreur lors de la récupération des compatibilités véhicule'
        };
      }

      if (!compatiblePieces || compatiblePieces.length === 0) {
        this.logger.warn(`Aucune pièce compatible pour type_id: ${typeId} (CGC_LEVEL=3)`);
        return {
          families: [],
          success: false,
          totalFamilies: 0,
          message: 'Aucune pièce compatible trouvée pour ce véhicule'
        };
      }

      this.logger.log(`✅ ${compatiblePieces.length} pièces compatibles trouvées`);

      // Organiser par familles
      const familiesMap = new Map<number, CatalogFamilyWithGammes>();

      compatiblePieces.forEach((item: any) => {
        const piece = item.pieces_gamme;
        if (!piece?.catalog_gamme?.[0]?.catalog_family?.[0]) return;

        const family = piece.catalog_gamme[0].catalog_family[0];
        const familyId = parseInt(family.mf_id);

        if (!familiesMap.has(familyId)) {
          familiesMap.set(familyId, {
            mf_id: familyId,
            mf_name: family.mf_name_system || family.mf_name,
            mf_name_system: family.mf_name_system,
            mf_description: family.mf_description,
            mf_pic: family.mf_pic,
            mf_display: parseInt(family.mf_display),
            mf_sort: parseInt(family.mf_sort),
            gammes: [],
            gammes_count: 0
          });
        }

        const familyData = familiesMap.get(familyId)!;
        const existingGamme = familyData.gammes.find(g => g.pg_id === parseInt(piece.pg_id));
        
        if (!existingGamme) {
          familyData.gammes.push({
            pg_id: parseInt(piece.pg_id),
            pg_alias: piece.pg_alias,
            pg_name: piece.pg_name,
            pg_name_url: piece.pg_name_url,
            pg_name_meta: piece.pg_name_meta,
            pg_pic: piece.pg_pic,
            pg_img: piece.pg_img
          });
          familyData.gammes_count = familyData.gammes.length;
        }
      });

      const families = Array.from(familiesMap.values())
        .sort((a, b) => a.mf_sort - b.mf_sort);

      this.logger.log(`✅ ${families.length} familles avec ${families.reduce((sum, f) => sum + f.gammes_count, 0)} gammes`);

      return {
        families,
        success: true,
        totalFamilies: families.length,
        message: `${families.length} familles compatibles avec le véhicule`
      };

    } catch (error) {
      this.logger.error('Erreur catalogue filtré:', error);
      return {
        families: [],
        success: false,
        totalFamilies: 0,
        message: 'Erreur lors de la récupération du catalogue filtré'
      };
    }
  }
}