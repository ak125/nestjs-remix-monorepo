/**
 * V1 DOMINANT SERVICE
 *
 * Gestion des variantes V1 (dominantes inter-gammes)
 * V1 = variante qui est V2 dans ≥30% des gammes G1
 *
 * Table: vehicule_v1_dominant
 * - model_slug: slug du modèle (ex: "clio-3")
 * - energy: diesel | essence | unknown
 * - variant: variante moteur (ex: "1.5 dCi 90")
 * - score: nombre de gammes où cette variante est V2
 * - total_volume: somme des volumes
 * - pg_ids: array des pg_id où V2
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface V1DominantEntry {
  model_slug: string;
  energy: 'diesel' | 'essence' | 'unknown';
  variant: string | null;
  score: number;
  total_volume: number;
  pg_ids: number[];
}

export interface V1RecomputeResult {
  updated: number;
  inserted: number;
  deleted: number;
  dominants: V1DominantEntry[];
}

@Injectable()
export class V1DominantService extends SupabaseBaseService {
  protected readonly logger = new Logger(V1DominantService.name);

  /**
   * Recalcule les V1 dominants à partir des V2 actuels
   *
   * Algorithme:
   * 1. Agréger V2 par (model, variant, energy)
   * 2. Score = COUNT(DISTINCT pg_id)
   * 3. total_volume = SUM(volume)
   * 4. Upsert dans vehicule_v1_dominant
   */
  async recomputeV1Dominants(): Promise<V1RecomputeResult> {
    this.logger.log('🔄 Starting V1 dominant recomputation...');

    // 1. Récupérer tous les V2 avec leurs pg_id
    const { data: v2Data, error: v2Error } = await this.supabase
      .from('__seo_keywords')
      .select('model, variant, energy, volume, pg_id')
      .eq('v_level', 'V2')
      .eq('type', 'vehicle')
      .not('pg_id', 'is', null);

    if (v2Error) {
      this.logger.error(`Failed to fetch V2 data: ${v2Error.message}`);
      throw v2Error;
    }

    if (!v2Data || v2Data.length === 0) {
      this.logger.warn('No V2 data found');
      return { updated: 0, inserted: 0, deleted: 0, dominants: [] };
    }

    this.logger.log(`📊 Found ${v2Data.length} V2 entries to aggregate`);

    // 2. Agréger par (model, variant, energy)
    const aggregates = new Map<
      string,
      {
        model: string;
        variant: string | null;
        energy: string;
        pgIds: Set<number>;
        totalVolume: number;
      }
    >();

    for (const row of v2Data) {
      const key = `${row.model}|${row.variant || ''}|${row.energy || 'unknown'}`;

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          model: row.model,
          variant: row.variant,
          energy: row.energy || 'unknown',
          pgIds: new Set(),
          totalVolume: 0,
        });
      }

      const agg = aggregates.get(key)!;
      if (row.pg_id) {
        agg.pgIds.add(row.pg_id);
      }
      agg.totalVolume += row.volume || 0;
    }

    // 3. Convertir en entrées V1
    const dominants: V1DominantEntry[] = [];

    for (const [, agg] of aggregates) {
      // Score = nombre de gammes distinctes
      const score = agg.pgIds.size;

      // Seulement les variantes avec score ≥ 1 (au moins 1 gamme)
      // Note: V1 réel nécessite ≥30% des gammes G1, mais on persiste tout pour analyse
      if (score >= 1) {
        dominants.push({
          model_slug: this.slugify(agg.model),
          energy: this.normalizeEnergy(agg.energy),
          variant: agg.variant,
          score,
          total_volume: agg.totalVolume,
          pg_ids: Array.from(agg.pgIds),
        });
      }
    }

    // Trier par score décroissant
    dominants.sort(
      (a, b) => b.score - a.score || b.total_volume - a.total_volume,
    );

    this.logger.log(`📊 Computed ${dominants.length} V1 candidates`);

    // 4. Récupérer les entrées existantes pour comptage
    const { count: existingCount } = await this.supabase
      .from('vehicule_v1_dominant')
      .select('*', { count: 'exact', head: true });

    // 5. Supprimer les anciennes entrées
    const { error: deleteError } = await this.supabase
      .from('vehicule_v1_dominant')
      .delete()
      .gte('id', 0); // Delete all

    if (deleteError) {
      this.logger.error(
        `Failed to delete old V1 entries: ${deleteError.message}`,
      );
      throw deleteError;
    }

    // 6. Insérer les nouvelles entrées
    if (dominants.length > 0) {
      const toInsert = dominants.map((d) => ({
        model_slug: d.model_slug,
        energy: d.energy,
        variant: d.variant,
        score: d.score,
        total_volume: d.total_volume,
        pg_ids: d.pg_ids,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await this.supabase
        .from('vehicule_v1_dominant')
        .insert(toInsert);

      if (insertError) {
        this.logger.error(
          `Failed to insert V1 entries: ${insertError.message}`,
        );
        throw insertError;
      }
    }

    const result: V1RecomputeResult = {
      updated: 0,
      inserted: dominants.length,
      deleted: existingCount || 0,
      dominants,
    };

    this.logger.log(
      `✅ V1 recomputation complete: ${result.inserted} inserted, ${result.deleted} deleted`,
    );

    return result;
  }

  /**
   * Récupère les V1 dominants actuels
   */
  async getV1Dominants(options?: {
    minScore?: number;
    energy?: 'diesel' | 'essence' | 'unknown';
    limit?: number;
  }): Promise<V1DominantEntry[]> {
    let query = this.supabase
      .from('vehicule_v1_dominant')
      .select('*')
      .order('score', { ascending: false });

    if (options?.minScore) {
      query = query.gte('score', options.minScore);
    }

    if (options?.energy) {
      query = query.eq('energy', options.energy);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch V1 dominants: ${error.message}`);
      throw error;
    }

    return (data || []).map((row) => ({
      model_slug: row.model_slug,
      energy: row.energy as 'diesel' | 'essence' | 'unknown',
      variant: row.variant,
      score: row.score,
      total_volume: row.total_volume,
      pg_ids: row.pg_ids || [],
    }));
  }

  /**
   * Vérifie si une variante est V1 (score ≥ seuil)
   * Par défaut seuil = 2 gammes (ajustable selon nombre de gammes G1)
   */
  async isV1Variant(
    model: string,
    variant: string | null,
    energy: string,
    threshold: number = 2,
  ): Promise<boolean> {
    const modelSlug = this.slugify(model);
    const normalizedEnergy = this.normalizeEnergy(energy);

    const { data, error } = await this.supabase
      .from('vehicule_v1_dominant')
      .select('score')
      .eq('model_slug', modelSlug)
      .eq('energy', normalizedEnergy)
      .eq('variant', variant)
      .single();

    if (error || !data) {
      return false;
    }

    return data.score >= threshold;
  }

  /**
   * Convertit un nom de modèle en slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Normalise l'énergie en valeur standard
   */
  private normalizeEnergy(
    energy: string | null,
  ): 'diesel' | 'essence' | 'unknown' {
    if (!energy) return 'unknown';
    const lower = energy.toLowerCase();
    if (lower.includes('diesel') || lower === 'gasoil') return 'diesel';
    if (lower.includes('essence') || lower === 'petrol' || lower === 'gasoline')
      return 'essence';
    return 'unknown';
  }
}
