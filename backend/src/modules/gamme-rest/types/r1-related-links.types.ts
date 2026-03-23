/**
 * R1 Related Links — contrat pour le maillage contextuel R1.
 *
 * Le backend construit des blocs qualifiés (scorés, filtrés, groupés).
 * Le frontend les consomme sans arbitrage.
 */

export type R1RelatedBlockKind =
  | 'avoid-confusion'
  | 'buying-guide'
  | 'understand-maintain'
  | 'compatible-parts';

export interface R1RelatedLink {
  kind: R1RelatedBlockKind;
  title: string;
  href: string;
  reason: string;
  score: number;
}

export interface R1RelatedBlock {
  kind: R1RelatedBlockKind;
  heading: string;
  items: R1RelatedLink[];
}

export interface R1RelatedBlocksPayload {
  blocks: R1RelatedBlock[];
}

/** Constantes de rendu */
export const MAX_BLOCKS = 3;
export const MAX_LINKS_PER_BLOCK = 3;
