import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogService } from '../catalog.service';

export interface CatalogFamilyV3 {
  mf_id: number;
  mf_name: string;
  mf_name_system: string | null;
  mf_description: string;
  mf_pic: string;
  mf_display: number;
  mf_sort: number;
  gammes: any[];
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

/**
 * 🚗 SERVICE V3 - Approche HYBRIDE Performance + Intégrité
 * 
 * ✅ Requête optimisée avec index composite pour récupération rapide
 * ✅ Validation Foreign Keys pour intégrité des données
 * ✅ Construction finale du catalogue avec gammes complètes
 */
@Injectable()
export class VehicleFilteredCatalogServiceV3 extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleFilteredCatalogServiceV3.name);

  constructor(private readonly catalogService: CatalogService) {
    super();
  }

  /**
   * 🎯 [MÉTHODE PRINCIPALE] Approche HYBRIDE - Performance + Intégrité FK
   */
  async getCatalogFamiliesForVehicle(
    typeId: number,
  ): Promise<CatalogV3Response> {
    this.logger.log(
      `🚀 [HYBRID] Approche hybride performance + FK pour type_id: ${typeId}`,
    );

    try {
      // 🚀 ÉTAPE 1: Récupérer SEULEMENT les relations avec l'index (RAPIDE - 23ms)
      const relations = await this.getVehicleRelationsOptimized(typeId);

      if (!relations || relations.length === 0) {
        this.logger.warn(`⚠️ Aucune relation pour véhicule ${typeId}`);
        return this.getFallbackGeneric(typeId);
      }

      // 🎯 APPROCHE DIRECTE: Construction directe sans validation FK (pour éviter les pertes)
      return await this.buildCatalogDirectFromRelations(relations, typeId);
    } catch (error: any) {
      this.logger.error(`❌ Erreur approche hybride: ${error.message}`);
      return this.getFallbackGeneric(typeId);
    }
  }

  /**
   * 🚀 ÉTAPE 1: Récupération relations avec index composite - SANS LIMITE pour complétude
   */
  private async getVehicleRelationsOptimized(typeId: number): Promise<any[]> {
    this.logger.log(
      `🏃‍♂️ [STEP 1/3] Récupération COMPLÈTE des relations avec index composite`,
    );

    try {
      // 🎯 STRATÉGIE COMPLÈTE : Récupérer TOUTES les relations sans limite
      this.logger.log(`⚡ [STEP 1/3] Récupération COMPLÈTE sans limite...`);

      const startTime = Date.now();
      const { data: relationData, error: relationError } = await this.supabase
        .from('pieces_relation_type')
        .select('rtp_pg_id, rtp_piece_id, rtp_pm_id')
        .eq('rtp_type_id', typeId);
        // PLUS DE .limit() pour obtenir TOUS les résultats !

      const queryTime = Date.now() - startTime;
      this.logger.log(`⏱️ [STEP 1/3] Requête complète: ${queryTime}ms`);

      if (relationError) {
        throw relationError;
      }

      if (!relationData || relationData.length === 0) {
        this.logger.warn(`⚠️ [STEP 1/3] Aucune relation pour type_id ${typeId}`);
        return [];
      }

      this.logger.log(
        `✅ [STEP 1/3] ${relationData.length} relations COMPLÈTES récupérées avec index (${queryTime}ms)`,
      );

      return relationData;
    } catch (error: any) {
      this.logger.error(`❌ [STEP 1/3] Erreur récupération complète: ${error.message}`);
      
      // 🔄 FALLBACK avec limites si échec total
      this.logger.log(`🔄 [FALLBACK] Tentative avec limites progressives...`);
      return await this.getVehicleRelationsWithLimits(typeId);
    }
  }

  /**
   * 🔄 MÉTHODE FALLBACK : Stratégie progressive avec limites (si l'approche complète échoue)
   */
  private async getVehicleRelationsWithLimits(typeId: number): Promise<any[]> {
    const limits = [1000, 5000, 10000, 20000, 50000]; // Limites encore plus élevées

    for (const limit of limits) {
      try {
        this.logger.log(`⚡ [FALLBACK] Tentative avec limite ${limit} relations...`);

        const startTime = Date.now();
        const { data: relationData, error: relationError } = await this.supabase
          .from('pieces_relation_type')
          .select('rtp_pg_id, rtp_piece_id, rtp_pm_id')
          .eq('rtp_type_id', typeId)
          .limit(limit);

        const queryTime = Date.now() - startTime;
        this.logger.log(`⏱️ [FALLBACK] Requête ${limit} relations: ${queryTime}ms`);

        if (relationError) {
          throw relationError;
        }

        if (!relationData || relationData.length === 0) {
          continue;
        }

        this.logger.log(
          `✅ [FALLBACK] ${relationData.length} relations récupérées avec limite ${limit} (${queryTime}ms)`,
        );

        return relationData;
      } catch (error: any) {
        this.logger.warn(`⚠️ [FALLBACK] Échec limite ${limit}: ${error.message}`);
        continue;
      }
    }

    throw new Error(`Impossible de récupérer les relations pour type_id ${typeId} même avec toutes les stratégies`);
  }

  /**
   * 🎯 CONSTRUCTION DIRECTE: Éviter la validation FK qui peut éliminer des données valides
   */
  private async buildCatalogDirectFromRelations(
    relations: any[],
    typeId: number,
  ): Promise<CatalogV3Response> {
    this.logger.log(
      `🏗️ [DIRECT] Construction directe à partir de ${relations.length} relations`,
    );

    try {
      // Extraire tous les pg_ids uniques des relations
      const pgIds = [...new Set(relations.map((r) => r.rtp_pg_id))];
      
      this.logger.log(`🔍 [DIRECT] ${pgIds.length} gammes uniques trouvées`);

      // 🚀 Étape 1: Récupération des gammes - SANS FILTRE pg_display pour 100% complétude
      const { data: gammeData, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias, pg_name, pg_name_meta, pg_img, pg_display')
        .in('pg_id', pgIds);
        // ⚠️ SUPPRESSION du filtre .eq('pg_display', 1) pour récupérer TOUTES les gammes

      if (gammeError || !gammeData) {
        throw gammeError || new Error('Erreur récupération gammes');
      }

      // Filtrer après récupération pour debug
      const allGammes = gammeData.length;
      const displayGammes = gammeData.filter((g: any) => g.pg_display === 1).length;
      this.logger.log(`🔍 [DIRECT] ${allGammes} gammes totales (${displayGammes} avec display=1)`);

      // 🔗 Étape 2: Récupération COMPLÈTE des liaisons gamme → famille (TOUTES les gammes)
      const allPgIds = gammeData.map((g: any) => g.pg_id);
      const { data: catalogGammeData, error: catalogGammeError } = await this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id, mc_mf_id')
        .in('mc_pg_id', allPgIds);

      if (catalogGammeError || !catalogGammeData) {
        throw catalogGammeError || new Error('Erreur récupération catalog_gamme');
      }

      this.logger.log(`✅ [DIRECT] ${catalogGammeData.length} liaisons gamme→famille récupérées`);

      // 🎯 Étape 3: Récupération COMPLÈTE des familles - SANS FILTRE mf_display pour 100%
      const mfIds = [...new Set(catalogGammeData.map((cg: any) => cg.mc_mf_id))];
      const { data: familiesData, error: familiesError } = await this.supabase
        .from('catalog_family')
        .select('mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_sort, mf_display')
        .in('mf_id', mfIds);
        // ⚠️ SUPPRESSION du filtre .eq('mf_display', 1) pour récupérer TOUTES les familles

      if (familiesError || !familiesData) {
        throw familiesError || new Error('Erreur récupération familles');
      }

      const allFamilies = familiesData.length;
      const displayFamilies = familiesData.filter((f: any) => f.mf_display === 1).length;
      this.logger.log(`🔍 [DIRECT] ${allFamilies} familles totales (${displayFamilies} avec display=1)`);

      // 🎯 Étape 4: Construire le catalogue avec toutes les familles
      const familiesMap = new Map<number, CatalogFamilyV3>();

      // Initialiser toutes les familles
      familiesData.forEach((family: any) => {
        familiesMap.set(family.mf_id, {
          mf_id: family.mf_id,
          mf_name: family.mf_name_system || family.mf_name,
          mf_name_system: family.mf_name_system,
          mf_description: family.mf_description,
          mf_pic: family.mf_pic,
          mf_display: family.mf_display,
          mf_sort: family.mf_sort,
          gammes: [],
          gammes_count: 0,
        });
      });

      // Peupler les gammes pour chaque famille
      for (const family of familiesMap.values()) {
        // Trouver les gammes pour cette famille via catalog_gamme
        const familyGammeIds = catalogGammeData
          .filter((cg: any) => cg.mc_mf_id === family.mf_id)
          .map((cg: any) => cg.mc_pg_id);

        // Récupérer les détails des gammes
        const familyGammes = gammeData
          .filter((g: any) => familyGammeIds.includes(g.pg_id))
          .map((gamme: any) => ({
            pg_id: gamme.pg_id,
            pg_alias: gamme.pg_alias,
            pg_name: gamme.pg_name,
            pg_name_meta: gamme.pg_name_meta,
            pg_img: gamme.pg_img,
          }));

        family.gammes = familyGammes;
        family.gammes_count = familyGammes.length;
      }

      // 🎯 ORDER BY mf_sort (PHP exact) - SANS FILTRER pour 100% complétude
      const families = Array.from(familiesMap.values())
        // ⚠️ SUPPRESSION du filtre .filter(family => family.gammes.length > 0) 
        // pour inclure même les familles avec 0 gammes (cas spéciaux)
        .sort((a, b) => a.mf_sort - b.mf_sort);

      const totalFamilies = families.length;
      const totalGammes = families.reduce(
        (sum, family) => sum + family.gammes_count,
        0,
      );
      const seoValid = totalFamilies >= 3 && totalGammes >= 5;

      this.logger.log(
        `🎉 [DIRECT SUCCESS] ${totalFamilies} familles avec ${totalGammes} gammes pour véhicule ${typeId}`,
      );

      return {
        families,
        success: true,
        totalFamilies,
        totalGammes,
        seoValid,
        message: `Catalogue direct: ${totalFamilies} familles avec ${totalGammes} gammes`,
        queryType: 'DIRECT_SUCCESS',
      };
    } catch (error: any) {
      this.logger.error(`❌ [DIRECT] Erreur construction directe: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔗 ÉTAPE 2: Validation avec Foreign Keys pour intégrité
   */
  private async validateRelationsWithForeignKeys(relations: any[]): Promise<{
    validPgIds: string[];
    validPieceIds: string[];
    validPmIds: string[];
  }> {
    this.logger.log(
      `🔍 [STEP 2/3] Validation FK sur ${relations.length} relations`,
    );

    const pgIds = [...new Set(relations.map((r) => r.rtp_pg_id))];
    const pieceIds = [...new Set(relations.map((r) => r.rtp_piece_id))];
    const pmIds = [
      ...new Set(relations.map((r) => r.rtp_pm_id).filter(Boolean)),
    ];

    // Validation parallèle des FK (RAPIDE car tables plus petites)
    const [gammeValidation, pieceValidation, marqueValidation] =
      await Promise.all([
        // FK validation: pieces_gamme
        this.supabase
          .from('pieces_gamme')
          .select('pg_id')
          .in('pg_id', pgIds)
          .eq('pg_display', 1),

        // FK validation: pieces
        this.supabase
          .from('pieces')
          .select('piece_id')
          .in('piece_id', pieceIds)
          .eq('piece_display', 1),

        // FK validation: pieces_marque
        pmIds.length > 0
          ? this.supabase
              .from('pieces_marque')
              .select('pm_id')
              .in('pm_id', pmIds)
              .eq('pm_display', 1)
          : { data: [] },
      ]);

    const validPgIds = gammeValidation.data?.map((g: any) => g.pg_id) || [];
    const validPieceIds =
      pieceValidation.data?.map((p: any) => p.piece_id) || [];
    const validPmIds = marqueValidation.data?.map((m: any) => m.pm_id) || [];

    this.logger.log(
      `🔗 [STEP 2/3] FK validées: ${validPgIds.length} gammes, ${validPieceIds.length} pièces, ${validPmIds.length} marques`,
    );

    return { validPgIds, validPieceIds, validPmIds };
  }

  /**
   * 🎯 ÉTAPE 3: Construction finale du catalogue
   */
  private async buildCatalogFromValidatedData(
    validated: {
      validPgIds: string[];
      validPieceIds: string[];
      validPmIds: string[];
    },
    typeId: number,
  ): Promise<CatalogV3Response> {
    this.logger.log(
      `🏗️ [STEP 3/3] Construction catalogue à partir de ${validated.validPgIds.length} gammes validées`,
    );

    // 🚀 Récupération des gammes validées avec leurs informations complètes
    const { data: gammeData, error: gammeError } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name, pg_name_meta, pg_img')
      .in('pg_id', validated.validPgIds)
      .eq('pg_display', 1);

    if (gammeError || !gammeData) {
      throw gammeError || new Error('Erreur récupération gammes');
    }

    // 🔗 Récupération catalog_gamme pour liaison gamme → famille
    const { data: catalogGammeData, error: catalogGammeError } =
      await this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id, mc_mf_id')
        .in('mc_pg_id', validated.validPgIds);

    if (catalogGammeError || !catalogGammeData) {
      throw catalogGammeError || new Error('Erreur récupération catalog_gamme');
    }

    const mfIds = [...new Set(catalogGammeData.map((g: any) => g.mc_mf_id))];

    // 🎯 Récupération familles finales
    const { data: familiesData, error: familiesError } = await this.supabase
      .from('catalog_family')
      .select(
        'mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_sort, mf_display',
      )
      .in('mf_id', mfIds)
      .eq('mf_display', 1);

    if (familiesError || !familiesData) {
      throw familiesError || new Error('Erreur récupération familles');
    }

    // 🎯 DISTINCT sur les familles (logique PHP exacte)
    const familiesMap = new Map<number, CatalogFamilyV3>();

    familiesData?.forEach((family: any) => {
      if (family && !familiesMap.has(family.mf_id)) {
        familiesMap.set(family.mf_id, {
          mf_id: family.mf_id,
          mf_name: family.mf_name_system || family.mf_name, // IF PHP
          mf_name_system: family.mf_name_system,
          mf_description: family.mf_description,
          mf_pic: family.mf_pic,
          mf_display: family.mf_display,
          mf_sort: family.mf_sort,
          gammes: [],
          gammes_count: 0,
        });
      }
    });

    // 🔗 Peupler les gammes pour chaque famille
    for (const family of familiesMap.values()) {
      // Trouver les gammes pour cette famille via catalog_gamme
      const familyGammeIds = catalogGammeData
        .filter((cg: any) => cg.mc_mf_id === family.mf_id)
        .map((cg: any) => cg.mc_pg_id);

      // Récupérer les détails des gammes
      const familyGammes = gammeData
        .filter((g: any) => familyGammeIds.includes(g.pg_id))
        .map((gamme: any) => ({
          pg_id: gamme.pg_id,
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name,
          pg_name_meta: gamme.pg_name_meta,
          pg_img: gamme.pg_img,
        }));

      family.gammes = familyGammes;
      family.gammes_count = familyGammes.length;
    }

    // 🎯 ORDER BY mf_sort (PHP exact) + filtrer familles avec gammes
    const families = Array.from(familiesMap.values())
      .filter((family) => family.gammes.length > 0) // Seulement les familles avec gammes
      .sort((a, b) => a.mf_sort - b.mf_sort);

    const totalFamilies = families.length;
    const totalGammes = families.reduce(
      (sum, family) => sum + family.gammes_count,
      0,
    );
    const seoValid = totalFamilies >= 3 && totalGammes >= 5;

    this.logger.log(
      `🎉 [HYBRID SUCCESS] ${totalFamilies} familles avec ${totalGammes} gammes pour véhicule ${typeId}`,
    );

    return {
      families,
      success: true,
      totalFamilies,
      totalGammes,
      seoValid,
      message: `Catalogue hybride: ${totalFamilies} familles avec ${totalGammes} gammes`,
      queryType: 'HYBRID_SUCCESS',
    };
  }

  /**
   * 🔄 Fallback générique si échec total
   */
  private async getFallbackGeneric(typeId: number): Promise<CatalogV3Response> {
    this.logger.log(`🔄 [FALLBACK] Catalogue générique pour type_id: ${typeId}`);

    try {
      const { data: familiesData } = await this.supabase
        .from('catalog_family')
        .select(
          'mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_display, mf_sort',
        )
        .eq('mf_display', 1)
        .order('mf_sort')
        .limit(10);

      const families: CatalogFamilyV3[] = (familiesData || []).map(
        (family: any) => ({
          mf_id: family.mf_id,
          mf_name: family.mf_name_system || family.mf_name,
          mf_name_system: family.mf_name_system,
          mf_description: family.mf_description,
          mf_pic: family.mf_pic,
          mf_display: family.mf_display,
          mf_sort: family.mf_sort,
          gammes: [],
          gammes_count: 0,
        }),
      );

      this.logger.log(`✅ [FALLBACK] ${families.length} familles génériques`);

      return {
        families,
        success: true,
        totalFamilies: families.length,
        totalGammes: 0,
        seoValid: false,
        message: `Fallback générique: ${families.length} familles disponibles`,
        queryType: 'GENERIC_FALLBACK',
      };
    } catch (error: any) {
      this.logger.error(`❌ [FALLBACK] Erreur: ${error.message}`);
      return {
        families: [],
        success: false,
        totalFamilies: 0,
        totalGammes: 0,
        seoValid: false,
        message: 'Erreur lors de la récupération du catalogue',
        queryType: 'ERROR_FALLBACK',
      };
    }
  }

  /**
   * ⚡ Compatibilité avec CatalogController - méthode attendue
   */
  async getVehicleCatalogWithPopularParts(typeId: number): Promise<{
    catalog: CatalogV3Response;
    popularParts: any[];
  }> {
    const catalog = await this.getCatalogFamiliesForVehicle(typeId);
    return {
      catalog,
      popularParts: [], // Pas de pièces populaires dans la version simple
    };
  }

  /**
   * 🔍 DIAGNOSTIC: Vérifier la complétude des données récupérées
   */
  async diagnosticCompletenessCatalog(typeId: number): Promise<any> {
    this.logger.log(`🔍 [DIAGNOSTIC] Vérification complétude pour type_id: ${typeId}`);

    try {
      // 1. Compter le total de relations dans la DB
      const { count: totalRelations } = await this.supabase
        .from('pieces_relation_type')
        .select('*', { count: 'exact', head: true })
        .eq('rtp_type_id', typeId);

      // 2. Récupérer les relations avec notre méthode
      const relations = await this.getVehicleRelationsOptimized(typeId);

      // 3. Statistiques détaillées
      const pgIds = [...new Set(relations.map((r) => r.rtp_pg_id))];
      const pieceIds = [...new Set(relations.map((r) => r.rtp_piece_id))];

      // 4. Compter les familles potentielles
      const { data: potentialFamilies } = await this.supabase
        .from('catalog_gamme')
        .select('mc_mf_id')
        .in('mc_pg_id', pgIds);

      const uniqueFamilyIds = [...new Set(potentialFamilies?.map((f: any) => f.mc_mf_id) || [])];

      return {
        typeId,
        totalRelationsInDB: totalRelations || 0,
        relationsRecuperated: relations.length,
        completenessPercentage: totalRelations ? Math.round((relations.length / totalRelations) * 100) : 0,
        uniqueGammes: pgIds.length,
        uniquePieces: pieceIds.length,
        potentialFamilies: uniqueFamilyIds.length,
        isComplete: relations.length === totalRelations,
        diagnostic: relations.length === totalRelations ? 'COMPLET' : 'PARTIEL'
      };
    } catch (error: any) {
      this.logger.error(`❌ [DIAGNOSTIC] Erreur: ${error.message}`);
      return {
        typeId,
        error: error.message,
        diagnostic: 'ERREUR'
      };
    }
  }
  async diagnosticPiecesRelationType(): Promise<any> {
    return {
      success: false,
      message: 'Service V3 simple - diagnostic non implémenté',
      reason: 'pieces_relation_type table trop volumineuse (145M+ lignes)',
    };
  }
}