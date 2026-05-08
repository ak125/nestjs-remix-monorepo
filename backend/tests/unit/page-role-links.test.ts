/**
 * PageRole Link Hierarchy Tests
 *
 * Validates that internal links follow the canonical `ROLE_HANDOFF_GRAPH`
 * (mirror typé de `.spec/00-canon/role-matrix.md`, cf @repo/seo-roles).
 *
 * Distinction (ADR-052) :
 *   - `isLinkAllowed`           → handoff conceptuel canon (planning)
 *   - `isRenderableLinkAllowed` → handoff + surface routable (rendu public)
 *
 * @see ADR-052 (governance-vault) — hoist + amendement R6 → R1.
 */
import { PageRoleValidatorService } from '../../src/modules/seo/validation/page-role-validator.service';
import {
  PageRole,
  isLinkAllowed,
  isRenderableLinkAllowed,
  isRoleAbove,
} from '../../src/modules/seo/types/page-role.types';

describe('PageRole Link Hierarchy', () => {
  let validator: PageRoleValidatorService;

  beforeAll(() => {
    validator = new PageRoleValidatorService();
  });

  // ═══════════════════════════════════════════════════════════════
  // CANONICAL HANDOFF MATRIX (ROLE_HANDOFF_GRAPH source of truth)
  // ═══════════════════════════════════════════════════════════════
  describe('isLinkAllowed — canonical handoff matrix', () => {
    describe('R6_GUIDE_ACHAT handoffs (ADR-052 amendement R1 ∈ R6)', () => {
      it('R6 → R1 (verifier compatibilite avant commande) — amendement', () => {
        expect(
          isLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R1_ROUTER),
        ).toBe(true);
      });

      it('R6 → R2 (decision prise, pret a acheter)', () => {
        expect(
          isLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R2_PRODUCT),
        ).toBe(true);
      });

      it('R6 → R3 (comment remplacer)', () => {
        expect(
          isLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R3_BLOG),
        ).toBe(true);
      });

      it('R6 → R4 (definition technique)', () => {
        expect(
          isLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R4_REFERENCE),
        ).toBe(true);
      });

      it('R6 → R5 (comprendre symptome) — handoff conceptuel uniquement', () => {
        expect(
          isLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R5_DIAGNOSTIC),
        ).toBe(true);
      });
    });

    describe('R6_SUPPORT — pas de handoffs sortants', () => {
      it('R6_SUPPORT → R1 = false', () => {
        expect(isLinkAllowed(PageRole.R6_SUPPORT, PageRole.R1_ROUTER)).toBe(
          false,
        );
      });

      it('R6_SUPPORT → R2 = false', () => {
        expect(isLinkAllowed(PageRole.R6_SUPPORT, PageRole.R2_PRODUCT)).toBe(
          false,
        );
      });
    });

    describe('R0_HOME canon handoffs', () => {
      it('R0 → R1 (besoin gamme)', () => {
        expect(isLinkAllowed(PageRole.R0_HOME, PageRole.R1_ROUTER)).toBe(true);
      });

      it('R0 → R7 (besoin marque)', () => {
        expect(isLinkAllowed(PageRole.R0_HOME, PageRole.R7_BRAND)).toBe(true);
      });

      it('R0 → R8 (besoin vehicule)', () => {
        expect(isLinkAllowed(PageRole.R0_HOME, PageRole.R8_VEHICLE)).toBe(true);
      });

      it('R0 → R6 (besoin guide achat)', () => {
        expect(isLinkAllowed(PageRole.R0_HOME, PageRole.R6_GUIDE_ACHAT)).toBe(
          true,
        );
      });

      it('R0 → R2 = false (canon ne liste pas R2 directement)', () => {
        expect(isLinkAllowed(PageRole.R0_HOME, PageRole.R2_PRODUCT)).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERABLE LINK GATE (handoff + surface routable)
  // ═══════════════════════════════════════════════════════════════
  describe('isRenderableLinkAllowed — handoff + surface routable', () => {
    it('R6 → R1 = true (R1 routable)', () => {
      expect(
        isRenderableLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R1_ROUTER),
      ).toBe(true);
    });

    it('R6 → R2 = true (R2 routable)', () => {
      expect(
        isRenderableLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R2_PRODUCT),
      ).toBe(true);
    });

    it('R6 → R3 = true (R3_CONSEILS routable, par défaut R3_BLOG → R3_CONSEILS)', () => {
      expect(
        isRenderableLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R3_BLOG),
      ).toBe(true);
    });

    it('R6 → R4 = true (R4 routable)', () => {
      expect(
        isRenderableLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R4_REFERENCE),
      ).toBe(true);
    });

    it('R6 → R5 = false (handoff OK mais R5 non routable autonome — ADR-027)', () => {
      // Cas critique : handoff conceptuel autorisé canon, mais R5 sunset
      // autonome (ADR-027) — pas de surface URL publique. Évite la
      // résurrection de liens publics R5.
      expect(isLinkAllowed(PageRole.R6_GUIDE_ACHAT, PageRole.R5_DIAGNOSTIC)).toBe(
        true,
      );
      expect(
        isRenderableLinkAllowed(
          PageRole.R6_GUIDE_ACHAT,
          PageRole.R5_DIAGNOSTIC,
        ),
      ).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // HIERARCHY TESTS (existant, inchangé)
  // ═══════════════════════════════════════════════════════════════
  describe('isRoleAbove helper', () => {
    it('R4 is above R3', () => {
      expect(isRoleAbove(PageRole.R4_REFERENCE, PageRole.R3_BLOG)).toBe(true);
    });

    it('R4 is above R2', () => {
      expect(isRoleAbove(PageRole.R4_REFERENCE, PageRole.R2_PRODUCT)).toBe(true);
    });

    it('R3 is above R1', () => {
      expect(isRoleAbove(PageRole.R3_BLOG, PageRole.R1_ROUTER)).toBe(true);
    });

    it('R1 is above R2', () => {
      expect(isRoleAbove(PageRole.R1_ROUTER, PageRole.R2_PRODUCT)).toBe(true);
    });

    it('R2 is NOT above R1 (inverse)', () => {
      expect(isRoleAbove(PageRole.R2_PRODUCT, PageRole.R1_ROUTER)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMPLETE LINKING MATRIX vs canonical ROLE_HANDOFF_GRAPH
  // ═══════════════════════════════════════════════════════════════
  describe('Complete Linking Matrix (canonical)', () => {
    /**
     * Source of truth : `.spec/00-canon/role-matrix.md` `handoff_targets`
     * mirroré dans `@repo/seo-roles/handoff-graph.ts`.
     *
     * Note R3_BLOG default → R3_CONSEILS (ADR-052 fix). Donc tous les
     * tests `R3 → X` reflètent ce qui est dans `R3_CONSEILS.handoff_targets`.
     */
    const testCases = [
      // From R0 Home
      { from: 'R0', to: 'R1', allowed: true },
      { from: 'R0', to: 'R7', allowed: true },
      { from: 'R0', to: 'R8', allowed: true },
      { from: 'R0', to: 'R5', allowed: true },
      { from: 'R0', to: 'R6', allowed: true },
      { from: 'R0', to: 'R2', allowed: false },
      { from: 'R0', to: 'R4', allowed: false },

      // From R1 Router
      { from: 'R1', to: 'R2', allowed: true },
      { from: 'R1', to: 'R4', allowed: true },
      { from: 'R1', to: 'R5', allowed: true },
      { from: 'R1', to: 'R3', allowed: true },
      { from: 'R1', to: 'R6', allowed: true },

      // From R2 Product
      { from: 'R2', to: 'R1', allowed: true },
      { from: 'R2', to: 'R3', allowed: true },
      { from: 'R2', to: 'R4', allowed: true },
      { from: 'R2', to: 'R6', allowed: true },
      { from: 'R2', to: 'R5', allowed: false },

      // From R3 (default → R3_CONSEILS canon)
      { from: 'R3', to: 'R6', allowed: true },
      { from: 'R3', to: 'R5', allowed: true },
      { from: 'R3', to: 'R4', allowed: true },
      { from: 'R3', to: 'R1', allowed: false },
      { from: 'R3', to: 'R2', allowed: false },

      // From R4 Reference
      { from: 'R4', to: 'R3', allowed: true },
      { from: 'R4', to: 'R5', allowed: true },
      { from: 'R4', to: 'R1', allowed: true },
      { from: 'R4', to: 'R6', allowed: true },
      { from: 'R4', to: 'R2', allowed: false },

      // From R5 Diagnostic
      { from: 'R5', to: 'R3', allowed: true },
      { from: 'R5', to: 'R4', allowed: true },
      { from: 'R5', to: 'R1', allowed: true },
      { from: 'R5', to: 'R2', allowed: false },
      { from: 'R5', to: 'R6', allowed: false },

      // From R6 Guide d'achat (ADR-052 amendement)
      { from: 'R6', to: 'R1', allowed: true },
      { from: 'R6', to: 'R2', allowed: true },
      { from: 'R6', to: 'R3', allowed: true },
      { from: 'R6', to: 'R4', allowed: true },
      { from: 'R6', to: 'R5', allowed: true },

      // From R7 Brand
      { from: 'R7', to: 'R8', allowed: true },
      { from: 'R7', to: 'R1', allowed: true },
      { from: 'R7', to: 'R2', allowed: true },

      // From R8 Vehicle
      { from: 'R8', to: 'R1', allowed: true },
      { from: 'R8', to: 'R3', allowed: true },
      { from: 'R8', to: 'R5', allowed: true },
      { from: 'R8', to: 'R7', allowed: true },
      { from: 'R8', to: 'R2', allowed: false },

      // From R6_SUPPORT (no outbound)
      { from: 'R6S', to: 'R1', allowed: false },
      { from: 'R6S', to: 'R2', allowed: false },
    ];

    const roleMap: Record<string, PageRole> = {
      R0: PageRole.R0_HOME,
      R1: PageRole.R1_ROUTER,
      R2: PageRole.R2_PRODUCT,
      R3: PageRole.R3_BLOG, // default → R3_CONSEILS canon (ADR-052 fix)
      R4: PageRole.R4_REFERENCE,
      R5: PageRole.R5_DIAGNOSTIC,
      R6: PageRole.R6_GUIDE_ACHAT,
      R6S: PageRole.R6_SUPPORT,
      R7: PageRole.R7_BRAND,
      R8: PageRole.R8_VEHICLE,
    };

    it.each(testCases)(
      '$from → $to should be $allowed',
      ({ from, to, allowed }) => {
        const result = isLinkAllowed(roleMap[from], roleMap[to]);
        expect(result).toBe(allowed);
      },
    );
  });
});
