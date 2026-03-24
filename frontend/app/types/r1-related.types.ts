/**
 * Types R1 Related Resources — contrat frontend pour le maillage contextuel.
 *
 * Miroir du backend backend/src/modules/gamme-rest/types/r1-related-links.types.ts
 *
 * Utilisé par :
 * - gamme-api.service.ts (GammeApiResponse)
 * - pieces.$slug.tsx (PiecesPageSyncData)
 * - admin.r1-qa.tsx (QA detail)
 */

export interface R1RelatedLink {
  kind: string;
  title: string;
  href: string;
  reason: string;
  score: number;
}

export interface R1RelatedBlock {
  kind: string;
  heading: string;
  items: R1RelatedLink[];
}

export interface R1RelatedBlocksPayload {
  blocks: R1RelatedBlock[];
}
