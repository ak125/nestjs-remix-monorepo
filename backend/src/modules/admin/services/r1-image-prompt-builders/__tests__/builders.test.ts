import { buildHeroPrompt } from '../hero.builder';
import { buildTypesPrompt } from '../types.builder';
import { buildPricePrompt } from '../price.builder';
import { buildLocationPrompt } from '../location.builder';
import { buildOgPrompt } from '../og.builder';
import { type RagData } from '../types';

const RICH_RAG: RagData = {
  category: 'filtration',
  completeness_profile: 'filtration',
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
    quality_tiers: [
      {
        tier: 'OEM',
        description: 'Qualité constructeur',
        price_range: '15-40€',
      },
      {
        tier: 'Premium',
        description: 'Équipementier première monte',
        price_range: '8-25€',
      },
      {
        tier: 'Standard',
        description: 'Aftermarket courant',
        price_range: '5-15€',
      },
    ],
  },
  variants: [
    {
      name: 'Filtre à visser (spin-on)',
      visual_differences: ['cylindrique métallique', 'filetage visible'],
      functional_differences: ['remplacement complet'],
    },
    {
      name: 'Filtre à cartouche (insert)',
      visual_differences: ['papier plissé sans coque', 'logé dans boîtier'],
      functional_differences: ['seul le média filtrant est remplacé'],
    },
  ],
  location_on_vehicle: {
    area: 'bloc moteur',
    access: 'sous le véhicule ou par le dessus selon motorisation',
    adjacent_parts: ["carter d'huile", 'bouchon de vidange'],
  },
  key_visual_features: {
    identifying_shapes: [
      'cylindre métallique fileté (spin-on)',
      'cartouche papier plissé (insert)',
    ],
    identifying_materials: [
      'acier peint (spin-on)',
      'papier/cellulose (cartouche)',
    ],
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
    it('enriches with ambiance, role and visual features from RAG', () => {
      const result = buildHeroPrompt('Filtre à huile', RICH_RAG);
      // Ambiance filtration
      expect(result.prompt).toContain('fluide doré');
      // Role
      expect(result.prompt).toContain('filtre les impuretés');
      // Key visual features
      expect(result.prompt).toContain('cylindre métallique');
      expect(result.ragFieldsUsed).toContain('domain.role');
      expect(result.ragFieldsUsed).toContain('key_visual_features');
      expect(result.richnessScore).toBeGreaterThanOrEqual(3);
    });

    it('falls back to template without RAG', () => {
      const result = buildHeroPrompt('Filtre à huile', null);
      expect(result.prompt).toContain('Filtre à huile');
      expect(result.prompt).toContain('16:9');
      expect(result.prompt).toContain('ultra réaliste');
      expect(result.ragFieldsUsed).toEqual([]);
      expect(result.richnessScore).toBe(0);
    });
  });

  describe('buildTypesPrompt', () => {
    it('uses variants and visual features for realistic comparison', () => {
      const result = buildTypesPrompt('Filtre à huile', RICH_RAG);
      // Variants
      expect(result.prompt).toContain('spin-on');
      expect(result.prompt).toContain('cartouche');
      // Confusion guard
      expect(result.prompt).toContain('filtre a air');
      expect(result.ragFieldsUsed).toContain('variants');
      expect(result.ragFieldsUsed).toContain('domain.confusion_with');
      expect(result.richnessScore).toBeGreaterThanOrEqual(3);
    });

    it('falls back to criteria when no variants', () => {
      const ragNoVariants = { ...RICH_RAG, variants: undefined };
      const result = buildTypesPrompt('Filtre à huile', ragNoVariants);
      expect(result.prompt).toContain('diamètre de filetage');
      expect(result.ragFieldsUsed).toContain('selection.criteria');
    });
  });

  describe('buildPricePrompt', () => {
    it('uses quality_tiers for visual progression', () => {
      const result = buildPricePrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('oem');
      expect(result.prompt).toContain('premium');
      expect(result.prompt).toContain('standard');
      expect(result.prompt).not.toContain('infographie');
      expect(result.ragFieldsUsed).toContain('selection.quality_tiers');
      expect(result.richnessScore).toBeGreaterThanOrEqual(2);
    });

    it('uses default tiers without RAG', () => {
      const result = buildPricePrompt('Filtre à huile', null);
      expect(result.prompt).toContain('budget, standard, premium');
      expect(result.prompt).toContain('pas de texte');
    });
  });

  describe('buildLocationPrompt', () => {
    it('uses location_on_vehicle for realistic context', () => {
      const result = buildLocationPrompt('Filtre à huile', RICH_RAG);
      expect(result.prompt).toContain('bloc moteur');
      expect(result.prompt).toContain("carter d'huile");
      expect(result.ragFieldsUsed).toContain('location_on_vehicle.area');
      expect(result.ragFieldsUsed).toContain(
        'location_on_vehicle.adjacent_parts',
      );
      expect(result.richnessScore).toBeGreaterThanOrEqual(3);
    });

    it('falls back to installation when no location', () => {
      const ragNoLocation = { ...RICH_RAG, location_on_vehicle: undefined };
      const result = buildLocationPrompt('Filtre à huile', ragNoLocation);
      expect(result.ragFieldsUsed).toContain('installation.steps');
      expect(result.ragFieldsUsed).toContain('installation.tools');
    });
  });

  describe('buildOgPrompt', () => {
    it('uses ambiance and role for social preview', () => {
      const result = buildOgPrompt('Filtre à huile', RICH_RAG);
      // Family ambiance
      expect(result.prompt).toContain('doré ambré');
      // Role
      expect(result.prompt).toContain('filtre les impuretés');
      expect(result.ragFieldsUsed).toContain('completeness_profile');
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

  describe('family ambiance differentiation', () => {
    it('filtration and freinage produce different ambiances', () => {
      const filtrationRag: RagData = {
        category: 'filtration',
        completeness_profile: 'filtration',
      };
      const freinageRag: RagData = {
        category: 'freinage',
        completeness_profile: 'freinage',
      };

      const filtrationHero = buildHeroPrompt('Filtre à huile', filtrationRag);
      const freinageHero = buildHeroPrompt('Plaquette de frein', freinageRag);

      expect(filtrationHero.prompt).toContain('doré');
      expect(freinageHero.prompt).toContain('anthracite');
      expect(filtrationHero.prompt).not.toBe(freinageHero.prompt);
    });
  });
});
