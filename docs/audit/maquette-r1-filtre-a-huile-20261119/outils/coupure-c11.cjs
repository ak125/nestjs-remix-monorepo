// Complément n° 11 au mandat DS : où se coupe la ligne « Fabrication » d'une carte véhicule à 390×844 ?
// Pour chaque ligne de faits de plus d'une ligne : texte de chaque ligne affichée (rects par caractère d'un Range).
// Capture de la première carte « Début de fabrication » (ou, à défaut, de la première carte à ligne coupée),
// bandeaux fixes masqués. GET seulement ; analytique bloquée.
// Usage : URL_PATH=/pieces/… node coupure-c11.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const [, , base, label, outDir] = process.argv;
const FAITS = /^(Début de |Fin de )?[Ff]abrication\s:\s/;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
  const page = await ctx.newPage();
  await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
  const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
  if (await plus.count()) { await plus.first().click(); await page.waitForTimeout(800); }
  await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important} header.fixed, header.sticky, nav[aria-label='Navigation mobile'], [class*='z-[9999]'], button[aria-label='Ouvrir le chat']{visibility:hidden!important}" });
  const coupees = await page.evaluate((src) => {
    const FAITS = new RegExp(src);
    const links = [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent));
    const out = [];
    links.forEach((a, i) => {
      const p = [...a.querySelectorAll("p")].find((x) => FAITS.test(x.innerText.trim()));
      if (!p) return;
      const lignes = new Map();
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        for (let k = 0; k < n.data.length; k++) {
          const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + 1);
          const r = [...rg.getClientRects()].find((q) => q.width > 0);
          if (!r) continue;
          const y = Math.round(r.top);
          lignes.set(y, (lignes.get(y) || "") + n.data[k]);
        }
      }
      const txt = [...lignes.entries()].sort((x, y) => x[0] - y[0]).map(([, t]) => t.replace(/\u00a0/g, " ").trim());
      if (txt.length > 1) { a.setAttribute("data-c11-coupe", String(i)); out.push({ i, titre: a.querySelector("h3").innerText.trim(), ligne: p.innerText.trim(), lignes: txt, largeurColonnePx: Math.round(p.getBoundingClientRect().width) }); }
    });
    return out;
  }, FAITS.source);
  const cible = coupees.find((c) => /^Début/.test(c.ligne)) || coupees[0];
  let capture = null;
  if (cible) {
    const loc = page.locator(`[data-c11-coupe="${cible.i}"]`);
    await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await page.waitForTimeout(300);
    capture = `${label}-${SLUG}-coupure-390.png`;
    await loc.screenshot({ path: path.join(outDir, capture) });
  }
  await browser.close();
  const res = { url: base + URL_PATH, label, at: new Date().toISOString(), vue: "390×844", lignesCoupees: coupees.length, capture, carteCapturee: cible ? cible.titre : null, coupees };
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-coupure.json`), JSON.stringify(res, null, 2));
  console.log(`== ${label} ${SLUG} 390 px : ${coupees.length} lignes « Fabrication » coupées ; capture ${capture} (${res.carteCapturee})`);
  for (const c of coupees) console.log(`   ${c.titre} [${c.largeurColonnePx}px] ${c.lignes.map((t) => `«${t}»`).join(" / ")}`);
})().catch((e) => { console.error(e); process.exit(1); });
