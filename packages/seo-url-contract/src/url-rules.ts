/**
 * SEO URL structural contract — single source of truth (ADR-062 anti-parallel-truths).
 *
 * Shared by frontend (Vitest), backend (Jest), and sitemap generation. These rules
 * define what a well-formed SEO URL segment looks like; they MUST NOT be duplicated
 * elsewhere — import from this package instead.
 */

// Combining diacritical marks range (NFD-decomposed accents).
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Slugify an alias for use in a URL: lowercase, strip accents, keep [a-z0-9-],
 * collapse whitespace/dashes. Returns '' for falsy input.
 */
export function normalizeAlias(alias: string | null | undefined): string {
  if (!alias) return "";
  return alias
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

/**
 * Resolve a safe type alias for URL composition. Falls back to a slugified
 * `typeName` when the raw alias is missing, the literal "null"/"type", or equal
 * to the `type_id` (which would otherwise produce e.g. "28495-28495.html").
 */
export function normalizeTypeAlias(
  alias: string | null | undefined,
  typeName: string | null | undefined,
  typeId?: number | string | null,
): string {
  const idStr = typeId != null ? String(typeId) : null;
  const needsFallback =
    !alias ||
    alias.trim() === "" ||
    alias === "null" ||
    alias === "type" ||
    (idStr !== null && alias === idStr);
  if (needsFallback) {
    return typeName && typeName.trim() !== ""
      ? normalizeAlias(typeName)
      : "type";
  }
  return alias;
}

/**
 * Structural malformed-segment detector. Flags structural defects of a single
 * `{alias}-{id}` URL segment — never arbitrary substrings, so valid slugs like
 * "nullpunkt-123", "x-type-99", "type-c-50" pass. Returns a reason or null.
 */
export function detectMalformedSegment(seg: string): string | null {
  if (!seg) return "empty_segment";
  if (seg.includes(" ") || seg.includes("%20")) return "spaces_in_url";
  if (/^-\d/.test(seg)) return "missing_alias";
  // alias token literally "null" — covers "null-55453" AND "null-55453-55453"
  if (/^null(-|$)/i.test(seg)) return "null_in_url";
  if (/^type-\d+$/.test(seg)) return "type_prefix_fallback";
  const repeated = seg.match(/^(\d+)-(\d+)$/);
  if (repeated && repeated[1] === repeated[2]) return "repeated_id";
  const parts = seg.split("-");
  if (
    parts.length >= 3 &&
    parts.every((p) => /^\d+$/.test(p)) &&
    new Set(parts).size === 1
  ) {
    return "repeated_id_multi";
  }
  // accented characters that should have been slugified
  try {
    const decoded = decodeURIComponent(seg);
    if (
      decoded.normalize("NFD").replace(COMBINING_DIACRITICS, "") !== decoded
    ) {
      return "accented_chars";
    }
  } catch {
    // malformed %-encoding — not our concern here
  }
  return null;
}

/**
 * Full-URL guard: checks every path segment, returns the first malformed reason
 * or null. Used by the sitemap generator as defense-in-depth before publishing.
 */
export function isMalformedSeoUrl(url: string): string | null {
  if (!url) return "empty_url";
  const path = url.split("?")[0].replace(/\.html$/i, "");
  for (const seg of path.split("/").filter(Boolean)) {
    const reason = detectMalformedSegment(seg);
    if (reason) return reason;
  }
  return null;
}
