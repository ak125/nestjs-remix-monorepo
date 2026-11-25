#!/usr/bin/env node
// Complément n° 5 DZ, point 3 : recouvrement du bouton « Rechercher des pièces » (VehicleSelector, mode mobile-premium) par les
// éléments fixes ou collants, sous une variante : premier écran sans défilement, puis scrollIntoView end / center / start
// (scrollIntoView suit scroll-padding, comme le défilement provoqué par une ancre ou une prise de focus).
// Lecture seule : requêtes non GET abandonnées (lib-dz), aucun clic, aucune saisie.
// Usage : node scripts/sonde-recouvrement-a3-dz.cjs <id> <chemin> <L> <H> <avant|a2|a3> <dossier-options> <dossier-brut>
//   → <dossier-options>/mesures/recouvrement-rechercher-<id>-<L>-<v>.json ; captures PNG dans <dossier-brut>.
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle } = require("../../scripts/lib-dz.cjs");
const { injecte } = require("./injection-dz.cjs");
const [id, route, Ws, Hs, v, OPT, BRUT] = process.argv.slice(2); const W = +Ws, H = +Hs;
(async () => {
  const b = await chromium.launch(); const aborted = []; const ctx = await newContext(b, { width: W, height: H, aborted }); const p = await ctx.newPage();
  const res = { id, route, viewport: `${W}x${H}`, variante: v, debut: new Date().toISOString(), positions: [] };
  const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); res.statut = resp && resp.status(); await settle(p, 4500);
  res.injection = v === "avant" ? { variante: "avant", injectee: false } : await injecte(p, v);
  const mesure = () => {
    const btn = [...document.querySelectorAll("button")].find((e) => /Rechercher des pi/.test(e.innerText) && e.getBoundingClientRect().width > 0);
    if (!btn) return { bouton: null };
    const r = btn.getBoundingClientRect(); const sp = getComputedStyle(document.documentElement);
    const fixes = [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); return (s.position === "fixed" || s.position === "sticky") && s.display !== "none" && s.visibility !== "hidden" && e.getBoundingClientRect().height > 0 && !e.contains(btn); })
      .map((e) => { const q = e.getBoundingClientRect(); const ix = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)), iy = Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top)); return { tag: e.tagName.toLowerCase(), position: getComputedStyle(e).position, zIndex: getComputedStyle(e).zIndex, classes: String(e.className).slice(0, 110), aria: e.getAttribute("aria-label"), rect: [q.left, q.top, q.width, q.height].map(Math.round), recouvrementPx: [Math.round(ix), Math.round(iy)] }; })
      .filter((x) => x.recouvrementPx[0] > 0 && x.recouvrementPx[1] > 0);
    const t = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
    return { scrollY: Math.round(scrollY), scrollPaddingTop: sp.scrollPaddingTop, scrollPaddingBottom: sp.scrollPaddingBottom, bouton: [r.left, r.top, r.width, r.height].map(Math.round), dansFenetre: r.top >= 0 && r.bottom <= innerHeight, centreCouvertPar: t && !btn.contains(t) ? `${t.tagName.toLowerCase()}.${String(t.className).slice(0, 60)}` : null, recouvrementMaxPx: fixes.reduce((m, x) => Math.max(m, x.recouvrementPx[1]), 0), fixes };
  };
  for (const mode of ["premier-ecran", "end", "center", "start"]) {
    if (mode !== "premier-ecran") await p.evaluate((m) => { const btn = [...document.querySelectorAll("button")].find((e) => /Rechercher des pi/.test(e.innerText) && e.getBoundingClientRect().width > 0); btn && btn.scrollIntoView({ block: m }); }, mode);
    await p.waitForTimeout(700);
    res.positions.push({ mode, ...(await p.evaluate(mesure)) });
    await p.screenshot({ path: path.join(BRUT, `recouvrement-${id}-${W}-${v}-${mode}.png`) });
  }
  res.requetesAbandonnees = aborted; res.fin = new Date().toISOString();
  const f = path.join(OPT, "mesures", `recouvrement-rechercher-${id}-${W}-${v}.json`); fs.writeFileSync(f, JSON.stringify(res, null, 1));
  console.log(f, res.positions.map((x) => `${x.mode}:${x.recouvrementMaxPx}px${x.centreCouvertPar ? " centre couvert" : ""}`).join(" "));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
