// Complément n° 12 au mandat DS : premier affichage et dépliage des cartes véhicule R1, à 390×844 (mobile) et 1440×900.
// 1. Premier affichage (avant tout clic) : cartes <a href> du DOM, cartes visibles (boîte non nulle), texte du bouton
//    « Voir les N autres compatibilités », hauteur de la section ; capture à 390 de la section repliée.
// 2. Atteignabilité : clic sur le bouton, puis pour chaque carte : boîte non nulle (visible) et focalisable
//    (focus() puis document.activeElement === carte).
//    Une carte présente dans le DOM mais jamais visible ni focalisable serait un lien caché trompeur.
// 3. Repli : clic sur « Masquer les véhicules », retour au nombre de cartes visibles du premier affichage.
// GET seulement ; analytique bloquée.
// Usage : URL_PATH=/pieces/… node depli-c12.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const [, , base, label, outDir] = process.argv;

const ETAT = () => {
  const links = [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent));
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const sec = links[0] && links[0].closest("section");
  const btn = [...document.querySelectorAll("button")].find((b) => /autres compatibilités|Masquer les véhicules/.test(b.textContent));
  return { dom: links.length, visibles: links.filter(vis).length, bouton: btn ? btn.textContent.trim() : null, hauteurSection: sec ? Math.round(sec.getBoundingClientRect().height) : null };
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const res = { url: base + URL_PATH, label, at: new Date().toISOString(), vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true, s: 2 }, { n: "1440", w: 1440, h: 900, m: false, s: 1 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
    await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
    await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important} header.fixed, header.sticky, nav[aria-label='Navigation mobile'], [class*='z-[9999]'], button[aria-label='Ouvrir le chat']{visibility:hidden!important}" });
    const v = { premierAffichage: await page.evaluate(ETAT) };
    if (vp.n === "390") {
      const sec = page.locator("section", { has: page.locator("button", { hasText: /autres compatibilités/ }) }).last();
      await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await sec.screenshot({ path: path.join(outDir, `${label}-${SLUG}-replie-390.png`) });
    }
    const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
    if (await plus.count()) {
      await plus.first().click(); await page.waitForTimeout(800);
      v.deplie = await page.evaluate(ETAT);
      v.atteignables = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent));
        return links.map((a) => { a.focus(); const r = a.getBoundingClientRect(); return { href: a.getAttribute("href"), visible: r.width > 0 && r.height > 0, focalisable: document.activeElement === a }; });
      });
      v.nonAtteignables = v.atteignables.filter((x) => !x.visible || !x.focalisable).map((x) => x.href);
      const moins = page.locator("button", { hasText: /Masquer les véhicules/ });
      if (await moins.count()) { await moins.first().click(); await page.waitForTimeout(800); v.replie = await page.evaluate(ETAT); }
      delete v.atteignables;
    }
    res.vues[vp.n] = v;
    console.log(`== ${label} ${SLUG} ${vp.n} px | premier affichage ${JSON.stringify(v.premierAffichage)} | déplié ${JSON.stringify(v.deplie)} | non atteignables ${v.nonAtteignables ? v.nonAtteignables.length : "-"} | replié ${JSON.stringify(v.replie)}`);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-depli.json`), JSON.stringify(res, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
