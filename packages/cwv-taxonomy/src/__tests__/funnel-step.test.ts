/**
 * Tests FunnelStep ordering + transition validation.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  FUNNEL_STEP_ORDER,
  FUNNEL_STEP_VALUES,
  isValidFunnelTransition,
  SURFACE_TO_FUNNEL_STEP,
} from '../funnel-step';

test('FUNNEL_STEP_ORDER: monotonic ascending', () => {
  let prev = -1;
  for (const step of FUNNEL_STEP_VALUES) {
    const idx = FUNNEL_STEP_ORDER[step];
    assert.ok(idx > prev, `expected order monotonic ascending, got ${idx} after ${prev}`);
    prev = idx;
  }
});

test('FUNNEL_STEP_ORDER: completed is terminal (highest index)', () => {
  const completed = FUNNEL_STEP_ORDER.completed;
  for (const step of FUNNEL_STEP_VALUES) {
    assert.ok(
      FUNNEL_STEP_ORDER[step] <= completed,
      `${step} (${FUNNEL_STEP_ORDER[step]}) should be <= completed (${completed})`,
    );
  }
});

test('isValidFunnelTransition: null previous always valid', () => {
  assert.equal(isValidFunnelTransition(null, 'landing'), true);
  assert.equal(isValidFunnelTransition(null, 'completed'), true);
  assert.equal(isValidFunnelTransition(undefined, 'view_product'), true);
});

test('isValidFunnelTransition: same step is valid (idempotent)', () => {
  assert.equal(isValidFunnelTransition('view_product', 'view_product'), true);
});

test('isValidFunnelTransition: forward valid, backward invalid', () => {
  assert.equal(isValidFunnelTransition('view_product', 'add_cart'), true);
  assert.equal(isValidFunnelTransition('add_cart', 'view_product'), false);
  assert.equal(isValidFunnelTransition('payment', 'landing'), false);
  assert.equal(isValidFunnelTransition('landing', 'completed'), true);
});

test('SURFACE_TO_FUNNEL_STEP: every Surface mapped', () => {
  // Si une nouvelle Surface est ajoutée sans mise à jour du mapping, TS broker
  // déjà. Ce test catch sémantique : pas de step "invalide" mappé.
  for (const step of Object.values(SURFACE_TO_FUNNEL_STEP)) {
    assert.ok(
      (FUNNEL_STEP_VALUES as readonly string[]).includes(step),
      `mapped step ${step} not in canonical FUNNEL_STEP_VALUES`,
    );
  }
});
