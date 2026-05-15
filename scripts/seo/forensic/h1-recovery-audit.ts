/**
 * PR-A1 — H1 forensic audit orchestrator (READ-ONLY, zéro DDL)
 *
 * Loops over R1_ROUTER assets, calls the engine, aggregates results, and
 * outputs:
 *   - audit-reports/seo-h1-recovery/<date>/report.json
 *   - audit-reports/seo-h1-recovery/<date>/report.md
 *   - audit-reports/seo-h1-recovery/<date>/decision-gate.md
 *
 * Usage:
 *   pnpm tsx scripts/seo/forensic/h1-recovery-audit.ts --role R1_ROUTER --report-only
 *   pnpm tsx scripts/seo/forensic/h1-recovery-audit.ts --role R1_ROUTER --limit 10
 *   pnpm tsx scripts/seo/forensic/h1-recovery-audit.ts --pg-alias filtres-huile
 *
 * Options:
 *   --role <id>          R1_ROUTER (default) — R3/R6 extension noted in plan
 *   --limit <n>          Limit number of assets audited (useful for smoke test)
 *   --pg-alias <slug>    Audit a single gamme by alias (e.g. filtres-huile)
 *   --report-only        (default) Output report files only, zero DB writes
 *   --persist            [Phase A2] Persist findings to __seo_content_audit table — REJECTED in PR-A1, requires PR-A2 merged
 *   --output-dir <path>  Override default output directory
 *   --help               Show this help
 *
 * Plan : /home/deploy/.claude/plans/lors-du-audite-seo-concurrent-swan.md §4 Phase A1
 */

import * as path from 'path';
import * as fs from 'fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import {
  type AuditRow,
  type EvidenceTier,
  type RoleId,
  auditAsset,
  loadR1Assets,
} from './h1-audit';

// ── Environment ──────────────────────────────────────────────────────────────

dotenv.config({
  path: path.join(__dirname, '../../../backend/.env'),
  quiet: true,
} as dotenv.DotenvConfigOptions);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write(
    '[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see backend/.env)\n',
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Logging (diagnostic → stderr, machine output → file) ─────────────────────

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

// ── CLI parsing ──────────────────────────────────────────────────────────────

interface CliOptions {
  role: RoleId;
  limit?: number;
  pgAlias?: string;
  reportOnly: boolean;
  persist: boolean;
  outputDir?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    role: 'R1_ROUTER',
    reportOnly: true,
    persist: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--role':
        opts.role = argv[++i] as RoleId;
        break;
      case '--limit':
        opts.limit = Number(argv[++i]);
        break;
      case '--pg-alias':
        opts.pgAlias = argv[++i];
        break;
      case '--report-only':
        opts.reportOnly = true;
        opts.persist = false;
        break;
      case '--persist':
        opts.persist = true;
        opts.reportOnly = false;
        break;
      case '--output-dir':
        opts.outputDir = argv[++i];
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
    }
  }
  return opts;
}

function printHelp(): void {
  process.stdout.write(`PR-A1 H1 Forensic Audit (READ-ONLY)

Usage:
  pnpm tsx scripts/seo/forensic/h1-recovery-audit.ts [options]

Options:
  --role <R1_ROUTER>    Role to audit (R1_ROUTER default)
  --limit <n>           Limit number of assets (smoke test)
  --pg-alias <slug>     Audit single gamme
  --report-only         Output files only (default, PR-A1 contract)
  --persist             [Phase A2] Persist to __seo_content_audit (REJECTED in PR-A1)
  --output-dir <path>   Override output directory
  --help                Show this help

Output:
  audit-reports/seo-h1-recovery/<YYYY-MM-DD>/report.{json,md}
  audit-reports/seo-h1-recovery/<YYYY-MM-DD>/decision-gate.md
`);
}

// ── Decision gate thresholds (temporary, plan §4 — to recalibrate after 2-3 runs) ──

const GATE_THRESHOLDS = {
  // Condition (a)
  cond_a_min_count: 20,
  cond_a_min_ratio: 0.10,
  // Condition (b)
  cond_b_min_count: 10,
  cond_b_min_score_delta_avg: 2,
  // Condition (c)
  cond_c_min_critical_urls: 5,
} as const;

// ── Aggregation ──────────────────────────────────────────────────────────────

interface ReportSummary {
  run_id: string;
  role: RoleId;
  generated_at: string;
  total_assets_audited: number;
  evidence_tier_distribution: Record<EvidenceTier, number>;
  confidence_distribution: Record<'high' | 'medium' | 'low', number>;
  strong_candidates: Array<AuditRow>; // evidence_tier ∈ exact_match_* AND score_delta > 1
  heuristic_candidates: Array<AuditRow>; // evidence_tier = heuristic_recent_change AND score_delta > 1
  unknown_assets_count: number;
  score_delta_avg_all_candidates: number; // avg over strong_candidates
  business_critical_strong_count: number; // tier0 (pieces/*) within strong_candidates
  gate_decision: GateDecision;
}

interface GateDecision {
  go: boolean;
  condition_met: 'a' | 'b' | 'c' | null;
  thresholds: typeof GATE_THRESHOLDS;
  observed: {
    strong_count: number;
    strong_ratio: number;
    score_delta_avg: number;
    business_critical_strong_count: number;
  };
  reasoning: string;
}

function makeEmptyTierDistribution(): Record<EvidenceTier, number> {
  return {
    exact_match_snapshot: 0,
    exact_match_event_log: 0,
    exact_match_blog_advice: 0,
    exact_match_builder_template: 0,
    heuristic_recent_change: 0,
    unknown: 0,
  };
}

function isExactMatch(tier: EvidenceTier): boolean {
  return (
    tier === 'exact_match_snapshot' ||
    tier === 'exact_match_event_log' ||
    tier === 'exact_match_blog_advice' ||
    tier === 'exact_match_builder_template'
  );
}

/**
 * Tier0 = business-critical (pieces/*) per seo-criticality.yaml. For R1_ROUTER,
 * 100% of URLs are tier0 since they're /pieces/{gamme}. This counter exists for
 * forward compatibility when R3/R6 are added (which may have tier1 routes).
 */
function isBusinessCritical(row: AuditRow): boolean {
  return row.asset.url.includes('/pieces/');
}

function evaluateGate(summary: Omit<ReportSummary, 'gate_decision'>): GateDecision {
  const strong_count = summary.strong_candidates.length;
  const strong_ratio = summary.total_assets_audited > 0
    ? strong_count / summary.total_assets_audited
    : 0;
  const score_delta_avg = summary.score_delta_avg_all_candidates;
  const business_critical_strong_count = summary.business_critical_strong_count;

  // Condition (a) : N >= 20 AND ratio >= 10%
  if (
    strong_count >= GATE_THRESHOLDS.cond_a_min_count &&
    strong_ratio >= GATE_THRESHOLDS.cond_a_min_ratio
  ) {
    return {
      go: true,
      condition_met: 'a',
      thresholds: GATE_THRESHOLDS,
      observed: { strong_count, strong_ratio, score_delta_avg, business_critical_strong_count },
      reasoning:
        `Condition (a) met: ${strong_count} strong candidates (>= ${GATE_THRESHOLDS.cond_a_min_count}) ` +
        `AND ratio ${(strong_ratio * 100).toFixed(1)}% (>= ${(GATE_THRESHOLDS.cond_a_min_ratio * 100).toFixed(0)}%).`,
    };
  }

  // Condition (b) : N >= 10 AND score_delta_avg >= 2
  if (
    strong_count >= GATE_THRESHOLDS.cond_b_min_count &&
    score_delta_avg >= GATE_THRESHOLDS.cond_b_min_score_delta_avg
  ) {
    return {
      go: true,
      condition_met: 'b',
      thresholds: GATE_THRESHOLDS,
      observed: { strong_count, strong_ratio, score_delta_avg, business_critical_strong_count },
      reasoning:
        `Condition (b) met: ${strong_count} strong candidates (>= ${GATE_THRESHOLDS.cond_b_min_count}) ` +
        `AND avg score_delta ${score_delta_avg.toFixed(2)} (>= ${GATE_THRESHOLDS.cond_b_min_score_delta_avg}).`,
    };
  }

  // Condition (c) : >= 5 business-critical URLs (tier0/tier1) with exact_match_*
  if (business_critical_strong_count >= GATE_THRESHOLDS.cond_c_min_critical_urls) {
    return {
      go: true,
      condition_met: 'c',
      thresholds: GATE_THRESHOLDS,
      observed: { strong_count, strong_ratio, score_delta_avg, business_critical_strong_count },
      reasoning:
        `Condition (c) met: ${business_critical_strong_count} business-critical URLs ` +
        `(>= ${GATE_THRESHOLDS.cond_c_min_critical_urls}) with exact_match_* evidence.`,
    };
  }

  return {
    go: false,
    condition_met: null,
    thresholds: GATE_THRESHOLDS,
    observed: { strong_count, strong_ratio, score_delta_avg, business_critical_strong_count },
    reasoning:
      'No condition met. Hypothèse "LLM a écrasé legacy H1 R1" non validée empiriquement par ce run. ' +
      'Voir feedback_audit_hypotheses_must_be_data_validated.md — archiver le rapport et STOP.',
  };
}

function aggregate(rows: AuditRow[], role: RoleId, runId: string): ReportSummary {
  const tierDistribution = makeEmptyTierDistribution();
  const confidenceDistribution = { high: 0, medium: 0, low: 0 };
  const strongCandidates: AuditRow[] = [];
  const heuristicCandidates: AuditRow[] = [];

  for (const row of rows) {
    tierDistribution[row.evidence_tier]++;
    confidenceDistribution[row.confidence]++;

    const delta = row.scores.score_delta ?? 0;

    if (isExactMatch(row.evidence_tier) && delta > 1) {
      strongCandidates.push(row);
    } else if (row.evidence_tier === 'heuristic_recent_change' && delta > 1) {
      heuristicCandidates.push(row);
    }
  }

  const score_delta_sum = strongCandidates.reduce(
    (acc, r) => acc + (r.scores.score_delta ?? 0),
    0,
  );
  const score_delta_avg = strongCandidates.length > 0
    ? score_delta_sum / strongCandidates.length
    : 0;

  const business_critical_strong_count = strongCandidates.filter(isBusinessCritical).length;

  const summaryWithoutGate: Omit<ReportSummary, 'gate_decision'> = {
    run_id: runId,
    role,
    generated_at: new Date().toISOString(),
    total_assets_audited: rows.length,
    evidence_tier_distribution: tierDistribution,
    confidence_distribution: confidenceDistribution,
    strong_candidates: strongCandidates,
    heuristic_candidates: heuristicCandidates,
    unknown_assets_count: tierDistribution.unknown,
    score_delta_avg_all_candidates: score_delta_avg,
    business_critical_strong_count,
  };

  return {
    ...summaryWithoutGate,
    gate_decision: evaluateGate(summaryWithoutGate),
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderMarkdownReport(summary: ReportSummary, rows: AuditRow[]): string {
  const td = summary.evidence_tier_distribution;
  const cd = summary.confidence_distribution;

  return `# H1 Recovery Forensic Audit — Report

> Run ID: \`${summary.run_id}\`
> Role: \`${summary.role}\`
> Generated: ${summary.generated_at}
> Plan: \`/home/deploy/.claude/plans/lors-du-audite-seo-concurrent-swan.md\` §4 Phase A1

> **Note on coverage** : "Total assets audited" reflects only gammes with a stored
> H1 in \`__seo_r1_gamme_slots.r1s_h1_override\` or fallback \`__seo_gamme.sg_h1\`.
> Gammes rendering H1 at runtime via template fallback (no stored value) are
> not in this audit scope. Total \`__pg_gammes\` corpus is ~232 G1/G2.

## Summary

| Metric | Value |
|---|---|
| Total assets audited (with stored H1) | **${summary.total_assets_audited}** |
| Strong candidates (exact_match_* AND score_delta > 1) | **${summary.strong_candidates.length}** |
| Heuristic candidates | ${summary.heuristic_candidates.length} |
| Unknown evidence | ${summary.unknown_assets_count} |
| Business-critical (tier0 /pieces/*) within strong | ${summary.business_critical_strong_count} |
| Score delta avg (strong only) | ${summary.score_delta_avg_all_candidates.toFixed(2)} |

## Evidence tier distribution

| Tier | Count |
|---|---|
| exact_match_snapshot | ${td.exact_match_snapshot} |
| exact_match_event_log | ${td.exact_match_event_log} |
| exact_match_blog_advice | ${td.exact_match_blog_advice} |
| exact_match_builder_template | ${td.exact_match_builder_template} |
| heuristic_recent_change | ${td.heuristic_recent_change} |
| unknown | ${td.unknown} |

## Confidence distribution

| Confidence | Count |
|---|---|
| high | ${cd.high} |
| medium | ${cd.medium} |
| low | ${cd.low} |

## Top 20 strong candidates (by score_delta DESC)

${
  summary.strong_candidates.length === 0
    ? '_No strong candidates this run._'
    : '| pg_alias | tier | current_score | legacy_score | delta | current H1 | legacy H1 |\n|---|---|---|---|---|---|---|\n' +
      summary.strong_candidates
        .slice()
        .sort((a, b) => (b.scores.score_delta ?? 0) - (a.scores.score_delta ?? 0))
        .slice(0, 20)
        .map(
          (r) =>
            `| \`${r.asset.pg_alias}\` | ${r.evidence_tier} | ${r.scores.current.composite}/8 | ${r.scores.legacy?.composite ?? '–'}/8 | **${(r.scores.score_delta ?? 0).toFixed(0)}** | ${truncate(r.observed_value, 50)} | ${truncate(r.legacy_candidate ?? '–', 50)} |`,
        )
        .join('\n')
}

## Decision gate A1 → A2

${summary.gate_decision.go ? '✅ **GO**' : '⛔ **STOP**'} — ${summary.gate_decision.reasoning}

See \`decision-gate.md\` for full justification.

---

_PR-A1 (READ-ONLY) — no DB writes. Apply mode \`--persist\` requires PR-A2 merged._
`;
}

function renderDecisionGate(summary: ReportSummary): string {
  const d = summary.gate_decision;
  const obs = d.observed;
  return `# Decision Gate A1 → A2

> Run ID: \`${summary.run_id}\`
> Role: \`${summary.role}\`
> Generated: ${summary.generated_at}

## Verdict : ${d.go ? '✅ GO (proceed to PR-A2)' : '⛔ STOP (archive, no schema change)'}

${d.reasoning}

## Conditions evaluation

> All 3 conditions are **OR** — GO if at least one met.
> Thresholds are **temporary**, to recalibrate after 2-3 comparative runs before graving canon (plan §4).

### Condition (a) — high-volume corruption
- Strong candidates: **${obs.strong_count}** (threshold ≥ ${d.thresholds.cond_a_min_count})
- Ratio of corpus: **${(obs.strong_ratio * 100).toFixed(1)}%** (threshold ≥ ${(d.thresholds.cond_a_min_ratio * 100).toFixed(0)}%)
- Met: ${obs.strong_count >= d.thresholds.cond_a_min_count && obs.strong_ratio >= d.thresholds.cond_a_min_ratio ? '✅' : '❌'}

### Condition (b) — low-volume but severe
- Strong candidates: **${obs.strong_count}** (threshold ≥ ${d.thresholds.cond_b_min_count})
- Avg score delta: **${obs.score_delta_avg.toFixed(2)}** (threshold ≥ ${d.thresholds.cond_b_min_score_delta_avg})
- Met: ${obs.strong_count >= d.thresholds.cond_b_min_count && obs.score_delta_avg >= d.thresholds.cond_b_min_score_delta_avg ? '✅' : '❌'}

### Condition (c) — business-critical surface
- Business-critical strong (tier0 /pieces/*): **${obs.business_critical_strong_count}** (threshold ≥ ${d.thresholds.cond_c_min_critical_urls})
- Met: ${obs.business_critical_strong_count >= d.thresholds.cond_c_min_critical_urls ? '✅' : '❌'}

## Next step

${
  d.go
    ? `1. Open PR-A2 with \`backend/supabase/migrations/20260516_seo_content_audit.sql\` (table append-only minimal)
2. Re-run this script with \`--persist\` to bootstrap the table from \`report.json\`
3. Proceed to PR-B (Field Authority Registry)`
    : `1. Archive this report alongside others in \`audit-reports/seo-h1-recovery/<prev-date>/\`
2. Document in \`governance-vault/ledger/audit-trail/\` that hypothesis "LLM overwrote legacy R1 H1" is **not empirically validated** by this run
3. Re-evaluate context with stakeholders before re-running`
}

## Memory rules applied

- \`feedback_audit_hypotheses_must_be_data_validated.md\` — empirical gate
- \`feedback_forensic_strict_readonly_before_infra.md\` — no DDL in this phase
- \`feedback_deterministic_evidence_tiers_over_bayesian.md\` — evidence tiers, no Bayesian
`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

// ── Output directory & file writing ──────────────────────────────────────────

function resolveOutputDir(cliDir: string | undefined): string {
  if (cliDir) return cliDir;
  const today = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), 'audit-reports', 'seo-h1-recovery', today);
}

function writeReport(outputDir: string, summary: ReportSummary, rows: AuditRow[]): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const reportJsonPath = path.join(outputDir, 'report.json');
  const reportMdPath = path.join(outputDir, 'report.md');
  const gatePath = path.join(outputDir, 'decision-gate.md');

  fs.writeFileSync(
    reportJsonPath,
    JSON.stringify({ summary, rows }, null, 2),
    'utf8',
  );
  fs.writeFileSync(reportMdPath, renderMarkdownReport(summary, rows), 'utf8');
  fs.writeFileSync(gatePath, renderDecisionGate(summary), 'utf8');

  log(`✓ Wrote ${reportJsonPath}`);
  log(`✓ Wrote ${reportMdPath}`);
  log(`✓ Wrote ${gatePath}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.persist) {
    log('[FATAL] --persist requires Phase A2 (table __seo_content_audit) which is not yet merged.');
    log('[FATAL] PR-A1 is strictly READ-ONLY (zéro DDL, output fichier uniquement).');
    log('[FATAL] See plan §4 for the gate A1→A2.');
    process.exit(2);
  }

  if (opts.role !== 'R1_ROUTER') {
    log(`[FATAL] Role ${opts.role} not yet implemented in PR-A1 (R3/R6 extension noted in plan).`);
    process.exit(2);
  }

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  log(`▶ PR-A1 H1 Forensic Audit — run_id=${runId}`);
  log(`  role=${opts.role}${opts.limit ? ` limit=${opts.limit}` : ''}${opts.pgAlias ? ` pg_alias=${opts.pgAlias}` : ''}`);

  log('▶ Loading R1 assets via __pg_gammes…');
  const assets = await loadR1Assets(supabase, {
    limit: opts.limit,
    pg_alias_filter: opts.pgAlias,
  });
  log(`  ${assets.length} assets to audit`);

  if (assets.length === 0) {
    log('[WARN] No assets loaded. Check __pg_gammes and __seo_r1_gamme_slots / __seo_gamme.');
    process.exit(0);
  }

  log('▶ Auditing each asset (evidence lookup + scoring)…');
  const rows: AuditRow[] = [];
  let i = 0;
  for (const asset of assets) {
    const { _h1Source, ...assetClean } = asset;
    const row = await auditAsset(supabase, assetClean, _h1Source);
    rows.push(row);
    i++;
    if (i % 25 === 0) log(`  ${i}/${assets.length} done…`);
  }
  log(`  ✓ ${rows.length} audit rows produced`);

  log('▶ Aggregating + evaluating decision gate…');
  const summary = aggregate(rows, opts.role, runId);

  log(`▶ Writing reports…`);
  const outputDir = resolveOutputDir(opts.outputDir);
  writeReport(outputDir, summary, rows);

  log('');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`Verdict: ${summary.gate_decision.go ? '✅ GO (proceed to PR-A2)' : '⛔ STOP (archive, no schema change)'}`);
  log(summary.gate_decision.reasoning);
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[FATAL] ${msg}\n`);
  process.exit(1);
});
