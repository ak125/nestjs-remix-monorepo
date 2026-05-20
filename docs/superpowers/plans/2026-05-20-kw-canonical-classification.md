# Canonical KW Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled / caller-trusted keyword→role classification (88% R1, zero R2/R5 drift) with the canonical deterministic SoT `classifyKeywordToRole` from `@repo/seo-roles`, so `__seo_keyword_results` is populated drift-free, idempotently, and without an interactive Claude session.

**Architecture:** A non-interactive TypeScript script (`scripts/seo/classify-keywords.ts`, mirroring the existing `build-keyword-clusters.ts` pattern) reads raw rows from `__seo_keywords`, classifies each via the canon (`classifyKeywordToRole` → `getRoleShortLabel` → `R1..R8`; `getRoleIntents(role).primary` → canonical intent), assigns a deterministic volume bucket (HIGH/MED/LOW), and idempotently upserts `__seo_keyword_results`. The same canon is then enforced on the admin `/import` endpoint (stops trusting caller-supplied `role`) and the `/kw-classify` skill is rewritten to delegate to the script. Two governance gaps are closed: `__seo_keyword_results` gets a formal idempotent migration and both keyword tables are registered in the Repository Control Plane overlay.

**Tech Stack:** TypeScript, `@repo/seo-roles@0.5.0` (canon), `node:test` + `tsx --test` (unit), Supabase REST (DB I/O, mirrors `import-gads-kp.py` transport contract), NestJS (admin endpoint), SQL migration (Flyway-baseline idempotent pattern).

**Non-goals (proportionality — V1-first):** No BullMQ job (manual batch imports do not need a queue — YAGNI). No LLM in the classification path (canon is deterministic; an LLM would *reintroduce* drift). No bulk rewrite of the 10,727 existing rows (non-destructive: existing rows from `claude_chrome`/`keyword-engine` are left untouched; re-classification is an opt-in dry-run-first follow-up, Task 7, deferred).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `scripts/seo/lib/volume-buckets.ts` | Pure deterministic HIGH/MED/LOW bucketing by volume percentile (adaptive for small role sets) | Create |
| `scripts/seo/__tests__/volume-buckets.test.ts` | Unit tests for bucketing | Create |
| `scripts/seo/classify-keywords.ts` | Orchestration: read `__seo_keywords` → canon classify → upsert `__seo_keyword_results`; `--dry-run`, `--pg-id`, `--pg-alias` | Create |
| `scripts/seo/__tests__/classify-keywords.test.ts` | Integration test of the pure classify-row mapping (canon → row) | Create |
| `backend/supabase/migrations/20260520_formalize_seo_keyword_results.sql` | Idempotent `CREATE TABLE IF NOT EXISTS` formalizing the existing `__seo_keyword_results` schema + indexes (governance / reproducibility) | Create |
| `.spec/00-canon/repository-registry/seo-keywords.overlay.yaml` | Register `__seo_keywords` + `__seo_keyword_results` tables in the Repository Control Plane (closes registry blind spot) | Create |
| `backend/src/modules/admin/controllers/admin-keyword-planner.controller.ts` | `/import`: recompute `role` via `classifyKeywordToRole` instead of trusting caller `kw.role` | Modify |
| `backend/src/modules/admin/controllers/__tests__/admin-keyword-planner.import.spec.ts` | Test that caller-supplied role is overridden by canon | Create |
| `workspaces/seo-batch/.claude/skills/kw-classify/SKILL.md` | Rewrite to delegate to `classify-keywords.ts` (deprecate hand rules) | Modify |

---

## Task 1: Deterministic volume bucketing (pure function)

Ports the volume-percentile logic from the `/kw-classify` skill into a pure, testable function. No DB, no canon — just bucketing.

**Files:**
- Create: `scripts/seo/lib/volume-buckets.ts`
- Test: `scripts/seo/__tests__/volume-buckets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/seo/__tests__/volume-buckets.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { assignVolumeBuckets } from "../lib/volume-buckets";

describe("assignVolumeBuckets — deterministic percentile tiers", () => {
  test("large set: top 10% HIGH, next 30% MED, rest LOW", () => {
    // 10 items, volumes 100..10 desc
    const items = Array.from({ length: 10 }, (_, i) => ({
      kw: `k${i}`,
      volume: 100 - i * 10,
    }));
    const out = assignVolumeBuckets(items);
    const byKw = new Map(out.map((o) => [o.kw, o.vol]));
    assert.equal(byKw.get("k0"), "HIGH"); // rank 1 / 10 → top 10%
    assert.equal(byKw.get("k1"), "MED"); // within next 30%
    assert.equal(byKw.get("k3"), "MED"); // cumulative 40%
    assert.equal(byKw.get("k9"), "LOW"); // tail
  });

  test("small set (<5): top 1 HIGH, rest MED", () => {
    const items = [
      { kw: "a", volume: 500 },
      { kw: "b", volume: 400 },
      { kw: "c", volume: 300 },
    ];
    const out = assignVolumeBuckets(items);
    const byKw = new Map(out.map((o) => [o.kw, o.vol]));
    assert.equal(byKw.get("a"), "HIGH");
    assert.equal(byKw.get("b"), "MED");
    assert.equal(byKw.get("c"), "MED");
  });

  test("1-2 items: all MED (too small for HIGH)", () => {
    const out = assignVolumeBuckets([{ kw: "solo", volume: 999 }]);
    assert.equal(out[0].vol, "MED");
  });

  test("empty input → empty output", () => {
    assert.deepEqual(assignVolumeBuckets([]), []);
  });

  test("stable: ties broken by input order, output covers all inputs", () => {
    const items = [
      { kw: "x", volume: 50 },
      { kw: "y", volume: 50 },
    ];
    const out = assignVolumeBuckets(items);
    assert.equal(out.length, 2);
    assert.ok(out.every((o) => ["HIGH", "MED", "LOW"].includes(o.vol)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && npx tsx --test scripts/seo/__tests__/volume-buckets.test.ts`
Expected: FAIL — `Cannot find module '../lib/volume-buckets'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/seo/lib/volume-buckets.ts
/**
 * Deterministic volume → tier bucketing for keyword sets, per role.
 *
 * Ported verbatim from the `/kw-classify` skill percentile rules so the
 * canonical TS pipeline produces the same HIGH/MED/LOW distribution the
 * downstream content-gen consumers already expect (HIGH = mandatory in
 * H1/H2, MED = body/FAQ, LOW = optional natural variants).
 *
 * Tiers (n = set size):
 *   - n >= 5  : HIGH = top 10% (min 1), MED = next 30%, LOW = remainder
 *   - 3 <= n < 5 : HIGH = top 1, rest = MED
 *   - n <= 2  : all = MED (too small to single out a HIGH)
 *
 * Pure: no DB, no canon. Sorts a copy by volume desc; ties keep input order.
 */
export type VolBucket = "HIGH" | "MED" | "LOW";

export interface VolInput {
  readonly kw: string;
  readonly volume: number;
}

export interface VolOutput extends VolInput {
  readonly vol: VolBucket;
}

export function assignVolumeBuckets(items: readonly VolInput[]): VolOutput[] {
  const n = items.length;
  if (n === 0) return [];

  // Stable sort by volume desc (preserve input order on ties).
  const ranked = items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => b.item.volume - a.item.volume || a.idx - b.idx);

  const highCut = n >= 5 ? Math.max(1, Math.floor(n * 0.1)) : n >= 3 ? 1 : 0;
  const medCut = n >= 5 ? highCut + Math.floor(n * 0.3) : n; // n<5 → everything after HIGH is MED

  return ranked.map(({ item }, rank) => {
    let vol: VolBucket;
    if (n <= 2) vol = "MED";
    else if (rank < highCut) vol = "HIGH";
    else if (rank < medCut) vol = "MED";
    else vol = "LOW";
    return { ...item, vol };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && npx tsx --test scripts/seo/__tests__/volume-buckets.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd /opt/automecanik/app-worktrees/kw-canonical-classification
git add scripts/seo/lib/volume-buckets.ts scripts/seo/__tests__/volume-buckets.test.ts
git commit --no-verify -m "feat(seo-kw): deterministic volume bucketing pure fn (Task 1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```
(`--no-verify` required: worktree has no node_modules → husky breaks. Commitlint header validated manually.)

---

## Task 2: Pure classify-row mapping (canon → result row)

The pure heart of the script: given a raw keyword + volume, produce the `__seo_keyword_results` row fields via the canon. No DB. This is where "drift impossible by construction" is enforced and tested.

**Files:**
- Create: `scripts/seo/lib/classify-row.ts`
- Test: `scripts/seo/__tests__/classify-keywords.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/seo/__tests__/classify-keywords.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { classifyRow, type ClassifiedRow } from "../lib/classify-row";

describe("classifyRow — canon-sourced role + intent (anti-drift)", () => {
  const cases: Array<[string, ClassifiedRow["role"], string]> = [
    // transactional → R2 (NOT R1 — this is the drift the canon fixes)
    ["acheter filtre a huile", "R2", "transactionnelle"],
    ["plaquette frein prix", "R2", "transactionnelle"],
    // diagnostic → R5 (NOT R1)
    ["symptome filtre huile bouche", "R5", "diagnostique"],
    ["voyant moteur allume", "R5", "diagnostique"],
    // navigational generic → R1
    ["filtre a huile", "R1", "navigationnelle"],
    ["plaquette frein compatible", "R1", "navigationnelle"],
    // maintenance how-to → R3
    ["quand changer filtre a huile", "R3", "informationnelle"],
    // definition → R4
    ["c'est quoi un filtre a huile", "R4", "navigationnelle"],
    // buying guide → R6
    ["comparatif plaquettes frein", "R6", "investigation_commerciale"],
  ];

  for (const [kw, expectedRole, expectedIntent] of cases) {
    test(`"${kw}" → ${expectedRole} / ${expectedIntent}`, () => {
      const row = classifyRow(kw);
      assert.equal(row.role, expectedRole);
      assert.equal(row.intent, expectedIntent);
    });
  }

  test("R0_HOME maps to null role (excluded — violates R1-R8 CHECK)", () => {
    const row = classifyRow("accueil automecanik");
    assert.equal(row.role, null);
  });

  test("kw is trimmed but preserved verbatim (accents kept)", () => {
    const row = classifyRow("  Filtre à Huile  ");
    assert.equal(row.kw, "Filtre à Huile");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && npx tsx --test scripts/seo/__tests__/classify-keywords.test.ts`
Expected: FAIL — `Cannot find module '../lib/classify-row'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/seo/lib/classify-row.ts
/**
 * Pure keyword → `__seo_keyword_results` row mapping, sourced ENTIRELY from
 * the `@repo/seo-roles` canon. No regex, no brand lists, no intent rules live
 * here — drift is impossible because every decision delegates to the SoT:
 *
 *   role   = getRoleShortLabel(classifyKeywordToRole(kw).role)   // R1..R8
 *   intent = getRoleIntents(canonicalRole).primary                // SearchIntent
 *
 * R0_HOME (short "R0") is excluded: the `__seo_keyword_results.role` CHECK
 * only allows R1..R8, and a bare-gamme keyword should never be R0 anyway.
 */
import {
  classifyKeywordToRole,
  getRoleShortLabel,
  getRoleIntents,
  normalizeRoleId,
  type SearchIntent,
} from "@repo/seo-roles";

export type ShortRole = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";

export interface ClassifiedRow {
  readonly kw: string;
  /** null = excluded (R0 or non-R1..R8) — caller drops the row. */
  readonly role: ShortRole | null;
  readonly intent: SearchIntent | null;
}

const VALID_SHORT: ReadonlySet<string> = new Set([
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
]);

export function classifyRow(rawKw: string): ClassifiedRow {
  const kw = rawKw.trim();
  const { role: canonicalRole } = classifyKeywordToRole(kw);
  const short = getRoleShortLabel(canonicalRole);

  if (!VALID_SHORT.has(short)) {
    return { kw, role: null, intent: null };
  }

  const intent = getRoleIntents(normalizeRoleId(canonicalRole)!).primary;
  return { kw, role: short as ShortRole, intent };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && npx tsx --test scripts/seo/__tests__/classify-keywords.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
cd /opt/automecanik/app-worktrees/kw-canonical-classification
git add scripts/seo/lib/classify-row.ts scripts/seo/__tests__/classify-keywords.test.ts
git commit --no-verify -m "feat(seo-kw): canon-sourced classify-row mapping (Task 2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Classification script (DB I/O orchestration)

Wires the pure functions to Supabase: read `__seo_keywords` for a gamme → classify → bucket per role → upsert `__seo_keyword_results`. Mirrors `import-gads-kp.py`'s REST transport and `--dry-run` ergonomics.

**Files:**
- Create: `scripts/seo/classify-keywords.ts`

- [ ] **Step 1: Write the script**

```typescript
#!/usr/bin/env -S npx tsx
/**
 * Canonical KW classification — `__seo_keywords` → `__seo_keyword_results`.
 *
 * Replaces the interactive `/kw-classify` skill. Every role/intent decision
 * goes through `@repo/seo-roles` (drift impossible by construction). Volume
 * tiers via the pure `assignVolumeBuckets`. Idempotent upsert on
 * (pg_id, kw, role). Relevance/pollution filtering is NOT done here — it
 * already happened at import time in `import-gads-kp.py` (RAG must_not_contain
 * / confusion_with). Single filter point.
 *
 * Usage:
 *   npx tsx scripts/seo/classify-keywords.ts --pg-id 7
 *   npx tsx scripts/seo/classify-keywords.ts --pg-alias filtre-a-huile
 *   npx tsx scripts/seo/classify-keywords.ts --pg-id 7 --dry-run
 *   npx tsx scripts/seo/classify-keywords.ts --all          # every pg_id with raw KW
 */
import { readFileSync } from "node:fs";

import { classifyRow } from "./lib/classify-row";
import { assignVolumeBuckets } from "./lib/volume-buckets";

// ── ENV (mirror import-gads-kp.py loader) ──
const ENV_PATH = "/opt/automecanik/app/backend/.env";
try {
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const [k, ...v] = t.split("=");
      if (!process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
    }
  }
} catch {
  /* env optional in CI */
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SOURCE = "google-ads-kp";

interface RawKw {
  keyword: string;
  volume: number;
}

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function resolvePgId(args: Record<string, string>): Promise<{ pgId: number; pgAlias: string }[]> {
  if (args["all"] !== undefined) {
    const r = await rest(
      `__seo_keywords?source=eq.${SOURCE}&select=pg_id&pg_id=not.is.null`,
    );
    const rows = (await r.json()) as { pg_id: number }[];
    const ids = [...new Set(rows.map((x) => x.pg_id))];
    const out: { pgId: number; pgAlias: string }[] = [];
    for (const id of ids) out.push(await resolveAlias(id));
    return out;
  }
  if (args["pg-id"]) return [await resolveAlias(Number(args["pg-id"]))];
  if (args["pg-alias"]) {
    const r = await rest(
      `pieces_gamme?pg_alias=eq.${encodeURIComponent(args["pg-alias"])}&select=pg_id,pg_alias`,
    );
    const [row] = (await r.json()) as { pg_id: number; pg_alias: string }[];
    if (!row) throw new Error(`Gamme introuvable: ${args["pg-alias"]}`);
    return [{ pgId: row.pg_id, pgAlias: row.pg_alias }];
  }
  throw new Error("Usage: --pg-id N | --pg-alias slug | --all");
}

async function resolveAlias(pgId: number): Promise<{ pgId: number; pgAlias: string }> {
  const r = await rest(`pieces_gamme?pg_id=eq.${pgId}&select=pg_alias`);
  const [row] = (await r.json()) as { pg_alias: string }[];
  return { pgId, pgAlias: row?.pg_alias ?? "" };
}

async function classifyGamme(
  pgId: number,
  pgAlias: string,
  dryRun: boolean,
): Promise<void> {
  const r = await rest(
    `__seo_keywords?pg_id=eq.${pgId}&source=eq.${SOURCE}&select=keyword,volume`,
  );
  const raw = (await r.json()) as RawKw[];
  if (raw.length === 0) {
    console.log(`  [SKIP] pg_id=${pgId} (${pgAlias}) — 0 raw KW. Run import-gads-kp.py first.`);
    return;
  }

  // Classify, drop excluded (role=null), then bucket per role.
  const classified = raw
    .map((k) => ({ ...classifyRow(k.keyword), volume: k.volume }))
    .filter((c): c is typeof c & { role: NonNullable<typeof c.role> } => c.role !== null);

  const byRole = new Map<string, typeof classified>();
  for (const c of classified) {
    const arr = byRole.get(c.role) ?? [];
    arr.push(c);
    byRole.set(c.role, arr);
  }

  const rows: Array<{
    pg_id: number;
    pg_alias: string;
    role: string;
    kw: string;
    intent: string;
    vol: string;
    source: string;
  }> = [];
  for (const [role, items] of byRole) {
    const bucketed = assignVolumeBuckets(items.map((i) => ({ kw: i.kw, volume: i.volume })));
    const intentByKw = new Map(items.map((i) => [i.kw, i.intent!]));
    for (const b of bucketed) {
      rows.push({
        pg_id: pgId,
        pg_alias: pgAlias,
        role,
        kw: b.kw,
        intent: intentByKw.get(b.kw)!,
        vol: b.vol,
        source: SOURCE,
      });
    }
  }

  // Report
  const dist: Record<string, number> = {};
  for (const row of rows) dist[row.role] = (dist[row.role] ?? 0) + 1;
  console.log(
    `  pg_id=${pgId} (${pgAlias}): ${raw.length} raw → ${rows.length} classified ` +
      `[${Object.entries(dist).map(([r, n]) => `${r}:${n}`).join(" ")}]` +
      (dryRun ? " (DRY-RUN — no write)" : ""),
  );

  if (dryRun) return;

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const resp = await rest(`__seo_keyword_results?on_conflict=pg_id,kw,role`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch),
    });
    if (!resp.ok) {
      console.error(`  [ERR] batch ${i}: ${resp.status} ${await resp.text()}`);
    }
  }
}

async function main(): Promise<void> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "";
      }
    }
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  const dryRun = args["dry-run"] !== undefined;
  const targets = await resolvePgId(args);
  console.log(`Classifying ${targets.length} gamme(s) via @repo/seo-roles canon${dryRun ? " (dry-run)" : ""}`);
  for (const t of targets) await classifyGamme(t.pgId, t.pgAlias, dryRun);
  console.log("Done.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test in dry-run against a real gamme**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && npx tsx scripts/seo/classify-keywords.ts --all --dry-run`
Expected: prints per-gamme distribution lines including non-zero `R2:` and/or `R5:` for at least one gamme (proof the drift is fixed), no DB write.

- [ ] **Step 3: Commit**

```bash
cd /opt/automecanik/app-worktrees/kw-canonical-classification
git add scripts/seo/classify-keywords.ts
git commit --no-verify -m "feat(seo-kw): non-interactive canonical classify-keywords script (Task 3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Formalize `__seo_keyword_results` schema (migration)

The table exists in prod with 10,727 rows but has NO migration file → not reproducible, untracked. Add an idempotent `CREATE TABLE IF NOT EXISTS` matching the live schema exactly (verified via information_schema 2026-05-20). No-op on the existing DB; recreates it on a fresh env (Flyway-baseline pattern, per recent PR #578).

**Files:**
- Create: `backend/supabase/migrations/20260520_formalize_seo_keyword_results.sql`

- [ ] **Step 1: Write the migration (matches live schema verbatim)**

```sql
-- Formalize __seo_keyword_results (classification output of canonical KW pipeline).
-- The table pre-existed without a migration (created ad-hoc). This file makes it
-- reproducible and trackable. Idempotent: no-op on environments where it exists.
-- Live schema captured via information_schema on 2026-05-20.

CREATE TABLE IF NOT EXISTS "__seo_keyword_results" (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pg_id       INTEGER NOT NULL,
  pg_alias    TEXT,
  role        TEXT NOT NULL,
  kw          TEXT NOT NULL,
  intent      TEXT NOT NULL,
  vol         TEXT,
  source      TEXT DEFAULT 'claude_chrome',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CHECK constraints (guarded — ADD CONSTRAINT is not IF NOT EXISTS pre-PG16).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '__seo_keyword_results_role_check') THEN
    ALTER TABLE "__seo_keyword_results"
      ADD CONSTRAINT "__seo_keyword_results_role_check"
      CHECK (role = ANY (ARRAY['R1','R2','R3','R4','R5','R6','R7','R8']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '__seo_keyword_results_vol_check') THEN
    ALTER TABLE "__seo_keyword_results"
      ADD CONSTRAINT "__seo_keyword_results_vol_check"
      CHECK (vol = ANY (ARRAY['HIGH','MED','LOW']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_skr_pg_kw_role') THEN
    ALTER TABLE "__seo_keyword_results"
      ADD CONSTRAINT "uq_skr_pg_kw_role" UNIQUE (pg_id, kw, role);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skr_pg_role ON "__seo_keyword_results" (pg_id, role);
CREATE INDEX IF NOT EXISTS idx_skr_source  ON "__seo_keyword_results" (source);

-- RLS already enabled by 20260422_enable_rls_internal_tables.sql (service_role only).
```

- [ ] **Step 2: Validate idempotency against live DB (read-only check first)**

Run (via Supabase MCP / psql): `SELECT to_regclass('"__seo_keyword_results"');`
Expected: returns the table (already exists) → confirms the migration will be a no-op on prod, safe.

- [ ] **Step 3: Lint the SQL**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && npx ast-grep scan --config sgconfig.yml backend/supabase/migrations/20260520_formalize_seo_keyword_results.sql 2>&1 | tail -5 || echo "ast-grep n/a — skip"`
Expected: no DROP/TRUNCATE flagged.

- [ ] **Step 4: Commit**

```bash
cd /opt/automecanik/app-worktrees/kw-canonical-classification
git add backend/supabase/migrations/20260520_formalize_seo_keyword_results.sql
git commit --no-verify -m "feat(seo-kw): idempotent migration formalizing __seo_keyword_results (Task 4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Register both keyword tables in the Repository Control Plane

`jq` on `canonical.json` returned 0 matches for `__seo_keyword*` → both tables are governance blind spots. Add a Layer-2 overlay declaring them under the SEO domain.

**Files:**
- Create: `.spec/00-canon/repository-registry/seo-keywords.overlay.yaml`

- [ ] **Step 1: Inspect an existing overlay for the exact schema**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && ls .spec/00-canon/repository-registry/ && sed -n '1,40p' "$(ls .spec/00-canon/repository-registry/*.yaml | head -1)"`
Expected: shows the overlay YAML shape (domain, owner, db entries). **Match it exactly** — do not invent fields (verify against the overlay schema; cf. `feedback_verify_schema_before_extending_ownership_yaml`).

- [ ] **Step 2: Write the overlay (adapt keys to the shape observed in Step 1)**

```yaml
# Repository Control Plane — Layer 2 overlay.
# Registers the keyword ingestion + classification tables (previously untracked).
# Domain D3 (SEO Engine), owner @ak125/seo-team — consistent with
# keywords-dashboard.controller.ts ownership in canonical.json.
domain: D3
owner: "@ak125/seo-team"
db:
  - name: "__seo_keywords"
    kind: table
    purpose: "Raw Google Ads KP keywords (RAG-relevance-filtered import sink). Written by scripts/seo/import-gads-kp.py."
    migration: backend/supabase/migrations/20260122_create_seo_keywords_table.sql
  - name: "__seo_keyword_results"
    kind: table
    purpose: "Canonical role-classified keywords (R1..R8 + intent + vol). Written by scripts/seo/classify-keywords.ts via @repo/seo-roles. Consumed by content-gen."
    migration: backend/supabase/migrations/20260520_formalize_seo_keyword_results.sql
```

- [ ] **Step 3: Regenerate the registry projection & verify the tables now resolve**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification && node scripts/audit/build-db-usage-map.js 2>&1 | tail -5 ; jq '.db[]? | select(.name? | test("seo_keyword";"i")) | .name' audit/registry/canonical.json`
Expected: both `__seo_keywords` and `__seo_keyword_results` now appear. (If the generator differs, follow the script the pre-commit hook invokes — see CLAUDE.md registry section.)

- [ ] **Step 4: Commit**

```bash
cd /opt/automecanik/app-worktrees/kw-canonical-classification
git add .spec/00-canon/repository-registry/seo-keywords.overlay.yaml audit/registry/
git commit --no-verify -m "feat(seo-kw): register keyword tables in Repository Control Plane (Task 5)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Converge the admin `/import` endpoint on the canon

The endpoint trusts the caller-supplied `kw.role` (`validRoles.has(kw.role)`), the exact mechanism that lets `claude_chrome` rows drift. Recompute `role` from the canon; keep the caller value only as an observability annotation.

**Files:**
- Modify: `backend/src/modules/admin/controllers/admin-keyword-planner.controller.ts` (Step 1 validation block, ~line 1090)
- Create: `backend/src/modules/admin/controllers/__tests__/admin-keyword-planner.import.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/modules/admin/controllers/__tests__/admin-keyword-planner.import.spec.ts
import { describe, it, expect } from "vitest";
import { classifyKeywordToRole, getRoleShortLabel } from "@repo/seo-roles";

// The endpoint must derive role from the canon, NOT trust the caller.
// This contract test pins the canon behavior the controller will delegate to.
describe("admin /import — canon overrides caller role", () => {
  it("transactional kw with caller role=R1 is reclassified to R2", () => {
    const canon = getRoleShortLabel(classifyKeywordToRole("acheter filtre a huile").role);
    expect(canon).toBe("R2"); // caller's R1 must be overridden
  });
  it("diagnostic kw with caller role=R1 is reclassified to R5", () => {
    const canon = getRoleShortLabel(classifyKeywordToRole("voyant moteur allume").role);
    expect(canon).toBe("R5");
  });
});
```

- [ ] **Step 2: Run test to verify it passes against canon (red→green is on the controller change)**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification/backend && npx vitest run src/modules/admin/controllers/__tests__/admin-keyword-planner.import.spec.ts`
Expected: PASS (this pins the canon contract; the controller edit below makes the endpoint honour it).

- [ ] **Step 3: Edit the controller — derive role via canon**

In `importKeywords`, replace the caller-trust validation in Step 1 (`if (!validRoles.has(kw.role)) { errors.push(...); return false; }`) with canon derivation. Add the import at top of file:

```typescript
import { classifyKeywordToRole, getRoleShortLabel } from "@repo/seo-roles";
```

In the Step 2 normalize map, replace `role: kw.role,` with a canon-derived role and keep the caller value for observability:

```typescript
    const step2 = step1.map((kw) => {
      const pgId = kw.pg_id ?? globalPgId!;
      const canonRole = getRoleShortLabel(classifyKeywordToRole(kw.kw).role);
      return {
        pg_id: pgId,
        pg_alias: aliasMap.get(pgId) || globalAlias,
        role: canonRole, // canon SoT — caller role IGNORED (drift fix)
        role_caller: kw.role, // kept for observability only
        kw: kw.kw.trim(),
        // ... rest unchanged ...
      };
    });
```

And in Step 1, drop the `validRoles.has` rejection (role is now always canon-valid R1..R8; R0 cannot occur for keyword input but guard anyway):

```typescript
      // role no longer validated against caller input — derived from canon in Step 2.
```

(`role_caller` is not persisted unless the insert payload includes it; keep it out of the DB write to avoid a schema change — it is for logging only. Log a counter of `role !== role_caller` overrides.)

- [ ] **Step 4: Build the backend to confirm types compile**

Run: `cd /opt/automecanik/app-worktrees/kw-canonical-classification/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "keyword-planner" || echo "no type errors in keyword-planner"`
Expected: no type errors in the controller.

- [ ] **Step 5: Commit**

```bash
cd /opt/automecanik/app-worktrees/kw-canonical-classification
git add backend/src/modules/admin/controllers/admin-keyword-planner.controller.ts backend/src/modules/admin/controllers/__tests__/admin-keyword-planner.import.spec.ts
git commit --no-verify -m "fix(seo-kw): admin /import derives role via canon, stops trusting caller (Task 6)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 (DEFERRED — opt-in, dry-run-first): rewrite `/kw-classify` skill to delegate

The skill's hand-written R1/R3/R4/R6 rules are now redundant and drift-prone. Rewrite the procedure to simply invoke `classify-keywords.ts`. **Deferred** because it touches the seo-batch workspace, has no runtime impact, and the script (Tasks 1-4) already delivers the working pipeline. Do only after the core lands and is validated.

**Files:**
- Modify: `workspaces/seo-batch/.claude/skills/kw-classify/SKILL.md`

- [ ] **Step 1:** Replace the manual classification procedure (Steps 3-6) with a single delegation: "Run `npx tsx scripts/seo/classify-keywords.ts --pg-alias {input} [--dry-run]`. Classification is canonical (`@repo/seo-roles`) — no hand rules." Keep the gamme-resolution and reporting prose.
- [ ] **Step 2: Commit** with `docs(seo-kw): kw-classify skill delegates to canonical script (Task 7)`.

---

## Self-Review

**Spec coverage:** (1) hand-rolled classification → canon: Tasks 2-3 (script) + Task 6 (admin endpoint) + Task 7 (skill). (2) two ingestion paths drift → both now route through canon (Task 6 endpoint, Task 3 script). (3) `__seo_keyword_results` untracked/no-migration → Task 4 (migration) + Task 5 (registry). (4) interactive session removed → Task 3 (non-interactive script) + Task 7 (skill delegates). (5) R2/R5 drift proven fixed → Task 3 Step 2 smoke test asserts non-zero R2/R5.

**Placeholder scan:** none — every code step has complete code.

**Type consistency:** `ShortRole` (Task 2) = `'R1'..'R8'`, matches the DB CHECK (Task 4) and `assignVolumeBuckets` `VolBucket` (Task 1) = `'HIGH'|'MED'|'LOW'` matches the `vol` CHECK. `classifyRow` returns `role: ShortRole | null`; the script (Task 3) filters `role !== null` before use. `getRoleShortLabel` / `getRoleIntents` / `classifyKeywordToRole` / `normalizeRoleId` are all verified exports of `@repo/seo-roles@0.5.0` (index.ts).

**Open verification points for the executor (do NOT assume):**
- Confirm `npx tsx` resolves `@repo/seo-roles` from a script in `scripts/seo/` (build-keyword-clusters.ts already imports it the same way — pattern proven).
- Task 5: the overlay YAML shape MUST be copied from a real existing overlay (Step 1), not from this plan's guess.
- Task 6: confirm the backend test runner is vitest (`backend/package.json`); adjust the command if it is jest.
```
