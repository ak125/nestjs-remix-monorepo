/**
 * Behavioural proof of the R2 golden gate (assert-r2-golden.mjs).
 *
 * WHY THIS EXISTS
 * ---------------
 * Owner requirement (plan massdoc, R2-GOLDEN): "les relations pièces et les
 * critères doivent continuer de fonctionner sur la page R2" across the DB
 * slices that touch `pieces_relation_type` / `pieces_criteria` structure
 * (index study B4, hash-partitioning B7). A declarative promise is not a
 * guarantee; this gate turns it into a CI failure.
 *
 * The gate compares a frozen PROJECTION of `/api/rm/page-v2` and
 * `/api/rm/alternatives` (relations + criteria only) against a committed
 * golden file. Everything volatile by design — prices, stock, ranking score,
 * images, SEO text, timings — is OUT of the projection, so a legitimate price
 * import never trips it, while a lost relation, a changed side/criteria or a
 * different alternatives set always does.
 *
 * These tests drive the real script against a real local HTTP server and pin:
 *   - volatile-only changes → exit 0 (the gate must not cry wolf);
 *   - a lost relation / changed criteria / changed alternatives → exit 1 with
 *     a readable diff naming the fixture and the field;
 *   - transport failures (503, refused) → retried once, then exit 2 (never a
 *     silent green, never confused with a divergence);
 *   - a 404 (not_found) on a fixture is a divergence, not a transport blip;
 *   - --update rewrites `expected` for every fixture (explicit re-baseline);
 *   - a golden file that evaluates NOTHING fails (vacuous green forbidden);
 *   - a fixture without `expected` fails unless --update.
 *
 * Run: npm run test:r2-golden
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPT_DIR, "assert-r2-golden.mjs");

// ---------------------------------------------------------------------------
// Canned upstream responses (shape = real /api/rm/page-v2 + /api/rm/alternatives)
// ---------------------------------------------------------------------------
const product = (piece_id, pm_id, quality, piece_position, extra = {}) => ({
  piece_id,
  pm_id,
  pm_name: `BRAND-${pm_id}`,
  quality,
  piece_name: "Jeu de 4 plaquettes de frein",
  piece_reference: `REF-${piece_id}`,
  piece_position,
  filtre_gamme: "Plaquettes de frein",
  is_accessory: false,
  score: 115,
  has_image: true,
  image: `https://example.invalid/${piece_id}.jpg`,
  price_ttc: 52,
  stock_status: "IN_STOCK",
  ...extra,
});

function pageV2Body(overrides = {}) {
  const products = overrides.products ?? [
    product(70707, 730, "OE", "Avant"),
    product(7736200, 810, "OE", "Avant"),
    product(3747952, 4120, "EQUIV", "Arrière"),
  ];
  return {
    success: true,
    count: products.length,
    minPrice: 33,
    products,
    grouped_pieces: overrides.grouped_pieces ?? [
      {
        filtre_gamme: "Plaquettes de frein",
        filtre_side: "Avant",
        title_h2: "Plaquettes de frein - Avant",
        oemRefs: ["13301234", "22799077"],
        oemRefsCount: 2,
        pieces: [
          { id: 70707, prix_ttc: 52, stock_status: "IN_STOCK" },
          { id: 7736200, prix_ttc: 62, stock_status: "IN_STOCK" },
        ],
      },
      {
        filtre_gamme: "Plaquettes de frein",
        filtre_side: "Arrière",
        title_h2: "Plaquettes de frein - Arrière",
        oemRefs: ["42570931"],
        oemRefsCount: 1,
        pieces: [{ id: 3747952, prix_ttc: 33, stock_status: "IN_STOCK" }],
      },
    ],
    vehicleInfo: { type_id: 57414 },
    gamme: { pg_id: 402, pg_name: "Plaquettes de frein" },
    seo: { h1: "volatile", title: "volatile" },
    oemRefs: overrides.oemRefs ?? ["13301234", "22799077", "42570931"],
    crossSelling: overrides.crossSelling ?? [],
    filters: overrides.filters ?? {
      sides: [
        { count: 2, value: "Avant" },
        { count: 1, value: "Arrière" },
      ],
      brands: [
        { count: 1, pm_id: 730, pm_name: "BOSCH" },
        { count: 1, pm_id: 810, pm_name: "BREMBO" },
        { count: 1, pm_id: 4120, pm_name: "SASIC" },
      ],
      qualities: [
        { count: 2, value: "OE" },
        { count: 1, value: "EQUIV" },
      ],
      price_range: { min: 33, max: 62 },
    },
    validation: {
      valid: true,
      relationsCount: overrides.relationsCount ?? products.length,
      dataQuality: { quality: 96 },
    },
    duration_ms: 123,
    cacheHit: false,
  };
}

function emptyPageV2Body() {
  return {
    success: true,
    count: 0,
    minPrice: null,
    products: [],
    grouped_pieces: [],
    vehicleInfo: {},
    gamme: { pg_id: 3859 },
    seo: {},
    oemRefs: [],
    crossSelling: [],
    filters: {
      sides: [],
      brands: [],
      qualities: [],
      price_range: { min: null, max: null },
    },
    validation: { valid: false, relationsCount: 0 },
    duration_ms: 50,
    cacheHit: false,
  };
}

function alternativesBody(overrides = {}) {
  return {
    success: true,
    version: "v2",
    etag: "sha256-volatile",
    alternativeVehicles: (overrides.vehicles ?? ["32177", "4650", "3825"]).map(
      (type_id, i) => ({
        type_id,
        type_name: `v${i}`,
        modele_id: 1,
        marque_id: 1,
        tier: 1,
      }),
    ),
    alternativeGammes: (overrides.gammes ?? [2234, 4, 273]).map((pg_id) => ({
      pg_id,
      pg_name: `g${pg_id}`,
      piece_count: 1,
      tier: 1,
    })),
    relatedModels: (overrides.models ?? [33021, 33026]).map((modele_id) => ({
      modele_id,
      modele_name: `m${modele_id}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Stub upstream. `routes` maps "<path>?<sorted query>" → handler(res, hitIndex).
// Map (not object) so attacker-controlled req.url can never reach prototype
// members (CodeQL js/unvalidated-dynamic-method-call).
// ---------------------------------------------------------------------------
async function startServer(routes) {
  const table = new Map(Object.entries(routes));
  const hits = new Map();
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://stub");
    const key = `${url.pathname}?${[...url.searchParams.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&")}`;
    const n = hits.get(key) ?? 0;
    hits.set(key, n + 1);
    const handler = table.get(key);
    if (!handler) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`stub: no route for ${key}`);
      return;
    }
    handler(res, n);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    hits,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const json =
  (body, status = 200) =>
  (res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

const PAGE_KEY = "/api/rm/page-v2?gamme_id=402&limit=200&vehicle_id=57414";
const EMPTY_KEY = "/api/rm/page-v2?gamme_id=3859&limit=200&vehicle_id=11836";
const ALT_KEY = "/api/rm/alternatives?gamme_id=3859&limit=12&type_id=11836";

function fixturesFile(dir, { withExpected = true } = {}) {
  const path = join(dir, "r2-golden.json");
  const golden = {
    schema: "r2-golden/v1",
    captured_at: null,
    captured_from: null,
    fixtures: [
      {
        id: "plaquettes-402-x-57414",
        kind: "page-v2",
        gamme_id: 402,
        vehicle_id: 57414,
        why: "populated, sides",
      },
      {
        id: "kit-freins-3859-x-11836",
        kind: "page-v2",
        gamme_id: 3859,
        vehicle_id: 11836,
        why: "empty (soft-404)",
      },
      {
        id: "alt-3859-x-11836",
        kind: "alternatives",
        gamme_id: 3859,
        type_id: 11836,
        why: "alternatives set",
      },
    ],
  };
  writeFileSync(path, JSON.stringify(golden, null, 2));
  return path;
}

async function run(args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("node", [SCRIPT, ...args], {
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: env.summary ?? "/dev/null",
        ...env,
      },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return {
      code: err.code,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

/** Capture a golden from a healthy stub, then return {dir, path}. */
async function baseline() {
  const dir = mkdtempSync(join(tmpdir(), "r2-golden-"));
  const path = fixturesFile(dir);
  const srv = await startServer({
    [PAGE_KEY]: json(pageV2Body()),
    [EMPTY_KEY]: json(emptyPageV2Body()),
    [ALT_KEY]: json(alternativesBody()),
  });
  const res = await run(["--base", srv.base, "--golden", path, "--update"]);
  await srv.close();
  assert.equal(
    res.code,
    0,
    `baseline --update must succeed:\n${res.stdout}\n${res.stderr}`,
  );
  return { dir, path };
}

describe("assert-r2-golden.mjs — R2 relations + criteria golden gate", () => {
  test("--update captures expected projections for every fixture and stamps provenance", async () => {
    const { path } = await baseline();
    const golden = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(golden.fixtures.length, 3);
    for (const f of golden.fixtures)
      assert.ok(f.expected, `fixture ${f.id} has expected`);
    assert.ok(golden.captured_at, "captured_at stamped");
    assert.ok(golden.captured_from, "captured_from stamped");

    const page = golden.fixtures[0].expected;
    assert.equal(page.classification, "ok");
    assert.equal(page.count, 3);
    assert.deepEqual(
      page.products.map((p) => p.piece_id),
      [70707, 3747952, 7736200].sort((a, b) => a - b),
      "products projected sorted by piece_id (ranking/price order is volatile)",
    );
    assert.deepEqual(
      Object.keys(page.products[0]).sort(),
      [
        "filtre_gamme",
        "is_accessory",
        "piece_id",
        "piece_position",
        "pm_id",
        "quality",
      ],
      "projection carries relations + criteria fields only",
    );
    assert.equal(golden.fixtures[1].expected.classification, "empty");
    assert.deepEqual(golden.fixtures[2].expected, {
      vehicles: ["3825", "4650", "32177"],
      gammes: [4, 273, 2234],
      models: [33021, 33026],
    });
  });

  test("volatile-only changes (price, stock, score, order, image, seo, etag) → exit 0", async () => {
    const { path } = await baseline();
    const shuffled = pageV2Body({
      products: [
        product(3747952, 4120, "EQUIV", "Arrière", {
          price_ttc: 99,
          stock_status: "OUT",
          score: 1,
          has_image: false,
          image: null,
        }),
        product(7736200, 810, "OE", "Avant", { price_ttc: 1 }),
        product(70707, 730, "OE", "Avant", {
          piece_name: "renamed",
          pm_name: "RENAMED",
        }),
      ],
    });
    shuffled.minPrice = 1;
    shuffled.filters.price_range = { min: 1, max: 99 };
    shuffled.seo = { h1: "changed" };
    shuffled.duration_ms = 9999;
    shuffled.cacheHit = true;
    const srv = await startServer({
      [PAGE_KEY]: json(shuffled),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json({
        ...alternativesBody({ vehicles: ["4650", "32177", "3825"] }),
        etag: "sha256-other",
      }),
    });
    const res = await run(["--base", srv.base, "--golden", path]);
    await srv.close();
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /3 fixture\(s\) evaluated, 0 divergence/);
  });

  test("a lost relation (piece missing) → exit 1 naming the fixture and the piece", async () => {
    const { path } = await baseline();
    const lost = pageV2Body({
      products: [
        product(70707, 730, "OE", "Avant"),
        product(7736200, 810, "OE", "Avant"),
      ],
    });
    const srv = await startServer({
      [PAGE_KEY]: json(lost),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run(["--base", srv.base, "--golden", path]);
    await srv.close();
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /plaquettes-402-x-57414/);
    assert.match(res.stdout, /3747952/);
    assert.match(res.stdout, /count/);
  });

  test("a changed criteria (side moves Avant→Arrière) → exit 1 naming piece_position / sides", async () => {
    const { path } = await baseline();
    const moved = pageV2Body({
      products: [
        product(70707, 730, "OE", "Arrière"),
        product(7736200, 810, "OE", "Avant"),
        product(3747952, 4120, "EQUIV", "Arrière"),
      ],
    });
    moved.filters.sides = [
      { count: 1, value: "Avant" },
      { count: 2, value: "Arrière" },
    ];
    const srv = await startServer({
      [PAGE_KEY]: json(moved),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run(["--base", srv.base, "--golden", path]);
    await srv.close();
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /piece_position/);
    assert.match(res.stdout, /sides/);
  });

  test("a changed alternatives set → exit 1; an empty page becoming populated → exit 1", async () => {
    const { path } = await baseline();
    const srv = await startServer({
      [PAGE_KEY]: json(pageV2Body()),
      [EMPTY_KEY]: json(pageV2Body()),
      [ALT_KEY]: json(alternativesBody({ gammes: [2234, 4] })),
    });
    const res = await run(["--base", srv.base, "--golden", path]);
    await srv.close();
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /alt-3859-x-11836/);
    assert.match(res.stdout, /gammes/);
    assert.match(res.stdout, /kit-freins-3859-x-11836/);
    assert.match(res.stdout, /classification/);
    assert.match(res.stdout, /3 fixture\(s\) evaluated, 2 divergence/);
  });

  test("503 on first attempt then 200 → retried once → exit 0", async () => {
    const { path } = await baseline();
    const srv = await startServer({
      [PAGE_KEY]: (res, n) =>
        n === 0 ? json({ statusCode: 503 }, 503)(res) : json(pageV2Body())(res),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run([
      "--base",
      srv.base,
      "--golden",
      path,
      "--retry-delay-ms",
      "10",
    ]);
    await srv.close();
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.equal(srv.hits.get(PAGE_KEY), 2, "exactly one retry");
  });

  test("persistent transport failure → exit 2, other fixtures still evaluated", async () => {
    const { path } = await baseline();
    const srv = await startServer({
      [PAGE_KEY]: json({ statusCode: 503 }, 503),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run([
      "--base",
      srv.base,
      "--golden",
      path,
      "--retry-delay-ms",
      "10",
    ]);
    await srv.close();
    assert.equal(res.code, 2, res.stdout + res.stderr);
    assert.equal(srv.hits.get(PAGE_KEY), 2, "one retry, never more");
    assert.equal(srv.hits.get(ALT_KEY), 1, "later fixtures still evaluated");
    assert.match(res.stdout, /transport/i);
  });

  test("connection refused (no server) → exit 2", async () => {
    const { path } = await baseline();
    const res = await run([
      "--base",
      "http://127.0.0.1:1",
      "--golden",
      path,
      "--retry-delay-ms",
      "10",
    ]);
    assert.equal(res.code, 2, res.stdout + res.stderr);
  });

  test("404 not_found on a page-v2 fixture is a divergence (exit 1), never retried", async () => {
    const { path } = await baseline();
    const srv = await startServer({
      [PAGE_KEY]: json({ statusCode: 404, code: "RESOURCE.NOT_FOUND" }, 404),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run([
      "--base",
      srv.base,
      "--golden",
      path,
      "--retry-delay-ms",
      "10",
    ]);
    await srv.close();
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.equal(srv.hits.get(PAGE_KEY), 1, "a wrong status is never retried");
    assert.match(res.stdout, /not_found/);
  });

  test("divergence dominates transport failure when both occur", async () => {
    const { path } = await baseline();
    const srv = await startServer({
      [PAGE_KEY]: json({ statusCode: 503 }, 503),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody({ models: [1] })),
    });
    const res = await run([
      "--base",
      srv.base,
      "--golden",
      path,
      "--retry-delay-ms",
      "10",
    ]);
    await srv.close();
    assert.equal(res.code, 1, res.stdout + res.stderr);
  });

  test("fixture without expected → exit 1 unless --update", async () => {
    const dir = mkdtempSync(join(tmpdir(), "r2-golden-"));
    const path = fixturesFile(dir);
    const srv = await startServer({
      [PAGE_KEY]: json(pageV2Body()),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run(["--base", srv.base, "--golden", path]);
    await srv.close();
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /no expected/i);
  });

  test("a golden file with zero fixtures fails (vacuous green forbidden)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "r2-golden-"));
    const path = join(dir, "r2-golden.json");
    writeFileSync(
      path,
      JSON.stringify({ schema: "r2-golden/v1", fixtures: [] }),
    );
    const res = await run(["--base", "http://127.0.0.1:1", "--golden", path]);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout + res.stderr, /no fixture/i);
  });

  test("writes a markdown summary row per fixture to GITHUB_STEP_SUMMARY", async () => {
    const { dir, path } = await baseline();
    const summary = join(dir, "summary.md");
    const srv = await startServer({
      [PAGE_KEY]: json(pageV2Body()),
      [EMPTY_KEY]: json(emptyPageV2Body()),
      [ALT_KEY]: json(alternativesBody()),
    });
    const res = await run(["--base", srv.base, "--golden", path], { summary });
    await srv.close();
    assert.equal(res.code, 0);
    const md = readFileSync(summary, "utf8");
    assert.match(md, /plaquettes-402-x-57414/);
    assert.match(md, /alt-3859-x-11836/);
  });
});
