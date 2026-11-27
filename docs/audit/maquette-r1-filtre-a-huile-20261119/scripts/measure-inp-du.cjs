// INP de labo (mandat DU) : même bridage que measure-du.cjs (CPU x4, RTT 150 ms, 412x823, DPR 1.75).
// Après chargement + 10 s (hydratation), quatre touchers réels (page.tap) :
//   1. onglet « Type Mine » du sélecteur (hero)
//   2. premier bouton de la navigation rapide (« Compatibilité »)
//   3. bouton « Voir les N autres compatibilités » (#reference)
//   4. première question de la FAQ
// Mesure : durée max des entrées Event Timing (durationThreshold 16 ms) par interactionId.
// Usage : node measure-inp-du.cjs <url> <out.json> [runs=3]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const [, , url, out, runsArg = "3"] = process.argv;
const RUNS = Number(runsArg);
const INIT = () => {
  window.__ev = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ id: e.interactionId, name: e.name, d: e.duration, t: e.startTime }); })
    .observe({ type: "event", buffered: true, durationThreshold: 16 });
};
const STEPS = [
  ["tab-type-mine", (p) => p.locator('[role="tablist"] button').nth(1)],
  ["quicknav-1", (p) => p.locator('nav[aria-label="Navigation rapide"] button').first()],
  ["voir-autres", (p) => p.locator("#reference button", { hasText: "autres compatibilités" }).first()],
  ["faq-1", (p) => p.locator("#faq button").first()],
];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
(async () => {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 mandat-du-measure" });
    await ctx.route("**/*", (route) => {
      const r = route.request();
      if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
      return route.continue();
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(10000);
    const res = {};
    for (const [name, loc] of STEPS) {
      const before = await page.evaluate(() => window.__ev.length);
      try {
        const el = loc(page);
        await el.scrollIntoViewIfNeeded({ timeout: 15000 });
        await page.waitForTimeout(800);
        const box = await el.boundingBox();
        await el.tap({ timeout: 15000 });
        await page.waitForTimeout(1500);
        const evs = await page.evaluate((b) => window.__ev.slice(b), before);
        res[name] = { inp: Math.round(Math.max(0, ...evs.map((e) => e.d))), events: evs.length, box: box && { w: Math.round(box.width), h: Math.round(box.height) } };
      } catch (e) { res[name] = { error: String(e.message).split("\n")[0] }; }
    }
    await browser.close();
    runs.push(res);
    console.log("run", i + 1, JSON.stringify(res));
  }
  const med = {};
  for (const [name] of STEPS) { const v = runs.map((r) => r[name]?.inp).filter((x) => typeof x === "number"); med[name] = v.length ? median(v) : null; }
  fs.writeFileSync(out, JSON.stringify({ url, at: new Date().toISOString(), runs, median: med }, null, 2));
  console.log("MEDIAN", JSON.stringify(med));
})().catch((e) => { console.error(e); process.exit(1); });
