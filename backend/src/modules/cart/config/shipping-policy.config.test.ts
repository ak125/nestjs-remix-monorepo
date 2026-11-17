/**
 * Politique de port — la source unique porte la décision, et son schéma refuse
 * une valeur mal formée (c'est la vérification « par schéma en CI » du réglage).
 */
import {
  SHIPPING_POLICY,
  ShippingPolicySchema,
  freeShippingWording,
  metropolitanShippingFeeTTC,
  publicShippingPolicy,
} from './shipping-policy.config';

const valide = () => ({
  france: { mode: 'flat', flatFeeTTC: 9.9, freeFromSubtotalTTC: 100 },
  corse: {
    mode: 'weight_grid',
    freeFromSubtotalTTC: 150,
    gridUnavailableFeeTTC: 15.9,
  },
  domtom1: {
    mode: 'weight_grid',
    freeFromSubtotalTTC: 150,
    gridUnavailableFeeTTC: 15.9,
  },
  domtom2: {
    mode: 'weight_grid',
    freeFromSubtotalTTC: 150,
    gridUnavailableFeeTTC: 15.9,
  },
});

describe('Politique de port — valeurs décidées', () => {
  it('France métropolitaine : forfait 9,90 € TTC, port offert dès 100 € TTC', () => {
    expect(SHIPPING_POLICY.france).toEqual({
      mode: 'flat',
      flatFeeTTC: 9.9,
      freeFromSubtotalTTC: 100,
    });
  });

  it('Corse et DOM-TOM : grille au poids, valeurs d’avant le mandat BJ', () => {
    for (const zone of ['corse', 'domtom1', 'domtom2'] as const) {
      expect(SHIPPING_POLICY[zone]).toEqual({
        mode: 'weight_grid',
        freeFromSubtotalTTC: 150,
        gridUnavailableFeeTTC: 15.9,
      });
    }
  });

  it('la politique chargée est celle que le schéma accepte, et elle est figée', () => {
    expect(ShippingPolicySchema.parse(valide())).toEqual(SHIPPING_POLICY);
    expect(Object.isFrozen(SHIPPING_POLICY)).toBe(true);
  });
});

describe('Politique de port — port de la France métropolitaine', () => {
  it.each([
    [0.01, 9.9],
    [54.38, 9.9],
    [99.99, 9.9],
    [100, 0],
    [100.01, 0],
    [149.99, 0],
    [1500, 0],
  ])('sous-total %p € → port %p €', (sousTotal, port) => {
    expect(metropolitanShippingFeeTTC(sousTotal)).toBe(port);
  });
});

describe('Politique de port — ce qui sort vers le frontend et les textes', () => {
  it('le frontend reçoit le forfait et le seuil de la métropole, rien d’autre', () => {
    expect(publicShippingPolicy()).toEqual({
      flatFeeTTC: 9.9,
      freeShippingThresholdTTC: 100,
    });
  });

  it('formulation exacte de la promesse', () => {
    expect(freeShippingWording()).toBe('Livraison gratuite dès 100€');
  });
});

describe('Politique de port — le schéma refuse un réglage mal formé', () => {
  const refuse = (modifier: (p: ReturnType<typeof valide>) => unknown) =>
    expect(ShippingPolicySchema.safeParse(modifier(valide())).success).toBe(
      false,
    );

  it('forfait nul ou négatif', () => {
    refuse((p) => ({ ...p, france: { ...p.france, flatFeeTTC: 0 } }));
    refuse((p) => ({ ...p, france: { ...p.france, flatFeeTTC: -9.9 } }));
  });

  it('montant au-delà du centime', () => {
    refuse((p) => ({ ...p, france: { ...p.france, flatFeeTTC: 9.905 } }));
  });

  it('montant écrit en texte', () => {
    refuse((p) => ({ ...p, france: { ...p.france, flatFeeTTC: '9.90' } }));
  });

  it('forfait supérieur ou égal au seuil de gratuité', () => {
    refuse((p) => ({ ...p, france: { ...p.france, flatFeeTTC: 100 } }));
  });

  it('zone manquante, zone inconnue ou clé inconnue', () => {
    refuse(({ corse: _corse, ...reste }) => reste);
    refuse((p) => ({ ...p, belgique: p.france }));
    refuse((p) => ({ ...p, france: { ...p.france, relais: 4.9 } }));
  });

  it('mode qui n’est pas celui de la zone', () => {
    refuse((p) => ({ ...p, france: p.corse }));
    refuse((p) => ({ ...p, corse: p.france }));
  });
});
