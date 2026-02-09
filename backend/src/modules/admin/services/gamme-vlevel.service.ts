/**
 * 🔄 GAMME V-LEVEL SERVICE
 *
 * Extracted from AdminGammesSeoService to reduce file size.
 * Handles V-Level management:
 * - recalculateVLevel: recalculates V-Level for a gamme
 * - validateV1Rules: validates V1 must be V2 in >= 30% of G1 gammes
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

// ============== RESULT TYPES ==============

export interface RecalculateVLevelResult {
  success: boolean;
  message: string;
  updatedCount: number;
}

export interface V1ValidationResult {
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
}

@Injectable()
export class GammeVLevelService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeVLevelService.name);

  constructor() {
    super();
  }

  async recalculateVLevel(pgId: number): Promise<RecalculateVLevelResult> {
    try {
      this.logger.log(`🔄 Recalculating V-Level for gamme ${pgId}`);

      // 1. Get keywords for this gamme from __seo_keywords
      const { data: keywords, error: kwError } = await this.supabase
        .from('__seo_keywords')
        .select('id, keyword, volume, pg_id, energy')
        .eq('pg_id', pgId);

      if (kwError) {
        this.logger.error(
          `❌ Error fetching keywords for gamme ${pgId}:`,
          kwError,
        );
        throw kwError;
      }

      if (!keywords || keywords.length === 0) {
        // No keywords found - mark all as V4
        const { data: metricsData } = await this.supabase
          .from('gamme_seo_metrics')
          .update({ v_level: 'V4', updated_at: new Date().toISOString() })
          .eq('gamme_id', pgId.toString())
          .select('id');

        return {
          success: true,
          message: `V-Level V4 (no keywords) for gamme ${pgId}`,
          updatedCount: metricsData?.length || 0,
        };
      }

      // 2. Group keywords by energy_type, sort by search_volume DESC
      const byEnergy = new Map<string, typeof keywords>();
      for (const kw of keywords) {
        const energy = kw.energy || 'all';
        if (!byEnergy.has(energy)) byEnergy.set(energy, []);
        byEnergy.get(energy)!.push(kw);
      }

      let totalUpdated = 0;

      for (const [_energy, energyKeywords] of byEnergy) {
        // Sort by search volume descending
        energyKeywords.sort((a, b) => (b.volume || 0) - (a.volume || 0));

        for (let i = 0; i < energyKeywords.length; i++) {
          const kw = energyKeywords[i];
          let vLevel: string;

          if ((kw.volume || 0) === 0) {
            vLevel = 'V4'; // No search volume
          } else if (i === 0) {
            vLevel = 'V2'; // Top keyword for this gamme+energy
          } else if (i <= 3) {
            vLevel = 'V3'; // Keywords #2-4
          } else {
            vLevel = 'V4'; // Remaining keywords
          }

          // Update keyword v_level
          const { error: updateError } = await this.supabase
            .from('__seo_keywords')
            .update({ v_level: vLevel, updated_at: new Date().toISOString() })
            .eq('id', kw.id);

          if (!updateError) totalUpdated++;
        }
      }

      // 3. Update gamme_seo_metrics with the best V-Level
      const bestVLevel = keywords.some((k) => (k.volume || 0) > 0)
        ? 'V2'
        : 'V4';
      await this.supabase
        .from('gamme_seo_metrics')
        .update({ v_level: bestVLevel, updated_at: new Date().toISOString() })
        .eq('gamme_id', pgId.toString());

      this.logger.log(
        `✅ V-Level recalculated for gamme ${pgId}: ${totalUpdated} keywords updated`,
      );

      return {
        success: true,
        message: `V-Level recalcule: ${totalUpdated} keywords mis a jour pour gamme ${pgId}`,
        updatedCount: totalUpdated,
      };
    } catch (error) {
      this.logger.error(`❌ Error in recalculateVLevel(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * 🔄 Recalcule les V-Level pour TOUTES les gammes
   * Batch processing pour classification globale
   */
  async recalculateAllVLevels(): Promise<RecalculateVLevelResult> {
    try {
      this.logger.log('🔄 Recalculating V-Levels for ALL gammes...');

      // Get all gammes that have keywords
      const { data: gammeIds, error } = await this.supabase
        .from('__seo_keywords')
        .select('pg_id')
        .not('pg_id', 'is', null);

      if (error) {
        this.logger.error('❌ Error fetching gamme IDs:', error);
        throw error;
      }

      // Deduplicate gamme IDs
      const uniqueGammeIds = [
        ...new Set((gammeIds || []).map((r) => r.pg_id)),
      ].filter(Boolean);
      this.logger.log(`📊 Found ${uniqueGammeIds.length} gammes with keywords`);

      let totalUpdated = 0;
      for (const pgId of uniqueGammeIds) {
        try {
          const result = await this.recalculateVLevel(pgId);
          totalUpdated += result.updatedCount;
        } catch (_err) {
          this.logger.warn(
            `⚠️ Failed to recalculate V-Level for gamme ${pgId}, skipping`,
          );
        }
      }

      this.logger.log(
        `✅ All V-Levels recalculated: ${totalUpdated} total keywords updated`,
      );

      return {
        success: true,
        message: `V-Level global: ${uniqueGammeIds.length} gammes, ${totalUpdated} keywords mis a jour`,
        updatedCount: totalUpdated,
      };
    } catch (error) {
      this.logger.error('❌ Error in recalculateAllVLevels():', error);
      throw error;
    }
  }

  /**
   * 📊 Get V-Level distribution stats
   */
  async getVLevelStats(): Promise<{
    v1: number;
    v2: number;
    v3: number;
    v4: number;
    total: number;
  }> {
    const { data, error } = await this.supabase
      .from('__seo_keywords')
      .select('v_level');

    if (error || !data) {
      return { v1: 0, v2: 0, v3: 0, v4: 0, total: 0 };
    }

    const stats = { v1: 0, v2: 0, v3: 0, v4: 0, total: data.length };
    for (const row of data) {
      const vl = (row.v_level || 'V4').toUpperCase();
      if (vl === 'V1') stats.v1++;
      else if (vl === 'V2') stats.v2++;
      else if (vl === 'V3') stats.v3++;
      else stats.v4++;
    }

    return stats;
  }

  /**
   * 🔍 Valide les regles V-Level:
   * - V1 doit etre V2 dans >= 30% des gammes G1
   * - Detecte les violations de cette regle
   */
  async validateV1Rules(): Promise<V1ValidationResult> {
    try {
      this.logger.log('🔍 Validating V1 rules (>= 30% G1 gammes)');

      // 1. Count G1 gammes (pg_top = '1')
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

      // 2. Fetch all V1
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

      // 3. For each unique V1 (model_name + energy), count how many G1 gammes have it as V2
      const violations: V1ValidationResult['violations'] = [];

      // Group V1 by model_name + energy (to avoid duplicates)
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

      // Check each unique V1
      for (const [, v1] of uniqueV1) {
        // Count how many times this variant is V2 in G1 gammes
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

        // If < 30%, it's a violation
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

      const result: V1ValidationResult = {
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
}
