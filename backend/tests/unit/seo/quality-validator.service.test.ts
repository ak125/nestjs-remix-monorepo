/**
 * QualityValidatorService Tests
 *
 * Tests the SEO content quality validation service including:
 * - V-Level determination from search volume
 * - Content validation against forbidden words
 * - Score calculation
 * - Auto-correction functionality
 *
 * @see backend/src/modules/seo/services/quality-validator.service.ts
 */
import {
  QualityValidatorService,
  VLevel,
  PageRole,
  ValidationIssue,
} from '../../../src/modules/seo/services/quality-validator.service';

describe('QualityValidatorService', () => {
  let validator: QualityValidatorService;

  beforeEach(() => {
    validator = new QualityValidatorService();
  });

  // ═══════════════════════════════════════════════════════════════
  // V-LEVEL DETERMINATION
  // Maps search volume to content length requirements
  // ═══════════════════════════════════════════════════════════════
  describe('V-Level Determination', () => {
    describe('getVLevel(searchVolume)', () => {
      const testCases: Array<{ volume: number; expected: VLevel }> = [
        // L1: Very low volume (<10)
        { volume: 0, expected: 'L1' },
        { volume: 5, expected: 'L1' },
        { volume: 9, expected: 'L1' },

        // L2: Low volume (10-99)
        { volume: 10, expected: 'L2' },
        { volume: 50, expected: 'L2' },
        { volume: 99, expected: 'L2' },

        // L3: Medium volume (100-999)
        { volume: 100, expected: 'L3' },
        { volume: 500, expected: 'L3' },
        { volume: 999, expected: 'L3' },

        // L4: High volume (1000-9999)
        { volume: 1000, expected: 'L4' },
        { volume: 5000, expected: 'L4' },
        { volume: 9999, expected: 'L4' },

        // L5: Very high volume (10000+)
        { volume: 10000, expected: 'L5' },
        { volume: 50000, expected: 'L5' },
        { volume: 100000, expected: 'L5' },
      ];

      it.each(testCases)(
        'returns $expected for volume $volume',
        ({ volume, expected }) => {
          expect(validator.getVLevel(volume)).toBe(expected);
        },
      );
    });

    describe('getVLevelConfig()', () => {
      it('returns correct config for L1', () => {
        const config = validator.getVLevelConfig('L1');
        expect(config).toEqual({
          minWords: 80,
          maxWords: 120,
          maxTokens: 150,
        });
      });

      it('returns correct config for L3', () => {
        const config = validator.getVLevelConfig('L3');
        expect(config).toEqual({
          minWords: 300,
          maxWords: 500,
          maxTokens: 600,
        });
      });

      it('returns correct config for L5', () => {
        const config = validator.getVLevelConfig('L5');
        expect(config).toEqual({
          minWords: 1200,
          maxWords: 1800,
          maxTokens: 2000,
        });
      });
    });

    describe('getMaxTokens()', () => {
      const tokenLimits: Array<{ level: VLevel; maxTokens: number }> = [
        { level: 'L1', maxTokens: 150 },
        { level: 'L2', maxTokens: 300 },
        { level: 'L3', maxTokens: 600 },
        { level: 'L4', maxTokens: 1200 },
        { level: 'L5', maxTokens: 2000 },
      ];

      it.each(tokenLimits)(
        'returns $maxTokens tokens for $level',
        ({ level, maxTokens }) => {
          expect(validator.getMaxTokens(level)).toBe(maxTokens);
        },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONTENT VALIDATION
  // Validates content against forbidden words and rules
  // ═══════════════════════════════════════════════════════════════
  describe('Content Validation', () => {
    describe('validateContent() with no forbidden words loaded', () => {
      it('returns valid result for any content when no words loaded', () => {
        const result = validator.validateContent(
          'This is test content with many words.',
          'R4',
        );

        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });

      it('returns score penalty for very short content', () => {
        const shortContent = 'Too short.';
        const result = validator.validateContent(shortContent, 'R4');

        // Short content gets a 10-point penalty
        expect(result.score).toBe(90);
      });

      it('returns full score for adequate content length', () => {
        const adequateContent = 'word '.repeat(60); // 60 words
        const result = validator.validateContent(adequateContent, 'R4');

        expect(result.score).toBe(100);
      });
    });

    describe('Score Calculation', () => {
      it('deducts 10 points for content under 50 words', () => {
        const shortContent = 'word '.repeat(30);
        const result = validator.validateContent(shortContent, 'R4');

        expect(result.score).toBe(90); // 100 - 10 (short penalty)
      });

      it('returns 100 for content with 50+ words and no issues', () => {
        const goodContent = 'word '.repeat(55);
        const result = validator.validateContent(goodContent, 'R4');

        expect(result.score).toBe(100);
      });
    });

    describe('Recommendations', () => {
      it('recommends longer content when word count is low', () => {
        const shortContent = 'word '.repeat(50); // 50 words < 100
        const result = validator.validateContent(shortContent, 'R4');

        expect(result.recommendations).toContainEqual(
          expect.stringContaining('Contenu trop court'),
        );
      });

      it('does not recommend longer content when word count is adequate', () => {
        const goodContent = 'word '.repeat(150); // 150 words > 100
        const result = validator.validateContent(goodContent, 'R4');

        const shortRecommendation = result.recommendations.find((r) =>
          r.includes('Contenu trop court'),
        );
        expect(shortRecommendation).toBeUndefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AUTO-CORRECTION
  // Replaces forbidden words with alternatives
  // ═══════════════════════════════════════════════════════════════
  describe('Auto-Correction', () => {
    describe('autoCorrectContent()', () => {
      it('replaces words with their alternatives', () => {
        const content = 'Le meilleur disque de frein du marché.';
        const issues: ValidationIssue[] = [
          {
            word: 'meilleur',
            category: 'superlatif',
            reason: 'Non vérifiable',
            alternative: 'excellent',
            severity: 'error',
            position: 3,
          },
        ];

        const corrected = validator.autoCorrectContent(content, issues);

        expect(corrected).toBe('Le excellent disque de frein du marché.');
      });

      it('does not replace words marked for deletion', () => {
        const content = 'Achetez maintenant au meilleur prix!';
        const issues: ValidationIssue[] = [
          {
            word: 'Achetez',
            category: 'commercial',
            reason: 'CTA interdit en R4',
            alternative: 'supprimer',
            severity: 'error',
            position: 0,
          },
        ];

        const corrected = validator.autoCorrectContent(content, issues);

        // "supprimer" is not a replacement, so word stays
        expect(corrected).toBe(content);
      });

      it('handles multiple replacements', () => {
        const content = 'Le meilleur et le top produit.';
        const issues: ValidationIssue[] = [
          {
            word: 'meilleur',
            category: 'superlatif',
            reason: 'Non vérifiable',
            alternative: 'excellent',
            severity: 'error',
          },
          {
            word: 'top',
            category: 'superlatif',
            reason: 'Non vérifiable',
            alternative: 'performant',
            severity: 'error',
          },
        ];

        const corrected = validator.autoCorrectContent(content, issues);

        expect(corrected).toBe('Le excellent et le performant produit.');
      });

      it('preserves content when no alternatives provided', () => {
        const content = 'Contenu original.';
        const issues: ValidationIssue[] = [];

        const corrected = validator.autoCorrectContent(content, issues);

        expect(corrected).toBe(content);
      });

      it('handles case-insensitive replacement', () => {
        const content = 'MEILLEUR produit disponible.';
        const issues: ValidationIssue[] = [
          {
            word: 'meilleur',
            category: 'superlatif',
            reason: 'Non vérifiable',
            alternative: 'excellent',
            severity: 'error',
          },
        ];

        const corrected = validator.autoCorrectContent(content, issues);

        expect(corrected).toBe('excellent produit disponible.');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // Helper functions and state management
  // ═══════════════════════════════════════════════════════════════
  describe('Utility Methods', () => {
    describe('getForbiddenWordsCount()', () => {
      it('returns 0 when no words are loaded', () => {
        expect(validator.getForbiddenWordsCount()).toBe(0);
      });
    });

    describe('getForbiddenWordsByCategory()', () => {
      it('returns empty object when no words are loaded', () => {
        const byCategory = validator.getForbiddenWordsByCategory();
        expect(Object.keys(byCategory)).toHaveLength(0);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES
  // Boundary conditions and special scenarios
  // ═══════════════════════════════════════════════════════════════
  describe('Edge Cases', () => {
    it('handles empty content', () => {
      const result = validator.validateContent('', 'R4');

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(90); // Penalty for short content
    });

    it('handles content with only whitespace', () => {
      const result = validator.validateContent('   \n\t   ', 'R4');

      expect(result.isValid).toBe(true);
    });

    it('handles all page roles', () => {
      const pageRoles: PageRole[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
      const content = 'Test content for validation.';

      pageRoles.forEach((role) => {
        expect(() => validator.validateContent(content, role)).not.toThrow();
      });
    });

    it('handles very long content', () => {
      const longContent = 'word '.repeat(10000); // 10k words

      expect(() => validator.validateContent(longContent, 'R5')).not.toThrow();
    });

    it('handles content with special characters', () => {
      const specialContent =
        'Pièce auto pour véhicule français - Prix: 45,90€ (TTC)';

      expect(() => validator.validateContent(specialContent, 'R2')).not.toThrow();
    });

    it('handles content with HTML tags', () => {
      const htmlContent = '<p>Contenu avec <strong>balises</strong> HTML.</p>';

      const result = validator.validateContent(htmlContent, 'R4');
      expect(result).toBeDefined();
    });
  });
});
