import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  SectionKMetrics,
  MissingTypeId,
  ExtraTypeId,
  SectionKKpis,
  SectionKResponse,
} from '../types/section-k.types';

/**
 * Section K Service - V-Level Conformity Metrics
 *
 * STATUS = (missing == 0 AND extras == 0) → CONFORME
 */
@Injectable()
export class SectionKService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SectionKService.name);

  /**
   * Récupère les métriques Section K pour une ou toutes les gammes
   * @param pgId - ID gamme optionnel (null = toutes les gammes)
   */
  async getSectionKMetrics(pgId?: number): Promise<SectionKMetrics[]> {
    this.logger.debug(`Getting Section K metrics for pg_id=${pgId ?? 'all'}`);

    const { data, error } = await this.client.rpc(
      'get_vlevel_section_k_metrics',
      { p_pg_id: pgId ?? null },
    );

    if (error) {
      this.logger.error(`Section K metrics failed: ${error.message}`);
      throw new Error(`Section K metrics failed: ${error.message}`);
    }

    return (data || []) as SectionKMetrics[];
  }

  /**
   * Récupère les métriques avec KPIs calculés
   */
  async getSectionKWithKpis(pgId?: number): Promise<SectionKResponse> {
    const metrics = await this.getSectionKMetrics(pgId);

    const total = metrics.length;
    const conformes = metrics.filter((m) => m.status === 'CONFORME').length;
    const nonConformes = total - conformes;

    // Coverage global = moyenne de (covered_v2v3 + actual_v4) / catalog_valid
    const coverageSum = metrics.reduce((sum, m) => {
      if (m.catalog_valid > 0) {
        const coverage =
          ((m.covered_v2v3 + m.actual_v4) / m.catalog_valid) * 100;
        return sum + coverage;
      }
      return sum;
    }, 0);
    const coverageGlobal = total > 0 ? (coverageSum / total).toFixed(1) : '0.0';

    const kpis: SectionKKpis = {
      total,
      conformes,
      nonConformes,
      coverageGlobal,
    };

    return { metrics, kpis };
  }

  /**
   * Récupère les type_ids manquants pour drill-down (T-E)
   * @param pgId - ID gamme (obligatoire)
   */
  async getMissingTypeIds(pgId: number): Promise<MissingTypeId[]> {
    this.logger.debug(`Getting missing type_ids for pg_id=${pgId}`);

    const { data, error } = await this.client.rpc('get_missing_v4_type_ids', {
      p_pg_id: pgId,
    });

    if (error) {
      this.logger.error(`Missing type_ids failed: ${error.message}`);
      throw new Error(`Missing type_ids failed: ${error.message}`);
    }

    return (data || []) as MissingTypeId[];
  }

  /**
   * Récupère les type_ids extras pour drill-down (T-F)
   * @param pgId - ID gamme (obligatoire)
   */
  async getExtrasTypeIds(pgId: number): Promise<ExtraTypeId[]> {
    this.logger.debug(`Getting extras type_ids for pg_id=${pgId}`);

    const { data, error } = await this.client.rpc('get_extras_v4_type_ids', {
      p_pg_id: pgId,
    });

    if (error) {
      this.logger.error(`Extras type_ids failed: ${error.message}`);
      throw new Error(`Extras type_ids failed: ${error.message}`);
    }

    return (data || []) as ExtraTypeId[];
  }
}
