import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Read-only check of the served R4 posture (mandat FD), against the flags read
// in the container. GET only, one request at a time with a pause, no sitemap
// regeneration, no database access, no secret. The container environment is
// filtered by docker itself (FLAG_TEMPLATE): only the two R4 flag lines leave
// docker inspect. The 43 and the 62 come from the checkout config files.

export const CONSOLIDATION_FILE =
  "backend/src/modules/seo/services/r4-consolidation.config.ts";
export const NOINDEX_FILE =
  "backend/src/modules/seo/services/r4-noindex.config.ts";
export const FLAG_KEYS = [
  "SEO_R4_CONSOLIDATION_ENABLED",
  "SEO_R4_NOINDEX_ENABLED",
];
export const FLAG_TEMPLATE =
  '{{range .Config.Env}}{{$k := index (split . "=") 0}}' +
  '{{if or (eq $k "SEO_R4_CONSOLIDATION_ENABLED") (eq $k "SEO_R4_NOINDEX_ENABLED")}}' +
  "{{println .}}{{end}}{{end}}";
export const SITEMAP_FILE = "/var/www/sitemaps/sitemap-reference.xml";
export const ORIGIN = "http://127.0.0.1:3000";
// Pause between two requests (ms); the CLI may only raise it. Requests go to
// the app's loopback inside its container: the throttler skips a loopback peer
// without forwarding headers (backend/src/config/throttler-skip.config.ts) and
// BotGuard skips internal IPs, so the run neither consumes nor trips a bucket.
export const TARGETS = {
  preprod: { container: "nestjs-remix-monorepo-preprod", pauseMs: 250 },
  prod: { container: "nestjs-remix-monorepo-prod", pauseMs: 500 },
};
// Hard cap per run (about 345 with the current lists): a run that would need
// more stops and fails instead of reading on.
export const MAX_REQUESTS = 450;
const SAMPLE = 5;
const OTHER_PAGES_FOR_LINKS = 20;
const CONSEILS = "/blog-pieces-auto/conseils/";
const REFERENCE = "/reference-auto/";
const SLUG = /^[a-z0-9-]+$/;

export const LEVEL = {
  ok: "ok",
  alert: "alerte",
  fail: "échec",
  na: "sans objet",
};

// ── Lists from the checkout ────────────────────────────────────────────────

function assertUnique(slugs, label) {
  if (new Set(slugs).size !== slugs.length)
    throw new Error(label + " : slug en double");
}

export function parseConsolidationTargets(source) {
  const start = source.indexOf("R4_CONSOLIDATION_TARGETS");
  const end = source.indexOf("]);", start);
  if (start < 0 || end < 0) throw new Error("R4_CONSOLIDATION_TARGETS absent");
  const block = source.slice(start, end);
  const targets = [
    ...block.matchAll(/\{\s*slug:\s*'([a-z0-9-]+)',\s*pgId:\s*(\d+)\s*\}/g),
  ].map((m) => ({ slug: m[1], pgId: Number(m[2]) }));
  const declared = (block.match(/\bslug:/g) || []).length;
  if (targets.length === 0 || targets.length !== declared)
    throw new Error(
      "R4_CONSOLIDATION_TARGETS : " + targets.length + " lues sur " + declared,
    );
  assertUnique(
    targets.map((t) => t.slug),
    "R4_CONSOLIDATION_TARGETS",
  );
  return targets;
}

export function parseNoindexSlugs(source) {
  const start = source.indexOf("R4_NOINDEX_SLUGS");
  const open = source.indexOf("[", start);
  const end = source.indexOf("]);", open);
  if (start < 0 || open < 0 || end < 0)
    throw new Error("R4_NOINDEX_SLUGS absent");
  const block = source.slice(open + 1, end);
  const slugs = [...block.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const lines = block.split("\n").filter((l) => l.trim().startsWith("'"));
  if (slugs.length === 0 || slugs.length !== lines.length)
    throw new Error("R4_NOINDEX_SLUGS : " + slugs.length + " lues");
  if (!slugs.every((s) => SLUG.test(s)))
    throw new Error("R4_NOINDEX_SLUGS : slug illisible");
  assertUnique(slugs, "R4_NOINDEX_SLUGS");
  return slugs;
}

export function readLists(repo) {
  const targets = parseConsolidationTargets(
    readFileSync(join(repo, CONSOLIDATION_FILE), "utf8"),
  );
  const noindex = parseNoindexSlugs(
    readFileSync(join(repo, NOINDEX_FILE), "utf8"),
  );
  const overlap = noindex.filter((s) => targets.some((t) => t.slug === s));
  if (overlap.length)
    throw new Error("listes 43 et 62 non disjointes : " + overlap.join(" "));
  return { targets, noindex };
}

// ── Flags (only the literal "true" is on, unset is off) ────────────────────

export function parseFlags(output) {
  const flags = {};
  for (const key of FLAG_KEYS) flags[key] = { raw: null, on: false };
  for (const line of output.split("\n")) {
    const eq = line.indexOf("=");
    const key = eq > 0 ? line.slice(0, eq) : "";
    if (!FLAG_KEYS.includes(key)) continue; // never keep any other line
    const raw = line.slice(eq + 1);
    flags[key] = { raw, on: raw === "true" };
  }
  return {
    consolidation: flags.SEO_R4_CONSOLIDATION_ENABLED,
    noindex: flags.SEO_R4_NOINDEX_ENABLED,
  };
}

// ── HTML readers ───────────────────────────────────────────────────────────

function attr(tag, name) {
  const m = tag.match(
    new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i"),
  );
  return m ? (m[1] ?? m[2]) : null;
}

export function metaRobots(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => (attr(tag, "name") || "").toLowerCase() === "robots")
    .map((tag) => attr(tag, "content") ?? "");
}

export function canonicalHref(html) {
  const tag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .find((t) => (attr(t, "rel") || "").toLowerCase() === "canonical");
  return tag ? attr(tag, "href") : null;
}

export function normalizeRobots(value) {
  return value
    .toLowerCase()
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
}

function hasNoindex(value) {
  return /\b(noindex|none)\b/i.test(value || "");
}

// Every /reference-auto/<slug> of the given set in the served HTML, with where
// it sits: a JSON-LD block, a breadcrumb nav, or elsewhere in the HTML (links
// and serialized router data), as the grep of ER complément 3 point 5.
export function findReferenceLinks(html, slugSet) {
  const ranges = [];
  const zones = [
    [
      /<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi,
      "JSON-LD",
    ],
    [/<nav\b[^>]*breadcrumb[^>]*>[\s\S]*?<\/nav>/gi, "fil d'Ariane"],
  ];
  for (const [re, where] of zones)
    for (const m of html.matchAll(re))
      ranges.push([m.index, m.index + m[0].length, where]);
  const hits = [];
  for (const m of html.matchAll(/\/reference-auto\/([a-z0-9-]+)/g)) {
    if (!slugSet.has(m[1])) continue;
    const zone = ranges.find(([a, b]) => m.index >= a && m.index < b);
    hits.push({ slug: m[1], where: zone ? zone[2] : "HTML" });
  }
  return hits;
}

// Card of the conseils page rendered without link (MaybeLink, mandat ER).
// The marker is a class string: a miss is an alert, never a failure.
export function hasUnlinkedR4Card(html) {
  return /<div class="flex items-start gap-3">/.test(html);
}

export function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1], ORIGIN).pathname;
    } catch {
      return m[1];
    }
  });
}

// ── Transport ──────────────────────────────────────────────────────────────

// Self-contained: its source is also what runs in the container's Node.
export async function fetchOnce(url, method) {
  const res = await fetch(url, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  const headers = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = method === "HEAD" ? "" : await res.text();
  return { status: res.status, headers, body };
}

export function httpTransport(base) {
  return (path, method) => fetchOnce(base + path, method);
}

export function dockerTransport(container) {
  return async (path, method) => {
    const source =
      "const r = await (" +
      fetchOnce.toString() +
      ")(" +
      JSON.stringify(ORIGIN + path) +
      ", " +
      JSON.stringify(method) +
      ");\nprocess.stdout.write(JSON.stringify(r));\n";
    const out = execFileSync(
      "docker",
      ["exec", "-i", container, "node", "--input-type=module"],
      {
        input: source,
        timeout: 30000,
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return JSON.parse(out.toString("utf8"));
  };
}

export function createClient({ transport, pauseMs, maxRequests, sleep }) {
  let count = 0;
  return {
    get count() {
      return count;
    },
    async get(path) {
      if (count >= maxRequests)
        throw new Error("budget de " + maxRequests + " requêtes atteint");
      if (count > 0 && pauseMs > 0) await sleep(pauseMs);
      count += 1;
      try {
        return { path, ...(await transport(path, "GET")) };
      } catch (error) {
        return { path, status: 0, headers: {}, body: "", error: error.message };
      }
    },
  };
}

// ── Docker facts (read only, not HTTP requests to the target) ──────────────

export function dockerFacts(container, exec = execFileSync) {
  const run = (args, input) =>
    exec("docker", args, {
      input,
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString("utf8");
  const flags = parseFlags(
    run(["inspect", "--format", FLAG_TEMPLATE, container]),
  );
  const startedAt = run([
    "inspect",
    "--format",
    "{{.State.StartedAt}}",
    container,
  ]).trim();
  const statSource =
    "import { statSync } from 'node:fs';\n" +
    "try { const s = statSync(" +
    JSON.stringify(SITEMAP_FILE) +
    "); console.log(JSON.stringify({ mtime: s.mtime.toISOString(), size: s.size })); }\n" +
    "catch (e) { console.log(JSON.stringify({ error: e.code || e.message })); }\n";
  let sitemapStat;
  try {
    sitemapStat = JSON.parse(
      run(["exec", "-i", container, "node", "--input-type=module"], statSource),
    );
  } catch (error) {
    sitemapStat = { error: error.message };
  }
  return { flags, startedAt, sitemapStat, dockerCommands: 3 };
}

// ── Revision ───────────────────────────────────────────────────────────────

export function gitRunner(repo) {
  return (args) => {
    const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
    return { code: r.status, stdout: (r.stdout || "").trim() };
  };
}

// A served revision different from the checkout is an alert, not a failure:
// PROD normally serves a tag older than main. It fails only when the two
// lists differ between the revisions, because the verdicts would then be
// computed against lists the served code does not use.
export function compareRevision({ served, checkout, git, fetchServed }) {
  const head =
    "révision servie " + (served || "inconnue") + ", checkout " + checkout;
  if (!served || !/^[0-9a-f]{40}$/.test(served))
    return {
      level: LEVEL.alert,
      detail:
        head + " : révision servie absente ou illisible, listes non comparées",
    };
  if (served === checkout)
    return { level: LEVEL.ok, detail: head + " : identiques" };
  const has = () => git(["cat-file", "-e", served + "^{commit}"]).code === 0;
  let present = has();
  if (!present && fetchServed) {
    git(["fetch", "--no-tags", "--depth=1", "origin", served]);
    present = has();
  }
  if (!present)
    return {
      level: LEVEL.alert,
      detail:
        head +
        " : DIFFÉRENTES ; commit servi absent du checkout, listes non comparées",
    };
  const d = git([
    "diff",
    "--quiet",
    served,
    checkout,
    "--",
    CONSOLIDATION_FILE,
    NOINDEX_FILE,
  ]);
  if (d.code === 0)
    return {
      level: LEVEL.alert,
      detail:
        head +
        " : DIFFÉRENTES ; listes des 43 et des 62 identiques aux deux révisions",
    };
  if (d.code === 1)
    return {
      level: LEVEL.fail,
      detail:
        head +
        " : DIFFÉRENTES et listes des 43 ou des 62 différentes ; relancer sur la révision servie",
    };
  return {
    level: LEVEL.alert,
    detail: head + " : DIFFÉRENTES ; comparaison des listes impossible",
  };
}

// ── Checks ─────────────────────────────────────────────────────────────────

function pathOf(value) {
  try {
    return new URL(value, ORIGIN).pathname;
  } catch {
    return value;
  }
}

function robotsOf(res) {
  return {
    meta: metaRobots(res.body || ""),
    xrt: res.headers["x-robots-tag"] || "",
  };
}

function noStore(res) {
  return /\bno-store\b/i.test(res.headers["cache-control"] || "");
}

function json(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

function worst(levels) {
  for (const l of [LEVEL.fail, LEVEL.alert, LEVEL.ok, LEVEL.na])
    if (levels.includes(l)) return l;
  return LEVEL.ok;
}

export async function runChecks({
  target,
  lists,
  facts,
  checkout,
  git,
  fetchServed = false,
  client,
}) {
  const { targets, noindex } = lists;
  const cons = facts.flags.consolidation.on;
  const noi = facts.flags.noindex.on;
  const set43 = new Set(targets.map((t) => t.slug));
  const set62 = new Set(noindex);
  const rows = [];
  const checks = [];
  const count = (levels, l) => levels.filter((x) => x === l).length;
  const row = (check, res, level, detail) => {
    const r = robotsOf(res);
    rows.push({
      check,
      url: res.path,
      status: res.status,
      location: res.headers.location || "",
      cache_control: res.headers["cache-control"] || "",
      x_robots_tag: r.xrt,
      meta_robots: r.meta.join(" | "),
      canonical: canonicalHref(res.body || "") || "",
      verdict: level,
      detail: detail || res.error || "",
    });
    return level;
  };
  const add = (id, title, levels, detail) =>
    checks.push({
      id,
      title,
      level: Array.isArray(levels) ? worst(levels) : levels,
      detail,
    });

  // 0. Flags, served revision, redirect probe
  const health = await client.get("/health");
  const served = json(health)?.revision ?? null;
  const healthLevel =
    health.status === 200 && json(health) ? LEVEL.ok : LEVEL.fail;
  row("0-health", health, healthLevel, "revision=" + served);
  const revision = compareRevision({ served, checkout, git, fetchServed });
  const probeLevels = [];
  for (const { slug } of targets) {
    const res = await client.get("/api/seo/reference/redirect/" + slug);
    const body = json(res);
    const to = body ? body.redirect_to : undefined;
    const expected = cons ? CONSEILS + slug : null;
    const ok =
      res.status === 200 && noStore(res) && body !== null && to === expected;
    probeLevels.push(
      row(
        "0-sonde",
        res,
        ok ? LEVEL.ok : LEVEL.fail,
        "redirect_to=" +
          JSON.stringify(to) +
          (noStore(res) ? "" : " ; no-store absent"),
      ),
    );
  }
  add(
    "0",
    "Drapeaux, révision servie, sonde de redirection",
    [healthLevel, revision.level, ...probeLevels],
    "consolidation=" +
      (facts.flags.consolidation.raw ?? "(absent)") +
      " → " +
      (cons ? "on" : "off") +
      " ; noindex=" +
      (facts.flags.noindex.raw ?? "(absent)") +
      " → " +
      (noi ? "on" : "off") +
      " ; /health " +
      health.status +
      " ; sonde conforme " +
      count(probeLevels, LEVEL.ok) +
      "/" +
      targets.length +
      " (attendu : no-store et redirect_to " +
      (cons ? "= /blog-pieces-auto/conseils/<slug>" : "= null") +
      ")",
  );

  // 1. The 43 R4 pages
  const r4Levels = [];
  for (const { slug } of targets) {
    const res = await client.get(REFERENCE + slug);
    let ok;
    let detail = "";
    if (cons) {
      ok =
        res.status === 301 &&
        pathOf(res.headers.location || "") === CONSEILS + slug &&
        noStore(res);
      if (res.status === 301 && !noStore(res))
        detail = "no-store absent sur la 301";
    } else {
      ok = res.status === 200 && !res.headers.location;
    }
    r4Levels.push(row("1-r4-43", res, ok ? LEVEL.ok : LEVEL.fail, detail));
  }
  add(
    "1",
    cons
      ? "Les 43 en 301 vers /blog-pieces-auto/conseils/<slug>, no-store"
      : "Les 43 en 200 sans redirection (drapeau éteint)",
    r4Levels,
    count(r4Levels, LEVEL.ok) + "/" + targets.length + " conformes",
  );

  // 2. The 43 targets: one hop, 200, indexable
  const targetPages = [];
  if (cons) {
    const tLevels = [];
    for (const { slug } of targets) {
      const res = await client.get(CONSEILS + slug);
      const r = robotsOf(res);
      const problems = [];
      if (res.status >= 300 && res.status < 400) problems.push("deuxième saut");
      else if (res.status !== 200) problems.push("HTTP " + res.status);
      if (r.meta.some(hasNoindex)) problems.push("meta noindex");
      if (hasNoindex(r.xrt)) problems.push("X-Robots-Tag noindex");
      tLevels.push(
        row(
          "2-cible",
          res,
          problems.length ? LEVEL.fail : LEVEL.ok,
          problems.join(", "),
        ),
      );
      targetPages.push({ slug, res });
    }
    add(
      "2",
      "Les 43 cibles en 200, un seul saut, sans noindex",
      tLevels,
      count(tLevels, LEVEL.ok) + "/" + targets.length + " conformes",
    );
  } else {
    add(
      "2",
      "Les 43 cibles",
      LEVEL.na,
      "drapeau de consolidation éteint : aucune redirection attendue",
    );
  }

  // 3. Other published pages and the hub
  const list = await client.get("/api/seo/reference");
  const listed = Array.isArray(json(list)?.references)
    ? json(list).references
    : [];
  const published = listed.map((r) => r.slug).filter((s) => SLUG.test(s));
  const listLevel =
    list.status === 200 && published.length ? LEVEL.ok : LEVEL.fail;
  row(
    "3-liste",
    { ...list, body: "" },
    listLevel,
    published.length + " publiées",
  );
  const others = published.filter((s) => !set43.has(s));
  const otherPages = [];
  const oLevels = [];
  for (const slug of others) {
    const res = await client.get(REFERENCE + slug);
    const ok = res.status === 200 && !res.headers.location;
    oLevels.push(row("3-autre", res, ok ? LEVEL.ok : LEVEL.fail, ""));
    otherPages.push({ slug, res });
  }
  const hub = await client.get("/reference-auto");
  const hubLevel =
    hub.status === 200 && !hub.headers.location ? LEVEL.ok : LEVEL.fail;
  row("3-hub", hub, hubLevel, "");
  add(
    "3",
    "Autres fiches publiées en 200 sans redirection, hub en 200 sans Location",
    [listLevel, hubLevel, ...oLevels],
    published.length +
      " publiées dans /api/seo/reference, dont " +
      published.filter((s) => set43.has(s)).length +
      "/" +
      targets.length +
      " des 43 ; autres conformes " +
      count(oLevels, LEVEL.ok) +
      "/" +
      others.length +
      " ; hub " +
      hub.status,
  );

  // 4. Sitemap (read only, no regeneration)
  const sm = await client.get("/sitemap-reference.xml");
  const stat = facts.sitemapStat || {};
  const how =
    "lu par GET /sitemap-reference.xml à l'origine (SitemapStaticMiddleware, fichier placé " +
    SITEMAP_FILE +
    ", date par stat dans " +
    TARGETS[target].container +
    ")";
  let smLevel;
  let smDetail;
  if (sm.status !== 200) {
    smLevel = LEVEL.alert;
    smDetail = "sitemap non servi (HTTP " + sm.status + ") ; " + how;
  } else {
    const pset = new Set(sitemapPaths(sm.body));
    const locs = sitemapPaths(sm.body).length;
    const p43 = targets.filter((t) => pset.has(REFERENCE + t.slug)).length;
    const p62 = noindex.filter((s) => pset.has(REFERENCE + s)).length;
    const pub = new Set(published);
    const expected =
      published.length -
      (cons ? targets.filter((t) => pub.has(t.slug)).length : 0) -
      (noi ? noindex.filter((s) => pub.has(s)).length : 0);
    const fresh = Boolean(
      stat.mtime &&
      facts.startedAt &&
      Date.parse(stat.mtime) >= Date.parse(facts.startedAt),
    );
    const facts4 =
      locs +
      " <loc> (attendu après régénération : " +
      expected +
      ") ; 43 présentes " +
      p43 +
      "/" +
      targets.length +
      " ; 62 présentes " +
      p62 +
      "/" +
      noindex.length +
      " ; fichier du " +
      (stat.mtime || "inconnu (" + (stat.error || "stat") + ")") +
      ", conteneur démarré " +
      (facts.startedAt || "inconnu");
    if (!fresh) {
      smLevel = LEVEL.alert;
      smDetail = "non régénéré ; " + facts4 + " ; " + how;
    } else {
      const bad = [];
      if (cons && p43 > 0) bad.push(p43 + " des 43 encore listées");
      if (noi && p62 > 0) bad.push(p62 + " des 62 encore listées");
      smLevel = bad.length ? LEVEL.fail : LEVEL.ok;
      smDetail = [...bad, facts4, how].join(" ; ");
    }
  }
  row("4-sitemap", { ...sm, body: "" }, smLevel, smDetail);
  add("4", "Sitemap des fiches R4", smLevel, smDetail);

  // 5. Internal links, JSON-LD, breadcrumbs (consolidation on only)
  if (cons) {
    const pages = [{ kind: "hub", res: hub }];
    for (const t of targetPages)
      pages.push({ kind: "R3", res: t.res, ownSlug: t.slug });
    for (const o of otherPages.slice(0, OTHER_PAGES_FOR_LINKS))
      pages.push({ kind: "R4", res: o.res });
    const r1Urls = listed
      .filter(
        (r) =>
          set43.has(r.slug) &&
          /^\/pieces\/[a-z0-9-]+\.html$/.test(r.gamme?.url || ""),
      )
      .slice(0, SAMPLE)
      .map((r) => r.gamme.url);
    for (const u of r1Urls)
      pages.push({ kind: "R1", res: await client.get(u), sample: true });
    for (const t of targets.slice(0, SAMPLE))
      pages.push({
        kind: "R6",
        res: await client.get("/blog-pieces-auto/guide-achat/" + t.slug),
        sample: true,
      });
    const featured = await client.get(
      "/api/seo/diagnostic/featured?limit=" + SAMPLE,
    );
    const r5 = (Array.isArray(json(featured)?.data) ? json(featured).data : [])
      .map((d) => d.slug)
      .filter((s) => typeof s === "string" && SLUG.test(s))
      .slice(0, SAMPLE);
    row(
      "5-r5-liste",
      { ...featured, body: "" },
      r5.length ? LEVEL.ok : LEVEL.alert,
      r5.length + " diagnostics",
    );
    for (const s of r5)
      pages.push({
        kind: "R5",
        res: await client.get("/diagnostic-auto/" + s),
        sample: true,
      });
    const lLevels = [];
    let cardMissing = 0;
    for (const p of pages) {
      if (p.res.status !== 200) {
        // Samples answering 3xx/404 are reported, the listed pages already
        // failed in checks 2 and 3.
        const lvl = p.sample ? LEVEL.alert : LEVEL.fail;
        lLevels.push(
          p.sample
            ? row(
                "5-" + p.kind,
                p.res,
                lvl,
                "page non lue (HTTP " + p.res.status + ")",
              )
            : lvl,
        );
        continue;
      }
      const hits = findReferenceLinks(p.res.body, set43);
      let lvl = hits.length ? LEVEL.fail : LEVEL.ok;
      let detail = hits.map((h) => h.slug + " @ " + h.where).join(" ; ");
      if (p.ownSlug && !hasUnlinkedR4Card(p.res.body)) {
        cardMissing += 1;
        detail += (detail ? " ; " : "") + "encart sans lien non détecté";
        if (lvl === LEVEL.ok) lvl = LEVEL.alert;
      }
      lLevels.push(
        p.sample || lvl !== LEVEL.ok
          ? row("5-" + p.kind, p.res, lvl, detail)
          : lvl,
      );
    }
    add(
      "5",
      "Liens internes, JSON-LD et fils d'Ariane sans /reference-auto/<l'une des 43>",
      lLevels,
      pages.length +
        " pages lues (hub, " +
        targetPages.length +
        " R3 cibles, " +
        Math.min(OTHER_PAGES_FOR_LINKS, otherPages.length) +
        " R4, " +
        r1Urls.length +
        " R1, " +
        SAMPLE +
        " R6, " +
        r5.length +
        " R5) ; conformes (aucun lien vers les 43, encart présent) : " +
        count(lLevels, LEVEL.ok) +
        " ; avec lien vers les 43 : " +
        count(lLevels, LEVEL.fail) +
        " ; encart sans lien non détecté sur " +
        cardMissing +
        " cible(s)",
    );
  } else {
    add(
      "5",
      "Liens internes, JSON-LD et fils d'Ariane",
      LEVEL.na,
      "drapeau de consolidation éteint : les liens vers les 43 restent attendus",
    );
  }

  // 6. Noindex posture (EW controls)
  const nLevels = [];
  let read62 = 0;
  for (const { slug, res } of otherPages) {
    if (res.status !== 200) continue; // already a failure in check 3
    const r = robotsOf(res);
    const problems = [];
    if (noi && set62.has(slug)) {
      read62 += 1;
      if (
        !(
          r.meta.length === 1 &&
          normalizeRobots(r.meta[0]) === "noindex, follow"
        )
      )
        problems.push("meta robots ≠ « noindex, follow »");
      if (r.xrt) problems.push("X-Robots-Tag présent");
      const canon = canonicalHref(res.body);
      if (!canon || pathOf(canon) !== REFERENCE + slug)
        problems.push("canonique " + canon);
    } else {
      if (r.meta.some(hasNoindex)) problems.push("meta noindex hors liste");
      if (hasNoindex(r.xrt)) problems.push("X-Robots-Tag noindex hors liste");
    }
    nLevels.push(
      problems.length
        ? row("6-noindex", res, LEVEL.fail, problems.join(", "))
        : LEVEL.ok,
    );
  }
  const unlisted62 = noindex.filter((s) => !published.includes(s));
  if (unlisted62.length) nLevels.push(LEVEL.alert);
  const robots = await client.get("/robots.txt");
  const disallow = /^\s*disallow:\s*\/reference-auto\b/im.test(robots.body);
  let robotsLevel = LEVEL.ok;
  if (robots.status !== 200) robotsLevel = LEVEL.alert;
  else if (disallow) robotsLevel = noi ? LEVEL.fail : LEVEL.alert;
  row(
    "6-robots.txt",
    { ...robots, body: "" },
    robotsLevel,
    disallow ? "Disallow sur /reference-auto" : "",
  );
  add(
    "6",
    noi
      ? "Les 62 en « noindex, follow », canonique propre ; aucune autre fiche en noindex"
      : "Aucune fiche en noindex (drapeau éteint)",
    [...nLevels, robotsLevel],
    (noi ? read62 + " des 62 lues ; " : "") +
      "fiches sans écart " +
      count(nLevels, LEVEL.ok) +
      "/" +
      otherPages.length +
      (unlisted62.length
        ? " ; " + unlisted62.length + " des 62 absentes de la liste publiée"
        : "") +
      " ; robots.txt " +
      robots.status +
      (disallow ? " avec Disallow /reference-auto" : ""),
  );

  return {
    target,
    container: TARGETS[target].container,
    flags: facts.flags,
    revision,
    served,
    checkout,
    checks,
    rows,
    requests: client.count,
    dockerCommands: facts.dockerCommands || 0,
    failed: checks.some((c) => c.level === LEVEL.fail),
  };
}

// ── Output ─────────────────────────────────────────────────────────────────

export const NOT_COVERED = [
  "Code servi pour les 8 fiches non publiées (ER, vérif. 3) : aucune API publique en GET ne donne leurs slugs.",
  "Fiche non publiée, gamme sans alias, cible absente ou noindex (ER, vérif. 2) : absents des données ; couverts par les tests unitaires de computeR4Redirects.",
  "Caddy et Cloudflare : la lecture se fait à l'origine, dans le conteneur (127.0.0.1:3000) ; en PROD, Caddy sert aussi /sitemap*.xml depuis le même dossier.",
  "Régénération du sitemap (POST) : exclue ; un fichier antérieur au démarrage du conteneur est dit « non régénéré ».",
  "Caches navigateur et CDN après bascule (fenêtre de 10 min acceptée) : hors d'une lecture ponctuelle.",
];

// A GitHub table cell: escape the backslash first, so that a detail ending in
// « \ » cannot turn the escaped pipe that follows into a column separator,
// then the pipe; a line break would end the row, so it becomes a space.
export function markdownCell(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n|[\r\n]/g, " ");
}

export function renderSummary(result) {
  const icon = (l) => (l === LEVEL.ok ? "✅" : l === LEVEL.fail ? "❌" : "⚠️");
  const lines = [
    "## Contrôle R4 servi — cible " +
      result.target +
      " (" +
      result.container +
      ")",
    "",
    icon(result.revision.level) + " **Révision** : " + result.revision.detail,
    "",
    "Drapeaux lus dans le conteneur : SEO_R4_CONSOLIDATION_ENABLED → " +
      (result.flags.consolidation.on ? "on" : "off") +
      ", SEO_R4_NOINDEX_ENABLED → " +
      (result.flags.noindex.on ? "on" : "off") +
      " (seul le littéral « true » vaut on).",
    "",
    "Requêtes GET envoyées : **" +
      result.requests +
      "**, une à la fois, pause de " +
      result.pauseMs +
      " ms ; commandes docker de lecture : " +
      result.dockerCommands +
      ".",
    "",
    "| # | Vérification | Verdict | Détail |",
    "|---|---|---|---|",
    ...result.checks.map(
      (c) =>
        "| " +
        c.id +
        " | " +
        markdownCell(c.title) +
        " | " +
        icon(c.level) +
        " " +
        c.level +
        " | " +
        markdownCell(c.detail) +
        " |",
    ),
    "",
    "Non couvert :",
    ...NOT_COVERED.map((n) => "- " + n),
    "",
    result.failed
      ? "**Verdict : ÉCHEC, posture servie différente des drapeaux lus**"
      : "**Verdict : posture servie conforme aux drapeaux lus**",
  ];
  return lines.join("\n") + "\n";
}

const CSV_COLUMNS = [
  "check",
  "url",
  "status",
  "location",
  "cache_control",
  "x_robots_tag",
  "meta_robots",
  "canonical",
  "verdict",
  "detail",
];

export function renderCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return (
    [
      CSV_COLUMNS.join(","),
      ...rows.map((r) => CSV_COLUMNS.map((k) => cell(r[k])).join(",")),
    ].join("\n") + "\n"
  );
}

// ── CLI ────────────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  const opts = { repo: process.cwd(), fetchServed: false, transport: "docker" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(a + " sans valeur");
      i += 1;
      return argv[i];
    };
    if (a === "--target") opts.target = value();
    else if (a === "--repo") opts.repo = value();
    else if (a === "--summary") opts.summary = value();
    else if (a === "--csv") opts.csv = value();
    else if (a === "--pause-ms") opts.pauseMs = Number(value());
    else if (a === "--fetch-served-revision") opts.fetchServed = true;
    else if (a === "--transport") opts.transport = value();
    else if (a === "--base") opts.base = value();
    else throw new Error("argument inconnu : " + a);
  }
  if (!Object.hasOwn(TARGETS, opts.target || ""))
    throw new Error("--target preprod|prod requis");
  if (opts.transport !== "docker" && opts.transport !== "http")
    throw new Error("--transport docker|http");
  // The http transport exists for the local simulation only.
  if (
    opts.transport === "http" &&
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(opts.base || "")
  )
    throw new Error("--transport http exige --base http://127.0.0.1:<port>");
  const min = TARGETS[opts.target].pauseMs;
  opts.pauseMs = Number.isFinite(opts.pauseMs)
    ? Math.max(min, opts.pauseMs)
    : min;
  return opts;
}

export async function main(argv) {
  const opts = parseArgs(argv);
  const repo = resolve(opts.repo);
  const container = TARGETS[opts.target].container;
  const stop = (message, count) => {
    const line =
      "❌ Contrôle interrompu : " +
      String(message).replace(/\s+/g, " ").trim() +
      " (" +
      count +
      " requêtes)\n";
    process.stderr.write(line);
    if (opts.summary) appendFileSync(opts.summary, line);
    return 1;
  };
  let lists;
  let facts;
  try {
    lists = readLists(repo);
    facts = dockerFacts(container);
  } catch (error) {
    // Lists or flags unreadable: no posture can be expected, no request sent.
    return stop(error.message, 0);
  }
  const git = gitRunner(repo);
  const checkout = git(["rev-parse", "HEAD"]).stdout;
  const client = createClient({
    transport:
      opts.transport === "http"
        ? httpTransport(opts.base)
        : dockerTransport(container),
    pauseMs: opts.pauseMs,
    maxRequests: MAX_REQUESTS,
    sleep: (ms) => delay(ms),
  });
  let result;
  try {
    result = await runChecks({
      target: opts.target,
      lists,
      facts,
      checkout,
      git,
      fetchServed: opts.fetchServed,
      client,
    });
  } catch (error) {
    return stop(error.message, client.count);
  }
  result.pauseMs = opts.pauseMs;
  const summary = renderSummary(result);
  process.stdout.write(summary);
  if (opts.summary) appendFileSync(opts.summary, summary);
  if (opts.csv) writeFileSync(opts.csv, renderCsv(result.rows));
  return result.failed ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(error.message + "\n");
      process.exitCode = 1;
    },
  );
}
