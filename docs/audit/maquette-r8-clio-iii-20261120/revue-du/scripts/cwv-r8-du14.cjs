// Complément n° 14 au mandat DU : LCP, CLS et INP de laboratoire sur la page R8, N passages,
// profil neuf à chaque passage (cache vide). Les images /img/* sont lues sur le DEV (GET seul),
// comme Caddy les sert devant l'application ; analytique bloquée.
// INP : plus longue interaction mesurée (Event Timing, interactionId) sur trois gestes :
//   tap/clic sur le premier lien « Accès rapide », saisie « filtre » dans la recherche de gamme,
//   clic sur le premier titre de famille du catalogue.
// Chaque cible est amenée au centre de l'écran avant le geste : la barre véhicule fixe (55 px) ne doit pas
// intercepter le clic (constat du complément : un champ amené en haut d'écran est entièrement couvert).
// Usage : PW=... CHROME=... IMG_FROM=http://localhost:3000 node cwv-r8-du14.cjs <url> <w> <h> <profil-base> <N>
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const [, , url, W, H, profBase, N] = process.argv;
const IMG = process.env.IMG_FROM;
(async () => { const out = [];
  for (let k = 0; k < +N; k++) { const prof = `${profBase}-${k}`; fs.rmSync(prof, { recursive: true, force: true });
    const mob = +W < 600;
    const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, headless: true, viewport: { width: +W, height: +H }, isMobile: mob, hasTouch: mob });
    await ctx.route("**/*", async (r) => { const u = r.request().url();
      if (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(u)) return r.abort();
      if (IMG && /^http:\/\/localhost:\d+\/img\//.test(u) && r.request().method() === "GET") { const resp = await r.fetch({ url: u.replace(/^http:\/\/localhost:\d+/, IMG) }); return r.fulfill({ response: resp }); }
      return r.continue(); });
    await ctx.addInitScript(() => { window.__ls = []; window.__lcp = []; window.__ev = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, t: e.startTime, recent: e.hadRecentInput }); }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName + (e.element.getAttribute("alt") ? "[alt]" : "") : null }); }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ n: e.name, d: e.duration, id: e.interactionId }); }).observe({ type: "event", durationThreshold: 16, buffered: true }); });
    const p = ctx.pages()[0]; await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(5000);
    const lcp = await p.evaluate(() => (window.__lcp.slice(-1)[0] || {}));
    const gestes = [];
    const fa = p.locator('[data-section="S_FAST_ACCESS"] a').first();
    if (await fa.count()) { await fa.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(300); await p.waitForTimeout(300); if (mob) await fa.tap(); else await fa.click(); gestes.push(await p.evaluate(() => window.__ev.length) + ":" + "acces-rapide"); await p.waitForTimeout(800); }
    const inp = p.locator('main input[placeholder^="Rechercher une gamme"]').first();
    if (await inp.count()) { await inp.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(300); await inp.click(); await p.keyboard.type("filtre", { delay: 60 }); gestes.push(await p.evaluate(() => window.__ev.length) + ":" + "saisie"); await p.waitForTimeout(800); await inp.fill(""); await p.waitForTimeout(500); }
    const fam = p.locator('[data-section="S_CATALOG"] h3').first();
    if (await fam.count()) { await fam.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(300); await fam.click(); gestes.push(await p.evaluate(() => window.__ev.length) + ":" + "famille"); await p.waitForTimeout(800); }
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 300) { await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await p.waitForTimeout(60); }
    await p.waitForTimeout(1500);
    out.push(await p.evaluate(([lcp, gestes]) => { let best = 0, cur = 0, s0 = -1, prev = -1; for (const e of window.__ls.filter((e) => !e.recent)) { if (prev < 0 || e.t - prev > 1000 || e.t - s0 > 5000) { cur = 0; s0 = e.t; } cur += e.v; prev = e.t; best = Math.max(best, cur); }
      const byId = {}; for (const e of window.__ev) byId[e.id] = Math.max(byId[e.id] || 0, e.d); const inps = Object.values(byId).sort((a, b) => b - a);
      const parGeste = {}; let gi = 0; const starts = gestes.map((g) => +g.split(":")[0]); window.__ev.forEach((e, i) => { let k = -1; starts.forEach((st, j) => { if (i >= st) k = j; }); const name = k < 0 ? "chargement" : gestes[k].split(":")[1]; parGeste[name] = Math.max(parGeste[name] || 0, e.d); });
      return { parGeste, lcp: lcp.t, lcpEl: lcp.el, lcpSize: lcp.size, cls: Math.round(best * 10000) / 10000, inp: inps[0] || 0, interactions: inps.length, gestes, noeuds: document.getElementsByTagName("*").length }; }, [lcp, gestes]));
    await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); }
  console.log(JSON.stringify(out)); })().catch((e) => { console.error(e); process.exit(1); });
