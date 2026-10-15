// Ephemeral PostgreSQL fixture. No .env, provider, Supabase or network access.
import { PGlite } from '../../output/sql-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const migration = (name) => 'BEGIN;\n' + readFileSync(new URL(`../../backend/supabase/migrations/${name}`, import.meta.url), 'utf8') + '\nCOMMIT;';
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE __marketing_social_posts (
 id bigint PRIMARY KEY, channels jsonb NOT NULL, channels_list text[], primary_channel text,
 status text DEFAULT 'generated', approved_by text, approved_at timestamptz, published_at timestamptz,
 gate_summary jsonb, brand_gate_level text, compliance_gate_level text, quality_score numeric,
 updated_at timestamptz DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON __marketing_social_posts TO service_role;
INSERT INTO __marketing_social_posts(id,channels,channels_list,primary_channel) VALUES
 (1,'{"facebook":{"caption":"Approved fixture","format":"post"}}',ARRAY['facebook'],'facebook'),
 (2,'{"facebook":{"caption":"Other fixture","format":"post"}}',ARRAY['facebook'],'facebook');
`);
await db.exec(migration('20261014010000_marketing_social_reviews.sql'));
await db.exec(migration('20261014091855_marketing_publication_preparations.sql'));
const account = { external_id: 'fixture-account', label: 'Test account' };
const media = [{ bucket: 'private-fixture', path: 'final/image.png', sha256: 'a'.repeat(64), role: 'image' }];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const prepare = async (options = {}) => {
  const v = { post: 1, request: id(1), channel: 'facebook', revision: 1, review: 2, account, media, actor: 'admin-42', ...options };
  const result = await db.query('SELECT prepare_marketing_publication($1,$2,$3,$4,$5,$6,$7,$8) AS record',
    [v.post, v.request, v.channel, v.revision, v.review, v.account, v.media, v.actor]);
  return result.rows[0].record;
};
const gate = { brand: { level: 'PASS' }, compliance: { level: 'PASS' }, can_approve: true, blocking_issues: [] };
const review = (post, rev, version, action) => db.query('SELECT review_marketing_social_post($1,$2,$3,$4,$5,$6,$7)',
  [post, 'facebook', rev, version, action, 'reviewer-42', gate]);
let checks = 0;
const check = async (name, fn) => { await fn(); console.log('PASS', name); checks++; };
try {
  await db.exec('SET ROLE service_role');
  await check('unapproved content rejected', () => assert.rejects(prepare({ review: 0 }), { code: '23514' }));
  await review(1, 1, 0, 'gate'); await review(1, 1, 1, 'approve');
  await review(2, 1, 0, 'gate'); await review(2, 1, 1, 'approve');
  let original;
  await check('persists DB-owned editorial and approval snapshots', async () => {
    original = await prepare();
    assert.equal(original.post_id, 1);
    assert.equal(original.editorial_snapshot.channels.facebook.caption, 'Approved fixture');
    assert.equal(original.approval_snapshot.actor, 'reviewer-42');
    assert.equal(original.actor, 'admin-42');
    assert.deepEqual(original.account, account); assert.deepEqual(original.media, media);
    assert.ok(original.created_at); assert.equal(original.publication_ready, undefined);
  });
  await check('same request returns identical immutable record', async () => assert.deepEqual(await prepare(), original));
  for (const [name, overrides] of [
    ['changed account', { account: { ...account, external_id: 'other' } }],
    ['changed media', { media: [] }], ['changed actor', { actor: 'admin-43' }], ['cross-post request reuse', { post: 2 }],
  ]) await check(name, () => assert.rejects(prepare(overrides), { code: '23505' }));
  await check('new request allows corrected binding without erasing old record', async () => {
    const corrected = await prepare({ request: id(2), account: { ...account, external_id: 'corrected' } });
    assert.notEqual(corrected.request_id, original.request_id);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM __marketing_publication_preparations')).rows[0].n, 2);
  });
  await check('stale content rejected', () => assert.rejects(prepare({ request: id(3), revision: 2 }), { code: '40001' }));
  await check('stale review rejected', () => assert.rejects(prepare({ request: id(3), review: 1 }), { code: '40001' }));
  await check('unapproved network rejected', () => assert.rejects(prepare({ request: id(3), channel: 'instagram' }), { code: '23514' }));
  for (const [name, overrides] of [
    ['missing actor', { actor: ' ' }], ['null account', { account: null }],
    ['account token rejected', { account: { ...account, access_token: 'secret' } }],
    ['invalid account ID', { account: { ...account, external_id: 'https://example.com' } }],
    ['null media', { media: null }], ['malformed media', { media: {} }],
    ['invalid checksum', { media: [{ ...media[0], sha256: 'unknown' }] }],
    ['traversal reference', { media: [{ ...media[0], path: '../escape' }] }],
    ['signed URL reference', { media: [{ ...media[0], path: 'https://example.com/token' }] }],
    ['unknown media field', { media: [{ ...media[0], signed_url: 'secret' }] }],
    ['duplicate object', { media: [media[0], media[0]] }],
  ]) await check(name, () => assert.rejects(prepare({ request: id(3), ...overrides }), { code: '23514' }));
  await check('snapshots cannot be forged via direct table INSERT', () => assert.rejects(db.query(
    'INSERT INTO __marketing_publication_preparations(request_id,post_id,channel,content_revision,review_version,account,media,actor,editorial_snapshot) VALUES ($1,1,\'facebook\',1,2,$2,$3,\'admin-42\',\'{}\')', [id(4), account, media]), { code: '42501' }));
  await check('direct INSERT still checks live review', () => assert.rejects(db.query(
    'INSERT INTO __marketing_publication_preparations(request_id,post_id,channel,content_revision,review_version,account,media,actor) VALUES ($1,1,\'facebook\',1,0,$2,$3,\'admin-42\')', [id(4), account, media]), { code: '40001' }));
  for (const verb of ['UPDATE __marketing_publication_preparations SET actor=\'forged\'', 'DELETE FROM __marketing_publication_preparations']) {
    await check('service cannot mutate history: ' + verb.split(' ')[0], () => assert.rejects(db.exec(verb), { code: '42501' }));
  }
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`RESET ROLE; SET ROLE ${role}`);
    await check(role + ' cannot call preparation RPC', () => assert.rejects(prepare(), { code: '42501' }));
    await check(role + ' cannot read preparation history', () => assert.rejects(db.query('SELECT * FROM __marketing_publication_preparations'), { code: '42501' }));
  }
  await db.exec('RESET ROLE');
  await check('RLS enabled and functions invoker', async () => {
    assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='__marketing_publication_preparations'::regclass")).rows[0].relrowsecurity, true);
    assert.equal((await db.query("SELECT prosecdef FROM pg_proc WHERE proname='prepare_marketing_publication'")).rows[0].prosecdef, false);
  });
  await check('owner UPDATE blocked by append-only trigger', () => assert.rejects(db.exec("UPDATE __marketing_publication_preparations SET actor='forged'"), /append-only/));
  await db.exec('SET ROLE service_role');
  await review(1, 1, 2, 'reject');
  await check('old idempotency key cannot revive revoked approval', () => assert.rejects(prepare(), { code: '40001' }));
  await check('current rejected approval cannot be prepared', () => assert.rejects(prepare({ request: id(3), review: 3 }), { code: '23514' }));
  await db.exec("UPDATE __marketing_social_posts SET channels='{}' WHERE id=1");
  await check('historic snapshot survives source edits', async () => {
    const saved = (await db.query('SELECT * FROM __marketing_publication_preparations WHERE request_id=$1', [id(1)])).rows[0];
    assert.deepEqual(saved.editorial_snapshot, original.editorial_snapshot);
  });
  console.log(JSON.stringify({ checks, environment: 'isolated PGlite fixture', shared_database: false, concurrent_sessions: false }));
} finally { await db.close(); }
