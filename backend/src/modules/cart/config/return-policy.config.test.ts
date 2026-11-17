/**
 * Politique de retour — la source unique porte la décision du 17/11/2026, et son
 * schéma refuse une valeur mal formée.
 */
import {
  RETURN_POLICY,
  ReturnPolicySchema,
  publicReturnPolicy,
} from './return-policy.config';

const valide = () => ({
  country: 'FR',
  returnWindowDays: 30,
  returnMethod: 'by_mail',
  returnFeesPaidBy: 'customer',
  returnFeesWaivedFor: ['item_defect', 'seller_error'],
  refundMethod: 'original_payment_method',
});

describe('Politique de retour — valeurs décidées', () => {
  it('30 jours après réception, retour à la charge du client sauf défaut ou erreur, remboursement par le moyen d’origine', () => {
    expect(RETURN_POLICY).toEqual(valide());
  });

  it('est figée', () => {
    expect(Object.isFrozen(RETURN_POLICY)).toBe(true);
  });

  it('le frontend reçoit la même règle, sur une copie', () => {
    const recue = publicReturnPolicy();
    expect(recue).toEqual(valide());
    recue.returnFeesWaivedFor.pop();
    expect(RETURN_POLICY.returnFeesWaivedFor).toHaveLength(2);
  });
});

describe('Politique de retour — schéma', () => {
  it.each([
    ['délai nul', { returnWindowDays: 0 }],
    ['délai non entier', { returnWindowDays: 30.5 }],
    ['autre pays', { country: 'BE' }],
    ['retour en magasin', { returnMethod: 'in_store' }],
    ['retour à la charge du vendeur', { returnFeesPaidBy: 'seller' }],
    ['aucune exception', { returnFeesWaivedFor: [] }],
    ['exception inconnue', { returnFeesWaivedFor: ['customer_remorse'] }],
    ['avoir au lieu du remboursement', { refundMethod: 'store_credit' }],
    ['clé en trop', { restockingFee: 5 }],
  ])('refuse : %s', (_cas, ecart) => {
    expect(
      ReturnPolicySchema.safeParse({ ...valide(), ...ecart }).success,
    ).toBe(false);
  });
});
