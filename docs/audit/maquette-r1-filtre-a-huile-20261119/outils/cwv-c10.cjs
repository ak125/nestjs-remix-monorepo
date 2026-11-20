// Complément n° 10 au mandat DS : LCP, CLS et INP de laboratoire d'une page R1 sur le rendu local (décision 81 :
// mesure avant / après). Bibliothèque web-vitals 5.3.0 du dépôt (iife), injectée avant chargement, reportAllChanges.
// N passages par largeur, contexte neuf à chaque passage (cache froid) :
//   - 390×844, échelle 2, mobile, CPU ralenti ×4 (CDP Emulation.setCPUThrottlingRate) ;
//   - 1440×900, échelle 1, sans ralentissement.
// Parcours : chargement, 3 s, défilement jusqu'à la section des cartes, clic « Voir les N autres compatibilités »,
// 1 s, clic « Masquer les véhicules », saisie de « clio » dans la recherche des motorisations, 1 s ;
// puis lecture des dernières valeurs (LCP figé par la première interaction ; CLS = pire fenêtre de session ;
// INP = interaction la plus lente, seuil d'observation 16 ms). GET seulement ; analytique bloquée.
// Usage : URL_PATH=/pieces/… N=5 node cwv-c10.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
// ATTR=1 : build attribution (élément du LCP, cibles INP/CLS), pour diagnostic seulement ; la comparaison avant / après
// utilise le build standard (ATTR absent), le même des deux côtés.
const WV = fs.readFileSync(path.join(W, `node_modules/web-vitals/dist/web-vitals${process.env.ATTR === "1" ? ".attribution" : ""}.iife.js`), "utf8");
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const N = Number(process.env.N || 5);
const [, , base, label, outDir] = process.argv;
const INIT = `${WV}
window.__cwv = {};
const put = (m) => { const a = m.attribution || {}; window.__cwv[m.name] = { value: m.value, rating: m.rating, entries: m.entries.length, cible: a.target || a.interactionTarget || a.largestShiftTarget || null }; };
webVitals.onLCP(put, { reportAllChanges: true });
webVitals.onCLS(put, { reportAllChanges: true });
webVitals.onINP(put, { reportAllChanges: true, durationThreshold: 16 });
webVitals.onFCP(put); webVitals.onTTFB(put);`;
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const out = { url: base + URL_PATH, label, at: new Date().toISOString(), passages: N, vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true, s: 2, cpu: 4 }, { n: "1440", w: 1440, h: 900, m: false, s: 1, cpu: 1 }]) {
    const runs = [];
    for (let i = 0; i < N; i++) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s, isMobile: vp.m, hasTouch: vp.m });
      await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
      await ctx.addInitScript({ content: INIT });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: vp.cpu });
      await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(3000);
      const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
      await plus.first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
      await plus.first().click(); await page.waitForTimeout(1000);
      const moins = page.locator("button", { hasText: /Masquer les véhicules/ });
      if (await moins.count()) { await moins.first().scrollIntoViewIfNeeded(); await moins.first().click(); await page.waitForTimeout(1000); }
      const q = page.locator('input[placeholder="Rechercher marque ou modèle…"]');
      if (await q.count()) { await q.first().scrollIntoViewIfNeeded(); await q.first().click(); await page.keyboard.type("clio", { delay: 80 }); await page.waitForTimeout(1000); }
      const v = await page.evaluate(() => window.__cwv);
      runs.push({ LCP: v.LCP && Math.round(v.LCP.value), CLS: v.CLS ? Math.round(v.CLS.value * 10000) / 10000 : 0, INP: v.INP && Math.round(v.INP.value), FCP: v.FCP && Math.round(v.FCP.value), TTFB: v.TTFB && Math.round(v.TTFB.value), elementLCP: v.LCP && v.LCP.cible, cibleINP: v.INP && v.INP.cible, cibleCLS: v.CLS && v.CLS.cible });
      await ctx.close();
    }
    const k = (m) => runs.map((r) => r[m]).filter((x) => x != null);
    out.vues[vp.n] = { cpu: vp.cpu, runs, mediane: Object.fromEntries(["LCP", "CLS", "INP", "FCP", "TTFB"].map((m) => [m, k(m).length ? med(k(m)) : null])) };
    console.log(`== ${label} ${SLUG} ${vp.n} px (CPU ×${vp.cpu}) médiane ${JSON.stringify(out.vues[vp.n].mediane)} | ${runs.map((r) => `${r.LCP}/${r.CLS}/${r.INP}`).join(" ")} | LCP sur ${[...new Set(runs.map((r) => r.elementLCP))].join(" ; ")} | INP sur ${[...new Set(runs.map((r) => r.cibleINP))].join(" ; ")} | CLS sur ${[...new Set(runs.map((r) => r.cibleCLS))].join(" ; ")}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-cwv.json`), JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
