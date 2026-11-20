// Complément n° 14 au mandat DS : position verticale (px depuis le haut de la page) de chaque data-section
// et du champ de recherche du catalogue, à 390×844 et 1440×900, sans clic. GET seulement ; analytique bloquée.
// Usage : URL_PATH=/constructeurs/… node positions-r8.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH;
const [, , base, label, outDir] = process.argv;
(async () => {
  const browser = await chromium.launch();
  const out = { url: base + URL_PATH, label, at: new Date().toISOString(), vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true }, { n: "1440", w: 1440, h: 900, m: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m });
    await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2000);
    await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important}" });
    out.vues[vp.n] = await page.evaluate(() => {
      const y = (e) => Math.round(e.getBoundingClientRect().top + window.scrollY);
      const res = {};
      for (const e of document.querySelectorAll("[data-section]")) res[e.getAttribute("data-section")] = y(e);
      const s = document.querySelector('#catalogue, [data-section="S_FAST_ACCESS"]') && document.querySelector('input[placeholder^="Rechercher une gamme"]');
      if (s) res.rechercheGamme = y(s);
      res.hauteurPage = document.documentElement.scrollHeight;
      return res;
    });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-positions.json`), JSON.stringify(out, null, 2));
  for (const [n, v] of Object.entries(out.vues)) console.log(`== ${label} ${n} px ${JSON.stringify(v)}`);
})().catch((e) => { console.error(e); process.exit(1); });
