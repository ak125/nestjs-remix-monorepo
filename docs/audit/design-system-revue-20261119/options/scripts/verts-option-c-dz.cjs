#!/usr/bin/env node
// Complément n° 3 DZ — éléments verts visibles dans le même écran que le bouton d'achat, r2-produit, option C.
// Usage : node scripts/verts-option-c-dz.cjs <id> <chemin> <L> <H> <dossier-options> <dossier-brut> [variante=c]
// Deux écrans : (1) premier écran, page en haut ; (2) premier écran où le bouton « Ajouter … au panier »
// est entièrement visible (défilement minimal, bouton placé à 70 % de la hauteur), si (1) ne le montre pas.
// Un élément est « vert » si une de ses couleurs visibles (texte, fond, bord, fill, stroke, dégradé) a une teinte
// de 75° à 170°, une saturation ≥ 0,25 et une luminosité de 0,12 à 0,85 (le #1E8449 du bouton C en fait partie).
// Troisième relevé : toute la page, sans filtre de fenêtre (res.toutePage). Variante « avant » possible pour comparer.
// Lecture seule : aucune requête non GET (lib-dz), aucun clic, aucune saisie. Capture annotée : cadres numérotés.
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("../../scripts/lib-dz.cjs");
const { injecte, presence } = require("./injection-dz.cjs");
const [id, route, Ws, Hs, optDir, brut, v = "c"] = process.argv.slice(2); const W = +Ws, H = +Hs;
const ACHAT = 'button[aria-label^="Ajouter"][aria-label$="au panier"], button.bg-orange-500.rounded-xl';

async function verts(page, toutePage = false) {
  return page.evaluate(([ACHAT, toutePage]) => {
    // Conversion par canvas : lit aussi oklch(), lab(), color() (Tailwind 4), pas seulement rgb().
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgb = (s) => { if (!s || s === "none" || s === "transparent") return null; cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = s; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const hex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("").toUpperCase();
    const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, s, l }; };
    const vert = (c) => { if (!c || c.a < 0.2) return false; const x = hsl(c); return x.h >= 75 && x.h <= 170 && x.s >= 0.25 && x.l >= 0.12 && x.l <= 0.85; };
    const achats = [...document.querySelectorAll(ACHAT)];
    const out = []; const vus = new Set();
    for (const e of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      if (!toutePage && (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth)) continue;
      // élément masqué par un autre au centre : ignoré (le point central doit tomber sur lui ou un descendant/ancêtre)
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      if (!toutePage) { const t = document.elementFromPoint(cx, cy); if (t && !(e.contains(t) || t.contains(e))) continue; }
      const props = [];
      const txt = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (txt && vert(rgb(cs.color))) props.push(["texte", hex(rgb(cs.color))]);
      if (vert(rgb(cs.backgroundColor))) props.push(["fond", hex(rgb(cs.backgroundColor))]);
      for (const m of (cs.backgroundImage.match(/(rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/g) || [])) if (vert(rgb(m))) { props.push(["dégradé", hex(rgb(m))]); break; }
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && vert(rgb(cs.borderTopColor))) props.push(["bord", hex(rgb(cs.borderTopColor))]);
      if (e instanceof SVGElement) { if (cs.fill !== "none" && vert(rgb(cs.fill))) props.push(["fill", hex(rgb(cs.fill))]); if (cs.stroke !== "none" && vert(rgb(cs.stroke))) props.push(["stroke", hex(rgb(cs.stroke))]); }
      if (!props.length) continue;
      // un SVG ou un texte vert dans un parent déjà listé avec la même couleur n'est pas recompté
      let p = e.parentElement, dup = false; while (p) { if (vus.has(p) && out.find((o) => o.el === p && o.props.some((x) => props.some((y) => y[1] === x[1])))) { dup = true; break; } p = p.parentElement; }
      if (dup) continue; vus.add(e);
      const estAchat = achats.some((a) => a === e || a.contains(e));
      out.push({ el: e, tag: e.tagName.toLowerCase(), texte: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50), classes: String(e.className.baseVal ?? e.className).slice(0, 120), props, rect: [r.left, r.top, r.width, r.height].map(Math.round), docY: Math.round(r.top + scrollY), achat: estAchat });
    }
    // Les éléments à l'intérieur du bouton d'achat (icône, texte) sont regroupés avec lui.
    const liste = out.filter((o) => !(o.achat && !o.el.matches(ACHAT)));
    const boutons = achats.map((a) => { const r = a.getBoundingClientRect(); return { texte: (a.innerText || "").trim(), rect: [r.left, r.top, r.width, r.height].map(Math.round), entierementVisible: r.top >= 0 && r.bottom <= innerHeight && r.width > 0 }; });
    return { scrollY: Math.round(scrollY), boutonsAchat: boutons, verts: liste.map(({ el, ...o }) => o) };
  }, [ACHAT, toutePage]);
}

async function annote(src, dst, liste) {
  const { execFileSync } = require("node:child_process");
  const args = [src, "-fill", "none", "-strokewidth", "3"];
  liste.forEach((o, i) => { const [x, y, w, h] = o.rect; const col = o.achat ? "#C2410C" : "#7C3AED";
    args.push("-stroke", col, "-draw", `rectangle ${Math.max(x - 2, 0)},${Math.max(y - 2, 0)} ${x + w + 1},${y + h + 1}`);
    args.push("-stroke", "none", "-fill", col, "-draw", `rectangle ${Math.max(x - 2, 0)},${Math.max(y - 22, 0)} ${Math.max(x - 2, 0) + 26},${Math.max(y - 22, 0) + 20}`,
      "-fill", "white", "-font", "DejaVu-Sans-Bold", "-pointsize", "14", "-annotate", `+${Math.max(x - 2, 0) + 4}+${Math.max(y - 22, 0) + 16}`, String(i + 1), "-fill", "none"); });
  execFileSync("convert", [...args, dst]);
}

(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
  const res = { id, route, viewport: `${W}x${H}`, variante: v, debut: new Date().toISOString(), critere: "teinte 75°–170°, saturation ≥ 0,25, luminosité 0,12–0,85 ; élément visible, non recouvert en son centre ; texte, fond, dégradé, bord, fill, stroke", ecrans: [] };
  const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); res.statut = resp && resp.status();
  await settle(p, 4500); res.injection = [await injecte(p, v)];
  await scrollThrough(p); await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(1200); await p.mouse.move(1, 1);
  const prendre = async (nom) => {
    const f = path.join(brut, `verts-${id}-${W}-${v}-${nom}.png`); await p.screenshot({ path: f, animations: "disabled" });
    const r = await verts(p); await annote(f, path.join(brut, `verts-${id}-${W}-${v}-${nom}-annote.png`), r.verts);
    res.ecrans.push({ ecran: nom, ...r, nombreVertsHorsAchat: r.verts.filter((o) => !o.achat).length, capture: `verts-${id}-${W}-${v}-${nom}-annote` });
  };
  await prendre("premier-ecran");
  const vis = res.ecrans[0].boutonsAchat.some((b) => b.texte.startsWith("Ajouter") && b.entierementVisible);
  if (!vis) {
    const ok = await p.evaluate(() => { const a = document.querySelector('button[aria-label^="Ajouter"][aria-label$="au panier"]'); if (!a) return false; const r = a.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, scrollY + r.top - innerHeight * 0.7), behavior: "instant" }); return true; });
    if (ok) { await p.waitForTimeout(1200); await p.mouse.move(1, 1); await prendre("ecran-du-bouton-ajouter"); }
  }
  // Toute la page (sans filtre de fenêtre ni de recouvrement) : où sont les verts, position verticale docY.
  const tp = await verts(p, true); res.toutePage = { verts: tp.verts.map(({ rect, ...o }) => o), nombreHorsAchat: tp.verts.filter((o) => !o.achat).length };
  res.injection.push({ etape: "fin", ...(await presence(p)) }); res.requetesAbandonnees = aborted; res.fin = new Date().toISOString();
  fs.writeFileSync(path.join(optDir, "mesures", `verts-${id}-${W}-${v}.json`), JSON.stringify(res, null, 1));
  await browser.close();
  console.log(id, W, v, res.ecrans.map((e) => `${e.ecran} (scrollY ${e.scrollY}) : ${e.nombreVertsHorsAchat} verts hors achat, achat visible ${e.boutonsAchat.filter((b) => b.entierementVisible).map((b) => b.texte).join("+") || "non"}`).join(" | "));
})().catch((e) => { console.error(e); process.exit(1); });
