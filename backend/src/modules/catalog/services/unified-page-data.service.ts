// 📁 backend/src/modules/catalog/services/unified-page-data.service.ts
// ⚡ Service unifié - 1 RPC au lieu de ~33 requêtes Supabase
// 🎯 Utilise get_pieces_for_type_gamme_v3 (SEO intégré côté PostgreSQL)

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import {
  decodeHtmlEntities,
  stripHtmlForMeta,
} from '../../../utils/html-entities';
// ⚠️ IMAGES: Utiliser image-urls.utils.ts - NE PAS définir de constantes locales
import { buildProxyImageUrl, IMAGE_CONFIG } from '../utils/image-urls.utils';

/**
 * 🖼️ Génère une URL d'image via proxy /img/*
 * ✅ Utilise les fonctions centralisées de image-urls.utils.ts
 */
function getOptimizedImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '';

  // Si déjà URL complète ou proxy, retourner telle quelle
  if (relativePath.startsWith('http') || relativePath.startsWith('/img/')) {
    return relativePath;
  }

  // Déterminer le bucket selon le préfixe
  let bucket: string = IMAGE_CONFIG.BUCKETS.UPLOADS;
  let path = relativePath;

  if (relativePath.startsWith('/rack/')) {
    bucket = IMAGE_CONFIG.BUCKETS.RACK_IMAGES;
    path = relativePath.replace('/rack/', '');
  } else if (relativePath.startsWith('/upload/')) {
    bucket = IMAGE_CONFIG.BUCKETS.UPLOADS;
    path = relativePath.replace('/upload/', '');
  } else if (relativePath.startsWith('/')) {
    path = relativePath.substring(1);
  }

  // ✅ Utiliser le proxy /img/* via fonction centralisée
  return buildProxyImageUrl(bucket, path);
}

/**
 * ⚡ Interface du résultat de la RPC V3 (avec SEO déjà processé côté PostgreSQL)
 */
interface RpcV3Result {
  // Données véhicule
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

  // Données gamme
  gamme_info: {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_pic: string;
    mf_id: string;
  } | null;

  // SEO déjà processé côté PostgreSQL (remplacements variables + switches)
  seo: {
    h1: string;
    title: string;
    description: string;
    content: string;
    preview: string;
  };

  // Références OEM constructeur
  oem_refs: string[];

  // Données pièces
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
  source: 'rpc_v3_seo_integrated';
  duration: string;
  cacheHit: boolean;
}

@Injectable()
export class UnifiedPageDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(UnifiedPageDataService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
    this.logger.log('🚀 UnifiedPageDataService initialisé - Mode RPC V3 Only');
  }

  /**
   * ⚡ Récupère TOUTES les données d'une page /pieces/{gamme}/{marque}/{modele}/{type}.html
   *    en 1 seul appel RPC V3 (SEO intégré côté PostgreSQL)
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

      // 2. Appel RPC V3 uniquement (SEO intégré côté PostgreSQL)
      const result = await this.callRpcV3(typeId, pgId, startTime, cacheKey);
      return result;
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
        source: 'rpc_v3_seo_integrated',
        duration: `${Date.now() - startTime}ms`,
        cacheHit: false,
      };
    }
  }

  /**
   * 🚀 RPC V3 - SEO intégré côté PostgreSQL (optimal)
   *    Retourne les données avec SEO déjà processé
   *    Throw une erreur en cas d'échec (pas de fallback)
   */
  private async callRpcV3(
    typeId: number,
    pgId: number,
    startTime: number,
    cacheKey: string,
  ): Promise<UnifiedPageData> {
    this.logger.log(`🚀 Appel RPC V3 pour type=${typeId} pg=${pgId}`);

    const { data, error } = await this.supabase.rpc(
      'get_pieces_for_type_gamme_v3',
      {
        p_type_id: typeId,
        p_pg_id: pgId,
      },
    );

    if (error) {
      this.logger.error(`❌ Erreur RPC V3: ${error.message}`);
      throw new Error(`RPC V3 failed: ${error.message}`);
    }

    if (!data) {
      this.logger.error(
        `❌ RPC V3 retourne null pour type=${typeId} pg=${pgId}`,
      );
      throw new Error(`RPC V3 returned no data for type=${typeId} pg=${pgId}`);
    }

    const rpcResult = data as RpcV3Result;

    // 🎯 V3: Les OEM refs sont maintenant intégrées DIRECTEMENT dans grouped_pieces
    // Plus besoin d'enrichissement côté JS - tout est fait dans la RPC PostgreSQL
    const groupedPiecesWithOem = (rpcResult.grouped_pieces || []).map(
      (g: any) => ({
        ...g,
        // La RPC V3 fournit déjà oemRefs et oemRefsCount par groupe (avec déduplication globale)
        oemRefs: g.oemRefs || [],
        oemRefsCount: g.oemRefsCount || g.oemRefs?.length || 0,
      }),
    );

    // Compter le total des OEM refs par groupe pour le log
    const totalGroupOem = groupedPiecesWithOem.reduce(
      (sum: number, g: any) => sum + (g.oemRefsCount || 0),
      0,
    );

    this.logger.log(
      `✅ RPC V3 retourné en ${rpcResult.duration} - ${rpcResult.count} pièces, ` +
        `oem_global=${rpcResult.oem_refs?.length || 0}, oem_groupes=${totalGroupOem}`,
    );

    // 🖼️ Optimiser les URLs d'images avec WebP + compression
    const piecesWithOptimizedImages = (rpcResult.pieces || []).map(
      (piece: any) => ({
        ...piece,
        image: getOptimizedImageUrl(piece.image),
        thumb: getOptimizedImageUrl(piece.thumb || piece.image),
      }),
    );

    const groupedPiecesWithOptimizedImages = groupedPiecesWithOem.map(
      (group: any) => ({
        ...group,
        pieces: (group.pieces || []).map((piece: any) => ({
          ...piece,
          image: getOptimizedImageUrl(piece.image),
          thumb: getOptimizedImageUrl(piece.thumb || piece.image),
        })),
      }),
    );

    // SEO déjà processé côté PostgreSQL - décoder les entités HTML
    // 🧹 PRÉVENTION SEO: stripHtmlForMeta sur description pour éviter HTML dans meta
    const seo = rpcResult.seo
      ? {
          success: true,
          h1: decodeHtmlEntities(rpcResult.seo.h1 || ''),
          content: decodeHtmlEntities(rpcResult.seo.content || ''),
          // 🎯 Meta description: nettoyer HTML pour éviter indexation Google cassée
          description: stripHtmlForMeta(rpcResult.seo.description || ''),
          title: decodeHtmlEntities(rpcResult.seo.title || ''),
          preview: decodeHtmlEntities(rpcResult.seo.preview || ''),
          keywords: null,
        }
      : {
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
              pic: getOptimizedImageUrl(rpcResult.vehicle_info.modele_pic),
            },
            marque: {
              id: rpcResult.vehicle_info.marque_id,
              name: rpcResult.vehicle_info.marque_name,
              alias: rpcResult.vehicle_info.marque_alias,
              logo: getOptimizedImageUrl(rpcResult.vehicle_info.marque_logo),
            },
            motorCodes: rpcResult.vehicle_info.motor_codes || '',
          }
        : null,
      gamme: rpcResult.gamme_info
        ? {
            id: rpcResult.gamme_info.pg_id,
            name: rpcResult.gamme_info.pg_name,
            alias: rpcResult.gamme_info.pg_alias,
            pic: getOptimizedImageUrl(rpcResult.gamme_info.pg_pic),
            mfId: rpcResult.gamme_info.mf_id,
          }
        : null,
      oemRefs: rpcResult.oem_refs || [],
      pieces: piecesWithOptimizedImages,
      groupedPieces: groupedPiecesWithOptimizedImages,
      blocs: groupedPiecesWithOptimizedImages, // blocs = same as groupedPieces with OEM (from RPC V3)
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

    // Mise en cache Redis (TTL: 24h = 86400s pour données quasi-statiques)
    try {
      await this.cacheService.set(cacheKey, JSON.stringify(result), 86400);
      this.logger.log(`💾 Page unifiée V3 mise en cache - ${cacheKey}`);
    } catch (cacheError) {
      this.logger.warn('⚠️ Erreur mise en cache:', cacheError);
    }

    return result;
  }
}
