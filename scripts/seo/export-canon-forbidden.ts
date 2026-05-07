#!/usr/bin/env tsx
/**
 * Export canon forbidden_overlap from @repo/seo-roles to DB cache.
 *
 * SoT lives in `packages/seo-roles/src/forbidden-overlap.ts` (PR-A).
 * This script populates `__seo_role_canon_forbidden` (PR-D migration) so the
 * Postgres trigger `fn_skp_canon_check` can match against the same canon
 * vocabulary as the runtime layer (defense-in-depth).
 *
 * Idempotent : truncates the table, re-inserts everything in one transaction.
 *
 * Sequence (Plan §iii) :
 *   1. Migration `20260507_canonicalize_seo_r3_keyword_plan.sql` applied
 *      (creates table + trigger DISABLED via __seo_canon_runtime_flags)
 *   2. Run THIS script → table populated
 *   3. Activate trigger : UPDATE __seo_canon_runtime_flags SET enabled = TRUE
 *
 * Usage :
 *   npx tsx scripts/seo/export-canon-forbidden.ts [--dry-run]
 *
 * Required env (backend/.env) :
 *   SUPABASE_URL                  Project URL
 *   SUPABASE_SERVICE_ROLE_KEY     Service-role key (bypasses RLS)
 *
 * CI integration : run after every release of @repo/seo-roles to keep the
 * cache in sync. CI guard verifies hash(canon_TS) == hash(canon_DB).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  RoleId,
  FORBIDDEN_ROLE_IDS,
  DEPRECATED_OUTPUT_ROLES,
} from '@repo/seo-roles';
// PR-G — getForbiddenOverlap migrated to @repo/seo-role-contracts (ADR-047)
import { getForbiddenOverlap } from '@repo/seo-role-contracts';

dotenv.config({
  path: path.join(__dirname, '../../backend/.env'),
  quiet: true,
} as dotenv.DotenvConfigOptions);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
  );
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface Row {
  role_id: string;
  term: string;
}

function buildRows(): Row[] {
  const rows: Row[] = [];
  for (const role of Object.values(RoleId)) {
    // Skip forbidden output roles + deprecated — they shouldn't be sources of
    // canon for active enforcement (their forbidden lists are intentionally
    // empty in the canon module).
    if ((FORBIDDEN_ROLE_IDS as readonly string[]).includes(role)) continue;
    if (DEPRECATED_OUTPUT_ROLES.has(role as never)) continue;

    for (const term of getForbiddenOverlap(role)) {
      rows.push({ role_id: role, term });
    }
  }
  return rows;
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const rows = buildRows();

  console.log(
    `[export-canon-forbidden] built ${rows.length} (role_id, term) tuples ` +
      `from @repo/seo-roles canon (${dryRun ? 'DRY-RUN' : 'WRITE'})`,
  );

  if (dryRun) {
    const byRole = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.role_id] = (acc[r.role_id] ?? 0) + 1;
      return acc;
    }, {});
    for (const [role, count] of Object.entries(byRole).sort()) {
      console.log(`  ${role}: ${count} terms`);
    }
    return 0;
  }

  // Truncate then bulk insert. Run as a single statement-batch to keep the
  // table consistent for concurrent readers (trigger reads).
  const { error: truncErr } = await supabase
    .from('__seo_role_canon_forbidden')
    .delete()
    .gt('term', ''); // matches every row
  if (truncErr) {
    console.error(`[FATAL] truncate failed: ${truncErr.message}`);
    return 1;
  }

  if (rows.length === 0) {
    console.warn('[WARN] no canon rows to insert — check @repo/seo-roles');
    return 0;
  }

  // Insert in batches of 500 to stay below PostgREST payload limits.
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('__seo_role_canon_forbidden')
      .insert(slice);
    if (error) {
      console.error(`[FATAL] insert batch ${i} failed: ${error.message}`);
      return 1;
    }
  }

  // Verify count
  const { count, error: countErr } = await supabase
    .from('__seo_role_canon_forbidden')
    .select('*', { count: 'exact', head: true });
  if (countErr) {
    console.error(`[WARN] count verification failed: ${countErr.message}`);
  } else {
    console.log(`[OK] DB now contains ${count ?? '?'} canon rows`);
  }

  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
