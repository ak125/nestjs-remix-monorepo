import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogService } from '../catalog.service';

// Types pour le V3
export interface CatalogGammeV3 {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_name_url: string;
  pg_pic: string;
  pg_img: string;
  pg_display: number;
  pg_level: number;
}

export interface CatalogFamilyV3 {
  mf_id: number;
  mf_name: string;
  mf_name_system: string | null;
  mf_description: string;
  mf_pic: string;
  mf_display: number;
  mf_sort: number;
  gammes: CatalogGammeV3[];
  gammes_count: number;
}

export interface CatalogV3Response {
  families: CatalogFamilyV3[];
  success: boolean;
  totalFamilies: number;
  totalGammes: number;
  seoValid: boolean;
  message: string;
  queryType: string;
}

export interface PopularPartV3 {
  piece_id: number;
  piece_alias: string;
  piece_name: string;
  piece_pg_id: number;
  pg_name: string;
}

@Injectable()
export class VehicleFilteredCatalogServiceV3 extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleFilteredCatalogServiceV3.name);

  constructor(
    private readonly catalogService: CatalogService,
  ) {
    super();
  }

  /**
   * 🚗 Point d'entrée principal V3
   * Retourne le catalogue filtré + pièces populaires pour un véhicule
   */
  async getCatalogAndPopularParts(typeId: number): Promise<{
    catalog: CatalogV3Response;
    popularParts: PopularPartV3[];
  }> {
    const [catalog, popularParts] = await Promise.all([
      this.getCatalogFamiliesForVehicle(typeId),
      this.getPopularPiecesForVehicle(typeId, 48),
    ]);

    return { catalog, popularParts };
  }

  /**
   * 🚗 REPRODUCTION EXACTE DE VOTRE MÉTHODE PHP
   * Étapes exactes avec vos tables : pieces_relation_type → catalog_gamme → catalog_family
   */
  async getCatalogFamiliesForVehicle(typeId: number): Promise<CatalogV3Response> {
    try {
      this.logger.log(`🎯 [PHP EXACT] Reproduction logique PHP pour type_id: ${typeId}`);
      
      // 🚀 ÉTAPE 1: Récupérer pieces_relation_type avec timeout de sécurité
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout 8 secondes')), 8000);
      });

      const relationPromise = this.supabase
        .from('pieces_relation_type')
        .select('rtp_pg_id, rtp_piece_id')
        .eq('rtp_type_id', typeId)
        .limit(1000);

      let relationData: any;
      try {
        const result = await Promise.race([relationPromise, timeoutPromise]);
        relationData = result.data;
        
        if (result.error) {
          throw new Error(result.error.message);
        }
    } catch (err) {
      if ((err as any).code === '57014') { // TIMEOUT PostgreSQL
        this.logger.error(`❌ [TIMEOUT] pieces_relation_type: ${(err as Error).message}`);
        throw new Error(`Timeout sur pieces_relation_type - table trop volumineuse (145M+ lignes)`);
      }
      this.logger.error(`❌ [ÉTAPE 1] Erreur: ${(err as Error).message}`);
      throw err;
    }      if (!relationData || relationData.length === 0) {
        this.logger.warn(`⚠️ Aucune relation pour type_id: ${typeId}`);
        return this.getFallbackGeneric(typeId);
      }

      this.logger.log(`✅ [ÉTAPE 1] ${relationData.length} relations pieces_relation_type trouvées`);

      // 🚀 ÉTAPE 2: Récupérer catalog_gamme + catalog_family (comme dans votre JOIN PHP)
      const pgIds = [...new Set(relationData.map(r => r.rtp_pg_id))];
      const pieceIds = [...new Set(relationData.map(r => r.rtp_piece_id))];

      const { data: catalogData, error: catalogError } = await this.supabase
        .from('catalog_gamme')
        .select(`
          mc_pg_id,
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
          ),
          pieces_gamme!inner(
            pg_id,
            pg_alias,
            pg_name,
            pg_name_meta,
            pg_name_url,
            pg_pic,
            pg_img,
            pg_display,
            pg_level
          )
        `)
        .in('mc_pg_id', pgIds)
        .eq('pieces_gamme.pg_display', 1)
        .in('pieces_gamme.pg_level', [1, 2])
        .eq('catalog_family.mf_display', 1);

      if (catalogError || !catalogData || catalogData.length === 0) {
        this.logger.warn(`⚠️ [CATALOG_GAMME] ${catalogError?.message || 'Pas de données'}`);
        return this.getFallbackGeneric(typeId);
      }

      this.logger.log(`✅ [ÉTAPE 2] ${catalogData.length} relations catalog trouvées`);

      // 🚀 ÉTAPE 3: Vérification pieces.display = 1 (votre JOIN PIECES)
      const { data: piecesData } = await this.supabase
        .from('pieces')
        .select('piece_id, piece_pg_id, piece_display')
        .in('piece_id', pieceIds)
        .in('piece_pg_id', pgIds)
        .eq('piece_display', 1);

      const validPgIds = new Set(piecesData?.map(p => p.piece_pg_id) || []);
      const filteredCatalogData = catalogData.filter(item => validPgIds.has(item.mc_pg_id));

      this.logger.log(`✅ [ÉTAPE 3] ${filteredCatalogData.length} relations après filtre pieces.display=1`);

      if (filteredCatalogData.length === 0) {
        return this.getFallbackGeneric(typeId);
      }

      // 🚀 ÉTAPE 4: Construction DISTINCT MF_ID (comme votre SELECT DISTINCT)
      const familiesMap = new Map<number, CatalogFamilyV3>();

      filteredCatalogData.forEach((item: any) => {
        const family = item.catalog_family;
        const gamme = item.pieces_gamme;
        
        // Votre logique IF(MF_NAME_SYSTEM IS NULL, MF_NAME, MF_NAME_SYSTEM)
        if (!familiesMap.has(family.mf_id)) {
          familiesMap.set(family.mf_id, {
            mf_id: family.mf_id,
            mf_name: family.mf_name_system || family.mf_name,
            mf_name_system: family.mf_name_system,
            mf_description: family.mf_description,
            mf_pic: family.mf_pic,
            mf_display: family.mf_display,
            mf_sort: family.mf_sort,
            gammes: [],
            gammes_count: 0
          });
        }

        const currentFamily = familiesMap.get(family.mf_id)!;
        
        // DISTINCT gammes
        if (!currentFamily.gammes.find((g) => g.pg_id === gamme.pg_id)) {
          currentFamily.gammes.push({
            pg_id: gamme.pg_id,
            pg_alias: gamme.pg_alias,
            pg_name: gamme.pg_name,
            pg_name_meta: gamme.pg_name_meta,
            pg_name_url: gamme.pg_name_url,
            pg_pic: gamme.pg_pic,
            pg_img: gamme.pg_img,
            pg_display: gamme.pg_display,
            pg_level: gamme.pg_level
          });
        }
      });

      // 🚀 ÉTAPE 5: Finalisation ORDER BY MF_SORT (comme votre PHP)
      familiesMap.forEach((family) => {
        family.gammes_count = family.gammes.length;
      });

      const families = Array.from(familiesMap.values())
        .sort((a, b) => a.mf_sort - b.mf_sort);

      const totalFamilies = families.length;
      const totalGammes = families.reduce((sum, family) => sum + family.gammes_count, 0);
      const seoValid = totalFamilies >= 3 && totalGammes >= 5;

      this.logger.log(`🎉 [SUCCÈS PHP] ${totalFamilies} familles, ${totalGammes} gammes FILTRÉES pour véhicule ${typeId}`);

      return {
        families,
        success: true,
        totalFamilies,
        totalGammes,
        seoValid,
        message: `Catalogue véhicule filtré: ${totalFamilies} familles trouvées`,
        queryType: 'PIECES_RELATION_TYPE_PHP_SUCCESS'
      };

    } catch (error: any) {
      this.logger.error(`❌ Erreur méthode PHP: ${error.message}`);
      return this.getFallbackGeneric(typeId);
    }
  }

  /**
   *  Pièces populaires pour le véhicule
   */
  async getPopularPiecesForVehicle(typeId: number, limit: number = 48): Promise<PopularPartV3[]> {
    try {
      // Placeholder - vous pouvez implémenter la logique réelle plus tard
      return [];
    } catch (error: any) {
      this.logger.error(`❌ Erreur pièces populaires: ${error.message}`);
      return [];
    }
  }

  /**
   * ⚡ Méthode appelée par le contrôleur
   */
  async getVehicleCatalogWithPopularParts(typeId: number): Promise<{
    catalog: CatalogV3Response;
    popularParts: PopularPartV3[];
  }> {
    return this.getCatalogAndPopularParts(typeId);
  }

  /**
   * 🔄 Fallback générique quand pieces_relation_type timeout
   */
  private async getFallbackGeneric(typeId: number): Promise<CatalogV3Response> {
    try {
      this.logger.log(`🔄 [FALLBACK] Utilisation fallback générique pour type_id: ${typeId}`);
      
      // Retourner un catalogue générique basique
      const { data: familiesData } = await this.supabase
        .from('catalog_family')
        .select(`
          mf_id,
          mf_name,
          mf_name_system,
          mf_description,
          mf_pic,
          mf_display,
          mf_sort
        `)
        .eq('mf_display', 1)
        .order('mf_sort')
        .limit(10);

      const families: CatalogFamilyV3[] = (familiesData || []).map(family => ({
        mf_id: family.mf_id,
        mf_name: family.mf_name_system || family.mf_name,
        mf_name_system: family.mf_name_system,
        mf_description: family.mf_description,
        mf_pic: family.mf_pic,
        mf_display: family.mf_display,
        mf_sort: family.mf_sort,
        gammes: [], // Pas de gammes dans le fallback
        gammes_count: 0
      }));

      this.logger.log(`✅ [FALLBACK] ${families.length} familles génériques retournées`);

      return {
        families,
        success: true,
        totalFamilies: families.length,
        totalGammes: 0,
        seoValid: false,
        message: `Fallback générique: ${families.length} familles disponibles`,
        queryType: 'GENERIC_FALLBACK'
      };

    } catch (error: any) {
      this.logger.error(`❌ Erreur fallback: ${error.message}`);
      return {
        families: [],
        success: false,
        totalFamilies: 0,
        totalGammes: 0,
        seoValid: false,
        message: 'Erreur lors de la récupération du catalogue',
        queryType: 'ERROR_FALLBACK'
      };
    }
  }

  /**
   * 🔍 Diagnostic pieces_relation_type
   */
  async diagnosticPiecesRelationType(): Promise<any> {
    try {
      const { count, error } = await this.supabase
        .from('pieces_relation_type')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw new Error(error.message);
      }

      // Échantillon de type_ids
      const { data: sampleData } = await this.supabase
        .from('pieces_relation_type')
        .select('rtp_type_id')
        .order('rtp_type_id')
        .limit(10);

      return {
        success: true,
        total_records: count,
        available_type_ids: sampleData?.map(r => r.rtp_type_id) || [],
        message: `Table pieces_relation_type: ${count} enregistrements`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        total_records: 0,
        available_type_ids: []
      };
    }
  }
}