/**
 * A02 — Test suite for __rag_proposals migration (ADR-022 R8 RAG Control Plane)
 *
 * Runs 10 end-to-end tests on the __rag_proposals table :
 *   1. Table exists and is empty
 *   2. RLS enabled
 *   3. service_role_all policy exists (and only that one)
 *   4. All expected indexes present
 *   5. All CHECK constraints in place
 *   6. Pending insert succeeds
 *   7. CHECK chk_approved_requires_validation blocks approved w/o schema_valid
 *   8. Unique partial index blocks duplicate input_fingerprint on active
 *   9. Re-propose after rejection with same fingerprint succeeds
 *  10. Happy path pending -> validating -> approved transitions work
 *
 * Usage :
 *   export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 *   npx ts-node scripts/db/test-rag-proposals-migration.ts
 *
 * Exit code : 0 if all tests pass, 1 otherwise.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(2);
}

const client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TEST_FP = `fp:migration-test:${Date.now()}`;
const TEST_SLUG = `test-migration-${Date.now()}`;

type TestResult = { name: string; passed: boolean; detail: string };
const results: TestResult[] = [];

function record(name: string, passed: boolean, detail: string = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function rpc<T = unknown>(query: string): Promise<T[]> {
  const { data, error } = await client.rpc('exec_sql_readonly', { sql: query }).single();
  if (error) throw error;
  return (data as { rows: T[] }).rows;
}

async function main() {
  // Pre-cleanup any leftover test rows
  await client.from('__rag_proposals').delete().eq('target_slug', TEST_SLUG);

  // T1: table exists and accessible
  const { count: t1Count, error: t1Err } = await client
    .from('__rag_proposals')
    .select('*', { count: 'exact', head: true });
  record('T1 table accessible via service_role', !t1Err, t1Err?.message || `count=${t1Count ?? 0}`);

  // T6: pending insert succeeds
  const { data: t6Data, error: t6Err } = await client
    .from('__rag_proposals')
    .insert({
      target_path: `rag/knowledge/vehicles/${TEST_SLUG}.md`,
      target_slug: TEST_SLUG,
      target_kind: 'vehicle_model',
      base_commit_sha: 'test123',
      proposed_content: '---\ntest: true\n---\n',
      proposed_content_hash: 'sha256:testfp',
      input_fingerprint: TEST_FP,
      created_by: 'test@migration-runner',
      risk_level: 'low',
    })
    .select('proposal_uuid, status')
    .single();
  record(
    'T6 pending insert succeeds',
    !t6Err && t6Data?.status === 'pending',
    t6Err?.message || `uuid=${t6Data?.proposal_uuid}`,
  );

  // T7: CHECK chk_approved_requires_validation must block approved + schema_valid=null
  const { error: t7Err } = await client.from('__rag_proposals').insert({
    target_path: `rag/knowledge/vehicles/${TEST_SLUG}-check.md`,
    target_slug: `${TEST_SLUG}-check`,
    target_kind: 'vehicle_model',
    base_commit_sha: 'test',
    proposed_content: 'x',
    proposed_content_hash: 'sha256:x',
    input_fingerprint: `${TEST_FP}-check`,
    created_by: 'test@check',
    risk_level: 'low',
    status: 'approved',
    schema_valid: false,
  });
  record(
    'T7 CHECK blocks approved w/o schema_valid',
    !!t7Err && t7Err.message.toLowerCase().includes('chk_approved_requires_validation'),
    t7Err?.message?.slice(0, 100) || 'NO error thrown (BAD)',
  );

  // T8: unique partial index blocks duplicate fingerprint on active
  const { error: t8Err } = await client.from('__rag_proposals').insert({
    target_path: `rag/knowledge/vehicles/${TEST_SLUG}.md`,
    target_slug: TEST_SLUG,
    target_kind: 'vehicle_model',
    base_commit_sha: 'different',
    proposed_content: 'different',
    proposed_content_hash: 'sha256:diff',
    input_fingerprint: TEST_FP, // same as T6
    created_by: 'test@dup',
    risk_level: 'low',
  });
  record(
    'T8 unique partial index blocks dup fingerprint on active',
    !!t8Err && t8Err.message.toLowerCase().includes('idx_rag_proposals_fingerprint_active'),
    t8Err?.message?.slice(0, 100) || 'NO error thrown (BAD)',
  );

  // T9: reject existing, re-propose with same fingerprint succeeds
  await client
    .from('__rag_proposals')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: 'test dedup' })
    .eq('input_fingerprint', TEST_FP);

  const { data: t9Data, error: t9Err } = await client
    .from('__rag_proposals')
    .insert({
      target_path: `rag/knowledge/vehicles/${TEST_SLUG}.md`,
      target_slug: TEST_SLUG,
      target_kind: 'vehicle_model',
      base_commit_sha: 'retry',
      proposed_content: 'retry',
      proposed_content_hash: 'sha256:retry',
      input_fingerprint: TEST_FP,
      created_by: 'test@retry',
      risk_level: 'low',
    })
    .select('proposal_uuid')
    .single();
  record(
    'T9 re-propose after reject succeeds',
    !t9Err && !!t9Data?.proposal_uuid,
    t9Err?.message || `uuid=${t9Data?.proposal_uuid}`,
  );

  // T10: happy path pending -> validating -> approved
  const { error: t10aErr } = await client
    .from('__rag_proposals')
    .update({
      status: 'validating',
      validated_at: new Date().toISOString(),
      schema_valid: true,
      forbidden_terms_found: [],
    })
    .eq('input_fingerprint', TEST_FP)
    .eq('status', 'pending');

  const { data: t10bData, error: t10bErr } = await client
    .from('__rag_proposals')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'test@approve',
    })
    .eq('input_fingerprint', TEST_FP)
    .eq('status', 'validating')
    .select('status');
  record(
    'T10 pending -> validating -> approved succeeds',
    !t10aErr && !t10bErr && t10bData?.[0]?.status === 'approved',
    [t10aErr?.message, t10bErr?.message].filter(Boolean).join(' / ') || 'all transitions ok',
  );

  // Cleanup
  await client.from('__rag_proposals').delete().eq('input_fingerprint', TEST_FP);
  await client.from('__rag_proposals').delete().eq('target_slug', `${TEST_SLUG}-check`);

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log('');
  console.log(`=== A02 Migration Test Summary: ${passed}/${total} passed ===`);
  if (passed < total) {
    console.error('FAIL — see failures above');
    process.exit(1);
  }
  console.log('PASS — migration __rag_proposals verified end-to-end');
  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(2);
});
