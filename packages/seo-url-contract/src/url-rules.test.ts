import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAlias,
  normalizeTypeAlias,
  detectMalformedSegment,
  isMalformedSeoUrl,
} from './index';

test('detectMalformedSegment flags real malformed forms', () => {
  const cases: Array<[string, string]> = [
    ['null-55453', 'null_in_url'],
    ['null-55453-55453', 'null_in_url'], // multi-id form seen in the GSC report
    ['-30389', 'missing_alias'],
    ['type-7379', 'type_prefix_fallback'],
    ['122813-122813', 'repeated_id'],
    ['11410-11410-11410', 'repeated_id_multi'],
    ['1.6 t4f-12693', 'spaces_in_url'],
  ];
  for (const [seg, reason] of cases) {
    assert.equal(detectMalformedSegment(seg), reason, seg);
  }
});

test('detectMalformedSegment passes valid segments (no faux-positives)', () => {
  for (const seg of [
    '100060-200199',
    'a6-iv-22057',
    'ds3-decapotable-46050',
    'nullpunkt-123',
    'x-type-99',
    'type-c-50',
  ]) {
    assert.equal(detectMalformedSegment(seg), null, seg);
  }
});

test('isMalformedSeoUrl checks the whole URL', () => {
  assert.ok(
    isMalformedSeoUrl('/pieces/filtre-a-air-8/audi-22/a6-iv-22057/null-100060.html'),
  );
  assert.equal(
    isMalformedSeoUrl('/pieces/filtre-a-air-8/audi-22/a6-iv-22057/100060-200199.html'),
    null,
  );
});

test('normalizeTypeAlias fallback + id-equality', () => {
  // normalizeAlias strips the dot (not in [a-z0-9\s-]) → "2.0 16V" becomes "20-16v"
  assert.equal(normalizeTypeAlias('28495', '2.0 16V', 28495), '20-16v');
  assert.equal(normalizeTypeAlias('28495', null, 28495), 'type');
  assert.equal(normalizeTypeAlias('gti', '2.0 GTI', 28495), 'gti');
  assert.equal(normalizeTypeAlias('null', '2.0 16V'), '20-16v');
  assert.equal(normalizeTypeAlias('', '2.0 16V'), '20-16v');
});

test('normalizeAlias slugifies accents and spaces', () => {
  assert.equal(normalizeAlias('Côté Décapotable'), 'cote-decapotable');
  assert.equal(normalizeAlias('1.6 TDI'), '16-tdi');
});
