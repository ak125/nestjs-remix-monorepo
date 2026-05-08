/**
 * pageRoleToRoleId mapping — exhaustive coverage tests
 *
 * Garantit que `pageRoleToRoleId(PageRole)` retourne la bonne `RoleId`
 * canonique pour chaque variante. Détecte régression silencieuse de
 * mapping (ex: R3_BLOG default → R3_GUIDE déprécié au lieu de
 * R3_CONSEILS canon vivant).
 *
 * @see ADR-052 (governance-vault) — fix R3_BLOG default → R3_CONSEILS.
 */
import {
  PageRole,
  pageRoleToRoleId,
  RoleId,
} from '../../src/modules/seo/types/page-role.types';

describe('pageRoleToRoleId — exhaustive PageRole → RoleId mapping', () => {
  describe('Direct 1:1 mappings', () => {
    it('R0_HOME → RoleId.R0_HOME', () => {
      expect(pageRoleToRoleId(PageRole.R0_HOME)).toBe(RoleId.R0_HOME);
    });

    it('R1_ROUTER → RoleId.R1_ROUTER', () => {
      expect(pageRoleToRoleId(PageRole.R1_ROUTER)).toBe(RoleId.R1_ROUTER);
    });

    it('R2_PRODUCT → RoleId.R2_PRODUCT', () => {
      expect(pageRoleToRoleId(PageRole.R2_PRODUCT)).toBe(RoleId.R2_PRODUCT);
    });

    it('R4_REFERENCE → RoleId.R4_REFERENCE', () => {
      expect(pageRoleToRoleId(PageRole.R4_REFERENCE)).toBe(RoleId.R4_REFERENCE);
    });

    it('R5_DIAGNOSTIC → RoleId.R5_DIAGNOSTIC', () => {
      expect(pageRoleToRoleId(PageRole.R5_DIAGNOSTIC)).toBe(RoleId.R5_DIAGNOSTIC);
    });

    it('R6_SUPPORT → RoleId.R6_SUPPORT', () => {
      expect(pageRoleToRoleId(PageRole.R6_SUPPORT)).toBe(RoleId.R6_SUPPORT);
    });

    it('R6_GUIDE_ACHAT → RoleId.R6_GUIDE_ACHAT', () => {
      expect(pageRoleToRoleId(PageRole.R6_GUIDE_ACHAT)).toBe(
        RoleId.R6_GUIDE_ACHAT,
      );
    });

    it('R7_BRAND → RoleId.R7_BRAND', () => {
      expect(pageRoleToRoleId(PageRole.R7_BRAND)).toBe(RoleId.R7_BRAND);
    });

    it('R8_VEHICLE → RoleId.R8_VEHICLE', () => {
      expect(pageRoleToRoleId(PageRole.R8_VEHICLE)).toBe(RoleId.R8_VEHICLE);
    });
  });

  describe('R3_BLOG sub-role disambiguation (ADR-052 fix)', () => {
    it('R3_BLOG with no sub-role → R3_CONSEILS (canon vivant)', () => {
      // Critical regression : avant ADR-052, default = R3_GUIDE déprécié,
      // ce qui faisait que `isLinkAllowed(R6_GUIDE_ACHAT, R3_BLOG)` retournait
      // toujours false (R3_GUIDE n'a pas de handoffs canon).
      expect(pageRoleToRoleId(PageRole.R3_BLOG)).toBe(RoleId.R3_CONSEILS);
    });

    it('R3_BLOG with sub-role "conseils" → R3_CONSEILS', () => {
      expect(pageRoleToRoleId(PageRole.R3_BLOG, 'conseils')).toBe(
        RoleId.R3_CONSEILS,
      );
    });

    it('R3_BLOG with sub-role "guide-achat" → R3_GUIDE (legacy explicite)', () => {
      // Backwards-compat : appelants existants qui distinguaient guide vs
      // conseils via URL pattern recevaient R3_GUIDE pour le guide d'achat.
      // Comportement préservé pour ne pas casser ces appelants ; futures PR
      // peuvent migrer vers R6_GUIDE_ACHAT explicite.
      expect(pageRoleToRoleId(PageRole.R3_BLOG, 'guide-achat')).toBe(
        RoleId.R3_GUIDE,
      );
    });
  });
});
