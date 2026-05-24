/**
 * QualityHistorySnapshotService
 *
 * Implémente ADR-050 Livrable 1 (snapshot writes) + Livrable 2 (RPC outliers).
 *
 * Pattern : le SupabaseClient est passé en paramètre (cohérent avec
 * SeoMonitoringRunsService du même module). Le controller `seo-quality-history`
 * fabrique le client service-role.
 *
 * Pas de @Cron interne (ScheduleModule désactivé monorepo, conflit @nestjs/common
 * v10). Le cron système (crontab + curl admin endpoint) appelle les méthodes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  detectExtractableTldr,
  detectFaqSchema,
  detectVisibleSources,
} from '../helpers/ai-readiness-detectors';

export type SnapshotKind =
  | 'monthly_cron'
  | 'pre_batch'
  | 'post_batch'
  | 'on_demand';

export interface QualityHistoryRow {
  pg_id: string;
  role_id: string;
  metric_name: string;
  metric_value: number;
  snapshot_kind: SnapshotKind;
  metadata?: Record<string, unknown>;
}

export interface QualityOutlier {
  pg_id: string;
  role_id: string;
  metric_name: string;
  baseline_value: number;
  current_value: number;
  drop_ratio: number;
  baseline_at: string;
  current_at: string;
}

const SUPPORTED_ROLES = [
  'R0_HOME',
  'R1_ROUTER',
  'R2_PRODUCT',
  'R3_CONSEILS',
  'R4_REFERENCE',
  'R6_GUIDE_ACHAT',
  'R7_BRAND',
  'R8_VEHICLE',
];

const INSERT_CHUNK_SIZE = 500;

@Injectable()
export class QualityHistorySnapshotService {
  private readonly logger = new Logger(QualityHistorySnapshotService.name);

  /**
   * Snapshot toutes les métriques disponibles pour les 8 rôles live.
   * Pour MVP-0 : R1 lit __seo_r1_gamme_slots, autres rôles produisent un
   * placeholder synthétique (PR-X1.1 follow-up étendra par rôle).
   */
  async snapshotAllRoles(
    supabase: SupabaseClient,
    kind: SnapshotKind,
    metadata: Record<string, unknown> = {},
  ): Promise<number> {
    const allRows: QualityHistoryRow[] = [];

    for (const roleId of SUPPORTED_ROLES) {
      try {
        const rows = await this.fetchMetricsForRole(
          supabase,
          roleId,
          kind,
          metadata,
        );
        allRows.push(...rows);
      } catch (err) {
        this.logger.error(
          `snapshotAllRoles: échec collecte ${roleId} — skip`,
          err,
        );
        // Continue les autres rôles : 1 panne ne casse pas le snapshot global.
      }
    }

    return this.bulkInsert(supabase, allRows);
  }

  /**
   * Snapshot une cohorte explicite avant/après un batch.
   * Utilisé par PR-T (re-enrich 163 slots) avec snapshot_kind='pre_batch'/'post_batch'.
   */
  async snapshotCohort(
    supabase: SupabaseClient,
    rows: QualityHistoryRow[],
  ): Promise<number> {
    return this.bulkInsert(supabase, rows);
  }

  /**
   * Crée la partition du mois suivant si absente. Idempotent.
   * À appeler le 25 de chaque mois via cron système.
   */
  async ensureNextMonthPartition(supabase: SupabaseClient): Promise<string> {
    const { data, error } = await supabase.rpc(
      'ensure_next_quality_history_partition',
    );

    if (error) {
      this.logger.error('ensureNextMonthPartition RPC fail', error);
      throw new Error(
        `ensure_next_quality_history_partition: ${error.message}`,
      );
    }
    return data as string;
  }

  /**
   * Détecte les pg_id outliers (drop >= dropPct sur la fenêtre).
   * Appelée par /health/quality + PR-T post-batch quality gate.
   */
  async detectOutliers(
    supabase: SupabaseClient,
    opts: {
      windowDays?: number;
      dropPct?: number;
      roleId?: string | null;
      metricName?: string;
    } = {},
  ): Promise<QualityOutlier[]> {
    const { data, error } = await supabase.rpc('detect_quality_outliers', {
      p_window_days: opts.windowDays ?? 30,
      p_drop_pct: opts.dropPct ?? 0.15,
      p_role_id: opts.roleId ?? null,
      p_metric_name: opts.metricName ?? 'gatekeeper_score',
    });

    if (error) {
      this.logger.error('detectOutliers RPC fail', error);
      throw new Error(`detect_quality_outliers: ${error.message}`);
    }
    return (data as QualityOutlier[]) ?? [];
  }

  /**
   * Génère les 3 métriques AI readiness depuis un HTML rendu (ou fragment).
   *
   * Pattern EAV — émis comme 3 rows metric_name distincts dans __seo_quality_history,
   * pas de nouvelle colonne, pas de migration DDL.
   *
   * V1 limitation : si appelé avec un fragment (ex. `r1s_micro_seo_block`), le
   * détecteur FAQ schema retournera 0 (le JSON-LD vit dans le `<head>` rendu, pas
   * dans le fragment). Real HTML fetching = PR-X1.1 follow-up.
   *
   * Cf. ADR "AI Visibility = couche additive du Search Control Plane".
   */
  extractAiReadinessRows(
    roleId: string,
    pgId: string,
    html: string,
    kind: SnapshotKind,
    metadata: Record<string, unknown>,
    ownHostname: string = 'www.automecanik.com',
  ): QualityHistoryRow[] {
    const baseMetadata = { ...metadata, layer: 'ai-additive' };
    return [
      {
        pg_id: pgId,
        role_id: roleId,
        metric_name: 'ai_has_extractable_tldr',
        metric_value: detectExtractableTldr(html),
        snapshot_kind: kind,
        metadata: baseMetadata,
      },
      {
        pg_id: pgId,
        role_id: roleId,
        metric_name: 'ai_has_faq_schema',
        metric_value: detectFaqSchema(html),
        snapshot_kind: kind,
        metadata: baseMetadata,
      },
      {
        pg_id: pgId,
        role_id: roleId,
        metric_name: 'ai_has_visible_sources',
        metric_value: detectVisibleSources(html, ownHostname),
        snapshot_kind: kind,
        metadata: baseMetadata,
      },
    ];
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  /**
   * Bulk INSERT en chunks de 500 (limite payload Supabase REST).
   * RLS service_role autorise tous les writes.
   */
  private async bulkInsert(
    supabase: SupabaseClient,
    rows: QualityHistoryRow[],
  ): Promise<number> {
    if (rows.length === 0) {
      this.logger.warn('bulkInsert: 0 rows à écrire (skip)');
      return 0;
    }

    let inserted = 0;

    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
      const { error, count } = await supabase
        .from('__seo_quality_history')
        .insert(chunk, { count: 'exact' });

      if (error) {
        this.logger.error(
          `bulkInsert chunk ${i / INSERT_CHUNK_SIZE} (${chunk.length} rows) FAIL`,
          error,
        );
        throw new Error(`__seo_quality_history bulk insert: ${error.message}`);
      }
      inserted += count ?? chunk.length;
    }

    this.logger.log(
      `✓ snapshot inserted ${inserted} rows (${rows.length} attendus)`,
    );
    return inserted;
  }

  /**
   * Mapping role → (table, columns, metrics extraites).
   * Pour MVP-0 : R1 lit __seo_r1_gamme_slots, autres rôles renvoient un
   * placeholder synthétique pour respecter invariant 16 du plan
   * ("snapshot initial pour les 8 rôles"). PR-X1.1 follow-up étendra.
   */
  private async fetchMetricsForRole(
    supabase: SupabaseClient,
    roleId: string,
    kind: SnapshotKind,
    extraMetadata: Record<string, unknown>,
  ): Promise<QualityHistoryRow[]> {
    const baseMetadata = { ...extraMetadata };

    if (roleId === 'R1_ROUTER') {
      const { data, error } = await supabase
        .from('__seo_r1_gamme_slots')
        .select('r1s_pg_id, r1s_micro_seo_block, r1s_gatekeeper_score');
      if (error) throw error;

      const rows: QualityHistoryRow[] = [];
      for (const r of (data ?? []) as Array<{
        r1s_pg_id: string;
        r1s_micro_seo_block: string | null;
        r1s_gatekeeper_score: number | string | null;
      }>) {
        const pgId = r.r1s_pg_id;
        const charCount = (r.r1s_micro_seo_block ?? '').length;
        rows.push({
          pg_id: pgId,
          role_id: roleId,
          metric_name: 'char_count',
          metric_value: charCount,
          snapshot_kind: kind,
          metadata: {
            ...baseMetadata,
            source_table: '__seo_r1_gamme_slots',
            column: 'r1s_micro_seo_block',
          },
        });
        if (r.r1s_gatekeeper_score != null) {
          rows.push({
            pg_id: pgId,
            role_id: roleId,
            metric_name: 'gatekeeper_score',
            metric_value: Number(r.r1s_gatekeeper_score),
            snapshot_kind: kind,
            metadata: {
              ...baseMetadata,
              source_table: '__seo_r1_gamme_slots',
              column: 'r1s_gatekeeper_score',
            },
          });
        }
        // AI readiness — émis depuis le fragment `r1s_micro_seo_block`.
        // V1 : `ai_has_faq_schema` = 0 (schema en <head>, pas dans fragment).
        rows.push(
          ...this.extractAiReadinessRows(
            roleId,
            pgId,
            r.r1s_micro_seo_block ?? '',
            kind,
            baseMetadata,
          ),
        );
      }
      return rows;
    }

    // Placeholder synthétique pour R0/R2/R3/R4/R6/R7/R8 — 1 row par rôle
    // pour respecter l'invariant 16 "snapshot initial 8 rôles".
    // PR-X1.1 follow-up : fetcher dédié par rôle (R3 → __seo_gamme_conseil, R4
    // → __seo_reference, R6 → __seo_gamme_purchase_guide, R7 → __seo_brand_editorial,
    // R8 → vehicle composite).
    return [
      {
        pg_id: '__synthetic_initial__',
        role_id: roleId,
        metric_name: 'char_count',
        metric_value: 0,
        snapshot_kind: kind,
        metadata: {
          ...baseMetadata,
          note: 'synthetic placeholder — PR-X1.1 follow-up will add real fetchers per role',
        },
      },
      // AI readiness — synthetic placeholders : empty HTML yields 0 for all 3 detectors.
      ...this.extractAiReadinessRows(
        roleId,
        '__synthetic_initial__',
        '',
        kind,
        baseMetadata,
      ),
    ];
  }
}
