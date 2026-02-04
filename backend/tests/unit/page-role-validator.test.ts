/**
 * PageRole Content Validation Tests
 *
 * Validates that the PageRoleValidatorService correctly identifies
 * content violations for each role type.
 *
 * @see backend/src/modules/seo/services/page-role-validator.service.ts
 */
import { PageRoleValidatorService } from '../../src/modules/seo/services/page-role-validator.service';
import { PageRole } from '../../src/modules/seo/types/page-role.types';

describe('PageRole Content Validation', () => {
  let validator: PageRoleValidatorService;

  beforeAll(() => {
    validator = new PageRoleValidatorService();
  });

  // ═══════════════════════════════════════════════════════════════
  // R1 ROUTER RULES
  // Intention: Navigation/Selection - ≤150 words, no symptoms
  // ═══════════════════════════════════════════════════════════════
  describe('R1 Router Rules', () => {
    describe('Word count limit (≤150 words)', () => {
      it('accepts content with 150 words or less', () => {
        const shortContent = 'Sélectionnez votre véhicule pour trouver la pièce compatible.';
        const violations = validator.validateR1Router(shortContent);
        const wordCountViolation = violations.find((v) => v.type === 'word_count');
        expect(wordCountViolation).toBeUndefined();
      });

      it('rejects content exceeding 150 words', () => {
        const longContent = 'mot '.repeat(200); // 200 words
        const violations = validator.validateR1Router(longContent);
        const wordCountViolation = violations.find((v) => v.type === 'word_count');
        expect(wordCountViolation).toBeDefined();
        expect(wordCountViolation?.severity).toBe('error');
      });
    });

    describe('Forbidden symptom keywords', () => {
      const FORBIDDEN_KEYWORDS = [
        'bruit',
        'usé',
        'cassé',
        'problème',
        'symptôme',
        'panne',
        'vibration',
        'claquement',
      ];

      it.each(FORBIDDEN_KEYWORDS)(
        'rejects content containing "%s"',
        (keyword) => {
          const content = `Trouvez votre pièce. Attention au ${keyword} possible.`;
          const violations = validator.validateR1Router(content);
          const keywordViolation = violations.find(
            (v) => v.type === 'forbidden_keyword',
          );
          expect(keywordViolation).toBeDefined();
        },
      );

      it('accepts content without symptom keywords', () => {
        const validContent =
          'Sélectionnez votre marque et modèle pour trouver vos pièces auto.';
        const violations = validator.validateR1Router(validContent);
        const keywordViolation = violations.find(
          (v) => v.type === 'forbidden_keyword',
        );
        expect(keywordViolation).toBeUndefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R2 PRODUCT RULES
  // Intention: Transaction - price/CTA required
  // ═══════════════════════════════════════════════════════════════
  describe('R2 Product Rules', () => {
    describe('Required commercial elements', () => {
      it('accepts content with price indicator', () => {
        const content = 'Disque de frein avant - 45,90€ TTC';
        const violations = validator.validateR2Product(content);
        // Should not have missing_element for price
        const missingPrice = violations.find(
          (v) => v.type === 'missing_element' && v.message.includes('prix'),
        );
        expect(missingPrice).toBeUndefined();
      });

      it('accepts content with "ajouter" CTA', () => {
        const content = 'Ajouter au panier - Livraison rapide';
        const violations = validator.validateR2Product(content);
        // Should not flag missing CTA
        expect(
          violations.filter((v) => v.type === 'missing_element').length,
        ).toBeLessThanOrEqual(1); // May flag other missing elements
      });
    });

    describe('Forbidden blocks', () => {
      it('rejects "choisissez votre véhicule" block', () => {
        const content =
          'Disque de frein - 45€. Choisissez votre véhicule pour vérifier la compatibilité.';
        const violations = validator.validateR2Product(content);
        const blockViolation = violations.find(
          (v) => v.type === 'forbidden_block',
        );
        expect(blockViolation).toBeDefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R3 BLOG RULES
  // Intention: Education/Pedagogy - no commercial filters
  // ═══════════════════════════════════════════════════════════════
  describe('R3 Blog Rules', () => {
    describe('Forbidden filter blocks', () => {
      it('rejects content with vehicle selection block', () => {
        const content =
          'Guide complet sur le freinage. Sélectionnez votre véhicule ci-dessous.';
        const violations = validator.validateR3Blog(content);
        const blockViolation = violations.find(
          (v) => v.type === 'forbidden_block',
        );
        expect(blockViolation).toBeDefined();
      });

      it('accepts pure educational content', () => {
        const content =
          "Le système de freinage est essentiel à la sécurité de votre véhicule. Voici comment l'entretenir.";
        const violations = validator.validateR3Blog(content);
        const blockViolation = violations.find(
          (v) => v.type === 'forbidden_block',
        );
        expect(blockViolation).toBeUndefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R4 REFERENCE RULES
  // Intention: Technical definition - no commercial, no vehicles
  // ═══════════════════════════════════════════════════════════════
  describe('R4 Reference Rules', () => {
    describe('Forbidden commercial keywords', () => {
      const COMMERCIAL_KEYWORDS = ['prix', '€', 'acheter', 'commander'];

      it.each(COMMERCIAL_KEYWORDS)(
        'rejects content containing "%s"',
        (keyword) => {
          const content = `Définition du disque de frein. ${keyword} disponible.`;
          const violations = validator.validateR4Reference(content);
          const keywordViolation = violations.find(
            (v) => v.type === 'forbidden_keyword',
          );
          expect(keywordViolation).toBeDefined();
        },
      );
    });

    describe('Forbidden vehicle brand mentions', () => {
      const VEHICLE_BRANDS = ['Peugeot', 'Renault', 'Citroën', 'Volkswagen'];

      it.each(VEHICLE_BRANDS)(
        'rejects content mentioning "%s"',
        (brand) => {
          const content = `Le disque de frein est utilisé sur ${brand} 308.`;
          const violations = validator.validateR4Reference(content);
          const brandViolation = violations.find(
            (v) => v.type === 'forbidden_keyword',
          );
          expect(brandViolation).toBeDefined();
        },
      );
    });

    describe('Valid reference content', () => {
      it('accepts generic technical definition', () => {
        const content =
          "Définition: Le disque de frein est un composant du système de freinage. Il transforme l'énergie cinétique en chaleur par friction.";
        const violations = validator.validateR4Reference(content);
        const keywordViolation = violations.find(
          (v) => v.type === 'forbidden_keyword',
        );
        expect(keywordViolation).toBeUndefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R5 DIAGNOSTIC RULES
  // Intention: Symptom identification - symptoms required, no commercial
  // ═══════════════════════════════════════════════════════════════
  describe('R5 Diagnostic Rules', () => {
    describe('Required symptom keywords', () => {
      it('accepts content with symptom vocabulary', () => {
        const content =
          'Bruit de freinage: symptôme courant indiquant une usure des plaquettes.';
        const violations = validator.validateR5Diagnostic(content);
        const missingSymptom = violations.find(
          (v) => v.type === 'missing_element',
        );
        expect(missingSymptom).toBeUndefined();
      });
    });

    describe('Forbidden commercial content', () => {
      it('rejects commercial keywords in diagnostic content', () => {
        const content =
          'Si vous entendez un bruit, achetez nos plaquettes à 29€.';
        const violations = validator.validateR5Diagnostic(content);
        const commercialViolation = violations.find(
          (v) => v.type === 'forbidden_keyword',
        );
        expect(commercialViolation).toBeDefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EXCLUSIVE VOCABULARY (Anti-Cannibalisation)
  // ═══════════════════════════════════════════════════════════════
  describe('Exclusive Vocabulary Rules', () => {
    describe('R4 cannot use R2 vocabulary', () => {
      it('flags R4 content using commercial terms', () => {
        const content = 'Acheter un disque de frein au meilleur prix.';
        const violations = validator.validateExclusiveVocabulary(
          content,
          PageRole.R4_REFERENCE,
        );
        expect(violations.length).toBeGreaterThan(0);
        expect(violations[0].type).toBe('exclusive_vocab_violation');
      });
    });

    describe('R4 cannot use R5 vocabulary', () => {
      it('flags R4 content using diagnostic terms', () => {
        const content = "Les symptômes d'un disque de frein usé sont visibles.";
        const violations = validator.validateExclusiveVocabulary(
          content,
          PageRole.R4_REFERENCE,
        );
        expect(violations.length).toBeGreaterThan(0);
        expect(violations[0].type).toBe('exclusive_vocab_violation');
      });
    });

    describe('R2 cannot use R5 vocabulary', () => {
      it('flags R2 content using diagnostic terms', () => {
        const content =
          'Disque de frein 45€ - évitez les symptômes de freinage.';
        const violations = validator.validateExclusiveVocabulary(
          content,
          PageRole.R2_PRODUCT,
        );
        expect(violations.length).toBeGreaterThan(0);
      });
    });

    describe('Valid exclusive vocabulary usage', () => {
      it('R4 can use technical definition vocabulary', () => {
        const content =
          'Définition: Le système ABS est un dispositif anti-blocage des roues.';
        const violations = validator.validateExclusiveVocabulary(
          content,
          PageRole.R4_REFERENCE,
        );
        // Should not flag R4-specific terms as violations
        const r4Violation = violations.find((v) =>
          v.message.includes('définition'),
        );
        expect(r4Violation).toBeUndefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FULL PAGE VALIDATION
  // ═══════════════════════════════════════════════════════════════
  describe('Full Page Validation', () => {
    it('validates a complete R1 page', () => {
      const url = '/pieces/freinage-1.html';
      const content = 'Sélectionnez votre marque et modèle de véhicule.';
      const result = validator.validatePage(url, content);

      expect(result.url).toBe(url);
      expect(result.detectedRole).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('validates a complete R4 page', () => {
      const url = '/reference-auto/definition-abs';
      const content =
        "L'ABS (Anti-lock Braking System) est un système électronique qui empêche le blocage des roues lors du freinage.";
      const result = validator.validatePage(url, content);

      expect(result.url).toBe(url);
      expect(result.detectedRole).toBeDefined();
    });

    it('detects role mismatch', () => {
      const url = '/reference-auto/definition-abs'; // Should be R4
      const content = 'Achetez votre capteur ABS à partir de 35€!'; // Commercial = R2 content
      const result = validator.validatePage(url, content);

      // Should have violations due to commercial content in R4 page
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
