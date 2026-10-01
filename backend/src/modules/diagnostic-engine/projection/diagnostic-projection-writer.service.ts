/**
 * DiagnosticProjectionWriterService — projette `exports/diagnostic/` du WIKI
 * dans `__diag_link_provenance` (spec §4.5).
 *
 * Étapes : pré-validation complète des fichiers → lecture du référentiel actif →
 * résolution pure → UN appel `__diag_projection_apply` (une transaction). Tout
 * échec AVANT l'appel ou de l'appel lui-même est tracé par un run `failed` dans
 * `__diag_projection_runs` ; si même cette trace échoue, l'exception remonte au
 * job BullMQ. Jamais de repli silencieux.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  DIAGNOSTIC_PROJECTION_RUNS_TABLE,
  type DiagnosticProjectionRunPayload,
  type DiagnosticProjectionRunResult,
  type DiagnosticProjectionTrigger,
  type LoadedDiagnosticExports,
} from './diagnostic-projection.types';

export const DIAGNOSTIC_PROJECTION_EXPORTS_ROOT_ENV =
  'DIAGNOSTIC_PROJECTION_EXPORTS_ROOT';
/** Même base que `exports/seo` : pin du sous-module, résolu depuis cwd=backend. */
export const DEFAULT_DIAGNOSTIC_EXPORTS_ROOT =
  'content/automecanik-wiki/exports/diagnostic';
const MAX_ERROR_LENGTH = 2000;

/**
 * Dérive du contrat SQL APRÈS commit (retour illisible ou comptes ≠ payload).
 * Le job ne doit pas être rejoué : la transaction est déjà validée.
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
    const startedAt = new Date().toISOString();
    const runtimeEnv = getAppConfig().app.environment;
    let loaded: LoadedDiagnosticExports | undefined;
    let payload: DiagnosticProjectionRunPayload;

    try {
      loaded = await loadDiagnosticExports(this.getExportsRoot());
      const reference = await this.referenceData.getProjectionReference();
      const resolution = resolveDiagnosticProjection(loaded.files, reference);
      payload = {
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
      return this.recordFailedRun(
        triggeredBy,
        runtimeEnv,
        startedAt,
        loaded,
        getErrorMessage(error),
      );
    }

    // Nom littéral : le ratchet served-content-write-sinks ne détecte un
    // publisher (`SERVED_PUBLISH_RPCS`) que par littéral, jamais par constante.
    const { data, error } = await this.callRpc<unknown>(
      '__diag_projection_apply',
      { p_run: payload },
      { source: 'internal', isServiceRole: true },
    );
    if (error) {
      return this.recordFailedRun(
        triggeredBy,
        runtimeEnv,
        startedAt,
        loaded,
        `__diag_projection_apply: ${error.message}`,
        payload.exported_count,
      );
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

  private async recordFailedRun(
    triggeredBy: DiagnosticProjectionTrigger,
    runtimeEnv: string,
    startedAt: string,
    loaded: LoadedDiagnosticExports | undefined,
    message: string,
    exportedCount = 0,
  ): Promise<DiagnosticProjectionRunResult> {
    const error = message.slice(0, MAX_ERROR_LENGTH) || 'unknown error';
    this.logger.error(
      {
        metric: 'diagnostic_projection.failed',
        triggered_by: triggeredBy,
        error,
      },
      'Projection diagnostic en échec',
    );
    const { error: insertError } = await this.supabase
      .from(DIAGNOSTIC_PROJECTION_RUNS_TABLE)
      .insert({
        triggered_by: triggeredBy,
        runtime_env: runtimeEnv,
        index_sha256: loaded?.indexSha256 ?? null,
        builder_version: loaded?.builderVersion ?? null,
        exported_count: exportedCount,
        status: 'failed',
        error,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
    if (insertError) {
      throw new Error(
        `diagnostic projection failed (${error}) and its run could not be recorded: ${insertError.message}`,
      );
    }
    return { status: 'failed', error };
  }
}
