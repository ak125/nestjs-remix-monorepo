import { TABLES } from '@repo/database-types';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { sleep } from '../../../utils/promise-helpers';
import { getErrorMessage } from '@common/utils/error.utils';

export interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  mc_sort?: number;
  pg_sort?: number;
}

interface CatalogFamily {
  mf_id: number | string;
  mf_name: string;
  mf_name_system: string;
  mf_description: string;
  mf_pic: string;
  mf_sort: number;
  gammes_count: number;
  gammes: CatalogGamme[];
}

export interface SeoValidation {
  familyCount: number;
  gammeCount: number;
  isIndexable: boolean;
}

export interface FilteredCatalog {
  queryType: string;
  families: CatalogFamily[];
  totalFamilies: number;
  totalGammes: number;
  seoValidation?: SeoValidation;
  optimizationLevel?: string;
  message?: string;
}

interface GammeRow {
  pg_id: number | string;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  pg_level?: string;
}

interface FamilyRow {
  mf_id: string;
  mf_name: string;
  mf_name_system: string;
  mf_description: string;
  mf_pic: string;
  mf_sort: string;
}

interface CatalogGammeRow {
  mc_pg_id: string;
  mc_mf_id: string;
  mc_sort: string;
}

interface CatalogMetrics {
  responseTime: number;
  cacheHitRatio: number;
  completenessScore: number;
  queryComplexity: number;
  source: 'CACHE' | 'DATABASE' | 'PRECOMPUTED';
}

interface VehiclePopularityStats {
  typeId: number;
  requestCount: number;
  lastAccessed: Date;
  avgResponseTime: number;
}

interface CatalogResult {
  catalog: FilteredCatalog;
  metrics: CatalogMetrics;
  timestamp: Date;
}

interface CacheEntry {
  data: FilteredCatalog;
  timestamp: Date;
  ttl: number;
}

@Injectable()
export class VehicleFilteredCatalogV4HybridService
  extends SupabaseBaseService
  implements OnModuleDestroy
{
  protected readonly logger = new Logger(
    VehicleFilteredCatalogV4HybridService.name,
  );

  // 💾 Cache en mémoire (remplace Redis pour simplicité)
  private memoryCache = new Map<string, CacheEntry>();
  private static readonly MAX_CACHE_ENTRIES = 5000;

  // 📊 Stats en mémoire pour TTL adaptatif
  private vehicleStats = new Map<number, VehiclePopularityStats>();
  private static readonly MAX_STATS_ENTRIES = 2000;

  // 🎯 Métriques globales
  private globalMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    avgResponseTime: 0,
    topVehicles: [] as number[],
  };

  // 🧹 Cleanup interval
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
    // Cleanup toutes les 10 minutes : purge entrées expirées + éviction LRU
    this.cleanupInterval = setInterval(() => this.evictStaleEntries(), 600_000);
    this.logger.log('🚀 V4 Hybrid Service initialized with memory cache');
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
    this.vehicleStats.clear();
    this.logger.log('V4 Hybrid Service destroyed, caches cleared');
  }

  /** Purge expired cache entries + evict oldest when over limit */
  private evictStaleEntries(): void {
    const now = Date.now();

    // 1. Purge expired cache entries
    for (const [key, entry] of this.memoryCache) {
      if (now > entry.timestamp.getTime() + entry.ttl * 1000) {
        this.memoryCache.delete(key);
      }
    }

    // 2. Evict oldest cache entries if over limit
    if (
      this.memoryCache.size >
      VehicleFilteredCatalogV4HybridService.MAX_CACHE_ENTRIES
    ) {
      const sorted = [...this.memoryCache.entries()].sort(
        (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime(),
      );
      const toRemove = sorted.slice(
        0,
        this.memoryCache.size -
          VehicleFilteredCatalogV4HybridService.MAX_CACHE_ENTRIES,
      );
      for (const [key] of toRemove) this.memoryCache.delete(key);
    }

    // 3. Evict least-accessed vehicleStats if over limit
    if (
      this.vehicleStats.size >
      VehicleFilteredCatalogV4HybridService.MAX_STATS_ENTRIES
    ) {
      const sorted = [...this.vehicleStats.entries()].sort(
        (a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime(),
      );
      const toRemove = sorted.slice(
        0,
        this.vehicleStats.size -
          VehicleFilteredCatalogV4HybridService.MAX_STATS_ENTRIES,
      );
      for (const [key] of toRemove) this.vehicleStats.delete(key);
    }

    this.logger.debug(
      `Cache cleanup: ${this.memoryCache.size} cache entries, ${this.vehicleStats.size} stats entries`,
    );
  }

  /**
   * 🎯 MÉTHODE PRINCIPALE - CATALOGUE OPTIMISÉ V4
   */
  async getCatalogV4Optimized(typeId: number): Promise<CatalogResult> {
    const startTime = Date.now();

    try {
      // 📊 Mise à jour statistiques
      this.updateVehicleStats(typeId);
      this.globalMetrics.totalRequests++;

      // 1️⃣ CHECK CACHE INTELLIGENT FIRST
      const cached = this.getCachedCatalog(typeId);
      if (cached) {
        this.globalMetrics.cacheHits++;
        const responseTime = Date.now() - startTime;

        this.logger.log(
          `⚡ [CACHE HIT] V4 type_id ${typeId}: ${responseTime}ms`,
        );

        return {
          catalog: cached,
          metrics: {
            responseTime,
            cacheHitRatio:
              this.globalMetrics.cacheHits / this.globalMetrics.totalRequests,
            completenessScore: 100,
            queryComplexity: 0,
            source: 'CACHE',
          },
          timestamp: new Date(),
        };
      }

      // 2️⃣ REQUÊTES PARALLÈLES OPTIMISÉES
      this.logger.log(
        `🔄 [DATABASE] V4 construction parallèle pour type_id ${typeId}...`,
      );

      const catalog = await this.buildCatalogParallel(typeId);
      const responseTime = Date.now() - startTime;

      // 3️⃣ MISE EN CACHE INTELLIGENTE
      this.setCachedCatalog(typeId, catalog);

      this.logger.log(
        `✅ [SUCCESS] V4 type_id ${typeId}: ${responseTime}ms - Cached pour future`,
      );

      return {
        catalog,
        metrics: {
          responseTime,
          cacheHitRatio:
            this.globalMetrics.cacheHits / this.globalMetrics.totalRequests,
          completenessScore: this.calculateCompleteness(catalog),
          queryComplexity: catalog.families?.length || 0,
          source: 'DATABASE',
        },
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `❌ [ERROR] V4 type_id ${typeId}: ${error instanceof Error ? error.message : String(error)} (${responseTime}ms)`,
      );
      throw error;
    }
  }

  /**
   * 🔥 V4 ULTIMATE HYBRID: Stratégie progressive avec 3 niveaux de fallback
   *
   * Niveau 1 (optimal): Vue matérialisée mv_vehicle_compatible_gammes (5-10ms)
   * Niveau 2 (backup): Table pieces_relation_type avec index composite (1-2s)
   * Niveau 3 (fallback): Catalogue complet non filtré (ultime secours)
   *
   * 📊 Performance attendue:
   * - Vue matérialisée: 5-10ms (données < 24h)
   * - Index composite: 1-2s (si vue stale/indisponible)
   * - Catalogue complet: 50-100ms (si aucune donnée compatible)
   */
  private async buildCatalogParallel(typeId: number): Promise<FilteredCatalog> {
    this.logger.log(`🔍 [V4 HYBRID] Catalogue pour type_id ${typeId}`);

    // ============================================
    // NIVEAU 1: Essayer la vue matérialisée (optimal - 5-10ms)
    // ============================================
    try {
      const mvStartTime = Date.now();
      const { data: mvData, error: mvError } = await this.supabase
        .from('mv_vehicle_compatible_gammes')
        .select('pg_id, pieces_count, last_updated')
        .eq('type_id', typeId);

      const mvDuration = Date.now() - mvStartTime;

      if (!mvError && mvData && mvData.length > 0) {
        // Vérifier fraîcheur des données (< 24h)
        const lastUpdated = new Date(mvData[0].last_updated);
        const ageHours =
          (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

        if (ageHours < 24) {
          const pgIds = mvData.map((row) => row.pg_id);
          this.logger.log(
            `🚀 [NIVEAU 1 - VUE MATÉRIALISÉE] ${pgIds.length} gammes en ${mvDuration}ms (fraîcheur: ${ageHours.toFixed(1)}h)`,
          );
          return this.fetchCatalogFromGammes(pgIds, 'V4_MATERIALIZED_VIEW');
        } else {
          this.logger.warn(
            `⚠️ [NIVEAU 1] Vue stale (${ageHours.toFixed(1)}h) → Fallback niveau 2`,
          );
        }
      } else if (mvError) {
        this.logger.warn(
          `⚠️ [NIVEAU 1] Erreur vue matérialisée: ${mvError.message} → Fallback niveau 2`,
        );
      }
    } catch (mvException) {
      this.logger.warn(
        `⚠️ [NIVEAU 1] Exception vue matérialisée: ${getErrorMessage(mvException)} → Fallback niveau 2`,
      );
    }

    // ============================================
    // NIVEAU 2: RPC Function avec index composite + JOIN PHP (backup - 1-2s)
    // ============================================
    try {
      const indexStartTime = Date.now();

      // 🎯 LOGIQUE PHP EXACTE via RPC Function: get_vehicle_compatible_gammes_php
      // Utilise explicit JOINs pour contourner les limitations Supabase FK
      // SELECT DISTINCT pg_id FROM pieces_relation_type
      // JOIN pieces ON piece_id = rtp_piece_id AND piece_pg_id = rtp_pg_id
      // JOIN pieces_gamme ON pg_id = piece_pg_id
      // WHERE rtp_type_id = ? AND piece_display = true AND pg_display = '1' AND pg_level IN ('1','2')

      const { data: rpcData, error: rpcError } = await this.callRpc<
        Array<{ pg_id: number }>
      >(
        'get_vehicle_compatible_gammes_php',
        { p_type_id: typeId },
        { source: 'api' },
      );

      const indexDuration = Date.now() - indexStartTime;

      if (rpcError) {
        this.logger.error(
          `❌ [NIVEAU 2] Erreur RPC: ${JSON.stringify(rpcError)} → Fallback niveau 3`,
        );
      } else if (!rpcData || rpcData.length === 0) {
        this.logger.warn(
          `⚠️ [NIVEAU 2] Aucune gamme trouvée pour type_id ${typeId} → Fallback niveau 3`,
        );
      } else {
        // Extraire les IDs uniques de gammes compatibles (déjà filtrés par PHP logic)
        const pgIds = rpcData
          .map((row) => row.pg_id)
          .filter((id) => id !== null);

        this.logger.log(
          `⚡ [NIVEAU 2 - RPC PHP FILTERS] ${pgIds.length} gammes en ${indexDuration}ms`,
        );

        return this.fetchCatalogFromGammes(pgIds, 'V4_RPC_PHP_LOGIC');
      }
    } catch (indexException) {
      this.logger.error(
        `❌ [NIVEAU 2] Exception: ${getErrorMessage(indexException)} → Fallback niveau 3`,
      );
    }

    // ============================================
    // NIVEAU 3: Catalogue complet (fallback ultime)
    // ============================================
    this.logger.warn(
      `🆘 [NIVEAU 3 - FALLBACK] Catalogue complet non filtré pour type_id ${typeId}`,
    );
    return this.buildCompleteCatalogFallback();
  }

  /**
   * 🔧 Fonction utilitaire: Récupérer le catalogue à partir d'une liste de gammes
   */
  private async fetchCatalogFromGammes(
    pgIds: number[],
    queryType: string,
  ): Promise<FilteredCatalog> {
    // 🔧 Conversion des IDs en strings pour compatibilité avec colonnes text
    const pgIdsAsStrings = pgIds.map((id) => id.toString());

    // 🎯 Récupérer gammes et catalogue en parallèle
    const [gammesResult, catalogGammeResult] = await Promise.all([
      this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_alias, pg_name, pg_name_meta, pg_img, pg_level')
        .in('pg_id', pgIds)
        .eq('pg_display', '1'),
      // ⚠️ SUPPRIMÉ: .in('pg_level', ['1', '2']) - Trop restrictif, exclut beaucoup de gammes
      this.supabase
        .from(TABLES.catalog_gamme)
        .select('mc_pg_id, mc_mf_id, mc_sort')
        .in('mc_pg_id', pgIdsAsStrings),
    ]);

    if (gammesResult.error || catalogGammeResult.error) {
      const error = gammesResult.error || catalogGammeResult.error;
      this.logger.error(
        `❌ [${queryType}] Erreur gammes: ${JSON.stringify(error)}`,
      );
      throw error;
    }

    const mfIds = [
      ...new Set(catalogGammeResult.data.map((cg) => cg.mc_mf_id)),
    ];

    // 🎯 Récupérer les familles (mf_id déjà en string depuis catalog_gamme)
    const { data: familiesData, error: familiesError } = await this.supabase
      .from(TABLES.catalog_family)
      .select('mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_sort')
      .in('mf_id', mfIds)
      .eq('mf_display', '1');

    if (familiesError) {
      this.logger.error(
        `❌ [${queryType}] Erreur familles: ${JSON.stringify(familiesError)}`,
      );
      throw familiesError;
    }

    // 🔗 Construction catalogue filtré avec le type de query
    return this.buildFilteredCatalogFromParts(
      familiesData,
      catalogGammeResult.data,
      gammesResult.data,
      queryType,
    );
  }

  /**
   * 🏗️ CONSTRUCTION CATALOGUE FILTRÉ - DÉDUPLIQUER ET REGROUPER
   * 💡 À partir des données déjà récupérées (familles, catalog_gamme, pieces_gamme)
   */
  private buildFilteredCatalogFromParts(
    familiesData: FamilyRow[],
    catalogGammeData: CatalogGammeRow[],
    gammesData: GammeRow[],
    queryType: string = 'V4_FILTERED',
  ): FilteredCatalog {
    // 🔧 Maps avec clés STRING (Supabase retourne pg_id=integer mais mf_id=string)
    const gammeMap = new Map(gammesData.map((g) => [String(g.pg_id), g]));
    const familyMap = new Map(familiesData.map((f) => [String(f.mf_id), f]));
    const familyGammesMap = new Map<string, CatalogGamme[]>();

    // Regrouper les gammes par famille
    catalogGammeData.forEach((cg) => {
      // mc_pg_id et mc_mf_id sont déjà des strings (type text en DB)
      const gamme = gammeMap.get(cg.mc_pg_id);
      if (!gamme) return;

      const family = familyMap.get(cg.mc_mf_id);
      if (!family) return;

      if (!familyGammesMap.has(cg.mc_mf_id)) {
        familyGammesMap.set(cg.mc_mf_id, []);
      }

      familyGammesMap.get(cg.mc_mf_id)!.push({
        pg_id: Number(gamme.pg_id),
        pg_alias: gamme.pg_alias,
        pg_name: gamme.pg_name,
        pg_name_meta: gamme.pg_name_meta,
        pg_img: gamme.pg_img,
        mc_sort: parseInt(cg.mc_sort) || 0,
      });
    });

    // Construire familles avec leurs gammes
    const finalFamilies = familiesData
      .map((family) => {
        const gammes = (familyGammesMap.get(String(family.mf_id)) || []).sort(
          (a, b) => (a.mc_sort ?? 0) - (b.mc_sort ?? 0),
        );

        if (gammes.length === 0) return null;

        return {
          mf_id: family.mf_id,
          mf_name: family.mf_name_system || family.mf_name,
          mf_name_system: family.mf_name_system,
          mf_description: family.mf_description || `Système ${family.mf_name}`,
          mf_pic: family.mf_pic || `${family.mf_name.toLowerCase()}.webp`,
          mf_sort: parseInt(family.mf_sort) || 0,
          gammes_count: gammes.length,
          gammes,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.mf_sort - b.mf_sort);

    const totalGammes = finalFamilies.reduce(
      (sum, f) => sum + f.gammes_count,
      0,
    );

    // 🎯 SEO Validation: Logique PHP pour robots index/noindex
    // family_count >= 3 ET gamme_count >= 5 → index, follow
    const seoValidation = {
      familyCount: finalFamilies.length,
      gammeCount: totalGammes,
      isIndexable: finalFamilies.length >= 3 && totalGammes >= 5,
    };

    this.logger.log(
      `✅ [${queryType}] ${finalFamilies.length} familles, ${totalGammes} gammes compatibles, SEO: ${seoValidation.isIndexable ? 'indexable' : 'noindex'}`,
    );

    return {
      queryType,
      families: finalFamilies as CatalogFamily[],
      totalFamilies: finalFamilies.length,
      totalGammes,
      seoValidation,
    };
  }

  /**
   * 🔄 FALLBACK: Catalogue complet sans filtrage
   * 💡 Utilisé quand pieces_relation_type est vide
   */
  private async buildCompleteCatalogFallback(): Promise<FilteredCatalog> {
    this.logger.log(
      '🔄 [FALLBACK] Construction catalogue complet sans filtrage...',
    );

    // Récupérer familles, gammes et liaisons en parallèle
    const [familiesResult, gammesResult, catalogGammeResult] =
      await Promise.all([
        this.supabase
          .from(TABLES.catalog_family)
          .select(
            'mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_sort',
          )
          .eq('mf_display', 1),
        this.supabase
          .from(TABLES.pieces_gamme)
          .select('pg_id, pg_alias, pg_name, pg_name_meta, pg_img')
          .eq('pg_display', 1),
        // ⚠️ SUPPRIMÉ: .in('pg_level', [1, 2]) - Trop restrictif
        this.supabase
          .from(TABLES.catalog_gamme)
          .select('mc_pg_id, mc_mf_id, mc_sort'),
      ]);

    if (
      familiesResult.error ||
      gammesResult.error ||
      catalogGammeResult.error
    ) {
      throw (
        familiesResult.error || gammesResult.error || catalogGammeResult.error
      );
    }

    return this.buildFilteredCatalogFromParts(
      familiesResult.data,
      catalogGammeResult.data,
      gammesResult.data,
    );
  }

  /**
   * 🏗️ CONSTRUCTION CATALOGUE COMPLET - VERSION SIMPLIFIÉE (DEPRECATED)
   * 💡 Pas de filtrage, juste assemblage des données
   */
  private buildCompleteCatalog(
    families: FamilyRow[],
    liaisons: CatalogGammeRow[],
    gammes: GammeRow[],
  ): FilteredCatalog {
    // 🔥 CRITIQUE: Convertir les IDs en nombres (Supabase retourne des strings)
    const gammeMap = new Map(gammes.map((g) => [parseInt(String(g.pg_id)), g]));

    // Grouper gammes par famille
    const familyGammesMap = new Map<number, CatalogGamme[]>();

    liaisons.forEach((liaison) => {
      const gamme = gammeMap.get(parseInt(liaison.mc_pg_id));
      if (!gamme) return; // Skip si gamme n'existe pas

      const familyId = parseInt(liaison.mc_mf_id);
      if (!familyGammesMap.has(familyId)) {
        familyGammesMap.set(familyId, []);
      }

      familyGammesMap.get(familyId)!.push({
        pg_id: Number(gamme.pg_id),
        pg_alias: gamme.pg_alias,
        pg_name: gamme.pg_name,
        pg_name_meta: gamme.pg_name_meta,
        pg_img: gamme.pg_img,
        pg_sort: parseInt(liaison.mc_sort) || 0,
      });
    });

    // Construire les familles finales
    const finalFamilies = families
      .map((family) => {
        const familyGammes = familyGammesMap.get(parseInt(family.mf_id)) || [];

        // Trier gammes par mc_sort
        const sortedGammes = familyGammes.sort(
          (a, b) => (a.pg_sort ?? 0) - (b.pg_sort ?? 0),
        );

        return {
          mf_id: parseInt(family.mf_id),
          mf_name: family.mf_name,
          mf_name_system: family.mf_name_system,
          mf_description: family.mf_description || `Système ${family.mf_name}`,
          mf_pic: family.mf_pic || `${family.mf_name.toLowerCase()}.webp`,
          mf_sort: parseInt(family.mf_sort) || 0,
          gammes_count: sortedGammes.length,
          gammes: sortedGammes,
        };
      })
      .filter((family) => family.gammes_count > 0) // Seulement familles avec gammes
      .sort((a, b) => a.mf_sort - b.mf_sort);

    const totalGammes = finalFamilies.reduce(
      (sum, f) => sum + f.gammes_count,
      0,
    );

    this.logger.log(
      `✅ [CATALOG BUILD] ${finalFamilies.length} familles, ${totalGammes} gammes TOTAL`,
    );

    return {
      queryType: 'COMPLETE_CATALOG_V4_NO_FILTER',
      families: finalFamilies,
      totalFamilies: finalFamilies.length,
      totalGammes,
      optimizationLevel: 'V4_SIMPLE_COMPLETE',
    };
  }

  /**
   * 🚀 RÉCUPÉRATION RELATIONS OPTIMISÉE
   */
  private async getCompleteRelations(
    typeId: number,
  ): Promise<Record<string, unknown>[]> {
    const startTime = Date.now();

    try {
      // 🔥 OPTIMISATION: Sélectionner seulement rtp_pg_id (pas rtp_piece_id, rtp_pm_id)
      // pour réduire la quantité de données
      const { data: relationData, error } = await this.supabase
        .from(TABLES.pieces_relation_type)
        .select('rtp_pg_id') // 🔥 Seulement ce qu'on utilise vraiment
        .eq('rtp_type_id', typeId)
        .limit(5000); // 🔥 Réduit à 5000 pour éviter timeout

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const count = relationData?.length || 0;

      // Log des performances
      this.logger.log(
        `📊 [RELATIONS] type_id ${typeId}: ${count} gammes uniques en ${responseTime}ms`,
      );

      // Alerte si limite atteinte
      if (count === 5000) {
        this.logger.warn(
          `⚠️ [RELATIONS] Limite 5k atteinte pour type_id ${typeId} - Catalogue possiblement incomplet`,
        );
      }

      return relationData || [];
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `❌ [RELATIONS] Erreur type_id ${typeId}: ${error instanceof Error ? error.message : String(error)} (${responseTime}ms)`,
      );

      // 🔥 FALLBACK: Retourner tableau vide au lieu de crasher
      this.logger.warn(
        `🔄 [FALLBACK] Retour catalogue générique pour type_id ${typeId}`,
      );
      return [];
    }
  }

  /**
   * 💾 CACHE INTELLIGENT AVEC TTL ADAPTATIF
   */
  private getCachedCatalog(typeId: number): FilteredCatalog | null {
    try {
      const cacheKey = `catalog:v4:${typeId}`;
      const cacheEntry = this.memoryCache.get(cacheKey);

      if (!cacheEntry) return null;

      // Vérification expiration
      const now = Date.now();
      if (now > cacheEntry.timestamp.getTime() + cacheEntry.ttl * 1000) {
        this.memoryCache.delete(cacheKey);
        return null;
      }

      return cacheEntry.data;
    } catch (error: unknown) {
      this.logger.warn(
        `⚠️ [CACHE READ] Erreur type_id ${typeId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private setCachedCatalog(typeId: number, catalog: FilteredCatalog): void {
    try {
      const cacheKey = `catalog:v4:${typeId}`;
      const ttl = this.getSmartTTL(typeId);

      this.memoryCache.set(cacheKey, {
        data: catalog,
        timestamp: new Date(),
        ttl,
      });

      this.logger.log(`💾 [CACHE SET] type_id ${typeId} cached for ${ttl}s`);
    } catch (error: unknown) {
      this.logger.warn(
        `⚠️ [CACHE WRITE] Erreur type_id ${typeId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 🎯 TTL ADAPTATIF BASÉ SUR POPULARITÉ
   */
  private getSmartTTL(typeId: number): number {
    const stats = this.vehicleStats.get(typeId);
    const requestCount = stats?.requestCount || 0;

    // TTL adaptatif selon popularité
    if (requestCount >= 50) return 86400; // 24h - très populaire
    if (requestCount >= 10) return 3600; // 1h  - populaire
    if (requestCount >= 3) return 1800; // 30m - moyen
    return 900; // 15m - rare
  }

  /**
   * 📊 MISE À JOUR STATS VÉHICULE
   */
  private updateVehicleStats(typeId: number): void {
    const existing = this.vehicleStats.get(typeId);

    this.vehicleStats.set(typeId, {
      typeId,
      requestCount: (existing?.requestCount || 0) + 1,
      lastAccessed: new Date(),
      avgResponseTime: existing?.avgResponseTime || 0,
    });
  }

  /**
   * 🔄 PRÉ-CALCUL BACKGROUND DES VÉHICULES POPULAIRES
   */
  @Cron('0 */6 * * *') // Toutes les 6 heures
  async precomputePopularCatalogs(): Promise<void> {
    this.logger.log('🔄 [PRECOMPUTE] Début pré-calcul véhicules populaires...');

    try {
      // Top 50 véhicules les plus demandés
      const topVehicles = Array.from(this.vehicleStats.entries())
        .sort(([, a], [, b]) => b.requestCount - a.requestCount)
        .slice(0, 50)
        .map(([typeId]) => typeId);

      // + Top véhicules génériques (marques populaires)
      const genericPopular = [17173, 22547, 15432, 25896, 18765]; // Audi A5, Citroën C4, etc.

      const allToPrecompute = [...new Set([...topVehicles, ...genericPopular])];

      this.logger.log(
        `🎯 [PRECOMPUTE] Pré-calcul de ${allToPrecompute.length} véhicules...`,
      );

      // Pré-calcul en parallèle (par batch de 10)
      for (let i = 0; i < allToPrecompute.length; i += 10) {
        const batch = allToPrecompute.slice(i, i + 10);

        await Promise.allSettled(
          batch.map(async (typeId) => {
            try {
              await this.getCatalogV4Optimized(typeId);
              this.logger.log(`✅ [PRECOMPUTE] type_id ${typeId} cached`);
            } catch (error: unknown) {
              this.logger.warn(
                `⚠️ [PRECOMPUTE] Échec type_id ${typeId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }),
        );

        // Pause entre batchs pour éviter surcharge
        await sleep(1000);
      }

      this.logger.log(
        `🎉 [PRECOMPUTE] Terminé! ${allToPrecompute.length} véhicules en cache`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `❌ [PRECOMPUTE] Erreur: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 📊 MÉTRIQUES DE PERFORMANCE AVANCÉES
   */
  async getAdvancedMetrics(): Promise<Record<string, unknown>> {
    const cacheKeys = Array.from(this.memoryCache.keys());
    const totalCached = cacheKeys.length;

    // Top 10 véhicules les plus demandés
    const topRequested = Array.from(this.vehicleStats.entries())
      .sort(([, a], [, b]) => b.requestCount - a.requestCount)
      .slice(0, 10)
      .map(([typeId, stats]) => ({ typeId, ...stats }));

    return {
      service: 'V4_HYBRID_ULTIMATE',
      performance: {
        totalRequests: this.globalMetrics.totalRequests,
        cacheHitRatio:
          this.globalMetrics.totalRequests > 0
            ? (
                (this.globalMetrics.cacheHits /
                  this.globalMetrics.totalRequests) *
                100
              ).toFixed(1) + '%'
            : '0%',
        avgResponseTime: this.globalMetrics.avgResponseTime,
        totalCachedVehicles: totalCached,
      },
      topVehicles: topRequested,
      cacheHealth: {
        memoryConnected: true,
        totalKeys: totalCached,
        estimatedMemoryUsage: `${(totalCached * 15).toFixed(1)}KB`, // ~15KB par véhicule
      },
    };
  }

  /**
   * 🔍 CALCUL SCORE DE COMPLÉTUDE
   */
  private calculateCompleteness(catalog: FilteredCatalog): number {
    if (!catalog?.families?.length) return 0;

    const totalFamilies = catalog.families.length;
    const familiesWithGammes = catalog.families.filter(
      (f: CatalogFamily) => f.gammes_count > 0,
    ).length;

    return Math.round((familiesWithGammes / totalFamilies) * 100);
  }

  /**
   * 🔄 CATALOGUE GÉNÉRIQUE FALLBACK
   */
  private async getGenericCatalog(typeId: number): Promise<FilteredCatalog> {
    this.logger.log(
      `🔄 [FALLBACK] Catalogue générique pour type_id: ${typeId}`,
    );

    return {
      queryType: 'GENERIC_FALLBACK_V4',
      families: [],
      totalFamilies: 0,
      totalGammes: 0,
      message: 'Aucune donnée disponible pour ce véhicule',
    };
  }
}
