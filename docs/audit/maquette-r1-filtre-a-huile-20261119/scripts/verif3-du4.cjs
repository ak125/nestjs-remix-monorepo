// Complément n° 4 au mandat DU : capture de la bande « liens utiles » à 1440 et éléments
// peints au-dessus (y compris pointer-events:none) à l'emplacement de « Conseils entretien ».
const { chromium } = require(process.env.PW || "playwright");
const [, , url, outPng] = process.argv;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const ce = p.locator('a:has-text("Conseils entretien")').first();
  await ce.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(300);
  const r = await ce.boundingBox();
  await p.screenshot({ path: outPng, clip: { x: 0, y: r.y - 60, width: 1440, height: 150 } });
  console.log(JSON.stringify(await p.evaluate(({ x, y }) => [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.left <= x && b.right >= x && b.top <= y && b.bottom >= y && (s.position === "fixed" || s.position === "sticky" || s.pointerEvents === "none" || s.backdropFilter !== "none" || s.mixBlendMode !== "normal"); }).map((e) => { const s = getComputedStyle(e); return e.tagName + " pos=" + s.position + " pe=" + s.pointerEvents + " bg=" + s.backgroundColor + " img=" + s.backgroundImage.slice(0, 60) + " cls=" + String(e.className).slice(0, 80); }), { x: r.x + r.width / 2, y: r.y + r.height / 2 })));
  await b.close();
})();
