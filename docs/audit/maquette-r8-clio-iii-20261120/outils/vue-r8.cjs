// Complément n° 13 au mandat DS : captures et Core Web Vitals de laboratoire d'une page R8 (fiche véhicule).
// 1. Captures pleine page à 390×844 (échelle 2, mobile) et 1440×900, après défilement complet (images différées
//    chargées), bandeaux fixes masqués ; état servi, sans aucun clic.
// 2. LCP, CLS, INP : bibliothèque web-vitals 5.3.0 (iife) injectée avant chargement, reportAllChanges ; N passages par
//    largeur, contexte neuf (cache froid) ; 390 avec CPU ralenti ×4 (CDP), 1440 sans ralentissement.
//    Parcours propre à R8 (pas celui de R1) : chargement, 3 s ; clic sur le premier bouton « +N pièces » du catalogue,
//    1 s ; clic « Voir moins », 1 s ; saisie de « filtre » dans la recherche de gammes (Accès rapide), 1 s.
//    CLS = pire fenêtre de session ; INP = interaction la plus lente (seuil d'observation 16 ms).
// GET seulement (toute autre méthode est bloquée) ; analytique bloquée.
// Captures en JPEG qualité 70 (pleine page ; PNG 390 px ≈ 4 Mo). CWV=0 : captures seulement, sans mesure.
// Usage : URL_PATH=/constructeurs/… N=5 [CWV=0] node vue-r8.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const WV = fs.readFileSync(path.join(W, "node_modules/web-vitals/dist/web-vitals.attribution.iife.js"), "utf8");
const URL_PATH = process.env.URL_PATH;
const SLUG = URL_PATH.replace(/^\/constructeurs\/[^/]+\/[^/]+\//, "").replace(/\.html$/, "");
const N = Number(process.env.N || 5);
const [, , base, label, outDir] = process.argv;
const BLOQUE = (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue());
const INIT = `${WV}
window.__cwv = {};
const put = (m) => { const a = m.attribution || {}; window.__cwv[m.name] = { value: m.value, cible: a.target || a.interactionTarget || a.largestShiftTarget || null }; };
webVitals.onLCP(put, { reportAllChanges: true });
webVitals.onCLS(put, { reportAllChanges: true });
webVitals.onINP(put, { reportAllChanges: true, durationThreshold: 16 });
webVitals.onFCP(put); webVitals.onTTFB(put);`;
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const VUES = [{ n: "390", w: 390, h: 844, m: true, s: 2, cpu: 4 }, { n: "1440", w: 1440, h: 900, m: false, s: 1, cpu: 1 }];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const out = { url: base + URL_PATH, label, at: new Date().toISOString(), passages: N, captures: {}, vues: {} };
  for (const vp of VUES) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
    await ctx.route("**/*", BLOQUE);
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
    await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important} header.fixed, header.sticky, nav[aria-label='Navigation mobile'], [class*='z-[9999]'], button[aria-label='Ouvrir le chat'], .fixed{visibility:hidden!important}" });
    const f = `${label}-${SLUG}-${vp.n}.jpg`;
    await page.screenshot({ path: path.join(outDir, f), fullPage: true, type: "jpeg", quality: 70 });
    out.captures[vp.n] = { fichier: f, hauteurPage: await page.evaluate(() => document.documentElement.scrollHeight), debordementHorizontal: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };
    await ctx.close();
    if (process.env.CWV === "0") { console.log(`== ${label} ${SLUG} ${vp.n} px capture ${f} h=${out.captures[vp.n].hauteurPage} débordement=${out.captures[vp.n].debordementHorizontal}`); continue; }
    const runs = [];
    for (let i = 0; i < N; i++) {
      const c = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s, isMobile: vp.m, hasTouch: vp.m });
      await c.route("**/*", BLOQUE);
      await c.addInitScript({ content: INIT });
      const p = await c.newPage();
      const cdp = await c.newCDPSession(p);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: vp.cpu });
      await p.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
      await p.waitForTimeout(3000);
      const plus = p.locator("#catalogue button", { hasText: /\+\d+ pièces/ });
      if (await plus.count()) { await plus.first().scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await plus.first().click(); await p.waitForTimeout(1000); }
      const moins = p.locator("#catalogue button", { hasText: /Voir moins/ });
      if (await moins.count()) { await moins.first().click(); await p.waitForTimeout(1000); }
      const q = p.locator('input[placeholder^="Rechercher une gamme"]');
      if (await q.count()) { await q.first().scrollIntoViewIfNeeded(); await q.first().click(); await p.keyboard.type("filtre", { delay: 80 }); await p.waitForTimeout(1000); }
      const v = await p.evaluate(() => window.__cwv);
      runs.push({ LCP: v.LCP && Math.round(v.LCP.value), CLS: v.CLS ? Math.round(v.CLS.value * 10000) / 10000 : 0, INP: v.INP && Math.round(v.INP.value), FCP: v.FCP && Math.round(v.FCP.value), TTFB: v.TTFB && Math.round(v.TTFB.value), elementLCP: v.LCP && v.LCP.cible, cibleINP: v.INP && v.INP.cible, cibleCLS: v.CLS && v.CLS.cible });
      await c.close();
    }
    const k = (m) => runs.map((r) => r[m]).filter((x) => x != null);
    out.vues[vp.n] = { cpu: vp.cpu, runs, mediane: Object.fromEntries(["LCP", "CLS", "INP", "FCP", "TTFB"].map((m) => [m, k(m).length ? med(k(m)) : null])) };
    console.log(`== ${label} ${SLUG} ${vp.n} px (CPU ×${vp.cpu}) médiane ${JSON.stringify(out.vues[vp.n].mediane)} | ${runs.map((r) => `${r.LCP}/${r.CLS}/${r.INP}`).join(" ")} | LCP sur ${[...new Set(runs.map((r) => r.elementLCP))].join(" ; ")} | INP sur ${[...new Set(runs.map((r) => r.cibleINP))].join(" ; ")} | CLS sur ${[...new Set(runs.map((r) => r.cibleCLS))].join(" ; ")} | capture ${f} h=${out.captures[vp.n].hauteurPage} débordement=${out.captures[vp.n].debordementHorizontal}`);
  }
  await browser.close();
  if (process.env.CWV !== "0") fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-vue.json`), JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
