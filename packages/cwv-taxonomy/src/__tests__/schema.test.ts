/**
 * Tests Zod schemas — boundary enforcement, strict mode.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { METRIC_BOUNDS } from '../metric';
import {
  CwvAttributionSchema,
  CwvBeaconClientPayloadSchema,
  CwvBeaconServerInsertSchema,
} from '../schema';

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

// ---------------------------------------------------------------------------
// Enrichissement de l'attribution (INP LoAF, hydratation, contexte du report)
// ---------------------------------------------------------------------------

const enrichedInpAttribution = {
  ...validClientPayload.attribution,
  attr_total_script_duration: 42,
  attr_total_style_layout_duration: 96,
  attr_total_paint_duration: 18,
  attr_total_unattributed_duration: 0,
  attr_longest_script_src: 'https://www.automecanik.com/assets/app-core.js',
  attr_longest_script_invoker_type: 'event-listener',
  attr_longest_script_subpart: 'processing-duration',
  attr_longest_script_intersecting_duration: 38,
  // Une interaction peut survenir bien après 60 s de vie de la page.
  attr_interaction_time: 184_250,
  attr_hydrated_at: 2_310,
  attr_metric_id: 'v5-1757590000000-1234567890123',
  attr_visibility_state: 'hidden',
  attr_navigation_type: 'back-forward-cache',
  attr_start_url: 'https://www.automecanik.com/pieces/x/y/z.html',
};

function withAttribution(attribution: Record<string, unknown>) {
  return { ...validClientPayload, attribution };
}

test('CwvAttributionSchema: accepts the INP enrichment keys within bounds', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse(withAttribution(enrichedInpAttribution));
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test('CwvAttributionSchema: interaction time is a timestamp, not a phase — no 60 s cap', () => {
  const r = CwvAttributionSchema.safeParse({
    attr_interaction_time: METRIC_BOUNDS.INP.max + 1,
    attr_hydrated_at: METRIC_BOUNDS.INP.max + 1,
  });
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test('CwvAttributionSchema: timestamps stay exactly representable (safe integers only)', () => {
  const r = CwvAttributionSchema.safeParse({ attr_interaction_time: Number.MAX_SAFE_INTEGER + 1 });
  assert.equal(r.success, false);
});

test('CwvAttributionSchema: LoAF totals are bounded by the INP metric bounds', () => {
  for (const key of [
    'attr_total_script_duration',
    'attr_total_style_layout_duration',
    'attr_total_paint_duration',
    'attr_total_unattributed_duration',
    'attr_longest_script_intersecting_duration',
  ]) {
    assert.equal(CwvAttributionSchema.safeParse({ [key]: -1 }).success, false, `${key} < min`);
    assert.equal(
      CwvAttributionSchema.safeParse({ [key]: METRIC_BOUNDS.INP.max + 1 }).success,
      false,
      `${key} > max`,
    );
    assert.equal(
      CwvAttributionSchema.safeParse({ [key]: METRIC_BOUNDS.INP.max }).success,
      true,
      `${key} = max`,
    );
  }
});

test('CwvAttributionSchema: URL-like keys never carry a query string or a fragment', () => {
  for (const key of ['attr_longest_script_src', 'attr_start_url']) {
    assert.equal(
      CwvAttributionSchema.safeParse({ [key]: 'https://www.automecanik.com/x.js?token=abc' }).success,
      false,
      `${key} with query`,
    );
    assert.equal(
      CwvAttributionSchema.safeParse({ [key]: 'https://www.automecanik.com/x#frag' }).success,
      false,
      `${key} with fragment`,
    );
  }
});

test('CwvAttributionSchema: a non-web script source may be reduced to its scheme', () => {
  const r = CwvAttributionSchema.safeParse({ attr_longest_script_src: 'chrome-extension:' });
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test('CwvAttributionSchema: start URL must be an absolute URL', () => {
  const r = CwvAttributionSchema.safeParse({ attr_start_url: '/pieces/x.html' });
  assert.equal(r.success, false);
});

test('CwvAttributionSchema: URL-like keys carry only an http(s) URL without credentials', () => {
  for (const key of ['attr_longest_script_src', 'attr_start_url']) {
    for (const value of [
      'javascript:void(0)',
      'data:text/plain,x',
      'ftp://www.automecanik.com/x.js',
      'https://user:pass@www.automecanik.com/x.js',
      'https://user@www.automecanik.com/x.js',
    ]) {
      assert.equal(CwvAttributionSchema.safeParse({ [key]: value }).success, false, `${key}: ${value}`);
    }
  }
});

test('CwvAttributionSchema: a non-canonical http page passes the schema — its host is counted by the controller', () => {
  const r = CwvAttributionSchema.safeParse({ attr_start_url: 'http://localhost:3000/pieces/x.html' });
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test('CwvAttributionSchema: a script source is a bare URL scheme or an http(s) URL', () => {
  for (const value of ['chrome-extension:', 'blob:', 'https://cdn.example.net/lib/a.js']) {
    const r = CwvAttributionSchema.safeParse({ attr_longest_script_src: value });
    assert.equal(r.success, true, `${value}: ${JSON.stringify(r.error?.issues)}`);
  }
  for (const value of [
    'free text',
    'chrome-extension://abcdefghijklmnop/content.js',
    '/assets/app.js',
    'Chrome-Extension:',
  ]) {
    assert.equal(CwvAttributionSchema.safeParse({ attr_longest_script_src: value }).success, false, value);
  }
});

test('CwvAttributionSchema: browser-enumerated keys carry only lowercase hyphenated tokens', () => {
  for (const key of [
    'attr_longest_script_invoker_type',
    'attr_longest_script_subpart',
    'attr_visibility_state',
    'attr_navigation_type',
  ]) {
    for (const value of ['hidden', 'event-listener', 'back-forward-cache']) {
      const r = CwvAttributionSchema.safeParse({ [key]: value });
      assert.equal(r.success, true, `${key}: ${value}: ${JSON.stringify(r.error?.issues)}`);
    }
    for (const value of ['', 'Hidden', 'event listener', 'event_listener', '-hidden', 'hidden-']) {
      assert.equal(
        CwvAttributionSchema.safeParse({ [key]: value }).success,
        false,
        `${key}: ${JSON.stringify(value)}`,
      );
    }
  }
});

test('CwvAttributionSchema: string enrichment keys are length-bounded', () => {
  const tooLong = 'x'.repeat(200);
  for (const key of [
    'attr_longest_script_invoker_type',
    'attr_longest_script_subpart',
    'attr_metric_id',
    'attr_visibility_state',
    'attr_navigation_type',
  ]) {
    assert.equal(CwvAttributionSchema.safeParse({ [key]: tooLong }).success, false, key);
  }
});

test('CwvAttributionSchema: strict mode still rejects unknown attribution keys', () => {
  const r = CwvBeaconClientPayloadSchema.safeParse(
    withAttribution({ ...enrichedInpAttribution, attr_not_declared: 1 }),
  );
  assert.equal(r.success, false);
  assert.deepEqual(
    r.error?.issues.map((i) => [i.code, i.path.join('.')]),
    [['unrecognized_keys', 'attribution']],
  );
});
