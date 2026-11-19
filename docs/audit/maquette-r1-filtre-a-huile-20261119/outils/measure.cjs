// Mesure labo mobile (mandat DS) — protocole aligné sur le profil « mobile » de Lighthouse 12,
// faute de Lighthouse installable (hook npm install). Usage : node measure.cjs <url> <label> <out.json> [runs=3]
// Bridage : CPU x4, RTT 150 ms, 1 638,4 kb/s down, 675 kb/s up (devtools), écran 412x823 DPR 1.75.
// LCP : largest-contentful-paint ; CLS : somme des layout-shift sans input récent (session max 5 s/1 s) ;
// TBT : somme (durée-50 ms) des longtasks entre FCP et TTI approché (fin de fenêtre quiet 5 s ou 25 s max).
const fs = require("node:fs");
const { chromium } = require("/home/deploy/worktrees/claude-ds-maquette-r1-20261119/node_modules/playwright");
const [, , url, label, out, runsArg = "3"] = process.argv;
const RUNS = Number(runsArg);

const INIT = () => {
  window.__m = { lcp: 0, lcpEl: "", shifts: [], long: [], fcp: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__m.lcp = e.startTime; window.__m.lcpEl = (e.element && (e.element.tagName + "." + String(e.element.className).slice(0, 60))) || e.url || ""; } }).observe({ type: "largest-contentful-paint", buffered: true });
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
  // TTI approché : début de la première fenêtre de 5 s sans longtask après FCP
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
      viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 mandat-ds-measure",
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
    const resp = await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(8000); // fenêtre quiet pour longtasks/CLS tardifs
    const m = await page.evaluate(() => window.__m);
    results.push({ run: i + 1, status: resp.status(), loadMs: Date.now() - t0, fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), lcpEl: m.lcpEl, cls: Number(cls(m.shifts).toFixed(4)), tbt: Math.round(tbt(m.long, m.fcp)), longtasks: m.long.length });
    await browser.close();
    console.log(label, JSON.stringify(results[results.length - 1]));
  }
  const summary = { label, url, at: new Date().toISOString(), runs: results, median: { lcp: median(results.map((r) => r.lcp)), cls: median(results.map((r) => r.cls)), tbt: median(results.map((r) => r.tbt)), fcp: median(results.map((r) => r.fcp)) } };
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(label, "MEDIAN", JSON.stringify(summary.median));
})().catch((e) => { console.error(e); process.exit(1); });
