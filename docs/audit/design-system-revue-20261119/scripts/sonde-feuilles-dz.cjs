// Mandat DZ — sonde : feuilles de style réellement actives et règle « prefers-reduced-motion ».
// Vérifie sur la page rendue si animations.css (lien media="print" basculé en "all" par un onLoad React,
// frontend/app/root.tsx:416-423) est active, et si ses règles de réduction s'appliquent.
// Usage : node sonde-feuilles-dz.cjs <id> <chemin> <largeur> <hauteur> <dossier-sortie>
const fs = require("node:fs");
const path = require("node:path");
const { chromium, BASE, newContext, settle } = require("./lib-dz.cjs");
const [, , id, route, Ws, Hs, outDir] = process.argv;
(async () => {
  const browser = await chromium.launch(); const aborted = []; const out = { id, route, viewport: `${Ws}x${Hs}`, debut: new Date().toISOString() };
  for (const rm of ["no-preference", "reduce"]) {
    const ctx = await newContext(browser, { width: Number(Ws), height: Number(Hs), reducedMotion: rm, aborted });
    const p = await ctx.newPage(); const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 5000);
    out[rm] = await p.evaluate(() => {
      const liens = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => ({ href: l.getAttribute("href"), media: l.media, sheetChargee: !!l.sheet, regles: l.sheet ? (() => { try { return l.sheet.cssRules.length; } catch { return "illisible"; } })() : null }));
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const anims = document.getAnimations().map((a) => { const t = a.effect.getTiming(); return { nom: a.animationName || a.constructor.name, iterations: t.iterations === Infinity ? "infinie" : t.iterations, dureeMs: t.duration, etat: a.playState }; });
      return { reduceActif: reduce, liens, animations: anims, scrollBehaviorHtml: getComputedStyle(document.documentElement).scrollBehavior, styleInlineHtml: document.documentElement.getAttribute("style") };
    });
    out[rm].statut = resp && resp.status(); out[rm].at = new Date().toISOString();
    await ctx.close();
  }
  out.requetesAbandonnees = aborted; out.fin = new Date().toISOString();
  await browser.close();
  fs.writeFileSync(path.join(outDir, "mesures", `feuilles-${id}-${Ws}.json`), JSON.stringify(out, null, 1));
  const a = out.reduce.liens.find((l) => /animations\.css/.test(l.href || ""));
  console.log(`[feuilles-${id}-${Ws}]`, JSON.stringify({ animationsCss: a, animsReduce: out.reduce.animations.length, infiniesReduce: out.reduce.animations.filter((x) => x.iterations === "infinie").length, scroll: out.reduce.scrollBehaviorHtml }));
})().catch((e) => { console.error(e); process.exit(1); });
