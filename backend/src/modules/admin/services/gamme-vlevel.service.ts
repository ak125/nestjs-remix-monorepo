/**
 * GAMME V-LEVEL SERVICE v5.0
 *
 * Recalculates V-Level classification for a gamme.
 * Rules: see .spec/features/g-v-classification.md
 *
 * V3 = champion per [model+energy] group (highest volume, or first if all zero)
 * V4 = rest of CSV keywords in same group
 * V2 = top 10 V3 promoted by volume (dedup by [model+energy])
 * V5 = sibling vehicles from DB (same modele_parent generation)
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface RecalculateVLevelResult {
  success: boolean;
  message: string;
  updatedCount: number;
}

@Injectable()
export class GammeVLevelService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeVLevelService.name);

  constructor() {
    super();
  }

  /**
   * V-Level v5.0 Algorithm
   *
   * Reclassifies all keywords for a gamme:
   * 1. Group CSV vehicle keywords by [model + energy] (or [model] if gamme_universelle)
   * 2. Elect V3 champion per group (highest volume, first if tie)
   * 3. V4 = rest of group
   * 4. V2 = top 10 V3, dedup by [model + energy]
   * Note: V5 is computed dynamically by getV5Siblings() — not persisted
   */
  async recalculateVLevel(
    pgId: number,
    gammeUniverselle = false,
  ): Promise<RecalculateVLevelResult> {
    try {
      this.logger.log(`Recalculating V-Level v5.0 for gamme ${pgId}`);

      // 1. Fetch all keywords for this gamme
      let allKeywords: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: kwError } = await this.supabase
          .from('__seo_keywords')
          .select(
            'id, keyword, volume, pg_id, energy, model, type, v_level, score_seo, type_id',
          )
          .eq('pg_id', pgId)
          .range(offset, offset + batchSize - 1);

        if (kwError) {
          this.logger.error(
            `Error fetching keywords for gamme ${pgId}:`,
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

      // 1b. Enrich energy from auto_type.type_fuel for items with unknown energy
      const unknownEnergyKws = allKeywords.filter(
        (kw) => kw.type_id && (!kw.energy || kw.energy === 'unknown'),
      );
      if (unknownEnergyKws.length > 0) {
        const typeIds = [...new Set(unknownEnergyKws.map((kw) => kw.type_id))];
        const fuelMap = new Map<number, string>();
        for (let i = 0; i < typeIds.length; i += 100) {
          const batch = typeIds.slice(i, i + 100);
          const { data: types } = await this.supabase
            .from('auto_type')
            .select('type_id, type_fuel')
            .in('type_id', batch.map(String));
          if (types) {
            for (const t of types) {
              if (t.type_fuel) fuelMap.set(Number(t.type_id), t.type_fuel);
            }
          }
        }
        const energyUpdates: Array<{ id: number; energy: string }> = [];
        for (const kw of unknownEnergyKws) {
          const fuel = fuelMap.get(Number(kw.type_id));
          if (fuel) {
            const detectedEnergy = this.detectEnergy(fuel);
            if (detectedEnergy !== 'unknown') {
              kw.energy = detectedEnergy;
              energyUpdates.push({ id: kw.id, energy: detectedEnergy });
            }
          }
        }
        // Persist energy enrichment to DB
        for (const update of energyUpdates) {
          await this.supabase
            .from('__seo_keywords')
            .update({ energy: update.energy })
            .eq('id', update.id);
        }
        this.logger.log(
          `Energy enriched: ${energyUpdates.length}/${unknownEnergyKws.length} keywords updated from type_fuel`,
        );
      }

      // 2. Separate vehicle vs non-vehicle keywords
      const vehicleKws = allKeywords.filter((kw) => kw.type === 'vehicle');
      const nonVehicleKws = allKeywords.filter((kw) => kw.type !== 'vehicle');

      // 3. V-levels = keywords with motorisation ONLY (never generic)
      // A keyword is "specific" if it mentions engine/fuel/hp patterns
      const MOTOR_PATTERN =
        /(\d+\.\d+|hdi|dci|tdi|cdi|tce|tsi|vti|puretech|tfsi|gti|vtec|mpi|d4d|jtd|cdti|crdi|dtec|\d+\s*ch|\d+\s*cv)/i;
      const motorKws = vehicleKws.filter((kw) =>
        MOTOR_PATTERN.test(kw.keyword || ''),
      );
      const genericVehicleKws = vehicleKws.filter(
        (kw) => !MOTOR_PATTERN.test(kw.keyword || ''),
      );

      // CSV motor keywords only (V5 is computed dynamically, not persisted)
      const csvVehicleKws = motorKws.filter((kw) => kw.v_level !== 'V5');

      // 4. Group CSV vehicle keywords by [model+energy] or [model] if universelle
      const byModelEnergy = new Map<string, any[]>();
      for (const kw of csvVehicleKws) {
        const key = gammeUniverselle
          ? `${kw.model || '_no_model'}`
          : `${kw.model || '_no_model'}|${kw.energy || 'unknown'}`;
        if (!byModelEnergy.has(key)) byModelEnergy.set(key, []);
        byModelEnergy.get(key)!.push(kw);
      }

      // 5. Elect V3 (champion) and V4 (rest) per group
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

        // First keyword = V3 (champion), even if volume=0
        const champion = group[0];
        updates.push({
          id: champion.id,
          v_level: 'V3',
          score_seo: champion.volume || 0,
        });
        v3Champions.push({ ...champion, score_seo: champion.volume || 0 });

        // Rest = V4
        for (let i = 1; i < group.length; i++) {
          updates.push({
            id: group[i].id,
            v_level: 'V4',
            score_seo: group[i].volume || 0,
          });
        }
      }

      // 6. Promote top 10 V3 -> V2 (dedup by [model + energy])
      v3Champions.sort((a, b) => (b.score_seo || 0) - (a.score_seo || 0));
      const seenModelEnergy = new Set<string>();
      const top10: any[] = [];
      for (const kw of v3Champions) {
        const modelEnergy = `${(kw.model || '').toLowerCase()}|${(kw.energy || '').toLowerCase()}`;
        if (seenModelEnergy.has(modelEnergy)) continue;
        seenModelEnergy.add(modelEnergy);
        top10.push(kw);
        if (top10.length >= 10) break;
      }
      const top10Ids = new Set(top10.map((c) => c.id));

      for (const update of updates) {
        if (top10Ids.has(update.id)) {
          update.v_level = 'V2';
        }
      }

      // 7. Non-vehicle + generic vehicle keywords: clear v_level
      for (const kw of nonVehicleKws) {
        updates.push({ id: kw.id, v_level: null as any, score_seo: null });
      }
      for (const kw of genericVehicleKws) {
        updates.push({ id: kw.id, v_level: null as any, score_seo: null });
      }

      // 8. Write V2/V3/V4 updates to DB
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
        `V-Level v5.0 recalculated for gamme ${pgId}: V2=${v2Count}, V3=${v3Count}, V4=${v4Count} (V5 computed dynamically)`,
      );

      return {
        success: true,
        message: `V-Level v5.0: V2=${v2Count}, V3=${v3Count}, V4=${v4Count} (${totalUpdated} updated, V5 dynamique)`,
        updatedCount: totalUpdated,
      };
    } catch (error) {
      this.logger.error(`Error in recalculateVLevel(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * Compute V5 children on the fly (no DB persist).
   * V5 = other motorisations of the SAME model + child models, not in V2/V3/V4.
   * Example: 207 has V3/V4 → V5 = other 207 types + all 207 CC/SW/PASSION types.
   * Returns V5 items in the same format as VLevelItem for frontend display.
   */
  async getV5Siblings(pgId: number): Promise<any[]> {
    try {
      // Get all type_ids from V2/V3/V4 keywords for this gamme
      let allTypeIds: number[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await this.supabase
          .from('__seo_keywords')
          .select('type_id')
          .eq('pg_id', pgId)
          .in('v_level', ['V2', 'V3', 'V4'])
          .not('type_id', 'is', null)
          .range(offset, offset + 999);
        if (data && data.length > 0) {
          allTypeIds = allTypeIds.concat(data.map((r) => r.type_id));
          offset += 1000;
          hasMore = data.length === 1000;
        } else {
          hasMore = false;
        }
      }

      const csvTypeIds = new Set(allTypeIds);
      if (csvTypeIds.size === 0) return [];

      // Get modele_ids for CSV type_ids
      const typeIdArray = [...csvTypeIds];
      const modeleIds = new Set<number>();

      for (let i = 0; i < typeIdArray.length; i += 100) {
        const batch = typeIdArray.slice(i, i + 100);
        const { data: types } = await this.supabase
          .from('auto_type')
          .select('type_id, type_modele_id')
          .in('type_id', batch);

        if (types) {
          for (const t of types) {
            if (t.type_modele_id) modeleIds.add(Number(t.type_modele_id));
          }
        }
      }

      if (modeleIds.size === 0) return [];

      // V5 = same model + child models, not in V2/V3/V4
      // Step 1: Find child models (e.g., 207 → 207 CC, 207 SW, 207 PASSION)
      const baseModeleIdArray = [...modeleIds];
      const allModeleIds = new Set(modeleIds);

      for (let i = 0; i < baseModeleIdArray.length; i += 100) {
        const batch = baseModeleIdArray.slice(i, i + 100);
        const { data: children } = await this.supabase
          .from('auto_modele')
          .select('modele_id')
          .in('modele_parent', batch);
        if (children) {
          for (const c of children) {
            allModeleIds.add(c.modele_id);
          }
        }
      }

      const modeleIdArray = [...allModeleIds];

      // Get model names for display
      const modeleNameMap = new Map<number, string>();
      for (let i = 0; i < modeleIdArray.length; i += 100) {
        const batch = modeleIdArray.slice(i, i + 100);
        const { data: models } = await this.supabase
          .from('auto_modele')
          .select('modele_id, modele_name')
          .in('modele_id', batch);
        if (models) {
          for (const m of models) {
            modeleNameMap.set(m.modele_id, m.modele_name);
          }
        }
      }

      // Get ALL displayable types for V2/V3/V4 models + their children
      let allModelTypes: any[] = [];
      for (let i = 0; i < modeleIdArray.length; i += 100) {
        const batch = modeleIdArray.slice(i, i + 100);
        const { data: types } = await this.supabase
          .from('auto_type')
          .select('type_id, type_name, type_fuel, type_engine, type_modele_id')
          .in('type_modele_id', batch)
          .eq('type_display', '1');

        if (types) allModelTypes = allModelTypes.concat(types);
      }

      // Exclude types already in V2/V3/V4
      const newTypes = allModelTypes.filter(
        (t) => !csvTypeIds.has(Number(t.type_id)),
      );

      if (newTypes.length === 0) return [];

      // Get gamme name
      const { data: gammeData } = await this.supabase
        .from('pieces_gamme')
        .select('pg_name')
        .eq('pg_id', pgId)
        .single();

      const gammeName = gammeData?.pg_name || `gamme_${pgId}`;

      // Return V5 items (same format as VLevelItem for frontend)
      return newTypes.map((t) => {
        const modelName = modeleNameMap.get(Number(t.type_modele_id)) || '';
        return {
          id: Number(t.type_id),
          gamme_name: gammeName,
          model_name: modelName.toLowerCase(),
          brand: '',
          variant_name: `${gammeName} ${modelName} ${t.type_name}`
            .toLowerCase()
            .trim(),
          energy: this.detectEnergy(t.type_fuel || ''),
          v_level: 'V5',
          rank: 0,
          search_volume: 0,
          updated_at: new Date().toISOString(),
          type_id: Number(t.type_id),
        };
      });
    } catch (error) {
      this.logger.warn(`Error computing V5 for gamme ${pgId}:`, error);
      return [];
    }
  }

  /**
   * Detect energy type from fuel string.
   * v5.0: diesel, essence, hybride, electrique, gpl
   */
  detectEnergy(fuel: string): string {
    const f = fuel.toLowerCase();
    if (
      f.includes('diesel') ||
      f.includes('dci') ||
      f.includes('hdi') ||
      f.includes('tdi') ||
      f.includes('cdi') ||
      f.includes('d4d') ||
      f.includes('jtd') ||
      f.includes('cdti') ||
      f.includes('crdi') ||
      f.includes('dtec')
    )
      return 'diesel';
    if (
      f.includes('hybrid') ||
      f.includes('phev') ||
      f.includes('e-hybrid') ||
      f.includes('plug-in') ||
      f.includes('hybride')
    )
      return 'hybride';
    if (
      f.includes('electrique') ||
      f.includes('electric') ||
      f.includes('ev') ||
      f.includes('e-208') ||
      f.includes('e-c4')
    )
      return 'electrique';
    if (f.includes('gpl') || f.includes('lpg') || f.includes('bifuel'))
      return 'gpl';
    // Default to essence for gasoline patterns
    if (
      f.includes('essence') ||
      f.includes('tce') ||
      f.includes('vti') ||
      f.includes('puretech') ||
      f.includes('tfsi') ||
      f.includes('tsi') ||
      f.includes('gti') ||
      f.includes('vtec') ||
      f.includes('mpi')
    )
      return 'essence';
    return 'unknown';
  }

  /**
   * Recalculate V-Levels for ALL gammes
   */
  async recalculateAllVLevels(): Promise<RecalculateVLevelResult> {
    try {
      this.logger.log('Recalculating V-Levels v5.0 for ALL gammes...');

      // Get all gammes that have keywords
      const { data: gammeIds, error } = await this.supabase
        .from('__seo_keywords')
        .select('pg_id')
        .not('pg_id', 'is', null);

      if (error) {
        this.logger.error('Error fetching gamme IDs:', error);
        throw error;
      }

      const uniqueGammeIds = [
        ...new Set((gammeIds || []).map((r) => r.pg_id)),
      ].filter(Boolean);
      this.logger.log(`Found ${uniqueGammeIds.length} gammes with keywords`);

      // Fetch gamme_universelle flags
      const { data: gammes } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, gamme_universelle')
        .in('pg_id', uniqueGammeIds);

      const universalMap = new Map<number, boolean>();
      if (gammes) {
        for (const g of gammes) {
          universalMap.set(g.pg_id, g.gamme_universelle === true);
        }
      }

      let totalUpdated = 0;
      for (const pgId of uniqueGammeIds) {
        try {
          const isUniversal = universalMap.get(pgId) || false;
          const result = await this.recalculateVLevel(pgId, isUniversal);
          totalUpdated += result.updatedCount;
        } catch (_err) {
          this.logger.warn(
            `Failed to recalculate V-Level for gamme ${pgId}, skipping`,
          );
        }
      }

      this.logger.log(
        `All V-Levels recalculated: ${totalUpdated} total keywords updated`,
      );

      return {
        success: true,
        message: `V-Level v5.0 global: ${uniqueGammeIds.length} gammes, ${totalUpdated} keywords mis a jour`,
        updatedCount: totalUpdated,
      };
    } catch (error) {
      this.logger.error('Error in recalculateAllVLevels():', error);
      throw error;
    }
  }

  /**
   * Get V-Level distribution stats
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
}
