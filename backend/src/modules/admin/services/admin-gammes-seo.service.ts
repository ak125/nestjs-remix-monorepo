/**
 * 🎯 ADMIN GAMMES SEO SERVICE
 *
 * Service pour la gestion des gammes et leur classification SEO (G-Level)
 * - Liste des 230 gammes avec données Trends
 * - KPIs: INDEX vs NOINDEX, G1/G2/G3
 * - Actions: Promouvoir INDEX, Promouvoir G1, etc.
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import {
  GammeSeoThresholdsService,
  SmartActionThresholds,
  DEFAULT_THRESHOLDS,
} from './gamme-seo-thresholds.service';
import { GammeSeoAuditService } from './gamme-seo-audit.service';

// ============== HIÉRARCHIE OFFICIELLE DES FAMILLES ==============
// Ordre du catalogue Automecanik par familles techniques
const FAMILY_HIERARCHY_ORDER: string[] = [
  'Système de filtration',
  'Système de freinage',
  'Courroie, galet, poulie et chaîne',
  'Préchauffage et allumage',
  'Direction et liaison au sol',
  'Amortisseur et suspension',
  'Support moteur',
  'Embrayage',
  'Transmission',
  'Système électrique',
  'Capteurs',
  "Système d'alimentation",
  'Moteur',
  'Refroidissement',
  'Climatisation',
  'Echappement',
  'Eclairage',
  'Accessoires',
  'Turbo',
];

// ============== INTERFACES ==============

export interface GammeSeoFilters {
  search?: string;
  familyId?: number;
  gLevel?: 'G1' | 'G2' | 'G3';
  status?: 'INDEX' | 'NOINDEX';
  actionRecommended?: string;
  minTrends?: number;
  maxTrends?: number;
}

// 🎯 Smart Action types based on Trends × SEO Score matrix
export type SmartActionType =
  | 'INDEX_G1' // Trends≥50 & SEO≥75 → Page dédiée prioritaire
  | 'INDEX' // Trends≥50 & SEO≥45 → Page dédiée standard
  | 'INVESTIGUER' // Trends≥50 & SEO<45 → Fort volume mais faible valeur
  | 'OBSERVER' // Trends 20-49 & SEO≥75 → Potentiel, surveiller
  | 'PARENT' // Trends<20 & SEO≥75 → Intégrer dans page parente
  | 'EVALUER' // Trends 20-49 & SEO 45-74 → Décision manuelle
  | 'NOINDEX'; // Faible potentiel

export interface GammeSeoItem {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_level: string;
  pg_top: string;
  pg_relfollow: string;
  pg_sitemap: string;
  pg_display: string;
  // From gamme_seo_metrics (Agent 1 - Trends)
  trends_index: number;
  g_level_recommended: string;
  action_recommended: string | null;
  user_notes: string | null;
  user_action: string | null;
  trends_updated_at: string | null;
  // Agent 2 - SEO Expert data
  seo_score: number;
  serp_score: number;
  search_intent: string;
  competition_level: string;
  competition_difficulty: number;
  shopping_likely: boolean;
  paa_count: number;
  commercial_value: number;
  // From catalog_family
  family_name: string | null;
  family_id: number | null;
  // 🎯 Smart Action (calculé)
  smart_action: SmartActionType;
  smart_action_description: string;
}

export interface GammeSeoPagination {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GammeSeoStats {
  total: number;
  indexed: number;
  noindexed: number;
  g1Count: number;
  g2Count: number;
  g3Count: number;
  toPromoteIndex: number;
  toPromoteG1: number;
  toVerifyG1: number;
  inSitemap: number;
  avgTrends: number;
  // 🎯 Smart Actions stats
  smartActions: {
    INDEX_G1: number;
    INDEX: number;
    INVESTIGUER: number;
    OBSERVER: number;
    PARENT: number;
    EVALUER: number;
    NOINDEX: number;
  };
}

export interface GammeSeoUpdateData {
  pg_level?: string;
  pg_top?: string;
  pg_relfollow?: string;
  pg_sitemap?: string;
  user_notes?: string;
  user_action?: string;
}

// ============== SERVICE ==============

@Injectable()
export class AdminGammesSeoService extends SupabaseBaseService {
  protected readonly logger = new Logger(AdminGammesSeoService.name);

  // Cache des seuils pour éviter les appels répétés pendant une requête
  private cachedThresholds: SmartActionThresholds | null = null;

  constructor(
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => GammeSeoThresholdsService))
    private readonly thresholdsService: GammeSeoThresholdsService,
    @Inject(forwardRef(() => GammeSeoAuditService))
    private readonly auditService: GammeSeoAuditService,
  ) {
    super();
  }

  /**
   * 🔧 Récupère les seuils (avec cache local pour la durée d'une requête)
   */
  private async getThresholdsForCalculation(): Promise<SmartActionThresholds> {
    if (this.cachedThresholds) return this.cachedThresholds;
    try {
      this.cachedThresholds = await this.thresholdsService.getThresholds();
      // Clear cache after 10 seconds (pour éviter les problèmes de mémoire)
      setTimeout(() => {
        this.cachedThresholds = null;
      }, 10000);
      return this.cachedThresholds;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  }

  /**
   * 🎯 Calcule la Smart Action basée sur Trends × SEO Score
   * Matrice de décision centralisée utilisée par API et export CSV
   * @param thresholds - Seuils configurables (utilise les valeurs par défaut si non fourni)
   */
  calculateSmartAction(
    trendsIndex: number,
    seoScore: number,
    thresholds: SmartActionThresholds = DEFAULT_THRESHOLDS,
  ): { action: SmartActionType; description: string } {
    // Extraire les seuils configurables
    const { trends_high, trends_medium, seo_excellent, seo_good } = thresholds;

    // Matrice Trends × SEO Score avec seuils configurables
    if (trendsIndex >= trends_high && seoScore >= seo_excellent) {
      return {
        action: 'INDEX_G1',
        description:
          'Page dédiée prioritaire - Fort volume + forte valeur commerciale',
      };
    }
    if (trendsIndex >= trends_high && seoScore >= seo_good) {
      return {
        action: 'INDEX',
        description: 'Page dédiée standard - Fort volume',
      };
    }
    if (trendsIndex >= trends_high && seoScore < seo_good) {
      return {
        action: 'INVESTIGUER',
        description: 'Fort volume mais faible valeur commerciale - À vérifier',
      };
    }
    if (trendsIndex >= trends_medium && seoScore >= seo_excellent) {
      return {
        action: 'OBSERVER',
        description: "Potentiel élevé - Surveiller l'évolution des tendances",
      };
    }
    if (trendsIndex < trends_medium && seoScore >= seo_excellent) {
      return {
        action: 'PARENT',
        description:
          'Forte valeur mais faible volume - Intégrer dans page parente',
      };
    }
    if (trendsIndex >= trends_medium && seoScore >= seo_good) {
      return {
        action: 'EVALUER',
        description: 'Potentiel moyen - Décision manuelle requise',
      };
    }
    // Default: NOINDEX
    return {
      action: 'NOINDEX',
      description: 'Faible volume + faible valeur - Garder non-indexé',
    };
  }

  /**
   * 📋 Liste des gammes avec données SEO
   */
  async getGammesList(
    filters: GammeSeoFilters = {},
    pagination: GammeSeoPagination = { page: 1, limit: 50 },
  ): Promise<{
    data: GammeSeoItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      this.logger.log('📋 Fetching gammes SEO list...');

      // 0. Get configurable thresholds for Smart Action calculation
      const thresholds = await this.getThresholdsForCalculation();

      // 1. Get all gamme IDs from catalog_gamme (the 230 gammes we track)
      const { data: liaisons, error: liaisonsError } = await this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id, mc_mf_id');

      if (liaisonsError) {
        this.logger.error('Error fetching catalog_gamme:', liaisonsError);
        throw liaisonsError;
      }

      const pgIds = [...new Set(liaisons.map((l: any) => Number(l.mc_pg_id)))];
      this.logger.log(`Found ${pgIds.length} unique gamme IDs`);

      // 2. Get gammes from pieces_gamme
      const { data: gammes, error: gammesError } = await this.supabase
        .from('pieces_gamme')
        .select(
          'pg_id, pg_name, pg_alias, pg_level, pg_top, pg_relfollow, pg_sitemap, pg_display',
        )
        .in('pg_id', pgIds);

      if (gammesError) {
        this.logger.error('Error fetching pieces_gamme:', gammesError);
        throw gammesError;
      }

      // 3. Get SEO metrics from gamme_seo_metrics (incluant données Agent 2)
      const { data: seoMetrics, error: seoError } = await this.supabase
        .from('gamme_seo_metrics')
        .select(
          'pg_id, trends_index, g_level_recommended, action_recommended, user_notes, user_action, trends_updated_at, search_volume, competition, competition_index',
        )
        .in('pg_id', pgIds);

      if (seoError) {
        this.logger.error('Error fetching gamme_seo_metrics:', seoError);
        throw seoError;
      }

      // 4. Get families from catalog_family
      const familyIds = [...new Set(liaisons.map((l: any) => l.mc_mf_id))];
      const { data: families, error: familiesError } = await this.supabase
        .from('catalog_family')
        .select('mf_id, mf_name')
        .in('mf_id', familyIds);

      if (familiesError) {
        this.logger.error('Error fetching catalog_family:', familiesError);
        throw familiesError;
      }

      // Build lookup maps
      const seoMetricsMap = new Map(
        seoMetrics?.map((m: any) => [m.pg_id, m]) || [],
      );
      const familiesMap = new Map(
        families?.map((f: any) => [f.mf_id, f.mf_name]) || [],
      );
      const pgToFamilyMap = new Map(
        liaisons.map((l: any) => [Number(l.mc_pg_id), l.mc_mf_id]),
      );

      // 5. Merge data (incluant Agent 2)
      let result: GammeSeoItem[] = (gammes || []).map((g: any) => {
        const seo = seoMetricsMap.get(g.pg_id) || {};
        const familyId = pgToFamilyMap.get(g.pg_id);
        const familyName = familyId ? familiesMap.get(familyId) : null;

        // Parse Agent 2 data from user_notes JSON
        let agent2Data: any = {};
        try {
          if (seo.user_notes) {
            agent2Data = JSON.parse(seo.user_notes);
          }
        } catch {
          // Si user_notes n'est pas du JSON, ignorer
        }

        // Use Agent 2 recommended G-Level if available, else calculate from trends
        const trendsIndex = seo.trends_index || 0;
        const recommendedGLevel =
          seo.g_level_recommended ||
          (trendsIndex >= 50 ? 'G1' : trendsIndex >= 20 ? 'G2' : 'G3');

        // Use Agent 2 action if available, but filter out obsolete recommendations
        let actionRecommended = seo.action_recommended || null;

        // Clear recommendation if action already applied
        if (actionRecommended === 'PROMOUVOIR_G1' && g.pg_top === '1') {
          actionRecommended = null; // Already G1
        }
        if (actionRecommended === 'PROMOUVOIR_INDEX' && g.pg_level === '1') {
          actionRecommended = null; // Already INDEX
        }

        // SEO Score from Agent 2 (stored in search_volume column)
        const seoScore = seo.search_volume || agent2Data.seo_score || 0;
        const serpScore = agent2Data.serp_score || 0;

        // 🎯 Calculate Smart Action (with configurable thresholds)
        const smartActionResult = this.calculateSmartAction(
          trendsIndex,
          seoScore,
          thresholds,
        );

        return {
          pg_id: g.pg_id,
          pg_name: g.pg_name,
          pg_alias: g.pg_alias,
          pg_level: g.pg_level,
          pg_top: g.pg_top,
          pg_relfollow: g.pg_relfollow,
          pg_sitemap: g.pg_sitemap,
          pg_display: g.pg_display,
          // Agent 1 data
          trends_index: trendsIndex,
          g_level_recommended: recommendedGLevel,
          action_recommended: actionRecommended,
          user_notes: seo.user_notes || null,
          user_action: seo.user_action || null,
          trends_updated_at: seo.trends_updated_at || null,
          // Agent 2 data
          seo_score: seoScore,
          serp_score: serpScore,
          search_intent:
            agent2Data.search_intent || seo.competition || 'UNKNOWN',
          competition_level:
            seo.competition || agent2Data.competition_level || 'UNKNOWN',
          competition_difficulty:
            seo.competition_index || agent2Data.competition_difficulty || 0,
          shopping_likely: agent2Data.shopping_likely || false,
          paa_count: agent2Data.paa_count || 0,
          commercial_value: agent2Data.commercial_value || 0,
          // Family
          family_name: familyName,
          family_id: familyId,
          // 🎯 Smart Action (calculé)
          smart_action: smartActionResult.action,
          smart_action_description: smartActionResult.description,
        };
      });

      // 6. Apply filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(
          (g) =>
            g.pg_name.toLowerCase().includes(searchLower) ||
            (g.pg_alias && g.pg_alias.toLowerCase().includes(searchLower)),
        );
      }

      if (filters.familyId) {
        result = result.filter((g) => g.family_id === filters.familyId);
      }

      if (filters.gLevel) {
        result = result.filter((g) => g.g_level_recommended === filters.gLevel);
      }

      if (filters.status) {
        if (filters.status === 'INDEX') {
          result = result.filter((g) => g.pg_level === '1');
        } else {
          result = result.filter((g) => g.pg_level !== '1');
        }
      }

      if (filters.actionRecommended) {
        result = result.filter(
          (g) => g.action_recommended === filters.actionRecommended,
        );
      }

      if (filters.minTrends !== undefined) {
        result = result.filter((g) => g.trends_index >= filters.minTrends!);
      }

      if (filters.maxTrends !== undefined) {
        result = result.filter((g) => g.trends_index <= filters.maxTrends!);
      }

      // 7. Apply sorting
      const sortBy = pagination.sortBy || 'trends_index';
      const sortOrder = pagination.sortOrder || 'desc';

      // Special case: family_name with official catalog hierarchy
      if (sortBy === 'family_name') {
        // Helper function to get family hierarchy index
        const getFamilyHierarchyIndex = (familyName: string | null): number => {
          if (!familyName) return FAMILY_HIERARCHY_ORDER.length; // Sans famille at the end

          // Normalize: remove accents and lowercase for comparison
          const normalize = (s: string) =>
            s
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

          const normalizedInput = normalize(familyName);
          const index = FAMILY_HIERARCHY_ORDER.findIndex(
            (f) => normalize(f) === normalizedInput,
          );
          return index === -1 ? FAMILY_HIERARCHY_ORDER.length : index;
        };

        // Debug: log unique families and their positions
        const uniqueFamilies = [...new Set(result.map((r) => r.family_name))];
        this.logger.log('📊 Familles trouvées et leurs positions:');
        uniqueFamilies.forEach((f) => {
          const pos = getFamilyHierarchyIndex(f);
          this.logger.log(`   ${pos}. ${f || 'Sans famille'}`);
        });

        // Sort by: 1) Official catalog hierarchy (always in catalog order), 2) Within family by trends desc
        result.sort((a, b) => {
          const familyA = a.family_name;
          const familyB = b.family_name;

          // Different families: always sort by official catalog hierarchy (ascending = 1, 2, 3...)
          if (familyA !== familyB) {
            const indexA = getFamilyHierarchyIndex(familyA);
            const indexB = getFamilyHierarchyIndex(familyB);
            // Toujours tri par ordre du catalogue (1=Filtration, 2=Freinage, etc.)
            return indexA - indexB;
          }

          // Same family: sort by trends within the family (always desc - highest trends first)
          return b.trends_index - a.trends_index;
        });
      } else {
        // Standard sorting for other columns
        result.sort((a, b) => {
          let aVal: any = a[sortBy as keyof GammeSeoItem];
          let bVal: any = b[sortBy as keyof GammeSeoItem];

          // Handle null/undefined
          if (aVal === null || aVal === undefined) aVal = '';
          if (bVal === null || bVal === undefined) bVal = '';

          // String comparison for strings
          if (typeof aVal === 'string') {
            return sortOrder === 'asc'
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
          }

          // Numeric comparison
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }

      // 8. Apply pagination
      const total = result.length;
      const totalPages = Math.ceil(total / pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;
      const paginatedData = result.slice(offset, offset + pagination.limit);

      this.logger.log(
        `✅ Returning ${paginatedData.length} gammes (page ${pagination.page}/${totalPages})`,
      );

      return {
        data: paginatedData,
        total,
        page: pagination.page,
        totalPages,
      };
    } catch (error) {
      this.logger.error('❌ Error in getGammesList:', error);
      throw error;
    }
  }

  /**
   * 📊 KPIs et statistiques
   */
  async getStats(): Promise<GammeSeoStats> {
    try {
      const cacheKey = 'admin:gammes-seo-stats';
      const cached = await this.cacheService.get<GammeSeoStats>(cacheKey);
      if (cached) {
        this.logger.log('📦 Stats from cache');
        return cached;
      }

      this.logger.log('📊 Computing gammes SEO stats...');

      // Get all data (no pagination)
      const { data } = await this.getGammesList({}, { page: 1, limit: 1000 });

      // 🎯 Count Smart Actions
      const smartActionCounts = {
        INDEX_G1: 0,
        INDEX: 0,
        INVESTIGUER: 0,
        OBSERVER: 0,
        PARENT: 0,
        EVALUER: 0,
        NOINDEX: 0,
      };
      data.forEach((g) => {
        if (g.smart_action && smartActionCounts[g.smart_action] !== undefined) {
          smartActionCounts[g.smart_action]++;
        }
      });

      const stats: GammeSeoStats = {
        total: data.length,
        indexed: data.filter((g) => g.pg_level === '1').length,
        noindexed: data.filter((g) => g.pg_level !== '1').length,
        g1Count: data.filter((g) => g.pg_top === '1').length,
        g2Count: data.filter((g) => g.pg_level === '1' && g.pg_top !== '1')
          .length,
        g3Count: data.filter((g) => g.pg_level !== '1').length,
        toPromoteIndex: data.filter(
          (g) => g.action_recommended === 'PROMOUVOIR_INDEX',
        ).length,
        toPromoteG1: data.filter(
          (g) => g.action_recommended === 'PROMOUVOIR_G1',
        ).length,
        toVerifyG1: data.filter((g) => g.action_recommended === 'VERIFIER_G1')
          .length,
        inSitemap: data.filter((g) => g.pg_sitemap === '1').length,
        avgTrends:
          data.length > 0
            ? Math.round(
                data.reduce((sum, g) => sum + g.trends_index, 0) / data.length,
              )
            : 0,
        smartActions: smartActionCounts,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, stats, 300);

      this.logger.log('✅ Stats computed:', stats);
      return stats;
    } catch (error) {
      this.logger.error('❌ Error in getStats:', error);
      throw error;
    }
  }

  /**
   * 🔧 Mise à jour d'une gamme
   */
  async updateGamme(
    pgId: number,
    updateData: GammeSeoUpdateData,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`🔧 Updating gamme pg_id=${pgId}...`);

      // 🛡️ RÈGLE BÉTON: Empêcher NOINDEX sur G1 avec stock
      if (updateData.pg_relfollow === '0' || updateData.pg_level === '2') {
        // Récupérer les données actuelles de la gamme
        const { data: currentGamme, error: gammeError } = await this.supabase
          .from('pieces_gamme')
          .select('pg_id, pg_name, pg_top')
          .eq('pg_id', pgId)
          .single();

        if (gammeError) {
          this.logger.error('Error fetching gamme for G1 check:', gammeError);
          throw gammeError;
        }

        // Si G1 (pg_top = '1'), vérifier le stock avant de permettre NOINDEX
        if (currentGamme?.pg_top === '1') {
          // Vérifier s'il y a des produits en stock pour cette gamme
          const { count: productCount } = await this.supabase
            .from('pieces')
            .select('*', { count: 'exact', head: true })
            .eq('pg_id', pgId.toString())
            .gt('stock', 0);

          if (productCount && productCount > 0) {
            this.logger.warn(
              `⛔ BLOCAGE: Tentative de NOINDEX sur G1 "${currentGamme.pg_name}" avec ${productCount} produits en stock`,
            );
            throw new Error(
              `❌ Impossible de passer "${currentGamme.pg_name}" en NOINDEX.\n` +
                `Raison: C'est une gamme G1 (prioritaire) avec ${productCount} produits en stock.\n` +
                `Pour NOINDEX un G1, le stock doit être à 0.`,
            );
          }

          this.logger.log(
            `✅ G1 "${currentGamme.pg_name}" peut être NOINDEX (stock = 0)`,
          );
        }
      }

      // Split updates: pieces_gamme vs gamme_seo_metrics
      const piecesGammeFields: (keyof GammeSeoUpdateData)[] = [
        'pg_level',
        'pg_top',
        'pg_relfollow',
        'pg_sitemap',
      ];
      const seoMetricsFields: (keyof GammeSeoUpdateData)[] = [
        'user_notes',
        'user_action',
      ];

      // Update pieces_gamme if needed
      const piecesUpdate: Record<string, any> = {};
      piecesGammeFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          piecesUpdate[field] = updateData[field];
        }
      });

      if (Object.keys(piecesUpdate).length > 0) {
        const { error: piecesError } = await this.supabase
          .from('pieces_gamme')
          .update(piecesUpdate)
          .eq('pg_id', pgId);

        if (piecesError) {
          this.logger.error('Error updating pieces_gamme:', piecesError);
          throw piecesError;
        }
      }

      // Update gamme_seo_metrics if needed
      const seoUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      seoMetricsFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          seoUpdate[field] = updateData[field];
        }
      });

      // Recalculate g_level_recommended based on new pg_level and pg_top
      if (
        updateData.pg_level !== undefined ||
        updateData.pg_top !== undefined
      ) {
        // Fetch current values to combine with updates
        const { data: current } = await this.supabase
          .from('pieces_gamme')
          .select('pg_level, pg_top')
          .eq('pg_id', pgId)
          .single();

        const newPgLevel = updateData.pg_level ?? current?.pg_level;
        const newPgTop = updateData.pg_top ?? current?.pg_top;

        // Calculate new g_level_recommended
        if (newPgTop === '1') {
          seoUpdate.g_level_recommended = 'G1';
        } else if (newPgLevel === '1') {
          seoUpdate.g_level_recommended = 'G2';
        } else {
          seoUpdate.g_level_recommended = 'G3';
        }

        // Clear action_recommended if action was taken
        seoUpdate.action_recommended = null;
      }

      const { error: seoError } = await this.supabase
        .from('gamme_seo_metrics')
        .update(seoUpdate)
        .eq('pg_id', pgId);

      if (seoError) {
        this.logger.error('Error updating gamme_seo_metrics:', seoError);
        throw seoError;
      }

      // Clear cache
      await this.cacheService.del('admin:gammes-seo-stats');

      this.logger.log(`✅ Gamme ${pgId} updated successfully`);
      return { success: true, message: `Gamme ${pgId} mise à jour` };
    } catch (error) {
      this.logger.error(`❌ Error updating gamme ${pgId}:`, error);
      throw error;
    }
  }

  /**
   * 🔧 Mise à jour en masse
   */
  async batchUpdate(
    pgIds: number[],
    updateData: GammeSeoUpdateData,
  ): Promise<{ success: boolean; message: string; updated: number }> {
    try {
      this.logger.log(`🔧 Batch updating ${pgIds.length} gammes...`);

      let updated = 0;

      for (const pgId of pgIds) {
        try {
          await this.updateGamme(pgId, updateData);
          updated++;
        } catch (error) {
          this.logger.error(`Failed to update pgId=${pgId}:`, error);
        }
      }

      // Clear cache
      await this.cacheService.del('admin:gammes-seo-stats');

      this.logger.log(
        `✅ Batch update completed: ${updated}/${pgIds.length} gammes`,
      );
      return {
        success: true,
        message: `${updated}/${pgIds.length} gammes mises à jour`,
        updated,
      };
    } catch (error) {
      this.logger.error('❌ Error in batch update:', error);
      throw error;
    }
  }

  /**
   * 📤 Export CSV
   */
  async exportCsv(): Promise<string> {
    try {
      this.logger.log('📤 Exporting gammes to CSV...');

      const { data } = await this.getGammesList(
        {},
        { page: 1, limit: 1000, sortBy: 'trends_index', sortOrder: 'desc' },
      );

      // CSV header with Smart Action columns
      const headers = [
        'pg_id',
        'gamme',
        'famille',
        'pg_level',
        'pg_top',
        'pg_relfollow',
        'pg_sitemap',
        'statut',
        'g_level',
        'trends',
        'seo_score',
        'search_intent',
        'competition',
        'smart_action',
        'smart_action_description',
        'action_recommandee',
        'notes',
        'user_action',
      ];

      // CSV rows with Smart Action data
      const rows = data.map((g) => [
        g.pg_id,
        `"${g.pg_name.replace(/"/g, '""')}"`,
        g.family_name ? `"${g.family_name.replace(/"/g, '""')}"` : '',
        g.pg_level,
        g.pg_top,
        g.pg_relfollow,
        g.pg_sitemap,
        g.pg_level === '1' ? 'INDEX' : 'NOINDEX',
        g.g_level_recommended,
        g.trends_index,
        g.seo_score || 0,
        g.search_intent || 'UNKNOWN',
        g.competition_level || 'UNKNOWN',
        g.smart_action,
        `"${g.smart_action_description.replace(/"/g, '""')}"`,
        g.action_recommended || '',
        g.user_notes ? `"${g.user_notes.replace(/"/g, '""')}"` : '',
        g.user_action || '',
      ]);

      const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join(
        '\n',
      );

      this.logger.log(`✅ CSV exported: ${data.length} rows`);
      return csv;
    } catch (error) {
      this.logger.error('❌ Error exporting CSV:', error);
      throw error;
    }
  }

  /**
   * 📋 Liste des familles (pour le filtre dropdown)
   */
  async getFamilies(): Promise<{ id: number; name: string }[]> {
    try {
      // Get families that have gammes in catalog_gamme
      const { data: liaisons } = await this.supabase
        .from('catalog_gamme')
        .select('mc_mf_id');

      const familyIds = [
        ...new Set(liaisons?.map((l: any) => l.mc_mf_id) || []),
      ];

      const { data: families, error } = await this.supabase
        .from('catalog_family')
        .select('mf_id, mf_name')
        .in('mf_id', familyIds)
        .order('mf_name', { ascending: true });

      if (error) throw error;

      return (families || []).map((f: any) => ({
        id: f.mf_id,
        name: f.mf_name,
      }));
    } catch (error) {
      this.logger.error('❌ Error fetching families:', error);
      throw error;
    }
  }

  /**
   * 🎯 Actions prédéfinies
   */
  getAvailableActions(): { id: string; label: string; description: string }[] {
    return [
      {
        id: 'PROMOTE_INDEX',
        label: 'Promouvoir en INDEX',
        description: 'pg_level=1, pg_relfollow=1, pg_sitemap=1',
      },
      {
        id: 'DEMOTE_NOINDEX',
        label: 'Passer en NOINDEX',
        description: 'pg_level=2, pg_relfollow=0, pg_sitemap=0',
      },
      {
        id: 'MARK_G1',
        label: 'Marquer G1 (prioritaire)',
        description: 'pg_top=1',
      },
      {
        id: 'UNMARK_G1',
        label: 'Retirer G1',
        description: 'pg_top=0',
      },
    ];
  }

  /**
   * 🚀 Appliquer une action prédéfinie (avec audit logging)
   */
  async applyPredefinedAction(
    pgIds: number[],
    actionId: string,
    adminInfo?: { id: number; email: string },
  ): Promise<{ success: boolean; message: string; updated: number }> {
    let updateData: GammeSeoUpdateData;
    let auditActionType:
      | 'BATCH_PROMOTE_INDEX'
      | 'BATCH_DEMOTE_NOINDEX'
      | 'BATCH_MARK_G1'
      | 'BATCH_UNMARK_G1';

    switch (actionId) {
      case 'PROMOTE_INDEX':
        updateData = {
          pg_level: '1',
          pg_relfollow: '1',
          pg_sitemap: '1',
        };
        auditActionType = 'BATCH_PROMOTE_INDEX';
        break;
      case 'DEMOTE_NOINDEX':
        updateData = {
          pg_level: '2',
          pg_relfollow: '0',
          pg_sitemap: '0',
        };
        auditActionType = 'BATCH_DEMOTE_NOINDEX';
        break;
      case 'MARK_G1':
        updateData = {
          pg_top: '1',
        };
        auditActionType = 'BATCH_MARK_G1';
        break;
      case 'UNMARK_G1':
        updateData = {
          pg_top: '0',
        };
        auditActionType = 'BATCH_UNMARK_G1';
        break;
      default:
        throw new Error(`Action inconnue: ${actionId}`);
    }

    const result = await this.batchUpdate(pgIds, updateData);

    // 📋 Log to audit trail
    if (result.success) {
      await this.auditService.logAction({
        adminId: adminInfo?.id || 0,
        adminEmail: adminInfo?.email || 'system',
        actionType: auditActionType,
        entityType: 'batch',
        entityIds: pgIds,
        oldValues: null, // Could fetch old values if needed
        newValues: updateData,
        impactSummary: GammeSeoAuditService.formatImpactSummary(
          auditActionType,
          result.updated,
        ),
      });
    }

    return result;
  }

  /**
   * 🔧 Expose thresholds service for controller
   */
  getThresholdsService(): GammeSeoThresholdsService {
    return this.thresholdsService;
  }

  /**
   * 📋 Expose audit service for controller
   */
  getAuditService(): GammeSeoAuditService {
    return this.auditService;
  }

  /**
   * 📋 GET Gamme Detail - Détail complet d'une gamme pour l'admin
   */
  async getGammeDetail(pgId: number): Promise<{
    gamme: any;
    seo: any;
    conseils: any[];
    switchGroups: Array<{
      alias: string;
      count: number;
      sample: string;
      variations: Array<{ sis_id: number; content: string }>;
    }>;
    familySwitchGroups: Array<{
      alias: string;
      count: number;
      sample: string;
      variations: Array<{ id: number; content: string }>;
    }>;
    articles: any[];
    vehicles: { level1: any[]; level2: any[]; level5: any[] };
    vLevel: { v1: any[]; v2: any[]; v3: any[]; v4: any[]; v5: any[] };
    stats: any;
  }> {
    try {
      this.logger.log(`📋 getGammeDetail(${pgId})`);

      // 1. Gamme de base (pieces_gamme)
      const { data: gamme, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select(
          'pg_id, pg_name, pg_alias, pg_level, pg_top, pg_relfollow, pg_sitemap, pg_display, pg_img',
        )
        .eq('pg_id', pgId.toString())
        .single();

      if (gammeError || !gamme) {
        throw new Error(`Gamme ${pgId} non trouvée`);
      }

      // 2. SEO (seo_gamme)
      const { data: seo } = await this.supabase
        .from('seo_gamme')
        .select('sg_id, sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
        .eq('sg_pg_id', pgId.toString())
        .single();

      // 3. Conseils (seo_gamme_conseil)
      const { data: conseils } = await this.supabase
        .from('seo_gamme_conseil')
        .select('sgc_id, sgc_title, sgc_content')
        .eq('sgc_pg_id', pgId.toString())
        .order('sgc_id', { ascending: true });

      // 4. Item Switches (__seo_item_switch) - GROUPÉS par alias
      const { data: rawSwitches } = await this.supabase
        .from('__seo_item_switch')
        .select('sis_id, sis_alias, sis_content')
        .eq('sis_pg_id', pgId.toString())
        .order('sis_alias', { ascending: true });

      // Grouper Item Switches par alias - TOUTES les variations
      const switchGroups = Object.entries(
        (rawSwitches || []).reduce(
          (acc, sw: any) => {
            const alias = String(sw.sis_alias);
            if (!acc[alias]) {
              acc[alias] = [];
            }
            acc[alias].push({
              sis_id: sw.sis_id,
              content: sw.sis_content || '',
            });
            return acc;
          },
          {} as Record<string, Array<{ sis_id: number; content: string }>>,
        ),
      ).map(([alias, variations]) => ({
        alias,
        count: variations.length,
        variations, // TOUTES les variations (pas de slice)
        sample:
          variations[0]?.content.substring(0, 50) +
          (variations[0]?.content.length > 50 ? '...' : ''),
      }));

      // 5. Family Switches (__seo_family_gamme_car_switch) - alias 1-16
      // Note: Colonnes avec suffixe 's' (sfgcs_*) selon le type SeoFamilyGammeCarSwitch
      const { data: rawFamilySwitches } = await this.supabase
        .from('__seo_family_gamme_car_switch')
        .select('sfgcs_id, sfgcs_alias, sfgcs_content')
        .eq('sfgcs_pg_id', pgId.toString())
        .order('sfgcs_alias', { ascending: true });

      // Grouper Family Switches par alias - TOUTES les variations
      const familySwitchGroups = Object.entries(
        (rawFamilySwitches || []).reduce(
          (acc, sw: any) => {
            const alias = String(sw.sfgcs_alias);
            if (!acc[alias]) {
              acc[alias] = [];
            }
            acc[alias].push({
              id: sw.sfgcs_id,
              content: sw.sfgcs_content || '',
            });
            return acc;
          },
          {} as Record<string, Array<{ id: number; content: string }>>,
        ),
      ).map(([alias, variations]) => ({
        alias,
        count: variations.length,
        variations, // TOUTES les variations
        sample:
          variations[0]?.content.substring(0, 50) +
          (variations[0]?.content.length > 50 ? '...' : ''),
      }));

      // 6. Articles blog liés (table __blog_advice)
      const { data: articles } = await this.supabase
        .from('__blog_advice')
        .select(
          'ba_id, ba_title, ba_alias, ba_preview, ba_visit, ba_create, ba_update',
        )
        .eq('ba_pg_id', pgId.toString())
        .order('ba_create', { ascending: false })
        .limit(20);

      // 7. Véhicules compatibles - TOUS les niveaux (__cross_gamme_car) avec noms
      const { data: rawVehicles } = await this.supabase
        .from('__cross_gamme_car')
        .select('cgc_id, cgc_marque_id, cgc_modele_id, cgc_type_id, cgc_level')
        .eq('cgc_pg_id', pgId.toString())
        .limit(500); // Plus de véhicules pour couvrir tous les niveaux

      // Type pour véhicule enrichi
      type EnrichedVehicle = {
        cgc_id: string;
        type_id: string;
        type_name: string;
        marque_name: string;
        modele_name: string;
        engine?: string;
        fuel?: string;
        level?: string;
      };

      // Enrichir avec les noms des marques/modèles/types
      // Structure attendue par le frontend: cgc_id, type_id, type_name, marque_name, modele_name
      let allVehicles: EnrichedVehicle[] = [];

      if (rawVehicles && rawVehicles.length > 0) {
        // Collecter les IDs type uniques
        const typeIds = [
          ...new Set(rawVehicles.map((v) => v.cgc_type_id).filter(Boolean)),
        ];

        // Requête simple sans jointures (les FK ne sont pas définies dans Supabase)
        const { data: typesData } =
          typeIds.length > 0
            ? await this.supabase
                .from('auto_type')
                .select(
                  'type_id, type_name, type_engine, type_fuel, type_marque_id, type_modele_id, type_year_from, type_year_to, type_power_ps',
                )
                .in('type_id', typeIds)
            : { data: [] };

        // Map avec STRING KEYS - IMPORTANT: type_marque_id est STRING ("140"), marque_id est NUMBER (140)
        const typeMap = new Map(
          (typesData || []).map((t: any) => [
            String(t.type_id),
            {
              name: t.type_name || '',
              engine: t.type_engine || '',
              fuel: t.type_fuel || '',
              marque_id: String(t.type_marque_id || ''),
              modele_id: String(t.type_modele_id || ''),
              year_from: t.type_year_from || '',
              year_to: t.type_year_to || '',
              power_ps: t.type_power_ps || '',
            },
          ]),
        );

        // Collecter les IDs marque/modele (strings dans auto_type)
        const allMarqueIds = new Set<string>();
        const allModeleIds = new Set<string>();
        for (const t of typesData || []) {
          if (t.type_marque_id) allMarqueIds.add(String(t.type_marque_id));
          if (t.type_modele_id) allModeleIds.add(String(t.type_modele_id));
        }

        // Lookups séparés pour marque et modele
        const [marques, modeles] = await Promise.all([
          allMarqueIds.size > 0
            ? this.supabase
                .from('auto_marque')
                .select('marque_id, marque_name')
                .in('marque_id', [...allMarqueIds])
            : { data: [] },
          allModeleIds.size > 0
            ? this.supabase
                .from('auto_modele')
                .select('modele_id, modele_name')
                .in('modele_id', [...allModeleIds])
            : { data: [] },
        ]);

        // Maps avec STRING KEYS - conversion car marque_id/modele_id sont NUMBER dans la réponse
        const marqueMap = new Map(
          (marques.data || []).map((m: any) => [
            String(m.marque_id),
            m.marque_name,
          ]),
        );
        const modeleMap = new Map(
          (modeles.data || []).map((m: any) => [
            String(m.modele_id),
            m.modele_name,
          ]),
        );

        // Enrichir les véhicules
        allVehicles = rawVehicles.map((v: any) => {
          const typeInfo = typeMap.get(String(v.cgc_type_id));
          return {
            cgc_id: v.cgc_id,
            type_id: v.cgc_type_id || '',
            type_name: typeInfo?.name || '',
            marque_name: marqueMap.get(typeInfo?.marque_id || '') || '',
            modele_name: modeleMap.get(typeInfo?.modele_id || '') || '',
            engine: typeInfo?.engine || '',
            fuel: typeInfo?.fuel || '',
            level: v.cgc_level || '1',
            year_from: typeInfo?.year_from || '',
            year_to: typeInfo?.year_to || '',
            power_ps: typeInfo?.power_ps || '',
          };
        });
      }

      // Séparer par niveau
      const vehiclesLevel1 = allVehicles.filter((v) => v.level === '1');
      const vehiclesLevel2 = allVehicles.filter((v) => v.level === '2');
      const vehiclesLevel5 = allVehicles.filter((v) => v.level === '5');

      // 8. V-Level (gamme_seo_metrics pour v_level) - Récupérer TOUS les niveaux
      const { data: vLevelData } = await this.supabase
        .from('gamme_seo_metrics')
        .select(
          'id, gamme_name, model_name, brand, variant_name, energy, v_level, rank, score, search_volume, updated_at',
        )
        .eq('gamme_id', pgId.toString())
        .order('v_level', { ascending: true })
        .order('rank', { ascending: true });

      // Grouper par V-Level
      const vLevelGrouped = {
        v1: (vLevelData || []).filter((v: any) => v.v_level === 'V1'),
        v2: (vLevelData || []).filter((v: any) => v.v_level === 'V2'),
        v3: (vLevelData || []).filter((v: any) => v.v_level === 'V3'),
        v4: (vLevelData || []).filter((v: any) => v.v_level === 'V4'),
        v5: (vLevelData || []).filter((v: any) => v.v_level === 'V5'),
      };

      // 9. Stats (table pieces)
      const { count: productsCount } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('pg_id', pgId.toString());

      return {
        gamme,
        seo: seo || {
          sg_id: null,
          sg_title: '',
          sg_descrip: '',
          sg_keywords: '',
          sg_h1: '',
          sg_content: '',
        },
        conseils: conseils || [],
        switchGroups,
        familySwitchGroups,
        // Articles enrichis avec sections_count (par défaut 0 car pas de table sections)
        articles: (articles || []).map((a: any) => ({
          ...a,
          sections_count: 0, // TODO: Compter les sections si une table existe
        })),
        vehicles: {
          level1: vehiclesLevel1,
          level2: vehiclesLevel2,
          level5: vehiclesLevel5,
        },
        vLevel: vLevelGrouped,
        stats: {
          products_count: productsCount || 0,
          articles_count: (articles || []).length,
          vehicles_level1_count: vehiclesLevel1.length,
          vehicles_level2_count: vehiclesLevel2.length,
          vehicles_level5_count: vehiclesLevel5.length,
          vehicles_total_count: allVehicles.length,
          // Stats V-Level
          vLevel_v1_count: vLevelGrouped.v1.length,
          vLevel_v2_count: vLevelGrouped.v2.length,
          vLevel_v3_count: vLevelGrouped.v3.length,
          vLevel_v4_count: vLevelGrouped.v4.length,
          vLevel_v5_count: vLevelGrouped.v5.length,
          vLevel_total_count: (vLevelData || []).length,
          // Date de dernière mise à jour V-Level (plus récente)
          vLevel_last_updated:
            vLevelData && vLevelData.length > 0
              ? (vLevelData as any[]).reduce(
                  (latest: string | null, v: any) => {
                    if (!v.updated_at) return latest;
                    if (!latest) return v.updated_at;
                    return new Date(v.updated_at) > new Date(latest)
                      ? v.updated_at
                      : latest;
                  },
                  null,
                )
              : null,
          // Date du dernier article (plus récent en premier)
          last_article_date:
            articles && articles.length > 0
              ? articles[0].ba_update || articles[0].ba_create
              : null,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error in getGammeDetail(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * 🔄 Recalcule les V-Level pour une gamme
   * Pour l'instant: met à jour updated_at pour marquer comme recalculé
   * TODO: Intégrer le vrai pipeline de calcul V-Level
   */
  async recalculateVLevel(pgId: number): Promise<{
    success: boolean;
    message: string;
    updatedCount: number;
  }> {
    try {
      this.logger.log(`🔄 Recalculating V-Level for gamme ${pgId}`);

      // Mettre à jour updated_at pour tous les enregistrements de cette gamme
      const { data, error } = await this.supabase
        .from('gamme_seo_metrics')
        .update({ updated_at: new Date().toISOString() })
        .eq('gamme_id', pgId.toString())
        .select('id');

      if (error) {
        this.logger.error(
          `❌ Error updating V-Level for gamme ${pgId}:`,
          error,
        );
        throw error;
      }

      const updatedCount = data?.length || 0;

      this.logger.log(
        `✅ V-Level recalculated for gamme ${pgId}: ${updatedCount} records updated`,
      );

      return {
        success: true,
        message: `V-Level recalculé: ${updatedCount} enregistrements mis à jour`,
        updatedCount,
      };
    } catch (error) {
      this.logger.error(`❌ Error in recalculateVLevel(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * 🔍 Valide les règles V-Level:
   * - V1 doit être V2 dans >= 30% des gammes G1
   * - Détecte les violations de cette règle
   */
  async validateV1Rules(): Promise<{
    valid: boolean;
    violations: Array<{
      model_name: string;
      variant_name: string;
      energy: string;
      v2_count: number;
      g1_total: number;
      percentage: number;
    }>;
    g1_count: number;
    summary: {
      total_v1: number;
      valid_v1: number;
      invalid_v1: number;
    };
  }> {
    try {
      this.logger.log('🔍 Validating V1 rules (>= 30% G1 gammes)');

      // 1. Compter les gammes G1 (pg_top = '1')
      const { count: g1Count, error: g1Error } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_top', '1');

      if (g1Error) {
        this.logger.error('❌ Error counting G1 gammes:', g1Error);
        throw g1Error;
      }

      const totalG1 = g1Count || 0;
      this.logger.log(`📊 Total G1 gammes: ${totalG1}`);

      // 2. Récupérer tous les V1
      const { data: v1Data, error: v1Error } = await this.supabase
        .from('gamme_seo_metrics')
        .select('model_name, variant_name, energy')
        .eq('v_level', 'V1');

      if (v1Error) {
        this.logger.error('❌ Error fetching V1 data:', v1Error);
        throw v1Error;
      }

      const v1Items = v1Data || [];
      this.logger.log(`📊 Total V1 items: ${v1Items.length}`);

      // 3. Pour chaque V1 unique (model_name + energy), compter combien de gammes G1 l'ont en V2
      const violations: Array<{
        model_name: string;
        variant_name: string;
        energy: string;
        v2_count: number;
        g1_total: number;
        percentage: number;
      }> = [];

      // Grouper les V1 par model_name + energy (pour éviter les doublons)
      const uniqueV1 = new Map<
        string,
        { model_name: string; variant_name: string; energy: string }
      >();
      for (const v1 of v1Items) {
        const key = `${v1.model_name}|${v1.energy}`;
        if (!uniqueV1.has(key)) {
          uniqueV1.set(key, v1);
        }
      }

      // Vérifier chaque V1 unique
      for (const [, v1] of uniqueV1) {
        // Compter combien de fois cette variante est V2 dans des gammes G1
        const { count: v2Count, error: v2Error } = await this.supabase
          .from('gamme_seo_metrics')
          .select('gamme_id', { count: 'exact', head: true })
          .eq('model_name', v1.model_name)
          .ilike('energy', v1.energy)
          .eq('v_level', 'V2');

        if (v2Error) {
          this.logger.warn(
            `⚠️ Error counting V2 for ${v1.model_name}:`,
            v2Error,
          );
          continue;
        }

        const v2CountNum = v2Count || 0;
        const percentage = totalG1 > 0 ? (v2CountNum / totalG1) * 100 : 0;

        // Si < 30%, c'est une violation
        if (percentage < 30) {
          violations.push({
            model_name: v1.model_name,
            variant_name: v1.variant_name || '',
            energy: v1.energy,
            v2_count: v2CountNum,
            g1_total: totalG1,
            percentage: Math.round(percentage * 10) / 10,
          });
        }
      }

      const result = {
        valid: violations.length === 0,
        violations,
        g1_count: totalG1,
        summary: {
          total_v1: uniqueV1.size,
          valid_v1: uniqueV1.size - violations.length,
          invalid_v1: violations.length,
        },
      };

      this.logger.log(
        `✅ V1 validation complete: ${result.summary.valid_v1}/${result.summary.total_v1} valid`,
      );

      return result;
    } catch (error) {
      this.logger.error('❌ Error in validateV1Rules():', error);
      throw error;
    }
  }

  /**
   * 📊 Statistiques globales V-Level pour le dashboard
   */
  async getVLevelGlobalStats(): Promise<{
    totalGammes: number;
    gammesWithVLevel: number;
    distribution: {
      v1: number;
      v2: number;
      v3: number;
      v4: number;
      v5: number;
      total: number;
    };
    freshness: {
      fresh: number;
      stale: number;
      old: number;
    };
    lastUpdated: string | null;
    g1Stats: {
      total: number;
      withV2: number;
      coverage: number;
    };
  }> {
    try {
      this.logger.log('📊 Fetching V-Level global stats');

      // 1. Total gammes
      const { count: totalGammes } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true });

      // 2. Gammes avec V-Level data
      const { data: gammesWithData } = await this.supabase
        .from('gamme_seo_metrics')
        .select('gamme_id')
        .not('v_level', 'is', null);

      const uniqueGammes = new Set(
        (gammesWithData || []).map((g: any) => g.gamme_id),
      );

      // 3. Distribution par V-Level
      const { data: allVLevels } = await this.supabase
        .from('gamme_seo_metrics')
        .select('v_level, updated_at');

      const distribution = {
        v1: 0,
        v2: 0,
        v3: 0,
        v4: 0,
        v5: 0,
        total: 0,
      };

      const freshness = {
        fresh: 0,
        stale: 0,
        old: 0,
      };

      let lastUpdated: string | null = null;
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      for (const item of allVLevels || []) {
        distribution.total++;
        switch (item.v_level) {
          case 'V1':
            distribution.v1++;
            break;
          case 'V2':
            distribution.v2++;
            break;
          case 'V3':
            distribution.v3++;
            break;
          case 'V4':
            distribution.v4++;
            break;
          case 'V5':
            distribution.v5++;
            break;
        }

        // Freshness
        if (item.updated_at) {
          const updated = new Date(item.updated_at).getTime();
          const age = now - updated;
          if (age <= sevenDays) {
            freshness.fresh++;
          } else if (age <= thirtyDays) {
            freshness.stale++;
          } else {
            freshness.old++;
          }

          if (!lastUpdated || item.updated_at > lastUpdated) {
            lastUpdated = item.updated_at;
          }
        }
      }

      // 4. G1 stats
      const { count: g1Total } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_top', '1');

      const { data: g1WithV2 } = await this.supabase
        .from('gamme_seo_metrics')
        .select('gamme_id')
        .eq('v_level', 'V2');

      const g1GammesWithV2 = new Set(
        (g1WithV2 || []).map((g: any) => g.gamme_id),
      );

      const stats = {
        totalGammes: totalGammes || 0,
        gammesWithVLevel: uniqueGammes.size,
        distribution,
        freshness,
        lastUpdated,
        g1Stats: {
          total: g1Total || 0,
          withV2: g1GammesWithV2.size,
          coverage: g1Total
            ? Math.round((g1GammesWithV2.size / g1Total) * 100)
            : 0,
        },
      };

      this.logger.log(
        `✅ V-Level global stats: ${distribution.total} entries, ${uniqueGammes.size} gammes`,
      );

      return stats;
    } catch (error) {
      this.logger.error('❌ Error in getVLevelGlobalStats():', error);
      throw error;
    }
  }
}
