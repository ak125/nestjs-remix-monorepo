/**
 * ADR-059 SEO Runtime Projection — Phase B PR-6b
 *
 * Contract version constants + runtime compatibility check.
 *
 * Voir ADR-059 §"Contract versioning extensible" :
 * - `schema_version` (du JSON export) ≠ `projection_contract_version` (du runner)
 * - Ce module définit la version du RUNNER. Tout JOB qui arrive doit être
 *   compatible (même major).
 *
 * Future extensions possibles (followup) :
 * - rpc_contract_version (PR-7)
 * - consumer_contract_version (pages frontend)
 */

export const RUNNER_PROJECTION_CONTRACT_VERSION = '1.0.0';
export const RUNNER_VERSION = '1.0.0';
export const PIPELINE_VERSION = '1.0.0';
export const EXTRACTOR_VERSION = '1.0.0';
export const BUILDER_VERSION = '1.0.0';

/**
 * Lève si la version contract du JOB est incompatible avec celle du RUNNER.
 *
 * Compatibility rule (semver-aware) :
 * - MAJOR différent → INCOMPATIBLE (abort, status='aborted_contract_mismatch')
 * - MAJOR identique, MINOR/PATCH variables → COMPATIBLE (forward compat)
 *
 * Memory : `feedback_projection_contract_version_distinct.md` impose ce check
 * **au début** du runner pour éviter migration cassante silencieuse.
 */
export class ProjectionContractMismatchError extends Error {
  readonly jobVersion: string;
  readonly runnerVersion: string;

  constructor(jobVersion: string, runnerVersion: string) {
    super(
      `projection_contract_version mismatch: job=v${jobVersion} runner=v${runnerVersion} ` +
        `(MAJOR mismatch — runner aborts, Sentry alert recommended)`,
    );
    this.name = 'ProjectionContractMismatchError';
    this.jobVersion = jobVersion;
    this.runnerVersion = runnerVersion;
  }
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function assertCompatibleProjectionContract(
  jobContractVersion: string,
  runnerContractVersion: string = RUNNER_PROJECTION_CONTRACT_VERSION,
): void {
  const jobMatch = SEMVER_RE.exec(jobContractVersion);
  const runnerMatch = SEMVER_RE.exec(runnerContractVersion);
  if (!jobMatch || !runnerMatch) {
    throw new ProjectionContractMismatchError(
      jobContractVersion,
      runnerContractVersion,
    );
  }
  const jobMajor = Number(jobMatch[1]);
  const runnerMajor = Number(runnerMatch[1]);
  if (jobMajor !== runnerMajor) {
    throw new ProjectionContractMismatchError(
      jobContractVersion,
      runnerContractVersion,
    );
  }
}

/**
 * Names canonical des 2 queues BullMQ découplées (write ↔ refresh).
 * Le découplage est NON-NÉGOCIABLE per ADR-059 §"Découplage write ↔ refresh" :
 * REFRESH MATERIALIZED VIEW CONCURRENTLY ne s'exécute JAMAIS dans la
 * transaction d'écriture.
 */
export const SEO_PROJECTION_WRITE_QUEUE = 'seo-projection-write';
export const SEO_PROJECTION_REFRESH_QUEUE = 'seo-projection-refresh';

/**
 * Debounce coalescing du refresh worker : si N writes pendant 5s →
 * 1 seul refresh job effectivement exécuté (jobId déduplique).
 */
export const REFRESH_DEBOUNCE_MS = 5_000;

/**
 * Single-flight strict côté refresh worker.
 */
export const REFRESH_CONCURRENCY = 1;
