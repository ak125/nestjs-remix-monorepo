import { SeoSlugService } from '../seo-slug.service';

describe('SeoSlugService', () => {
  let service: SeoSlugService;

  beforeEach(() => {
    service = new SeoSlugService();
  });

  describe('slugify (avec optimisation stop-words)', () => {
    it('lowercase + dash join', () => {
      expect(service.slugify('Plaquettes Frein')).toBe('plaquettes-frein');
    });

    it("supprime les stop-words FR : de / du / des / la / le / les / et / l' / d'", () => {
      expect(service.slugify('Plaquettes de Frein')).toBe('plaquettes-frein');
      expect(service.slugify('Kit de la distribution')).toBe(
        'kit-distribution',
      );
      expect(service.slugify('Pièces du moteur')).toBe('pieces-moteur');
      expect(service.slugify('Test des freins et amortisseurs')).toBe(
        'test-freins-amortisseurs',
      );
      expect(service.slugify("L'huile d'origine")).toBe('huile-origine');
    });

    it('remplace les accents FR', () => {
      expect(service.slugify('Filtre à huile')).toBe('filtre-a-huile');
      expect(service.slugify('Système électrique')).toBe('systeme-electrique');
      // `à` (préposition) reste comme "a", `l’` (élision typographique) est
      // stripée via stop-words. Résidu attendu : "echappement-a-avant".
      expect(service.slugify('Échappement à l’avant')).toBe(
        'echappement-a-avant',
      );
      expect(service.slugify('Côté gauche')).toBe('cote-gauche');
    });

    it('caractères non alphanumériques → dash + collapse + trim', () => {
      expect(service.slugify('  Plaquettes  /  Frein  ')).toBe(
        'plaquettes-frein',
      );
      expect(service.slugify('A/B & C')).toBe('a-b-c');
      expect(service.slugify('!?special@')).toBe('special');
    });

    it('input vide ou nul', () => {
      expect(service.slugify('')).toBe('');
      expect(service.slugify('   ')).toBe('');
      expect(service.slugify('---')).toBe('');
    });

    it('respecte maxLength sans couper un mot quand possible', () => {
      const longInput = 'kit de distribution complete pour moteur diesel turbo';
      // sans stop-words : "kit-distribution-complete-pour-moteur-diesel-turbo"
      expect(service.slugify(longInput, 30)).toBe(
        'kit-distribution-complete-pour',
      );
      expect(service.slugify(longInput, 100)).toBe(
        'kit-distribution-complete-pour-moteur-diesel-turbo',
      );
    });

    it('coupe net si aucun dash dans la fenêtre maxLength', () => {
      // mot très long sans séparateur
      expect(service.slugify('supercalifragilisticexpialidocious', 10)).toBe(
        'supercalif',
      );
    });

    it('tokens stop-words consécutifs sont tous filtrés', () => {
      expect(service.slugify('le de la et du')).toBe('');
      expect(service.slugify('moteur et de la voiture')).toBe('moteur-voiture');
    });

    it('chiffres conservés', () => {
      expect(service.slugify('Peugeot 308 1.6 HDi')).toBe(
        'peugeot-308-1-6-hdi',
      );
      expect(service.slugify('Renault Clio IV')).toBe('renault-clio-iv');
    });

    it('caractères diacritiques étendus (œ, æ, ñ, ß)', () => {
      expect(service.slugify('Cœur de moteur')).toBe('coeur-moteur');
      expect(service.slugify('Cæsar')).toBe('caesar');
      expect(service.slugify('España')).toBe('espana');
      expect(service.slugify('Straße')).toBe('strasse');
    });

    it('apostrophes typographiques (’) normalisées en ASCII puis split → "l" stop-word', () => {
      expect(service.slugify('L’huile')).toBe('huile');
      expect(service.slugify('D’origine')).toBe('origine');
    });
  });

  describe('slugifyRaw (sans optimisation)', () => {
    it('conserve les stop-words', () => {
      expect(service.slugifyRaw('Plaquettes de Frein')).toBe(
        'plaquettes-de-frein',
      );
      expect(service.slugifyRaw('Kit de la distribution')).toBe(
        'kit-de-la-distribution',
      );
    });

    it('reste identique pour input sans stop-words', () => {
      expect(service.slugifyRaw('Plaquettes Frein')).toBe('plaquettes-frein');
    });

    it('respecte maxLength', () => {
      expect(
        service.slugifyRaw('a'.repeat(100), 50).length,
      ).toBeLessThanOrEqual(50);
    });
  });
});
