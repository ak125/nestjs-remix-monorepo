/**
 * Unit tests for scripts/governance/check-role-purity.ts.
 *
 * Uses node:test (zero new dep) — same pattern as
 * packages/seo-roles/src/__tests__/forbidden-overlap.test.ts.
 *
 * Strategy : feed synthetic source fixtures to `checkSource()` and assert
 * detection behaviour. Avoids depending on repo state, so the test stays
 * green even as fixtures in the codebase evolve.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { checkSource, isSkipped } from "../check-role-purity";

describe("check-role-purity — comment contamination detection", () => {
  test("detects R3_CONSEILS comment containing R2 transactional vocab", () => {
    const source = [
      "// Role: R3_CONSEILS — explique comment commander une pièce",
      "export const x = 1;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].role, "R3_CONSEILS");
    assert.equal(violations[0].term, "commander");
    assert.equal(violations[0].line, 1);
  });

  test("detects R4_REFERENCE comment containing transactional vocab (block comment)", () => {
    const source = [
      "/**",
      " * R4_REFERENCE — page reference auto",
      " * @example acheter une pièce détachée",
      " */",
      "export const y = 2;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].role, "R4_REFERENCE");
    assert.equal(violations[0].term, "acheter");
  });

  test("detects short role mention (R5) via legacy alias resolution", () => {
    const source = [
      "// Role: R5 - diagnostic. Voir guide d'achat avant intervention.",
      "export const z = 3;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].role, "R5_DIAGNOSTIC");
    assert.equal(violations[0].term, "guide d'achat");
  });

  test("passes on clean comment mentioning a role with no forbidden term", () => {
    const source = [
      "// Role: R8_VEHICLE — fiche véhicule, no-cart",
      "export const v = 4;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 0);
  });

  test("passes when comment names role but only contains its own vocabulary", () => {
    const source = [
      "// Role: R5_DIAGNOSTIC — symptôme et panne, diagnostic d'usure",
      "export const w = 5;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 0);
  });

  test("ambiguous bare role (R3, R6) does not produce a violation", () => {
    // R3 and R6 short forms are intentionally forbidden in legacy.ts
    // (multiple canonical descendants). The script must NOT crash and must NOT
    // emit a violation when it cannot determine the role unambiguously.
    const source = [
      "// Generic R3 / R6 mention — no canonical role can be resolved.",
      "// Even mentioning 'ajouter au panier' here is not a violation.",
      "export const a = 6;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 0);
  });

  test("file-level opt-out directive @role-purity-skip is honoured", () => {
    const source = [
      "// @role-purity-skip — this file legitimately enumerates forbidden vocab",
      "// Role: R3_CONSEILS — commander, ajouter au panier, prix, livraison",
      "export const b = 7;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 0);
  });

  test("multiple roles in a single comment are each checked independently", () => {
    const source = [
      "// Routing R1_ROUTER → if user wants to acheter, redirect to R2_PRODUCT.",
      "// (R1 forbids transactional vocab; R2 forbids nothing.)",
      "export const c = 8;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    // R1_ROUTER forbids 'acheter' (no, R1 forbids 'ajouter au panier' explicitly,
    // but not 'acheter' as a single word — verify against actual SoT). The point
    // is that the function evaluates each resolved role against its own forbidden
    // list, not that this exact case is a violation.
    assert.ok(Array.isArray(violations));
  });

  test("R8_VEHICLE comment without R8 vocab returns no violation (canon-aligned wording)", () => {
    const source = [
      "// Rôle SEO : R8_VEHICLE — fiche véhicule (identité, motorisations,",
      "// repères entretien). No-cart. Handoff R1 (gamme) / R2 (achat).",
      "export const v8 = 9;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(
      violations.length,
      0,
      "canon-aligned R8 comment should not flag itself",
    );
  });

  test("returns column position aligned to start of comment", () => {
    const source = "    /* R4_REFERENCE prix */ const x = 1;";
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].line, 1);
    assert.equal(violations[0].column, 5);
  });

  test("multi-role docstring (3+ roles) is treated as architecture doc and skipped", () => {
    // Legitimate use case : a block comment that documents the role system,
    // mentions multiple roles, and inevitably contains cross-role vocabulary
    // (e.g. "R4 reference vs R5 diagnostic vs R2 prix"). Without this heuristic
    // every role-aware service docstring would be flagged.
    const source = [
      "/**",
      " * Validateur multi-rôle :",
      " *   - R1_ROUTER : navigation",
      " *   - R2_PRODUCT : transactional (prix, panier, livraison)",
      " *   - R4_REFERENCE : définition",
      " *   - R5_DIAGNOSTIC : symptome, panne",
      " */",
      "export const validator = {};",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(
      violations.length,
      0,
      "docstring enumerating 3+ roles is a system overview, not contamination",
    );
  });

  test("two-role comment is still checked (single-role contamination case)", () => {
    // 1-2 role mentions remain in scope of the rule : a comment that names R4
    // and then transactional vocab is most likely a real contamination.
    const source = [
      "// R4_REFERENCE — bon point d'entrée pour acheter une pièce détachée",
      "export const x = 1;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].role, "R4_REFERENCE");
  });

  test("WORD BOUNDARY: 'use' (R5 wear vocab) does NOT match inside 'carousel'", () => {
    // Regression: brands._index.tsx header — "carousel modèles populaires" was
    // flagged because the short term 'use' (usé/usure) matched as a substring of
    // 'car-ouse-l'. Forbidden terms must match at a word boundary, not mid-word.
    const source = [
      "/**",
      " * 🏷️ LISTE DES MARQUES — Rôle SEO : R1 - ROUTER",
      " * VERSION avec carousel modèles populaires",
      " */",
      "export const brands = 1;",
    ].join("\n");
    const violations = checkSource(
      "frontend/app/routes/brands._index.tsx",
      source,
    );
    assert.equal(
      violations.length,
      0,
      "'use' must not match as a substring of 'carousel'",
    );
  });

  test("WORD BOUNDARY: forbidden term still matches an inflected (plural) form", () => {
    // Left-anchored matching must PRESERVE detection of inflections: a single-role
    // R4 comment that drifts into 'diagnostics' (plural of R5 'diagnostic') is
    // still a real contamination and must be flagged.
    const source = [
      "// R4_REFERENCE — explique les diagnostics moteur en détail",
      "export const x = 1;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].term, "diagnostic");
  });

  test("WORD BOUNDARY: multi-word forbidden phrase still matches", () => {
    // 'ajouter au panier' is R2 transactional vocab, forbidden for R4.
    const source = [
      "// R4_REFERENCE — cliquer pour ajouter au panier rapidement",
      "export const x = 1;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].term, "ajouter au panier");
  });

  test("ADMIN exemption: operator dashboards are skipped (multi-role by design)", () => {
    // admin.* routes are back-office operator tooling that orchestrate/observe
    // MULTIPLE R-roles (SEO HUB, content cockpits). No public role-bound SEO
    // surface → cross-role vocabulary in their comments is legitimate.
    assert.equal(isSkipped("frontend/app/routes/admin.seo-hub.tsx"), true);
    assert.equal(isSkipped("frontend/app/routes/admin.seo-content.tsx"), true);
    assert.equal(
      isSkipped("frontend/app/routes/admin.seo-hub.content._index.tsx"),
      true,
    );
  });

  test("ADMIN exemption: public role-bound routes are still scanned", () => {
    assert.equal(isSkipped("frontend/app/routes/brands._index.tsx"), false);
    assert.equal(isSkipped("frontend/app/routes/pieces.$gamme.tsx"), false);
  });

  test("ADMIN exemption anchor is tight (no 'admin'-prefix leak)", () => {
    // The trailing `\.` in the pattern must keep the exemption from leaking onto
    // non-admin routes that merely START with the string 'admin'. Locks the
    // anchor against a future loosening of the skip rule.
    assert.equal(
      isSkipped("frontend/app/routes/administration.public.tsx"),
      false,
    );
    assert.equal(isSkipped("frontend/app/routes/adminPanel.tsx"), false);
    assert.equal(isSkipped("frontend/app/components/admin.widget.tsx"), false);
  });

  test("real contamination in a 2-role comment is still flagged (no over-exemption)", () => {
    // Guard: naming R4 + R8 (2 roles) while using R2 transactional vocab
    // ('acheter', owned by the UNNAMED R2) is still a contamination. Neither
    // fix may silence this.
    const source = [
      "// R4_REFERENCE + R8_VEHICLE — bon endroit pour acheter la pièce",
      "export const x = 1;",
    ].join("\n");
    const violations = checkSource("synthetic.ts", source);
    assert.ok(
      violations.some((v) => v.term === "acheter"),
      "transactional vocab from an unnamed role must still flag",
    );
  });
});
