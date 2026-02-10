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
   * V-Level v4.1 Algorithm (validated 2026-02-10)
   *
   * Phase T = trier KEYWORDS (CSV, texte + volume) — fait en amont
   * Phase V = classer VEHICULES (type_ids, apres match backfill)
   *
   * Only reclassifies keywords already in DB (type='vehicle').
   * Does NOT import from CSV or create V5 — use CLI script for that.
   *
   * V3 = type_id matche par backfill (match principal, 1er du groupe volume DESC)
   * V4 = type_id dans CSV, pas le match principal (reste du groupe)
   * V2 = top 10 V3 promus par score_seo (volume du keyword)
   */
  async recalculateVLevel(pgId: number): Promise<RecalculateVLevelResult> {
    try {
      this.logger.log(`🔄 Recalculating V-Level v4.1 for gamme ${pgId}`);

      // 1. Fetch all keywords for this gamme
      let allKeywords: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: kwError } = await this.supabase
          .from('__seo_keywords')
          .select(
            'id, keyword, volume, pg_id, energy, model, type, v_level, score_seo',
          )
          .eq('pg_id', pgId)
          .range(offset, offset + batchSize - 1);

        if (kwError) {
          this.logger.error(
            `❌ Error fetching keywords for gamme ${pgId}:`,
            kwError,
          );
          throw kwError;
        }

        if (batch && batch.length > 0) {
          allKeywords = allKeywords.concat(batch);
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      if (allKeywords.length === 0) {
        return {
          success: true,
          message: `No keywords for gamme ${pgId}`,
          updatedCount: 0,
        };
      }

      // 2. Separate vehicle vs non-vehicle keywords
      const vehicleKws = allKeywords.filter((kw) => kw.type === 'vehicle');
      const nonVehicleKws = allKeywords.filter((kw) => kw.type !== 'vehicle');

      // Skip V5 keywords (created from DB, not from CSV — don't reclassify them)
      const csvVehicleKws = vehicleKws.filter((kw) => kw.v_level !== 'V5');
      const v5Kws = vehicleKws.filter((kw) => kw.v_level === 'V5');

      // 3. Group CSV vehicle keywords by model+energy
      const byModelEnergy = new Map<string, any[]>();
      for (const kw of csvVehicleKws) {
        const key = `${kw.model || '_no_model'}|${kw.energy || 'unknown'}`;
        if (!byModelEnergy.has(key)) byModelEnergy.set(key, []);
        byModelEnergy.get(key)!.push(kw);
      }

      // 4. Elect V3 (match principal) and V4 (dans CSV, pas matche) per group
      const v3Champions: any[] = [];
      const updates: Array<{
        id: number;
        v_level: string;
        score_seo: number | null;
      }> = [];

      for (const [, group] of byModelEnergy) {
        // Sort: volume DESC, keyword length ASC (shorter = better match)
        group.sort((a: any, b: any) => {
          if ((b.volume || 0) !== (a.volume || 0))
            return (b.volume || 0) - (a.volume || 0);
          return (a.keyword || '').length - (b.keyword || '').length;
        });

        let v3Assigned = false;

        for (const kw of group) {
          if (!v3Assigned && (kw.volume || 0) > 0) {
            // V3: match principal (type_id matche par backfill)
            updates.push({
              id: kw.id,
              v_level: 'V3',
              score_seo: kw.volume || 0,
            });
            v3Champions.push({ ...kw, score_seo: kw.volume || 0 });
            v3Assigned = true;
          } else {
            // V4: dans le CSV, pas le match principal
            updates.push({ id: kw.id, v_level: 'V4', score_seo: null });
          }
        }
      }

      // 5. Promote top 10 V3 → V2 (dedup by model)
      v3Champions.sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));
      const seenModels = new Set<string>();
      const top10: any[] = [];
      for (const kw of v3Champions) {
        const model = (kw.model || '').toLowerCase();
        if (seenModels.has(model)) continue;
        seenModels.add(model);
        top10.push(kw);
        if (top10.length >= 10) break;
      }
      const top10Ids = new Set(top10.map((c) => c.id));

      for (const update of updates) {
        if (top10Ids.has(update.id)) {
          update.v_level = 'V2';
        }
      }

      // 6. Non-vehicle keywords: set v_level = null, score_seo = null
      for (const kw of nonVehicleKws) {
        updates.push({ id: kw.id, v_level: null as any, score_seo: null });
      }

      // 7. Write updates to DB in batches
      let totalUpdated = 0;
      for (const update of updates) {
        const { error: updateError } = await this.supabase
          .from('__seo_keywords')
          .update({
            v_level: update.v_level,
            score_seo: update.score_seo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);

        if (!updateError) totalUpdated++;
      }

      const v2Count = updates.filter((u) => u.v_level === 'V2').length;
      const v3Count = updates.filter((u) => u.v_level === 'V3').length;
      const v4Count = updates.filter((u) => u.v_level === 'V4').length;

      this.logger.log(
        `✅ V-Level v4.1 recalculated for gamme ${pgId}: V2=${v2Count}, V3=${v3Count}, V4=${v4Count}, V5=${v5Kws.length} (preserved)`,
      );

      return {
        success: true,
        message: `V-Level v4.1: V2=${v2Count}, V3=${v3Count}, V4=${v4Count}, V5=${v5Kws.length} (${totalUpdated} updated)`,
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
    v5: number;
    v6: number;
    unclassified: number;
    total: number;
  }> {
    const { data, error } = await this.supabase
      .from('__seo_keywords')
      .select('v_level');

    if (error || !data) {
      return {
        v1: 0,
        v2: 0,
        v3: 0,
        v4: 0,
        v5: 0,
        v6: 0,
        unclassified: 0,
        total: 0,
      };
    }

    const stats = {
      v1: 0,
      v2: 0,
      v3: 0,
      v4: 0,
      v5: 0,
      v6: 0,
      unclassified: 0,
      total: data.length,
    };
    for (const row of data) {
      const vl = (row.v_level || '').toUpperCase();
      if (vl === 'V1') stats.v1++;
      else if (vl === 'V2') stats.v2++;
      else if (vl === 'V3') stats.v3++;
      else if (vl === 'V4') stats.v4++;
      else if (vl === 'V5') stats.v5++;
      else if (vl === 'V6') stats.v6++;
      else stats.unclassified++;
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
