import { buildHeroPrompt } from '../hero.builder';
import { buildTypesPrompt } from '../types.builder';
import { buildPricePrompt } from '../price.builder';
import { buildLocationPrompt } from '../location.builder';
import { buildOgPrompt } from '../og.builder';
import { type RagData } from '../types';

const RICH_RAG: RagData = {
  category: 'filtration',
  domain: {
    role: "Filtre les impuretés de l'huile moteur pour protéger les organes internes",
    confusion_with: [
      {
        term: 'filtre-a-air',
        difference:
          'Filtre à air = air admission, filtre à huile = huile moteur',
      },
    ],
    related_parts: ['joint-de-vidange', 'huile-moteur'],
  },
  selection: {
    criteria: [
      'Diamètre de filetage M20x1.5',
      'Hauteur 75mm',
      'Type vissé ou cartouche',
    ],
    cost_range: { min: 5, max: 25, currency: 'EUR' },
  },
  installation: {
    difficulty: 'intermediate',
    tools: ['clé à filtre', 'bac de récupération', 'clé dynamométrique'],
    steps: [
      'Lever le véhicule et placer sur chandelles',
      'Dévisser le bouchon de vidange',
    ],
    time: '30 minutes',
  },
  maintenance: {
    wear_signs: ['Coloration sombre', 'Fuite au niveau du joint'],
    interval: '15000 km ou 1 an',
  },
};

describe('R1 Image Prompt Builders', () => {
  describe('buildHeroPrompt', () => {
    it('enriches with domain.role and criteria from RAG', () => {
      const result = buildHeroPrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('filtre les impuretés');
      expect(result.prompt).toContain('diamètre de filetage');
      expect(result.ragFieldsUsed).toContain('domain.role');
      expect(result.ragFieldsUsed).toContain('selection.criteria');
      expect(result.richnessScore).toBeGreaterThanOrEqual(2);
    });

    it('falls back to template without RAG', () => {
      const result = buildHeroPrompt('Filtre à huile', null);
      expect(result.prompt).toContain('Filtre à huile');
      expect(result.prompt).toContain('16:9');
      expect(result.ragFieldsUsed).toEqual([]);
      expect(result.richnessScore).toBe(0);
    });
  });

  describe('buildTypesPrompt', () => {
    it('enriches with criteria and confusion_with', () => {
      const result = buildTypesPrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('diamètre de filetage');
      expect(result.prompt).toContain('filtre a air');
      expect(result.ragFieldsUsed).toContain('selection.criteria');
      expect(result.ragFieldsUsed).toContain('domain.confusion_with');
    });
  });

  describe('buildPricePrompt', () => {
    it('injects real cost_range instead of hardcoded tiers', () => {
      const result = buildPricePrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('5€');
      expect(result.prompt).toContain('25€');
      expect(result.prompt).not.toContain('éco, standard, premium');
      expect(result.ragFieldsUsed).toContain('selection.cost_range');
    });

    it('uses default tiers without RAG', () => {
      const result = buildPricePrompt('Filtre à huile', null);
      expect(result.prompt).toContain('éco, standard, premium');
    });
  });

  describe('buildLocationPrompt', () => {
    it('enriches with installation context', () => {
      const result = buildLocationPrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('lever le véhicule');
      expect(result.prompt).toContain('clé à filtre');
      expect(result.ragFieldsUsed).toContain('installation.steps');
      expect(result.ragFieldsUsed).toContain('installation.tools');
      expect(result.ragFieldsUsed).toContain('installation.difficulty');
    });
  });

  describe('buildOgPrompt', () => {
    it('uses category and domain.role for social context', () => {
      const result = buildOgPrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('filtration');
      expect(result.prompt).toContain('filtre les impuretés');
      expect(result.ragFieldsUsed).toContain('category');
      expect(result.ragFieldsUsed).toContain('domain.role');
    });

    it('OG prompt differs from HERO prompt', () => {
      const hero = buildHeroPrompt('Filtre à huile', RICH_RAG);
      const og = buildOgPrompt('Filtre à huile', RICH_RAG);
      expect(og.prompt).not.toBe(hero.prompt);
      expect(og.prompt).toContain('1200x630');
      expect(hero.prompt).toContain('16:9');
    });
  });

  describe('all builders produce distinct prompts', () => {
    it('no two builders produce the same prompt', () => {
      const results = [
        buildHeroPrompt('Disque de frein', RICH_RAG),
        buildTypesPrompt('Disque de frein', RICH_RAG),
        buildPricePrompt('Disque de frein', RICH_RAG),
        buildLocationPrompt('Disque de frein', RICH_RAG),
        buildOgPrompt('Disque de frein', RICH_RAG),
      ];
      const prompts = results.map((r) => r.prompt);
      const unique = new Set(prompts);
      expect(unique.size).toBe(5);
    });
  });
});
