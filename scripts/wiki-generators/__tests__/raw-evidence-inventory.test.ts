/**
 * Tests for scripts/wiki-generators/raw-evidence-inventory.ts
 *
 * Run: npx tsx --test scripts/wiki-generators/__tests__/raw-evidence-inventory.test.ts
 *
 * Covers (TDD):
 *   - pilot output validates against the generated JSON Schema (Ajv)
 *   - golden pilot assertions (READY, A–E PRESENT, fold_readiness, 3 sources)
 *   - 5.0 superset blocks recensés (no silent drop)
 *   - fold_status: R5 LIVE, R4/R6 PENDING_ADR
 *   - determinism (build ×2 deep-equal)
 *   - NO_RAW path validates + SOURCE_FIRST
 *   - the committed pilot artefact validates against the schema
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { buildEvidence } from '../raw-evidence-inventory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'raw-evidence.schema.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

test('pilot filtre-a-air validates against the generated schema', () => {
  const ev = buildEvidence('filtre-a-air');
  assert.ok(validate(ev), JSON.stringify(validate.errors));
});

test('pilot golden: READY, A–E PRESENT, fold_readiness, 3 sources', () => {
  const ev = buildEvidence('filtre-a-air');
  assert.equal(ev.inventory_status, 'DIAGNOSTIC_READY');
  assert.equal(ev.raw_verdict, 'READY');
  assert.equal(ev.next_action, 'PROMOTE_RAW_TO_WIKI');
  const abcde = ev.coverage.filter((c) => /^[A-E]\./.test(c.block));
  assert.equal(abcde.length, 5);
  assert.ok(abcde.every((c) => c.status === 'PRESENT'), 'A–E must all be PRESENT');
  assert.equal(ev.fold_readiness.R5_to_R3, 'READY_ADR_027');
  assert.equal(ev.fold_readiness.R4_to_R3, 'BLOCKED_PENDING_ADR');
  assert.equal(ev.fold_readiness.R6_to_R3, 'BLOCKED_PENDING_ADR');
  assert.equal(ev.provenance.sources.length, 3);
  assert.equal(ev.pg_id, 8);
});

test('5.0 superset blocks are recensés (no silent drop)', () => {
  const ev = buildEvidence('filtre-a-air');
  const sup = ev.coverage.filter((c) => c.block.startsWith('5.0:')).map((c) => c.block);
  for (const b of ['5.0:variants', '5.0:conseil_v5', '5.0:diagnostic.depose_steps']) {
    assert.ok(sup.includes(b), `missing recensé block ${b}`);
  }
  assert.ok(
    ev.coverage.filter((c) => c.block.startsWith('5.0:')).every((c) => c.status === 'NOT_MAPPED'),
    '5.0 blocks must be NOT_MAPPED',
  );
});

test('fold_status per block: R5 LIVE, R4/R6 PENDING_ADR', () => {
  const ev = buildEvidence('filtre-a-air');
  const byBlock = Object.fromEntries(ev.coverage.map((c) => [c.block, c]));
  assert.equal(byBlock['C.diagnostic'].fold_status, 'LIVE');
  assert.equal(byBlock['A.domain'].fold_status, 'PENDING_ADR');
  assert.equal(byBlock['B.selection'].fold_status, 'PENDING_ADR');
  assert.equal(byBlock['compatibility'].status, 'BLOCKED_CATALOG_REQUIRED');
});

test('deterministic: build ×2 deep-equal', () => {
  assert.deepEqual(buildEvidence('filtre-a-air'), buildEvidence('filtre-a-air'));
});

test('NO_RAW path validates and yields SOURCE_FIRST', () => {
  const ev = buildEvidence('__subject_does_not_exist__');
  assert.ok(validate(ev), JSON.stringify(validate.errors));
  assert.equal(ev.inventory_status, 'NO_RAW');
  assert.equal(ev.raw_verdict, 'NO_RAW');
  assert.equal(ev.next_action, 'SOURCE_FIRST');
});

test('committed pilot artefact validates against the schema', () => {
  const p = path.join(ROOT, 'audit', 'content', 'raw-evidence', 'filtre-a-air.raw-evidence.json');
  const committed = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(validate(committed), JSON.stringify(validate.errors));
});
