import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONSOLIDATION_FILE,
  FLAG_TEMPLATE,
  NOINDEX_FILE,
  createClient,
  findReferenceLinks,
  gitRunner,
  httpTransport,
  markdownCell,
  parseFlags,
  readLists,
  renderCsv,
  renderSummary,
  runChecks,
} from "./r4-served-checks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const script = join(here, "r4-served-checks.mjs");
const CONSEILS = "/blog-pieces-auto/conseils/";

// ── A small checkout with lists in the real file format ────────────────────

const T43 = [
  { slug: "disque-de-frein", pgId: 82 },
  { slug: "filtre-a-huile", pgId: 7 },
  { slug: "cardan", pgId: 13 },
];
const L62 = ["volant-moteur", "accumulateur-de-pression-de-carburant"];
const OTHERS = ["alternateur", "bougie-d-allumage"];
const PUBLISHED = [...T43.map((t) => t.slug), ...L62, ...OTHERS];

function consolidationSource(targets) {
  return (
    "export const R4_CONSOLIDATION_TARGETS: ReadonlyArray<R4ConsolidationTarget> = Object.freeze([\n" +
    targets
      .map((t) => "  { slug: '" + t.slug + "', pgId: " + t.pgId + " },")
      .join("\n") +
    "\n]);\n"
  );
}
function noindexSource(slugs) {
  return (
    "export const R4_NOINDEX_ROBOTS = 'noindex, follow' as const;\n" +
    "export const R4_NOINDEX_SLUGS: readonly string[] = Object.freeze([\n" +
    slugs.map((s) => "  '" + s + "',").join("\n") +
    "\n]);\n"
  );
}

const work = mkdtempSync(join(tmpdir(), "r4-served-checks-"));
const repo = join(work, "repo");
const git = (...args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
let firstCommit;
let checkout;

function commitAll(message) {
  git("add", "-A");
  git(
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "-m",
    message,
  );
  return git("rev-parse", "HEAD");
}

// ── Local simulation of the served site ────────────────────────────────────

const requests = [];
let site;
let server;
let base;

// Forced responses are keyed by the exact request path in a Map: a received
// path never names a property of an object (no "__proto__", "constructor"…).
function defaults(over = {}) {
  const { overrides = {}, ...rest } = over;
  return {
    cons: true,
    noi: true,
    revision: () => checkout,
    sitemapExtra: [],
    ...rest,
    overrides: new Map(Object.entries(overrides)),
  };
}

function html({ robots, canonical, body }) {
  return (
    "<!DOCTYPE html><html><head>" +
    '<meta name="robots" content="' +
    robots +
    '"/>' +
    (canonical ? '<link rel="canonical" href="' + canonical + '"/>' : "") +
    "</head><body>" +
    body +
    "</body></html>"
  );
}

function linksTo(slugs) {
  return slugs
    .map((s) => '<a href="/reference-auto/' + s + '">' + s + "</a>")
    .join("");
}

function respond(path) {
  const s = site;
  const forced = s.overrides.get(path);
  if (typeof forced === "function") return forced();
  const in43 = new Map(T43.map((t) => [t.slug, t]));
  const visible = PUBLISHED.filter((p) => !(s.cons && in43.has(p)));
  let m;
  if (path === "/health")
    return { status: 200, json: { status: "ok", revision: s.revision() } };
  if ((m = path.match(/^\/api\/seo\/reference\/redirect\/([a-z0-9-]+)$/)))
    return {
      status: 200,
      headers: { "cache-control": "no-store" },
      json: {
        redirect_to: s.cons && in43.has(m[1]) ? CONSEILS + m[1] : null,
        pg_alias: in43.has(m[1]) ? m[1] : null,
      },
    };
  if (path === "/api/seo/reference")
    return {
      status: 200,
      headers: { "cache-control": "public, max-age=3600" },
      json: {
        references: PUBLISHED.map((slug) => ({
          slug,
          gamme: in43.has(slug)
            ? {
                pgId: in43.get(slug).pgId,
                url: "/pieces/" + slug + "-" + in43.get(slug).pgId + ".html",
              }
            : { pgId: null, url: null },
        })),
        total: PUBLISHED.length,
      },
    };
  if (path === "/api/seo/diagnostic/featured?limit=5")
    return { status: 200, json: { data: [{ slug: "bruit-au-freinage" }] } };
  if ((m = path.match(/^\/reference-auto\/([a-z0-9-]+)$/))) {
    const slug = m[1];
    if (s.cons && in43.has(slug))
      return {
        status: 301,
        headers: { location: CONSEILS + slug, "cache-control": "no-store" },
        body: "",
      };
    if (!PUBLISHED.includes(slug)) return { status: 404, body: "not found" };
    const robots =
      s.noi && L62.includes(slug) ? "noindex, follow" : "index, follow";
    return {
      status: 200,
      headers: { "cache-control": "public, max-age=300" },
      body: html({
        robots,
        canonical: "https://www.automecanik.com/reference-auto/" + slug,
        body: linksTo(visible.filter((v) => v !== slug).slice(0, 3)),
      }),
    };
  }
  if (path === "/reference-auto")
    return {
      status: 200,
      body: html({ robots: "index, follow", body: linksTo(visible) }),
    };
  if ((m = path.match(/^\/blog-pieces-auto\/conseils\/([a-z0-9-]+)$/)))
    return {
      status: 200,
      body: html({
        robots: "index, follow",
        body: s.cons
          ? '<div class="flex items-start gap-3"><p>Fiche</p></div>'
          : linksTo([m[1]]),
      }),
    };
  if (path === "/sitemap-reference.xml") {
    const locs = PUBLISHED.filter(
      (p) => !(s.cons && in43.has(p)) && !(s.noi && L62.includes(p)),
    ).concat(s.sitemapExtra);
    return {
      status: 200,
      headers: { "content-type": "application/xml" },
      body:
        '<?xml version="1.0" encoding="UTF-8"?><urlset>' +
        locs
          .map(
            (p) =>
              "<url><loc>https://www.automecanik.com/reference-auto/" +
              p +
              "</loc></url>",
          )
          .join("") +
        "</urlset>",
    };
  }
  if (path === "/robots.txt")
    return { status: 200, body: "User-agent: *\nAllow: /\n" };
  if (
    /^\/(pieces\/[a-z0-9-]+\.html|blog-pieces-auto\/guide-achat\/[a-z0-9-]+|diagnostic-auto\/[a-z0-9-]+)$/.test(
      path,
    )
  )
    return {
      status: 200,
      body: html({
        robots: "index, follow",
        body: linksTo(visible.slice(0, 2)),
      }),
    };
  return { status: 404, body: "not found" };
}

before(async () => {
  mkdirSync(join(repo, dirname(CONSOLIDATION_FILE)), { recursive: true });
  execFileSync("git", ["init", "-q", repo]);
  writeFileSync(
    join(repo, CONSOLIDATION_FILE),
    consolidationSource(T43.slice(0, 2)),
  );
  writeFileSync(join(repo, NOINDEX_FILE), noindexSource(L62));
  writeFileSync(join(repo, "README"), "first\n");
  firstCommit = commitAll("first");
  writeFileSync(join(repo, CONSOLIDATION_FILE), consolidationSource(T43));
  const second = commitAll("lists: add cardan");
  writeFileSync(join(repo, "README"), "third\n");
  checkout = commitAll("unrelated");
  site = { ...defaults(), second };
  server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    const r = respond(req.url);
    const headers = { ...(r.headers || {}) };
    let body = r.body ?? "";
    if (r.json) {
      body = JSON.stringify(r.json);
      headers["content-type"] = "application/json";
    }
    res.writeHead(r.status, headers);
    res.end(body);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  base = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  await new Promise((ok) => server.close(ok));
  rmSync(work, { recursive: true, force: true });
});

function flags(cons, noi) {
  return parseFlags(
    "SEO_R4_CONSOLIDATION_ENABLED=" +
      (cons ? "true" : "false") +
      "\nSEO_R4_NOINDEX_ENABLED=" +
      (noi ? "true" : "false") +
      "\n",
  );
}

async function run(over = {}, factsOver = {}) {
  site = { ...defaults(over), second: site.second };
  requests.length = 0;
  const sleeps = [];
  const client = createClient({
    transport: httpTransport(base),
    pauseMs: 7,
    maxRequests: 450,
    sleep: async (ms) => sleeps.push(ms),
  });
  const result = await runChecks({
    target: "preprod",
    lists: readLists(repo),
    facts: {
      flags: flags(site.cons, site.noi),
      startedAt: "2026-11-26T06:00:00.000Z",
      sitemapStat: { mtime: "2026-11-26T07:00:00.000Z", size: 1 },
      ...factsOver,
    },
    checkout,
    git: gitRunner(repo),
    client,
  });
  const level = Object.fromEntries(result.checks.map((c) => [c.id, c.level]));
  return { result, level, sleeps };
}

const OK_ON = { 0: "ok", 1: "ok", 2: "ok", 3: "ok", 4: "ok", 5: "ok", 6: "ok" };

test("lists of the checkout: 43 and 62, disjoint, in the parsed format", () => {
  const { targets, noindex } = readLists(root);
  assert.equal(targets.length, 43);
  assert.equal(noindex.length, 62);
  assert.ok(targets.every((t) => Number.isInteger(t.pgId)));
});

test("flags: only the literal true is on; other lines are never kept", () => {
  const f = parseFlags(
    "SEO_R4_CONSOLIDATION_ENABLED='true'\nSECRET_KEY=x\nSEO_R4_NOINDEX_ENABLED=true\n",
  );
  assert.deepEqual(f.consolidation, { raw: "'true'", on: false });
  assert.deepEqual(f.noindex, { raw: "true", on: true });
  assert.deepEqual(parseFlags("").consolidation, { raw: null, on: false });
  assert.ok(!JSON.stringify(f).includes("SECRET"));
});

test("flags on, compliant posture: every check ok, GET only, paced", async () => {
  const { result, level, sleeps } = await run();
  assert.deepEqual(level, OK_ON);
  assert.equal(result.failed, false);
  assert.ok(requests.every((r) => r.method === "GET"));
  assert.equal(result.requests, requests.length);
  assert.equal(sleeps.length, requests.length - 1);
  assert.ok(sleeps.every((ms) => ms === 7));
});

test("flags off, compliant posture: no failure, 2 and 5 not applicable", async () => {
  const { result, level } = await run({ cons: false, noi: false });
  assert.deepEqual(level, { ...OK_ON, 2: "sans objet", 5: "sans objet" });
  assert.equal(result.failed, false);
});

test("one of the 43 answers 200 while the flag is on: failure", async () => {
  const { result, level } = await run({
    overrides: {
      "/reference-auto/cardan": () => ({
        status: 200,
        body: html({ robots: "index, follow", body: "" }),
      }),
    },
  });
  assert.equal(level[1], "échec");
  assert.equal(result.failed, true);
  assert.ok(
    result.rows.some(
      (r) =>
        r.check === "1-r4-43" &&
        r.url === "/reference-auto/cardan" &&
        r.verdict === "échec",
    ),
  );
});

test("301 in two hops (target redirects again): failure", async () => {
  const { result, level } = await run({
    overrides: {
      [CONSEILS + "cardan"]: () => ({
        status: 301,
        headers: { location: "/blog-pieces-auto/conseils/cardan-2" },
        body: "",
      }),
    },
  });
  assert.equal(level[2], "échec");
  assert.ok(
    result.rows.some(
      (r) => r.check === "2-cible" && /deuxième saut/.test(r.detail),
    ),
  );
  assert.equal(result.failed, true);
});

test("301 without no-store: failure", async () => {
  const { level } = await run({
    overrides: {
      "/reference-auto/cardan": () => ({
        status: 301,
        headers: {
          location: CONSEILS + "cardan",
          "cache-control": "public, max-age=300",
        },
        body: "",
      }),
    },
  });
  assert.equal(level[1], "échec");
});

test("a target served noindex: failure", async () => {
  const { result, level } = await run({
    overrides: {
      [CONSEILS + "filtre-a-huile"]: () => ({
        status: 200,
        body: html({ robots: "noindex, follow", body: "" }),
      }),
    },
  });
  assert.equal(level[2], "échec");
  assert.ok(
    result.rows.some(
      (r) =>
        r.url === CONSEILS + "filtre-a-huile" && /meta noindex/.test(r.detail),
    ),
  );
});

test("one of the 62 served without noindex: failure", async () => {
  const { result, level } = await run({
    overrides: {
      "/reference-auto/volant-moteur": () => ({
        status: 200,
        body: html({
          robots: "index, follow",
          canonical: "https://www.automecanik.com/reference-auto/volant-moteur",
          body: "",
        }),
      }),
    },
  });
  assert.equal(level[6], "échec");
  assert.ok(
    result.rows.some(
      (r) =>
        r.check === "6-noindex" && r.url === "/reference-auto/volant-moteur",
    ),
  );
});

test("a page outside the lists served noindex: failure", async () => {
  const { result, level } = await run({
    overrides: {
      "/reference-auto/alternateur": () => ({
        status: 200,
        body: html({ robots: "noindex, follow", body: "" }),
      }),
    },
  });
  assert.equal(level[6], "échec");
  assert.ok(
    result.rows.some(
      (r) =>
        r.url === "/reference-auto/alternateur" && /hors liste/.test(r.detail),
    ),
  );
});

test("flag off: one of the 62 still noindex is a failure", async () => {
  const { level } = await run({
    cons: false,
    noi: false,
    overrides: {
      "/reference-auto/volant-moteur": () => ({
        status: 200,
        body: html({ robots: "noindex, follow", body: "" }),
      }),
    },
  });
  assert.equal(level[6], "échec");
});

test("sitemap older than the container start: « non régénéré », no failure", async () => {
  const { result, level } = await run(
    { sitemapExtra: ["cardan", "volant-moteur"] },
    { sitemapStat: { mtime: "2026-11-25T03:00:00.000Z", size: 1 } },
  );
  assert.equal(level[4], "alerte");
  assert.match(result.checks.find((c) => c.id === "4").detail, /non régénéré/);
  assert.equal(result.failed, false);
});

test("fresh sitemap still listing one of the 43: failure", async () => {
  const { level } = await run({ sitemapExtra: ["cardan"] });
  assert.equal(level[4], "échec");
});

test("link to one of the 43 in a JSON-LD block: failure, located", async () => {
  const { result, level } = await run({
    overrides: {
      [CONSEILS + "cardan"]: () => ({
        status: 200,
        body: html({
          robots: "index, follow",
          body: '<div class="flex items-start gap-3"></div><script type="application/ld+json">{"item":"https://www.automecanik.com/reference-auto/cardan"}</script>',
        }),
      }),
    },
  });
  assert.equal(level[5], "échec");
  assert.ok(result.rows.some((r) => /cardan @ JSON-LD/.test(r.detail)));
});

test("link finder: exact slug, zone of each hit", () => {
  const hits = findReferenceLinks(
    '<nav aria-label="breadcrumb"><a href="/reference-auto/cardan">c</a></nav><a href="/reference-auto/cardan-arriere">x</a>',
    new Set(["cardan"]),
  );
  assert.deepEqual(hits, [{ slug: "cardan", where: "fil d'Ariane" }]);
});

test("served revision different from the checkout, same lists: alert, not failure", async () => {
  const { result, level } = await run({ revision: () => site.second });
  assert.equal(result.revision.level, "alerte");
  assert.match(
    result.revision.detail,
    /DIFFÉRENTES ; listes des 43 et des 62 identiques/,
  );
  assert.equal(level[0], "alerte");
  assert.equal(result.failed, false);
});

test("served revision with other lists: failure", async () => {
  const { result } = await run({ revision: () => firstCommit });
  assert.equal(result.revision.level, "échec");
  assert.equal(result.failed, true);
});

test("served revision unknown to the checkout: alert, lists not compared", async () => {
  const { result } = await run({ revision: () => "0".repeat(40) });
  assert.equal(result.revision.level, "alerte");
  assert.match(result.revision.detail, /absent du checkout/);
});

test("request cap reached: the run stops", async () => {
  site = { ...defaults(), second: site.second };
  const client = createClient({
    transport: httpTransport(base),
    pauseMs: 0,
    maxRequests: 10,
    sleep: async () => {},
  });
  await assert.rejects(
    runChecks({
      target: "prod",
      lists: readLists(repo),
      facts: { flags: flags(true, true), startedAt: "", sitemapStat: {} },
      checkout,
      git: gitRunner(repo),
      client,
    }),
    /budget de 10 requêtes atteint/,
  );
});

// ── Output escaping ────────────────────────────────────────────────────────

// Splits a GitHub table row the way GitHub does: a backslash escapes the next
// character, an unescaped pipe separates two cells.
function cellsOf(row) {
  const cells = [];
  let cur = "";
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === "\\") {
      cur += row[i + 1] ?? "";
      i += 1;
    } else if (row[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += row[i];
  }
  cells.push(cur.trim());
  return cells.slice(1, -1);
}

test("summary table: backslash, pipe and line breaks stay in their cell", () => {
  const detail = "C:\\temp\\ | fin \\| suite\r\nligne 2\nligne 3\\";
  const title = "titre | à \\ part";
  const out = renderSummary({
    target: "preprod",
    container: "c",
    revision: { level: "ok", detail: "r" },
    flags: { consolidation: { on: true }, noindex: { on: false } },
    requests: 0,
    pauseMs: 0,
    dockerCommands: 0,
    checks: [{ id: 9, title, level: "alerte", detail }],
    failed: false,
  });
  const lines = out.split("\n");
  const rows = lines.filter((l) => l.startsWith("| 9 |"));
  assert.equal(rows.length, 1);
  assert.ok(
    !lines.some((l) => l.startsWith("ligne")),
    "no line break in a row",
  );
  assert.deepEqual(cellsOf(rows[0]), [
    "9",
    title,
    "⚠️ alerte",
    "C:\\temp\\ | fin \\| suite ligne 2 ligne 3\\",
  ]);
  assert.equal(markdownCell("a\\|b"), "a\\\\\\|b");
});

test("CSV: quote, comma, CR and LF are quoted", () => {
  const csv = renderCsv([{ check: "x", detail: 'a "b", c\rd\ne' }]);
  assert.ok(csv.endsWith('\nx,,,,,,,,,"a ""b"", c\rd\ne"\n'));
});

// ── CLI end to end, docker replaced by a local executable on PATH ─────────

function fakeDocker(dir) {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const source =
    "#!/usr/bin/env node\n" +
    "const { appendFileSync, readFileSync } = require('node:fs');\n" +
    "const { spawnSync } = require('node:child_process');\n" +
    "const args = process.argv.slice(2);\n" +
    "appendFileSync(process.env.FAKE_DOCKER_LOG, JSON.stringify(args) + '\\n');\n" +
    "if (args[0] === 'inspect' && args[2] === process.env.FAKE_TEMPLATE) { process.stdout.write(process.env.FAKE_FLAGS); process.exit(0); }\n" +
    "if (args[0] === 'inspect' && args[2] === '{{.State.StartedAt}}') { process.stdout.write('2026-11-26T06:00:00.000000000Z\\n'); process.exit(0); }\n" +
    "if (args[0] === 'exec' && args[1] === '-i' && args.slice(3).join(' ') === 'node --input-type=module') {\n" +
    "  const input = readFileSync(0, 'utf8').split('http://127.0.0.1:3000').join(process.env.FAKE_BASE)\n" +
    "    .split('/var/www/sitemaps/').join(process.env.FAKE_SITEMAP_DIR + '/');\n" +
    "  const r = spawnSync(process.execPath, ['--input-type=module'], { input, encoding: 'utf8' });\n" +
    "  process.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exit(r.status);\n" +
    "}\n" +
    "process.stderr.write('unexpected docker call\\n'); process.exit(2);\n";
  writeFileSync(join(bin, "docker"), source);
  chmodSync(join(bin, "docker"), 0o755);
  return bin;
}

function runCli(args, env) {
  return new Promise((ok) => {
    const child = spawn(process.execPath, [script, ...args], { env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => ok({ code, out }));
  });
}

test("CLI on preprod: docker transport, filtered flags, summary and CSV", async () => {
  site = { ...defaults(), second: site.second };
  requests.length = 0;
  const bin = fakeDocker(work);
  const log = join(work, "docker.log");
  const summary = join(work, "summary.md");
  const csv = join(work, "detail.csv");
  writeFileSync(log, "");
  writeFileSync(summary, "");
  const { code, out } = await runCli(
    ["--target", "preprod", "--repo", repo, "--summary", summary, "--csv", csv],
    {
      PATH: bin + ":" + process.env.PATH,
      FAKE_DOCKER_LOG: log,
      FAKE_TEMPLATE: FLAG_TEMPLATE,
      FAKE_FLAGS:
        "SEO_R4_CONSOLIDATION_ENABLED=true\nSEO_R4_NOINDEX_ENABLED=true\n",
      FAKE_BASE: base,
      FAKE_SITEMAP_DIR: join(work, "no-sitemaps"),
    },
  );
  assert.equal(code, 0, out);
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.ok(calls.every((c) => c.includes("nestjs-remix-monorepo-preprod")));
  assert.deepEqual(calls[0], [
    "inspect",
    "--format",
    FLAG_TEMPLATE,
    "nestjs-remix-monorepo-preprod",
  ]);
  assert.ok(requests.length > 20 && requests.every((r) => r.method === "GET"));
  const md = readFileSync(summary, "utf8");
  assert.match(
    md,
    /Requêtes GET envoyées : \*\*\d+\*\*, une à la fois, pause de 250 ms/,
  );
  assert.match(md, /Verdict : posture servie conforme/);
  // The fake stat reads an absent directory: date unknown, alert only.
  assert.match(
    md,
    /\| 4 \| Sitemap des fiches R4 \| ⚠️ alerte \| non régénéré/,
  );
  const lines = readFileSync(csv, "utf8").trim().split("\n");
  assert.equal(
    lines[0],
    "check,url,status,location,cache_control,x_robots_tag,meta_robots,canonical,verdict,detail",
  );
  assert.ok(lines.length > 10);
});

test("CLI exits 1 when the served posture does not match", async () => {
  site = { ...defaults(), second: site.second };
  const bin = fakeDocker(work);
  const log = join(work, "docker2.log");
  writeFileSync(log, "");
  const { code, out } = await runCli(["--target", "preprod", "--repo", repo], {
    PATH: bin + ":" + process.env.PATH,
    FAKE_DOCKER_LOG: log,
    FAKE_TEMPLATE: FLAG_TEMPLATE,
    // Flags read off while the site serves the on posture.
    FAKE_FLAGS: "SEO_R4_CONSOLIDATION_ENABLED=false\n",
    FAKE_BASE: base,
    FAKE_SITEMAP_DIR: join(work, "no-sitemaps"),
  });
  assert.equal(code, 1, out);
  assert.match(out, /Verdict : ÉCHEC/);
});

test("CLI with unreadable flags: exit 1, reason in the summary, no request", async () => {
  const bin = fakeDocker(work);
  const log = join(work, "docker3.log");
  const summary = join(work, "summary3.md");
  writeFileSync(log, "");
  writeFileSync(summary, "");
  requests.length = 0;
  const { code } = await runCli(
    ["--target", "prod", "--repo", repo, "--summary", summary],
    {
      PATH: bin + ":" + process.env.PATH,
      FAKE_DOCKER_LOG: log,
      FAKE_TEMPLATE: "another template",
      FAKE_BASE: base,
    },
  );
  assert.equal(code, 1);
  assert.match(
    readFileSync(summary, "utf8"),
    /Contrôle interrompu : .* \(0 requêtes\)/,
  );
  assert.equal(requests.length, 0);
});

test("CLI refuses an http transport other than loopback", async () => {
  const { code, out } = await runCli(
    [
      "--target",
      "prod",
      "--transport",
      "http",
      "--base",
      "https://www.automecanik.com",
    ],
    { PATH: process.env.PATH },
  );
  assert.equal(code, 1);
  assert.match(out, /exige --base http:\/\/127\.0\.0\.1/);
});
