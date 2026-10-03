#!/usr/bin/env tsx
/**
 * Tests for checkSchema(), step 2 of validate-automation-overlay.ts. The function
 * is pure (input injected), so these run without the real overlay or git.
 *
 * Regression: zod 4 dropped `ZodError.errors`. The validator iterated it, so any
 * schema violation crashed the CLI (exit 2, "is not iterable") instead of naming
 * the invalid field (exit 1).
 *
 * Run: npm run registry:test:automation-overlay
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { SchemaVersion } from "../../packages/registry/src/index";
import { checkSchema } from "./validate-automation-overlay";

const overlay = (note?: string) => ({
  schemaVersion: SchemaVersion,
  entries: [
    {
      automation_id: "snapshot-partition-rotation",
      domain: "D3",
      intended_mode: "ACTIVE",
      actual_mode: "SCRIPT_ONLY",
      executor: "pg_cron",
      evidence: [{ path: "config/cron/crontab", ...(note === undefined ? {} : { note }) }],
      last_verified_at: "2026-05-24",
      last_verified_by: "seed:fafa",
      last_verified_method: "seed-from-plan-review",
      missing_step: "consumer not identified — downgrade pending audit",
      risk: "medium",
    },
  ],
});

test("valid overlay → parsed data, no finding", () => {
  const r = checkSchema(overlay("x".repeat(140)));
  assert.notEqual(r.data, null);
  assert.deepEqual(r.findings, []);
});

test("evidence note over 140 chars → error naming the field (no crash)", () => {
  const r = checkSchema(overlay("x".repeat(141)));
  assert.equal(r.data, null);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].level, "error");
  assert.equal(r.findings[0].entry, "entries.0.evidence.0.note");
  assert.match(r.findings[0].message, /^Zod: /);
});

test("missing schemaVersion → error naming the field (no crash)", () => {
  const { schemaVersion: _omitted, ...withoutVersion } = overlay();
  const r = checkSchema(withoutVersion);
  assert.equal(r.data, null);
  assert.ok(r.findings.some((f) => f.entry === "schemaVersion" && f.level === "error"));
});
