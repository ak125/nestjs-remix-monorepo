// Complément n° 8 au mandat DS : axe-core sur la page R1 entière et sur la section #reference
// (lien « Conseils : … »), à 390×844 et 1440×900. Dérivé de axe-c6.cjs. La section porte cv-auto
// (content-visibility:auto) : la passe #reference est faite lien centré à l'écran, sinon la section
// hors écran n'est pas rendue et axe n'y évalue pas link-in-text-block. Usage : node axe-c8.cjs <baseUrl> <label> <outDir>
// GET seulement ; écritures et suivi analytique bloqués.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const { default: AxeBuilder } = require(path.join(W, "node_modules/@axe-core/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const [, , base, label, outDir] = process.argv;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
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
    const page_ = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    await page.locator('#reference a[href="/blog-pieces-auto/conseils/filtre-a-huile"]').evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(800);
    const card = await new AxeBuilder({ page }).include("#reference").withTags(TAGS).analyze();
    const sum = (r) => ({ violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, noeuds: v.nodes.length, cibles: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) })),
      incomplete: r.incomplete.map((v) => ({ id: v.id, noeuds: v.nodes.length, cibles: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) })) });
    const lit = (r) => ({ passes: r.passes.filter((x) => x.id === "link-in-text-block").map((x) => x.nodes.map((n) => n.target.join(" "))).flat(), violations: r.violations.filter((x) => x.id === "link-in-text-block").map((x) => x.nodes.map((n) => n.target.join(" "))).flat(), incomplete: r.incomplete.filter((x) => x.id === "link-in-text-block").map((x) => x.nodes.map((n) => n.target.join(" "))).flat() });
    out.vues[vp.n] = { page: sum(page_), reference: sum(card), referenceLinkInTextBlock: lit(card) };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-axe.json`), JSON.stringify(out, null, 2));
  for (const [n, v] of Object.entries(out.vues)) {
    console.log(`== ${label} ${n} px`);
    console.log(`  page  violations: ${v.page.violations.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucune"}`);
    console.log(`  reference violations: ${v.reference.violations.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucune"} | incomplete: ${v.reference.incomplete.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucun"}`);
    console.log(`  reference link-in-text-block : ${JSON.stringify(v.referenceLinkInTextBlock)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
