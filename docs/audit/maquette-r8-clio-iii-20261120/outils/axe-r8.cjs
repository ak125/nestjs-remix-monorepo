// Complément n° 14 au mandat DS : axe-core sur la page R8 entière, à 390×844 et 1440×900, après défilement complet,
// état servi puis état « toutes familles dépliées » (clic sur chaque bouton « +N pièces » du catalogue).
// Dérivé de #2210 outils/axe-c10.cjs. GET seulement ; analytique bloquée.
// Usage : URL_PATH=/constructeurs/… node axe-r8.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const { default: AxeBuilder } = require(path.join(W, "node_modules/@axe-core/playwright"));
const URL_PATH = process.env.URL_PATH;
const SLUG = URL_PATH.replace(/^\/constructeurs\/[^/]+\/[^/]+\//, "").replace(/\.html$/, "");
const [, , base, label, outDir] = process.argv;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const sum = (r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, noeuds: v.nodes.length, cibles: v.nodes.slice(0, 8).map((n) => n.target.join(" ")) }));
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const out = { url: base + URL_PATH, label, at: new Date().toISOString(), tags: TAGS, vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true }, { n: "1440", w: 1440, h: 900, m: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m });
    await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(100); }
    const servi = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const plus = page.locator("#catalogue button", { hasText: /^\+\d+ pièces/ });
    const n = await plus.count();
    for (let i = 0; i < n; i++) { await plus.first().click(); await page.waitForTimeout(150); }
    const deplie = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    out.vues[vp.n] = { servi: sum(servi), deplie: sum(deplie), boutonsDeplies: n };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-axe.json`), JSON.stringify(out, null, 2));
  const f = (l) => l.map((x) => `${x.id}(${x.impact})×${x.noeuds}`).join(", ") || "aucune";
  for (const [n, v] of Object.entries(out.vues)) console.log(`== ${label} ${SLUG} ${n} px | servi : ${f(v.servi)} | déplié (${v.boutonsDeplies} familles) : ${f(v.deplie)}`);
})().catch((e) => { console.error(e); process.exit(1); });
