// Complément n° 14 au mandat DU : durée de chaque interaction pendant la saisie dans la recherche de gamme (page R8),
// sans autre geste avant ; Event Timing (interactionId), une ligne par interaction.
// Usage : PW=... CHROME=... IMG_FROM=http://localhost:3000 node inp-saisie-du14.cjs <url> <w> <h> <texte> [acces=0|1]
const { chromium } = require(process.env.PW);
const [, , url, W, H, texte, acces = "0"] = process.argv; const IMG = process.env.IMG_FROM;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME }); const mob = +W < 600;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: mob, hasTouch: mob });
  await ctx.route("**/*", async (r) => { const u = r.request().url();
    if (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(u)) return r.abort();
    if (IMG && /^http:\/\/localhost:\d+\/img\//.test(u)) return r.fulfill({ response: await r.fetch({ url: u.replace(/^http:\/\/localhost:\d+/, IMG) }) });
    return r.continue(); });
  await ctx.addInitScript(() => { window.__ev = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ n: e.name, d: Math.round(e.duration), id: e.interactionId, proc: Math.round(e.processingEnd - e.processingStart), att: Math.round(e.processingStart - e.startTime) }); }).observe({ type: "event", durationThreshold: 16, buffered: true }); });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(4000);
  if (acces === "1") { await p.locator('[data-section="S_FAST_ACCESS"] a').first().click(); await p.waitForTimeout(+(process.env.ATTENTE||800)); console.error("apres puce scrollY", await p.evaluate(() => scrollY), "smooth", await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)); }
  const inp = p.locator('main input[placeholder^="Rechercher une gamme"]').first();
  await inp.scrollIntoViewIfNeeded(); const y0 = await p.evaluate(() => scrollY);
  await inp.click(); await p.waitForTimeout(500);
  for (const c of texte) { await p.keyboard.type(c); await p.waitForTimeout(400); }
  const y1 = await p.evaluate(() => scrollY);
  const ev = await p.evaluate(() => window.__ev);
  const byId = {}; for (const e of ev) (byId[e.id] ||= []).push(`${e.n}:${e.d}(att ${e.att}, proc ${e.proc})`);
  console.log(JSON.stringify({ W, acces, scrollAvant: y0, scrollApres: y1, interactions: Object.values(byId) }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
