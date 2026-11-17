/**
 * Textes publics tirés de la politique de retour (mandat BJ, complément du
 * 18/11/2026) : FAQ du support et e-mail de bienvenue lisent la source unique ;
 * aucun ne présente le retour comme gratuit.
 */
import { RETURN_POLICY, returnFaqAnswer } from '..';

describe('Politique de retour — textes publics', () => {
  it('la réponse de FAQ porte le délai et les frais décidés, mot pour mot comme le frontend', () => {
    expect(returnFaqAnswer()).toBe(
      'Vous disposez de 30 jours après réception pour retourner une pièce, ' +
        "dans son emballage d'origine et non montée. " +
        'Frais de retour à votre charge, sauf pièce défectueuse ou erreur de notre part. ' +
        'Le remboursement est effectué par le moyen de paiement utilisé lors de la commande.',
    );
    expect(returnFaqAnswer()).toContain(
      `${RETURN_POLICY.returnWindowDays} jours`,
    );
    expect(returnFaqAnswer()).not.toMatch(/gratuit/i);
  });
});
