import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AutomationEntrySchema,
  AutomationRealitySchema,
  AutomationModeEnum,
  IntendedModeEnum,
  EvidenceRefSchema,
  RuntimeEvidenceSchema,
  SchemaVersion,
} from "../index";

const baseValid = {
  automation_id: "snapshot-partition-rotation",
  domain: "D3" as const,
  intended_mode: "ACTIVE" as const,
  actual_mode: "SCRIPT_ONLY" as const,
  executor: "pg_cron" as const,
  evidence: [
    {
      path: "backend/supabase/migrations/20260522_seo_snapshot_partition_rotation.sql",
      line: 112,
      excerpt: "cron.schedule('snapshot-partition-rotation'",
    },
  ],
  last_verified_at: "2026-05-24",
  last_verified_by: "seed:fafa",
  last_verified_method: "seed-from-plan-review" as const,
  missing_step: "consumer not identified — downgrade pending audit",
  risk: "medium" as const,
};

describe("AutomationModeEnum / IntendedModeEnum", () => {
  test("AutomationModeEnum includes all 8 observable states", () => {
    const values = AutomationModeEnum.options;
    assert.equal(values.length, 8);
    assert.ok(values.includes("ACTIVE"));
    assert.ok(values.includes("WARN_ONLY_DEGRADED"));
    assert.ok(values.includes("DRAFTED"));
  });

  test("IntendedModeEnum excludes failure/transient states (DRAFTED, MISSING_EXECUTOR, WARN_ONLY_DEGRADED)", () => {
    const intended = IntendedModeEnum.options;
    assert.ok(!intended.includes("DRAFTED" as never));
    assert.ok(!intended.includes("MISSING_EXECUTOR" as never));
    assert.ok(!intended.includes("WARN_ONLY_DEGRADED" as never));
    assert.equal(intended.length, 5);
  });
});

describe("EvidenceRefSchema (anti-drift via excerpt requirement)", () => {
  test("accepts path only (no line)", () => {
    assert.doesNotThrow(() =>
      EvidenceRefSchema.parse({ path: "config/cron/crontab" }),
    );
  });

  test("rejects line: without excerpt: (silent drift risk)", () => {
    assert.throws(() =>
      EvidenceRefSchema.parse({
        path: "pr-dod-gate.yml",
        line: 14,
      }),
    );
  });

  test("accepts line + excerpt pair", () => {
    assert.doesNotThrow(() =>
      EvidenceRefSchema.parse({
        path: "pr-dod-gate.yml",
        line: 14,
        excerpt: "PROMOTION TO BLOCKING",
      }),
    );
  });
});

describe("AutomationEntrySchema — gap = intended ≠ actual", () => {
  test("intended=MANUAL + actual=MANUAL → valid without missing_step (no gap)", () => {
    const entry = {
      ...baseValid,
      automation_id: "pr-9-dep-modernization",
      intended_mode: "MANUAL" as const,
      actual_mode: "MANUAL" as const,
      executor: "human-only" as const,
      missing_step: undefined,
    };
    delete (entry as { missing_step?: string }).missing_step;
    assert.doesNotThrow(() => AutomationEntrySchema.parse(entry));
  });

  test("intended=ACTIVE + actual=SCRIPT_ONLY → requires missing_step", () => {
    const entry = { ...baseValid };
    delete (entry as { missing_step?: string }).missing_step;
    assert.throws(() => AutomationEntrySchema.parse(entry), /missing_step/);
  });

  test("intended=ACTIVE + actual=ACTIVE → requires runtime_evidence", () => {
    const entry = {
      ...baseValid,
      actual_mode: "ACTIVE" as const,
      intended_mode: "ACTIVE" as const,
    };
    delete (entry as { missing_step?: string }).missing_step;
    assert.throws(() => AutomationEntrySchema.parse(entry), /runtime_evidence/);
  });

  test("intended=ACTIVE + actual=ACTIVE + runtime_evidence → valid", () => {
    const entry = {
      ...baseValid,
      actual_mode: "ACTIVE" as const,
      intended_mode: "ACTIVE" as const,
      runtime_evidence: {
        trigger: {
          kind: "db_row" as const,
          source: "cron.job",
          observed_at: "2026-05-24",
          query_or_url: "SELECT * FROM cron.job WHERE jobname='x'",
        },
        output: {
          kind: "db_row" as const,
          source: "pg_class",
          observed_at: "2026-05-24",
        },
        consumer: "no-consumer-by-design" as const,
      },
    };
    delete (entry as { missing_step?: string }).missing_step;
    assert.doesNotThrow(() => AutomationEntrySchema.parse(entry));
  });
});

describe("RuntimeEvidenceSchema — consumer accepts indirect signal OR explicit no-consumer", () => {
  test("consumer as metric (Grafana / dashboard) accepted", () => {
    const re = {
      trigger: {
        kind: "github_run" as const,
        source: "gh run list -w 'snapshot rotation'",
        observed_at: "2026-05-24",
      },
      output: {
        kind: "db_row" as const,
        source: "audit table",
        observed_at: "2026-05-24",
      },
      consumer: {
        kind: "metric" as const,
        source: "grafana-dashboard-rotation-success",
        observed_at: "2026-05-24",
      },
    };
    assert.doesNotThrow(() => RuntimeEvidenceSchema.parse(re));
  });

  test("consumer = 'no-consumer-by-design' accepted (audit-only systems)", () => {
    const re = {
      trigger: {
        kind: "log" as const,
        source: "x",
        observed_at: "2026-05-24",
      },
      output: {
        kind: "log" as const,
        source: "x",
        observed_at: "2026-05-24",
      },
      consumer: "no-consumer-by-design" as const,
    };
    assert.doesNotThrow(() => RuntimeEvidenceSchema.parse(re));
  });
});

describe("WARN_ONLY_DEGRADED requires regression evidence (anti-fourre-tout)", () => {
  test("rejected without note containing 'regression'", () => {
    const entry = {
      ...baseValid,
      actual_mode: "WARN_ONLY_DEGRADED" as const,
      intended_mode: "ACTIVE" as const,
      missing_step: "promote back to blocking",
    };
    assert.throws(
      () => AutomationEntrySchema.parse(entry),
      /WARN_ONLY_DEGRADED requires evidence with a note containing 'regression'/,
    );
  });

  test("accepted with regression note in evidence", () => {
    const entry = {
      ...baseValid,
      actual_mode: "WARN_ONLY_DEGRADED" as const,
      intended_mode: "ACTIVE" as const,
      missing_step: "promote back to blocking",
      evidence: [
        {
          path: ".github/workflows/some-gate.yml",
          note: "regression in incident INC-2026-099 forced continue-on-error",
        },
      ],
    };
    assert.doesNotThrow(() => AutomationEntrySchema.parse(entry));
  });
});

describe("last_verified_by format (anti-bot)", () => {
  test("rejects plain bot name", () => {
    const entry = { ...baseValid, last_verified_by: "dependabot[bot]" };
    assert.throws(() => AutomationEntrySchema.parse(entry));
  });

  test("accepts @github-handle", () => {
    const entry = { ...baseValid, last_verified_by: "@ak125" };
    assert.doesNotThrow(() => AutomationEntrySchema.parse(entry));
  });

  test("accepts seed:<owner> form (V1 initial only)", () => {
    const entry = { ...baseValid, last_verified_by: "seed:fafa" };
    assert.doesNotThrow(() => AutomationEntrySchema.parse(entry));
  });
});

describe("AutomationRealitySchema (registry envelope)", () => {
  test("empty registry valid with schemaVersion", () => {
    const valid = { schemaVersion: SchemaVersion, entries: [] };
    assert.doesNotThrow(() => AutomationRealitySchema.parse(valid));
  });

  test("registry rejects entry without evidence", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      entries: [{ ...baseValid, evidence: [] }],
    };
    assert.throws(() => AutomationRealitySchema.parse(invalid));
  });

  test("registry round-trip preserves entries", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      entries: [baseValid],
    };
    const parsed = AutomationRealitySchema.parse(valid);
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].automation_id, "snapshot-partition-rotation");
  });
});

describe("automation_id format", () => {
  test("rejects uppercase / underscore", () => {
    const entry = { ...baseValid, automation_id: "Snapshot_Rotation" };
    assert.throws(() => AutomationEntrySchema.parse(entry));
  });

  test("rejects too short", () => {
    const entry = { ...baseValid, automation_id: "ab" };
    assert.throws(() => AutomationEntrySchema.parse(entry));
  });

  test("accepts canonical kebab-case", () => {
    const entry = { ...baseValid, automation_id: "dev-runtime-sync" };
    assert.doesNotThrow(() => AutomationEntrySchema.parse(entry));
  });
});
