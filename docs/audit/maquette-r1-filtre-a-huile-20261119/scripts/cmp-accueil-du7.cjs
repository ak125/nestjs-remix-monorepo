// Compare les styles calculés du bouton « Lancer le diagnostic » de l'accueil (DiagnosticBanner) et de R1 (GammeDiagnosticCTA).
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const [, , base, out] = process.argv;
const props = ["backgroundColor", "backgroundImage", "color", "fontSize", "fontWeight", "borderRadius", "height", "boxShadow", "outlineStyle", "outlineColor", "outlineWidth", "outlineOffset"];
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [W, H] of [[390, 844], [1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
    const p = await ctx.newPage();
    for (const [nom, path] of [["accueil", "/"], ["r1", "/pieces/filtre-a-huile-7.html"]]) {
      await p.goto(base + path, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2000);
      const el = p.locator("a, button", { hasText: /^\s*Lancer le diagnostic\s*$/ }).first();
      await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      const get = () => el.evaluate((e, props) => { const cs = getComputedStyle(e); const o = { tag: e.tagName.toLowerCase(), parentTag: e.parentElement.closest("a,button")?.tagName.toLowerCase() || null, classes: e.className }; for (const k of props) o[k] = cs[k]; return o; }, props);
      const repos = await get(); await el.hover(); await p.waitForTimeout(500); const survol = await get(); await p.mouse.move(0, 0);
      res[`${nom}-${W}`] = { repos, survolBg: survol.backgroundColor, survolColor: survol.color };
    }
    await ctx.close();
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 2)); await b.close();
  for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify({ tag: v.repos.tag, parent: v.repos.parentTag, bg: v.repos.backgroundColor, bgi: v.repos.backgroundImage, c: v.repos.color, fs: v.repos.fontSize, fw: v.repos.fontWeight, r: v.repos.borderRadius, h: v.repos.height, hoverBg: v.survolBg, hoverC: v.survolColor }));
})().catch((e) => { console.error(e); process.exit(1); });
