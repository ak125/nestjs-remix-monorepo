/**
 * R2 loader regression tests. Executes the actual TypeScript loader, not a
 * reimplementation. Only imported services and framework adapters are stubbed.
 * No network, database, credentials, or npm install required.
 * Run: node --test scripts/ci/r2-upstream-failure.test.mjs
 * Requires Node >=22.13 (native stripTypeScriptTypes).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

const source = readFileSync(
  new URL('../../frontend/app/utils/pieces-vehicle.loader.server.ts', import.meta.url),
  'utf8',
);
const js = stripTypeScriptTypes(source, { mode: 'strip' });
const pathname = '/pieces/filtre-a-huile-7/renault-140/clio-140001/1-5-dci-123.html';

async function harness({ response, rejection, alternativesFail = false, mappingFail = false,
  renderingFail = false, malformed = null, invalidVehicle = false } = {}) {
  const calls = [];
  const diagnostics = [];
  const noop = () => {};
  const globals = {
    URL, Response, Request, AbortSignal, Error, TypeError, SyntaxError,
    process: { env: {} },
    fetch: async (url) => {
      calls.push(String(url));
      if (alternativesFail) throw new TypeError('alternatives offline');
      return new Response(JSON.stringify({ success: true,
        alternativeGammes: [{ id: 8 }], alternativeVehicles: [], relatedModels: [] }));
    },
  };
  const dependencies = {
    '~/components/pieces/NoProductsAlternatives': {},
    '~/components/pieces/PiecesFilterSidebar': {},
    '@repo/seo-types': { enrichTypeNameForHeadings: () => ({ value: '1.5 dCi' }) },
    'react-router': {
      data: (value, init = {}) => ({ data: value, status: init.status ?? 200,
        headers: new Headers(init.headers) }),
      redirect: (url, status) => new Response(null, { status, headers: { Location: url } }),
    },
    '~/services/api/rm-api.service': { fetchRmPageV2: async () => {
      if (rejection) throw rejection;
      return response;
    } },
    '~/services/pieces/pieces-route.service': {
      fetchBlogArticleWithRelated: async () => ({}), fetchSeoSwitches: async () => [],
    },
    '~/utils/fetch.utils': { fetchJsonOrNull: async () => null },
    '~/utils/internal-api.server': { getInternalApiUrl: () => 'https://unused.invalid' },
    '~/utils/logger': { logger: { log: noop, warn: noop,
      error: (...args) => diagnostics.push(args) } },
    '~/utils/pieces-loader.utils': { buildCataloguePromise: async () => null },
    '~/utils/pieces-route.utils': {
      detectMalformedSegment: () => malformed,
      generateBuyingGuide: () => ({}), generateFAQ: () => {
        if (renderingFail) throw new Error('render failure');
        return [];
      },
      parseUrlParam: (s) => ({ alias: s.replace(/-\d+$/, ''), id: 7 }),
      resolveGammeId: async () => 7,
      resolveVehicleIds: async () => ({ marqueId: 140, modeleId: 140001, typeId: 123 }),
      validateVehicleIds: () => { if (invalidVehicle) throw new Error('invalid vehicle'); },
    },
    '~/utils/rm-mapper': {
      // Existing predicate's contract: success + validation.valid + min count.
      isRmV2DataUsable: (r, min = 1) => Boolean(r?.success && r?.validation?.valid
        && (r.count || 0) >= min),
      mapRmV2ToLoaderData: (r) => {
        if (mappingFail) throw new Error('map failure');
        return {
          vehicle: { marque: 'Renault', marqueAlias: 'renault', marqueId: 140,
            modele: 'Clio', modeleAlias: 'clio', modeleId: 140001,
            type: '1.5 dCi', typeAlias: '1-5-dci', typeId: 123 },
          gamme: { alias: 'filtre-a-huile', id: 7, name: 'Filtre à huile' },
          pieces: r.products, seoContent: { h1: 'Existing H1', longDescription: 'Existing description' },
        };
      },
    },
    '~/utils/seo/catalog-gammes.server': { loadCatalogGammeIds: async () => new Set([7]) },
    '~/utils/seo/r2-indexability': {
      countSellableProducts: (products) => products.length,
      readR2SellableGateConfig: () => ({ enabled: false, minSellable: 1 }),
      resolveR2Robots: () => 'index, follow',
    },
    '~/utils/seo-clean.utils': { stripHtmlForMeta: (s) => s },
    '~/utils/url-builder.utils': {
      buildTypeSlug: () => '1-5-dci-123', buildVoirAussiLinks: () => [],
      normalizeAlias: (s) => s.toLowerCase(),
    },
  };
  // Remove only static import declarations after native TS stripping and bind
  // their adapters. Keep the loader body intact. Unknown imports fail loudly.
  const body = js.replace(/^import[\s\S]*?from\s+["']([^"']+)["'];/gm,
    (_declaration, specifier) => {
      assert.ok(dependencies[specifier], `Unexpected dependency ${specifier}`);
      return '';
    }).replace(/^export async function /gm, 'async function ');
  const bindings = Object.assign({}, ...Object.values(dependencies), globals);
  const loader = new Function(...Object.keys(bindings),
    `${body}\nreturn piecesVehicleLoader;`)(...Object.values(bindings));
  return { calls, diagnostics, run: () => loader({
    request: new Request(`https://www.automecanik.com${pathname}`),
    params: { gamme: 'filtre-a-huile-7', marque: 'renault-140',
      modele: 'clio-140001', type: '1-5-dci-123' },
  }) };
}

const positive = () => ({ success: true, count: 1, products: [{ piece_id: 1 }],
  validation: { valid: true }, vehicleInfo: {}, gamme: {}, grouped_pieces: [] });
const empty = () => ({ success: true, count: 0, products: [], validation: { valid: false },
  vehicleInfo: {}, gamme: {} });

async function assertTemporaryFailure(options) {
  const h = await harness(options);
  await assert.rejects(h.run, (e) => {
    assert.ok(e instanceof Response);
    assert.equal(e.status, 503);
    assert.equal(e.headers.get('X-Robots-Tag'), null, 'transient error must not request deindexation');
    assert.match(e.headers.get('Cache-Control') ?? '', /no-store/);
    assert.equal(e.headers.get('Retry-After'), '300');
    return true;
  });
  assert.equal(h.calls.length, 0, 'upstream failure must not reach alternatives or soft-404 tracking');
  assert.ok(h.diagnostics.length > 0, 'failure must be observable');
}

for (const [name, error] of [
  ['HTTP 500', new Error('RM Page V2 API failed: 500')],
  ['network', new TypeError('fetch failed')],
  ['invalid JSON', new SyntaxError('invalid JSON')],
  ['timeout', new Error('request timed out')],
]) {
  test(`${name} returns non-cacheable 503, never empty 200/noindex`,
    () => assertTemporaryFailure({ rejection: error }));
}
for (const [name, response] of [
  ['null', null], ['unsuccessful result', { ...empty(), success: false }],
  ['missing products', { success: true, count: 0 }],
  ['invalid positive result', { ...positive(), validation: { valid: false } }],
  ['negative count', { ...empty(), count: -1 }],
  ['string count', { ...empty(), count: '0' }],
  ['count without products', { ...empty(), count: 1 }],
  ['products without count', { ...positive(), count: 0 }],
]) {
  test(`${name} is not evidence of an empty catalogue`,
    () => assertTemporaryFailure({ response }));
}
test('genuine zero-product result retains governed alternatives and noindex', async () => {
  const h = await harness({ response: empty() });
  const r = await h.run();
  assert.equal(r.status, 200);
  assert.equal(r.data.noProducts, true);
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, follow');
  assert.match(r.headers.get('Cache-Control'), /s-maxage=3600/);
  assert.equal(h.calls.length, 2);
});
test('genuine empty catalogue with failed alternatives remains non-cacheable', async () => {
  const h = await harness({ response: empty(), alternativesFail: true });
  const r = await h.run();
  assert.equal(r.status, 200);
  assert.equal(r.data.noProducts, true);
  assert.match(r.headers.get('Cache-Control'), /no-store/);
});
test('valid positive catalogue retains success robots and cache', async () => {
  const h = await harness({ response: positive() });
  const r = await h.run();
  assert.equal(r.status, 200);
  assert.equal(r.data.robots, 'index, follow');
  assert.equal(r.data.count, 1);
  assert.equal(r.data.canonicalPath, pathname);
  assert.match(r.headers.get('Cache-Control'), /s-maxage=86400/);
});
for (const kind of ['mappingFail', 'renderingFail']) {
  test(`${kind} is non-cacheable 503 without noindex`, () =>
    assertTemporaryFailure({ response: positive(), [kind]: true }));
}
test('permanently malformed URL still returns 410', async () => {
  const h = await harness({ malformed: 'missing_alias' });
  await assert.rejects(h.run, (e) => e instanceof Response && e.status === 410);
});
test('invalid vehicle still returns 410', async () => {
  const h = await harness({ invalidVehicle: true });
  await assert.rejects(h.run, (e) => e instanceof Response && e.status === 410);
});
