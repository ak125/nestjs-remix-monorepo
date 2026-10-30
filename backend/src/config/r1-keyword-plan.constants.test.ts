import { R1_ROUTER_CONTRACT } from '@repo/seo-role-contracts';
import {
  R1_S4_MICRO_SEO_BOUNDS,
  R1_SECTION_CONFIG,
} from './r1-keyword-plan.constants';

/**
 * Bornes du micro-SEO R1 : le contrat de rôle est la seule source.
 * Avant ce test, la constante locale valait 700 alors que le contrat exige
 * 1 500 à 3 000 caractères (FH-4 du dossier filtre à huile).
 */
describe('R1_S4_MICRO_SEO — bornes alignées sur le contrat R1', () => {
  const contractSection = R1_ROUTER_CONTRACT.allowed_sections.find(
    (s) => s.id === 'R1_S4_MICRO_SEO',
  );

  it('le contrat déclare la section', () => {
    expect(contractSection).toBeDefined();
  });

  it('la configuration du plan de mots-clés reprend le minimum du contrat', () => {
    expect(R1_SECTION_CONFIG.R1_S4_MICRO_SEO.min_chars).toBe(
      contractSection?.min_chars,
    );
    expect(R1_S4_MICRO_SEO_BOUNDS).toEqual({
      min_chars: contractSection?.min_chars,
      max_chars: contractSection?.max_chars,
    });
  });

  it('un bloc de 1 850 caractères, ou de 1 663 sans sa phrase conditionnelle, passe les bornes', () => {
    for (const length of [1850, 1663]) {
      expect(length).toBeGreaterThanOrEqual(R1_S4_MICRO_SEO_BOUNDS.min_chars);
      expect(length).toBeLessThanOrEqual(R1_S4_MICRO_SEO_BOUNDS.max_chars);
    }
  });
});
