/**
 * 🎯 ADMIN GAMMES SEO SERVICE
 *
 * Service pour la gestion des gammes et leur classification SEO (G-Level)
 * - Liste des 230 gammes avec données Trends
 * - KPIs: INDEX vs NOINDEX, G1/G2/G3
 * - Actions: Promouvoir INDEX, Promouvoir G1, etc.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

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

export interface GammeSeoItem {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_level: string;
  pg_top: string;
  pg_relfollow: string;
  pg_sitemap: string;
  pg_display: string;
  // From gamme_seo_metrics
  trends_index: number;
  g_level_recommended: string;
  action_recommended: string | null;
  user_notes: string | null;
  user_action: string | null;
  trends_updated_at: string | null;
  // From catalog_family
  family_name: string | null;
  family_id: number | null;
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

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * 📋 Liste des gammes avec données SEO
   */
  async getGammesList(
    filters: GammeSeoFilters = {},
    pagination: GammeSeoPagination = { page: 1, limit: 50 },
  ): Promise<{ data: GammeSeoItem[]; total: number; page: number; totalPages: number }> {
    try {
      this.logger.log('📋 Fetching gammes SEO list...');

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
        .select('pg_id, pg_name, pg_alias, pg_level, pg_top, pg_relfollow, pg_sitemap, pg_display')
        .in('pg_id', pgIds);

      if (gammesError) {
        this.logger.error('Error fetching pieces_gamme:', gammesError);
        throw gammesError;
      }

      // 3. Get SEO metrics from gamme_seo_metrics
      const { data: seoMetrics, error: seoError } = await this.supabase
        .from('gamme_seo_metrics')
        .select('pg_id, trends_index, g_level_recommended, action_recommended, user_notes, user_action, trends_updated_at')
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
      const seoMetricsMap = new Map(seoMetrics?.map((m: any) => [m.pg_id, m]) || []);
      const familiesMap = new Map(families?.map((f: any) => [f.mf_id, f.mf_name]) || []);
      const pgToFamilyMap = new Map(liaisons.map((l: any) => [Number(l.mc_pg_id), l.mc_mf_id]));

      // 5. Merge data
      let result: GammeSeoItem[] = (gammes || []).map((g: any) => {
        const seo = seoMetricsMap.get(g.pg_id) || {};
        const familyId = pgToFamilyMap.get(g.pg_id);
        const familyName = familyId ? familiesMap.get(familyId) : null;

        // Calculate ACTUAL G-Level based on database values
        let actualGLevel: string;
        if (g.pg_top === '1') {
          actualGLevel = 'G1';  // Prioritaire
        } else if (g.pg_level === '1') {
          actualGLevel = 'G2';  // INDEX mais non G1
        } else {
          actualGLevel = 'G3';  // NOINDEX
        }

        // Calculate recommended G-Level based on trends
        const trendsIndex = seo.trends_index || 0;
        let recommendedGLevel: string;
        if (trendsIndex >= 50) {
          recommendedGLevel = 'G1';
        } else if (trendsIndex >= 20) {
          recommendedGLevel = 'G2';
        } else {
          recommendedGLevel = 'G3';
        }

        // Calculate action based on comparison
        let actionRecommended: string | null = null;
        const isNoindex = g.pg_level !== '1';
        const isG1 = g.pg_top === '1';

        if (isNoindex && trendsIndex >= 30) {
          actionRecommended = 'PROMOUVOIR_INDEX';
        } else if (!isG1 && trendsIndex >= 50) {
          actionRecommended = 'PROMOUVOIR_G1';
        } else if (isG1 && trendsIndex < 5) {
          actionRecommended = 'VERIFIER_G1';
        }

        return {
          pg_id: g.pg_id,
          pg_name: g.pg_name,
          pg_alias: g.pg_alias,
          pg_level: g.pg_level,
          pg_top: g.pg_top,
          pg_relfollow: g.pg_relfollow,
          pg_sitemap: g.pg_sitemap,
          pg_display: g.pg_display,
          trends_index: trendsIndex,
          g_level_recommended: actualGLevel,  // Use ACTUAL G-Level, not from seo table
          action_recommended: actionRecommended,
          user_notes: seo.user_notes || null,
          user_action: seo.user_action || null,
          trends_updated_at: seo.trends_updated_at || null,
          family_name: familyName,
          family_id: familyId,
        };
      });

      // 6. Apply filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(g =>
          g.pg_name.toLowerCase().includes(searchLower) ||
          (g.pg_alias && g.pg_alias.toLowerCase().includes(searchLower))
        );
      }

      if (filters.familyId) {
        result = result.filter(g => g.family_id === filters.familyId);
      }

      if (filters.gLevel) {
        result = result.filter(g => g.g_level_recommended === filters.gLevel);
      }

      if (filters.status) {
        if (filters.status === 'INDEX') {
          result = result.filter(g => g.pg_level === '1');
        } else {
          result = result.filter(g => g.pg_level !== '1');
        }
      }

      if (filters.actionRecommended) {
        result = result.filter(g => g.action_recommended === filters.actionRecommended);
      }

      if (filters.minTrends !== undefined) {
        result = result.filter(g => g.trends_index >= filters.minTrends!);
      }

      if (filters.maxTrends !== undefined) {
        result = result.filter(g => g.trends_index <= filters.maxTrends!);
      }

      // 7. Apply sorting
      const sortBy = pagination.sortBy || 'trends_index';
      const sortOrder = pagination.sortOrder || 'desc';

      // Special case: family_name with official catalog hierarchy
      if (sortBy === 'family_name') {
        // Helper function to get family hierarchy index
        const getFamilyHierarchyIndex = (familyName: string | null): number => {
          if (!familyName) return FAMILY_HIERARCHY_ORDER.length; // Sans famille at the end
          const index = FAMILY_HIERARCHY_ORDER.findIndex(
            f => f.toLowerCase() === familyName.toLowerCase()
          );
          return index === -1 ? FAMILY_HIERARCHY_ORDER.length : index;
        };

        // Sort by: 1) Official catalog hierarchy, 2) Within family by trends desc
        result.sort((a, b) => {
          const familyA = a.family_name;
          const familyB = b.family_name;

          // Different families: sort by official hierarchy order
          if (familyA !== familyB) {
            const indexA = getFamilyHierarchyIndex(familyA);
            const indexB = getFamilyHierarchyIndex(familyB);
            return sortOrder === 'asc' ? indexA - indexB : indexA - indexB; // Always asc for hierarchy
          }

          // Same family: sort by trends within the family (always desc)
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

      this.logger.log(`✅ Returning ${paginatedData.length} gammes (page ${pagination.page}/${totalPages})`);

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

      const stats: GammeSeoStats = {
        total: data.length,
        indexed: data.filter(g => g.pg_level === '1').length,
        noindexed: data.filter(g => g.pg_level !== '1').length,
        g1Count: data.filter(g => g.pg_top === '1').length,
        g2Count: data.filter(g => g.pg_level === '1' && g.pg_top !== '1').length,
        g3Count: data.filter(g => g.pg_level !== '1').length,
        toPromoteIndex: data.filter(g => g.action_recommended === 'PROMOUVOIR_INDEX').length,
        toPromoteG1: data.filter(g => g.action_recommended === 'PROMOUVOIR_G1').length,
        toVerifyG1: data.filter(g => g.action_recommended === 'VERIFIER_G1').length,
        inSitemap: data.filter(g => g.pg_sitemap === '1').length,
        avgTrends: data.length > 0
          ? Math.round(data.reduce((sum, g) => sum + g.trends_index, 0) / data.length)
          : 0,
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
  async updateGamme(pgId: number, updateData: GammeSeoUpdateData): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`🔧 Updating gamme pg_id=${pgId}...`);

      // Split updates: pieces_gamme vs gamme_seo_metrics
      const piecesGammeFields: (keyof GammeSeoUpdateData)[] = ['pg_level', 'pg_top', 'pg_relfollow', 'pg_sitemap'];
      const seoMetricsFields: (keyof GammeSeoUpdateData)[] = ['user_notes', 'user_action'];

      // Update pieces_gamme if needed
      const piecesUpdate: Record<string, any> = {};
      piecesGammeFields.forEach(field => {
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
      const seoUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      seoMetricsFields.forEach(field => {
        if (updateData[field] !== undefined) {
          seoUpdate[field] = updateData[field];
        }
      });

      // Recalculate g_level_recommended based on new pg_level and pg_top
      if (updateData.pg_level !== undefined || updateData.pg_top !== undefined) {
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
  async batchUpdate(pgIds: number[], updateData: GammeSeoUpdateData): Promise<{ success: boolean; message: string; updated: number }> {
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

      this.logger.log(`✅ Batch update completed: ${updated}/${pgIds.length} gammes`);
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

      const { data } = await this.getGammesList({}, { page: 1, limit: 1000, sortBy: 'trends_index', sortOrder: 'desc' });

      // CSV header
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
        'action_recommandee',
        'notes',
        'user_action',
      ];

      // CSV rows
      const rows = data.map(g => [
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
        g.action_recommended || '',
        g.user_notes ? `"${g.user_notes.replace(/"/g, '""')}"` : '',
        g.user_action || '',
      ]);

      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

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

      const familyIds = [...new Set(liaisons?.map((l: any) => l.mc_mf_id) || [])];

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
   * 🚀 Appliquer une action prédéfinie
   */
  async applyPredefinedAction(pgIds: number[], actionId: string): Promise<{ success: boolean; message: string; updated: number }> {
    let updateData: GammeSeoUpdateData;

    switch (actionId) {
      case 'PROMOTE_INDEX':
        updateData = {
          pg_level: '1',
          pg_relfollow: '1',
          pg_sitemap: '1',
        };
        break;
      case 'DEMOTE_NOINDEX':
        updateData = {
          pg_level: '2',
          pg_relfollow: '0',
          pg_sitemap: '0',
        };
        break;
      case 'MARK_G1':
        updateData = {
          pg_top: '1',
        };
        break;
      case 'UNMARK_G1':
        updateData = {
          pg_top: '0',
        };
        break;
      default:
        throw new Error(`Action inconnue: ${actionId}`);
    }

    return this.batchUpdate(pgIds, updateData);
  }
}
