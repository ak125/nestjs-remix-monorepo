/**
 * Conformance tests — `@repo/seo-role-contracts`
 *
 * Garantit :
 *   1. Chaque RoleId canon-content a un contract enregistré
 *   2. Chaque contract passe la validation Zod RoleContract
 *   3. Chaque contract respecte le canon promotion gate ADR-046
 *   4. `getContract(roleId)` throw si rôle deprecated/sunset
 *
 * Lancer : `npm run test --workspace=@repo/seo-role-contracts`
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RoleId } from "@repo/seo-roles";
import {
  CANON_CONTENT_ROLES,
  CONTRACTS,
  getContract,
  RoleContract,
} from "../index";

describe("@repo/seo-role-contracts — conformance", () => {
  it("each canon-content RoleId has a registered contract", () => {
    for (const roleId of CANON_CONTENT_ROLES) {
      const contract = CONTRACTS[roleId];
      assert.ok(
        contract,
        `Missing contract for canon-content role ${roleId}`,
      );
    }
  });

  it("each contract passes Zod RoleContract validation", () => {
    for (const roleId of CANON_CONTENT_ROLES) {
      const contract = CONTRACTS[roleId]!;
      const parsed = RoleContract.safeParse(contract);
      assert.ok(
        parsed.success,
        `Contract for ${roleId} fails Zod validation: ${
          parsed.success ? "" : JSON.stringify(parsed.error.format(), null, 2)
        }`,
      );
    }
  });

  it("each contract has id matching its registry key", () => {
    for (const roleId of CANON_CONTENT_ROLES) {
      const contract = CONTRACTS[roleId]!;
      assert.equal(
        contract.id,
        roleId,
        `Contract id mismatch for ${roleId}: contract.id=${contract.id}`,
      );
    }
  });

  it("each contract requires the 4 canon validation domains (ADR-046)", () => {
    const expected = ["semantic", "role", "diagnostic", "license"].sort();
    for (const roleId of CANON_CONTENT_ROLES) {
      const contract = CONTRACTS[roleId]!;
      const got = [...contract.promotion_gate.requires_validations].sort();
      assert.deepEqual(
        got,
        expected,
        `${roleId} promotion_gate must require all 4 validations (ADR-046 fail-closed). Got: ${got.join(",")}`,
      );
    }
  });

  it("each contract has at least one semantic_intent", () => {
    for (const roleId of CANON_CONTENT_ROLES) {
      const contract = CONTRACTS[roleId]!;
      assert.ok(
        contract.semantic_intents.length >= 1,
        `${roleId} must declare ≥ 1 semantic_intent`,
      );
    }
  });

  it("getContract throws for deprecated/sunset/non-content roles", () => {
    const nonContent: RoleId[] = [
      RoleId.R3_GUIDE, // deprecated
      RoleId.R5_DIAGNOSTIC, // sunset ADR-027
      RoleId.R6_SUPPORT,
      RoleId.R9_GOVERNANCE, // deprecated
      RoleId.AGENTIC_ENGINE, // non-writing
      RoleId.FOUNDATION, // non-writing
    ];
    for (const roleId of nonContent) {
      assert.throws(
        () => getContract(roleId),
        /No contract registered/,
        `getContract(${roleId}) should throw — not a canon-content role`,
      );
    }
  });
});
