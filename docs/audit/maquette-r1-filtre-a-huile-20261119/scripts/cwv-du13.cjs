// cwv-du13.cjs — LCP et CLS de laboratoire, N passages, profil neuf à chaque passage (cache vide).
// Usage : CHROME=... PW=... node cwv-du13.cjs <url> <w> <h> <profil-base> <N>
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const [, , url, W, H, profBase, N] = process.argv;
(async () => { const out = [];
  for (let k = 0; k < +N; k++) { const prof = `${profBase}-${k}`; fs.rmSync(prof, { recursive: true, force: true });
    const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, headless: true, viewport: { width: +W, height: +H }, isMobile: +W < 600, hasTouch: +W < 600 });
    await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
    await ctx.addInitScript(() => { window.__ls = []; window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, t: e.startTime, recent: e.hadRecentInput }); }).observe({ type: "layout-shift", buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName : null }); }).observe({ type: "largest-contentful-paint", buffered: true }); });
    const p = ctx.pages()[0]; await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(5000);
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 300) { await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await p.waitForTimeout(60); }
    await p.waitForTimeout(1500);
    out.push(await p.evaluate(() => { let best = 0, cur = 0, s0 = -1, prev = -1; for (const e of window.__ls.filter((e) => !e.recent)) { if (prev < 0 || e.t - prev > 1000 || e.t - s0 > 5000) { cur = 0; s0 = e.t; } cur += e.v; prev = e.t; best = Math.max(best, cur); } const l = window.__lcp.slice(-1)[0] || {}; return { cls: Math.round(best * 10000) / 10000, lcp: l.t, lcpEl: l.el, lcpSize: l.size, octetsDOM: document.documentElement.outerHTML.length, noeuds: document.getElementsByTagName("*").length }; }));
    await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); }
  console.log(JSON.stringify(out)); })().catch((e) => { console.error(e); process.exit(1); });
