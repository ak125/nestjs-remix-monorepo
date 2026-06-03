/**
 * Tests — `frontend/app/components/pieces/hero/site-trust-claims.ts`.
 *
 * SoT des 3 garanties commerciales/légales affichées dans le hero R2.
 * Co-locée avec son seul consommateur (`PiecesHeroMetaStrip`).
 * Tout ajout / suppression / modification de claim modifie ces tests
 * (anti-régression marketing silencieux).
 */

import { describe, expect, it } from 'vitest';

import {
  SITE_TRUST_CLAIMS,
  type TrustClaim,
} from '~/components/pieces/hero/site-trust-claims';

describe('SITE_TRUST_CLAIMS — SoT contract', () => {
  it('contient exactement 3 entries (anti-drift marketing)', () => {
    expect(SITE_TRUST_CLAIMS).toHaveLength(3);
  });

  it('ids canon : shipping / returns / payment (ordre figé)', () => {
    expect(SITE_TRUST_CLAIMS.map((c) => c.id)).toEqual([
      'shipping',
      'returns',
      'payment',
    ]);
  });

  it.each<keyof TrustClaim>(['id', 'icon', 'label', 'source'])(
    'chaque claim a un champ %s défini',
    (field) => {
      for (const claim of SITE_TRUST_CLAIMS) {
        expect(claim[field]).toBeDefined();
      }
    },
  );

  it('labels non vides (sinon affichage cassé sans tomber)', () => {
    for (const claim of SITE_TRUST_CLAIMS) {
      expect(claim.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('source non vide (chaque claim a un audit trail)', () => {
    for (const claim of SITE_TRUST_CLAIMS) {
      expect(claim.source.trim().length).toBeGreaterThan(0);
    }
  });

  it('icon est un composant React valide (fonction Lucide)', () => {
    for (const claim of SITE_TRUST_CLAIMS) {
      expect(typeof claim.icon).toBe('object'); // forwardRef
    }
  });
});
