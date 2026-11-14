/**
 * Provenance-tier vocabulary — single source of truth for the source.type /
 * sgpg_source_type value WRITTEN by content enrichers, and rendered by the
 * provenance humanizer (modules/blog/utils/source-provenance.util.ts).
 *
 * Canon (ADR-031/046): RAG is a chatbot retrieval consumer, NEVER a content
 * source. `rag-legacy` explicitly marks editorial still derived from the
 * decommissioned RAG knowledge docs — the bare historical `rag` value predates
 * this tiering. `wiki` is the governed TARGET tier (inert until the
 * wiki→projection writer actually produces wiki content). Migration progress is
 * observable as the share of rows leaving `rag-legacy` for `wiki`.
 */
export const SOURCE_TIER = {
  /** Editorial parsed from the legacy RAG knowledge doc (decommissioned source). */
  RAG_LEGACY: 'rag-legacy',
  /** Supplementary public web reference. */
  WEB: 'web',
  /** Governed wiki projection (target tier — inert until wiki content exists). */
  WIKI: 'wiki',
  /** Manually authored / route fallback. */
  MANUAL: 'manual',
  /** Owned, gatekept DB tables (e.g. R8 loadGammeEditorial). */
  DB: 'db',
} as const;

export type SourceTier = (typeof SOURCE_TIER)[keyof typeof SOURCE_TIER];

/**
 * True for legacy-RAG-sourced provenance — matches BOTH the historical bare
 * `rag` value (rows written before tiering) AND the explicit `rag-legacy`.
 * Use this everywhere instead of comparing the literal, so older rows and newly
 * stamped rows are treated identically.
 */
export function isLegacyRagTier(tier?: string | null): boolean {
  return tier === 'rag' || tier === SOURCE_TIER.RAG_LEGACY;
}

/**
 * True when a row's "verified" mark was granted by its own producer rather
 * than by a reviewer: legacy-RAG provenance, or a verifier recorded as a
 * `pipeline:*` producer. Such a mark keeps its role for serving decisions but
 * must not be reported, or shown, as a verification (ADR-031/046).
 */
export function isSelfGrantedVerification(p: {
  tier?: string | null;
  verifiedBy?: string | null;
}): boolean {
  return (
    isLegacyRagTier(p.tier?.trim().toLowerCase()) ||
    (p.verifiedBy ?? '').trim().toLowerCase().startsWith('pipeline:')
  );
}
