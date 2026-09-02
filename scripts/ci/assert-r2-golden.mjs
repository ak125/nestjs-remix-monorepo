#!/usr/bin/env node
/**
 * assert-r2-golden.mjs — R2 golden gate: relations pièces + critères.
 *
 * WHY
 * ---
 * Owner requirement (plan massdoc, R2-GOLDEN, 2026-09-02): "les relations
 * pièces et les critères doivent continuer de fonctionner sur la page R2".
 * Two DB slices touch the STRUCTURE of the tables behind that page —
 * `pieces_relation_type` (hash-partitioning B7) and `pieces_criteria` (index
 * study B4). Neither may start before this gate is green in CI, and both must
 * leave it green (plan NO-GO 17).
 *
 * WHAT IT COMPARES
 * ----------------
 * A frozen PROJECTION of two endpoints the R2 loader actually calls
 * (`pieces-vehicle.loader.server.ts`): `/api/rm/page-v2` at the canonical
 * limit (200) and `/api/rm/alternatives` at the loader limit (12), against a
 * committed golden (`scripts/ci/r2-golden.json`).
 *
 * The projection keeps ONLY what relations + criteria determine:
 *   page-v2      : classification (ok/empty), count, relationsCount,
 *                  products {piece_id, pm_id, quality, piece_position,
 *                  filtre_gamme, is_accessory} sorted by piece_id,
 *                  groups {filtre_gamme, filtre_side, piece_ids, oemRefs},
 *                  filters {sides, brands (pm_id), qualities} with counts,
 *                  oemRefs, crossSelling.
 *   alternatives : vehicles (type_id), gammes (pg_id), models (modele_id) as
 *                  sorted sets — the RANKING is not under contract here.
 * Everything volatile by design is OUT: prices, stock, ranking score, images,
 * names, SEO text, timings, cache flags, etag. A price import never trips the
 * gate; a lost relation, a moved side or a changed alternatives set always does.
 *
 * VERDICT RULES (same discipline as preprod-response-suite.sh)
 * ------------------------------------------------------------
 *   * Every fixture is evaluated even after a failure — full picture, never
 *     truncated at the first defect.
 *   * A DIVERGENCE (projection ≠ expected), a 404 (not_found) or any other
 *     wrong status is definitive and NEVER retried → exit 1.
 *   * A TRANSPORT failure (5xx, connection refused/reset, timeout, non-JSON)
 *     MAY be retried ONCE (cold RPC on a fresh PREPROD container) → still
 *     failing → exit 2. Divergence dominates transport when both occur.
 *   * A golden that evaluates NOTHING fails (vacuous green forbidden).
 *   * A fixture without `expected` fails unless --update: a missing golden is
 *     a missing guarantee, not a pass.
 *
 * RE-BASELINE (--update)
 * ----------------------
 * `--update` rewrites `expected` for every fixture from the live target and
 * stamps provenance (captured_at / captured_from / git_sha). It is the ONLY way
 * the golden changes, and the diff is reviewed in the PR: a catalog import that
 * legitimately changes relations is re-baselined explicitly, never absorbed.
 * The update is atomic — any fixture failing to fetch leaves the file untouched.
 *
 * Usage:
 *   node scripts/ci/assert-r2-golden.mjs --base http://localhost:3200
 *   node scripts/ci/assert-r2-golden.mjs --base http://localhost:3000 --update
 * Options:
 *   --golden <path>        golden file (default: scripts/ci/r2-golden.json)
 *   --timeout-ms <n>       per-request timeout (default 60000 — cold RPC path)
 *   --retry-delay-ms <n>   wait before the single transport retry (default 3000)
 * Env:
 *   GITHUB_STEP_SUMMARY    markdown summary sink (optional)
 *   GITHUB_SHA             stamped into the golden on --update (optional)
 * Exit: 0 = all fixtures match · 1 = divergence / wrong status / missing
 *       expected / empty golden · 2 = transport failures only
 */
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_GOLDEN = join(SCRIPT_DIR, "r2-golden.json");
const GOLDEN_SCHEMA = "r2-golden/v1";
// Mirrors the loader: PAGE_V2_CANONICAL_LIMIT (backend) / INITIAL_PRODUCTS_LIMIT
// (frontend) = 200 ; alternatives fetch limit = 12.
const PAGE_V2_LIMIT = 200;
const ALTERNATIVES_LIMIT = 12;
const ATTEMPTS = 2; // one retry, transport failures only

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {
    base: null,
    golden: DEFAULT_GOLDEN,
    update: false,
    timeoutMs: 60000,
    retryDelayMs: 3000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    if (a === "--base") out.base = next();
    else if (a === "--golden") out.golden = resolve(next());
    else if (a === "--update") out.update = true;
    else if (a === "--timeout-ms") out.timeoutMs = Number(next());
    else if (a === "--retry-delay-ms") out.retryDelayMs = Number(next());
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!out.base) throw new Error("--base <url> is required");
  out.base = out.base.replace(/\/+$/, "");
  return out;
}

// ---------------------------------------------------------------------------
// Fixtures → URLs
// ---------------------------------------------------------------------------
function urlFor(fixture, base) {
  switch (fixture.kind) {
    case "page-v2":
      return `${base}/api/rm/page-v2?gamme_id=${fixture.gamme_id}&vehicle_id=${fixture.vehicle_id}&limit=${PAGE_V2_LIMIT}`;
    case "alternatives":
      return `${base}/api/rm/alternatives?gamme_id=${fixture.gamme_id}&type_id=${fixture.type_id}&limit=${ALTERNATIVES_LIMIT}`;
    default:
      throw new Error(`fixture ${fixture.id}: unknown kind ${fixture.kind}`);
  }
}

// ---------------------------------------------------------------------------
// HTTP — one attempt, classified
// ---------------------------------------------------------------------------
async function fetchOnce(url, timeoutMs) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
  } catch (err) {
    return {
      kind: "transport",
      reason: `${err?.cause?.code ?? err?.name ?? "fetch"}: ${err?.message ?? err}`,
    };
  }
  if (res.status === 404) return { kind: "not_found", reason: "HTTP 404" };
  if (res.status >= 500 || res.status === 429)
    return { kind: "transport", reason: `HTTP ${res.status}` };
  if (res.status !== 200)
    return { kind: "wrong_status", reason: `HTTP ${res.status}` };
  let body;
  try {
    body = await res.json();
  } catch (err) {
    return {
      kind: "transport",
      reason: `non-JSON body: ${err?.message ?? err}`,
    };
  }
  return { kind: "ok", body };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFixture(url, { timeoutMs, retryDelayMs }) {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    last = await fetchOnce(url, timeoutMs);
    if (last.kind !== "transport") return { ...last, attempts: attempt };
    if (attempt < ATTEMPTS) await sleep(retryDelayMs);
  }
  return { ...last, attempts: ATTEMPTS };
}

// ---------------------------------------------------------------------------
// Projections — relations + criteria only
// ---------------------------------------------------------------------------
const num = (v) => (v === null || v === undefined ? NaN : Number(v));
const byNumber = (a, b) => num(a) - num(b);
const byString = (a, b) => String(a).localeCompare(String(b), "fr");
const sortedUnique = (arr, cmp) => [...new Set(arr)].sort(cmp);
const idOf = (item) =>
  item && typeof item === "object"
    ? (item.pg_id ?? item.id ?? item.piece_id ?? null)
    : item;

function projectPageV2(body) {
  const products = Array.isArray(body.products) ? body.products : [];
  const count = Number(body.count ?? products.length);
  return {
    classification: count > 0 ? "ok" : "empty",
    success: body.success === true,
    count,
    relationsCount: body.validation?.relationsCount ?? null,
    products: products
      .map((p) => ({
        piece_id: p.piece_id,
        pm_id: p.pm_id ?? null,
        quality: p.quality ?? null,
        piece_position: p.piece_position ?? null,
        filtre_gamme: p.filtre_gamme ?? null,
        is_accessory: p.is_accessory ?? null,
      }))
      .sort((a, b) => byNumber(a.piece_id, b.piece_id)),
    groups: (Array.isArray(body.grouped_pieces) ? body.grouped_pieces : [])
      .map((g) => ({
        filtre_gamme: g.filtre_gamme ?? null,
        filtre_side: g.filtre_side ?? null,
        piece_ids: sortedUnique(
          (g.pieces ?? []).map((p) => p.id ?? p.piece_id),
          byNumber,
        ),
        oemRefs: sortedUnique((g.oemRefs ?? []).map(String), byString),
      }))
      .sort(
        (a, b) =>
          byString(a.filtre_gamme, b.filtre_gamme) ||
          byString(a.filtre_side, b.filtre_side),
      ),
    filters: {
      sides: (body.filters?.sides ?? [])
        .map((s) => ({ value: s.value ?? null, count: s.count ?? null }))
        .sort((a, b) => byString(a.value, b.value)),
      brands: (body.filters?.brands ?? [])
        .map((b) => ({ pm_id: b.pm_id ?? null, count: b.count ?? null }))
        .sort((a, b) => byNumber(a.pm_id, b.pm_id)),
      qualities: (body.filters?.qualities ?? [])
        .map((q) => ({ value: q.value ?? null, count: q.count ?? null }))
        .sort((a, b) => byString(a.value, b.value)),
    },
    oemRefs: sortedUnique((body.oemRefs ?? []).map(String), byString),
    crossSelling: sortedUnique((body.crossSelling ?? []).map(idOf), byNumber),
  };
}

function projectAlternatives(body) {
  return {
    vehicles: sortedUnique(
      (body.alternativeVehicles ?? []).map((v) => String(v.type_id)),
      byNumber,
    ),
    gammes: sortedUnique(
      (body.alternativeGammes ?? []).map((g) => Number(g.pg_id)),
      byNumber,
    ),
    models: sortedUnique(
      (body.relatedModels ?? []).map((m) => Number(m.modele_id)),
      byNumber,
    ),
  };
}

function project(fixture, body) {
  return fixture.kind === "page-v2"
    ? projectPageV2(body)
    : projectAlternatives(body);
}

// ---------------------------------------------------------------------------
// Diff — readable paths, never truncated
// ---------------------------------------------------------------------------
const KEY_FIELDS = [
  "piece_id",
  "pm_id",
  "value",
  "modele_id",
  "pg_id",
  "type_id",
  "filtre_side",
];
const isPrimitive = (v) => v === null || typeof v !== "object";
const show = (v) => JSON.stringify(v);

function keyOf(item) {
  for (const k of KEY_FIELDS)
    if (item && item[k] !== undefined && item[k] !== null)
      return `${k}=${item[k]}`;
  return JSON.stringify(item);
}

function diff(expected, actual, path, out) {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.every(isPrimitive) && actual.every(isPrimitive)) {
      const e = new Set(expected.map(String));
      const a = new Set(actual.map(String));
      const missing = expected.filter((v) => !a.has(String(v)));
      const extra = actual.filter((v) => !e.has(String(v)));
      if (missing.length) out.push(`${path}: missing ${show(missing)}`);
      if (extra.length) out.push(`${path}: extra ${show(extra)}`);
      return;
    }
    const eMap = new Map(expected.map((it) => [keyOf(it), it]));
    const aMap = new Map(actual.map((it) => [keyOf(it), it]));
    for (const [k, it] of eMap) {
      if (!aMap.has(k)) out.push(`${path}: missing ${k}`);
      else diff(it, aMap.get(k), `${path}[${k}]`, out);
    }
    for (const k of aMap.keys())
      if (!eMap.has(k)) out.push(`${path}: extra ${k}`);
    return;
  }
  if (!isPrimitive(expected) && !isPrimitive(actual)) {
    for (const k of new Set([
      ...Object.keys(expected),
      ...Object.keys(actual),
    ])) {
      diff(expected[k], actual[k], path ? `${path}.${k}` : k, out);
    }
    return;
  }
  if (!Object.is(expected, actual))
    out.push(`${path}: ${show(expected)} → ${show(actual)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function loadGolden(path) {
  let golden;
  try {
    golden = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`cannot read golden ${path}: ${err.message}`);
  }
  if (golden.schema !== GOLDEN_SCHEMA)
    throw new Error(
      `golden ${path}: schema ${golden.schema} ≠ ${GOLDEN_SCHEMA}`,
    );
  if (!Array.isArray(golden.fixtures) || golden.fixtures.length === 0) {
    throw new Error(
      `golden ${path}: no fixture to evaluate (vacuous green forbidden)`,
    );
  }
  const ids = new Set();
  for (const f of golden.fixtures) {
    if (!f.id || !f.kind)
      throw new Error(`golden ${path}: fixture without id/kind`);
    if (ids.has(f.id))
      throw new Error(`golden ${path}: duplicate fixture id ${f.id}`);
    ids.add(f.id);
  }
  return golden;
}

function summaryRow(sink, cells) {
  if (!sink) return;
  appendFileSync(sink, `| ${cells.join(" | ")} |\n`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const golden = loadGolden(opts.golden);
  const sink =
    process.env.GITHUB_STEP_SUMMARY &&
    process.env.GITHUB_STEP_SUMMARY !== "/dev/null"
      ? process.env.GITHUB_STEP_SUMMARY
      : null;

  console.log(
    `🧬 R2 golden — relations pièces + critères — ${golden.fixtures.length} fixture(s) against ${opts.base}${opts.update ? " [UPDATE]" : ""}`,
  );
  if (sink) {
    appendFileSync(
      sink,
      `## 🧬 R2 golden — relations pièces + critères${opts.update ? " (update)" : ""}\n\n| Fixture | Kind | Verdict | Detail |\n|---|---|---|---|\n`,
    );
  }

  let divergences = 0;
  let transport = 0;
  const updated = [];

  for (const fixture of golden.fixtures) {
    const url = urlFor(fixture, opts.base);
    const res = await fetchFixture(url, opts);

    if (res.kind === "transport") {
      transport++;
      console.log(
        `  ⚠️  ${fixture.id} — transport failure after ${res.attempts} attempt(s): ${res.reason}`,
      );
      summaryRow(sink, [fixture.id, fixture.kind, "⚠️ transport", res.reason]);
      continue;
    }
    if (res.kind === "not_found" || res.kind === "wrong_status") {
      divergences++;
      console.log(
        `  ❌ ${fixture.id} — ${res.kind} (${res.reason}) — never retried`,
      );
      summaryRow(sink, [
        fixture.id,
        fixture.kind,
        `❌ ${res.kind}`,
        res.reason,
      ]);
      continue;
    }

    const actual = project(fixture, res.body);

    if (opts.update) {
      updated.push({ ...fixture, expected: actual });
      console.log(`  📸 ${fixture.id} — captured`);
      summaryRow(sink, [fixture.id, fixture.kind, "📸 captured", ""]);
      continue;
    }

    if (fixture.expected === undefined || fixture.expected === null) {
      divergences++;
      console.log(
        `  ❌ ${fixture.id} — no expected projection in golden (run with --update to baseline)`,
      );
      summaryRow(sink, [
        fixture.id,
        fixture.kind,
        "❌ no expected",
        "baseline missing",
      ]);
      continue;
    }

    const lines = [];
    diff(fixture.expected, actual, "", lines);
    if (lines.length === 0) {
      console.log(`  ✅ ${fixture.id}`);
      summaryRow(sink, [fixture.id, fixture.kind, "✅", ""]);
    } else {
      divergences++;
      console.log(`  ❌ ${fixture.id} — ${lines.length} divergence(s):`);
      for (const l of lines) console.log(`       ${l}`);
      summaryRow(sink, [
        fixture.id,
        fixture.kind,
        `❌ ${lines.length} divergence(s)`,
        lines.map((l) => `\`${l}\``).join("<br>"),
      ]);
    }
  }

  if (opts.update) {
    if (divergences > 0 || transport > 0) {
      console.log(
        `✖ update aborted — ${divergences + transport} fixture(s) could not be captured; golden left untouched`,
      );
      process.exit(divergences > 0 ? 1 : 2);
    }
    const next = {
      ...golden,
      captured_at: new Date().toISOString(),
      captured_from: opts.base,
      git_sha: process.env.GITHUB_SHA ?? golden.git_sha ?? null,
      fixtures: updated,
    };
    writeFileSync(opts.golden, JSON.stringify(next, null, 2) + "\n");
    console.log(`📸 ${updated.length} fixture(s) captured → ${opts.golden}`);
    process.exit(0);
  }

  const evaluated = golden.fixtures.length;
  console.log(
    `${divergences === 0 && transport === 0 ? "✅" : "✖"} ${evaluated} fixture(s) evaluated, ${divergences} divergence(s), ${transport} transport failure(s)`,
  );
  if (sink)
    appendFileSync(
      sink,
      `\n**${evaluated} fixture(s) evaluated, ${divergences} divergence(s), ${transport} transport failure(s)**\n`,
    );
  if (divergences > 0) process.exit(1);
  if (transport > 0) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exit(1);
});
