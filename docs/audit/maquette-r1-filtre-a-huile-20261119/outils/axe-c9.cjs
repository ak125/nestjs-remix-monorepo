// Complément n° 9 au mandat DS : axe-core sur la page R1 entière, puis sur chacune des sections
// #bien-choisir, #qualite-prix et #emplacement, à 390×844 et 1440×900. Dérivé de axe-c8.cjs. Les sections
// portent cv-auto (content-visibility:auto) : chaque passe de section est faite premier lien du conteneur
// éditorial centré à l'écran (à défaut, le conteneur), sinon la section hors écran n'est pas rendue et axe
// n'y évalue pas link-in-text-block. Usage : URL_PATH=/pieces/… node axe-c9.cjs <baseUrl> <label> <outDir>
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
    const sum = (r) => ({ violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, noeuds: v.nodes.length, cibles: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) })),
      incomplete: r.incomplete.map((v) => ({ id: v.id, noeuds: v.nodes.length, cibles: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) })) });
    const lit = (r) => ({ passes: r.passes.filter((x) => x.id === "link-in-text-block").map((x) => x.nodes.map((n) => n.target.join(" "))).flat(), violations: r.violations.filter((x) => x.id === "link-in-text-block").map((x) => x.nodes.map((n) => n.target.join(" "))).flat(), incomplete: r.incomplete.filter((x) => x.id === "link-in-text-block").map((x) => x.nodes.map((n) => n.target.join(" "))).flat() });
    out.vues[vp.n] = { page: sum(page_), sections: {} };
    for (const b of ["bien-choisir", "qualite-prix", "emplacement"]) {
      const cible = page.locator(`section#${b} .gamme-editorial a, section#${b} .gamme-editorial`).first();
      if (!(await cible.count())) { out.vues[vp.n].sections[b] = null; continue; }
      await cible.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(800);
      const r = await new AxeBuilder({ page }).include(`section#${b}`).withTags(TAGS).analyze();
      out.vues[vp.n].sections[b] = { ...sum(r), linkInTextBlock: lit(r) };
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "")}-axe.json`), JSON.stringify(out, null, 2));
  for (const [n, v] of Object.entries(out.vues)) {
    console.log(`== ${label} ${n} px`);
    console.log(`  page  violations: ${v.page.violations.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucune"}`);
    for (const [b, s] of Object.entries(v.sections)) {
      if (!s) { console.log(`  ${b} : pas de conteneur`); continue; }
      console.log(`  ${b} violations: ${s.violations.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucune"} | incomplete: ${s.incomplete.map((x) => `${x.id}×${x.noeuds}`).join(", ") || "aucun"}`);
      console.log(`  ${b} link-in-text-block : ${JSON.stringify(s.linkInTextBlock)}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
