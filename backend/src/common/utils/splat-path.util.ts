/**
 * Joins a path-to-regexp v8 wildcard parameter (`{*path}`) into a single path
 * string, WITHOUT decoding.
 *
 * Express 5 / path-to-regexp v8 expose a named wildcard (`{*path}`) as the
 * matched path segments in an ALREADY-DECODED `string[]` — the router has
 * `decodeURIComponent`'d each segment exactly once. This helper simply joins
 * them with `/`.
 *
 * It deliberately NEVER calls `decodeURIComponent`: re-decoding here would
 * double-decode (e.g. turn `a%252Fb` → `a/b` instead of `a%2Fb`) — the CWE-174
 * anti-pattern the v6→v8 migration removes. The legacy
 * `@Param('path') + decodeURIComponent(...)` idiom double-decoded because
 * Express had already decoded the captured param once.
 *
 * Returns `''` for an absent / empty splat (a root match). Callers that need a
 * leading slash add it themselves (`path ? '/' + path : '/'`), preserving each
 * endpoint's existing path convention.
 *
 * Defensive: also accepts a plain string. Under the legacy v6 `:path(.*)`
 * syntax `request.params.path` is a single (already once-decoded) string;
 * passing it through unchanged keeps `@SplatPath()` correct on BOTH route
 * syntaxes during the atomic migration window.
 */
export function splatToPath(
  splat: readonly string[] | string | undefined | null,
): string {
  if (splat == null) return '';
  if (Array.isArray(splat)) return splat.join('/');
  return splat as string;
}
