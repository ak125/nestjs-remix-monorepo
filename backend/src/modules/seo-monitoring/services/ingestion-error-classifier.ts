/**
 * Classification des erreurs d'ingestion GSC / GA4 / Supabase — fonction PURE.
 *
 * Remplace les heuristiques par message dupliquées dans les deux fetchers.
 * Ordre : erreur DB typée → statut HTTP (Gaxios) → code gRPC (GA4) → code
 * système → message (dernier recours). Les classes « systémiques » arrêtent le
 * run (inutile d'enchaîner les jours sur un quota épuisé ou un schéma absent) ;
 * les autres n'invalident que le jour concerné, repris au run suivant.
 */
import type { RunFailContext } from './seo-monitoring-runs.service';

export type IngestionErrorClass = RunFailContext['errorClass'];

/** Erreur d'écriture/lecture Supabase portant le code PostgREST/Postgres. */
export class IngestionDbError extends Error {
  constructor(
    readonly table: string,
    readonly code: string | undefined,
    message: string,
  ) {
    super(`${table}: ${message}`);
    this.name = 'IngestionDbError';
  }
}

/** Réponse API hors contrat Zod (dérive de schéma côté Google). */
export class IngestionSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionSchemaError';
  }
}

const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'dailyLimitExceeded',
]);
const SCHEMA_DRIFT_DB_CODES = new Set([
  '42P01',
  '42703',
  'PGRST204',
  'PGRST205',
]);
const NETWORK_SYSTEM_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
]);

/** Forme minimale des erreurs Gaxios / google-gax lue par la classification. */
interface ErrorLike {
  status?: unknown;
  code?: unknown;
  errors?: unknown;
  response?: { status?: unknown; data?: { error?: { errors?: unknown } } };
}

function readHttpStatus(err: ErrorLike): number | null {
  const candidates = [err.status, err.response?.status];
  for (const c of candidates) {
    if (typeof c === 'number' && c >= 100 && c < 600) return c;
  }
  return null;
}

function readReasons(err: ErrorLike): string[] {
  const lists = [err.errors, err.response?.data?.error?.errors];
  const out: string[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const e of list as Array<{ reason?: unknown }>) {
      if (typeof e?.reason === 'string') out.push(e.reason);
    }
  }
  return out;
}

export function classifyIngestionError(err: unknown): IngestionErrorClass {
  if (err instanceof IngestionSchemaError) return 'schema_drift';
  if (err instanceof IngestionDbError) {
    const code = err.code ?? '';
    if (SCHEMA_DRIFT_DB_CODES.has(code)) return 'schema_drift';
    if (code === '23514' && /partition/i.test(err.message))
      return 'schema_drift';
    if (code.startsWith('23')) return 'db_constraint';
  }

  const e: ErrorLike = err && typeof err === 'object' ? err : {};
  const status = readHttpStatus(e);
  if (status !== null) {
    if (status === 429) return 'quota_exceeded';
    if (status === 403 && readReasons(e).some((r) => QUOTA_REASONS.has(r))) {
      return 'quota_exceeded';
    }
    if (status === 401 || status === 403) return 'auth_failure';
    if (status >= 500) return 'network';
  }

  if (typeof e.code === 'number' && status === null) {
    // Codes gRPC (google-gax, client GA4 Data API).
    if (e.code === 8) return 'quota_exceeded';
    if (e.code === 7 || e.code === 16) return 'auth_failure';
    if (e.code === 14 || e.code === 4) return 'network';
  }
  if (typeof e.code === 'string' && NETWORK_SYSTEM_CODES.has(e.code)) {
    return 'network';
  }

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('quota') || msg.includes('rate limit'))
    return 'quota_exceeded';
  if (
    msg.includes('unauth') ||
    msg.includes('forbidden') ||
    msg.includes('permission_denied') ||
    msg.includes('invalid_grant')
  ) {
    return 'auth_failure';
  }
  if (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket')
  ) {
    return 'network';
  }
  return 'unknown';
}

/** Classes qui arrêtent le run : les jours suivants échoueraient pareil. */
export function isSystemicIngestionError(cls: IngestionErrorClass): boolean {
  return (
    cls === 'quota_exceeded' || cls === 'auth_failure' || cls === 'schema_drift'
  );
}
