export type PageV2Outcome = 'ok' | 'empty' | 'not_found' | 'error';

/**
 * Stable RPC error codes that mean the vehicle/gamme deterministically does not exist —
 * a permanent state, not a transient failure. These map to 404, never 503.
 */
const NOT_FOUND_CODES = new Set(['VEHICLE_NOT_FOUND', 'GAMME_NOT_FOUND']);

/**
 * Decide HTTP semantics for an rm_get_page_complete_v2 result.
 *
 * The data layer distinguishes a genuine RPC/infra failure (sets `result.error`)
 * from a valid request that simply has no products (`success:false`, no `error`).
 * The controller maps:
 *   - 'ok'        → 200 (data present)
 *   - 'empty'     → 200 with the empty payload; the Remix loader renders a soft-404
 *                   (200 + noindex + alternatives) instead of a hard error.
 *   - 'not_found' → 404: the vehicle/gamme deterministically does not exist. A permanent
 *                   condition, so never 503 (which would make crawlers retry a 5xx forever).
 *   - 'error'     → 503 so crawlers retry, never a false 404/500 on real (transient) failures.
 */
export function classifyPageV2Result(result: {
  success?: boolean;
  error?: unknown;
}): PageV2Outcome {
  if (result.success) return 'ok';
  if (!result.error) return 'empty';

  const code =
    typeof result.error === 'object' && result.error !== null
      ? (result.error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string' && NOT_FOUND_CODES.has(code)) {
    return 'not_found';
  }
  return 'error';
}
