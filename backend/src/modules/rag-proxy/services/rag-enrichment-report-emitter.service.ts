import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fsp } from 'fs';
import { dirname } from 'path';
import { ZodError } from 'zod';

import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  RagEnrichmentReportSchema,
  type RagEnrichmentReportInput,
} from '../types/rag-lifecycle.schema';
import type {
  RagEnrichmentReport,
  RagConflictType,
} from '../types/rag-lifecycle.types';
import { isDecisionCoherent } from '../types/rag-lifecycle.types';

/**
 * RagEnrichmentReportEmitterService — ADR-029 P1.
 *
 * Émet un `enrichment-report.json` par exécution du pipeline RAG v2.1.
 * Chaque report est :
 *   1. Validé contre `.spec/00-canon/enrichment-report.schema.json` (via Zod)
 *   2. Vérifié pour cohérence du decision matrix (PROMOTE_L1 forbids conflicts)
 *   3. Persisté en table `__rag_enrichment_runs` (Supabase, RLS service_role)
 *   4. Dumpé en filesystem `{logsDir}/runs/{run_id}.json` (audit trail)
 *
 * Les callers (audit/enrich/qa runners de P2-P4) appellent `emit()` avec un
 * payload partiel — le service complète `run_id` (UUID v4) et `run_date`
 * (date du jour ISO) si absents.
 */
@Injectable()
export class RagEnrichmentReportEmitterService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    RagEnrichmentReportEmitterService.name,
  );

  /**
   * Répertoire des dumps JSON par run. Configurable via `RAG_RUN_LOGS_DIR`,
   * défaut `/opt/automecanik/rag/logs/runs`.
   */
  private readonly runsLogDir: string;

  constructor(configService: ConfigService) {
    super(configService);
    this.runsLogDir =
      configService.get<string>('RAG_RUN_LOGS_DIR') ||
      '/opt/automecanik/rag/logs/runs';
  }

  /**
   * Persiste un enrichment report. Auto-génère `run_id` et `run_date` si
   * absents.
   *
   * @throws BadRequestException si le payload échoue la validation Zod ou
   *         la cohérence du decision matrix.
   * @throws InternalServerErrorException si la persistance DB ou filesystem
   *         échoue.
   */
  async emit(
    input: Partial<RagEnrichmentReportInput>,
  ): Promise<RagEnrichmentReport> {
    const completed: RagEnrichmentReportInput = {
      ...input,
      run_id: input.run_id ?? randomUUID(),
      run_date: input.run_date ?? new Date().toISOString().slice(0, 10),
    } as RagEnrichmentReportInput;

    let report: RagEnrichmentReport;
    try {
      report = RagEnrichmentReportSchema.parse(completed) as RagEnrichmentReport;
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        this.logger.warn(
          `enrichment-report validation failed for alias=${input.alias ?? '?'} run_id=${
            completed.run_id
          }: ${issues}`,
        );
        throw new BadRequestException({
          code: 'RAG_REPORT_SCHEMA_INVALID',
          message: 'Enrichment report failed schema validation',
          issues: err.issues,
        });
      }
      throw err;
    }

    if (!isDecisionCoherent(report)) {
      throw new BadRequestException({
        code: 'RAG_REPORT_DECISION_INCOHERENT',
        message:
          'Decision matrix incoherent (e.g. PROMOTE_L1 with active conflicts, ' +
          'safety_conflict not routed to PENDING_REVIEW/BLOCKED)',
        decision: report.decision,
        conflicts: report.conflicts,
      });
    }

    const conflictsCounts = countConflictsByType(report);

    // ── 1. Persist filesystem dump (best-effort first; if FS fails we still
    //      try DB to avoid losing the report entirely) ─────────────────────
    const filePath = `${this.runsLogDir}/${report.run_id}.json`;
    try {
      await fsp.mkdir(dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(
        `Failed to write run report to ${filePath}: ${(err as Error).message}`,
      );
      // Continue to DB persistence — DB is the SoT for the report.
    }

    // ── 2. Persist DB row in __rag_enrichment_runs ──────────────────────────
    const { error } = await this.supabase
      .from('__rag_enrichment_runs')
      .insert({
        run_id: report.run_id,
        alias: report.alias,
        run_date: report.run_date,
        execution_mode: report.execution_mode,
        state_before: report.state_before,
        state_after: report.state_after,
        truth_level_before: report.truth_level_before,
        truth_level_after: report.truth_level_after,
        decision: report.decision,
        reason: report.reason,
        report_json: report,
        conflicts_count: conflictsCounts.total,
        conflicts_safety: conflictsCounts.safety,
        conflicts_technical: conflictsCounts.technical,
        conflicts_minor: conflictsCounts.minor,
      });

    if (error) {
      this.logger.error(
        `Failed to persist enrichment report run_id=${report.run_id} alias=${report.alias}: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'RAG_REPORT_DB_PERSIST_FAILED',
        message: 'Failed to persist enrichment report to __rag_enrichment_runs',
        cause: error.message,
      });
    }

    this.logger.log(
      `enrichment-report emitted alias=${report.alias} run_id=${report.run_id} ` +
        `mode=${report.execution_mode} decision=${report.decision} ` +
        `conflicts=${conflictsCounts.total} (safety=${conflictsCounts.safety}, ` +
        `technical=${conflictsCounts.technical}, minor=${conflictsCounts.minor})`,
    );

    return report;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ConflictCounts {
  total: number;
  safety: number;
  technical: number;
  minor: number;
}

function countConflictsByType(report: RagEnrichmentReport): ConflictCounts {
  const counts: ConflictCounts = {
    total: report.conflicts.length,
    safety: 0,
    technical: 0,
    minor: 0,
  };
  for (const c of report.conflicts) {
    const t: RagConflictType = c.conflict_type;
    if (t === 'safety_conflict') counts.safety += 1;
    else if (t === 'technical_conflict') counts.technical += 1;
    else if (t === 'minor_variation') counts.minor += 1;
  }
  return counts;
}
