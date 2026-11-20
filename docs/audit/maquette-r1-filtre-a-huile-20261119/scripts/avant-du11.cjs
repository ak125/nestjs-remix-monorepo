// avant-du11.cjs — hauteur des cartes R1 : tête (ligne « Fabrication ») contre reconstruction de 318f405d3
// dans la même page (classes reprises du diff : « 📅 {periode} » text-sm text-gray-600 mb-3 font-medium, puis phrase
// text-sm text-gray-700 leading-relaxed mb-4 ; phrases relevées au complément n° 5, fichier c5-cartes-<gamme>.json).
// Usage : CHROME=... PW=... node avant-du11.cjs <base> <gamme> <w> <h> <profil> <c5.json> <api.json> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const [, , base, gamme, W, H, prof, c5, api, out] = process.argv;
const phrases = Object.fromEntries(JSON.parse(fs.readFileSync(c5)).cards.map((c) => [c.lien, c.phrase]));
const find = (o) => { if (o && typeof o === "object") { if (o.motorisations && o.motorisations.items) return o.motorisations; for (const v of Object.values(o)) { const r = find(v); if (r) return r; } } return null; };
const periodes = Object.fromEntries(find(JSON.parse(fs.readFileSync(api))).items.map((i) => [i.link, i.periode]));
(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  await p.goto(`${base}/pieces/${gamme}.html`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const btn = p.locator("section button", { hasText: /Voir les \d+ autres/ }).first(); if (await btn.count()) { await btn.click(); await p.waitForTimeout(800); }
  await p.evaluate(() => { const f = [...document.querySelectorAll("p")].find((e) => /^Fabrication/.test(e.textContent.trim())); f.closest(".grid").dataset.du11 = "grille"; });
  const mesure = () => p.evaluate(() => { const g = document.querySelector("[data-du11=grille]"); return { grille: Math.round(g.getBoundingClientRect().height), cartes: [...g.children].map((a) => Math.round(a.getBoundingClientRect().height)) }; });
  const tete = await mesure();
  const manquantes = await p.evaluate(({ phrases, periodes }) => {
    let m = 0;
    for (const f of [...document.querySelectorAll("p")].filter((e) => /^Fabrication/.test(e.textContent.trim()))) {
      const href = f.closest("a").getAttribute("href");
      f.textContent = "📅 " + (periodes[href] ?? ""); f.className = "text-sm text-gray-600 mb-3 font-medium";
      const ph = phrases[href]; if (!ph) { m++; continue; }
      const q = document.createElement("p"); q.className = "text-sm text-gray-700 leading-relaxed mb-4"; q.textContent = ph; f.after(q);
    }
    return m;
  }, { phrases, periodes });
  await p.waitForTimeout(300);
  const avant = await mesure();
  const res = { gamme, viewport: `${W}x${H}`, at: new Date().toISOString(), tete, reconstruction318: avant, phrasesManquantes: manquantes };
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  const s = (a) => a.reduce((x, y) => x + y, 0);
  console.log(W, gamme, "grille tête", tete.grille, "reconstruction", avant.grille, "gain", avant.grille - tete.grille, "| carte médiane tête", tete.cartes.slice().sort((a, b) => a - b)[tete.cartes.length >> 1], "avant", avant.cartes.slice().sort((a, b) => a - b)[avant.cartes.length >> 1], "| phrases manquantes", manquantes);
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
