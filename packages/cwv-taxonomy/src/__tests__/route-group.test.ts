/**
 * Tests classifyRoute() — first-match-wins déterministe.
 *
 * Cible spec : route_group + surface + priority_tier + funnel_step cohérents
 * sur 100% des fixtures, dont sous-ensemble représentatif des 376 URLs
 * /pieces/* du rapport GSC INP 537ms (PR #694).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { classifyRoute } from '../route-group';

test('classifyRoute: pieces_product (.html suffix 5-segments)', () => {
  const r = classifyRoute('/pieces/freinage/peugeot/308/1.6-hdi/68681.html');
  assert.equal(r.route_group, 'pieces_product');
  assert.equal(r.surface, 'R2_PRODUCT');
  assert.equal(r.priority_tier, 'CWV_P0');
  assert.equal(r.funnel_step, 'view_product');
});

test('classifyRoute: pieces_gamme_vehicle (no .html, 4-segments)', () => {
  const r = classifyRoute('/pieces/freinage/peugeot/308/1.6-hdi');
  assert.equal(r.route_group, 'pieces_gamme_vehicle');
  assert.equal(r.surface, 'R2_GAMME_VEHICLE');
  assert.equal(r.priority_tier, 'CWV_P1');
  assert.equal(r.funnel_step, 'view_listing');
});

test('classifyRoute: pieces_gamme_vehicle short (2-segments)', () => {
  const r = classifyRoute('/pieces/freinage');
  assert.equal(r.route_group, 'pieces_gamme_vehicle');
  assert.equal(r.surface, 'R2_GAMME_VEHICLE');
});

test('classifyRoute: r3_guide', () => {
  const r = classifyRoute('/conseils/changer-plaquettes-frein');
  assert.equal(r.route_group, 'r3_guide');
  assert.equal(r.surface, 'R3_GUIDE');
  assert.equal(r.priority_tier, 'CWV_P1');
  assert.equal(r.funnel_step, 'view_guide');
});

test('classifyRoute: r5_diagnostic', () => {
  const r = classifyRoute('/diagnostic/voiture-ne-demarre-pas');
  assert.equal(r.route_group, 'r5_diagnostic');
  assert.equal(r.surface, 'R5_DIAGNOSTIC');
  assert.equal(r.priority_tier, 'CWV_P0');
  assert.equal(r.funnel_step, 'view_diagnostic');
});

test('classifyRoute: r8_vehicle', () => {
  const r = classifyRoute('/constructeurs/peugeot/308/1.6-hdi.html');
  assert.equal(r.route_group, 'r8_vehicle');
  assert.equal(r.surface, 'R8_VEHICLE');
  assert.equal(r.priority_tier, 'CWV_P1');
  assert.equal(r.funnel_step, 'view_vehicle');
});

test('classifyRoute: marques_listing', () => {
  const r = classifyRoute('/marques/valeo');
  assert.equal(r.route_group, 'marques_listing');
  assert.equal(r.surface, 'R2_GAMME_VEHICLE');
});

test('classifyRoute: search', () => {
  assert.equal(classifyRoute('/recherche').route_group, 'search');
  assert.equal(classifyRoute('/recherche?q=plaquette').route_group, 'search');
});

test('classifyRoute: cart', () => {
  const r = classifyRoute('/panier');
  assert.equal(r.route_group, 'cart');
  assert.equal(r.surface, 'CART');
  assert.equal(r.priority_tier, 'CWV_P0');
  assert.equal(r.funnel_step, 'checkout_entry');
});

test('classifyRoute: checkout', () => {
  const r = classifyRoute('/checkout/livraison');
  assert.equal(r.route_group, 'checkout');
  assert.equal(r.surface, 'CHECKOUT');
  assert.equal(r.priority_tier, 'CWV_P0');
  assert.equal(r.funnel_step, 'checkout_step');
});

test('classifyRoute: payment', () => {
  const r = classifyRoute('/paiement');
  assert.equal(r.route_group, 'payment');
  assert.equal(r.surface, 'PAYMENT');
  assert.equal(r.priority_tier, 'CWV_P0');
  assert.equal(r.funnel_step, 'payment');
});

test('classifyRoute: account', () => {
  const r = classifyRoute('/compte/commandes');
  assert.equal(r.route_group, 'account');
  assert.equal(r.surface, 'ACCOUNT');
  assert.equal(r.priority_tier, 'CWV_P2');
});

test('classifyRoute: home exact match', () => {
  const r = classifyRoute('/');
  assert.equal(r.route_group, 'home');
  assert.equal(r.surface, 'HOME');
  assert.equal(r.funnel_step, 'landing');
});

test('classifyRoute: other fallback', () => {
  assert.equal(classifyRoute('/sitemap.xml').route_group, 'other');
  assert.equal(classifyRoute('/robots.txt').route_group, 'other');
  assert.equal(classifyRoute('/api/health').route_group, 'other');
  assert.equal(classifyRoute('/foo/bar/baz').route_group, 'other');
});

test('classifyRoute: null/undefined/empty → other', () => {
  assert.equal(classifyRoute(null).route_group, 'other');
  assert.equal(classifyRoute(undefined).route_group, 'other');
  assert.equal(classifyRoute('').route_group, 'other');
});

test('classifyRoute: GSC INP report fixtures (sample 12 of 376 /pieces/* URLs)', () => {
  // Sous-ensemble représentatif extrait du rapport GSC INP mobile 537ms /pieces/*
  // (cf. plan owner). Toutes ces URLs doivent map à pieces_product (suffix .html)
  // ou pieces_gamme_vehicle (sans .html). Surface = R2_PRODUCT ou R2_GAMME_VEHICLE.
  const fixtures: Array<{ path: string; expectedGroup: 'pieces_product' | 'pieces_gamme_vehicle' }> = [
    { path: '/pieces/disque-de-frein/peugeot/308/1.6-hdi/68681.html', expectedGroup: 'pieces_product' },
    { path: '/pieces/plaquette-de-frein/renault/clio-iv/1.5-dci/45112.html', expectedGroup: 'pieces_product' },
    { path: '/pieces/filtre-a-huile/peugeot/208/1.2-puretech/23145.html', expectedGroup: 'pieces_product' },
    { path: '/pieces/amortisseur/citroen/c3/1.6-hdi/89231.html', expectedGroup: 'pieces_product' },
    { path: '/pieces/courroie-de-distribution/peugeot/2008/1.6-hdi/55421.html', expectedGroup: 'pieces_product' },
    { path: '/pieces/freinage/peugeot/308/1.6-hdi', expectedGroup: 'pieces_gamme_vehicle' },
    { path: '/pieces/freinage/renault/clio-iv/1.5-dci', expectedGroup: 'pieces_gamme_vehicle' },
    { path: '/pieces/embrayage/peugeot/308', expectedGroup: 'pieces_gamme_vehicle' },
    { path: '/pieces/suspension/citroen/c3/1.6-hdi', expectedGroup: 'pieces_gamme_vehicle' },
    { path: '/pieces/distribution/peugeot/2008', expectedGroup: 'pieces_gamme_vehicle' },
    { path: '/pieces/freinage', expectedGroup: 'pieces_gamme_vehicle' },
    { path: '/pieces/echappement', expectedGroup: 'pieces_gamme_vehicle' },
  ];
  for (const { path, expectedGroup } of fixtures) {
    const r = classifyRoute(path);
    assert.equal(r.route_group, expectedGroup, `expected ${expectedGroup} for ${path}, got ${r.route_group}`);
    // R2_PRODUCT et R2_GAMME_VEHICLE diffèrent en tier (P0 vs P1) mais sont toutes
    // sous le surface family "R2_*"
    assert.ok(r.surface.startsWith('R2_'), `expected R2_* surface for ${path}`);
  }
});

test('classifyRoute: idempotence (re-classification stable)', () => {
  const paths = ['/pieces/x/y/z.html', '/conseils/foo', '/checkout', '/'];
  for (const p of paths) {
    const a = classifyRoute(p);
    const b = classifyRoute(p);
    assert.deepEqual(a, b);
  }
});
