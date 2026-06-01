/**
 * Supplier Availability Truth — reference resolver (pure, Layer 3 input).
 *
 * Resolves a supplier's raw reference to the canonical `piece_id` (int) using the
 * SAME normalization as the catalogue and the EXISTING ref indexes — never invents
 * a key, never guesses. Ambiguous (>1 match) or no match ⇒ the observation is
 * excluded from the projection (and emits `supplier.ref.unresolved`).
 *
 * The index lookup is injected (a thin repo query over `pieces_ref_search` /
 * `pieces_ref_oem`) so this stays pure and unit-testable without a DB.
 */

/**
 * Mirrors `OemPlatformMappingService.normalizeOemRef`
 * (catalog/services/oem-platform-mapping.service.ts:85-91): trim, uppercase,
 * strip spaces and dashes. Kept as a local pure copy because the original is an
 * instance method on a Supabase-coupled service; parity is asserted in tests.
 */
export function normalizeRef(ref: string): string {
  return ref.trim().toUpperCase().replace(/[\s-]/g, '');
}

export type RefReason = 'OK' | 'AMBIGUOUS' | 'UNRESOLVED';

export interface ResolveResult {
  pieceId: number | null;
  reason: RefReason;
  normalizedRef: string;
}

/** Returns the distinct piece_ids matching a normalized reference. */
export type RefIndexLookup = (normalizedRef: string) => Promise<number[]>;

export async function resolvePieceId(
  rawRef: string,
  lookup: RefIndexLookup,
): Promise<ResolveResult> {
  const normalizedRef = normalizeRef(rawRef);
  if (!normalizedRef) {
    return { pieceId: null, reason: 'UNRESOLVED', normalizedRef };
  }
  const ids = [...new Set(await lookup(normalizedRef))];
  if (ids.length === 0) {
    return { pieceId: null, reason: 'UNRESOLVED', normalizedRef };
  }
  if (ids.length > 1) {
    return { pieceId: null, reason: 'AMBIGUOUS', normalizedRef };
  }
  return { pieceId: ids[0], reason: 'OK', normalizedRef };
}
