/**
 * tests/registry/planning-builder.test.ts — covers build-planning-registry.js
 * pure transform against a fixed PR fixture (no live `gh` dependency).
 *
 * planning.json is a time-varying external-state snapshot, so it is NOT in the
 * determinism-gated `registry:build` group. This test gates the TRANSFORM logic
 * by injecting a frozen PR list + a fixed `nowMs`, asserting:
 *   - status / priority / work_type mapping from PR fields + labels
 *   - deterministic output (same input → byte-identical JSON)
 *   - graceful degradation when the fetch returns null (V1-3)
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildRegistry,
  mapStatus,
  mapPriority,
  mapWorkType,
} from "../../scripts/registry/build-planning-registry.js";
import { PlanningRegistrySchema } from "../../packages/registry/src/index";

const FIXED_NOW = Date.parse("2026-05-20T12:00:00Z");

const FIXTURE_PRS = [
  {
    number: 601,
    title: "feat(seo): dashboard",
    url: "https://github.com/ak125/nestjs-remix-monorepo/pull/601",
    state: "OPEN",
    isDraft: false,
    author: { login: "ak125" },
    headRefName: "feat/seo-dashboard",
    baseRefName: "main",
    createdAt: "2026-05-13T12:00:00Z", // 7 days before FIXED_NOW
    updatedAt: "2026-05-18T12:00:00Z", // 2 days stale
    labels: [{ name: "P1" }, { name: "seo-runtime" }],
  },
  {
    number: 250,
    title: "draft spike",
    url: "https://github.com/ak125/nestjs-remix-monorepo/pull/250",
    state: "OPEN",
    isDraft: true,
    author: { login: "dependabot" },
    headRefName: "spike/x",
    baseRefName: "feat/seo-dashboard", // stacked
    createdAt: "2026-05-19T12:00:00Z",
    updatedAt: "2026-05-19T12:00:00Z",
    labels: [],
  },
];

describe("mapStatus", () => {
  test("draft → in-progress", () => {
    assert.equal(mapStatus({ state: "OPEN", isDraft: true }), "in-progress");
  });
  test("open non-draft → review", () => {
    assert.equal(mapStatus({ state: "OPEN", isDraft: false }), "review");
  });
  test("merged → done", () => {
    assert.equal(mapStatus({ state: "MERGED", isDraft: false }), "done");
  });
  test("closed → cancelled", () => {
    assert.equal(mapStatus({ state: "CLOSED", isDraft: false }), "cancelled");
  });
});

describe("mapPriority", () => {
  test("reads P0..P8 label", () => {
    assert.equal(mapPriority([{ name: "P0" }]), "P0");
  });
  test("defaults to P5 triage when no priority label", () => {
    assert.equal(mapPriority([{ name: "seo-runtime" }]), "P5");
  });
});

describe("mapWorkType", () => {
  test("reads valid worktype label", () => {
    assert.equal(mapWorkType([{ name: "migration" }]), "migration");
  });
  test("null when no worktype label", () => {
    assert.equal(mapWorkType([{ name: "P1" }]), null);
  });
});

describe("buildRegistry", () => {
  test("maps fixture PRs into canonical entries", () => {
    const reg = buildRegistry(FIXTURE_PRS, FIXED_NOW);
    assert.equal(reg.meta.degraded, false);
    assert.equal(reg.meta.prCount, 2);
    assert.equal(reg.entries.length, 2);

    const pr601 = reg.entries.find((e) => e.number === 601);
    assert.equal(pr601.id, "github:ak125/nestjs-remix-monorepo:pr:601");
    assert.equal(pr601.status, "review");
    assert.equal(pr601.priority, "P1");
    assert.equal(pr601.workType, "seo-runtime");
    assert.equal(pr601.isStack, false);
    assert.equal(pr601.ageDays, 7);
    assert.equal(pr601.stalenessDays, 2);

    const pr250 = reg.entries.find((e) => e.number === 250);
    assert.equal(pr250.status, "in-progress");
    assert.equal(pr250.priority, "P5");
    assert.equal(pr250.workType, null);
    assert.equal(pr250.isStack, true);
  });

  test("entries sorted deterministically by id", () => {
    const reg = buildRegistry(FIXTURE_PRS, FIXED_NOW);
    const ids = reg.entries.map((e) => e.id);
    assert.deepEqual(ids, [...ids].sort());
  });

  test("deterministic: same input → identical JSON body", () => {
    const a = JSON.stringify(buildRegistry(FIXTURE_PRS, FIXED_NOW));
    const b = JSON.stringify(buildRegistry(FIXTURE_PRS, FIXED_NOW));
    assert.equal(a, b);
  });

  test("degrades gracefully when fetch returns null (V1-3)", () => {
    const reg = buildRegistry(null, FIXED_NOW);
    assert.equal(reg.meta.degraded, true);
    assert.equal(reg.meta.prCount, 0);
    assert.deepEqual(reg.entries, []);
  });

  test("output validates against PlanningRegistrySchema (populated)", () => {
    const reg = buildRegistry(FIXTURE_PRS, FIXED_NOW);
    const result = PlanningRegistrySchema.safeParse(reg);
    assert.equal(result.success, true, JSON.stringify(result.error?.format(), null, 2));
  });

  test("output validates against PlanningRegistrySchema (degraded)", () => {
    const reg = buildRegistry(null, FIXED_NOW);
    assert.equal(PlanningRegistrySchema.safeParse(reg).success, true);
  });
});
