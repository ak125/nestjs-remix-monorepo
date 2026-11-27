// Complément n° 3 au mandat DS : captures des zones touchées de la page R1, à 390 et 1440 px.
// Usage : node zones-c3.cjs <baseUrl> <label> <outDir>
// GET seulement ; écritures et suivi analytique bloqués. Animations figées pour des captures stables.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const [, , base, label, outDir] = process.argv;

// zone -> fonction (dans la page) qui renvoie l'élément à capturer
const ZONES = {
  "fil-ariane": () => [...document.querySelectorAll("nav")].find((n) => n.querySelector('a[href="/pieces"]') && /Accueil/.test(n.textContent))?.parentElement,
  "liens-utiles": () => [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/reference-auto" && /Fiche technique/.test(a.textContent))?.parentElement?.parentElement,
  "bien-choisir-legende-et-etapes": () => document.querySelector("#bien-choisir"),
  "qualite-prix-legende": () => document.querySelector("#qualite-prix figure"),
  "emplacement-legende": () => document.querySelector("#emplacement figure"),
  "diagnostic-badge-2-min": () => [...document.querySelectorAll("h2")].find((h) => /diagnostic/i.test(h.textContent))?.closest("section, .rounded-2xl, .rounded-xl"),
  "aller-plus-loin-cartes": () => document.querySelector("#aller-plus-loin"),
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of [{ n: "390", w: 390, h: 844, m: true }, { n: "1440", w: 1440, h: 900, m: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
    await ctx.route("**/*", (route) => {
      const r = route.request();
      if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(100); }
    await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important} *,*::before,*::after{animation-play-state:paused!important;transition:none!important} header.fixed, header.sticky, nav[aria-label='Navigation mobile'], [class*='z-[9999]']{visibility:hidden!important}" });
    await page.waitForTimeout(500);
    for (const [name, fn] of Object.entries(ZONES)) {
      const handle = await page.evaluateHandle(fn);
      const el = handle.asElement();
      if (!el) { console.log(`${label} ${vp.n} ${name}: introuvable`); continue; }
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const file = path.join(outDir, `${label}-${name}-${vp.n}.png`);
      await el.screenshot({ path: file });
      console.log(`${label} ${vp.n} ${name}: ok`);
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
