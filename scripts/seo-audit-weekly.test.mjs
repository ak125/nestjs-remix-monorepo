/**
 * Behavioural proof of the sitemap download step of `seo-audit-weekly.sh`.
 *
 * The weekly SEO audit failed three Mondays in a row on DEV with an empty
 * stderr: `curl -s` without timeout, under `set -e`, killed the script on an
 * unreachable host after the kernel's TCP timeout (~2 min), and an HTTP error
 * page was audited as if it were a sitemap. These tests EXECUTE the script
 * against a local HTTP server (no external call) and assert that:
 *
 *   1. an unreachable host stops the audit with exit 2, the cause on stderr and
 *      an `error` state recorded through `cron_report`;
 *   2. an HTTP error (404) stops the audit instead of auditing the error page;
 *   3. an empty body stops the audit;
 *   4. a reachable sitemap index still runs the whole audit and writes its
 *      report (nominal path unchanged).
 *
 * Run: node --test scripts/seo-audit-weekly.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "seo-audit-weekly.sh",
);

let server;
let base;

const PAGES = {
  "/sitemap-index.xml": () =>
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${base}/sitemap-child.xml</loc></sitemap></sitemapindex>`,
  "/sitemap-child.xml": () =>
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/page-a.html</loc></url></urlset>`,
  "/page-a.html": () =>
    `<html><head><link rel="canonical" href="${base}/page-a.html"></head><body>ok</body></html>`,
  "/empty.xml": () => "",
};

before(async () => {
  server = createServer((req, res) => {
    const page = PAGES[req.url];
    if (!page) {
      res.writeHead(404, { "content-type": "text/html" });
      res.end("<html><body>404 Not Found</body></html>");
      return;
    }
    res.writeHead(200, { "content-type": "application/xml" });
    res.end(page());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

/** Runs the script asynchronously so the in-process server keeps answering. */
function runAudit(sitemapUrl) {
  const dir = mkdtempSync(join(tmpdir(), "seo-audit-test-"));
  const env = {
    ...process.env,
    SITEMAP_URL: sitemapUrl,
    BASE_URL: base,
    OUTPUT_DIR: join(dir, "out"),
    CRON_STATE_DIR: join(dir, "state"),
    // Refused port: the Loki step must not reach any real service.
    LOKI_URL: "http://127.0.0.1:9",
    MEILISEARCH_HOST: "http://127.0.0.1:9",
    SEO_AUDIT_WEBHOOK_URL: "",
  };
  return new Promise((resolve) => {
    execFile(
      "bash",
      [SCRIPT],
      { env, timeout: 120_000 },
      (error, stdout, stderr) => {
        const statePath = join(dir, "state", "seo-audit.json");
        resolve({
          code: error ? error.code : 0,
          stdout,
          stderr,
          outDir: join(dir, "out"),
          state: existsSync(statePath)
            ? JSON.parse(readFileSync(statePath, "utf8"))
            : null,
        });
      },
    );
  });
}

describe("seo-audit-weekly.sh — sitemap download", () => {
  test("unreachable host: exit 2, cause on stderr, error state recorded", async () => {
    const r = await runAudit("http://127.0.0.1:9/sitemap.xml");
    assert.equal(r.code, 2);
    assert.match(r.stderr, /curl: \(7\)/);
    assert.match(
      r.stderr,
      /sitemap indisponible \(http:\/\/127\.0\.0\.1:9\/sitemap\.xml\)/,
    );
    assert.equal(r.state?.status, "error");
    assert.equal(r.state?.metrics?.sitemap_available, false);
    assert.equal(existsSync(join(r.outDir, "audit-report.json")), false);
  });

  test("HTTP 404: the error page is not audited", async () => {
    const r = await runAudit(`${base}/missing.xml`);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /curl: \(22\)/);
    assert.match(r.stderr, /sitemap indisponible/);
    assert.equal(existsSync(join(r.outDir, "sitemap-urls.txt")), false);
  });

  test("empty body: exit 2", async () => {
    const r = await runAudit(`${base}/empty.xml`);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /sitemap indisponible/);
    assert.equal(r.state?.status, "error");
  });

  test("reachable sitemap index: the full audit runs and writes its report", async () => {
    const r = await runAudit(`${base}/sitemap-index.xml`);
    assert.doesNotMatch(r.stderr, /sitemap indisponible/);
    const report = JSON.parse(
      readFileSync(join(r.outDir, "audit-report.json"), "utf8"),
    );
    assert.equal(
      readFileSync(join(r.outDir, "sitemap-urls.txt"), "utf8").trim(),
      `${base}/page-a.html`,
    );
    assert.ok(report, "audit-report.json written");
    assert.ok(r.state && ["ok", "warn", "error"].includes(r.state.status));
    assert.notEqual(r.state.summary, "sitemap indisponible");
  });
});
