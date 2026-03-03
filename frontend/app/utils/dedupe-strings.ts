/**
 * Normalize + dedupe a string array.
 * Trims whitespace, lowercases for comparison, preserves original casing of first occurrence.
 */
export function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
