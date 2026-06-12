/**
 * Canonical normalization of a supplier reference.
 *
 * Supplier references arrive in inconsistent formats across suppliers/files
 * (case, spaces, hyphens, dots, accents). Without normalization the matching
 * step produces false-unmatched. This canonicalizes to a comparable key.
 *
 * Steps: unicode NFKD + strip diacritics → uppercase → strip all whitespace and
 * common separators (`- . / _`) → optional alias remap.
 *
 * Pure function, no I/O.
 */

const SEPARATORS = /[\s\-._/\\]+/g;
// Combining diacritical marks (U+0300–U+036F), left over after NFKD decomposition.
const DIACRITICS = /[̀-ͯ]/g;

/**
 * @param ref      Raw supplier reference (any format).
 * @param aliasMap Optional canonical alias map, applied AFTER normalization
 *                 (keys must already be normalized).
 * @returns Normalized reference, or '' for nullish/empty input.
 */
export function normalizeSupplierReference(
  ref: string | null | undefined,
  aliasMap?: Readonly<Record<string, string>>,
): string {
  if (ref == null) return '';
  const normalized = ref
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toUpperCase()
    .replace(SEPARATORS, '')
    .trim();
  if (aliasMap && normalized in aliasMap) return aliasMap[normalized];
  return normalized;
}
