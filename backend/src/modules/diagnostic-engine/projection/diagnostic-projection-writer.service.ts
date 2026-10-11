/**
 * DiagnosticProjectionWriterService — projette `exports/diagnostic/` du WIKI
 * dans `__diag_link_provenance` (ADR-035 D2, seul writer).
 *
 * Étapes : pré-validation complète des fichiers → lecture du référentiel actif →
 * résolution pure → UN appel `__diag_projection_apply` (une transaction). Tout
 * échec AVANT l'appel ou de l'appel lui-même est tracé par
 * `__diag_projection_record_failure`, avec la `run_key` du run ; si même cette
 * trace échoue, l'exception remonte au job BullMQ. Jamais de repli silencieux.
 * Aucune écriture directe : les deux RPC SECURITY DEFINER sont les seules voies
 * d'écriture des tables de provenance (migration 20261010).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { getErrorMessage } from '@common/utils/error.utils';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { getAppConfig } from '../../../config/app.config';
import { DiagnosticEngineDataService } from '../diagnostic-engine.data-service';
import { loadDiagnosticExports } from './diagnostic-projection-exports-loader';
import { resolveDiagnosticProjection } from './diagnostic-projection-resolver';
import {
  ApplyResultSchema,
  RecordFailureResultSchema,
  type DiagnosticProjectionFailurePayload,
  type DiagnosticProjectionRunPayload,
  type DiagnosticProjectionRunResult,
  type DiagnosticProjectionTrigger,
  type LoadedDiagnosticExports,
} from './diagnostic-projection.types';

const DIAGNOSTIC_PROJECTION_EXPORTS_ROOT_ENV =
  'DIAGNOSTIC_PROJECTION_EXPORTS_ROOT';
/** Même base que `exports/seo` : pin du sous-module, résolu depuis cwd=backend. */
const DEFAULT_DIAGNOSTIC_EXPORTS_ROOT =
  'content/automecanik-wiki/exports/diagnostic';
const MAX_ERROR_LENGTH = 2000;

/**
 * Dérive du contrat SQL (retour illisible, ou comptes ≠ payload après commit).
 * Le job ne doit pas être rejoué : il échouerait à l'identique.
 */
export class DiagnosticProjectionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagnosticProjectionContractError';
  }
}

@Injectable()
export class DiagnosticProjectionWriterService extends SupabaseBaseService {
  protected readonly logger = new Logger(
    DiagnosticProjectionWriterService.name,
  );

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly referenceData: DiagnosticEngineDataService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  getExportsRoot(): string {
    const configured =
      this.configService?.get<string>(DIAGNOSTIC_PROJECTION_EXPORTS_ROOT_ENV) ||
      DEFAULT_DIAGNOSTIC_EXPORTS_ROOT;
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  async run(
    triggeredBy: DiagnosticProjectionTrigger,
  ): Promise<DiagnosticProjectionRunResult> {
    if (this.guardReadOnly('run', triggeredBy)) {
      return { status: 'skipped', reason: 'READ_ONLY' };
    }
    // Clé d'idempotence : l'apply et l'enregistrement de son échec portent la
    // même ; la contrainte d'unicité de la base tranche l'issue réelle.
    const runKey = randomUUID();
    const startedAt = new Date().toISOString();
    const runtimeEnv = getAppConfig().app.environment;
    let loaded: LoadedDiagnosticExports | undefined;
    let payload: DiagnosticProjectionRunPayload;

    try {
      loaded = await loadDiagnosticExports(this.getExportsRoot());
      const reference = await this.referenceData.getProjectionReference();
      const resolution = resolveDiagnosticProjection(loaded.files, reference);
      payload = {
        run_key: runKey,
        triggered_by: triggeredBy,
        runtime_env: runtimeEnv,
        index_sha256: loaded.indexSha256,
        builder_version: loaded.builderVersion,
        exported_count: resolution.exportedCount,
        started_at: startedAt,
        projections: resolution.projections,
        conflicts: resolution.conflicts,
      };
    } catch (error) {
      return this.recordFailedRun({
        run_key: runKey,
        triggered_by: triggeredBy,
        runtime_env: runtimeEnv,
        error: getErrorMessage(error),
        index_sha256: loaded?.indexSha256 ?? null,
        builder_version: loaded?.builderVersion ?? null,
        // Connu dès que l'index et les fichiers sont lus ; null avant.
        exported_count: loaded
          ? loaded.files.reduce(
              (total, file) => total + file.envelope.relations.length,
              0,
            )
          : null,
        started_at: startedAt,
      });
    }

    // Nom littéral : le ratchet served-content-write-sinks ne détecte un
    // publisher (`SERVED_PUBLISH_RPCS`) que par littéral, jamais par constante.
    const { data, error } = await this.callRpc<unknown>(
      '__diag_projection_apply',
      { p_run: payload },
      { source: 'internal', isServiceRole: true },
    );
    if (error) {
      return this.recordFailedRun({
        run_key: runKey,
        triggered_by: triggeredBy,
        runtime_env: runtimeEnv,
        error: `__diag_projection_apply: ${error.message}`,
        index_sha256: payload.index_sha256,
        builder_version: payload.builder_version,
        exported_count: payload.exported_count,
        started_at: startedAt,
      });
    }

    // La transaction est validée : un retour inattendu est une dérive du
    // contrat SQL, pas un échec du run → exception typée (job en échec, visible,
    // sans nouvelle tentative — le processor le discard).
    const parsedResult = ApplyResultSchema.safeParse(data);
    if (!parsedResult.success) {
      throw new DiagnosticProjectionContractError(
        `__diag_projection_apply a répondu hors contrat après commit: ${parsedResult.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    const applied = parsedResult.data;
    if (
      applied.projected_count !== payload.projections.length ||
      applied.conflict_count !== payload.conflicts.length
    ) {
      throw new DiagnosticProjectionContractError(
        `__diag_projection_apply: comptes validés (${applied.projected_count} projection(s), ${applied.conflict_count} conflit(s)) ≠ payload (${payload.projections.length}, ${payload.conflicts.length})`,
      );
    }
    const summary = {
      metric: 'diagnostic_projection.applied',
      triggered_by: triggeredBy,
      exported_count: payload.exported_count,
      ...applied,
    };
    if (payload.exported_count === 0) {
      this.logger.warn(
        summary,
        `Index exports/diagnostic vide : ${applied.retired_count} provenance(s) retirée(s)`,
      );
    } else {
      this.logger.log(summary, 'Projection diagnostic appliquée');
    }
    return {
      status: 'applied',
      exportedCount: payload.exported_count,
      ...applied,
    };
  }

  /**
   * Trace l'échec par `__diag_projection_record_failure`. La base rend l'issue
   * réelle de la `run_key` : `failed` (échec écrit) ou `applied` (l'apply a été
   * validé, seule sa réponse s'était perdue — rien n'est écrit).
   */
  private async recordFailedRun(
    failure: DiagnosticProjectionFailurePayload,
  ): Promise<DiagnosticProjectionRunResult> {
    // Le CHECK `error_iff_failed` refuse une erreur vide.
    const error =
      failure.error.trim().slice(0, MAX_ERROR_LENGTH) || 'unknown error';
    const logContext = {
      triggered_by: failure.triggered_by,
      run_key: failure.run_key,
      error,
    };
    const { data, error: recordError } = await this.callRpc<unknown>(
      '__diag_projection_record_failure',
      { p_run: { ...failure, error } },
      { source: 'internal', isServiceRole: true },
    );
    if (recordError) {
      this.logger.error(
        {
          metric: 'diagnostic_projection.failed',
          ...logContext,
          recorded: false,
        },
        'Projection diagnostic en échec, échec non enregistré',
      );
      throw new Error(
        `diagnostic projection failed (${error}) and its run could not be recorded: ${recordError.message}`,
      );
    }
    const parsed = RecordFailureResultSchema.safeParse(data);
    if (!parsed.success) {
      throw new DiagnosticProjectionContractError(
        `__diag_projection_record_failure a répondu hors contrat: ${parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    const runId = parsed.data.run_id;
    if (parsed.data.status === 'applied') {
      this.logger.warn(
        {
          metric: 'diagnostic_projection.applied_unconfirmed',
          ...logContext,
          run_id: runId,
        },
        'Projection diagnostic appliquée, réponse perdue : comptes dans __diag_projection_runs',
      );
      return { status: 'applied_unconfirmed', runId, error };
    }
    this.logger.error(
      { metric: 'diagnostic_projection.failed', ...logContext, run_id: runId },
      'Projection diagnostic en échec',
    );
    return { status: 'failed', runId, error };
  }
}
