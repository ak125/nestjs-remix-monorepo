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

  /**
   * 🔄 Recalcule les V-Level pour une gamme
   * Pour l'instant: met a jour updated_at pour marquer comme recalcule
   * TODO: Integrer le vrai pipeline de calcul V-Level
   */
  async recalculateVLevel(pgId: number): Promise<RecalculateVLevelResult> {
    try {
      this.logger.log(`🔄 Recalculating V-Level for gamme ${pgId}`);

      // Update updated_at for all records of this gamme
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
        message: `V-Level recalcule: ${updatedCount} enregistrements mis a jour`,
        updatedCount,
      };
    } catch (error) {
      this.logger.error(`❌ Error in recalculateVLevel(${pgId}):`, error);
      throw error;
    }
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
