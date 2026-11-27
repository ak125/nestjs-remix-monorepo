// Mesure labo mobile (mandat DU) — même profil que outils/measure.cjs de DS (PR #2210) :
// CPU x4, RTT 150 ms, 1 638,4 kb/s down, 675 kb/s up, DPR 1.75, cache désactivé, POST bloqués.
// Ajouts : viewport paramétrable, taille et position de l'élément LCP, mode « scroll » (défilement
// programmatique de 900 px à FCP + 300 ms, pour voir un décalage tardif sous le premier écran).
// Usage : node measure-du.cjs <url> <label> <out.json> <width> <height> [scroll=0] [runs=3]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const [, , url, label, out, W, H, scrollArg = "0", runsArg = "3"] = process.argv;
const RUNS = Number(runsArg);
const SCROLL = scrollArg === "1";

const INIT = () => {
  window.__m = { lcp: 0, lcpEl: "", lcpSize: 0, lcpTop: null, shifts: [], long: [], fcp: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__m.lcp = e.startTime;
      window.__m.lcpSize = e.size;
      window.__m.lcpEl = (e.element && (e.element.tagName + "." + String(e.element.className).slice(0, 50))) || e.url || "";
      window.__m.lcpTop = e.element ? Math.round(e.element.getBoundingClientRect().top) : null;
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.shifts.push([e.startTime, e.value]); }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime; }).observe({ type: "paint", buffered: true });
};
function cls(shifts) {
  let max = 0, cur = 0, start = -1, prev = -1;
  for (const [t, v] of shifts) {
    if (start < 0 || t - prev > 1000 || t - start > 5000) { cur = 0; start = t; }
    cur += v; prev = t; max = Math.max(max, cur);
  }
  return max;
}
function tbt(long, fcp) {
  const after = long.filter(([s]) => s >= fcp).sort((a, b) => a[0] - b[0]);
  let tti = fcp;
  for (const [s, d] of after) { if (s - tti >= 5000) break; tti = Math.max(tti, s + d); }
  return after.filter(([s]) => s < tti).reduce((acc, [, d]) => acc + Math.max(0, d - 50), 0);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 mandat-du-measure",
    });
    await ctx.route("**/*", (route) => {
      const r = route.request();
      if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
      return route.continue();
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    const nav = page.goto(url, { waitUntil: "load", timeout: 120000 });
    if (SCROLL) {
      await page.waitForFunction(() => window.__m && window.__m.fcp > 0, null, { timeout: 60000, polling: 50 });
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollBy(0, 900));
    }
    const resp = await nav;
    await page.waitForTimeout(8000);
    const m = await page.evaluate(() => window.__m);
    results.push({ run: i + 1, status: resp.status(), loadMs: Date.now() - t0, fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), lcpEl: m.lcpEl, lcpSize: Math.round(m.lcpSize), lcpTop: m.lcpTop, cls: Number(cls(m.shifts).toFixed(4)), shifts: m.shifts.length, tbt: Math.round(tbt(m.long, m.fcp)), longtasks: m.long.length });
    await browser.close();
    console.log(label, JSON.stringify(results[results.length - 1]));
  }
  const summary = { label, url, viewport: `${W}x${H}`, scroll: SCROLL, at: new Date().toISOString(), runs: results, median: { lcp: median(results.map((r) => r.lcp)), cls: median(results.map((r) => r.cls)), tbt: median(results.map((r) => r.tbt)), fcp: median(results.map((r) => r.fcp)) } };
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(label, "MEDIAN", JSON.stringify(summary.median));
})().catch((e) => { console.error(e); process.exit(1); });
