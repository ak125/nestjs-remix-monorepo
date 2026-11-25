// Mandat DZ — point 9 : vérification « à la main » de cas de contraste, indépendante de mesure-dz.cjs.
// Pour chaque cas : capture PNG du texte tel qu'affiché, puis du même cadre texte masqué (fond peint).
// Le calcul est refait ensuite par verif-manuelle-dz.py (décodage PNG et formule WCAG réécrits en Python,
// sans réutiliser le code JavaScript du relevé).
// Usage : node verif-manuelle-dz.cjs <dossier-sortie>
const fs = require("node:fs");
const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("./lib-dz.cjs");
const outDir = process.argv[2] || ".";
const CAS = [
  { n: 1, nature: "fond uni", page: "r0-accueil", route: "/", w: 390, h: 844, sel: 'nav[aria-label="Navigation mobile"] a:has-text("Catalogue")' },
  { n: 2, nature: "fond dégradé (image CSS)", page: "r1-gamme", route: "/pieces/filtre-a-huile-7.html", w: 390, h: 844, sel: 'div.px-5.pt-5 nav a:text-is("Accueil")' },
  { n: 3, nature: "fond semi-transparent (bg-cta/10)", page: "r0-accueil", route: "/", w: 1440, h: 900, sel: '[id$="-trigger-Tout"] span.rounded-full' },
  { n: 5, nature: "fond semi-transparent sur image (bg-white/90 + backdrop-blur sur photo)", page: "r0-accueil", route: "/", w: 1440, h: 900, sel: 'span.absolute.top-3:text-is("Alternateur")' },
  { n: 4, nature: "texte semi-transparent (text-white/70)", page: "r0-accueil", route: "/", w: 390, h: 844, sel: 'span.whitespace-nowrap:text-is("Compatibilité vérifiée")' },
  { n: 6, nature: "texte blanc sur photo (badge de période)", page: "r3-conseils", route: "/blog-pieces-auto/conseils/filtre-a-huile", w: 1440, h: 900, sel: 'div.relative.h-40 > span.inline-flex.items-center:text-is("9/2001 - 5/2005")' },
  { n: 7, nature: "fond uni clair (text-violet-100)", page: "r3-conseils", route: "/blog-pieces-auto/conseils/filtre-a-huile", w: 1440, h: 900, sel: 'div.rounded-xl.border-2 div.text-xs.font-semibold:text-is("Diagnostic rapide")' },
  { n: 8, nature: "texte blanc sur fond calculé blanc (lien « Voir les pièces »)", page: "r1-gamme", route: "/pieces/filtre-a-huile-7.html", w: 1440, h: 900, sel: 'div.flex-1.min-w-0 > div.inline-flex.items-center > span:text-is("Voir les pièces")' },
];
(async () => {
  const browser = await chromium.launch(); const aborted = []; const res = [];
  for (const c of CAS) {
    const ctx = await newContext(browser, { width: c.w, height: c.h, aborted });
    const p = await ctx.newPage(); await p.goto(BASE + c.route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4000); await scrollThrough(p);
    // première occurrence réellement peinte : ni rognée par un carrousel ni hors fenêtre une fois centrée
    const n = await p.locator(c.sel).count(); let idx = 0;
    for (let k = 0; k < n; k++) { const ok = await p.locator(c.sel).nth(k).evaluate((e) => { e.scrollIntoView({ block: "center", behavior: "instant" }); const rg = document.createRange(); rg.selectNodeContents(e); return !__dz.clippedBy(e, rg.getBoundingClientRect()); }); if (ok) { idx = k; break; } }
    const loc = p.locator(c.sel).nth(idx); const r = { ...c, occurrence: idx, at: new Date().toISOString() };
    try {
      await loc.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" })); await p.waitForTimeout(400);
      // cadre = rectangle des seuls nœuds texte de l'élément (Range), pour exclure icônes et voisins
      const box = await loc.evaluate((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((x) => x.width && x.height); const x0 = Math.min(...rs.map((x) => x.left)), y0 = Math.min(...rs.map((x) => x.top)), x1 = Math.max(...rs.map((x) => x.right)), y1 = Math.max(...rs.map((x) => x.bottom)); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; });
      const clip = { x: Math.max(0, box.x - 1), y: Math.max(0, box.y - 1), width: box.width + 2, height: box.height + 2 };
      const ctxClip = { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 30), width: box.width + 80, height: box.height + 60 };
      await p.screenshot({ path: path.join(outDir, "captures", `verif-${c.n}-contexte.png`), clip: ctxClip, animations: "disabled" });
      const css = await loc.evaluate((e) => { const cs = getComputedStyle(e); return { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, classes: e.className, texte: e.textContent.trim() }; });
      const f1 = path.join(outDir, "captures", `verif-${c.n}-texte.png`), f2 = path.join(outDir, "captures", `verif-${c.n}-fond.png`);
      await p.screenshot({ path: f1, clip, animations: "disabled" });
      await loc.evaluate((e) => { e.style.setProperty("color", "transparent", "important"); e.style.setProperty("-webkit-text-fill-color", "transparent", "important"); });
      await p.waitForTimeout(80);
      await p.screenshot({ path: f2, clip, animations: "disabled" });
      Object.assign(r, { css, capturesTexte: path.relative(outDir, f1), capturesFond: path.relative(outDir, f2), clip });
    } catch (e) { r.erreur = String(e.message).split("\n")[0]; }
    res.push(r); await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "mesures", "verif-manuelle-captures.json"), JSON.stringify({ cas: res, requetesAbandonnees: aborted }, null, 1));
  console.log(JSON.stringify(res.map((r) => [r.n, r.css && r.css.color, r.erreur || "ok"])));
})().catch((e) => { console.error(e); process.exit(1); });
