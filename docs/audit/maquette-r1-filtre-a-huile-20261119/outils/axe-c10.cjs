// Complément n° 10 au mandat DS : axe-core sur la page R1 entière et sur la section des cartes véhicule
// (toutes les cartes dépliées, section centrée : elle porte cv-auto), à 390×844 et 1440×900. Dérivé de axe-c9.cjs.
// Usage : URL_PATH=/pieces/… node axe-c10.cjs <base> <label> <dossier>. GET seulement ; analytique bloquée.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const { default: AxeBuilder } = require(path.join(W, "node_modules/@axe-core/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const [, , base, label, outDir] = process.argv;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const sum = (r) => ({ violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, noeuds: v.nodes.length, cibles: v.nodes.slice(0, 8).map((n) => n.target.join(" ")) })) });
(async () => {
  const browser = await chromium.launch();
  const out = { url: base + URL_PATH, label, at: new Date().toISOString(), tags: TAGS, vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true }, { n: "1440", w: 1440, h: 900, m: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m });
    await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(100); }
    const pageRes = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
    if (await plus.count()) { await plus.first().click(); await page.waitForTimeout(800); }
    await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].find((e) => e.querySelector("h3") && /Voir les pièces/.test(e.textContent)); const s = a && a.closest("section"); if (s) { s.setAttribute("data-c10", "section"); a.scrollIntoView({ block: "center", behavior: "instant" }); } });
    await page.waitForTimeout(800);
    const sec = await new AxeBuilder({ page }).include('[data-c10="section"]').withTags(TAGS).analyze();
    out.vues[vp.n] = { page: sum(pageRes), sectionCartes: sum(sec) };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-axe.json`), JSON.stringify(out, null, 2));
  for (const [n, v] of Object.entries(out.vues)) console.log(`== ${label} ${SLUG} ${n} px | page : ${v.page.violations.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucune"} | section cartes : ${v.sectionCartes.violations.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucune"}`);
})().catch((e) => { console.error(e); process.exit(1); });
