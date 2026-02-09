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
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { CacheService } from '../../../cache/cache.service';
import {
  BusinessRuleException,
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';
import {
  GammeSeoThresholdsService,
  SmartActionThresholds,
  DEFAULT_THRESHOLDS,
} from './gamme-seo-thresholds.service';
import { GammeSeoAuditService } from './gamme-seo-audit.service';
import { GammeSeoBadgesService } from './gamme-seo-badges.service';
import { GammeSeoSectionKService } from './gamme-seo-section-k.service';
import { GammeDetailEnricherService } from './gamme-detail-enricher.service';
import { GammeVLevelService } from './gamme-vlevel.service';

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
  // 🏷️ Badges v2 (from gamme_aggregates)
  priority_score: number;
  execution_status: string;
  final_priority: string;
  catalog_status: string;
  vehicle_coverage: string;
  content_depth: string;
  content_words_total: number;
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

// Type pour véhicule enrichi (cross gamme car)
export interface EnrichedVehicle {
  cgc_id: string;
  type_id: string;
  type_name: string;
  marque_name: string;
  modele_name: string;
  engine?: string;
  fuel?: string;
  level?: string;
  year_from?: string;
  year_to?: string;
  power_ps?: string;
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
    private readonly badgesService: GammeSeoBadgesService,
    private readonly sectionKService: GammeSeoSectionKService,
    private readonly detailEnricherService: GammeDetailEnricherService,
    private readonly vLevelService: GammeVLevelService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
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

      const pgIds = [...new Set(liaisons.map((l) => Number(l.mc_pg_id)))];
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
      const familyIds = [...new Set(liaisons.map((l) => l.mc_mf_id))];
      const { data: families, error: familiesError } = await this.supabase
        .from('catalog_family')
        .select('mf_id, mf_name')
        .in('mf_id', familyIds);

      if (familiesError) {
        this.logger.error('Error fetching catalog_family:', familiesError);
        throw familiesError;
      }

      // 5. Get aggregates with badges v2 from gamme_aggregates
      const { data: aggregates, error: aggregatesError } = await this.supabase
        .from('gamme_aggregates')
        .select(
          'ga_pg_id, priority_score, execution_status, final_priority, catalog_status, vehicle_coverage, content_depth, content_words_total',
        )
        .in('ga_pg_id', pgIds);

      if (aggregatesError) {
        this.logger.warn(
          'Warning fetching gamme_aggregates (non-blocking):',
          aggregatesError,
        );
        // Non-blocking: continue without aggregates
      }

      // Build lookup maps
      const seoMetricsMap = new Map(seoMetrics?.map((m) => [m.pg_id, m]) || []);
      const familiesMap = new Map(
        families?.map((f) => [f.mf_id, f.mf_name]) || [],
      );
      const pgToFamilyMap = new Map(
        liaisons.map((l) => [Number(l.mc_pg_id), l.mc_mf_id]),
      );
      const aggregatesMap = new Map(
        aggregates?.map((a) => [a.ga_pg_id, a]) || [],
      );

      // 6. Merge data (incluant Agent 2 et badges v2)
      let result: GammeSeoItem[] = (gammes || []).map((g) => {
        const seo: any = seoMetricsMap.get(g.pg_id) || {};
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
          // 🏷️ Badges v2 (from gamme_aggregates)
          priority_score: aggregatesMap.get(g.pg_id)?.priority_score || 0,
          execution_status:
            aggregatesMap.get(g.pg_id)?.execution_status || 'FAIL',
          final_priority: aggregatesMap.get(g.pg_id)?.final_priority || 'P3',
          catalog_status: aggregatesMap.get(g.pg_id)?.catalog_status || 'EMPTY',
          vehicle_coverage:
            aggregatesMap.get(g.pg_id)?.vehicle_coverage || 'EMPTY',
          content_depth: aggregatesMap.get(g.pg_id)?.content_depth || 'THIN',
          content_words_total:
            aggregatesMap.get(g.pg_id)?.content_words_total || 0,
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
          let aVal: unknown = a[sortBy as keyof GammeSeoItem];
          let bVal: unknown = b[sortBy as keyof GammeSeoItem];

          // Handle null/undefined
          if (aVal === null || aVal === undefined) aVal = '';
          if (bVal === null || bVal === undefined) bVal = '';

          // String comparison for strings
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortOrder === 'asc'
              ? aVal.localeCompare(bVal)
              : bVal.localeCompare(aVal);
          }

          // Numeric comparison
          const numA = Number(aVal);
          const numB = Number(bVal);
          return sortOrder === 'asc' ? numA - numB : numB - numA;
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
            throw new BusinessRuleException({
              code: ErrorCodes.CATALOG.GAMME_NOT_FOUND,
              message:
                `❌ Impossible de passer "${currentGamme.pg_name}" en NOINDEX.\n` +
                `Raison: C'est une gamme G1 (prioritaire) avec ${productCount} produits en stock.\n` +
                `Pour NOINDEX un G1, le stock doit être à 0.`,
            });
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
      const piecesUpdate: Record<string, string | undefined> = {};
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
      const seoUpdate: Record<string, string | null | undefined> = {
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

      const familyIds = [...new Set(liaisons?.map((l) => l.mc_mf_id) || [])];

      const { data: families, error } = await this.supabase
        .from('catalog_family')
        .select('mf_id, mf_name')
        .in('mf_id', familyIds)
        .order('mf_name', { ascending: true });

      if (error) throw error;

      return (families || []).map((f) => ({
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
        throw new DomainValidationException({
          code: ErrorCodes.ADMIN.UNKNOWN_ACTION,
          message: `Action inconnue: ${actionId}`,
        });
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
   * Delegated to GammeDetailEnricherService
   */
  async getGammeDetail(pgId: number): Promise<{
    gamme: Record<string, unknown>;
    seo: Record<string, unknown>;
    conseils: Record<string, unknown>[];
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
    articles: Record<string, unknown>[];
    vehicles: {
      level1: EnrichedVehicle[];
      level2: EnrichedVehicle[];
      level5: EnrichedVehicle[];
    };
    vLevel: {
      v1: Record<string, unknown>[];
      v2: Record<string, unknown>[];
      v3: Record<string, unknown>[];
      v4: Record<string, unknown>[];
      v5: Record<string, unknown>[];
    };
    stats: Record<string, unknown>;
  }> {
    return this.detailEnricherService.getGammeDetail(pgId);
  }

  /**
   * 🔄 Recalcule les V-Level pour une gamme
   * Delegated to GammeVLevelService
   */
  async recalculateVLevel(pgId: number): Promise<{
    success: boolean;
    message: string;
    updatedCount: number;
  }> {
    return this.vLevelService.recalculateVLevel(pgId);
  }

  /**
   * 🔍 Valide les règles V-Level:
   * Delegated to GammeVLevelService
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
    return this.vLevelService.validateV1Rules();
  }

  // ============== FACADE GETTERS ==============

  getBadgesService(): GammeSeoBadgesService {
    return this.badgesService;
  }

  getSectionKService(): GammeSeoSectionKService {
    return this.sectionKService;
  }
}

// Extracted to gamme-seo-badges.service.ts and gamme-seo-section-k.service.ts
// Methods moved: getVLevelGlobalStats, refreshAggregates, getGammeAggregates,
//   getSectionKMetrics, getSectionKMissingDetails, getSectionKExtrasDetails
// Extracted to gamme-detail-enricher.service.ts
// Methods delegated: getGammeDetail (fetch + enrich gamme data)
// Extracted to gamme-vlevel.service.ts
// Methods delegated: recalculateVLevel, validateV1Rules
