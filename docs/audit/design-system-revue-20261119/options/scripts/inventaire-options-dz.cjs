// Complément n° 2 DZ — inventaire des classes de couleur réellement rendues (lecture seule), pour écrire
// les sélecteurs de options/option-a.css et option-b.css. Aucune feuille injectée ici.
// Usage (depuis options/) : NODE_PATH=/opt/automecanik/app/node_modules node scripts/inventaire-options-dz.cjs <id> <chemin> <W> <H> .
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("../../scripts/lib-dz.cjs");
const [, , id, route, Ws, Hs, outDir] = process.argv; const W = +Ws, H = +Hs;
const COUL = /(^|:)(text|bg|border|ring|from|via|to|fill|stroke|outline|shadow|decoration|divide|accent|placeholder)-(orange|amber|yellow|cta|blue|sky|indigo|violet|purple|pink|rose|fuchsia|red|green|emerald|lime|teal|cyan|gray|slate|zinc|neutral|white|black|navy|primary|secondary|muted|destructive|input|foreground|background|card|accent|ring|success|warning|danger|info|semantic)/;
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
  const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4500); await scrollThrough(p);
  const inv = await p.evaluate((re) => {
    const RE = new RegExp(re); const classes = {}; const degr = []; const achat = [];
    for (const e of document.querySelectorAll("body *")) {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cl = typeof e.className === "string" ? e.className : (e.getAttribute("class") || "");
      for (const c of cl.split(/\s+/)) if (RE.test(c)) classes[c] = (classes[c] || 0) + 1;
      const bi = getComputedStyle(e).backgroundImage; if (bi.includes("gradient")) degr.push({ tag: e.tagName.toLowerCase(), classes: cl.slice(0, 220), bi: bi.slice(0, 160) });
      if (/^(BUTTON|A|INPUT)$/.test(e.tagName)) {
        const t = (e.innerText || e.value || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
        if (/ajouter|panier|commander|payer|connecter|connexion|valider|cr[ée]er|continuer|acheter/i.test(t))
          achat.push({ tag: e.tagName.toLowerCase(), type: e.type || "", texte: t.slice(0, 60), aria: e.getAttribute("aria-label"), testid: e.getAttribute("data-testid"), classes: cl.slice(0, 400), bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color, enTete: !!e.closest("header,nav"), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return { classes: Object.fromEntries(Object.entries(classes).sort((a, b) => b[1] - a[1])), degrades: degr.slice(0, 60), achat };
  }, COUL.source);
  fs.writeFileSync(path.join(outDir, "mesures", `inventaire-${id}-${W}.json`), JSON.stringify({ id, route, viewport: `${W}x${H}`, statut: resp && resp.status(), at: new Date().toISOString(), ...inv, requetesAbandonnees: aborted }));
  await browser.close(); console.log(id, W, Object.keys(inv.classes).length, "classes", inv.achat.length, "boutons candidats");
})().catch((e) => { console.error(e); process.exit(1); });
