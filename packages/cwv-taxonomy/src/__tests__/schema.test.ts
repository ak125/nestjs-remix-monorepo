/**
 * Tests Zod schemas — boundary enforcement, strict mode.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CwvBeaconClientPayloadSchema, CwvBeaconServerInsertSchema } from '../schema';

const validClientPayload = {
  session_id: 'abc12345',
  surface: 'R2_PRODUCT',
  route_group: 'pieces_product',
  funnel_step: 'view_product',
  previous_funnel_step: 'view_listing',
  url: 'https://www.automecanik.com/pieces/x/y/z.html',
  metric: 'INP',
  value: 250,
  device: 'mobile',
  attribution: {
    attr_target: '.btn-add-cart',
    attr_input_delay: 50,
    attr_processing_duration: 100,
    attr_presentation_delay: 100,
  },
  nav_type: 'navigate',
} as const;

test('CwvBeaconClientPayloadSchema: valid payload passes', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse(validClientPayload);
  assert.equal(r.success, true);
});

test('CwvBeaconClientPayloadSchema: rejects unknown surface (CHECK IN strict)', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({
    ...validClientPayload,
    surface: 'NOT_A_SURFACE',
  });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: rejects negative metric value', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({ ...validClientPayload, value: -1 });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: rejects value > 60000', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({ ...validClientPayload, value: 60001 });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: rejects short session_id (<8)', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({ ...validClientPayload, session_id: 'abc' });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: rejects long session_id (>64)', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({
    ...validClientPayload,
    session_id: 'a'.repeat(65),
  });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: rejects non-URL url', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({ ...validClientPayload, url: 'not-a-url' });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: strict mode rejects extra keys', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({ ...validClientPayload, extra_field: 'x' });
  assert.equal(r.success, false);
});

test('CwvBeaconClientPayloadSchema: previous_funnel_step nullable', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse({
    ...validClientPayload,
    previous_funnel_step: null,
  });
  assert.equal(r.success, true);
});

test('CwvBeaconClientPayloadSchema: attribution optional', () => {
  const { attribution, ...rest } = validClientPayload;
  void attribution;
  const r = CwvBeaconClientPayloadSchema.safeParse(rest);
  assert.equal(r.success, true);
});

test('CwvBeaconServerInsertSchema: extends client + adds priority_tier + ua_class', () => {
  const r = CwvBeaconServerInsertSchema.safeParse({
    ...validClientPayload,
    priority_tier: 'CWV_P0',
    ua_class: 'human',
  });
  assert.equal(r.success, true);
});

test('CwvBeaconServerInsertSchema: rejects without priority_tier', () => {
  const r = CwvBeaconServerInsertSchema.safeParse({
    ...validClientPayload,
    ua_class: 'human',
  });
  assert.equal(r.success, false);
});

test('CwvBeaconServerInsertSchema: rejects unknown ua_class', () => {
  const r = CwvBeaconServerInsertSchema.safeParse({
    ...validClientPayload,
    priority_tier: 'CWV_P0',
    ua_class: 'martian',
  });
  assert.equal(r.success, false);
});
