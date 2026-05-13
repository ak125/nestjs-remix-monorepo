/**
 * ADR-059 Phase B PR-7b — Remix client lecture projection runtime SEO.
 *
 * **Verrou architectural critique (ADR-059 §"No Direct Page SQL")** :
 * Ce client est la SEULE surface autorisée pour lecture projection depuis
 * les loaders Remix. AUCUN loader ne doit faire de SELECT direct sur
 * `__seo_entity_*`, `__seo_projection_*` ou `mv_seo_*` (depcruise + ast-grep
 * guards enforce statiquement).
 *
 * Garde-fous runtime :
 *  - Fetch HTTP vers backend NestJS (timeout strict 2s par défaut)
 *  - Fallback deterministic : si fetch fail OU status !== 'success',
 *    retourne `null` → caller doit utiliser le legacy path
 *  - JAMAIS de throw : le caller ne doit JAMAIS rester bloqué
 *  - Zod validate côté Remix (defense en profondeur : backend déjà valide)
 *  - Shadow drift logging (advisory) côté caller
 *
 * Aucune dépendance LLM, aucune dépendance Supabase JS direct côté frontend.
 */
import { z } from 'zod';


// ────────────────────────────────────────────────────────────────────────────
// Zod schemas (mirror du backend ProjectionPayloadSchema)
// ────────────────────────────────────────────────────────────────────────────

const EntityIdSchema = z
  .string()
  .regex(/^(gamme|vehicle|constructeur|diagnostic):[a-z0-9][a-z0-9-]*[a-z0-9]$/);

const BlockSchema = z
  .object({
    role: z.string(),
    section: z.string().nullable(),
    content_md: z.string(),
    content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

const SourceSchema = z
  .object({
    id: z.string().nullable(),
    type: z.string().nullable(),
    confidence_base: z.number().min(0).max(1).nullable(),
    url: z.string().nullable(),
  })
  .strict();

export const ProjectionPayloadSchema = z
  .object({
    entity_id: EntityIdSchema,
    entity_type: z.enum(['gamme', 'vehicle', 'constructeur', 'diagnostic']),
    slug: z.string(),
    projection_contract_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    facts: z.record(z.string(), z.unknown()),
    blocks: z.array(BlockSchema),
    sources: z.array(SourceSchema),
    fetched_at: z.string(),
  })
  .strict();

export type ProjectionPayload = z.infer<typeof ProjectionPayloadSchema>;

const BackendResponseSchema = z
  .object({
    status: z.enum(['success', 'empty', 'rpc_failed', 'validation_failed']),
    payload: ProjectionPayloadSchema.nullable(),
    error: z.string().nullable(),
  })
  .strict();


// ────────────────────────────────────────────────────────────────────────────
// Client
// ────────────────────────────────────────────────────────────────────────────

export interface FetchProjectionOptions {
  /** Optional role filter (e.g. 'R3_CONSEILS'). */
  role?: string | null;
  /** Backend base URL (default: process.env.API_URL or http://localhost:3000). */
  apiBaseUrl?: string;
  /** Fetch timeout ms (default 2000). */
  timeoutMs?: number;
  /** Optional pre-configured fetch impl for tests / SSR injection. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_API_BASE_URL =
  typeof process !== 'undefined' && process.env.API_URL
    ? process.env.API_URL
    : 'http://localhost:3000';


/**
 * Récupère la projection active depuis le backend.
 *
 * Contract :
 *  - Returns `ProjectionPayload` si projection trouvée et payload valide
 *  - Returns `null` dans TOUS les autres cas (empty / rpc_failed /
 *    validation_failed / fetch error / timeout)
 *  - JAMAIS de throw : caller utilise le fallback legacy si null
 *
 * Le caller DOIT logguer (`logShadowDrift`) la différence projection vs
 * legacy en shadow mode si applicable.
 */
export async function fetchActiveProjection(
  entityId: string,
  options: FetchProjectionOptions = {},
): Promise<ProjectionPayload | null> {
  const idCheck = EntityIdSchema.safeParse(entityId);
  if (!idCheck.success) {
    // Defense en profondeur : entity_id mal formé côté caller → null safe
    return null;
  }

  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  const url = new URL(
    `${apiBaseUrl.replace(/\/$/, '')}/api/seo-projection/${encodeURIComponent(entityId)}`,
  );
  if (options.role) {
    url.searchParams.set('role', options.role);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 4xx/5xx → fallback legacy
      return null;
    }
    const body = await res.json();
    const parsed = BackendResponseSchema.safeParse(body);
    if (!parsed.success) {
      return null;
    }
    if (parsed.data.status !== 'success' || !parsed.data.payload) {
      return null;
    }
    return parsed.data.payload;
  } catch {
    // Network / timeout / abort → fallback legacy
    return null;
  } finally {
    clearTimeout(timeout);
  }
}


// ────────────────────────────────────────────────────────────────────────────
// Shadow drift logging (advisory)
// ────────────────────────────────────────────────────────────────────────────

export interface ShadowDriftLog {
  entity_id: string;
  has_projection: boolean;
  has_legacy: boolean;
  projection_content_hash: string | null;
  legacy_content_hash: string | null;
  ts: string;
}

/**
 * Logger advisory pour comparer projection vs legacy en shadow mode.
 *
 * Émet une ligne JSON sur stdout (capté par journald en SSR Remix). Pas
 * d'écriture DB, pas de blocage runtime. Le caller appelle ce helper après
 * fetchActiveProjection() + lecture legacy en parallèle.
 */
export function logShadowDrift(
  entityId: string,
  projection: { content_hash: string | null } | null,
  legacy: { content_hash: string | null } | null,
): void {
  const log: ShadowDriftLog = {
    entity_id: entityId,
    has_projection: projection != null,
    has_legacy: legacy != null,
    projection_content_hash: projection?.content_hash ?? null,
    legacy_content_hash: legacy?.content_hash ?? null,
    ts: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: 'seo_projection_shadow_drift', ...log }));
}
