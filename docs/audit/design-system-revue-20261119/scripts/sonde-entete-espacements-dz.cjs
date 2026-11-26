// Mandat DZ — 6.4 : capture de l'en-tête à 1280×800 avec les espacements WCAG 1.4.12 imposés,
// pour juger à l'œil le dépassement de 47 px relevé par reflow-dz.cjs sur « Diagnostic GRATUIT ».
// Usage : node sonde-entete-espacements-dz.cjs <dossier-sortie>
const path = require("node:path");
const fs = require("node:fs");
const { chromium, BASE, newContext, settle } = require("./lib-dz.cjs");
const outDir = process.argv[2] || ".";
const SPACING = "*{line-height:1.5 !important;letter-spacing:0.12em !important;word-spacing:0.16em !important} p{margin-bottom:2em !important}";
(async () => {
  const b = await chromium.launch(); const aborted = []; const out = { at: new Date().toISOString(), captures: [] };
  for (const [nom, inject] of [["sans", null], ["avec", SPACING]]) {
    const ctx = await newContext(b, { width: 1280, height: 800, aborted }); const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "load", timeout: 120000 }); await settle(p, 3000);
    if (inject) { await p.addStyleTag({ content: inject }); await p.waitForTimeout(800); }
    const nav = p.locator('nav[aria-label="Navigation principale"]').first();
    const f = `captures/entete-1280-espacements-${nom}.jpg`; await nav.screenshot({ path: path.join(outDir, f), type: "jpeg", quality: 60 });
    out.captures.push(f); await ctx.close();
  }
  await b.close(); out.requetesAbandonnees = aborted;
  fs.writeFileSync(path.join(outDir, "mesures", "entete-espacements.json"), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.captures));
})().catch((e) => { console.error(e); process.exit(1); });
