/**
 * Test conformance — chaque contract dans CONTRACTS doit valider RoleContract Zod schema.
 *
 * Ce test est l'ancrage qui garantit que toute modification d'un contract
 * (ex: bump min_chars en Phase 4 PR-S) reste valide vis-à-vis du schema canon.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { RoleId } from '@repo/seo-roles';
import { CONTRACTS, RoleContract, getRoleContract, getSupportedRoles } from '..';

test('CONTRACTS map contient R1_ROUTER + R3_CONSEILS (MVP-0)', () => {
  const supported = getSupportedRoles();
  assert.ok(supported.includes(RoleId.R1_ROUTER), 'R1_ROUTER manquant');
  assert.ok(supported.includes(RoleId.R3_CONSEILS), 'R3_CONSEILS manquant');
});

test('Chaque contract validate RoleContract Zod', () => {
  for (const [roleId, contract] of Object.entries(CONTRACTS)) {
    if (!contract) continue;
    const result = RoleContract.safeParse(contract);
    assert.ok(
      result.success,
      `Contract ${roleId} ne validate pas RoleContract :\n${JSON.stringify((result as any).error?.issues, null, 2)}`,
    );
  }
});

test('R1 contract — bornes R1_S4_MICRO_SEO conformes', () => {
  const r1 = getRoleContract(RoleId.R1_ROUTER);
  const microSeo = r1.allowed_sections.find((s) => s.id === 'R1_S4_MICRO_SEO');
  assert.ok(microSeo, 'R1_S4_MICRO_SEO absent');
  assert.equal(microSeo!.min_chars, 700, 'R1_S4_MICRO_SEO min_chars = 700 (Phase 4 PR-S bumpera à 1500)');
  assert.equal(microSeo!.max_chars, 3000, 'R1_S4_MICRO_SEO max_chars = 3000 (Option B sweet-spot)');
  assert.equal(microSeo!.required, true);
});

test('R1 contract — forbidden_overlap contient termes diagnostic + comparatif', () => {
  const r1 = getRoleContract(RoleId.R1_ROUTER);
  assert.ok(r1.forbidden_overlap.includes('symptôme'), 'symptôme manquant');
  assert.ok(r1.forbidden_overlap.includes('comparatif'), 'comparatif manquant');
  assert.ok(r1.forbidden_overlap.includes('couple de serrage'), 'couple de serrage manquant');
});

test('R3 contract — promotion_gate inclut diagnostic (ADR-033)', () => {
  const r3 = getRoleContract(RoleId.R3_CONSEILS);
  assert.ok(
    r3.promotion_gate.requires_validations.includes('diagnostic'),
    'R3 promotion gate doit inclure diagnostic (ADR-033)',
  );
});

test('R3 contract — section IDs alignés canon SECTION_TYPES backend', () => {
  const r3 = getRoleContract(RoleId.R3_CONSEILS);
  const ids = r3.allowed_sections.map((s) => s.id);
  // Canon : conseil-enricher.service.ts:36-48 SECTION_TYPES
  for (const canonId of ['S1', 'S2', 'S2_DIAG', 'S3', 'S4_DEPOSE', 'S4_REPOSE', 'S5', 'S6', 'S_GARAGE', 'S7', 'S8']) {
    assert.ok(ids.includes(canonId), `Section ${canonId} (canon backend) absente du contract R3`);
  }
});

test('R1_S9_FAQ — required + min 600c (canon r1-keyword-plan.constants.ts:158-167)', () => {
  const r1 = getRoleContract(RoleId.R1_ROUTER);
  const faq = r1.allowed_sections.find((s) => s.id === 'R1_S9_FAQ');
  assert.ok(faq, 'R1_S9_FAQ absent');
  assert.equal(faq!.min_chars, 600, 'R1_S9_FAQ min_chars=600 (canon backend)');
  assert.equal(faq!.required, true, 'R1_S9_FAQ required=true (canon backend)');
});

test('R3 contract — gate_strictness all fail-closed', () => {
  const r3 = getRoleContract(RoleId.R3_CONSEILS);
  assert.equal(r3.gate_strictness.quality_gate, 'fail-closed');
  assert.equal(r3.gate_strictness.forbidden_overlap, 'fail-closed');
  assert.equal(r3.gate_strictness.min_chars_pre_write, 'fail-closed');
});

test('getRoleContract throws pour rôle non couvert', () => {
  assert.throws(
    () => getRoleContract(RoleId.R0_HOME),
    /Contract absent/,
    'getRoleContract(R0_HOME) doit throw — non couvert MVP-0',
  );
});
