const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const root = path.resolve(__dirname, '../..');
const workspace = path.join(root, 'workspaces/marketing/fafa-media-factory');
const pilot = path.join(workspace, 'scripts/draft/fafa-plaquettes-frein-001');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(read(path.join(workspace, 'governance/claim-table.schema.json')));
const evidenceSchema = read(path.join(workspace, 'governance/evidence-pack.schema.json'));
const validateEvidence = ajv.compile(evidenceSchema);

// Synthetic admission fixtures only; no WIKI source or approval is resolved.
function wikiAdmissionFixture(t) {
  const tempBase = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(tempBase, 'fafa-wiki-admission-'));
  t.after(() => {
    const actual = fs.realpathSync(dir);
    assert.equal(path.dirname(actual), tempBase);
    assert.ok(path.basename(actual).startsWith('fafa-wiki-admission-'));
    fs.rmSync(actual, { recursive: true });
  });
  for (const name of ['brief.json', 'claims.json', 'evidence.json', 'approval.json', 'disclaimer.json']) {
    fs.copyFileSync(path.join(pilot, name), path.join(dir, name));
  }
  const claims = read(path.join(dir, 'claims.json'));
  claims.claims = [{ claim_id: 'claim-1', text: 'Synthetic admission claim only.', kind: 'dimension',
    source_status: 'verified', evidence_refs: ['synthetic-wiki'], human_validated: false }];
  const evidence = { video_id: claims.video_id, evidence: [{ doc_id: 'synthetic-wiki',
    source_type: 'wiki_diagnostic', excerpt: 'Synthetic evidence without a source or decision.', confidence: 1,
    wiki_reference: { path: 'does-not-exist-synthetic.md', commit: 'a'.repeat(40), section: 'synthetic',
      approved_by: 'synthetic-not-authenticated', approved_at: '2026-01-01T00:00:00Z' } }] };
  const save = () => {
    fs.writeFileSync(path.join(dir, 'claims.json'), JSON.stringify(claims));
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence));
  };
  save();
  return { dir, claims, evidence, save };
}

test('unresolved wiki reference cannot make a factual claim ready', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const fixture = wikiAdmissionFixture(t);
  const result = evaluateDossier(fixture.dir);
  assert.equal(result.claimsReady, false);
  assert.equal(result.readiness, 'NOT_READY');
  assert.equal(result.canPublishEligible, false);
  assert.equal(result.actorAuthenticated, false);
  assert.deepEqual(result.acceptedEvidenceIds, []);
  assert.deepEqual(result.wikiAdmission, { status: 'UNRESOLVED',
    unresolvedEvidenceIds: ['synthetic-wiki'], blockingClaimIds: ['claim-1'], reason: 'WIKI_ADMISSION_NOT_CONNECTED' });
  assert.match(result.reason, /WIKI.*admission/i);
});

for (const kind of ['procedure', 'safety']) {
  test(`declared human validation does not bypass unresolved wiki admission: ${kind}`, (t) => {
    const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
    const fixture = wikiAdmissionFixture(t);
    Object.assign(fixture.claims.claims[0], { kind, human_validated: true,
      human_validated_by: 'synthetic-not-authenticated', human_validated_at: '2026-01-01T00:00:00Z' });
    fixture.save();
    const result = evaluateDossier(fixture.dir);
    assert.equal(result.claimGates.some((gate) => gate.verdict === 'FAIL'), false);
    assert.equal(result.claimsReady, false);
    assert.equal(result.readiness, 'NOT_READY');
    assert.equal(result.canPublishEligible, false);
    assert.equal(result.actorAuthenticated, false);
    assert.deepEqual(result.wikiAdmission.blockingClaimIds, ['claim-1']);
    assert.deepEqual(result.acceptedEvidenceIds, []);
  });
}

for (const referenced of [false, true]) {
  test(referenced ? 'catalogue support does not hide a referenced unresolved wiki entry'
    : 'unused wiki reference does not block catalogue supported claims', (t) => {
    const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
    const fixture = wikiAdmissionFixture(t);
    fs.mkdirSync(path.join(fixture.dir, 'extracts'));
    const bytes = Buffer.from('[{"id":"fixture-only","value":"synthetic"}]\n');
    fs.writeFileSync(path.join(fixture.dir, 'extracts/test.json'), bytes);
    fixture.evidence.evidence.push({ doc_id: 'synthetic-catalogue', source_type: 'catalogue_interne',
      excerpt: 'Synthetic catalogue extraction only.', confidence: 1, extracted_at: '2026-01-01T00:00:00Z',
      data_reference: { table: 'fixture_only', key: { id: 'fixture-only' }, query: 'SELECT id, value FROM fixture_only',
        extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex'), extract_path: 'extracts/test.json' } });
    fixture.claims.claims[0].evidence_refs = referenced ? ['synthetic-catalogue', 'synthetic-wiki'] : ['synthetic-catalogue'];
    fixture.save();
    const result = evaluateDossier(fixture.dir);
    assert.equal(result.claimsReady, !referenced);
    assert.equal(result.readiness, referenced ? 'NOT_READY' : 'CLAIMS_ONLY');
    assert.equal(result.canPublishEligible, referenced ? false : null);
    assert.equal(result.humanReview, 'NOT_ASSESSED');
    assert.deepEqual(result.acceptedEvidenceIds, ['synthetic-catalogue']);
    assert.deepEqual(result.wikiAdmission, { status: referenced ? 'UNRESOLVED' : 'NOT_REFERENCED',
      unresolvedEvidenceIds: ['synthetic-wiki'], blockingClaimIds: referenced ? ['claim-1'] : [],
      reason: 'WIKI_ADMISSION_NOT_CONNECTED' });
  });
}

test('historical wiki trace never becomes admitted support', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const fixture = wikiAdmissionFixture(t);
  fixture.evidence.historical_traces = fixture.evidence.evidence;
  fixture.evidence.evidence = [];
  fixture.save();
  const result = evaluateDossier(fixture.dir);
  assert.equal(result.claimsReady, false);
  assert.equal(result.readiness, 'NOT_READY');
  assert.deepEqual(result.acceptedEvidenceIds, []);
  assert.deepEqual(result.wikiAdmission, { status: 'NOT_REFERENCED',
    unresolvedEvidenceIds: [], blockingClaimIds: [], reason: null });
});

test('wiki admission diagnostics are deterministic and dossier remains unchanged', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const fixture = wikiAdmissionFixture(t);
  const entry = fixture.evidence.evidence[0];
  fixture.evidence.evidence = ['wiki-z', 'wiki-a'].map((doc_id) => ({ ...entry, doc_id }));
  const claim = fixture.claims.claims[0];
  fixture.claims.claims = ['claim-2', 'claim-1'].map((claim_id) => ({ ...claim, claim_id,
    evidence_refs: ['wiki-z', 'wiki-a', 'wiki-z'] }));
  const expected = { status: 'UNRESOLVED', unresolvedEvidenceIds: ['wiki-a', 'wiki-z'],
    blockingClaimIds: ['claim-1', 'claim-2'], reason: 'WIKI_ADMISSION_NOT_CONNECTED' };
  const snapshot = () => Object.fromEntries(fs.readdirSync(fixture.dir).sort().map((name) =>
    [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture.dir, name))).digest('hex')]));
  for (const reversed of [false, true]) {
    if (reversed) { fixture.claims.claims.reverse(); fixture.evidence.evidence.reverse(); }
    fixture.save();
    const before = snapshot();
    assert.deepEqual(evaluateDossier(fixture.dir).wikiAdmission, expected);
    assert.deepEqual(snapshot(), before);
  }
});

test('CLI exits two for unresolved wiki admission', (t) => {
  const fixture = wikiAdmissionFixture(t);
  const names = fs.readdirSync(fixture.dir).sort();
  const before = names.map((name) => fs.readFileSync(path.join(fixture.dir, name)));
  const child = require('node:child_process').spawnSync(process.execPath,
    [path.join(__dirname, 'fafa-pilot-governance.cjs'), fixture.dir], { encoding: 'utf8', timeout: 60000 });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 2, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.readiness, 'NOT_READY');
  assert.equal(result.wikiAdmission.status, 'UNRESOLVED');
  assert.deepEqual(fs.readdirSync(fixture.dir).sort(), names);
  assert.deepEqual(names.map((name) => fs.readFileSync(path.join(fixture.dir, name))), before);
});

test('workspace and runtime share the same claim gates', () => {
  require('ts-node').register({ project: path.join(root, 'backend/tsconfig.json'), transpileOnly: true });
  const { VideoGatesService } = require(path.join(root, 'backend/src/modules/media-factory/services/video-gates.service.ts'));
  const service = new VideoGatesService();
  assert.equal(typeof service.runClaimGates, 'function');
  const input = { claims: [], evidencePack: [] };
  assert.deepEqual(service.runClaimGates(input), service.runAllGates(input).gates.slice(0, 2));
});

test('D17 rejects catalogue page or SEO migration text without a data reference', () => {
  const doc = read(path.join(pilot, 'evidence.json'));
  const traces = doc.historical_traces ?? doc.evidence;
  for (const trace of traces) {
    assert.equal(validateEvidence({ video_id: doc.video_id, evidence: [trace] }), false);
  }
});

test('D17 keeps historical text traces but does not present them as evidence', () => {
  const doc = read(path.join(pilot, 'evidence.json'));
  assert.deepEqual(doc.evidence, []);
  assert.equal(doc.historical_traces.length, 2);
  assert.equal(validateEvidence(doc), true, JSON.stringify(validateEvidence.errors));
});

test('claim schema accepts the backend vocabulary and rejects legacy statuses', () => {
  for (const status of ['verified', 'unverified', 'blocked', 'sourced', 'unsourced']) {
    const doc = read(path.join(pilot, 'claims.json'));
    doc.claims.forEach((claim) => { claim.source_status = status; });
    assert.equal(validate(doc), ['verified', 'unverified', 'blocked'].includes(status), status);
  }
});

test('pilot compatibility assertions stay unverified until source review', () => {
  const doc = read(path.join(pilot, 'claims.json'));
  assert.equal(doc.claims.length, 4);
  assert.ok(doc.claims.every((claim) => claim.source_status === 'unverified'));
  assert.ok(doc.claims.every((claim) => claim.human_validated === false));
});

test('pilot reports the actual L10a failure rather than historical eligibility', () => {
  const approval = read(path.join(pilot, 'approval.json'));
  assert.equal(approval.gate_results.find((gate) => gate.gate === 'G1').verdict, 'FAIL');
  assert.equal(approval.gate_results.find((gate) => gate.gate === 'G1').measured, 4);
  const manifest = read(path.join(workspace, 'manifests/renders/fafa-plaquettes-frein-001.json'));
  assert.equal(manifest.brandSafetyReview.canPublishEligible, false);
  assert.ok(Object.entries(approval.approval).filter(([key]) => key.endsWith('_approved')).every(([, value]) => value === false));
});

test('file-only evaluator reuses L10a and keeps approval distinct from eligibility', () => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const result = evaluateDossier(pilot);
  assert.equal(result.readiness, 'NOT_READY');
  assert.equal(result.claimGates[0].measured, 4);
  assert.equal(result.claimGates[0].verdict, 'FAIL');
  assert.equal(result.approvalsComplete, false);
  assert.equal(result.canPublishEligible, false);
  assert.deepEqual(result.acceptedEvidenceIds, []);
  assert.equal(result.actorAuthenticated, false);
});

for (const declaredApproved of [false, true]) {
  test(`declared approvals never assess human review: ${declaredApproved}`, (t) => {
    const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
    const fixture = wikiAdmissionFixture(t);
    const approvalPath = path.join(fixture.dir, 'approval.json');
    const record = read(approvalPath);
    for (const stage of ['content', 'render', 'publish']) {
      record.approval[`${stage}_approved`] = declaredApproved;
      record.approval[`${stage}_approved_by`] = declaredApproved ? 'synthetic-not-authenticated' : null;
      record.approval[`${stage}_approved_at`] = declaredApproved ? '2026-01-01T00:00:00Z' : null;
    }
    record.approval.render_sha256 = declaredApproved ? 'a'.repeat(64) : null;
    fs.writeFileSync(approvalPath, JSON.stringify(record));
    const before = fs.readFileSync(approvalPath);
    const result = evaluateDossier(fixture.dir);
    assert.equal(result.approvalsComplete, declaredApproved); // Declaration only, retained for compatibility.
    assert.equal(result.actorAuthenticated, false);
    assert.equal(result.humanReview, 'NOT_ASSESSED');
    assert.equal(result.canPublishEligible, false);
    assert.equal(result.readiness, 'NOT_READY');
    assert.deepEqual(fs.readFileSync(approvalPath), before);
  });
}

test('D17 supporting evidence excludes proposals, SEO text and other unapproved types', () => {
  const supports = ajv.getSchema(`${evidenceSchema.$id}#/$defs/SupportingEvidence`);
  for (const source_type of ['wiki_proposal', 'wiki_diagnostic', 'oem_spec', 'tecdoc', 'catalogue_interne']) {
    const entry = { doc_id: 'fixture', source_type, excerpt: 'Synthetic text only.', confidence: 1 };
    assert.equal(supports(entry), false, source_type);
  }
  assert.equal(supports({ doc_id: 'fixture', source_type: 'wiki_diagnostic', excerpt: 'Synthetic text only.', confidence: 1,
    wiki_reference: { path: 'test-only.md', commit: 'a'.repeat(40), section: 'fixture', approved_by: 'test-only', approved_at: '2026-01-01T00:00:00Z' } }), true);
});

test('catalogue extraction checks exact bytes and keys, missing files, escapes and changed rows', (t) => {
  const { checkExtract } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-claims-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const dir = path.join(temp, 'pilot');
  fs.mkdirSync(path.join(dir, 'extracts'), { recursive: true });
  const bytes = Buffer.from('[{"id":1,"value":"synthetic"}]\n');
  fs.writeFileSync(path.join(dir, 'extracts/rows.json'), bytes);
  fs.writeFileSync(path.join(temp, 'outside.json'), bytes);
  const ref = { table: 'test_only', key: { id: 1 }, query: 'SELECT id, value FROM test_only', extract_path: 'extracts/rows.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  assert.doesNotThrow(() => checkExtract(dir, ref));
  assert.throws(() => checkExtract(dir, { ...ref, key: { id: 2 } }), /EXTRACT_KEY_MISSING/);
  assert.throws(() => checkExtract(dir, { ...ref, extract_path: 'extracts/missing.json' }), /ENOENT/);
  assert.throws(() => checkExtract(dir, { ...ref, extract_path: '../outside.json' }), /EXTRACT_OUTSIDE_DOSSIER/);
  fs.writeFileSync(path.join(dir, 'extracts/rows.json'), '[{"id":1,"value":"changed"}]');
  assert.throws(() => checkExtract(dir, ref), /EXTRACT_HASH_MISMATCH/);
});

for (const [name, rows] of [
  ['conflicting records', [{ id: 1, value: 'left' }, { id: 1, value: 'right' }]],
  ['duplicate records', [{ id: 1, value: 'same' }, { id: 1, value: 'same' }]],
]) {
  test(`catalogue anchor rejects ${name} even with a correct digest`, (t) => {
    const { checkExtract } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-anchor-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.mkdirSync(path.join(temp, 'extracts'));
    const bytes = Buffer.from(JSON.stringify(rows));
    fs.writeFileSync(path.join(temp, 'extracts/test.json'), bytes);
    const ref = { table: 'fixture_only', key: { id: 1 }, query: 'SELECT id, value FROM fixture_only',
      extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    assert.throws(() => checkExtract(temp, ref), /EXTRACT_KEY_AMBIGUOUS/);
    assert.deepEqual(fs.readFileSync(path.join(temp, 'extracts/test.json')), bytes);
  });
}

test('catalogue composite anchor identifies one row without discarding other records', (t) => {
  const { checkExtract } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-anchor-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temp, 'extracts'));
  const bytes = Buffer.from(JSON.stringify([
    { id: 1, variant: 'left' }, { id: 1, variant: 'right' },
    { id: 2, variant: 'other' }, { id: 2, variant: 'other' },
  ]));
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), bytes);
  const ref = { table: 'fixture_only', key: { id: 1, variant: 'left' }, query: 'SELECT id, variant FROM fixture_only',
    extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  assert.doesNotThrow(() => checkExtract(temp, ref));
  assert.deepEqual(fs.readFileSync(path.join(temp, 'extracts/test.json')), bytes);
});

for (const [name, keyJson, rowsJson] of [
  ['rounded positive identifiers', '{"id":9007199254740993}', '[{"id":9007199254740992}]'],
  ['rounded negative identifiers', '{"id":-9007199254740993}', '[{"id":-9007199254740992}]'],
  ['unsafe row in anchor column', '{"id":1}', '[{"id":1},{"id":9007199254740993}]'],
  ['overflow in anchor column', '{"id":1}', '[{"id":1},{"id":1e400}]'],
]) {
  test(`catalogue anchor rejects ${name} despite exact file hash`, (t) => {
    const { checkExtract } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-numeric-anchor-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.mkdirSync(path.join(temp, 'extracts'));
    const bytes = Buffer.from(rowsJson);
    const file = path.join(temp, 'extracts/test.json');
    fs.writeFileSync(file, bytes);
    const ref = { table: 'fixture_only', key: JSON.parse(keyJson), query: 'SELECT id FROM fixture_only',
      extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    assert.throws(() => checkExtract(temp, ref), /EXTRACT_KEY_UNSAFE_NUMBER/);
    assert.deepEqual(fs.readFileSync(file), bytes);
  });
}

test('catalogue anchor preserves safe bounds, decimals and exact string identifiers', (t) => {
  const { checkExtract } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-numeric-anchor-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temp, 'extracts'));
  const bytes = Buffer.from('[{"id":9007199254740991},{"id":-9007199254740991},{"id":1.5},{"id":"9007199254740993"},{"id":"9007199254740992"}]');
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), bytes);
  const ref = { table: 'fixture_only', query: 'SELECT id FROM fixture_only', extract_path: 'extracts/test.json',
    extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  for (const id of [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 1.5, '9007199254740993', '9007199254740992']) {
    assert.doesNotThrow(() => checkExtract(temp, { ...ref, key: { id } }));
  }
  assert.throws(() => checkExtract(temp, { ...ref, key: { id: '9007199254740994' } }), /EXTRACT_KEY_MISSING/);
  assert.deepEqual(fs.readFileSync(path.join(temp, 'extracts/test.json')), bytes);
});

for (const count of [1000, 1001, 1002]) {
  test(`catalogue extraction admission checks the ${count}-row boundary without trimming`, (t) => {
    const { checkExtract } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-extract-limit-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.mkdirSync(path.join(temp, 'extracts'));
    const bytes = Buffer.from(JSON.stringify(Array.from({ length: count }, (_, id) => ({ id, value: 'synthetic only' }))));
    const file = path.join(temp, 'extracts/test.json');
    fs.writeFileSync(file, bytes);
    const ref = { table: 'fixture_only', key: { id: 0 }, query: 'SELECT id, value FROM fixture_only ORDER BY id LIMIT 1001',
      extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    if (count === 1000) assert.doesNotThrow(() => checkExtract(temp, ref));
    else assert.throws(() => checkExtract(temp, ref), /EXTRACT_ROW_LIMIT/);
    assert.deepEqual(fs.readFileSync(file), bytes);
  });
}

for (const [name, invalid] of [
  ['invalid leading byte', [0xff]],
  ['incomplete sequence', [0xc3]],
  ['overlong encoding', [0xc0, 0xaf]],
  ['encoded surrogate', [0xed, 0xa0, 0x80]],
]) {
  test(`catalogue extraction rejects ${name} before lossy UTF-8 replacement`, (t) => {
    const { checkExtract } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-utf8-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.mkdirSync(path.join(temp, 'extracts'));
    const bytes = Buffer.concat([Buffer.from('[{"id":"'), Buffer.from(invalid), Buffer.from('"}]')]);
    const file = path.join(temp, 'extracts/test.json');
    fs.writeFileSync(file, bytes);
    // The old decoder manufactured this anchor from malformed source bytes.
    const key = JSON.parse(bytes.toString('utf8'))[0];
    const ref = { table: 'fixture_only', key, query: 'SELECT id FROM fixture_only',
      extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    assert.throws(() => checkExtract(temp, ref), /INVALID_JSON_UTF8/);
    assert.deepEqual(fs.readFileSync(file), bytes);
  });
}

test('valid UTF-8 remains exact, including accents, supplementary characters and literal replacement character', (t) => {
  const { checkExtract } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-utf8-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temp, 'extracts'));
  const id = 'témoin-\u{1f697}-\ufffd';
  const bytes = Buffer.from(JSON.stringify([{ id }]));
  const file = path.join(temp, 'extracts/test.json');
  fs.writeFileSync(file, bytes);
  const ref = { table: 'fixture_only', key: { id }, query: 'SELECT id FROM fixture_only',
    extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  assert.doesNotThrow(() => checkExtract(temp, ref));
  assert.deepEqual(fs.readFileSync(file), bytes);
});

test('dossier rejects malformed UTF-8 in claim text instead of evaluating replacement text', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-utf8-dossier-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(pilot, temp, { recursive: true });
  const file = path.join(temp, 'claims.json');
  const claims = read(file);
  claims.claims[0].text = 'Synthetic UTF8 marker only';
  const bytes = Buffer.from(JSON.stringify(claims));
  const index = bytes.indexOf('Synthetic UTF8 marker only');
  assert.ok(index >= 0);
  bytes[index] = 0xff;
  fs.writeFileSync(file, bytes);
  assert.throws(() => evaluateDossier(temp), /INVALID_JSON_UTF8/);
  assert.deepEqual(fs.readFileSync(file), bytes);
});

for (const [name, text] of [
  ['conflicting anchor', '[{"id":2,"id":1}]'],
  ['identical anchor', '[{"id":1,"id":1}]'],
  ['escaped anchor name', '[{"id":2,"\\u0069d":1}]'],
  ['nested metadata', '[{"id":1,"metadata":{"unit":"mm","unit":"inch"}}]'],
  ['object inside nested array', '[{"id":1,"metadata":[{"unit":"mm","unit":"inch"}]}]'],
]) {
  test(`catalogue extraction rejects duplicate JSON fields: ${name}`, (t) => {
    const { checkExtract } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-json-keys-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.mkdirSync(path.join(temp, 'extracts'));
    const bytes = Buffer.from(text);
    const file = path.join(temp, 'extracts/test.json');
    fs.writeFileSync(file, bytes);
    const ref = { table: 'fixture_only', key: { id: 1 }, query: 'SELECT id FROM fixture_only',
      extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    assert.throws(() => checkExtract(temp, ref), /DUPLICATE_JSON_KEY/);
    assert.deepEqual(fs.readFileSync(file), bytes);
  });
}

test('JSON key uniqueness is per object and preserves escaped strings and distinct Unicode names', (t) => {
  const { checkExtract } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-json-keys-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temp, 'extracts'));
  const bytes = Buffer.from(JSON.stringify([
    { id: 1, text: '"id":2,"id":1 { [ ] } \\ end', '\\"{},:[]': 'punctuation key',
      'é': 'composed', 'e\u0301': 'decomposed', metadata: { id: 1 },
      nested: [0, false, null, 'id', { id: 1 }, { id: 2 }, [{ id: 3 }]],
      afterArray: {}, afterObject: [], tail: 1.5 },
    { id: 2, metadata: { id: 1 } },
  ]));
  const file = path.join(temp, 'extracts/test.json');
  fs.writeFileSync(file, bytes);
  const ref = { table: 'fixture_only', key: { id: 1 }, query: 'SELECT id FROM fixture_only',
    extract_path: 'extracts/test.json', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  assert.doesNotThrow(() => checkExtract(temp, ref));
  assert.deepEqual(fs.readFileSync(file), bytes);
});

for (const [filename, field] of [['claims.json', 'claims'], ['evidence.json', 'evidence']]) {
  test(`dossier refuses a repeated ${field} field before schema or gate evaluation`, (t) => {
    const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-json-keys-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.cpSync(pilot, temp, { recursive: true });
    const file = path.join(temp, filename);
    const original = JSON.stringify(read(file));
    const bytes = Buffer.from(original.replace(`"${field}":`, `"${field}":[],"${field}":`));
    fs.writeFileSync(file, bytes);
    assert.throws(() => evaluateDossier(temp), /DUPLICATE_JSON_KEY/);
    assert.deepEqual(fs.readFileSync(file), bytes);
  });
}

test('verified claims cannot be supported by wiki_proposal or historical traces', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-dossier-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(pilot, temp, { recursive: true });
  const claims = read(path.join(temp, 'claims.json'));
  claims.claims.forEach((c) => { c.source_status = 'verified'; });
  fs.writeFileSync(path.join(temp, 'claims.json'), JSON.stringify(claims));
  assert.equal(evaluateDossier(temp).claimGates[0].measured, 4);
  const evidence = read(path.join(temp, 'evidence.json'));
  evidence.evidence = evidence.historical_traces.map((trace) => ({ ...trace, source_type: 'wiki_proposal' }));
  evidence.historical_traces = [];
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.equal(evaluateDossier(temp).claimGates[0].measured, 4);
});

test('D18 validates exact render bytes, review path, interval and absence of identity', (t) => {
  const { validateRenderReview, prepareCorrection } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-review-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = path.join(temp, 'synthetic-artifact.bin');
  const bytes = Buffer.from('Synthetic unit-test artifact, not a video.');
  fs.writeFileSync(file, bytes);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const manifest = { briefId: 'fafa-plaquettes-frein-001', artifact: { sha256: hash, bytes: bytes.length }, composition: { durationSecs: 38 } };
  const review = { render_sha256: hash, start_ms: 1000, end_ms: 2000, comment: 'Test only', requested_revision: 2 };
  const relativePath = `reviews/${hash}/2.json`;
  assert.doesNotThrow(() => validateRenderReview(review, relativePath, file, manifest));
  assert.throws(() => validateRenderReview({ ...review, actor: 'forged' }, relativePath, file, manifest), /INVALID_render-review/);
  assert.throws(() => validateRenderReview(review, `reviews/${'b'.repeat(64)}/2.json`, file, manifest), /REVIEW_PATH_MISMATCH/);
  assert.throws(() => validateRenderReview({ ...review, end_ms: 999 }, relativePath, file, manifest), /REVIEW_INTERVAL/);
  assert.throws(() => validateRenderReview({ ...review, end_ms: 38001 }, relativePath, file, manifest), /REVIEW_INTERVAL/);
  const approval = read(path.join(pilot, 'approval.json'));
  approval.revision = 1;
  for (const key of ['content', 'render', 'publish']) {
    approval.approval[`${key}_approved`] = true;
    approval.approval[`${key}_approved_by`] = 'test-only';
    approval.approval[`${key}_approved_at`] = '2026-01-01T00:00:00Z';
  }
  approval.approval.render_sha256 = hash;
  const before = JSON.stringify(approval);
  const otherApproval = structuredClone(approval);
  otherApproval.approval.render_sha256 = 'b'.repeat(64);
  assert.throws(() => prepareCorrection(otherApproval, review, relativePath, file, manifest), /APPROVAL_RENDER_MISMATCH/);
  const next = prepareCorrection(approval, review, relativePath, file, manifest);
  assert.equal(next.revision, 2);
  assert.equal(next.approval.content_approved, false);
  assert.equal(next.approval.render_approved, false);
  assert.equal(next.approval.publish_approved, false);
  assert.equal(next.approval.render_sha256, null);
  assert.equal(JSON.stringify(approval), before);
  assert.throws(() => prepareCorrection(next, review, relativePath, file, manifest), /REVISION_NOT_NEWER/);
  fs.writeFileSync(file, 'Different artifact');
  assert.throws(() => validateRenderReview(review, relativePath, file, manifest), /RENDER_HASH_MISMATCH/);
});

test('synthetic catalogue records exercise the path to supported claims without granting publication', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-catalogue-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(pilot, temp, { recursive: true });
  fs.mkdirSync(path.join(temp, 'extracts'));
  const bytes = Buffer.from('[{"id":"fixture-only","value":"synthetic"}]\n');
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), bytes);
  const claims = read(path.join(temp, 'claims.json'));
  claims.claims.forEach((c) => { c.source_status = 'verified'; });
  fs.writeFileSync(path.join(temp, 'claims.json'), JSON.stringify(claims));
  const evidence = read(path.join(temp, 'evidence.json'));
  evidence.evidence = evidence.historical_traces.map((trace) => ({
    ...trace, source_url: null, excerpt: 'Synthetic fixture only; no real catalogue query.',
    data_reference: { table: 'fixture_only', key: { id: 'fixture-only' }, query: 'SELECT id, value FROM fixture_only', extract_sha256: crypto.createHash('sha256').update(bytes).digest('hex'), extract_path: 'extracts/test.json' },
  }));
  evidence.historical_traces = [];
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  const result = evaluateDossier(temp);
  assert.equal(result.claimsReady, true);
  assert.equal(result.claimGates[0].verdict, 'PASS');
  assert.equal(result.readiness, 'CLAIMS_ONLY');
  assert.equal(result.canPublishEligible, null);
  assert.equal(result.approvalsComplete, false);
  const duplicateBytes = Buffer.from('[{"id":"wrong","id":"fixture-only","value":"synthetic"}]');
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), duplicateBytes);
  for (const entry of evidence.evidence) entry.data_reference.extract_sha256 = crypto.createHash('sha256').update(duplicateBytes).digest('hex');
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /DUPLICATE_JSON_KEY/);
  const invalidUtf8 = Buffer.concat([Buffer.from('[{"id":"fixture-only","value":"'), Buffer.from([0xff]), Buffer.from('"}]')]);
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), invalidUtf8);
  for (const entry of evidence.evidence) entry.data_reference.extract_sha256 = crypto.createHash('sha256').update(invalidUtf8).digest('hex');
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /INVALID_JSON_UTF8/);
  // Matching hashes and verified labels must not admit a possible-truncation sentinel.
  const limitedBytes = Buffer.from(JSON.stringify(Array.from({ length: 1001 }, (_, index) => ({
    id: index === 0 ? 'fixture-only' : `other-${index}`, value: 'synthetic only',
  }))));
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), limitedBytes);
  for (const entry of evidence.evidence) entry.data_reference.extract_sha256 = crypto.createHash('sha256').update(limitedBytes).digest('hex');
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /EXTRACT_ROW_LIMIT/);
  // Nor may they let an ambiguous record reach G1.
  const ambiguousBytes = Buffer.from('[{"id":"fixture-only","value":"synthetic"},{"id":"fixture-only","value":"contradiction"}]\n');
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), ambiguousBytes);
  for (const entry of evidence.evidence) entry.data_reference.extract_sha256 = crypto.createHash('sha256').update(ambiguousBytes).digest('hex');
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /EXTRACT_KEY_AMBIGUOUS/);
  const roundedBytes = Buffer.from('[{"id":9007199254740992}]');
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), roundedBytes);
  for (const entry of evidence.evidence) {
    entry.data_reference.key = JSON.parse('{"id":9007199254740993}');
    entry.data_reference.extract_sha256 = crypto.createHash('sha256').update(roundedBytes).digest('hex');
  }
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /EXTRACT_KEY_UNSAFE_NUMBER/);
  for (const entry of evidence.evidence) entry.data_reference.key = { id: 'fixture-only' };
  fs.writeFileSync(path.join(temp, 'extracts/test.json'), bytes);
  for (const entry of evidence.evidence) entry.data_reference.extract_sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  const originalRefs = evidence.evidence[0].claim_refs;
  evidence.evidence[0].claim_refs = ['claim-1'];
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /EVIDENCE_CLAIM_MISMATCH/);
  evidence.evidence[0].claim_refs = originalRefs;
  evidence.evidence[0].data_reference.key.id = 'absent';
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.throws(() => evaluateDossier(temp), /EXTRACT_KEY_MISSING/);
});

test('render approval requires the exact render hash, independently of the three flags', () => {
  const validateApproval = ajv.compile(read(path.join(workspace, 'governance/approval-record.schema.json')));
  const doc = read(path.join(pilot, 'approval.json'));
  doc.approval.render_approved = true;
  doc.approval.render_approved_by = 'test-only';
  doc.approval.render_approved_at = '2026-01-01T00:00:00Z';
  assert.equal(validateApproval(doc), false);
  doc.approval.render_sha256 = 'a'.repeat(64);
  assert.equal(validateApproval(doc), true);
});

for (const [name, refs, error] of [
  ['missing reciprocal claim', ['claim-3'], /EVIDENCE_CLAIM_MISMATCH/],
  ['unknown reverse claim', ['claim-1', 'claim-2', 'claim-3', 'claim-999'], /UNKNOWN_CLAIM_REFERENCE/],
  ['reverse claim points to different evidence', ['claim-1', 'claim-2', 'claim-3', 'claim-4'], /EVIDENCE_CLAIM_MISMATCH/],
]) {
  test(`dossier rejects ${name}`, (t) => {
    const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-claim-binding-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    fs.cpSync(pilot, temp, { recursive: true });
    const evidence = read(path.join(temp, 'evidence.json'));
    evidence.historical_traces.find((e) => e.doc_id === 'catalogue-plaquette-pg402-compat').claim_refs = refs;
    fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
    assert.throws(() => evaluateDossier(temp), error);
  });
}

test('claim_refs remains optional and does not turn a historical trace into support', (t) => {
  const { evaluateDossier } = require('./fafa-pilot-governance.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-optional-refs-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(pilot, temp, { recursive: true });
  const evidence = read(path.join(temp, 'evidence.json'));
  evidence.historical_traces.forEach((e) => { delete e.claim_refs; });
  fs.writeFileSync(path.join(temp, 'evidence.json'), JSON.stringify(evidence));
  assert.equal(evaluateDossier(temp).claimGates[0].measured, 4);
});

for (const briefId of ['another-pilot', undefined]) {
  test(`correction rejects ${briefId ?? 'missing'} manifest dossier identity despite matching render bytes`, (t) => {
    const { prepareCorrection } = require('./fafa-pilot-governance.cjs');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-review-binding-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const file = path.join(temp, 'synthetic.bin');
    const bytes = Buffer.from('Synthetic shared render bytes, not a video.');
    fs.writeFileSync(file, bytes);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const record = read(path.join(pilot, 'approval.json'));
    const original = JSON.stringify(record);
    const manifest = { briefId, artifact: { sha256: hash, bytes: bytes.length }, composition: { durationSecs: 38 } };
    const review = { render_sha256: hash, start_ms: 0, end_ms: 1000, comment: 'Fixture only', requested_revision: 1 };
    assert.throws(() => prepareCorrection(record, review, `reviews/${hash}/1.json`, file, manifest), /DOSSIER_ID_MISMATCH/);
    assert.equal(JSON.stringify(record), original);
  });
}

// Process-boundary fixtures only. The native Python integration runs separately.
function connectedWikiFixture(t, mode = 'ok') {
  const fixture = wikiAdmissionFixture(t);
  const processes=require('node:child_process');
  const nativeSpawn=processes.spawnSync;
  t.mock.method(processes,'spawnSync',(exe,args,options)=>nativeSpawn(exe,exe===process.execPath ? args.slice(1) : args,options));
  const authority = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fafa-authority-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(authority)), fs.realpathSync(os.tmpdir())); fs.rmSync(authority, {recursive:true}); });
  fs.mkdirSync(path.join(authority, '_scripts'));
  fs.mkdirSync(path.join(authority, '_meta/schema'), {recursive:true});
  const responseSchema = { type:'object', additionalProperties:false,
    required:['schema_version','request_id','consumer','authority_revision','results'],
    properties:{schema_version:{const:'1.0.0'},request_id:{type:'string'},consumer:{const:'fafa'},authority_revision:{type:['string','null']},results:{type:'array'}} };
  fs.writeFileSync(path.join(authority, '_meta/schema/exports-content.schema.json'), JSON.stringify({$defs:{AdmissionResponse:responseSchema}}));
  // Node executes this test double, never claims native WIKI proof.
  fs.writeFileSync(path.join(authority, '_scripts/build_exports_content.py'), `
const fs=require('node:fs');
const request=JSON.parse(fs.readFileSync(0,'utf8'));
const mode=${JSON.stringify(mode)};
const response={schema_version:'1.0.0',request_id:request.request_id,consumer:'fafa',authority_revision:'a'.repeat(40),results:request.references.map(reference=>({reference,status:'ADMITTED',code:'ADMITTED'}))};
if(mode==='request') response.request_id='other';
if(mode==='version') response.schema_version='9';
if(mode==='audience') response.consumer='seo';
if(mode==='extra') response.results.push(response.results[0]);
if(mode==='missing') response.results=[];
if(mode==='binding') response.results[0].reference.excerpt+='forged';
if(mode==='code') response.results[0].code='AUTHORITY_UNAVAILABLE';
if(mode==='denied') {response.results[0].status='DENIED';response.results[0].code='AUDIENCE_NOT_ALLOWED';process.exitCode=2;}
if(mode==='unavailable') {response.results[0].status='UNAVAILABLE';response.results[0].code='AUTHORITY_UNAVAILABLE';process.exitCode=2;}
if(mode==='exit') process.exitCode=2;
process.stdout.write(mode==='truncated' ? '{' : mode==='duplicate-key' ? JSON.stringify(response).replace('"consumer":"fafa"','"consumer":"seo","consumer":"fafa"') : JSON.stringify(response));
`);
  Object.assign(fixture.evidence.evidence[0].wiki_reference, {path:'wiki/gamme/fixture-content.md', section:'function',export_path:'exports/content/gamme/fixture-content.json',export_sha256:'b'.repeat(64),section_sha256:'c'.repeat(64)});
  fixture.save();
  return {...fixture, config:{wikiRoot:authority,rawRoot:path.join(authority,'unused-raw'),pythonExecutable:process.execPath}};
}

test('connected exact WIKI admission supports claims without approving publication', (t) => {
  const fixture=connectedWikiFixture(t);
  const result=require('./fafa-pilot-governance.cjs').evaluateDossier(fixture.dir,fixture.config);
  assert.equal(result.claimsReady,true);
  assert.equal(result.wikiAdmission.status,'ADMITTED');
  assert.deepEqual(result.acceptedEvidenceIds,['synthetic-wiki']);
  assert.equal(result.canPublishEligible,null);
  assert.equal(result.actorAuthenticated,false);
});
for(const mode of ['request','version','audience','extra','missing','binding','code','exit','truncated','duplicate-key','denied','unavailable']) {
  test(`authority protocol fails closed: ${mode}`, (t) => {
    const fixture=connectedWikiFixture(t,mode);
    const result=require('./fafa-pilot-governance.cjs').evaluateDossier(fixture.dir,fixture.config);
    assert.equal(result.claimsReady,false);
    assert.equal(result.wikiAdmission.reason,mode==='denied'?'WIKI_ADMISSION_DENIED':'WIKI_AUTHORITY_UNAVAILABLE');
    assert.deepEqual(result.acceptedEvidenceIds,[]);
  });
}
test('admitted WIKI does not bypass human procedure gate', (t) => {
  const fixture=connectedWikiFixture(t);fixture.claims.claims[0].kind='procedure';fixture.save();
  assert.throws(()=>require('./fafa-pilot-governance.cjs').evaluateDossier(fixture.dir,fixture.config),/INVALID_claim-table/);
});
test('authority cannot execute from submitted dossier', (t) => {
  const fixture=connectedWikiFixture(t);fixture.config.wikiRoot=fixture.dir;
  const result=require('./fafa-pilot-governance.cjs').evaluateDossier(fixture.dir,fixture.config);
  assert.equal(result.wikiAdmission.reason,'WIKI_AUTHORITY_UNAVAILABLE');assert.equal(result.claimsReady,false);
});
test('authority timeout is observable and bounded', (t) => {
  const fixture=connectedWikiFixture(t);
  t.mock.method(require('node:child_process'),'spawnSync',(_exe,_args,options)=>{
    assert.equal(options.shell,false);assert.equal(options.timeout,60000);assert.equal(options.maxBuffer,4*1024*1024);
    return {error:Object.assign(new Error('timeout'),{code:'ETIMEDOUT'}),status:null};
  });
  const result=require('./fafa-pilot-governance.cjs').evaluateDossier(fixture.dir,fixture.config);
  assert.equal(result.wikiAdmission.reason,'WIKI_AUTHORITY_UNAVAILABLE');
  assert.equal(result.claimsReady,false);
});


// Real temporary files: a changed source must not inherit the old render binding.
function renderSourceFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fafa-review-sources-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const artifact = path.join(dir, 'synthetic.bin');
  const payload = path.join(dir, 'payload.json');
  const props = path.join(dir, 'props.json');
  const bytes = Buffer.from('Synthetic source-binding fixture, not a video.');
  fs.writeFileSync(artifact, bytes);
  fs.writeFileSync(payload, '{"compositionProps":{"hook":"before"}}\n');
  fs.writeFileSync(props, '{"hook":"before"}\n');
  const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const hash = digest(artifact);
  const manifest = { briefId: 'fafa-plaquettes-frein-001',
    artifact: { sha256: hash, bytes: bytes.length }, composition: { durationSecs: 38 },
    source: { renderPayloadSha256: digest(payload), propsUsedSha256: digest(props) } };
  const review = { render_sha256: hash, start_ms: 0, end_ms: 1000, comment: 'Fixture only', requested_revision: 2 };
  return { artifact, payload, props, manifest, review, relativePath: `reviews/${hash}/2.json`,
    sourceFiles: { renderPayloadPath: payload, propsUsedPath: props } };
}

test('D18 source bytes match without authenticating a reviewer or assessing human quality', (t) => {
  const f = renderSourceFixture(t);
  const { validateRenderReview } = require('./fafa-pilot-governance.cjs');
  const result = validateRenderReview(f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles);
  assert.deepEqual(result.sourceBinding, { status: 'MATCH',
    renderPayloadSha256: f.manifest.source.renderPayloadSha256,
    propsUsedSha256: f.manifest.source.propsUsedSha256 });
  assert.equal(result.actorAuthenticated, false);
  assert.equal(result.humanReview, 'NOT_ASSESSED');
});

test('D18 historical artifact-only review leaves sources explicitly unassessed', (t) => {
  const f = renderSourceFixture(t);
  const result = require('./fafa-pilot-governance.cjs').validateRenderReview(f.review, f.relativePath, f.artifact, f.manifest);
  assert.deepEqual(result.sourceBinding, { status: 'NOT_ASSESSED' });
  assert.equal(result.actorAuthenticated, false);
});

for (const file of ['payload', 'props']) {
  test(`D18 changed ${file} is rejected despite unchanged render bytes`, (t) => {
    const f = renderSourceFixture(t);
    fs.writeFileSync(f[file], '{"hook":"changed"}\n');
    assert.throws(() => require('./fafa-pilot-governance.cjs').validateRenderReview(
      f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles), /RENDER_SOURCE_HASH_MISMATCH/);
  });
}

for (const sourceFiles of [null, {}, { renderPayloadPath: 'relative.json', propsUsedPath: 'relative.json' }]) {
  test(`D18 malformed explicit source context is rejected: ${JSON.stringify(sourceFiles)}`, (t) => {
    const f = renderSourceFixture(t);
    assert.throws(() => require('./fafa-pilot-governance.cjs').validateRenderReview(
      f.review, f.relativePath, f.artifact, f.manifest, sourceFiles), /RENDER_SOURCE_FILES_REQUIRED/);
  });
}

for (const source of [undefined, { renderPayloadSha256: 'a'.repeat(64) }, { renderPayloadSha256: 'bad', propsUsedSha256: 'b'.repeat(64) }]) {
  test(`D18 explicit source check refuses absent or malformed manifest hashes: ${JSON.stringify(source)}`, (t) => {
    const f = renderSourceFixture(t);
    assert.throws(() => require('./fafa-pilot-governance.cjs').validateRenderReview(
      f.review, f.relativePath, f.artifact, { ...f.manifest, source }, f.sourceFiles), /RENDER_SOURCE_BINDING_REQUIRED/);
  });
}

test('D18 correction does not reset an approval when source binding is stale', (t) => {
  const f = renderSourceFixture(t);
  const record = read(path.join(pilot, 'approval.json'));
  record.revision = 1;
  const before = JSON.stringify(record);
  fs.writeFileSync(f.props, '{"hook":"changed"}');
  assert.throws(() => require('./fafa-pilot-governance.cjs').prepareCorrection(
    record, f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles), /RENDER_SOURCE_HASH_MISMATCH/);
  assert.equal(JSON.stringify(record), before);
});

for (const name of ['renderPayloadPath', 'propsUsedPath']) {
  test(`D18 unreadable source ${name} fails without an artifact-only fallback`, (t) => {
    const f = renderSourceFixture(t);
    const sourceFiles = { ...f.sourceFiles, [name]: path.join(path.dirname(f.artifact), 'missing.json') };
    assert.throws(() => require('./fafa-pilot-governance.cjs').validateRenderReview(
      f.review, f.relativePath, f.artifact, f.manifest, sourceFiles), { code: 'ENOENT' });
  });
}

test('D18 bound correction produces a reset copy and preserves the original record', (t) => {
  const f = renderSourceFixture(t);
  const record = read(path.join(pilot, 'approval.json'));
  record.revision = 1;
  const before = JSON.stringify(record);
  const next = require('./fafa-pilot-governance.cjs').prepareCorrection(
    record, f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles);
  assert.equal(next.revision, 2);
  assert.notEqual(next, record);
  for (const stage of ['content', 'render', 'publish']) {
    assert.equal(next.approval[`${stage}_approved`], false);
    assert.equal(next.approval[`${stage}_approved_by`], null);
    assert.equal(next.approval[`${stage}_approved_at`], null);
  }
  assert.equal(next.approval.render_sha256, null);
  assert.equal(JSON.stringify(record), before);
});

// The review reader must not accept a manifest that L10 would reject for binding or duration.
for (const approvalBinding of [null, {}, { boundSha256: 'invalid' }, { boundSha256: 'b'.repeat(64) }]) {
  test(`D18 rejects an explicit invalid approval binding: ${JSON.stringify(approvalBinding)}`, (t) => {
    const f = renderSourceFixture(t);
    f.manifest.approvalBinding = approvalBinding;
    assert.throws(() => require('./fafa-pilot-governance.cjs').validateRenderReview(
      f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles), /RENDER_HASH_MISMATCH/);
  });
}

for (const durationSecs of ['38', [38], true]) {
  test(`D18 refuses coercion of declared duration: ${JSON.stringify(durationSecs)}`, (t) => {
    const f = renderSourceFixture(t);
    f.manifest.composition.durationSecs = durationSecs;
    assert.throws(() => require('./fafa-pilot-governance.cjs').validateRenderReview(
      f.review, f.relativePath, f.artifact, f.manifest), /REVIEW_INTERVAL/);
  });
}

test('D18 matching optional approval binding remains a technical check only', (t) => {
  const f = renderSourceFixture(t);
  f.manifest.approvalBinding = { boundSha256: f.manifest.artifact.sha256 };
  // Decimal seconds are valid; review end exactly at the declared boundary is accepted.
  f.manifest.composition.durationSecs = 1.25;
  f.review.end_ms = 1250;
  const result = require('./fafa-pilot-governance.cjs').validateRenderReview(
    f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles);
  assert.equal(result.sha256, f.manifest.approvalBinding.boundSha256);
  assert.equal(result.sourceBinding.status, 'MATCH');
  assert.equal(result.actorAuthenticated, false);
  assert.equal(result.humanReview, 'NOT_ASSESSED');
});

test('D18 inconsistent manifest binding cannot prepare a correction or mutate prior approvals', (t) => {
  const f = renderSourceFixture(t);
  const record = read(path.join(pilot, 'approval.json'));
  record.revision = 1;
  record.approval.render_sha256 = f.manifest.artifact.sha256;
  f.manifest.approvalBinding = { boundSha256: 'b'.repeat(64) };
  const before = JSON.stringify(record);
  assert.throws(() => require('./fafa-pilot-governance.cjs').prepareCorrection(
    record, f.review, f.relativePath, f.artifact, f.manifest, f.sourceFiles), /RENDER_HASH_MISMATCH/);
  assert.equal(JSON.stringify(record), before);
});

test('D18 accepts the exact decimal millisecond boundary without extending it', (t) => {
  const f = renderSourceFixture(t);
  f.manifest.composition.durationSecs = 1.001;
  f.review.end_ms = 1001;
  const { validateRenderReview } = require('./fafa-pilot-governance.cjs');
  assert.doesNotThrow(() => validateRenderReview(f.review, f.relativePath, f.artifact, f.manifest));
  f.review.end_ms = 1002;
  assert.throws(() => validateRenderReview(f.review, f.relativePath, f.artifact, f.manifest), /REVIEW_INTERVAL/);
});

test('approval record preserves null measurements for unevaluated failing gates', () => {
  const schema = read(path.join(workspace, 'governance/approval-record.schema.json'));
  const validateApproval = new Ajv({ strict: false });
  addFormats(validateApproval);
  const validate = validateApproval.compile(schema);
  const record = read(path.join(pilot, 'approval.json'));
  for (const gate of ['G3', 'G4', 'G5', 'G6']) {
    const candidate = structuredClone(record);
    Object.assign(candidate.gate_results.find((g) => g.gate === gate), {
      verdict: 'FAIL', measured: null, details: 'Observation is unavailable; no value inferred.',
    });
    assert.equal(validate(candidate), true, `${gate}: ${JSON.stringify(validate.errors)}`);
    assert.equal(candidate.gate_results.find((g) => g.gate === gate).measured, null);
  }
  assert.equal(validate(record), true, 'Existing numeric records remain valid');
});

test('approval record rejects null measurements for passing or counted gates', () => {
  const schema = read(path.join(workspace, 'governance/approval-record.schema.json'));
  const validateApproval = new Ajv({ strict: false });
  addFormats(validateApproval);
  const validate = validateApproval.compile(schema);
  const record = read(path.join(pilot, 'approval.json'));
  for (const gate of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']) {
    for (const verdict of ['PASS', 'WARN', 'FAIL']) {
      if (verdict === 'FAIL' && ['G3', 'G4', 'G5', 'G6'].includes(gate)) continue;
      const candidate = structuredClone(record);
      Object.assign(candidate.gate_results.find((g) => g.gate === gate), { verdict, measured: null });
      assert.equal(validate(candidate), false, `${gate}/${verdict} must not accept an absent measurement`);
    }
  }
});
