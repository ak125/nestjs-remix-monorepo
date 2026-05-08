/**
 * surface-keys — tests Zod + mapping role.
 *
 * Lancer : `npm run test --workspace=@repo/seo-role-contracts`
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RoleId } from "@repo/seo-roles";
import {
  SURFACE_TO_ROLE,
  SurfaceKeySchema,
  surfaceToRole,
  type SurfaceKey,
} from "../surface-keys";

describe("@repo/seo-role-contracts — surface-keys", () => {
  it("parses a valid surface key", () => {
    const parsed = SurfaceKeySchema.safeParse("R8_VEHICLE");
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data, "R8_VEHICLE");
    }
  });

  it("throws on an unknown surface key", () => {
    const parsed = SurfaceKeySchema.safeParse("R99_UNKNOWN");
    assert.equal(parsed.success, false);
    assert.throws(() => SurfaceKeySchema.parse("R99_UNKNOWN"));
  });

  it("surfaceToRole maps every surface to a canonical RoleId", () => {
    const cases: Array<[SurfaceKey, RoleId]> = [
      ["R0_HOME", RoleId.R0_HOME],
      ["R1_GAMME_ROUTER", RoleId.R1_ROUTER],
      ["R1_GAMME_VEHICLE_ROUTER", RoleId.R1_ROUTER],
      ["R2_PRODUCT_LIST", RoleId.R2_PRODUCT],
      ["R2_PRODUCT", RoleId.R2_PRODUCT],
      ["R2_PRODUCT_IN_VEHICLE", RoleId.R2_PRODUCT],
      ["R3_ADVICE", RoleId.R3_CONSEILS],
      ["R3_DIAG_SECTION", RoleId.R3_CONSEILS],
      ["R6_BUYING_GUIDE", RoleId.R6_GUIDE_ACHAT],
      ["R7_BRAND_HUB", RoleId.R7_BRAND],
      ["R8_VEHICLE", RoleId.R8_VEHICLE],
      ["BLOG_ADVICE", RoleId.R3_CONSEILS],
      ["BLOG_ARTICLE", RoleId.R3_CONSEILS],
      ["STATIC_PAGE", RoleId.R0_HOME],
      ["UNAVAILABLE_410", RoleId.R0_HOME],
      ["UNAVAILABLE_412", RoleId.R0_HOME],
    ];
    for (const [surface, expectedRole] of cases) {
      assert.equal(
        surfaceToRole(surface),
        expectedRole,
        `surface ${surface} should map to ${expectedRole}`,
      );
      assert.equal(SURFACE_TO_ROLE[surface], expectedRole);
    }
    assert.equal(SurfaceKeySchema.options.length, 16);
  });
});
