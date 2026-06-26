#!/usr/bin/env tsx
/**
 * bull-repeatable-drift — read-only Bull v4 inspector (CWV orchestrator retirement).
 *
 * The CWV RUM aggregation was orchestrated by a **Bull v4** scheduler
 * (`@nestjs/bull` + `bull@4`, queue `seo-monitor`, repeatables
 * `cwv-aggregation-hourly` / `cwv-aggregation-daily`) whose `onModuleInit`
 * returns on flag-off **before** `removeStaleRepeatables()` — so a mere flag
 * flip leaves the persisted repeatables in Redis. Once pg_cron becomes the sole
 * DB-side orchestrator (migration `20260626_seo_cwv_aggregation_cron`), any
 * surviving `cwv-aggregation-*` Bull repeatable = **dual orchestrator** drift.
 *
 * This probe inspects the worker runtime's Bull queue READ-ONLY (it reproduces
 * the `worker.module.ts` Redis config: `{ redis: REDIS_URL }`, default Bull
 * prefix `bull`). It NEVER mutates: only `getRepeatableJobs()` +
 * name-filtered `getWaiting()` / `getDelayed()` / `getActive()`, then
 * `queue.close()`. The Redis URL is redacted in all output.
 *
 * Used by (a) Phase D0 — confirm the targeted purge reached 0; (b) the
 * `runtime-truth-audit` check `scheduled-orchestrator-drift` — flag a
 * persisted-repeatable-after-retirement. Report-only.
 */
import Queue from "bull";
import { gitSourceCommit, makeResult, writeResult } from "./runner.ts";
import {
  healthFromFindings,
  type RuntimeTruthFinding,
  type RuntimeTruthResult,
} from "./contract.ts";

export const CHECK_NAME = "bull-repeatable-drift";

const QUEUE_NAME = "seo-monitor";
/** Fail fast on an unreachable Redis instead of ioredis' default retry-forever. */
const REDIS_CONNECT_TIMEOUT_MS = 5_000;
const INSPECT_TIMEOUT_MS = 10_000;
/** Bull job names the CWV scheduler registered (cwv-aggregation.processor.ts). */
const CWV_JOB_NAMES = ["cwv-aggregation-hourly", "cwv-aggregation-daily"] as const;
const CWV_PREFIX = "cwv-aggregation";

/** Mask credentials in a redis URL → `redis://<redacted>@host:port/db` (host kept for debugging). */
export function redactRedisUrl(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "(unparseable, redacted)";
  }
}

export interface BullRepeatable {
  name: string;
  cron: string | null;
  every: number | null;
  tz: string | null;
  key: string;
}

export interface BullQueueState {
  queue: string;
  repeatables: BullRepeatable[];
  cwvRepeatableCount: number;
  cwvWaiting: number;
  cwvDelayed: number;
  cwvActive: number;
  redis: string;
}

const isCwv = (name: string | undefined): boolean =>
  typeof name === "string" && name.startsWith(CWV_PREFIX);

/** PURE: state → findings. A persisted CWV Bull repeatable/instance = dual-orchestrator drift. */
export function classifyBullDrift(state: BullQueueState): {
  findings: RuntimeTruthFinding[];
  evidence: Record<string, unknown>;
} {
  const findings: RuntimeTruthFinding[] = [];
  const live = state.cwvRepeatableCount + state.cwvWaiting + state.cwvDelayed + state.cwvActive;
  if (live > 0) {
    findings.push({
      id: `bull-cwv-orchestrator-persisted:${state.queue}`,
      severity: "critical",
      title: `Bull queue ${state.queue} still carries ${live} cwv-aggregation artifact(s) — dual orchestrator with pg_cron`,
      detail: {
        queue: state.queue,
        cwvRepeatableCount: state.cwvRepeatableCount,
        cwvWaiting: state.cwvWaiting,
        cwvDelayed: state.cwvDelayed,
        cwvActive: state.cwvActive,
        repeatables: state.repeatables.filter((r) => isCwv(r.name)),
      },
      fix_hint:
        "D0: removeRepeatableByKey the cwv-aggregation-* configs + remove matching waiting/delayed jobs; let active jobs drain. pg_cron is the sole CWV orchestrator.",
    });
  }
  findings.sort((a, b) => a.id.localeCompare(b.id));
  return {
    findings,
    evidence: {
      queue: state.queue,
      redis: state.redis,
      totalRepeatables: state.repeatables.length,
      cwvRepeatableCount: state.cwvRepeatableCount,
      cwvWaiting: state.cwvWaiting,
      cwvDelayed: state.cwvDelayed,
      cwvActive: state.cwvActive,
      cwvRepeatables: state.repeatables.filter((r) => isCwv(r.name)),
    },
  };
}

/** READ-ONLY: connect, inspect, close. Fails fast (never hangs) if Redis unreachable. */
export async function inspectBullQueue(redisUrl: string): Promise<BullQueueState> {
  // Bounded connection: do NOT inherit ioredis' default retry-forever (would hang
  // the probe on an unreachable Redis, contradicting "explicit fail if unreachable").
  const queue = new Queue(QUEUE_NAME, redisUrl, {
    redis: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // stop reconnecting → operations reject → caught (no retry-forever hang)
    },
  });
  // Belt-and-suspenders hard deadline regardless of ioredis behaviour.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis inspect timed out after ${INSPECT_TIMEOUT_MS}ms`)),
      INSPECT_TIMEOUT_MS,
    );
  });
  const work = async (): Promise<BullQueueState> => {
    const reps = await queue.getRepeatableJobs();
    const [waiting, delayed, active] = await Promise.all([
      queue.getWaiting(),
      queue.getDelayed(),
      queue.getActive(),
    ]);
    const repeatables: BullRepeatable[] = reps
      .map((r) => ({
        name: r.name,
        cron: (r as { cron?: string }).cron ?? null,
        every: (r as { every?: number }).every ?? null,
        tz: (r as { tz?: string }).tz ?? null,
        key: r.key,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    return {
      queue: QUEUE_NAME,
      repeatables,
      cwvRepeatableCount: repeatables.filter((r) => isCwv(r.name)).length,
      cwvWaiting: waiting.filter((j) => isCwv(j.name)).length,
      cwvDelayed: delayed.filter((j) => isCwv(j.name)).length,
      cwvActive: active.filter((j) => isCwv(j.name)).length,
      redis: redactRedisUrl(redisUrl),
    };
  };
  try {
    return await Promise.race([work(), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    await queue.close();
  }
}

export interface RunOpts {
  repoRoot?: string;
  nowIso?: string;
  redisUrl?: string;
  sourceCommit?: string;
}

export async function runBullRepeatableDrift(
  opts: RunOpts = {},
): Promise<{ result: RuntimeTruthResult } | { skipped: "no-redis" }> {
  const repoRoot = opts.repoRoot ?? process.env.REPO_ROOT ?? process.cwd();
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const sourceCommit = opts.sourceCommit ?? gitSourceCommit(repoRoot);
  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL;

  if (!redisUrl) return { skipped: "no-redis" };

  const state = await inspectBullQueue(redisUrl);
  const { findings, evidence } = classifyBullDrift(state);
  return {
    result: makeResult({
      check_name: CHECK_NAME,
      generated_at: nowIso,
      source_commit: sourceCommit,
      coverage_status: "RECURRING",
      health_status: healthFromFindings(findings),
      findings,
      freshness: "live",
      evidence,
    }),
  };
}

// ── CLI entry ──────────────────────────────────────────────────────────────
const isMain =
  typeof process.argv[1] === "string" && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runBullRepeatableDrift()
    .then((r) => {
      if ("skipped" in r) {
        console.error(`::warning::${CHECK_NAME} skipped (${r.skipped}) — REDIS_URL unset`);
        process.exit(0);
      }
      const path = writeResult(process.env.REPO_ROOT ?? process.cwd(), r.result);
      console.log(JSON.stringify(r.result.evidence, null, 2));
      console.log(
        `✓ ${CHECK_NAME}: health=${r.result.health_status} findings=${r.result.findings.length} → ${path}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(`::error::${CHECK_NAME} caught: ${err?.message}`);
      process.exit(1); // explicit fail if Redis unreachable
    });
}
