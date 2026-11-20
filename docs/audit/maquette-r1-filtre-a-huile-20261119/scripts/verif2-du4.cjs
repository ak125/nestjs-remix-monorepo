// Complément n° 4 au mandat DU : (a) ce qui est peint derrière « Conseils entretien » à 1440 ;
// (b) lien d'évitement : taille au focus (focus programmatique).
const { chromium } = require(process.env.PW || "playwright");
const [, , url, W, H] = process.argv;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: +H }, reducedMotion: "reduce" });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const ce = p.locator('a:has-text("Conseils entretien")').first();
  await ce.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(300);
  console.log(JSON.stringify(await ce.evaluate((e) => { const r = e.getBoundingClientRect(); return document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).slice(0, 8).map((x) => { const s = getComputedStyle(x); return x.tagName.toLowerCase() + " bg=" + s.backgroundColor + " img=" + s.backgroundImage.slice(0, 80) + " op=" + s.opacity + " cls=" + String(x.className).slice(0, 90); }); })));
  const sk = p.locator('a:has-text("Aller au contenu principal")').first();
  await sk.focus(); await p.waitForTimeout(200);
  console.log(JSON.stringify(await sk.evaluate((e) => { const r = e.getBoundingClientRect(); return { focused: document.activeElement === e, w: r.width, h: r.height, cls: String(e.className), tabindex: e.tabIndex, idx: [...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].indexOf(e) }; })));
  await b.close();
})();
