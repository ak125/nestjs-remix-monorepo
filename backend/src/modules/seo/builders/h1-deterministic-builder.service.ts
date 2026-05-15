/**
 * PR-C — H1 Deterministic Builder
 *
 * Canonical service that builds H1 strings from typed inputs WITHOUT any LLM
 * call. Referenced by `.spec/00-canon/repository-registry/seo-field-authority.yaml`
 * (PR-B #535) as the authoritative `deterministic_builder` for the `h1` field.
 *
 * The actual templates remain co-located with their role :
 *   - R7 brand template lives in `r7-brand-enricher.service.ts` (line ~182)
 *   - R8 vehicle template lives in `r8-keyword-plan.constants.ts:buildR8H1`
 *   - R1 / R6 fallbacks are simple gamme-name patterns
 *
 * This service unifies them behind a single typed API. Refactors of the R7/R8
 * enrichers (PR-C+1, hors scope PR-C strict) can delegate to this builder
 * instead of duplicating template strings.
 *
 * PR-C scope = service exists (validator --strict requires it) + minimal API.
 * Wider integration is follow-up.
 */

import { Injectable } from '@nestjs/common';
import { buildR8H1 } from '../../../config/r8-keyword-plan.constants';

export type H1Role =
  | 'R1_ROUTER'
  | 'R3_CONSEILS'
  | 'R6_GUIDE_ACHAT'
  | 'R7_BRAND'
  | 'R8_VEHICLE';

export interface H1BuildInputR1 {
  role: 'R1_ROUTER';
  gammeLabel: string;
}
export interface H1BuildInputR3 {
  role: 'R3_CONSEILS';
  gammeLabel: string;
}
export interface H1BuildInputR6 {
  role: 'R6_GUIDE_ACHAT';
  gammeLabel: string;
}
export interface H1BuildInputR7 {
  role: 'R7_BRAND';
  brandName: string;
}
export interface H1BuildInputR8 {
  role: 'R8_VEHICLE';
  brand: string;
  model: string;
  type: string;
  powerPs: string | number;
  yearFrom: string | number;
  yearTo?: string | number | null;
}

export type H1BuildInput =
  | H1BuildInputR1
  | H1BuildInputR3
  | H1BuildInputR6
  | H1BuildInputR7
  | H1BuildInputR8;

@Injectable()
export class H1DeterministicBuilderService {
  /**
   * Build an H1 string from typed input. Deterministic, no I/O, no LLM, pure
   * function. Same input → same output.
   */
  build(input: H1BuildInput): string {
    switch (input.role) {
      case 'R1_ROUTER':
        return `${input.gammeLabel} — trouvez la référence compatible avec votre véhicule`;
      case 'R3_CONSEILS':
        return `${input.gammeLabel} — conseils, montage et entretien`;
      case 'R6_GUIDE_ACHAT':
        return `${input.gammeLabel} — guide d'achat et compatibilité`;
      case 'R7_BRAND':
        return `Catalogue pièces auto ${input.brandName}`;
      case 'R8_VEHICLE':
        return buildR8H1(input);
    }
  }

  /** Pure-function helper for callers that already have the components. */
  static buildR1(gammeLabel: string): string {
    return `${gammeLabel} — trouvez la référence compatible avec votre véhicule`;
  }
}
