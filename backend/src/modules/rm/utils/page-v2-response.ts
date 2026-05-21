export type PageV2Outcome = 'ok' | 'empty' | 'error';

/**
 * Decide HTTP semantics for an rm_get_page_complete_v2 result.
 *
 * The data layer distinguishes a genuine RPC/infra failure (sets `result.error`)
 * from a valid request that simply has no products (`success:false`, no `error`).
 * The controller maps:
 *   - 'ok'    → 200 (data present)
 *   - 'empty' → 200 with the empty payload; the Remix loader renders a soft-404
 *               (200 + noindex + alternatives) instead of a hard error.
 *   - 'error' → 503 so crawlers retry, never a false 404/500 on real failures.
 */
export function classifyPageV2Result(result: {
  success?: boolean;
  error?: unknown;
}): PageV2Outcome {
  if (result.success) return 'ok';
  return result.error ? 'error' : 'empty';
}
