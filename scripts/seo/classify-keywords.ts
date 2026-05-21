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
 * Safe by default: previews unless `--write` is passed. `--write` performs an
 * idempotent rebuild — deletes the stale `google-ads-kp` projection for each
 * target gamme, then re-inserts the freshly classified rows (no duplicates,
 * re-runnable). Other sources (claude_chrome, keyword-engine) are never touched.
 *
 * Usage:
 *   npx tsx scripts/seo/classify-keywords.ts --all              # preview all
 *   npx tsx scripts/seo/classify-keywords.ts --pg-alias filtre-a-huile
 *   npx tsx scripts/seo/classify-keywords.ts --pg-id 7 --write  # commit one gamme
 *   npx tsx scripts/seo/classify-keywords.ts --all --write      # commit all
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

/**
 * Paginated GET — PostgREST caps responses at 1000 rows by default, which
 * would silently truncate gammes with > 1000 keywords. Loop with limit/offset
 * until a short page is returned. `path` must NOT already carry limit/offset.
 */
async function restAll<T>(path: string, pageSize = 1000): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const r = await rest(`${path}${sep}limit=${pageSize}&offset=${offset}`);
    const page = (await r.json()) as T[];
    if (!Array.isArray(page)) {
      throw new Error(`Unexpected REST response: ${JSON.stringify(page)}`);
    }
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

async function resolveAlias(
  pgId: number,
): Promise<{ pgId: number; pgAlias: string }> {
  const r = await rest(`pieces_gamme?pg_id=eq.${pgId}&select=pg_alias`);
  const [row] = (await r.json()) as { pg_alias: string }[];
  return { pgId, pgAlias: row?.pg_alias ?? "" };
}

async function resolveTargets(
  args: Record<string, string>,
): Promise<{ pgId: number; pgAlias: string }[]> {
  if (args["all"] !== undefined) {
    const rows = await restAll<{ pg_id: number }>(
      `__seo_keywords?source=eq.${SOURCE}&select=pg_id&pg_id=not.is.null`,
    );
    const ids = [...new Set(rows.map((x) => x.pg_id))].sort((a, b) => a - b);
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
  throw new Error("Usage: --pg-id N | --pg-alias slug | --all  [--dry-run]");
}

async function countExisting(pgId: number): Promise<number> {
  const r = await rest(
    `__seo_keyword_results?pg_id=eq.${pgId}&source=eq.${SOURCE}&select=id`,
    { headers: { Prefer: "count=exact", Range: "0-0" } },
  );
  const cr = r.headers.get("content-range"); // "0-0/NNN"
  return cr ? Number(cr.split("/")[1]) : 0;
}

async function classifyGamme(
  pgId: number,
  pgAlias: string,
  write: boolean,
): Promise<void> {
  const raw = await restAll<RawKw>(
    `__seo_keywords?pg_id=eq.${pgId}&source=eq.${SOURCE}&select=keyword,volume`,
  );
  if (raw.length === 0) {
    console.log(
      `  [SKIP] pg_id=${pgId} (${pgAlias}) — 0 raw KW. Run import-gads-kp.py first.`,
    );
    return;
  }

  // Classify, drop excluded (role=null), then bucket per role.
  const classified = raw
    .map((k) => ({ ...classifyRow(k.keyword), volume: k.volume }))
    .filter(
      (c): c is typeof c & { role: NonNullable<typeof c.role> } =>
        c.role !== null,
    );

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
    const bucketed = assignVolumeBuckets(
      items.map((i) => ({ kw: i.kw, volume: i.volume })),
    );
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

  // Report (sorted role labels for stable output).
  const dist: Record<string, number> = {};
  for (const row of rows) dist[row.role] = (dist[row.role] ?? 0) + 1;
  const distStr = Object.keys(dist)
    .sort()
    .map((rrole) => `${rrole}:${dist[rrole]}`)
    .join(" ");
  const before = await countExisting(pgId);
  console.log(
    `  pg_id=${pgId} (${pgAlias}): ${raw.length} raw → ${rows.length} classified ` +
      `[${distStr}] | existing ${SOURCE} rows: ${before}` +
      (write ? "" : " (PREVIEW — no write)"),
  );

  if (!write) return;

  // Idempotent rebuild scoped to (pg_id, source): delete the stale canon
  // projection for THIS gamme, then re-insert the freshly classified rows.
  // Touches ONLY source='google-ads-kp' — claude_chrome / keyword-engine rows
  // are never affected. Re-runnable: regenerates the exact same set.
  const del = await rest(
    `__seo_keyword_results?pg_id=eq.${pgId}&source=eq.${SOURCE}`,
    { method: "DELETE", headers: { Prefer: "count=exact" } },
  );
  if (!del.ok) {
    console.error(`  [ERR] delete pg_id=${pgId}: ${del.status} ${await del.text()}`);
    return;
  }
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const resp = await rest(`__seo_keyword_results`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(batch),
    });
    if (!resp.ok) {
      console.error(`  [ERR] insert batch ${i} pg_id=${pgId}: ${resp.status} ${await resp.text()}`);
      return;
    }
  }
  console.log(`    ↳ rebuilt: -${before} stale, +${rows.length} canonical`);
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
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  }
  // Safe by default: writes ONLY with explicit --write. `--dry-run` kept as an
  // explicit no-op alias for clarity.
  const write = args["write"] !== undefined;
  const targets = await resolveTargets(args);
  console.log(
    `Classifying ${targets.length} gamme(s) via @repo/seo-roles canon` +
      (write ? " (WRITE — idempotent rebuild of google-ads-kp rows)" : " (preview)"),
  );
  for (const t of targets) await classifyGamme(t.pgId, t.pgAlias, write);
  console.log("Done.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
