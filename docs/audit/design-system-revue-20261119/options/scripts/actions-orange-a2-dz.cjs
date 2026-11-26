#!/usr/bin/env node
// Complément n° 4 DZ — actions orange par écran, option A2 : « une seule action principale orange par écran visible ».
// Usage (depuis options/) : node scripts/actions-orange-a2-dz.cjs <id> <chemin> <L> <H> <dossier-options> [variante=a2]
// Compte les boutons et liens visibles dont le fond calculé est orange (teinte 15°–45°, saturation ≥ 0,45, luminosité
// 0,3–0,9 : #F97316, #EA580C, #FED7AA…), non recouverts en leur centre, sur trois vues : premier écran (page en haut),
// chaque écran successif de la page (défilement d'une hauteur d'écran), et toute la page. Le logo (texte) n'est pas une action.
// Lecture seule : requêtes non GET abandonnées (lib-dz), aucun clic, aucune saisie. Écrit mesures/actions-orange-<id>-<L>-<v>.json.
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("../../scripts/lib-dz.cjs");
const { injecte, presence } = require("./injection-dz.cjs");
const [id, route, Ws, Hs, optDir, v = "a2"] = process.argv.slice(2); const W = +Ws, H = +Hs;
const lister = (page) => page.evaluate(() => {
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgb = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const hex = (o) => "#" + [o.r, o.g, o.b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  const orange = (o) => { if (o.a < 0.5) return false; const r = o.r / 255, g = o.g / 255, b = o.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return false;
    const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return h >= 15 && h <= 45 && s >= 0.45 && l >= 0.3 && l <= 0.9; };
  const out = [];
  for (const e of document.querySelectorAll('button, a, [role="button"], input[type="submit"]')) {
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue; const c = rgb(cs.backgroundColor); if (!orange(c)) continue;
    const dansEcran = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; const partiel = !dansEcran && r.bottom > 0 && r.top < innerHeight;
    let recouvert = false; if (dansEcran || partiel) { const t = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1)); recouvert = !!t && !(e.contains(t) || t.contains(e)); }
    out.push({ texte: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50), balise: e.tagName.toLowerCase(), fond: hex(c), desactive: !!e.disabled, collant: ["fixed", "sticky"].includes(cs.position) || !!e.closest('[class~="fixed"], [class~="sticky"]'), rect: [r.left, r.top + scrollY, r.width, r.height].map(Math.round), entierDansEcran: dansEcran && !recouvert, partiel: partiel && !recouvert });
  }
  return { scrollY: Math.round(scrollY), hauteurPage: document.documentElement.scrollHeight, actions: out };
});
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
  const res = { id, route, viewport: `${W}x${H}`, variante: v, debut: new Date().toISOString(), critere: "bouton ou lien visible, fond calculé orange (teinte 15°–45°, saturation ≥ 0,45, luminosité 0,3–0,9), non recouvert en son centre", ecrans: [] };
  const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); res.statut = resp && resp.status();
  await settle(p, 4500); res.injection = [await injecte(p, v)];
  await scrollThrough(p); await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(1200); await p.mouse.move(1, 1);
  const tout = await lister(p); res.toutePage = { nombre: tout.actions.length, actions: tout.actions.map(({ entierDansEcran, partiel, ...a }) => a) };
  for (let y = 0, i = 0; y < tout.hauteurPage && i < 40; y += H, i++) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await p.waitForTimeout(500);
    const l = await lister(p); const ent = l.actions.filter((a) => a.entierDansEcran);
    res.ecrans.push({ ecran: i, scrollY: l.scrollY, entieres: ent.length, partielles: l.actions.filter((a) => a.partiel).length, textes: ent.map((a) => `${a.texte}${a.collant ? " (collant)" : ""}${a.desactive ? " (désactivé)" : ""} ${a.fond}`) });
    if (l.scrollY + H >= tout.hauteurPage) break;
  }
  res.premierEcran = res.ecrans[0]; res.ecransAPlusieurs = res.ecrans.filter((e) => e.entieres > 1).length; res.maxParEcran = Math.max(0, ...res.ecrans.map((e) => e.entieres));
  res.injection.push({ etape: "fin", ...(await presence(p)) }); res.requetesAbandonnees = aborted; res.fin = new Date().toISOString();
  fs.writeFileSync(path.join(optDir, "mesures", `actions-orange-${id}-${W}-${v}.json`), JSON.stringify(res, null, 1));
  await browser.close();
  console.log(id, W, v, `premier écran ${res.premierEcran.entieres} [${res.premierEcran.textes.join(" ; ")}]`, `| écrans ${res.ecrans.length}, à plusieurs ${res.ecransAPlusieurs}, max ${res.maxParEcran} | page ${res.toutePage.nombre}`);
})().catch((e) => { console.error(e); process.exit(1); });
