/**
 * ADR-070 PR 2C' — R1 Gamme Completeness Audit Service
 *
 * Audit prerequisite avant pilote V1 R2 v2 — identifie les gammes R1 dont
 * les sections critiques (héritées telles quelles par R2) sont incomplètes.
 *
 * Canon ADR-070 §G (R8 + R1 prerequisite gates) :
 *   - R1 gamme context obligatoire (CADRE) pour qu'une page R2 puisse être INDEX
 *   - Sections critiques héritées par R2 : S_SELECTION_GUIDE, S_MISTAKES_AVOID,
 *     S_FAQ_GAMME, S_TECHNICAL_CRITERIA, S_REASSURANCE_METIER
 *   - Mapping conceptuel → DB `__seo_gamme_conseil.sgc_section_type` :
 *       S1 (Fonction)             → contribue à S_TECHNICAL_CRITERIA / S_REASSURANCE
 *       S2 (Quand changer)        → contribue à S_REASSURANCE_METIER
 *       S3 (Comment choisir)      → S_SELECTION_GUIDE
 *       S5 (Erreurs à éviter)     → S_MISTAKES_AVOID
 *       S6 (Vérification finale)  → S_TECHNICAL_CRITERIA
 *       S8 (FAQ)                  → S_FAQ_GAMME
 *
 * Une gamme est considérée :
 *   - `complete`  : 5/5 sections critiques DB présentes (S1+S3+S5+S6+S8) avec sgc_content non-vide
 *   - `partial`   : 1-4 sections critiques présentes (R2 compose retournera review_required reason r1_gamme_sections_empty)
 *   - `missing`   : 0 section critique ou aucune row __seo_gamme_conseil pour ce pg_id
 *
 * Service READ-ONLY pur. Aucun write. La relance R1 keyword planner agent
 * (workspace seo-batch `r1-keyword-planner`) reste human-triggered.
 *
 * Cf MEMORY feedback_verify_existing_first : agent r1-keyword-planner déjà
 * référencé dans `backend/src/modules/agentic-engine/constants/agentic.constants.ts`
 * (GOAL_REGISTRY.keyword_plan.agents).
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';

/**
 * 5 sections DB critiques canon ADR-070 R1 prerequisite.
 * Toute gamme avec ces 5 sections non-vides est considérée `complete`.
 */
export const R1_CRITICAL_SECTIONS_DB = [
  'S1', // Fonction
  'S3', // Comment choisir
  'S5', // Erreurs à éviter
  'S6', // Vérification finale
  'S8', // FAQ
] as const;

export type R1CriticalSectionDb = (typeof R1_CRITICAL_SECTIONS_DB)[number];

export type R1GammeCompletenessStatus = 'complete' | 'partial' | 'missing';

export interface R1GammePerSectionPresence {
  S1: boolean;
  S3: boolean;
  S5: boolean;
  S6: boolean;
  S8: boolean;
}

export interface R1GammeCompletenessRow {
  pgId: number;
  pgAlias: string | null;
  pgName: string | null;
  sectionsPresent: R1GammePerSectionPresence;
  sectionsPresentCount: number;
  status: R1GammeCompletenessStatus;
}

export interface R1GammeCompletenessAuditReport {
  totalGammes: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  completePercent: number;
  partialPercent: number;
  missingPercent: number;
  /**
   * Bloque pilote V1 si > 30% gammes ont sections critiques vides
   * (canon ADR-070 §G, seuil empirique calibration à venir).
   */
  pilotV1Blocker: boolean;
  rowsSample: R1GammeCompletenessRow[]; // limite top N partial/missing pour visualisation admin
  generatedAt: string;
}

@Injectable()
export class R1GammeCompletenessAuditService extends SupabaseBaseService {
  protected readonly logger = new Logger(R1GammeCompletenessAuditService.name);

  /**
   * Seuil canon ADR-070 §G : si > 30% gammes ont sections critiques vides,
   * pilote V1 bloqué (sinon ~30%+ pages R2 retournent review_required
   * reason `r1_gamme_sections_empty` immédiatement).
   */
  static readonly PILOT_V1_BLOCKER_THRESHOLD_PERCENT = 30;

  /**
   * Génère le rapport d'audit complet. Pure read. Lit :
   *   - `pieces_gamme` pour la liste totale des gammes (pg_id, pg_alias, pg_name)
   *   - `__seo_gamme_conseil` pour les sections existantes par gamme
   *
   * Param `partialMissingSampleLimit` : top N gammes incomplètes à inclure
   * dans `rowsSample` (par défaut 50 — visualisation admin).
   */
  async auditCompleteness(
    partialMissingSampleLimit: number = 50,
  ): Promise<R1GammeCompletenessAuditReport> {
    const startedAt = Date.now();

    // 1. Pull all gammes (parent set) — paginated to handle large catalogs
    const gammes = await this.fetchAllGammes();

    // 2. Pull sections present per pg_id from __seo_gamme_conseil
    //    Only critical sections, only with non-empty content.
    const sectionsByPgId = await this.fetchCriticalSectionsPresenceMap();

    // 3. Compute per-gamme status
    const rows: R1GammeCompletenessRow[] = gammes.map((gamme) => {
      const present = sectionsByPgId.get(gamme.pgId) ?? this.emptyPresence();
      const count = R1_CRITICAL_SECTIONS_DB.filter((s) => present[s]).length;
      const status: R1GammeCompletenessStatus =
        count === R1_CRITICAL_SECTIONS_DB.length
          ? 'complete'
          : count === 0
            ? 'missing'
            : 'partial';
      return {
        pgId: gamme.pgId,
        pgAlias: gamme.pgAlias,
        pgName: gamme.pgName,
        sectionsPresent: present,
        sectionsPresentCount: count,
        status,
      };
    });

    // 4. Aggregate counts
    const completeCount = rows.filter((r) => r.status === 'complete').length;
    const partialCount = rows.filter((r) => r.status === 'partial').length;
    const missingCount = rows.filter((r) => r.status === 'missing').length;
    const total = rows.length;
    const incompletePercent =
      total === 0 ? 0 : ((partialCount + missingCount) / total) * 100;

    // 5. Sample top N incomplete (sorted: missing first, then partial by count ascending)
    const incompleteSorted = rows
      .filter((r) => r.status !== 'complete')
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'missing' ? -1 : 1;
        }
        return a.sectionsPresentCount - b.sectionsPresentCount;
      });

    const report: R1GammeCompletenessAuditReport = {
      totalGammes: total,
      completeCount,
      partialCount,
      missingCount,
      completePercent: total === 0 ? 0 : (completeCount / total) * 100,
      partialPercent: total === 0 ? 0 : (partialCount / total) * 100,
      missingPercent: total === 0 ? 0 : (missingCount / total) * 100,
      pilotV1Blocker:
        incompletePercent >
        R1GammeCompletenessAuditService.PILOT_V1_BLOCKER_THRESHOLD_PERCENT,
      rowsSample: incompleteSorted.slice(0, partialMissingSampleLimit),
      generatedAt: new Date().toISOString(),
    };

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `R1 gamme completeness audit done in ${durationMs}ms : ` +
        `${completeCount}/${total} complete, ${partialCount} partial, ${missingCount} missing — ` +
        `pilotV1Blocker=${report.pilotV1Blocker}`,
    );

    return report;
  }

  /** Pull all rows from pieces_gamme (paginated chunks of 1000). */
  private async fetchAllGammes(): Promise<
    Array<{ pgId: number; pgAlias: string | null; pgName: string | null }>
  > {
    const all: Array<{
      pgId: number;
      pgAlias: string | null;
      pgName: string | null;
    }> = [];
    const pageSize = 1000;
    let from = 0;

    for (;;) {
      const { data, error } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias, pg_name')
        .order('pg_id')
        .range(from, from + pageSize - 1);

      if (error) {
        this.logger.error(
          `fetchAllGammes failed at offset ${from}: ${error.message}`,
        );
        break;
      }
      if (!data || data.length === 0) {
        break;
      }
      for (const row of data) {
        all.push({
          pgId: Number(row.pg_id),
          pgAlias: row.pg_alias ?? null,
          pgName: row.pg_name ?? null,
        });
      }
      if (data.length < pageSize) {
        break;
      }
      from += pageSize;
    }

    return all;
  }

  /**
   * Pull __seo_gamme_conseil rows for critical sections only (non-empty content).
   * Returns map pgId → presence flags per section.
   */
  private async fetchCriticalSectionsPresenceMap(): Promise<
    Map<number, R1GammePerSectionPresence>
  > {
    const map = new Map<number, R1GammePerSectionPresence>();
    const pageSize = 1000;
    let from = 0;

    for (;;) {
      const { data, error } = await this.supabase
        .from('__seo_gamme_conseil')
        .select('sgc_pg_id, sgc_section_type, sgc_content')
        .in('sgc_section_type', [...R1_CRITICAL_SECTIONS_DB])
        .not('sgc_content', 'is', null)
        .range(from, from + pageSize - 1);

      if (error) {
        this.logger.error(
          `fetchCriticalSectionsPresenceMap failed at offset ${from}: ${error.message}`,
        );
        break;
      }
      if (!data || data.length === 0) {
        break;
      }

      for (const row of data) {
        const pgId = Number(row.sgc_pg_id);
        const sectionType = row.sgc_section_type as R1CriticalSectionDb;
        const content = (row.sgc_content as string | null) ?? '';

        // Treat whitespace-only or extremely short content as effectively missing.
        if (content.trim().length < 10) {
          continue;
        }

        let presence = map.get(pgId);
        if (!presence) {
          presence = this.emptyPresence();
          map.set(pgId, presence);
        }
        presence[sectionType] = true;
      }

      if (data.length < pageSize) {
        break;
      }
      from += pageSize;
    }

    return map;
  }

  private emptyPresence(): R1GammePerSectionPresence {
    return { S1: false, S3: false, S5: false, S6: false, S8: false };
  }
}
