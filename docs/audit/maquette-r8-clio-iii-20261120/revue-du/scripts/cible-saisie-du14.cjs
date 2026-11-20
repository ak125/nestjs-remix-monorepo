// Complément n° 14 au mandat DU : après un clic sur la première puce « Accès rapide », qu'y a-t-il au centre
// du champ de recherche de gamme une fois celui-ci amené à l'écran ? (élément au point, barre collante, capture)
// Usage : PW=... CHROME=... IMG_FROM=... node cible-saisie-du14.cjs <url> <w> <h> <capture.png>
const { chromium } = require(process.env.PW);
const [, , url, W, H, png] = process.argv; const IMG = process.env.IMG_FROM;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME }); const mob = +W < 600;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: mob, hasTouch: mob });
  await ctx.route("**/*", async (r) => { const u = r.request().url();
    if (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(u)) return r.abort();
    if (IMG && /^http:\/\/localhost:\d+\/img\//.test(u)) return r.fulfill({ response: await r.fetch({ url: u.replace(/^http:\/\/localhost:\d+/, IMG) }) });
    return r.continue(); });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(4000);
  await p.locator('[data-section="S_FAST_ACCESS"] a').first().click(); await p.waitForTimeout(2500);
  const inp = p.locator('main input[placeholder^="Rechercher une gamme"]').first();
  await inp.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
  const r = await inp.evaluate((i) => { const b = i.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const e = document.elementFromPoint(x, y);
    const fixed = [...document.querySelectorAll("body *")].filter((n) => { const s = getComputedStyle(n); return (s.position === "fixed" || s.position === "sticky") && n.getBoundingClientRect().height > 0 && s.visibility !== "hidden" && s.display !== "none"; }).map((n) => { const r = n.getBoundingClientRect(); return { tag: n.tagName, cls: (n.className + "").slice(0, 60), top: Math.round(r.top), h: Math.round(r.height), txt: n.textContent.trim().slice(0, 40) }; });
    return { scrollY, inputTop: Math.round(b.top), inputBottom: Math.round(b.bottom), auPoint: e ? e.tagName + " " + (e.closest("a") ? "dans <a href=" + e.closest("a").getAttribute("href") + ">" : "") + " " + (e === i ? "(le champ)" : (e.textContent || "").trim().slice(0, 40)) : null, collants: fixed }; });
  await p.screenshot({ path: png }); console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
