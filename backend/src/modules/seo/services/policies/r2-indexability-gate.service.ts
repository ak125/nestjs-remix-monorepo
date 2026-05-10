import { Injectable } from '@nestjs/common';
import {
  evaluateR2Indexability,
  type R2IndexabilityConditions,
  type R2IndexabilityVerdict,
} from '@repo/seo-role-contracts';

/**
 * Gate strict R2 fiche produit. 7 conditions cumulatives.
 * Default legacy = noindex,nofollow (cf. v7.products.fiche.php).
 *
 * Wrapper Injectable de `evaluateR2Indexability` (pure function du package
 * `@repo/seo-role-contracts`), pour permettre l'injection dans les services
 * NestJS et faciliter les mocks dans les tests.
 *
 * @see seo-r2-indexability-rule.md (mémoire)
 * @see plan v9 section 3.6
 */
@Injectable()
export class R2IndexabilityGate {
  evaluate(conditions: R2IndexabilityConditions): R2IndexabilityVerdict {
    return evaluateR2Indexability(conditions);
  }

  /** Helper : indexable seulement si verdict.indexable === true. */
  isIndexable(conditions: R2IndexabilityConditions): boolean {
    return this.evaluate(conditions).indexable;
  }
}
