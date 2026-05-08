import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  RoleId,
  ROLE_HANDOFF_GRAPH,
  ROLE_HANDOFF_GRAPH_VERSION,
  getHandoffTargets,
  isHandoffAllowed,
} from "../index";

// `__dirname` substitute for both ESM and CJS test runners that point
// at `src/__tests__/` so we can resolve the canon markdown deterministically.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CANON_MD_PATH = resolve(
  __dirname,
  "../../../../.spec/00-canon/role-matrix.md",
);

// Mapping court (R0..R8 dans role-matrix.md) → RoleId enum.
// R3 sans suffixe = canon R3_CONSEILS (R3_GUIDE est déprécié).
const SHORT_TO_ROLE: Readonly<Record<string, RoleId>> = Object.freeze({
  R0: RoleId.R0_HOME,
  R1: RoleId.R1_ROUTER,
  R2: RoleId.R2_PRODUCT,
  R3: RoleId.R3_CONSEILS,
  R4: RoleId.R4_REFERENCE,
  R5: RoleId.R5_DIAGNOSTIC,
  R6: RoleId.R6_GUIDE_ACHAT,
  R7: RoleId.R7_BRAND,
  R8: RoleId.R8_VEHICLE,
});

/**
 * Parse `.spec/00-canon/role-matrix.md` :
 * Pour chaque section `### R<N> — <suffix>`, capture la ligne
 * `- **handoff_targets** : \`[...]\`` et extrait les `target: R<N>`.
 *
 * Retourne `Map<RoleId source, Set<RoleId target>>` pour comparaison
 * set-equality avec `ROLE_HANDOFF_GRAPH`.
 *
 * Robuste aux changements de suffixe de header (« R6 — GUIDE D'ACHAT »
 * vs « R6 — DECISION DOMINANTE ») : on ne dépend que du numéro `R<N>`.
 */
function parseMarkdownHandoffs(md: string): Map<RoleId, Set<RoleId>> {
  const result = new Map<RoleId, Set<RoleId>>();

  // Découpe en sections par les headers `### R<N> — <suffix>`.
  const sectionRegex = /^### (R(\d)) — [^\n]+$/gm;
  const headers: { roleShort: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(md)) !== null) {
    headers.push({ roleShort: match[1], index: match.index });
  }

  for (let i = 0; i < headers.length; i++) {
    const { roleShort, index } = headers[i];
    const sourceRole = SHORT_TO_ROLE[roleShort];
    if (!sourceRole) continue; // numéro hors mapping (ex: R9 déprécié)

    const sectionEnd = i + 1 < headers.length ? headers[i + 1].index : md.length;
    const sectionBody = md.slice(index, sectionEnd);

    // Capture la ligne `- **handoff_targets** : ` puis l'array entre backticks.
    const handoffLine = sectionBody.match(
      /- \*\*handoff_targets\*\*\s*:\s*`(\[[^`]*\])`/,
    );
    if (!handoffLine) {
      result.set(sourceRole, new Set());
      continue;
    }

    const arrayBody = handoffLine[1];
    // Capture chaque `target: R<N>` dans l'array (peu importe la condition).
    const targetRegex = /target:\s*(R\d)/g;
    const targets = new Set<RoleId>();
    let targetMatch: RegExpExecArray | null;
    while ((targetMatch = targetRegex.exec(arrayBody)) !== null) {
      const targetRole = SHORT_TO_ROLE[targetMatch[1]];
      if (targetRole) targets.add(targetRole);
    }
    result.set(sourceRole, targets);
  }

  return result;
}

describe("ROLE_HANDOFF_GRAPH — exhaustivity & shape", () => {
  test("contient une entrée pour chaque RoleId", () => {
    for (const role of Object.values(RoleId)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(ROLE_HANDOFF_GRAPH, role),
        `RoleId ${role} manquant dans ROLE_HANDOFF_GRAPH`,
      );
    }
  });

  test("aucun rôle ne se référence lui-même (pas de self-loop)", () => {
    for (const [source, edges] of Object.entries(ROLE_HANDOFF_GRAPH)) {
      for (const edge of edges) {
        assert.notEqual(
          edge.target,
          source,
          `Self-loop interdit détecté : ${source} → ${edge.target}`,
        );
      }
    }
  });

  test("toutes les cibles sont des RoleId valides", () => {
    const valid = new Set<string>(Object.values(RoleId));
    for (const [source, edges] of Object.entries(ROLE_HANDOFF_GRAPH)) {
      for (const edge of edges) {
        assert.ok(
          valid.has(edge.target),
          `Cible invalide depuis ${source} : ${String(edge.target)}`,
        );
      }
    }
  });

  test("ROLE_HANDOFF_GRAPH_VERSION est un SemVer string", () => {
    assert.match(ROLE_HANDOFF_GRAPH_VERSION, /^\d+\.\d+\.\d+$/);
  });
});

describe("ROLE_HANDOFF_GRAPH — règles métier R6 (amendement ADR-052)", () => {
  test("R6 → R1 (amendement R1 ∈ R6 — vérification compatibilité)", () => {
    assert.equal(isHandoffAllowed(RoleId.R6_GUIDE_ACHAT, RoleId.R1_ROUTER), true);
  });

  test("R6 → R2 (canon : décision prise, prêt à acheter)", () => {
    assert.equal(isHandoffAllowed(RoleId.R6_GUIDE_ACHAT, RoleId.R2_PRODUCT), true);
  });

  test("R6 → R3_CONSEILS (canon : comment remplacer)", () => {
    assert.equal(
      isHandoffAllowed(RoleId.R6_GUIDE_ACHAT, RoleId.R3_CONSEILS),
      true,
    );
  });

  test("R6 → R4 (canon : définition technique)", () => {
    assert.equal(
      isHandoffAllowed(RoleId.R6_GUIDE_ACHAT, RoleId.R4_REFERENCE),
      true,
    );
  });

  test("R6 → R5 (canon : comprendre symptôme — handoff conceptuel uniquement)", () => {
    assert.equal(
      isHandoffAllowed(RoleId.R6_GUIDE_ACHAT, RoleId.R5_DIAGNOSTIC),
      true,
    );
  });

  test("R6 → R3_GUIDE (déprécié) : handoffs vides → false", () => {
    assert.equal(isHandoffAllowed(RoleId.R6_GUIDE_ACHAT, RoleId.R3_GUIDE), false);
  });

  test("R6_SUPPORT n'a aucun handoff sortant", () => {
    assert.deepEqual([...getHandoffTargets(RoleId.R6_SUPPORT)], []);
  });
});

describe("ROLE_HANDOFF_GRAPH — golden set-equality vs .spec/00-canon/role-matrix.md", () => {
  test("chaque rôle source : set(TS) === set(markdown)", () => {
    const md = readFileSync(CANON_MD_PATH, "utf8");
    const mdHandoffs = parseMarkdownHandoffs(md);

    assert.ok(
      mdHandoffs.size >= 9,
      `Parser markdown a trouvé ${mdHandoffs.size} sections, attendu ≥ 9`,
    );

    for (const [sourceRole, mdTargets] of mdHandoffs) {
      const tsTargets = new Set(getHandoffTargets(sourceRole));
      assert.deepEqual(
        tsTargets,
        mdTargets,
        `Drift détecté pour ${sourceRole} :\n` +
          `  TS : ${[...tsTargets].sort().join(", ")}\n` +
          `  MD : ${[...mdTargets].sort().join(", ")}`,
      );
    }
  });
});
