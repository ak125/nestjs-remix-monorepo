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
  siteTrustClaims,
  type TrustClaim,
} from '~/components/pieces/hero/site-trust-claims';
import { type ReturnPolicyResult } from '~/utils/remix-application-port';

const SERVED: ReturnPolicyResult = {
  country: 'FR',
  returnWindowDays: 30,
  returnMethod: 'by_mail',
  returnFeesPaidBy: 'customer',
  returnFeesWaivedFor: ['item_defect', 'seller_error'],
  refundMethod: 'original_payment_method',
};
const SITE_TRUST_CLAIMS = siteTrustClaims(SERVED);

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

describe('siteTrustClaims — délai de retour servi (mandat BJ)', () => {
  it('écrit le délai de la politique servie, sans promesse de gratuité', () => {
    const returns = siteTrustClaims(SERVED).find((c) => c.id === 'returns');
    expect(returns?.label).toBe('Retours 30 jours');
    expect(returns?.label).not.toMatch(/gratuit/i);
    expect(
      siteTrustClaims({ ...SERVED, returnWindowDays: 45 }).find(
        (c) => c.id === 'returns',
      )?.label,
    ).toBe('Retours 45 jours');
  });

  it('omet la garantie « retours » quand la politique est inconnue', () => {
    expect(siteTrustClaims(null).map((c) => c.id)).toEqual([
      'shipping',
      'payment',
    ]);
  });
});
