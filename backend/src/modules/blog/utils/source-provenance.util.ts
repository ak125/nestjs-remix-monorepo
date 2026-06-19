/**
 * Source-provenance humanizer — SINGLE source of truth for converting internal
 * provenance metadata (sgc_sources entries, sgpg_source_type/ref, sg_draft_source)
 * into user-facing E-E-A-T labels.
 *
 * Extracted from BlogSeoService (R3 conseil path) so R6 (guide d'achat) reuses the
 * SAME vocabulary instead of leaking the raw machine value (e.g. the literal "rag")
 * into the public "Sources et fiabilité" badge. The mapping below is byte-identical
 * to the former private BlogSeoService methods — do not diverge per role.
 *
 * Provenance tiers (canon, ADR-031/046): "rag"/"rag-legacy" = legacy RAG knowledge
 * doc; "web" = supplementary web ref; "wiki" = governed wiki projection (inert until
 * the wiki→projection writer produces wiki content). RAG is a chatbot consumer, never
 * a content source — these labels never expose "rag" to the public.
 */

/** Object-shaped source descriptor (sgc_sources JSON array entries, sgpg_source_*). */
export interface ProvenanceDescriptor {
  type?: string | null;
  ref?: string | null;
}

const isLegacyRag = (type?: string | null): boolean =>
  type === 'rag' || type === 'rag-legacy';

/** Convert internal source metadata into a user-facing label. */
export function humanizeProvenance(s: ProvenanceDescriptor): string {
  if (isLegacyRag(s.type) && s.ref?.startsWith('gammes/'))
    return 'Équipe technique AutoMecanik';
  if (isLegacyRag(s.type)) return 'Documentation technique';
  if (s.type === 'wiki') return 'Base de connaissances AutoMecanik';
  if (s.ref?.includes('OEM') || s.ref === 'OEM_manual')
    return 'Manuel constructeur';
  if (s.ref?.endsWith('.pdf')) return 'Documentation technique';
  return 'Source vérifiée';
}

/** Convert a raw string source ref into a user-facing label. */
export function humanizeProvenanceRef(ref: string): string {
  if (ref.startsWith('gammes/')) return 'Équipe technique AutoMecanik';
  if (ref.includes('OEM')) return 'Manuel constructeur';
  if (ref.endsWith('.pdf')) return 'Documentation technique';
  return ref;
}
