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
import {
  getSwitchAliasConfig,
  SWITCH_ALIAS_NAMES,
} from '../../../config/seo-switch-aliases.config';

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

export interface EquipementierItem {
  seg_id: number;
  seg_content: string;
  seg_pm_id: number;
  pm_id: number;
  pm_name: string;
  pm_logo: string;
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
    purchaseGuide: PurchaseGuideData | null;
    stats: any;
  }> {
    try {
      const totalStart = performance.now();
      const timings: Record<string, number> = {};
      let queryStart: number;

      this.logger.log(`📋 getGammeDetail(${pgId}) - START`);

      // 1. Gamme de base (pieces_gamme)
      queryStart = performance.now();
      const { data: gamme, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select(
          'pg_id, pg_name, pg_alias, pg_level, pg_top, pg_relfollow, pg_sitemap, pg_display, pg_img',
        )
        .eq('pg_id', pgId.toString())
        .single();

      timings['1_pieces_gamme'] = performance.now() - queryStart;

      if (gammeError || !gamme) {
        throw new Error(`Gamme ${pgId} non trouvée`);
      }

      // 2. SEO (__seo_gamme)
      queryStart = performance.now();
      const { data: seo } = await this.supabase
        .from('__seo_gamme')
        .select('sg_id, sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
        .eq('sg_pg_id', pgId.toString())
        .maybeSingle();
      timings['2_seo_gamme'] = performance.now() - queryStart;

      // 3. Conseils (seo_gamme_conseil)
      queryStart = performance.now();
      const { data: conseils } = await this.supabase
        .from('seo_gamme_conseil')
        .select('sgc_id, sgc_title, sgc_content')
        .eq('sgc_pg_id', pgId.toString())
        .order('sgc_id', { ascending: true });
      timings['3_conseils'] = performance.now() - queryStart;

      // 4. Item Switches (__seo_item_switch) - GROUPÉS par alias
      // Note: Alias 1 & 2 sont spécifiques à la gamme, Alias 3 est GLOBAL (pgId=0)
      // Pattern identique à Family Switches (ligne 1112)
      queryStart = performance.now();
      const { data: rawSwitches } = await this.supabase
        .from('__seo_item_switch')
        .select('sis_id, sis_alias, sis_content, sis_pg_id')
        .or(
          `and(sis_pg_id.eq.${pgId},sis_alias.in.(1,2)),and(sis_pg_id.eq.0,sis_alias.eq.3)`,
        )
        .order('sis_alias', { ascending: true });
      timings['4_item_switches'] = performance.now() - queryStart;

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
      ).map(([alias, variations]) => {
        const config = getSwitchAliasConfig(alias, 'item');
        const placeholder = config?.placeholder || `#Switch_${alias}#`;
        return {
          alias,
          name: config?.name || SWITCH_ALIAS_NAMES.item[alias] || `Alias ${alias}`,
          placeholder,
          description: config?.description || '',
          usedInTemplate: seo?.sg_content?.includes(placeholder) || false,
          count: variations.length,
          variations, // TOUTES les variations (pas de slice)
          sample:
            variations[0]?.content.substring(0, 50) +
            (variations[0]?.content.length > 50 ? '...' : ''),
        };
      });

      // 5. Family Switches (__seo_family_gamme_car_switch) - alias 11-16
      // Note: Les Family Switches sont indexés par mf_id (famille), pas pg_id
      // On récupère d'abord le mc_mf_prime depuis catalog_gamme
      queryStart = performance.now();
      const { data: catalogData } = await this.supabase
        .from('catalog_gamme')
        .select('mc_mf_prime')
        .eq('mc_pg_id', pgId.toString())
        .maybeSingle();
      timings['5a_catalog_gamme'] = performance.now() - queryStart;

      const mfId = catalogData?.mc_mf_prime || '0';
      this.logger.debug(`🔍 Family mfId pour pgId=${pgId}: ${mfId}`);

      // Requête Family Switches avec mf_id + pg_id (0 = global, pgId = spécifique)
      queryStart = performance.now();
      const { data: rawFamilySwitches } = await this.supabase
        .from('__seo_family_gamme_car_switch')
        .select('sfgcs_id, sfgcs_alias, sfgcs_content, sfgcs_pg_id')
        .eq('sfgcs_mf_id', mfId)
        .or(`sfgcs_pg_id.eq.0,sfgcs_pg_id.eq.${pgId}`)
        .order('sfgcs_alias', { ascending: true });
      timings['5b_family_switches'] = performance.now() - queryStart;

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
      ).map(([alias, variations]) => {
        const config = getSwitchAliasConfig(alias, 'family');
        const placeholder = config?.placeholder || `#FamilySwitch_${alias}#`;
        return {
          alias,
          name: config?.name || SWITCH_ALIAS_NAMES.family[alias] || `Alias ${alias}`,
          placeholder,
          description: config?.description || '',
          usedInTemplate: seo?.sg_content?.includes(placeholder) || false,
          count: variations.length,
          variations, // TOUTES les variations
          sample:
            variations[0]?.content.substring(0, 50) +
            (variations[0]?.content.length > 50 ? '...' : ''),
        };
      });

      // 6. Articles blog liés (table __blog_advice)
      queryStart = performance.now();
      const { data: articles } = await this.supabase
        .from('__blog_advice')
        .select(
          'ba_id, ba_title, ba_alias, ba_preview, ba_visit, ba_create, ba_update',
        )
        .eq('ba_pg_id', pgId.toString())
        .order('ba_create', { ascending: false })
        .limit(20);
      timings['6_blog_advice'] = performance.now() - queryStart;

      // 7. Véhicules compatibles - TOUS les niveaux (__cross_gamme_car) avec noms
      queryStart = performance.now();
      const { data: rawVehicles } = await this.supabase
        .from('__cross_gamme_car')
        .select('cgc_id, cgc_marque_id, cgc_modele_id, cgc_type_id, cgc_level')
        .eq('cgc_pg_id', pgId.toString())
        .limit(500); // Plus de véhicules pour couvrir tous les niveaux
      timings['7_cross_gamme_car'] = performance.now() - queryStart;

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
        queryStart = performance.now();
        const { data: typesData } =
          typeIds.length > 0
            ? await this.supabase
                .from('auto_type')
                .select(
                  'type_id, type_name, type_engine, type_fuel, type_marque_id, type_modele_id, type_year_from, type_year_to, type_power_ps',
                )
                .in('type_id', typeIds)
            : { data: [] };
        timings['8_auto_type'] = performance.now() - queryStart;

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
        queryStart = performance.now();
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
        timings['9_marque_modele'] = performance.now() - queryStart;

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
      queryStart = performance.now();
      const { data: vLevelData } = await this.supabase
        .from('gamme_seo_metrics')
        .select(
          'id, gamme_name, model_name, brand, variant_name, energy, v_level, rank, score, search_volume, updated_at',
        )
        .eq('pg_id', pgId.toString())
        .order('v_level', { ascending: true })
        .order('rank', { ascending: true });
      timings['10_vlevel_metrics'] = performance.now() - queryStart;

      // Grouper par V-Level
      const vLevelGrouped = {
        v1: (vLevelData || []).filter((v: any) => v.v_level === 'V1'),
        v2: (vLevelData || []).filter((v: any) => v.v_level === 'V2'),
        v3: (vLevelData || []).filter((v: any) => v.v_level === 'V3'),
        v4: (vLevelData || []).filter((v: any) => v.v_level === 'V4'),
        v5: (vLevelData || []).filter((v: any) => v.v_level === 'V5'),
      };

      // 9. Stats (table pieces)
      queryStart = performance.now();
      const { count: productsCount } = await this.supabase
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .eq('pg_id', pgId.toString());
      timings['11_pieces_count'] = performance.now() - queryStart;

      // 10. Purchase Guide (__seo_gamme_purchase_guide)
      queryStart = performance.now();
      const { data: purchaseGuideData } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .select('*')
        .eq('sgpg_pg_id', pgId.toString())
        .maybeSingle();
      timings['12_purchase_guide'] = performance.now() - queryStart;

      const purchaseGuide = this.transformPurchaseGuideFromDb(purchaseGuideData);

      // Log du timing total
      const totalTime = performance.now() - totalStart;
      this.logger.log(
        `✅ getGammeDetail(${pgId}) completed in ${totalTime.toFixed(0)}ms`,
      );
      this.logger.log(`📊 Timing breakdown: ${JSON.stringify(timings)}`);

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
        purchaseGuide,
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
          // Debug: timings de performance
          _debug: {
            totalTimeMs: Math.round(totalTime),
            timings: Object.fromEntries(
              Object.entries(timings).map(([k, v]) => [k, Math.round(v)]),
            ),
          },
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error in getGammeDetail(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * 🔄 Recalcule les V-Level pour une gamme
   * Algorithme simplifié basé sur search_volume existant:
   * - Par énergie (diesel/essence), trier par search_volume DESC
   * - Position 1 → V2 (champion gamme, UNIQUE par énergie)
   * - Positions 2-4 → V3 (challengers)
   * - search_volume = 0 ou null → V4 (faibles)
   * - Reste → V5 (bloc B)
   * Note: V1 (global) est calculé séparément via validateV1Rules
   */
  async recalculateVLevel(pgId: number): Promise<{
    success: boolean;
    message: string;
    updatedCount: number;
    details: {
      v2: number;
      v3: number;
      v4: number;
      v5: number;
    };
  }> {
    try {
      this.logger.log(`🔄 Recalculating V-Level for gamme ${pgId}`);

      // 1. Récupérer tous les enregistrements pour cette gamme
      const { data: records, error: fetchError } = await this.supabase
        .from('gamme_seo_metrics')
        .select('id, energy, search_volume, v_level')
        .eq('pg_id', pgId.toString());

      if (fetchError) {
        this.logger.error(
          `❌ Error fetching gamme_seo_metrics for gamme ${pgId}:`,
          fetchError,
        );
        throw fetchError;
      }

      if (!records || records.length === 0) {
        return {
          success: true,
          message: 'Aucun enregistrement à recalculer pour cette gamme',
          updatedCount: 0,
          details: { v2: 0, v3: 0, v4: 0, v5: 0 },
        };
      }

      // 2. Grouper par énergie (normaliser diesel/essence)
      const byEnergy = new Map<string, typeof records>();
      for (const record of records) {
        const energy = (record.energy || 'unknown').toLowerCase();
        const normalizedEnergy =
          energy.includes('diesel') || energy.includes('gasoil')
            ? 'diesel'
            : energy.includes('essence') || energy.includes('petrol')
              ? 'essence'
              : energy;

        if (!byEnergy.has(normalizedEnergy)) {
          byEnergy.set(normalizedEnergy, []);
        }
        byEnergy.get(normalizedEnergy)!.push(record);
      }

      // 3. Pour chaque groupe d'énergie, recalculer V-Level
      const updates: Array<{ id: number; v_level: string; rank: number }> = [];
      const details = { v2: 0, v3: 0, v4: 0, v5: 0 };

      for (const [energy, energyRecords] of byEnergy) {
        // Trier par search_volume DESC (nulls last)
        const sorted = [...energyRecords].sort((a, b) => {
          const volA = a.search_volume ?? -1;
          const volB = b.search_volume ?? -1;
          return volB - volA;
        });

        sorted.forEach((record, index) => {
          let newVLevel: string;
          const searchVol = record.search_volume ?? 0;

          // Skip V1 (global champion) - keep existing if already V1
          if (record.v_level === 'V1') {
            return; // Don't change V1, it's calculated globally
          }

          if (index === 0 && searchVol > 0) {
            // Position 1 avec volume > 0 → V2 (champion gamme)
            newVLevel = 'V2';
            details.v2++;
          } else if (index >= 1 && index <= 3 && searchVol > 0) {
            // Positions 2-4 avec volume > 0 → V3 (challengers)
            newVLevel = 'V3';
            details.v3++;
          } else if (searchVol === 0 || searchVol === null) {
            // Pas de volume de recherche → V4 (faibles)
            newVLevel = 'V4';
            details.v4++;
          } else {
            // Reste → V5 (bloc B)
            newVLevel = 'V5';
            details.v5++;
          }

          updates.push({
            id: record.id,
            v_level: newVLevel,
            rank: index + 1,
          });
        });
      }

      // 4. Appliquer les mises à jour
      let updatedCount = 0;
      for (const update of updates) {
        const { error: updateError } = await this.supabase
          .from('gamme_seo_metrics')
          .update({
            v_level: update.v_level,
            rank: update.rank,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);

        if (updateError) {
          this.logger.warn(
            `⚠️ Error updating record ${update.id}:`,
            updateError,
          );
        } else {
          updatedCount++;
        }
      }

      this.logger.log(
        `✅ V-Level recalculated for gamme ${pgId}: ${updatedCount}/${updates.length} records updated`,
      );
      this.logger.log(
        `   Details: V2=${details.v2}, V3=${details.v3}, V4=${details.v4}, V5=${details.v5}`,
      );

      return {
        success: true,
        message: `V-Level recalculé: ${updatedCount} enregistrements mis à jour (V2: ${details.v2}, V3: ${details.v3}, V4: ${details.v4}, V5: ${details.v5})`,
        updatedCount,
        details,
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
          .select('pg_id', { count: 'exact', head: true })
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
        .select('pg_id')
        .not('v_level', 'is', null);

      const uniqueGammes = new Set(
        (gammesWithData || []).map((g: any) => g.pg_id),
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
        .select('pg_id')
        .eq('v_level', 'V2');

      const g1GammesWithV2 = new Set(
        (g1WithV2 || []).map((g: any) => g.pg_id),
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

  // ============== SEO CONTENT MANAGEMENT ==============

  /**
   * 💾 Met à jour les données SEO d'une gamme (depuis l'interface admin)
   * Utilisé par le formulaire "Données SEO" dans /admin/gammes-seo/:pgId
   */
  async updateGammeSeo(
    pgId: number,
    seoData: {
      sg_title: string;
      sg_descrip: string;
      sg_keywords: string;
      sg_h1: string;
      sg_content: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    seo: typeof seoData;
    isNew: boolean;
  }> {
    try {
      this.logger.log(`💾 Updating SEO for gamme ${pgId}`);

      // 1. Vérifier si un enregistrement existe déjà
      const { data: existingSeo } = await this.supabase
        .from('__seo_gamme')
        .select('sg_id')
        .eq('sg_pg_id', pgId.toString())
        .maybeSingle();

      // 2. Mettre à jour ou insérer
      if (existingSeo) {
        const { error: updateError } = await this.supabase
          .from('__seo_gamme')
          .update({
            sg_title: seoData.sg_title,
            sg_descrip: seoData.sg_descrip,
            sg_keywords: seoData.sg_keywords,
            sg_h1: seoData.sg_h1,
            sg_content: seoData.sg_content,
          })
          .eq('sg_id', existingSeo.sg_id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        this.logger.log(`✅ SEO updated for gamme ${pgId}`);
        return {
          success: true,
          message: `SEO mis à jour avec succès`,
          seo: seoData,
          isNew: false,
        };
      } else {
        const { error: insertError } = await this.supabase
          .from('__seo_gamme')
          .insert({
            sg_pg_id: pgId.toString(),
            sg_title: seoData.sg_title,
            sg_descrip: seoData.sg_descrip,
            sg_keywords: seoData.sg_keywords,
            sg_h1: seoData.sg_h1,
            sg_content: seoData.sg_content,
          });

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        this.logger.log(`✅ SEO created for gamme ${pgId}`);
        return {
          success: true,
          message: `SEO créé avec succès`,
          seo: seoData,
          isNew: true,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Error updating SEO for gamme ${pgId}:`, error);
      throw error;
    }
  }

  // ============== SEO CONTENT GENERATOR ==============

  /**
   * 🎯 Génère le contenu SEO pour une gamme spécifique
   * Basé sur le G-Level et les données de la gamme
   */
  async generateGammeSeo(pgId: number): Promise<{
    success: boolean;
    message: string;
    seo: {
      sg_title: string;
      sg_descrip: string;
      sg_keywords: string;
      sg_h1: string;
      sg_content: string;
    };
    isNew: boolean;
  }> {
    try {
      this.logger.log(`🎯 Generating SEO for gamme ${pgId}`);

      // 1. Récupérer les données de la gamme
      const { data: gamme, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name, pg_name_meta, pg_top, pg_level, pg_alias')
        .eq('pg_id', pgId.toString())
        .single();

      if (gammeError || !gamme) {
        throw new Error(`Gamme ${pgId} not found`);
      }

      // 2. Récupérer les metrics (trends, g_level)
      const { data: metrics } = await this.supabase
        .from('gamme_seo_metrics')
        .select('trends_index, g_level_recommended, seo_score')
        .eq('pg_id', pgId.toString())
        .maybeSingle();

      // 3. Déterminer le G-Level effectif
      const gLevel =
        gamme.pg_top === '1'
          ? 'G1'
          : metrics?.g_level_recommended || 'G3';

      // 4. Générer le contenu SEO basé sur le template
      const gammeName = gamme.pg_name || '';
      const gammeNameMeta = gamme.pg_name_meta || gammeName;
      const seoContent = this.generateSeoContent(gammeName, gammeNameMeta, gLevel);

      // 5. Vérifier si un enregistrement existe déjà
      const { data: existingSeo } = await this.supabase
        .from('__seo_gamme')
        .select('sg_id')
        .eq('sg_pg_id', pgId.toString())
        .maybeSingle();

      // 6. Insérer ou mettre à jour
      if (existingSeo) {
        const { error: updateError } = await this.supabase
          .from('__seo_gamme')
          .update({
            sg_title: seoContent.title,
            sg_descrip: seoContent.description,
            sg_keywords: seoContent.keywords,
            sg_h1: seoContent.h1,
            sg_content: seoContent.content,
          })
          .eq('sg_id', existingSeo.sg_id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        this.logger.log(`✅ SEO updated for gamme ${pgId}`);
        return {
          success: true,
          message: `SEO mis à jour pour ${gammeName}`,
          seo: {
            sg_title: seoContent.title,
            sg_descrip: seoContent.description,
            sg_keywords: seoContent.keywords,
            sg_h1: seoContent.h1,
            sg_content: seoContent.content,
          },
          isNew: false,
        };
      } else {
        const { error: insertError } = await this.supabase
          .from('__seo_gamme')
          .insert({
            sg_pg_id: pgId.toString(),
            sg_title: seoContent.title,
            sg_descrip: seoContent.description,
            sg_keywords: seoContent.keywords,
            sg_h1: seoContent.h1,
            sg_content: seoContent.content,
          });

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        this.logger.log(`✅ SEO created for gamme ${pgId}`);
        return {
          success: true,
          message: `SEO créé pour ${gammeName}`,
          seo: {
            sg_title: seoContent.title,
            sg_descrip: seoContent.description,
            sg_keywords: seoContent.keywords,
            sg_h1: seoContent.h1,
            sg_content: seoContent.content,
          },
          isNew: true,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Error generating SEO for gamme ${pgId}:`, error);
      throw error;
    }
  }

  /**
   * 📝 Génère le contenu SEO basé sur templates
   */
  private generateSeoContent(
    gammeName: string,
    gammeNameMeta: string,
    gLevel: string,
  ): {
    title: string;
    description: string;
    keywords: string;
    h1: string;
    content: string;
  } {
    // Templates SEO par G-Level
    const templates: Record<string, {
      title: string;
      description: string;
      h1: string;
      content: string;
    }> = {
      G1: {
        title: `${gammeNameMeta} | Pièces auto qualité OE - Automecanik`,
        description: `Large choix de ${gammeName.toLowerCase()} pour toutes marques. Qualité OE, prix compétitifs, livraison rapide. Trouvez la pièce adaptée à votre véhicule.`,
        h1: gammeName,
        content: `<p>Découvrez notre sélection de <strong>${gammeName.toLowerCase()}</strong> pour votre véhicule. Chez Automecanik, nous proposons des pièces de qualité équipementier d'origine (OE) aux meilleurs prix.</p>
<h2>Pourquoi choisir nos ${gammeName.toLowerCase()} ?</h2>
<ul>
  <li>Qualité équipementier d'origine garantie</li>
  <li>Compatible avec toutes les marques automobiles</li>
  <li>Prix compétitifs et livraison rapide</li>
  <li>Service client expert pour vous conseiller</li>
</ul>
<p>Sélectionnez votre véhicule pour trouver la pièce compatible avec votre modèle.</p>`,
      },
      G2: {
        title: `${gammeNameMeta} - Pièces auto | Automecanik`,
        description: `${gammeName} pour votre véhicule. Pièces de qualité, prix attractifs. Commandez en ligne sur Automecanik.`,
        h1: gammeName,
        content: `<p>Retrouvez notre gamme de <strong>${gammeName.toLowerCase()}</strong>. Pièces de qualité pour l'entretien et la réparation de votre véhicule.</p>
<p>Utilisez notre sélecteur de véhicule pour trouver les pièces compatibles avec votre automobile.</p>`,
      },
      G3: {
        title: `${gammeNameMeta} | Automecanik`,
        description: `${gammeName} disponibles sur Automecanik. Trouvez la pièce compatible avec votre véhicule.`,
        h1: gammeName,
        content: `<p>Pièces <strong>${gammeName.toLowerCase()}</strong> disponibles. Sélectionnez votre véhicule pour voir les références compatibles.</p>`,
      },
    };

    const template = templates[gLevel] || templates.G3;

    // Générer les keywords
    const keywords = [
      gammeName.toLowerCase(),
      `${gammeName.toLowerCase()} voiture`,
      `${gammeName.toLowerCase()} auto`,
      `acheter ${gammeName.toLowerCase()}`,
      `prix ${gammeName.toLowerCase()}`,
    ].join(', ');

    return {
      title: template.title,
      description: template.description,
      keywords,
      h1: template.h1,
      content: template.content,
    };
  }

  /**
   * 🚀 Génère le SEO pour toutes les gammes sans contenu
   * Batch generation avec progress tracking
   */
  async generateAllGammesSeo(options?: {
    onlyEmpty?: boolean;
    gLevels?: string[];
    limit?: number;
  }): Promise<{
    success: boolean;
    message: string;
    stats: {
      total: number;
      created: number;
      updated: number;
      errors: number;
    };
    errors: Array<{ pgId: number; error: string }>;
  }> {
    const stats = { total: 0, created: 0, updated: 0, errors: 0 };
    const errors: Array<{ pgId: number; error: string }> = [];

    try {
      this.logger.log('🚀 Starting batch SEO generation');

      // 1. Récupérer les gammes à traiter
      let query = this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_name')
        .eq('pg_display', '1');

      // Filtre G-Level si spécifié
      if (options?.gLevels?.includes('G1')) {
        query = query.eq('pg_top', '1');
      }

      const { data: gammes, error: gammesError } = await query
        .order('pg_id')
        .limit(options?.limit || 1000);

      if (gammesError) {
        throw new Error(`Failed to fetch gammes: ${gammesError.message}`);
      }

      if (!gammes || gammes.length === 0) {
        return {
          success: true,
          message: 'Aucune gamme à traiter',
          stats,
          errors,
        };
      }

      // 2. Si onlyEmpty, filtrer les gammes sans SEO
      let gammesToProcess = gammes;
      if (options?.onlyEmpty) {
        const { data: existingSeo } = await this.supabase
          .from('__seo_gamme')
          .select('sg_pg_id');

        const existingPgIds = new Set(
          (existingSeo || []).map((s: any) => s.sg_pg_id),
        );

        gammesToProcess = gammes.filter(
          (g) => !existingPgIds.has(g.pg_id?.toString()),
        );
      }

      stats.total = gammesToProcess.length;
      this.logger.log(`📊 Processing ${stats.total} gammes`);

      // 3. Générer le SEO pour chaque gamme
      for (const gamme of gammesToProcess) {
        try {
          const pgId = parseInt(gamme.pg_id || '0', 10);
          if (!pgId) continue;

          const result = await this.generateGammeSeo(pgId);

          if (result.isNew) {
            stats.created++;
          } else {
            stats.updated++;
          }
        } catch (error) {
          stats.errors++;
          errors.push({
            pgId: parseInt(gamme.pg_id || '0', 10),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const message = `SEO généré: ${stats.created} créés, ${stats.updated} mis à jour, ${stats.errors} erreurs`;
      this.logger.log(`✅ ${message}`);

      return {
        success: stats.errors === 0,
        message,
        stats,
        errors,
      };
    } catch (error) {
      this.logger.error('❌ Error in batch SEO generation:', error);
      throw error;
    }
  }

  /**
   * 📊 Récupère les statistiques SEO des gammes
   */
  async getSeoGenerationStats(): Promise<{
    totalGammes: number;
    gammesWithSeo: number;
    gammesWithoutSeo: number;
    coverage: number;
    byGLevel: {
      g1: { total: number; withSeo: number };
      g2: { total: number; withSeo: number };
      g3: { total: number; withSeo: number };
    };
  }> {
    try {
      // Total gammes actives
      const { count: totalGammes } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', '1');

      // Gammes avec SEO
      const { count: gammesWithSeo } = await this.supabase
        .from('__seo_gamme')
        .select('*', { count: 'exact', head: true });

      // G1 (top gammes)
      const { count: g1Total } = await this.supabase
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', '1')
        .eq('pg_top', '1');

      // G1 avec SEO
      const { data: g1Gammes } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id')
        .eq('pg_display', '1')
        .eq('pg_top', '1');

      const g1PgIds = (g1Gammes || []).map((g: any) => g.pg_id?.toString());

      const { count: g1WithSeo } = g1PgIds.length > 0
        ? await this.supabase
            .from('__seo_gamme')
            .select('*', { count: 'exact', head: true })
            .in('sg_pg_id', g1PgIds)
        : { count: 0 };

      const total = totalGammes || 0;
      const withSeo = gammesWithSeo || 0;
      const g1TotalCount = g1Total || 0;
      const g1WithSeoCount = g1WithSeo || 0;

      return {
        totalGammes: total,
        gammesWithSeo: withSeo,
        gammesWithoutSeo: total - withSeo,
        coverage: total > 0 ? Math.round((withSeo / total) * 100) : 0,
        byGLevel: {
          g1: { total: g1TotalCount, withSeo: g1WithSeoCount },
          g2: { total: 0, withSeo: 0 }, // Calculé si besoin
          g3: { total: total - g1TotalCount, withSeo: withSeo - g1WithSeoCount },
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting SEO generation stats:', error);
      throw error;
    }
  }

  // =========================================================================
  // CRUD Family Switches
  // =========================================================================

  /**
   * Créer un Family Switch
   */
  async createFamilySwitch(
    pgId: number,
    alias: number,
    content: string,
  ): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      // 1. Récupérer le mf_id depuis catalog_gamme
      const { data: catalogData } = await this.supabase
        .from('catalog_gamme')
        .select('mc_mf_prime')
        .eq('mc_pg_id', pgId.toString())
        .maybeSingle();

      const mfId = catalogData?.mc_mf_prime || '0';

      if (mfId === '0') {
        return { success: false, error: 'Famille non trouvée pour cette gamme' };
      }

      // 2. Insérer le switch
      const { data, error } = await this.supabase
        .from('__seo_family_gamme_car_switch')
        .insert({
          sfgcs_mf_id: mfId,
          sfgcs_pg_id: pgId.toString(),
          sfgcs_alias: alias.toString(),
          sfgcs_content: content,
        })
        .select('sfgcs_id')
        .single();

      if (error) {
        this.logger.error('❌ Error creating family switch:', error);
        return { success: false, error: error.message };
      }

      this.logger.log(`✅ Family switch créé: id=${data.sfgcs_id}, alias=${alias}`);
      return { success: true, id: data.sfgcs_id };
    } catch (error) {
      this.logger.error('❌ Error in createFamilySwitch:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Modifier un Family Switch
   */
  async updateFamilySwitch(
    id: number,
    content: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('__seo_family_gamme_car_switch')
        .update({ sfgcs_content: content })
        .eq('sfgcs_id', id);

      if (error) {
        this.logger.error('❌ Error updating family switch:', error);
        return { success: false, error: error.message };
      }

      this.logger.log(`✅ Family switch mis à jour: id=${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Error in updateFamilySwitch:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Supprimer un Family Switch
   */
  async deleteFamilySwitch(
    id: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('__seo_family_gamme_car_switch')
        .delete()
        .eq('sfgcs_id', id);

      if (error) {
        this.logger.error('❌ Error deleting family switch:', error);
        return { success: false, error: error.message };
      }

      this.logger.log(`✅ Family switch supprimé: id=${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Error in deleteFamilySwitch:', error);
      return { success: false, error: String(error) };
    }
  }

  // =========================================================================
  // PURCHASE GUIDE CRUD
  // =========================================================================

  /**
   * 📖 Interface pour les données du guide d'achat
   */
  private transformPurchaseGuideFromDb(data: any): PurchaseGuideData | null {
    if (!data) return null;

    return {
      id: data.sgpg_id,
      pgId: data.sgpg_pg_id,
      step1: {
        title: data.sgpg_step1_title || 'Vérifiez la compatibilité',
        content: data.sgpg_step1_content || '',
        highlight: data.sgpg_step1_highlight || '',
        bullets: data.sgpg_step1_bullets || [],
      },
      step2: {
        economique: {
          subtitle: data.sgpg_eco_subtitle || '',
          description: data.sgpg_eco_description || '',
          specs: data.sgpg_eco_specs || [],
          priceRange: data.sgpg_eco_price || '',
        },
        qualitePlus: {
          subtitle: data.sgpg_qplus_subtitle || '',
          description: data.sgpg_qplus_description || '',
          specs: data.sgpg_qplus_specs || [],
          priceRange: data.sgpg_qplus_price || '',
          badge: data.sgpg_qplus_badge || 'Le plus choisi',
        },
        premium: {
          subtitle: data.sgpg_premium_subtitle || '',
          description: data.sgpg_premium_description || '',
          specs: data.sgpg_premium_specs || [],
          priceRange: data.sgpg_premium_price || '',
        },
      },
      step3: {
        title: data.sgpg_step3_title || 'Sécurité et conseils',
        content: data.sgpg_step3_content || '',
        alerts: data.sgpg_step3_alerts || [],
        relatedGammes: data.sgpg_related_gammes || [],
      },
      createdAt: data.sgpg_created_at,
      updatedAt: data.sgpg_updated_at,
    };
  }

  /**
   * 📖 Récupérer le guide d'achat d'une gamme
   */
  async getPurchaseGuide(pgId: number): Promise<PurchaseGuideData | null> {
    try {
      this.logger.log(`📖 Getting purchase guide for gamme ${pgId}`);

      const { data, error } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .select('*')
        .eq('sgpg_pg_id', pgId.toString())
        .maybeSingle();

      if (error) {
        this.logger.error(`❌ Error fetching purchase guide:`, error);
        throw error;
      }

      const guide = this.transformPurchaseGuideFromDb(data);
      this.logger.log(
        guide
          ? `✅ Purchase guide found for gamme ${pgId}`
          : `ℹ️ No purchase guide for gamme ${pgId}`,
      );

      return guide;
    } catch (error) {
      this.logger.error(`❌ Error in getPurchaseGuide(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * 💾 Mettre à jour ou créer le guide d'achat d'une gamme
   */
  async updatePurchaseGuide(
    pgId: number,
    guideData: Omit<PurchaseGuideData, 'id' | 'pgId' | 'createdAt' | 'updatedAt'>,
  ): Promise<{ success: boolean; message: string; guide: PurchaseGuideData | null }> {
    try {
      this.logger.log(`💾 Updating purchase guide for gamme ${pgId}`);

      // Transformer les données pour la DB
      const dbData = {
        sgpg_pg_id: pgId.toString(),
        sgpg_step1_title: guideData.step1.title,
        sgpg_step1_content: guideData.step1.content,
        sgpg_step1_highlight: guideData.step1.highlight,
        sgpg_step1_bullets: guideData.step1.bullets || [],
        sgpg_eco_subtitle: guideData.step2.economique.subtitle,
        sgpg_eco_description: guideData.step2.economique.description,
        sgpg_eco_specs: guideData.step2.economique.specs || [],
        sgpg_eco_price: guideData.step2.economique.priceRange,
        sgpg_qplus_subtitle: guideData.step2.qualitePlus.subtitle,
        sgpg_qplus_description: guideData.step2.qualitePlus.description,
        sgpg_qplus_specs: guideData.step2.qualitePlus.specs || [],
        sgpg_qplus_price: guideData.step2.qualitePlus.priceRange,
        sgpg_qplus_badge: guideData.step2.qualitePlus.badge || 'Le plus choisi',
        sgpg_premium_subtitle: guideData.step2.premium.subtitle,
        sgpg_premium_description: guideData.step2.premium.description,
        sgpg_premium_specs: guideData.step2.premium.specs || [],
        sgpg_premium_price: guideData.step2.premium.priceRange,
        sgpg_step3_title: guideData.step3.title,
        sgpg_step3_content: guideData.step3.content,
        sgpg_step3_alerts: guideData.step3.alerts || [],
        sgpg_related_gammes: guideData.step3.relatedGammes || [],
        sgpg_updated_at: new Date().toISOString(),
      };

      // Vérifier si le guide existe déjà
      const { data: existing } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_id')
        .eq('sgpg_pg_id', pgId.toString())
        .maybeSingle();

      let result;
      let isNew = false;

      if (existing) {
        // Update existing
        result = await this.supabase
          .from('__seo_gamme_purchase_guide')
          .update(dbData)
          .eq('sgpg_id', existing.sgpg_id)
          .select('*')
          .single();
      } else {
        // Insert new
        isNew = true;
        result = await this.supabase
          .from('__seo_gamme_purchase_guide')
          .insert({
            ...dbData,
            sgpg_created_at: new Date().toISOString(),
          })
          .select('*')
          .single();
      }

      if (result.error) {
        this.logger.error(`❌ Error saving purchase guide:`, result.error);
        throw result.error;
      }

      const guide = this.transformPurchaseGuideFromDb(result.data);
      const action = isNew ? 'créé' : 'mis à jour';
      this.logger.log(`✅ Purchase guide ${action} for gamme ${pgId}`);

      return {
        success: true,
        message: `Guide d'achat ${action} avec succès`,
        guide,
      };
    } catch (error) {
      this.logger.error(`❌ Error in updatePurchaseGuide(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprimer le guide d'achat d'une gamme
   */
  async deletePurchaseGuide(
    pgId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`🗑️ Deleting purchase guide for gamme ${pgId}`);

      const { error } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .delete()
        .eq('sgpg_pg_id', pgId.toString());

      if (error) {
        this.logger.error(`❌ Error deleting purchase guide:`, error);
        throw error;
      }

      this.logger.log(`✅ Purchase guide deleted for gamme ${pgId}`);
      return {
        success: true,
        message: `Guide d'achat supprimé`,
      };
    } catch (error) {
      this.logger.error(`❌ Error in deletePurchaseGuide(${pgId}):`, error);
      throw error;
    }
  }

  // =========================================================================
  // INFORMATIONS TECHNIQUES (__seo_gamme_info)
  // =========================================================================

  /**
   * Récupère toutes les informations techniques d'une gamme
   */
  async getInformations(
    pgId: number,
  ): Promise<{ sgi_id: number; sgi_content: string }[]> {
    try {
      const { data, error } = await this.supabase
        .from('__seo_gamme_info')
        .select('sgi_id, sgi_content')
        .eq('sgi_pg_id', pgId)
        .order('sgi_id', { ascending: true });

      if (error) {
        this.logger.error(`Error fetching informations for gamme ${pgId}:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error in getInformations(${pgId}):`, error);
      return [];
    }
  }

  /**
   * Ajoute une nouvelle information technique
   */
  async addInformation(
    pgId: number,
    content: string,
  ): Promise<{ success: boolean; item?: any; message?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('__seo_gamme_info')
        .insert({ sgi_pg_id: pgId, sgi_content: content })
        .select('sgi_id, sgi_content')
        .single();

      if (error) {
        this.logger.error(`Error adding information for gamme ${pgId}:`, error);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Information added for gamme ${pgId}`);
      return { success: true, item: data };
    } catch (error) {
      this.logger.error(`Error in addInformation(${pgId}):`, error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  /**
   * Met à jour une information technique
   */
  async updateInformation(
    sgiId: number,
    content: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await this.supabase
        .from('__seo_gamme_info')
        .update({ sgi_content: content })
        .eq('sgi_id', sgiId);

      if (error) {
        this.logger.error(`Error updating information ${sgiId}:`, error);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Information ${sgiId} updated`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in updateInformation(${sgiId}):`, error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  /**
   * Supprime une information technique
   */
  async deleteInformation(
    sgiId: number,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await this.supabase
        .from('__seo_gamme_info')
        .delete()
        .eq('sgi_id', sgiId);

      if (error) {
        this.logger.error(`Error deleting information ${sgiId}:`, error);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Information ${sgiId} deleted`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in deleteInformation(${sgiId}):`, error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  // =========================================================================
  // ÉQUIPEMENTIERS (__seo_equip_gamme)
  // =========================================================================

  /**
   * Récupère tous les équipementiers d'une gamme avec infos marque
   */
  async getEquipementiers(pgId: number): Promise<EquipementierItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('__seo_equip_gamme')
        .select(
          `
          seg_id,
          seg_content,
          seg_pm_id,
          pieces_marque!inner(pm_id, pm_name, pm_logo)
        `,
        )
        .eq('seg_pg_id', pgId);

      if (error) {
        this.logger.error(`Error fetching equipementiers for gamme ${pgId}:`, error);
        return [];
      }

      // Transformer pour un format plus simple
      return (data || []).map((item: any) => ({
        seg_id: item.seg_id,
        seg_content: item.seg_content,
        seg_pm_id: item.seg_pm_id,
        pm_id: item.pieces_marque?.pm_id,
        pm_name: item.pieces_marque?.pm_name,
        pm_logo: item.pieces_marque?.pm_logo,
      }));
    } catch (error) {
      this.logger.error(`Error in getEquipementiers(${pgId}):`, error);
      return [];
    }
  }

  /**
   * Liste des marques disponibles (pour dropdown)
   */
  async getAvailableMarques(): Promise<
    { pm_id: number; pm_name: string; pm_logo: string }[]
  > {
    try {
      const { data, error } = await this.supabase
        .from('pieces_marque')
        .select('pm_id, pm_name, pm_logo')
        .order('pm_name', { ascending: true });

      if (error) {
        this.logger.error('Error fetching available marques:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error in getAvailableMarques:', error);
      return [];
    }
  }

  /**
   * Ajoute un équipementier à une gamme
   */
  async addEquipementier(
    pgId: number,
    pmId: number,
    content: string,
  ): Promise<{ success: boolean; item?: any; message?: string }> {
    try {
      // Vérifier si l'équipementier existe déjà pour cette gamme
      const { data: existing } = await this.supabase
        .from('__seo_equip_gamme')
        .select('seg_id')
        .eq('seg_pg_id', pgId)
        .eq('seg_pm_id', pmId)
        .single();

      if (existing) {
        return {
          success: false,
          message: 'Cet équipementier existe déjà pour cette gamme',
        };
      }

      const { data, error } = await this.supabase
        .from('__seo_equip_gamme')
        .insert({ seg_pg_id: pgId, seg_pm_id: pmId, seg_content: content })
        .select('seg_id, seg_content, seg_pm_id')
        .single();

      if (error) {
        this.logger.error(`Error adding equipementier for gamme ${pgId}:`, error);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Equipementier added for gamme ${pgId}`);
      return { success: true, item: data };
    } catch (error) {
      this.logger.error(`Error in addEquipementier(${pgId}):`, error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  /**
   * Met à jour la description d'un équipementier
   */
  async updateEquipementier(
    segId: number,
    content: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await this.supabase
        .from('__seo_equip_gamme')
        .update({ seg_content: content })
        .eq('seg_id', segId);

      if (error) {
        this.logger.error(`Error updating equipementier ${segId}:`, error);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Equipementier ${segId} updated`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in updateEquipementier(${segId}):`, error);
      return { success: false, message: 'Erreur serveur' };
    }
  }

  /**
   * Supprime un équipementier d'une gamme
   */
  async deleteEquipementier(
    segId: number,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await this.supabase
        .from('__seo_equip_gamme')
        .delete()
        .eq('seg_id', segId);

      if (error) {
        this.logger.error(`Error deleting equipementier ${segId}:`, error);
        return { success: false, message: error.message };
      }

      this.logger.log(`✅ Equipementier ${segId} deleted`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in deleteEquipementier(${segId}):`, error);
      return { success: false, message: 'Erreur serveur' };
    }
  }
}

// =========================================================================
// PURCHASE GUIDE DATA INTERFACE
// =========================================================================

export interface PurchaseGuideData {
  id?: number;
  pgId?: string;
  step1: {
    title: string;
    content: string;
    highlight: string;
    bullets?: string[];
  };
  step2: {
    economique: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
    qualitePlus: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
      badge?: string;
    };
    premium: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
  };
  step3: {
    title: string;
    content: string;
    alerts: Array<{ type: 'danger' | 'warning' | 'info'; text: string }>;
    relatedGammes?: Array<{ pgId: number; pgName: string; pgAlias: string }>;
  };
  createdAt?: string;
  updatedAt?: string;
}
