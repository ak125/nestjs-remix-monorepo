// Complément n° 14 au mandat DU : un seul geste isolé sur la page R8 (cible amenée au centre), durée de chaque
// interaction (Event Timing), élément réellement touché, défilement avant/après.
// Usage : PW=... CHROME=... IMG_FROM=... node inp-geste-du14.cjs <url> <w> <h> <sélecteur>
const { chromium } = require(process.env.PW);
const [, , url, W, H, sel] = process.argv; const IMG = process.env.IMG_FROM;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME }); const mob = +W < 600;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: mob, hasTouch: mob });
  await ctx.route("**/*", async (r) => { const u = r.request().url();
    if (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(u)) return r.abort();
    if (IMG && /^http:\/\/localhost:\d+\/img\//.test(u)) return r.fulfill({ response: await r.fetch({ url: u.replace(/^http:\/\/localhost:\d+/, IMG) }) });
    return r.continue(); });
  await ctx.addInitScript(() => { window.__ev = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ n: e.name, d: Math.round(e.duration), proc: Math.round(e.processingEnd - e.processingStart) }); }).observe({ type: "event", durationThreshold: 16, buffered: true }); });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(4000);
  const t = p.locator(sel).first(); await t.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(800);
  const info = await t.evaluate((e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { y0: scrollY, txt: e.textContent.trim().slice(0, 40), touche: h === e || e.contains(h) ? "la cible" : (h ? h.tagName + " " + (h.textContent || "").trim().slice(0, 30) : null), noeuds: document.getElementsByTagName("*").length }; });
  if (mob) await t.tap(); else await t.click(); await p.waitForTimeout(1500);
  const apres = await p.evaluate(() => ({ y1: scrollY, noeuds: document.getElementsByTagName("*").length, ev: window.__ev }));
  console.log(JSON.stringify({ W, sel, ...info, ...apres })); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
