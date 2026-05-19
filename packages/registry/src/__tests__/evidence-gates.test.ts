import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import {
  EvidenceGatesRegistrySchema,
  EvidenceGateEntrySchema,
  type EvidenceGatesRegistry,
} from "../overlay/evidence-gates";

const CANON_PATH = path.resolve(
  __dirname,
  "../../../../.spec/00-canon/repository-registry/evidence-gates.yaml",
);

function loadCanon(): EvidenceGatesRegistry {
  const raw = fs.readFileSync(CANON_PATH, "utf-8");
  const parsed = yaml.load(raw);
  return EvidenceGatesRegistrySchema.parse(parsed);
}

describe("evidence-gates.yaml — canon file integrity", () => {
  test("parses cleanly with Zod", () => {
    assert.doesNotThrow(() => loadCanon());
  });

  test("contains exactly 10 gates G1..G10 (canon-frozen by ADR-077)", () => {
    const c = loadCanon();
    assert.equal(c.entries.length, 10);
    const ids = c.entries.map((e) => e.id).sort();
    assert.deepEqual(ids, [
      "G1",
      "G10",
      "G2",
      "G3",
      "G4",
      "G5",
      "G6",
      "G7",
      "G8",
      "G9",
    ]);
  });

  test("every gate references ADR-077 (single canon source)", () => {
    const c = loadCanon();
    for (const g of c.entries) {
      assert.equal(g.source_adr, "ADR-077", `Gate ${g.id} must reference ADR-077`);
    }
  });

  test("source_adr_url points to governance-vault main branch ADR-077", () => {
    const c = loadCanon();
    assert.match(c.source_adr_url, /governance-vault\/blob\/main\/.*ADR-077/);
  });

  test("derived gates depend on existing gate IDs only", () => {
    const c = loadCanon();
    const ids = new Set(c.entries.map((e) => e.id));
    for (const g of c.entries) {
      if (g.trigger.type === "derived") {
        for (const dep of g.trigger.depends_on) {
          assert.ok(
            ids.has(dep),
            `Gate ${g.id} depends_on ${dep} which is not a known gate`,
          );
          assert.notEqual(
            dep,
            g.id,
            `Gate ${g.id} cannot depend on itself`,
          );
        }
      }
    }
  });

  test("every blocked_path is a relative path (no absolute paths, no scheme)", () => {
    const c = loadCanon();
    for (const g of c.entries) {
      for (const p of g.blocked_paths) {
        assert.ok(
          !p.startsWith("/"),
          `Gate ${g.id} blocked_path "${p}" must not be absolute`,
        );
        assert.ok(
          !p.includes("://"),
          `Gate ${g.id} blocked_path "${p}" must not contain a URL scheme`,
        );
      }
    }
  });

  test("at least one gate is auto-detectable (G1 funnel-derivable)", () => {
    const c = loadCanon();
    const autoOrHybrid = c.entries.filter(
      (g) => g.trigger.type === "auto" || g.trigger.type === "hybrid",
    );
    assert.ok(
      autoOrHybrid.length >= 2,
      "Need at least 2 auto/hybrid gates for the status reporter to function",
    );
  });

  test("promotion_path mentions ADR step for every gate (no shortcut allowed)", () => {
    const c = loadCanon();
    for (const g of c.entries) {
      assert.match(
        g.promotion_path,
        /ADR/i,
        `Gate ${g.id} promotion_path must reference an ADR step`,
      );
    }
  });
});

describe("EvidenceGateEntrySchema — anti-pattern guards", () => {
  test("rejects gate id not matching /^G\\d+$/", () => {
    const bad = {
      id: "Gate1",
      item: "x",
      description: "x",
      domain: "D7",
      trigger: { type: "reactive", signal: "x" },
      promotion_path: "ADR -> plan -> PR",
      source_adr: "ADR-077",
    };
    assert.equal(EvidenceGateEntrySchema.safeParse(bad).success, false);
  });

  test("rejects derived trigger with empty depends_on", () => {
    const bad = {
      id: "G99",
      item: "x",
      description: "x",
      domain: "D7",
      trigger: { type: "derived", depends_on: [], condition: "x" },
      promotion_path: "ADR -> plan -> PR",
      source_adr: "ADR-077",
    };
    assert.equal(EvidenceGateEntrySchema.safeParse(bad).success, false);
  });

  test("rejects non-ADR-077 source_adr (single canon source enforcement)", () => {
    const bad = {
      id: "G99",
      item: "x",
      description: "x",
      domain: "D7",
      trigger: { type: "reactive", signal: "x" },
      promotion_path: "ADR -> plan -> PR",
      source_adr: "ADR-076",
    };
    assert.equal(EvidenceGateEntrySchema.safeParse(bad).success, false);
  });

  test("rejects unknown domain", () => {
    const bad = {
      id: "G99",
      item: "x",
      description: "x",
      domain: "D99",
      trigger: { type: "reactive", signal: "x" },
      promotion_path: "ADR -> plan -> PR",
      source_adr: "ADR-077",
    };
    assert.equal(EvidenceGateEntrySchema.safeParse(bad).success, false);
  });
});

describe("EvidenceGatesRegistrySchema — registry-level invariants", () => {
  test("rejects registry with != 10 entries (canon-frozen)", () => {
    const bad = {
      schemaVersion: "1.0.0",
      source_adr_url: "https://github.com/ak125/governance-vault/blob/main/x",
      canon_freeze_date: "2026-05-19",
      parent_plan: "project_diagnostic_control_plane_v1_plan",
      entries: [],
    };
    assert.equal(EvidenceGatesRegistrySchema.safeParse(bad).success, false);
  });

  test("rejects malformed canon_freeze_date", () => {
    const c = loadCanon();
    const bad = { ...c, canon_freeze_date: "May 19, 2026" };
    assert.equal(EvidenceGatesRegistrySchema.safeParse(bad).success, false);
  });
});
