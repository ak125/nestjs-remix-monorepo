/**
 * Canon fixture stability — drift detection for `getForbiddenOverlap()`.
 *
 * The canon forbidden vocabulary is mirrored to DB via
 * `scripts/seo/export-canon-forbidden.ts` (PR-D, ADR-049). Any change to the
 * TS source (`forbidden-overlap.ts`) shifts the count and hash recorded here ;
 * the test fails as a forcing function to remind operators to :
 *
 *   1. Re-run the export script against the active DB
 *   2. Update the fixture values below
 *   3. Bump `@repo/seo-roles` version (additive minor or breaking major)
 *
 * Without this fixture, a silent TS edit could land in main and stay
 * out-of-sync with the DB cache for days. The DB trigger
 * `tg_skp_canon_check` (PR-D) reads from the cache, so drift = wrong rules
 * enforced.
 *
 * Reference :
 *   - PR-A `forbidden-overlap.ts` (ADR-040 + ADR-047 separation identité/comportement)
 *   - PR-D migration `__seo_role_canon_forbidden` (ADR-049)
 *   - Plan re-audit item iv : "Drift detection canon.json en CI"
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  RoleId,
  FORBIDDEN_ROLE_IDS,
  DEPRECATED_OUTPUT_ROLES,
  getForbiddenOverlap,
} from "../index";

interface FixtureEntry {
  readonly role: RoleId;
  readonly count: number;
  readonly sha256: string;
}

function canonHash(role: RoleId): { count: number; sha256: string } {
  const terms = [...getForbiddenOverlap(role)].sort();
  const sha256 = createHash("sha256").update(terms.join("|")).digest("hex");
  return { count: terms.length, sha256 };
}

const CANON_FIXTURE: readonly FixtureEntry[] = [
  {
    role: RoleId.R1_ROUTER,
    count: 25,
    sha256: "c2abb413b9ca9c60501f4f6a1f80097e94ca1360bde2126f3f4a4bae6bff43c2",
  },
  {
    role: RoleId.R3_CONSEILS,
    count: 20,
    sha256: "a2693bd12c7c62fd7989924b79153d451e0047091594aba2ecb4ac3e717cb40d",
  },
  {
    role: RoleId.R4_REFERENCE,
    count: 18,
    sha256: "2baa87ee1fc4a8fc28ee5e8d0136925351204983422085f34670aeca9daadb85",
  },
  {
    role: RoleId.R5_DIAGNOSTIC,
    count: 13,
    sha256: "f5cde252664809bbb97aaa2fee74a2dd2d70589c1ae83a6fd2b00dda90332976",
  },
  {
    role: RoleId.R6_GUIDE_ACHAT,
    count: 22,
    sha256: "526a0398e8d5fae323b351fa08f96b7b66841939b05b60ae9c010463efb663f5",
  },
  {
    role: RoleId.R6_SUPPORT,
    count: 8,
    sha256: "5a07df225b2161923be26b409dd49be46dc2462b60e934dac84eaae3290bdf19",
  },
  {
    role: RoleId.R7_BRAND,
    count: 12,
    sha256: "27d4b3fe4879cc2d164b73fcf295340d80715753b7e48f31f41f9c03df8e85de",
  },
  {
    role: RoleId.R8_VEHICLE,
    count: 8,
    sha256: "eb4a4023c67fa4ab8999c7cbfd1087bf6497d186fd1113e2cf0bc5a47d928d53",
  },
];

describe("canon fixture — drift detection between TS source and DB cache", () => {
  for (const expected of CANON_FIXTURE) {
    test(`${expected.role} count is pinned at ${expected.count}`, () => {
      const actual = canonHash(expected.role);
      assert.equal(
        actual.count,
        expected.count,
        `Canon count drifted for ${expected.role} : expected ${expected.count}, got ${actual.count}.\n` +
          `Update CANON_FIXTURE in canon-fixture.test.ts AND re-run scripts/seo/export-canon-forbidden.ts to sync DB.\n` +
          `Current sha256 = ${actual.sha256}`,
      );
    });

    test(`${expected.role} content sha256 matches pinned value`, () => {
      const actual = canonHash(expected.role);
      assert.equal(
        actual.sha256,
        expected.sha256,
        `Canon content drifted for ${expected.role} (count may match but terms differ).\n` +
          `Expected sha256 = ${expected.sha256}\n` +
          `Actual   sha256 = ${actual.sha256}\n` +
          `Update CANON_FIXTURE if intentional, revert otherwise.`,
      );
    });
  }

  test("total canon size matches the sum of fixture entries", () => {
    const expectedTotal = CANON_FIXTURE.reduce((sum, e) => sum + e.count, 0);
    let actualTotal = 0;
    for (const role of Object.values(RoleId)) {
      if ((FORBIDDEN_ROLE_IDS as readonly string[]).includes(role)) continue;
      if (DEPRECATED_OUTPUT_ROLES.has(role as never)) continue;
      actualTotal += getForbiddenOverlap(role).length;
    }
    assert.equal(
      actualTotal,
      expectedTotal,
      `Total canon size drift : expected ${expectedTotal}, got ${actualTotal}.`,
    );
  });

  test("forbidden + deprecated roles still emit zero terms", () => {
    for (const role of Object.values(RoleId)) {
      const inForbidden = (FORBIDDEN_ROLE_IDS as readonly string[]).includes(role);
      const inDeprecated = DEPRECATED_OUTPUT_ROLES.has(role as never);
      if (inForbidden || inDeprecated) {
        assert.equal(
          getForbiddenOverlap(role).length,
          0,
          `Role ${role} is forbidden/deprecated but emits forbidden terms.`,
        );
      }
    }
  });
});
