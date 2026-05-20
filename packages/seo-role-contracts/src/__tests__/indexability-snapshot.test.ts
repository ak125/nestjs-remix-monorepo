/**
 * indexability-snapshot — test golden master INPUT-based (PR-UIDP-1 v5/C3).
 *
 * Verrouille le comportement de `computeIndexabilityVerdict()` contre 50+
 * inputs stratifiés (toutes branches cascade, toutes surfaces SEO).
 *
 * **INPUT-based** (pas URL-based) :
 *   - Inputs synthétiques immutables, pas de dépendance DB/RPC/live
 *   - Replay-safe par construction
 *   - Drift = explicite (modification fichier requise → revue humaine)
 *
 * Tout changement de comportement de la cascade qui flippe ≥1 verdict
 * cassera ce test → revue obligatoire avant merge.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeIndexabilityVerdict } from "../compose-indexability";
import {
  type IndexabilityInput,
  RobotsVerdictKind,
  ReasonCode,
} from "../robots-verdict";

interface SnapshotEntry {
  stratum: string;
  input: IndexabilityInput;
  expectedKind: keyof typeof RobotsVerdictKind;
  expectedReasonCodes: (keyof typeof ReasonCode)[];
}

// Package tsconfig = CommonJS, donc __dirname dispo. tsx exécute les .ts
// sans transpiler le module — le résolu reste CJS.
const SNAPSHOT: SnapshotEntry[] = JSON.parse(
  readFileSync(
    resolve(__dirname, "../__fixtures__/indexability-snapshot.json"),
    "utf-8",
  ),
) as SnapshotEntry[];

describe("@repo/seo-role-contracts — indexability-snapshot golden master", () => {
  it("fixture contains at least 50 stratified inputs", () => {
    assert.ok(
      SNAPSHOT.length >= 50,
      `fixture must contain ≥50 inputs, got ${SNAPSHOT.length}`,
    );
  });

  it("strata cover ≥10 distinct branches (cascade coverage)", () => {
    const strata = new Set(SNAPSHOT.map((e) => e.stratum));
    assert.ok(
      strata.size >= 10,
      `fixture must cover ≥10 strata, got ${strata.size}: ${[...strata].join(", ")}`,
    );
  });

  for (const entry of SNAPSHOT) {
    it(`${entry.stratum} — ${entry.input.surfaceKey}`, () => {
      const verdict = computeIndexabilityVerdict(entry.input);
      assert.equal(
        verdict.kind,
        entry.expectedKind,
        `${entry.stratum}: kind mismatch (got ${verdict.kind}, expected ${entry.expectedKind})`,
      );
      assert.deepEqual(
        [...verdict.reasonCodes],
        entry.expectedReasonCodes,
        `${entry.stratum}: reasonCodes mismatch`,
      );
    });
  }
});
