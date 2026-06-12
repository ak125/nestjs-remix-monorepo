import { buildWearMacroPrompt } from '../wear-macro.builder';
import { buildComparisonAbPrompt } from '../comparison-ab.builder';
import { buildExplodedViewPrompt } from '../exploded-view.builder';
import {
  MAX_IN_ARTICLE_IMAGES,
  IN_ARTICLE_SLOT_IDS,
  computeInArticleRichnessScores,
  selectInArticleSlots,
} from '../in-article-selection';
import { SLOT_BUILDERS, SLOT_IDS, SLOT_META } from '../index';
import { type RagData } from '../types';

const RICH_RAG: RagData = {
  category: 'freinage',
  completeness_profile: 'freinage',
  domain: {
    role: 'Assure le freinage par friction sur le disque',
    confusion_with: [
      {
        term: 'machoire-de-frein',
        difference: 'Mâchoire = frein tambour, plaquette = frein disque',
      },
    ],
  },
  selection: {
    criteria: [
      'Épaisseur : 17mm neuve, mini 12mm',
      'Type : organique, semi-métallique, céramique',
      'Largeur et hauteur selon étrier',
    ],
    brands: { premium: ['Brembo', 'ATE'] },
  },
  diagnostic: {
    symptoms: [
      { id: 's1', label: 'Sifflement au freinage', severity: 'moyen' },
      {
        id: 's2',
        label: 'Distance de freinage allongée',
        severity: 'securite',
      },
    ],
  },
  maintenance: {
    wear_signs: ["Témoin d'usure visible", 'Épaisseur sous 3mm'],
  },
  installation: {
    difficulty: 'intermediate',
    tools: ['repousse-piston', 'clé dynamométrique'],
    steps: [
      'Lever le véhicule',
      'Déposer la roue',
      'Repousser le piston',
      'Déposer les goupilles',
      'Extraire les plaquettes usées',
    ],
    prerequisite: 'Véhicule sur chandelles, roue déposée',
  },
};

describe('In-article builders (salvage R3)', () => {
  describe('buildWearMacroPrompt', () => {
    it('uses wear_signs and critical symptom from RAG', () => {
      const result = buildWearMacroPrompt('Plaquette de frein', RICH_RAG);
      expect(result.prompt).toContain("Témoin d'usure visible");
      expect(result.prompt).toContain('Épaisseur sous 3mm');
      // Critical symptom (severity securite) surfaced
      expect(result.prompt).toContain('Distance de freinage allongée');
      expect(result.ragFieldsUsed).toContain('maintenance.wear_signs');
      expect(result.ragFieldsUsed).toContain('diagnostic.symptoms');
      expect(result.richnessScore).toBe(3);
    });

    it('degrades cleanly without RAG (score 0, generic fallbacks)', () => {
      const result = buildWearMacroPrompt('Plaquette de frein', null);
      expect(result.prompt).toContain('usure visible');
      expect(result.prompt).toContain('dégradation de surface');
      expect(result.ragFieldsUsed).toEqual([]);
      expect(result.richnessScore).toBe(0);
    });
  });

  describe('buildComparisonAbPrompt', () => {
    it('builds A-vs-B from confusion_with (gamme vs confused term)', () => {
      const result = buildComparisonAbPrompt('Plaquette de frein', RICH_RAG);
      expect(result.prompt).toContain(
        '« Plaquette de frein » vs « machoire de frein »',
      );
      expect(result.caption).toBe(
        'Plaquette de frein vs machoire de frein — schéma comparatif',
      );
      // Criteria labels (text before colon)
      expect(result.prompt).toContain('Épaisseur');
      expect(result.ragFieldsUsed).toContain('domain.confusion_with');
      expect(result.ragFieldsUsed).toContain('selection.criteria');
      expect(result.richnessScore).toBe(3);
    });

    it('falls back to type variants extracted from criteria', () => {
      const ragNoConfusion: RagData = {
        ...RICH_RAG,
        domain: { ...RICH_RAG.domain, confusion_with: undefined },
      };
      const result = buildComparisonAbPrompt(
        'Plaquette de frein',
        ragNoConfusion,
      );
      expect(result.prompt).toContain('« organique » vs « semi-métallique »');
    });

    it('degrades cleanly without RAG (generic Type A/B, score 0)', () => {
      const result = buildComparisonAbPrompt('Plaquette de frein', null);
      expect(result.prompt).toContain('« Type A » vs « Type B »');
      expect(result.ragFieldsUsed).toEqual([]);
      expect(result.richnessScore).toBe(0);
    });
  });

  describe('buildExplodedViewPrompt', () => {
    it('uses installation tools, steps and prerequisite from RAG', () => {
      const result = buildExplodedViewPrompt('Plaquette de frein', RICH_RAG);
      expect(result.prompt).toContain('repousse-piston');
      expect(result.prompt).toContain('clé dynamométrique');
      expect(result.prompt).toContain('Lever le véhicule');
      expect(result.prompt).toContain('Véhicule sur chandelles');
      expect(result.ragFieldsUsed).toContain('installation.tools');
      expect(result.ragFieldsUsed).toContain('installation.steps');
      expect(result.ragFieldsUsed).toContain('installation.prerequisite');
      expect(result.richnessScore).toBe(3);
    });

    it('degrades cleanly without RAG (default tools, score 0)', () => {
      const result = buildExplodedViewPrompt('Plaquette de frein', null);
      expect(result.prompt).toContain('clé dynamométrique');
      expect(result.prompt).toContain('clé à douille');
      expect(result.ragFieldsUsed).toEqual([]);
      expect(result.richnessScore).toBe(0);
    });
  });

  describe('in-article selection heuristic (G7: max 2, skip score 0)', () => {
    it('selects at most MAX_IN_ARTICLE_IMAGES slots, score DESC', () => {
      const scores = computeInArticleRichnessScores(RICH_RAG);
      expect(scores).toEqual({
        WEAR_MACRO: 3,
        COMPARISON_AB: 3,
        EXPLODED_VIEW: 3,
      });
      const selected = selectInArticleSlots(scores);
      expect(selected).toHaveLength(MAX_IN_ARTICLE_IMAGES);
      // Tie on score → editorial priority order
      expect(selected).toEqual(['WEAR_MACRO', 'COMPARISON_AB']);
    });

    it('skips slots with score 0', () => {
      const selected = selectInArticleSlots({
        WEAR_MACRO: 0,
        COMPARISON_AB: 2,
        EXPLODED_VIEW: 0,
      });
      expect(selected).toEqual(['COMPARISON_AB']);
    });

    it('orders by score DESC before editorial priority', () => {
      const selected = selectInArticleSlots({
        WEAR_MACRO: 1,
        COMPARISON_AB: 2,
        EXPLODED_VIEW: 3,
      });
      expect(selected).toEqual(['EXPLODED_VIEW', 'COMPARISON_AB']);
    });

    it('returns empty selection for null RAG (all scores 0)', () => {
      const scores = computeInArticleRichnessScores(null);
      expect(scores).toEqual({
        WEAR_MACRO: 0,
        COMPARISON_AB: 0,
        EXPLODED_VIEW: 0,
      });
      expect(selectInArticleSlots(scores)).toEqual([]);
    });

    it('builder richnessScore matches selection scoring (single source)', () => {
      const scores = computeInArticleRichnessScores(RICH_RAG);
      expect(buildWearMacroPrompt('X', RICH_RAG).richnessScore).toBe(
        scores.WEAR_MACRO,
      );
      expect(buildComparisonAbPrompt('X', RICH_RAG).richnessScore).toBe(
        scores.COMPARISON_AB,
      );
      expect(buildExplodedViewPrompt('X', RICH_RAG).richnessScore).toBe(
        scores.EXPLODED_VIEW,
      );
    });
  });

  describe('additivity guarantee — live registries untouched', () => {
    it('SLOT_BUILDERS / SLOT_IDS keep exactly the 5 original live slots', () => {
      expect(SLOT_IDS).toEqual(['HERO', 'TYPES', 'PRICE', 'LOCATION', 'OG']);
      for (const slotId of IN_ARTICLE_SLOT_IDS) {
        expect(SLOT_BUILDERS[slotId]).toBeUndefined();
        expect(SLOT_META[slotId]).toBeUndefined();
      }
    });
  });
});
