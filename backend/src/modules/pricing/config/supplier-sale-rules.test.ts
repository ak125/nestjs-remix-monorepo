import {
  SEUIL_GARDE_FOU_SORTIE,
  evaluerGardeFou,
  fraicheurActive,
} from './supplier-sale-rules';

describe('règles de sortie de vente (décision 51)', () => {
  it('seuil du garde-fou = 5 %', () => {
    expect(SEUIL_GARDE_FOU_SORTIE).toBe(0.05);
  });

  it('arrête strictement au-delà de 5 %, pas à 5 %', () => {
    expect(evaluerGardeFou(5, 100).arret).toBe(false);
    expect(evaluerGardeFou(6, 100).arret).toBe(true);
  });

  it('arrête un lot qui sort des pièces quand aucune n’est comptée vendable', () => {
    expect(evaluerGardeFou(1, 0)).toMatchObject({ part: 1, arret: true });
    expect(evaluerGardeFou(0, 0)).toMatchObject({ part: 0, arret: false });
  });

  it('fraîcheur : active seulement avec une date de première mise à jour complète', () => {
    const regles = {
      A: { premiereMajCompleteLe: '2026-12-01' },
      B: { premiereMajCompleteLe: null },
    };
    expect(fraicheurActive('A', regles)).toBe(true);
    expect(fraicheurActive('B', regles)).toBe(false);
    expect(fraicheurActive('C', regles)).toBe(false);
    expect(fraicheurActive(undefined, regles)).toBe(false);
  });
});
