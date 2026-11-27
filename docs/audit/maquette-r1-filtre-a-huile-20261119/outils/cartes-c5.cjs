// Complément n° 5 au mandat DS : cartes motorisation de la page gamme à 390×844 (DPR 2, reduced-motion).
// Usage : URL_PATH=/pieces/... node cartes-c5.cjs <baseUrl> <label> <outDir>
// Écrit <label>-cartes.json (texte de chaque carte : titre, phrase servie) et des captures :
// <label>-cartes-390.png (section entière) et <label>-cartes-1a3-390.png (trois premières cartes).
// Clique d'abord « Voir les N autres compatibilités » (12 cartes visibles par défaut) pour relever toutes les cartes.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const [, , base, label, outDir] = process.argv;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const r = route.request();
    if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
    return route.continue();
  });
  const page = await ctx.newPage();
  await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
  const initiales = await page.evaluate(() => [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent)).length);
  const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
  if (await plus.count()) { await plus.first().click(); await page.waitForTimeout(800); }
  await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important} *,*::before,*::after{animation-play-state:paused!important;transition:none!important} header.fixed, header.sticky, nav[aria-label='Navigation mobile'], [class*='z-[9999]']{visibility:hidden!important}" });
  const data = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent));
    const section = links[0] && links[0].closest("section");
    if (section) section.setAttribute("data-c5", "section");
    links.slice(0, 3).forEach((a) => a.setAttribute("data-c5", "carte"));
    return { section: !!section, cartes: links.map((a) => {
      const h3 = a.querySelector("h3"); const ps = [...a.querySelectorAll("p")].map((p) => p.innerText.trim());
      return { href: a.getAttribute("href"), titre: h3.innerText.trim(), paragraphes: ps };
    }) };
  });
  fs.writeFileSync(path.join(outDir, `${label}-cartes.json`), JSON.stringify({ url: base + URL_PATH, at: new Date().toISOString(), cartesAvantClic: initiales, ...data }, null, 2));
  if (data.section) {
    const sec = page.locator('[data-c5="section"]');
    await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await sec.screenshot({ path: path.join(outDir, `${label}-cartes-390.png`) });
    const box = await page.evaluate(() => { const c = [...document.querySelectorAll('[data-c5="carte"]')].map((e) => e.getBoundingClientRect()); const top = Math.min(...c.map((r) => r.top)) + window.scrollY, bottom = Math.max(...c.map((r) => r.bottom)) + window.scrollY; return { top, bottom }; });
    await page.evaluate((y) => window.scrollTo(0, y - 10), box.top); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${label}-cartes-1a3-390.png`), fullPage: true, clip: { x: 0, y: box.top - 8, width: 390, height: box.bottom - box.top + 16 } });
  }
  await browser.close();
  console.log(`${label}: section=${data.section} cartes avant clic=${initiales} après clic=${data.cartes.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
