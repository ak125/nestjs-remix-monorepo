// 📁 backend/src/modules/catalog/services/unified-page-data.service.ts
// ⚡ Service unifié - 1 RPC au lieu de ~33 requêtes Supabase
// 🎯 Utilise get_pieces_for_type_gamme_v3 (SEO intégré côté PostgreSQL) ou V2 en fallback

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { SeoSwitchesService } from './seo-switches.service';
import { decodeHtmlEntities } from '../../../utils/html-entities';

/**
 * ⚡ Interface du résultat de la RPC V2
 */
interface RpcV2Result {
  // Nouvelles données unifiées
  vehicle_info: {
    type_id: number;
    type_name: string;
    type_alias: string;
    type_power_ps: string;
    type_power_kw: string;
    type_year_from: string;
    type_year_to: string;
    type_body: string;
    type_fuel: string;
    type_engine: string;
    type_liter: string;
    modele_id: number;
    modele_name: string;
    modele_alias: string;
    modele_pic: string;
    marque_id: number;
    marque_name: string;
    marque_alias: string;
    marque_logo: string;
    motor_codes: string;
  } | null;
  gamme_info: {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_pic: string;
    mf_id: string;
  } | null;
  seo_templates: {
    h1: string;
    content: string;
    title: string;
    description: string;
    preview: string;
  } | null;
  oem_refs: string[];

  // Données pièces existantes
  pieces: any[];
  grouped_pieces: any[];
  blocs: any[];
  filters: any;
  count: number;
  minPrice: number;
  relations_found: number;
  success: boolean;
  version: string;
  duration: string;
}

/**
 * ⚡ Interface du résultat de la RPC V3 (avec SEO déjà processé)
 */
interface RpcV3Result extends RpcV2Result {
  // SEO déjà processé côté PostgreSQL
  seo: {
    h1: string;
    title: string;
    description: string;
    content: string;
    preview: string;
  };
}

/**
 * ⚡ Interface du résultat unifié pour le frontend
 */
export interface UnifiedPageData {
  // SEO processé
  seo: {
    success: boolean;
    h1: string | null;
    content: string | null;
    description: string | null;
    title: string | null;
    preview: string | null;
    keywords: string | null;
  };

  // Infos véhicule formatées
  vehicle: {
    type: {
      id: number;
      name: string;
      alias: string;
      power_ps: string;
      power_kw: string;
      yearFrom: string;
      yearTo: string;
      body: string;
      fuel: string;
      engine: string;
      liter: string;
    };
    modele: { id: number; name: string; alias: string; pic: string };
    marque: { id: number; name: string; alias: string; logo: string };
    motorCodes: string;
  } | null;

  // Infos gamme formatées
  gamme: {
    id: number;
    name: string;
    alias: string;
    pic: string;
    mfId: string;
  } | null;

  // Références OEM
  oemRefs: string[];

  // Pièces
  pieces: any[];
  groupedPieces: any[];
  blocs: any[];
  filters: any;
  count: number;
  minPrice: number;

  // Metadata
  success: boolean;
  source: 'rpc_v3_seo_integrated' | 'rpc_v2_unified' | 'legacy_batch';
  duration: string;
  cacheHit: boolean;
}

@Injectable()
export class UnifiedPageDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(UnifiedPageDataService.name);
  private readonly useSeparateOemRpc: boolean;
  private readonly useRpcV3: boolean;
  private rpcV3Available: boolean | null = null;

  constructor(
    private readonly cacheService: CacheService,
    private readonly seoSwitchesService: SeoSwitchesService,
    private readonly appConfigService: ConfigService,
  ) {
    super();
    // Feature flag: si true, appelle get_oem_refs_for_vehicle séparément
    // Utile si les index OEM ne suffisent pas et que la V2 timeout
    this.useSeparateOemRpc =
      this.appConfigService.get<string>('USE_SEPARATE_OEM_RPC') === 'true';
    if (this.useSeparateOemRpc) {
      this.logger.log('⚠️ Mode OEM séparé activé (USE_SEPARATE_OEM_RPC=true)');
    }
    
    // Feature flag: si true, utilise RPC V3 avec SEO intégré côté PostgreSQL
    // Par défaut true pour bénéficier des performances optimisées
    this.useRpcV3 =
      this.appConfigService.get<string>('USE_RPC_V3') !== 'false';
    this.logger.log(`🚀 Mode RPC: ${this.useRpcV3 ? 'V3 (SEO intégré)' : 'V2 (SEO JS)'}`);
  }

  /**
   * ⚡ Récupère TOUTES les données d'une page /pieces/{gamme}/{marque}/{modele}/{type}.html
   *    en 1 seul appel RPC + traitement SEO switches côté JS
   *
   * @param typeId - ID du type véhicule (ex: 9045)
   * @param pgId - ID de la gamme (ex: 4 = Alternateur)
   * @returns UnifiedPageData - Toutes les données formatées pour le frontend
   */
  async getPageData(typeId: number, pgId: number): Promise<UnifiedPageData> {
    const startTime = Date.now();
    const cacheKey = `unified:page:${typeId}:${pgId}`;

    try {
      // 1. Tentative lecture cache Redis (TTL: 15min)
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        const result = JSON.parse(cached) as UnifiedPageData;
        
        // ⚠️ Validation cache: rejeter si OEM vide alors qu'il devrait y en avoir
        // (bug corrigé le 10/12/2025 - anciennes entrées cache corrompues)
        if (result.oemRefs?.length === 0 && result.count > 0) {
          this.logger.warn(
            `⚠️ Cache invalide détecté (OEM vide avec pièces) - type=${typeId} pg=${pgId} - Suppression`,
          );
          await this.cacheService.del(cacheKey);
          // Continue vers l'appel RPC
        } else {
          this.logger.log(
            `⚡ Cache HIT unified page - type=${typeId} pg=${pgId}, oem=${result.oemRefs?.length || 0}`,
          );
          result.cacheHit = true;
          return result;
        }
      }

      // 2. Essayer RPC V3 d'abord (SEO intégré côté PostgreSQL)
      if (this.useRpcV3) {
        const v3Result = await this.tryRpcV3(typeId, pgId, startTime, cacheKey);
        if (v3Result) {
          return v3Result;
        }
        // V3 non disponible, fallback sur V2
        this.logger.warn('⚠️ RPC V3 non disponible, fallback sur V2');
      }

      // 3. Fallback: RPC V2 avec traitement SEO côté JS
      return await this.getPageDataWithV2(typeId, pgId, startTime, cacheKey);
    } catch (error) {
      this.logger.error(`❌ Erreur getPageData:`, error);

      // Retour d'un résultat vide en cas d'erreur
      return {
        seo: {
          success: false,
          h1: null,
          content: null,
          description: null,
          title: null,
          preview: null,
          keywords: null,
        },
        vehicle: null,
        gamme: null,
        oemRefs: [],
        pieces: [],
        groupedPieces: [],
        blocs: [],
        filters: { success: false, data: { filters: [], summary: {} } },
        count: 0,
        minPrice: 0,
        success: false,
        source: 'rpc_v2_unified',
        duration: `${Date.now() - startTime}ms`,
        cacheHit: false,
      };
    }
  }

  /**
   * 🚀 RPC V3 - SEO intégré côté PostgreSQL (optimal)
   *    Retourne les données avec SEO déjà processé
   */
  private async tryRpcV3(
    typeId: number,
    pgId: number,
    startTime: number,
    cacheKey: string,
  ): Promise<UnifiedPageData | null> {
    try {
      this.logger.log(`🚀 Appel RPC V3 pour type=${typeId} pg=${pgId}`);
      
      const { data, error } = await this.supabase.rpc(
        'get_pieces_for_type_gamme_v3',
        {
          p_type_id: typeId,
          p_pg_id: pgId,
        },
      );

      if (error) {
        if (error.message?.includes('does not exist')) {
          this.logger.warn('⚠️ RPC V3 non déployée, fallback V2');
          this.rpcV3Available = false;
          return null;
        }
        this.logger.error(`❌ Erreur RPC V3:`, error);
        return null;
      }

      this.rpcV3Available = true;
      const rpcResult = data as RpcV3Result;
      
      // 🎯 V3: Les OEM refs sont maintenant intégrées DIRECTEMENT dans grouped_pieces
      // Plus besoin d'enrichissement côté JS - tout est fait dans la RPC PostgreSQL
      const groupedPiecesWithOem = (rpcResult.grouped_pieces || []).map((g: any) => ({
        ...g,
        // La RPC V3 fournit déjà oemRefs et oemRefsCount par groupe (avec déduplication globale)
        oemRefs: g.oemRefs || [],
        oemRefsCount: g.oemRefsCount || g.oemRefs?.length || 0,
      }));
      
      // Compter le total des OEM refs par groupe pour le log
      const totalGroupOem = groupedPiecesWithOem.reduce((sum: number, g: any) => sum + (g.oemRefsCount || 0), 0);
      
      this.logger.log(
        `✅ RPC V3 retourné en ${rpcResult.duration} - ${rpcResult.count} pièces, ` +
        `oem_global=${rpcResult.oem_refs?.length || 0}, oem_groupes=${totalGroupOem}`,
      );

      // SEO déjà processé côté PostgreSQL - juste décoder les entités HTML
      const seo = rpcResult.seo ? {
        success: true,
        h1: decodeHtmlEntities(rpcResult.seo.h1 || ''),
        content: decodeHtmlEntities(rpcResult.seo.content || ''),
        description: decodeHtmlEntities(rpcResult.seo.description || ''),
        title: decodeHtmlEntities(rpcResult.seo.title || ''),
        preview: decodeHtmlEntities(rpcResult.seo.preview || ''),
        keywords: null,
      } : {
        success: false,
        h1: null,
        content: null,
        description: null,
        title: null,
        preview: null,
        keywords: null,
      };

      const result: UnifiedPageData = {
        seo,
        vehicle: rpcResult.vehicle_info
          ? {
              type: {
                id: rpcResult.vehicle_info.type_id,
                name: rpcResult.vehicle_info.type_name,
                alias: rpcResult.vehicle_info.type_alias,
                power_ps: rpcResult.vehicle_info.type_power_ps,
                power_kw: rpcResult.vehicle_info.type_power_kw,
                yearFrom: rpcResult.vehicle_info.type_year_from,
                yearTo: rpcResult.vehicle_info.type_year_to,
                body: rpcResult.vehicle_info.type_body,
                fuel: rpcResult.vehicle_info.type_fuel,
                engine: rpcResult.vehicle_info.type_engine,
                liter: rpcResult.vehicle_info.type_liter,
              },
              modele: {
                id: rpcResult.vehicle_info.modele_id,
                name: rpcResult.vehicle_info.modele_name,
                alias: rpcResult.vehicle_info.modele_alias,
                pic: rpcResult.vehicle_info.modele_pic,
              },
              marque: {
                id: rpcResult.vehicle_info.marque_id,
                name: rpcResult.vehicle_info.marque_name,
                alias: rpcResult.vehicle_info.marque_alias,
                logo: rpcResult.vehicle_info.marque_logo,
              },
              motorCodes: rpcResult.vehicle_info.motor_codes || '',
            }
          : null,
        gamme: rpcResult.gamme_info
          ? {
              id: rpcResult.gamme_info.pg_id,
              name: rpcResult.gamme_info.pg_name,
              alias: rpcResult.gamme_info.pg_alias,
              pic: rpcResult.gamme_info.pg_pic,
              mfId: rpcResult.gamme_info.mf_id,
            }
          : null,
        oemRefs: rpcResult.oem_refs || [],
        pieces: rpcResult.pieces || [],
        groupedPieces: groupedPiecesWithOem,
        blocs: groupedPiecesWithOem, // blocs = same as groupedPieces with OEM (from RPC V3)
        filters: rpcResult.filters || {
          success: false,
          data: { filters: [], summary: {} },
        },
        count: rpcResult.count || 0,
        minPrice: rpcResult.minPrice || 0,
        success: rpcResult.success,
        source: 'rpc_v3_seo_integrated',
        duration: `${Date.now() - startTime}ms`,
        cacheHit: false,
      };

      // Mise en cache Redis (TTL: 15min = 900s)
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(result), 900);
        this.logger.log(`💾 Page unifiée V3 mise en cache - ${cacheKey}`);
      } catch (cacheError) {
        this.logger.warn('⚠️ Erreur mise en cache:', cacheError);
      }

      return result;
    } catch (err) {
      this.logger.error('❌ Exception RPC V3:', err);
      return null;
    }
  }

  /**
   * 🔄 RPC V2 - Avec traitement SEO côté JavaScript (fallback)
   */
  private async getPageDataWithV2(
    typeId: number,
    pgId: number,
    startTime: number,
    cacheKey: string,
  ): Promise<UnifiedPageData> {
    this.logger.log(
      `🔍 Cache MISS - Appel RPC V2 unifié pour type=${typeId} pg=${pgId}`,
    );

    try {
      // 2. Appel unique à la RPC V2
      const { data, error } = await this.supabase.rpc(
        'get_pieces_for_type_gamme_v2',
        {
          p_type_id: typeId,
          p_pg_id: pgId,
        },
      );

      if (error) {
        this.logger.error(`❌ Erreur RPC V2:`, error);
        throw error;
      }

      // DEBUG: Voir la structure exacte du résultat
      this.logger.log(`🔍 DEBUG RPC V2 data keys: ${Object.keys(data || {}).join(', ')}`);
      this.logger.log(`🔍 DEBUG RPC V2 oem_refs type: ${typeof data?.oem_refs}, isArray: ${Array.isArray(data?.oem_refs)}, length: ${data?.oem_refs?.length}`);
      if (data?.oem_refs?.length > 0) {
        this.logger.log(`🔍 DEBUG First 3 OEM refs: ${JSON.stringify(data.oem_refs.slice(0, 3))}`);
      }

      const rpcResult = data as RpcV2Result;
      this.logger.log(
        `✅ RPC V2 retourné en ${rpcResult.duration} - ${rpcResult.count} pièces, oem_refs=${rpcResult.oem_refs?.length || 0}`,
      );

      // 2b. OEM refs: utiliser celles de la RPC V2
      // NOTE: On ne fait plus d'appel RPC OEM séparé car ça cause des timeouts
      // La RPC V2 contient déjà les OEM refs quand disponibles
      let oemRefs = rpcResult.oem_refs || [];
      
      if (oemRefs.length > 0) {
        this.logger.log(`✅ OEM refs incluses dans RPC V2: ${oemRefs.length} références`);
      } else {
        this.logger.log(`ℹ️ Pas d'OEM refs disponibles pour ce véhicule/gamme`);
      }

      // 3. Traitement des SEO switches côté JS (si templates disponibles)
      const seo = await this.processSeoTemplates(rpcResult, typeId, pgId);

      // 4. Formatage du résultat final
      const result: UnifiedPageData = {
        seo,
        vehicle: rpcResult.vehicle_info
          ? {
              type: {
                id: rpcResult.vehicle_info.type_id,
                name: rpcResult.vehicle_info.type_name,
                alias: rpcResult.vehicle_info.type_alias,
                power_ps: rpcResult.vehicle_info.type_power_ps,
                power_kw: rpcResult.vehicle_info.type_power_kw,
                yearFrom: rpcResult.vehicle_info.type_year_from,
                yearTo: rpcResult.vehicle_info.type_year_to,
                body: rpcResult.vehicle_info.type_body,
                fuel: rpcResult.vehicle_info.type_fuel,
                engine: rpcResult.vehicle_info.type_engine,
                liter: rpcResult.vehicle_info.type_liter,
              },
              modele: {
                id: rpcResult.vehicle_info.modele_id,
                name: rpcResult.vehicle_info.modele_name,
                alias: rpcResult.vehicle_info.modele_alias,
                pic: rpcResult.vehicle_info.modele_pic,
              },
              marque: {
                id: rpcResult.vehicle_info.marque_id,
                name: rpcResult.vehicle_info.marque_name,
                alias: rpcResult.vehicle_info.marque_alias,
                logo: rpcResult.vehicle_info.marque_logo,
              },
              motorCodes: rpcResult.vehicle_info.motor_codes || '',
            }
          : null,
        gamme: rpcResult.gamme_info
          ? {
              id: rpcResult.gamme_info.pg_id,
              name: rpcResult.gamme_info.pg_name,
              alias: rpcResult.gamme_info.pg_alias,
              pic: rpcResult.gamme_info.pg_pic,
              mfId: rpcResult.gamme_info.mf_id,
            }
          : null,
        oemRefs: oemRefs,
        pieces: rpcResult.pieces || [],
        groupedPieces: rpcResult.grouped_pieces || [],
        blocs: rpcResult.blocs || [],
        filters: rpcResult.filters || {
          success: false,
          data: { filters: [], summary: {} },
        },
        count: rpcResult.count || 0,
        minPrice: rpcResult.minPrice || 0,
        success: rpcResult.success,
        source: 'rpc_v2_unified',
        duration: `${Date.now() - startTime}ms`,
        cacheHit: false,
      };

      // 5. Mise en cache Redis (TTL: 15min = 900s)
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(result), 900);
        this.logger.log(`💾 Page unifiée V2 mise en cache - ${cacheKey}`);
      } catch (cacheError) {
        this.logger.warn('⚠️ Erreur mise en cache:', cacheError);
      }

      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur getPageDataWithV2:`, error);

      // Retour d'un résultat vide en cas d'erreur
      return {
        seo: {
          success: false,
          h1: null,
          content: null,
          description: null,
          title: null,
          preview: null,
          keywords: null,
        },
        vehicle: null,
        gamme: null,
        oemRefs: [],
        pieces: [],
        groupedPieces: [],
        blocs: [],
        filters: { success: false, data: { filters: [], summary: {} } },
        count: 0,
        minPrice: 0,
        success: false,
        source: 'rpc_v2_unified',
        duration: `${Date.now() - startTime}ms`,
        cacheHit: false,
      };
    }
  }

  /**
   * 🔧 Traitement des templates SEO avec remplacement des variables et switches
   *    Côté JS pour flexibilité (formules complexes comme (typeId + offset) % count)
   */
  private async processSeoTemplates(
    rpcResult: RpcV2Result,
    typeId: number,
    pgId: number,
  ): Promise<UnifiedPageData['seo']> {
    const templates = rpcResult.seo_templates;
    const vehicleInfo = rpcResult.vehicle_info;
    const gammeInfo = rpcResult.gamme_info;

    if (!templates || !vehicleInfo || !gammeInfo) {
      this.logger.warn(
        `⚠️ Templates SEO manquants pour type=${typeId} pg=${pgId}`,
      );
      return {
        success: false,
        h1: null,
        content: null,
        description: null,
        title: null,
        preview: null,
        keywords: null,
      };
    }

    try {
      // Préparer le contexte pour le remplacement des variables
      const vehicle = {
        marque: vehicleInfo.marque_name,
        modele: vehicleInfo.modele_name,
        type: vehicleInfo.type_name,
        nbCh: vehicleInfo.type_power_ps || '',
      };

      const vehicleInfoFormatted = {
        marque: vehicleInfo.marque_name,
        modele: vehicleInfo.modele_name,
        type: vehicleInfo.type_name,
        nbCh: vehicleInfo.type_power_ps || '',
        marqueAlias: vehicleInfo.marque_alias,
        modeleAlias: vehicleInfo.modele_alias,
        typeAlias: vehicleInfo.type_alias,
        motorCodes: vehicleInfo.motor_codes || '',
      };

      const gammeInfoFormatted = {
        gamme: gammeInfo.pg_name,
        gammeAlias: gammeInfo.pg_alias,
      };

      const context = {
        typeId,
        pgId,
        mfId: gammeInfo.mf_id,
      };

      // 🚀 SUPER PREFETCH: Charger TOUTES les données pour les 5 templates en une seule fois
      const mfIdNumber = gammeInfo.mf_id
        ? parseInt(gammeInfo.mf_id)
        : undefined;
      
      const seoStartTime = Date.now();
      this.logger.log(
        `🚀 [SEO] Super prefetch pour pgId=${pgId}, mfId=${mfIdNumber}`,
      );
      const prefetchStartTime = Date.now();
      
      // Utiliser le super prefetch qui analyse TOUS les templates et charge TOUT en batch
      const allTemplates = [templates.h1, templates.content, templates.description, templates.title, templates.preview];
      const { prefetched: prefetchedSwitches, gammesMap, switchesByPgAndAlias, switchesByPg } = 
        await this.seoSwitchesService.prefetchAllSwitchesForTemplates(
          this.supabase,
          allTemplates,
          pgId,
          mfIdNumber,
        );
      this.logger.log(`⏱️ [SEO] Super prefetch: ${Date.now() - prefetchStartTime}ms (gammes: ${gammesMap.size}, switches: ${switchesByPg.size} pgIds)`);

      // Traitement parallèle des 5 champs SEO - SANS nouvelles requêtes DB
      const batchCacheData = { gammesMap, switchesByPgAndAlias, switchesByPg };
      const [
        processedH1,
        processedContent,
        processedDescription,
        processedTitle,
        processedPreview,
      ] = await Promise.all([
        this.replaceVariablesAndSwitches(
          templates.h1,
          vehicle,
          vehicleInfoFormatted,
          gammeInfoFormatted,
          context,
          prefetchedSwitches,
          batchCacheData,
        ),
        this.replaceVariablesAndSwitches(
          templates.content,
          vehicle,
          vehicleInfoFormatted,
          gammeInfoFormatted,
          context,
          prefetchedSwitches,
          batchCacheData,
        ),
        this.replaceVariablesAndSwitches(
          templates.description,
          vehicle,
          vehicleInfoFormatted,
          gammeInfoFormatted,
          context,
          prefetchedSwitches,
          batchCacheData,
        ),
        this.replaceVariablesAndSwitches(
          templates.title,
          vehicle,
          vehicleInfoFormatted,
          gammeInfoFormatted,
          context,
          prefetchedSwitches,
          batchCacheData,
        ),
        this.replaceVariablesAndSwitches(
          templates.preview,
          vehicle,
          vehicleInfoFormatted,
          gammeInfoFormatted,
          context,
          prefetchedSwitches,
          batchCacheData,
        ),
      ]);
      
      this.logger.log(`⏱️ [SEO] Traitement 5 champs complet: ${Date.now() - seoStartTime}ms`);

      return {
        success: true,
        h1: decodeHtmlEntities(processedH1),
        content: decodeHtmlEntities(processedContent),
        description: decodeHtmlEntities(processedDescription),
        title: decodeHtmlEntities(processedTitle),
        preview: decodeHtmlEntities(processedPreview),
        keywords: null,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement SEO:`, error);
      return {
        success: false,
        h1: null,
        content: null,
        description: null,
        title: null,
        preview: null,
        keywords: null,
      };
    }
  }

  /**
   * 🔧 Remplace les variables et switches dans un template SEO
   *    (Copie de la logique de GammeUnifiedService pour éviter dépendance circulaire)
   */
  private async replaceVariablesAndSwitches(
    template: string | null,
    vehicle: { marque: string; modele: string; type: string; nbCh: string },
    vehicleInfo: any,
    gammeInfo: any,
    context: { typeId: number; pgId: number; mfId: string },
    prefetchedSwitches: any,
    batchCacheData?: {
      gammesMap: Map<number, { pg_id: number; pg_name: string; pg_alias: string }>;
      switchesByPgAndAlias: Map<string, any[]>;
      switchesByPg: Map<number, any[]>;
    },
  ): Promise<string> {
    if (!template) return '';

    let result = template;

    // 1. Remplacement des variables simples (premier passage)
    result = this.applyVariableReplacements(
      result,
      vehicle,
      vehicleInfo,
      gammeInfo,
    );

    // 2. Traitement des switches via SeoSwitchesService.processAllSwitches
    //    Passer le batchCacheData pour éviter des requêtes DB supplémentaires
    result = await this.seoSwitchesService.processAllSwitches(
      this.supabase,
      result,
      vehicle,
      {
        typeId: context.typeId,
        pgId: context.pgId,
        mfId: context.mfId ? parseInt(context.mfId) : undefined,
      },
      prefetchedSwitches,
      {
        marqueId: undefined,
        modeleId: undefined,
        typeId: context.typeId,
        marqueAlias: vehicleInfo.marqueAlias,
        modeleAlias: vehicleInfo.modeleAlias,
        typeAlias: vehicleInfo.typeAlias,
      },
      batchCacheData, // 🚀 Passer les données pré-chargées
    );

    // 3. Remplacement des variables simples (deuxième passage pour les variables dans les switches)
    result = this.applyVariableReplacements(
      result,
      vehicle,
      vehicleInfo,
      gammeInfo,
    );

    return result;
  }

  /**
   * 🛠️ Applique les remplacements de variables standard
   */
  private applyVariableReplacements(
    text: string,
    vehicle: { marque: string; modele: string; type: string; nbCh: string },
    vehicleInfo: any,
    gammeInfo: any,
  ): string {
    let result = text;

    // Variables véhicule
    result = result.replace(/#VMarque#/g, vehicle.marque || '');
    result = result.replace(/#VModele#/g, vehicle.modele || '');
    result = result.replace(/#VType#/g, vehicle.type || '');
    result = result.replace(/#VNbCh#/g, vehicle.nbCh || '');
    result = result.replace(/#VAnnee#/g, vehicleInfo.annee || '');
    result = result.replace(/#VCarosserie#/g, vehicleInfo.carosserie || '');
    result = result.replace(/#VMotorisation#/g, vehicleInfo.motorisation || '');
    result = result.replace(
      /#VCodeMoteur#/g,
      vehicleInfo.codeMoteur || vehicleInfo.motorCodes || '',
    );

    // Variables gamme
    result = result.replace(/#Gamme#/g, gammeInfo.gamme || '');
    result = result.replace(/#GammeAlias#/g, gammeInfo.gammeAlias || '');

    // Variables phrases génériques
    result = result.replace(/#VousPropose#/g, 'vous propose');
    result = result.replace(/#PrixPasCher#/g, 'pas cher');
    result = result.replace(/#MinPrice#/g, '');

    // Variables contextuelles
    result = result.replace(
      /#LinkCarAll#/g,
      `${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicleInfo.carosserie || ''} ${vehicleInfo.annee || ''} ${vehicle.nbCh} ch ${vehicleInfo.codeMoteur || ''}`.trim(),
    );
    result = result.replace(
      /#LinkCar#/g,
      `${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicleInfo.motorisation || ''} ${vehicle.nbCh} ch`.trim(),
    );

    return result;
  }

  /**
   * ✅ Vérifie si la RPC V2 est disponible
   */
  async isRpcV2Available(): Promise<boolean> {
    try {
      // Test avec des IDs bidon pour vérifier que la fonction existe
      const { error } = await this.supabase.rpc(
        'get_pieces_for_type_gamme_v2',
        {
          p_type_id: 0,
          p_pg_id: 0,
        },
      );

      // Si pas d'erreur "function does not exist", c'est OK
      if (error && error.message?.includes('does not exist')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 🔄 FALLBACK: Récupère les OEM refs via RPC séparée
   *    Utilisé si USE_SEPARATE_OEM_RPC=true ou si les refs sont vides dans V2
   *    Appelle get_oem_refs_for_vehicle qui est optimisée pour cette tâche
   */
  private async fetchOemRefsSeparately(
    typeId: number,
    pgId: number,
    marqueName: string,
  ): Promise<string[]> {
    if (!marqueName) {
      this.logger.warn('⚠️ Pas de marque véhicule pour OEM refs');
      return [];
    }

    try {
      this.logger.log(
        `🔄 Appel RPC OEM séparé: get_oem_refs_for_vehicle(${typeId}, ${pgId}, ${marqueName})`,
      );

      const { data, error } = await this.supabase.rpc(
        'get_oem_refs_for_vehicle',
        {
          p_type_id: typeId,
          p_pg_id: pgId,
          p_marque_name: marqueName,
        },
      );

      if (error) {
        this.logger.error('❌ Erreur RPC OEM séparé:', error);
        return [];
      }

      const oemData = data as {
        vehicleMarque: string;
        oemRefs: string[];
        count: number;
        duration_ms: number;
      };

      this.logger.log(
        `✅ OEM refs récupérées: ${oemData.count} refs en ${oemData.duration_ms}ms`,
      );

      return oemData.oemRefs || [];
    } catch (err) {
      this.logger.error('❌ Exception RPC OEM:', err);
      return [];
    }
  }

  /**
   * 🎯 Enrichit les groupedPieces avec les OEM refs distribuées par groupe
   *    Fetch toutes les OEM refs en 1 batch, puis distribue selon les pièces de chaque groupe
   * 
   * @param groupedPieces - Les groupes de pièces (Avant, Arrière, etc.)
   * @param allOemRefs - Les OEM refs retournées par RPC (niveau racine)
   * @param marqueName - Nom de la marque véhicule pour filtrer les OEM
   * @param pieces - Liste plate des pièces pour récupérer les IDs
   * @returns groupedPieces enrichis avec oemRefs par groupe
   */
  private async enrichGroupsWithOemRefs(
    groupedPieces: any[],
    allOemRefs: string[],
    marqueName: string,
    pieces: any[],
  ): Promise<any[]> {
    // Si pas d'OEM refs ou pas de groupes, retourner tel quel
    if (!allOemRefs?.length || !groupedPieces?.length) {
      this.logger.log('ℹ️ Pas d\'OEM refs ou pas de groupes à enrichir');
      return groupedPieces.map(g => ({ ...g, oemRefs: [], oemRefsCount: 0 }));
    }

    try {
      // Récupérer tous les IDs de pièces
      const allPieceIds = pieces.map(p => p.id?.toString()).filter(Boolean);
      if (!allPieceIds.length) {
        this.logger.warn('⚠️ Aucun ID de pièce trouvé');
        return groupedPieces.map(g => ({ ...g, oemRefs: [], oemRefsCount: 0 }));
      }

      // Récupérer le prb_id de la marque véhicule
      this.logger.log(`🔍 Recherche OEM pour marque véhicule: "${marqueName}"`);
      
      const { data: brandData } = await this.supabase
        .from('pieces_ref_brand')
        .select('prb_id, prb_name')
        .ilike('prb_name', marqueName)
        .limit(1)
        .single();

      if (!brandData?.prb_id) {
        this.logger.warn(`⚠️ Marque OEM non trouvée dans pieces_ref_brand: ${marqueName}`);
        return groupedPieces.map(g => ({ ...g, oemRefs: [], oemRefsCount: 0 }));
      }

      this.logger.log(`✅ Marque OEM trouvée: "${brandData.prb_name}" (prb_id=${brandData.prb_id}) - Filtrage OEM uniquement pour cette marque`);

      // Récupérer les OEM refs avec leur piece_id associé (1 batch query)
      const { data: oemData, error } = await this.supabase
        .from('pieces_ref_search')
        .select('prs_piece_id, prs_ref')
        .in('prs_piece_id', allPieceIds)
        .eq('prs_prb_id', brandData.prb_id)
        .eq('prs_kind', '3')
        .limit(500);

      if (error) {
        this.logger.error('❌ Erreur fetch OEM par pièce:', error);
        return groupedPieces.map(g => ({ ...g, oemRefs: [], oemRefsCount: 0 }));
      }

      // Construire Map: pieceId -> Set<oemRef>
      const oemByPiece = new Map<string, Set<string>>();
      for (const row of oemData || []) {
        const pieceId = row.prs_piece_id;
        if (!oemByPiece.has(pieceId)) {
          oemByPiece.set(pieceId, new Set());
        }
        oemByPiece.get(pieceId)!.add(row.prs_ref);
      }

      this.logger.log(`🔗 OEM mapping: ${oemByPiece.size} pièces avec OEM refs`);

      // Distribuer les OEM refs à chaque groupe selon ses pièces
      const enrichedGroups = groupedPieces.map(group => {
        const groupPieceIds = (group.pieces || []).map((p: any) => p.id?.toString()).filter(Boolean);
        const groupOemRefs = new Set<string>();

        for (const pieceId of groupPieceIds) {
          const refs = oemByPiece.get(pieceId);
          if (refs) {
            refs.forEach(ref => groupOemRefs.add(ref));
          }
        }

        const oemRefsArray = Array.from(groupOemRefs);
        return {
          ...group,
          oemRefs: oemRefsArray,
          oemRefsCount: oemRefsArray.length,
        };
      });

      const totalOemInGroups = enrichedGroups.reduce((sum, g) => sum + (g.oemRefsCount || 0), 0);
      this.logger.log(`✅ OEM refs distribuées: ${totalOemInGroups} refs dans ${enrichedGroups.filter(g => g.oemRefsCount > 0).length} groupes`);

      return enrichedGroups;
    } catch (err) {
      this.logger.error('❌ Exception enrichGroupsWithOemRefs:', err);
      return groupedPieces.map(g => ({ ...g, oemRefs: [], oemRefsCount: 0 }));
    }
  }
}
