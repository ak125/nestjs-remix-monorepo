// Read-only, bounded PREPROD observation. Timings are evidence, not budgets.
// Compare exit motion on the SAME image; this does not reconstruct an old build.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { waitForRateBudget } from "./preprod-e2e-rate-budget.mjs";
import { THROTTLER_TIERS } from "../../backend/src/config/throttler-tiers.config.ts";

const require = createRequire(
  new URL("../../frontend/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const base = "http://localhost:3200";
const revision = process.env.GITHUB_SHA;
assert.match(revision || "", /^[a-f0-9]{40}$/);
const route =
  "/pieces/plaquette-de-frein-402/chevrolet-44/cruze-iii-j305-44088/1-6-57414.html";
const output = "output/catalog-mobile-performance";
mkdirSync(output, { recursive: true });
const control = `.modal-pop:not([open]){transition:opacity .2s ease,scale .2s ease,overlay .2s ease allow-discrete,display .2s ease allow-discrete}.modal-pop:not([open])::backdrop{transition:opacity .2s ease,overlay .2s ease allow-discrete,display .2s ease allow-discrete}`;
const result = {
  revision,
  base,
  route,
  conditions: {
    width: 390,
    height: 844,
    dpr: 1,
    cpu: 4,
    latency: 150,
    download: 200000,
    upload: 93750,
    cache: "disabled and cleared",
    warmup: "one excluded open/close per variant",
    settle: "hydration + 4s; detail + 1200ms",
    comparison: "same image, restored exit CSS versus candidate",
    frames: "separate from CPU samples",
  },
  runs: [],
  errors: [],
};
const save = () =>
  writeFileSync(`${output}/measurements.json`, JSON.stringify(result, null, 2));
let browser;
let previousUptime = -1;
async function health() {
  const response = await fetch(`${base}/health`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.revision, revision, "PREPROD revision changed");
  assert.ok(
    Number.isFinite(data.uptime) && data.uptime >= previousUptime,
    "PREPROD restarted",
  );
  previousUptime = data.uptime;
  return { revision: data.revision, uptime: data.uptime };
}
try {
  result.healthBefore = await health();
  browser = await chromium.launch({ headless: true });
  result.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  });
  page.on("pageerror", (error) => result.errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      result.errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  await page.route("**/api/**", (r) =>
    r.request().method() === "GET"
      ? r.continue()
      : r.fulfill({ status: 204, body: "" }),
  );
  await page.addInitScript(() => {
    window.__measure = { events: [], lcp: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.interactionId)
          window.__measure.events.push({
            name: e.name,
            start: e.startTime,
            duration: e.duration,
            id: e.interactionId,
          });
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__measure.lcp.push(e.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Performance.enable");
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map((e) => [
        e.name,
        e.value,
      ]),
    );
  const card = () =>
    page.locator('[aria-label^="Voir "][role="button"]').first();
  async function tap(locator) {
    const box = await locator.boundingBox();
    assert.ok(box);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  // AB/BA pairs, then separate visual samples (computed style probes affect CPU).
  const sequence = [
    "control",
    "candidate",
    "control",
    "candidate",
    "candidate",
    "control",
    "control",
    "candidate",
    "candidate",
    "control",
    "control",
    "candidate",
    "candidate",
    "control",
  ];
  for (const [i, variant] of sequence.entries()) {
    await waitForRateBudget({
      tiers: THROTTLER_TIERS.map(({ name, ttl }) => ({ name, ttl })),
      probe: async () => {
        const r = await fetch(`${base}/`, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        return { status: r.status, headers: Object.fromEntries(r.headers) };
      },
    });
    const beforeHealth = await health();
    await page.goto("about:blank");
    await cdp.send("Network.clearBrowserCache");
    const response = await page.goto(base + route, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    assert.equal(response.status(), 200);
    await page.waitForFunction(
      () => performance.getEntriesByName("aut:hydration-commit").length > 0,
    );
    await page.waitForTimeout(4000);
    const navigation = await page.evaluate(() => ({
      hydration: performance.getEntriesByName("aut:hydration-commit")[0]
        .startTime,
      lcp: window.__measure.lcp.at(-1),
      resources: performance
        .getEntriesByType("resource")
        .filter((e) => /\.(js|css)(\?|$)/.test(e.name))
        .map((e) => ({
          name: e.name,
          encoded: e.encodedBodySize,
          protocol: e.nextHopProtocol,
        })),
    }));
    if (variant === "control") await page.addStyleTag({ content: control });
    await card().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const names = await page
      .locator('[aria-label^="Voir "][role="button"]')
      .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label")));
    if (result.names)
      assert.deepEqual(names, result.names, "Catalog sample changed");
    else result.names = names;
    const openStart = await page.evaluate(() => performance.now());
    await tap(card());
    await page.locator("dialog[open] h2").waitFor();
    await page.waitForTimeout(1200);
    const sampleFrames = i >= 10;
    const m0 = await metrics();
    const start = await page.evaluate((sample) => {
      window.__frames = [];
      const origin = performance.now();
      function frame(t) {
        const d = document.querySelector("dialog.modal-pop");
        window.__frames.push({
          time: t - origin,
          open: d.open,
          display: getComputedStyle(d).display,
        });
        if (t - origin < 650) requestAnimationFrame(frame);
      }
      if (sample) requestAnimationFrame(frame);
      return origin;
    }, sampleFrames);
    await tap(page.locator('dialog[open] button[aria-label="Fermer"]'));
    await page.waitForTimeout(800);
    const m1 = await metrics();
    const cpu = Object.fromEntries(
      [
        "TaskDuration",
        "ScriptDuration",
        "LayoutDuration",
        "RecalcStyleDuration",
        "LayoutCount",
        "RecalcStyleCount",
      ].map((k) => [
        k,
        +((m1[k] - m0[k]) * (k.endsWith("Duration") ? 1000 : 1)).toFixed(2),
      ]),
    );
    const after = await page.evaluate(
      ({ start, openStart }) => {
        const d = document.querySelector("dialog.modal-pop");
        return {
          events: window.__measure.events.filter((e) => e.start >= start),
          openEvents: window.__measure.events.filter(
            (e) => e.start >= openStart && e.start < start,
          ),
          frames: window.__frames,
          open: d.open,
          display: getComputedStyle(d).display,
          overflow: document.body.style.overflow,
          focus: document.activeElement?.getAttribute("aria-label"),
        };
      },
      { start, openStart },
    );
    assert.equal(after.open, false);
    assert.equal(after.display, "none");
    assert.equal(after.overflow, "");
    assert.match(after.focus || "", /^Voir /);
    const afterHealth = await health();
    result.runs.push({
      i,
      variant,
      excludedWarmup: i < 2,
      sampleFrames,
      navigation,
      cpu,
      beforeHealth,
      afterHealth,
      ...after,
    });
    assert.deepEqual(result.errors, []);
    save();
    console.log(JSON.stringify({ i, variant, sampleFrames, cpu }));
  }
  result.healthAfter = await health();
  result.status = "complete";
} catch (error) {
  result.status = "failed";
  result.failure = error.stack;
  process.exitCode = 1;
} finally {
  save();
  await browser?.close();
}
