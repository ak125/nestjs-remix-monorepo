import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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
  catalog: any;
  metrics: CatalogMetrics;
  timestamp: Date;
}

interface CacheEntry {
  data: any;
  timestamp: Date;
  ttl: number;
}

@Injectable()
export class VehicleFilteredCatalogV4HybridService extends SupabaseBaseService {
  protected readonly logger = new Logger(
    VehicleFilteredCatalogV4HybridService.name,
  );

  // 💾 Cache en mémoire (remplace Redis pour simplicité)
  private memoryCache = new Map<string, CacheEntry>();

  // 📊 Stats en mémoire pour TTL adaptatif
  private vehicleStats = new Map<number, VehiclePopularityStats>();

  // 🎯 Métriques globales
  private globalMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    avgResponseTime: 0,
    topVehicles: [] as number[],
  };

  constructor() {
    super();
    this.logger.log('🚀 V4 Hybrid Service initialized with memory cache');
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
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `❌ [ERROR] V4 type_id ${typeId}: ${error.message} (${responseTime}ms)`,
      );
      throw error;
    }
  }

  /**
   * 🏃‍♂️ CONSTRUCTION CATALOGUE COMPLET - SANS FILTRAGE
   * 💡 Philosophie: Afficher TOUT le catalogue, filtrage sur page produit
   */
  private async buildCatalogParallel(typeId: number): Promise<any> {
    this.logger.log(
      `� [V4 SIMPLE] Catalogue complet (SANS filtrage) pour type_id ${typeId}`,
    );

    // 🚀 3 requêtes parallèles ultra-simples
    const [familiesData, catalogGammeData, gammeData] = await Promise.all([
      // 1️⃣ Toutes les familles visibles
      this.supabase
        .from('catalog_family')
        .select(
          'mf_id, mf_name, mf_name_system, mf_description, mf_pic, mf_sort',
        )
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true }),

      // 2️⃣ Toutes les liaisons famille↔gamme
      this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id, mc_mf_id, mc_sort')
        .order('mc_sort', { ascending: true }),

      // 3️⃣ Toutes les gammes visibles
      this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias, pg_name, pg_name_meta, pg_img')
        .eq('pg_display', '1')
        .order('pg_id', { ascending: true }),
    ]);

    // Vérification erreurs
    if (familiesData.error) throw familiesData.error;
    if (catalogGammeData.error) throw catalogGammeData.error;
    if (gammeData.error) throw gammeData.error;

    this.logger.log(
      `✅ [V4 SIMPLE] ${familiesData.data.length} familles, ` +
        `${gammeData.data.length} gammes, ` +
        `${catalogGammeData.data.length} liaisons`,
    );

    // 🔗 Construction simple des familles
    return this.buildCompleteCatalog(
      familiesData.data,
      catalogGammeData.data,
      gammeData.data,
    );
  }

  /**
   * 🏗️ CONSTRUCTION CATALOGUE COMPLET - VERSION SIMPLIFIÉE
   * 💡 Pas de filtrage, juste assemblage des données
   */
  private buildCompleteCatalog(
    families: any[],
    liaisons: any[],
    gammes: any[],
  ): any {
    // Map pour lookup rapide O(1)
    const gammeMap = new Map(gammes.map((g) => [g.pg_id, g]));

    // Grouper gammes par famille
    const familyGammesMap = new Map<number, any[]>();

    liaisons.forEach((liaison) => {
      const gamme = gammeMap.get(liaison.mc_pg_id);
      if (!gamme) return; // Skip si gamme n'existe pas

      const familyId = liaison.mc_mf_id;
      if (!familyGammesMap.has(familyId)) {
        familyGammesMap.set(familyId, []);
      }

      familyGammesMap.get(familyId)!.push({
        pg_id: gamme.pg_id,
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
        const familyGammes = familyGammesMap.get(family.mf_id) || [];

        // Trier gammes par mc_sort
        const sortedGammes = familyGammes.sort((a, b) => a.pg_sort - b.pg_sort);

        return {
          mf_id: family.mf_id,
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
  private async getCompleteRelations(typeId: number): Promise<any[]> {
    const startTime = Date.now();

    try {
      // 🔥 OPTIMISATION: Sélectionner seulement rtp_pg_id (pas rtp_piece_id, rtp_pm_id)
      // pour réduire la quantité de données
      const { data: relationData, error } = await this.supabase
        .from('pieces_relation_type')
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
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `❌ [RELATIONS] Erreur type_id ${typeId}: ${error.message} (${responseTime}ms)`,
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
  private getCachedCatalog(typeId: number): any | null {
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
    } catch (error: any) {
      this.logger.warn(
        `⚠️ [CACHE READ] Erreur type_id ${typeId}: ${error.message}`,
      );
      return null;
    }
  }

  private setCachedCatalog(typeId: number, catalog: any): void {
    try {
      const cacheKey = `catalog:v4:${typeId}`;
      const ttl = this.getSmartTTL(typeId);

      this.memoryCache.set(cacheKey, {
        data: catalog,
        timestamp: new Date(),
        ttl,
      });

      this.logger.log(`💾 [CACHE SET] type_id ${typeId} cached for ${ttl}s`);
    } catch (error: any) {
      this.logger.warn(
        `⚠️ [CACHE WRITE] Erreur type_id ${typeId}: ${error.message}`,
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
            } catch (error: any) {
              this.logger.warn(
                `⚠️ [PRECOMPUTE] Échec type_id ${typeId}: ${error.message}`,
              );
            }
          }),
        );

        // Pause entre batchs pour éviter surcharge
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.logger.log(
        `🎉 [PRECOMPUTE] Terminé! ${allToPrecompute.length} véhicules en cache`,
      );
    } catch (error: any) {
      this.logger.error(`❌ [PRECOMPUTE] Erreur: ${error.message}`);
    }
  }

  /**
   * 📊 MÉTRIQUES DE PERFORMANCE AVANCÉES
   */
  async getAdvancedMetrics(): Promise<any> {
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
  private calculateCompleteness(catalog: any): number {
    if (!catalog?.families?.length) return 0;

    const totalFamilies = catalog.families.length;
    const familiesWithGammes = catalog.families.filter(
      (f: any) => f.gammes_count > 0,
    ).length;

    return Math.round((familiesWithGammes / totalFamilies) * 100);
  }

  /**
   * 🔄 CATALOGUE GÉNÉRIQUE FALLBACK
   */
  private async getGenericCatalog(typeId: number): Promise<any> {
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
