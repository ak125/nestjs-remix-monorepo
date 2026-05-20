/**
 * Deterministic volume → tier bucketing for keyword sets, per role.
 *
 * Ported verbatim from the `/kw-classify` skill percentile rules so the
 * canonical TS pipeline produces the same HIGH/MED/LOW distribution the
 * downstream content-gen consumers already expect (HIGH = mandatory in
 * H1/H2, MED = body/FAQ, LOW = optional natural variants).
 *
 * Tiers (n = set size):
 *   - n >= 5     : HIGH = top 10% (min 1), MED = next 30%, LOW = remainder
 *   - 3 <= n < 5 : HIGH = top 1, rest = MED
 *   - n <= 2     : all = MED (too small to single out a HIGH)
 *
 * Pure: no DB, no canon. Sorts a copy by volume desc; ties keep input order.
 */
export type VolBucket = "HIGH" | "MED" | "LOW";

export interface VolInput {
  readonly kw: string;
  readonly volume: number;
}

export interface VolOutput extends VolInput {
  readonly vol: VolBucket;
}

export function assignVolumeBuckets(items: readonly VolInput[]): VolOutput[] {
  const n = items.length;
  if (n === 0) return [];

  // Stable sort by volume desc (preserve input order on ties).
  const ranked = items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => b.item.volume - a.item.volume || a.idx - b.idx);

  const highCut = n >= 5 ? Math.max(1, Math.floor(n * 0.1)) : n >= 3 ? 1 : 0;
  const medCut = n >= 5 ? highCut + Math.floor(n * 0.3) : n; // n<5 → everything after HIGH is MED

  return ranked.map(({ item }, rank) => {
    let vol: VolBucket;
    if (n <= 2) vol = "MED";
    else if (rank < highCut) vol = "HIGH";
    else if (rank < medCut) vol = "MED";
    else vol = "LOW";
    return { ...item, vol };
  });
}
