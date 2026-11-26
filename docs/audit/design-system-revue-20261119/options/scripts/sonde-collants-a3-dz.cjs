#!/usr/bin/env node
// Complément n° 5 DZ : sonde des éléments collants et fixes d'une page sous une variante (hauteur de l'en-tête, de la barre
// d'outils R2 collante, des barres fixes du bas), à plusieurs positions de défilement. Sert à régler les marges de défilement
// de la feuille A3. Lecture seule : requêtes non GET abandonnées (lib-dz), aucun clic, aucune saisie.
// Usage : node scripts/sonde-collants-a3-dz.cjs <id> <chemin> <L> <H> <variante> [y1,y2,...]  → JSON sur la sortie standard.
const { chromium, BASE, newContext, settle } = require("../../scripts/lib-dz.cjs");
const { injecte } = require("./injection-dz.cjs");
const [id, route, Ws, Hs, v = "a3", ys = "0,1500,3000"] = process.argv.slice(2); const W = +Ws, H = +Hs;
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
  const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4500);
  const inj = await injecte(p, v); const pos = [];
  for (const y of ys.split(",").map(Number)) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await p.waitForTimeout(700);
    pos.push(await p.evaluate(() => {
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height, b.bottom].map(Math.round); };
      const sp = getComputedStyle(document.documentElement);
      const coll = [...document.querySelectorAll("body *")].filter((e) => { const p = getComputedStyle(e).position; if (p !== "fixed" && p !== "sticky") return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight; })
        .map((e) => ({ tag: e.tagName.toLowerCase(), position: getComputedStyle(e).position, classes: (e.getAttribute("class") || "").slice(0, 90), aria: e.getAttribute("aria-label"), rect: r(e) }));
      return { scrollY: Math.round(scrollY), navbarHeight: sp.getPropertyValue("--navbar-height").trim(), bottomNavHeight: sp.getPropertyValue("--bottom-nav-height").trim(), scrollPaddingTop: sp.scrollPaddingTop, scrollPaddingBottom: sp.scrollPaddingBottom, collants: coll };
    }));
  }
  console.log(JSON.stringify({ id, route, viewport: `${W}x${H}`, variante: v, statut: resp && resp.status(), injection: inj, positions: pos, requetesAbandonnees: aborted }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
