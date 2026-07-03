/**
 * Characterization test for the shared QualityGate penalty reducer.
 *
 * Pins the EXACT qualityScore / lint score produced by:
 *   - KeywordPlanGatesService.runAllGates (R3, tri-state fail/warn/pass)
 *   - R4LintGatesService.validate          (R4, binary fail/pass)
 *
 * Purpose: prove the start-100 / subtract-penalty / clamp arithmetic is
 * byte-identical BEFORE and AFTER extraction into a shared pure util.
 * These expected numbers are the golden values captured from the
 * pre-refactor implementations.
 */
import { R4LintGatesService, R4LintInput } from './r4-lint-gates.service';
import { KeywordPlanGatesService, SkpRow } from './keyword-plan-gates.service';

describe('QualityGate reducer characterization (byte-identical guard)', () => {
  // ── R4LintGatesService ──────────────────────────────────

  describe('R4LintGatesService.validate score', () => {
    let service: R4LintGatesService;
    beforeEach(() => {
      service = new R4LintGatesService();
    });

    const clean: R4LintInput = {
      definition:
        'Le disque de frein est un composant rotatif du système de freinage automobile à friction.',
      takeaways: [
        'Convertit énergie cinétique en chaleur par friction',
        'Fonctionne par paire sur un essieu',
        'Épaisseur minimale à respecter selon constructeur',
      ],
      role_mecanique:
        'Le disque de frein assure la décélération du véhicule par friction avec les plaquettes. Il dissipe la chaleur générée lors du freinage et maintient la stabilité directionnelle.',
      composition: [
        'Fonte grise GG25 — surface de friction',
        'Moyeu central — fixation au porte-fusée',
      ],
      key_specs: [
        { label: 'Diamètre', value: '256-380 mm', note: 'selon véhicule' },
      ],
      common_questions: [
        {
          question: 'Peut-on rectifier un disque ?',
          answer:
            'La rectification est possible si le disque reste au-dessus de son épaisseur minimale.',
        },
      ],
      regles_metier: [
        'Toujours intervenir par paire sur un essieu complet',
        'Ne jamais réutiliser un disque sous épaisseur minimale',
      ],
      scope_limites:
        'Concerne uniquement le disque de frein en tant que pièce de rechange.',
      targetKeywords: ['disque de frein', 'frein', 'freinage'],
    };

    it('clean input → score 100, pass true', () => {
      const r = service.validate(clean);
      expect(r.score).toBe(100);
      expect(r.pass).toBe(true);
    });

    it('LG1 (30) + LG4 (10) fail → score 60', () => {
      const r = service.validate({
        ...clean,
        definition: 'Le prix pas cher avec livraison rapide.',
        regles_metier: ['freiner', 'supporter'],
      });
      // LG1 forbidden=-30, LG4 rules=-10 → 60
      expect(r.score).toBe(60);
      expect(r.pass).toBe(false);
    });

    it('many fails clamp to 0', () => {
      const r = service.validate({
        ...clean,
        definition:
          'Étape 1 : acheter pas cher en promo livraison. Ce symptome de panne joue un rôle essentiel. Guide achat budget.',
        role_mecanique:
          'Étape 1 : acheter pas cher en promo livraison. Ce symptome de panne joue un rôle essentiel. Guide achat budget.',
        regles_metier: ['freiner', 'supporter'],
        key_specs: [{ label: 'test', value: '1' }],
        common_questions: [
          { question: 'Q?', answer: Array(70).fill('mot').join(' ') },
        ],
        targetKeywords: ['inexistant'],
      });
      expect(r.score).toBe(0);
      expect(r.pass).toBe(false);
    });
  });

  // ── KeywordPlanGatesService ─────────────────────────────

  describe('KeywordPlanGatesService.runAllGates qualityScore', () => {
    let service: KeywordPlanGatesService;
    beforeEach(() => {
      service = new KeywordPlanGatesService();
    });

    // All gates pass: valid intent, no pricing terms, mapped cluster.
    const cleanRow: SkpRow = {
      skp_pg_id: 1,
      skp_pg_alias: 'disque-de-frein',
      skp_primary_intent: 'informational',
      skp_secondary_intents: [],
      skp_boundaries: {},
      skp_heading_plan: { h1: 'Quand changer un disque de frein' },
      skp_query_clusters: {
        c1: [{ head: ['quand changer disque'], section_target: 'S2' }],
      },
      skp_section_terms: {
        S2: { include_terms: ['usure', 'intervalle'] },
      },
      skp_seo_brief: { recommended_anchors: ['/pieces/disque-de-frein'] },
    };

    it('clean row → qualityScore 100', () => {
      const r = service.runAllGates(cleanRow);
      expect(r.qualityScore).toBe(100);
    });

    // G1 fail (missing intent) = -30 ; everything else pass.
    it('G1 fail (missing intent) → qualityScore 70', () => {
      const r = service.runAllGates({ ...cleanRow, skp_primary_intent: null });
      expect(r.qualityScore).toBe(70);
    });

    // G5 full fail (>2 FAQ dup) = -10.
    it('G5 fail (FAQ dup >2) → qualityScore 90', () => {
      const row: SkpRow = {
        ...cleanRow,
        skp_query_clusters: {
          c1: [
            {
              head: ['quand changer disque'],
              section_target: 'S2',
              paa_questions: [
                'quand changer disque',
                'prix disque',
                'usure disque',
              ],
            } as never,
          ],
        },
        skp_section_terms: {
          S2: {
            include_terms: ['usure'],
            faq_questions: [
              'quand changer disque',
              'prix disque',
              'usure disque',
            ],
          },
        },
      };
      const r = service.runAllGates(row);
      expect(r.qualityScore).toBe(90);
    });

    // G4 warn path: 7 sections (21 pairs), exactly 1 overlapping pair so
    // duplicationScore = 1/21 ≈ 0.048 <= maxDuplicationScore(0.15) → 'warn'.
    // warn penalty = floor(15/2) = 7 → 100 - 7 = 93.
    it('G4 warn (half penalty) → qualityScore 93', () => {
      const terms: Record<string, { include_terms?: string[] }> = {
        S1: { include_terms: ['shared', 'a1'] },
        S2: { include_terms: ['shared', 'b1'] },
        S3: { include_terms: ['c1', 'c2'] },
        S4: { include_terms: ['d1', 'd2'] },
        S5: { include_terms: ['e1', 'e2'] },
        S6: { include_terms: ['f1', 'f2'] },
        S7: { include_terms: ['g1', 'g2'] },
      };
      const row: SkpRow = { ...cleanRow, skp_section_terms: terms };
      const r = service.runAllGates(row);
      expect(r.qualityScore).toBe(93);
    });
  });
});
