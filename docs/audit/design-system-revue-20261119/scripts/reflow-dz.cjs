// Mandat DZ — points 6.3 et 6.4 pour une page (script neuf, sans équivalent chez DU).
// 1) 320×640 : défilement horizontal du document et éléments qui dépassent.
// 2) Zoom 200 % sur 1280×800 : émulé par une fenêtre de 640×400 px CSS à densité 2 (même largeur CSS,
//    mêmes points de rupture que le zoom du navigateur). Textes coupés, superposés, contrôles perdus,
//    comparés à 1280×800 sans zoom.
// 3) 1280×800 sans zoom, espacements WCAG 1.4.12 imposés : textes coupés ou superposés nouveaux.
// Usage : node reflow-dz.cjs <id> <chemin> <dossier-sortie>
const fs = require("node:fs");
const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("./lib-dz.cjs");
const [, , id, route, outDir] = process.argv;
const url = BASE + route;
const SPACING = "*{line-height:1.5 !important;letter-spacing:0.12em !important;word-spacing:0.16em !important} p{margin-bottom:2em !important}";

// relevé dans la page : débordement, textes coupés, superpositions, contrôles visibles
const PROBE = () => {
  const vw = document.documentElement.clientWidth;
  const res = { largeurDocument: document.documentElement.scrollWidth, largeurFenetre: vw };
  res.defilementHorizontal = res.largeurDocument > vw + 1;
  const clipsX = (e) => { for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return true; } return false; };
  const over = [];
  for (const e of document.body.querySelectorAll("*")) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const cs = getComputedStyle(e); if (cs.position === "fixed" && (r.left >= vw || r.right <= 0)) continue; // tiroir hors écran
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (clipsX(e)) continue;
    over.push(e);
  }
  const overSet = new Set(over); const racines = over.filter((e) => !overSet.has(e.parentElement));
  res.depassements = racines.slice(0, 15).map((e) => { const r = e.getBoundingClientRect(); return { sel: __dz.sel(e), zone: __dz.zone(e), gauche: Math.round(r.left), droite: Math.round(r.right), largeur: Math.round(r.width), classes: __dz.cls(e).slice(0, 10).join(" ") }; });
  res.nbDepassements = racines.length;
  // textes coupés : élément porteur de texte dont le contenu déborde d'une boîte qui coupe
  const coupes = [];
  const textEls = []; const seenEl = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue; if (!seenEl.has(el)) { seenEl.add(el); if (__dz.visible(el)) textEls.push(el); } }
  for (const el of textEls) {
    for (let a = el, d = 0; a && d < 3; a = a.parentElement, d++) {
      const s = getComputedStyle(a);
      const cut = (/(hidden|clip)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 2) || (/(hidden|clip)/.test(s.overflowY) && a.scrollHeight > a.clientHeight + 2);
      if (cut) { coupes.push({ sel: __dz.sel(a), zone: __dz.zone(a), texte: el.textContent.trim().replace(/\s+/g, " ").slice(0, 50), ellipse: s.textOverflow === "ellipsis", lineClamp: s.webkitLineClamp !== "none" && s.webkitLineClamp !== "" ? s.webkitLineClamp : null, debordePx: [a.scrollWidth - a.clientWidth, a.scrollHeight - a.clientHeight] }); break; }
    }
  }
  const uniq = new Map(); for (const c of coupes) uniq.set(c.sel + "|" + c.texte, c);
  res.textesCoupes = [...uniq.values()];
  // superpositions : boîtes de texte (Range) de deux éléments sans lien de parenté qui se chevauchent
  const boxes = [];
  for (const el of textEls) {
    if (__dz.fixedAncestor(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(el);
    for (const r of rg.getClientRects()) if (r.width > 2 && r.height > 2) boxes.push({ el, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
  }
  boxes.sort((a, b) => a.y - b.y);
  const sup = new Map();
  for (let i = 0; i < boxes.length; i++) {
    const A = boxes[i];
    for (let j = i + 1; j < boxes.length && boxes[j].y < A.y + A.h; j++) {
      const B = boxes[j]; if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > 3 && oy > 3 && ox * oy > 0.15 * Math.min(A.w * A.h, B.w * B.h)) {
        const k = __dz.sel(A.el) + " ⟷ " + __dz.sel(B.el);
        if (!sup.has(k)) sup.set(k, { a: __dz.sel(A.el), texteA: A.el.textContent.trim().replace(/\s+/g, " ").slice(0, 30), b: __dz.sel(B.el), texteB: B.el.textContent.trim().replace(/\s+/g, " ").slice(0, 30), zone: __dz.zone(A.el), recouvrementPx: Math.round(ox) + "×" + Math.round(oy) });
      }
    }
  }
  res.textesSuperposes = [...sup.values()].slice(0, 40); res.nbSuperpositions = sup.size;
  // contrôles visibles (pour « fonction perdue »)
  res.controles = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select")].filter((e) => __dz.visible(e)).map((e) => (e.tagName === "A" ? "a " + e.getAttribute("href") : e.tagName.toLowerCase() + " " + (e.getAttribute("aria-label") || e.textContent || e.name || "").replace(/\s+/g, " ").trim().slice(0, 30)));
  res.controlesTous = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select")].map((e) => (e.tagName === "A" ? "a " + e.getAttribute("href") : e.tagName.toLowerCase() + " " + (e.getAttribute("aria-label") || e.textContent || e.name || "").replace(/\s+/g, " ").trim().slice(0, 30)));
  return res;
};

async function run(browser, opts, inject, aborted) {
  const ctx = await newContext(browser, { ...opts, aborted });
  const p = await ctx.newPage();
  const resp = await p.goto(url, { waitUntil: "load", timeout: 120000 }); await settle(p, 3500);
  await scrollThrough(p);
  // content-visibility:auto rend la mise en page hors écran non fiable (taille réservée) : neutralisé à l'identique sur tous les rendus
  await p.addStyleTag({ content: "*{content-visibility:visible !important}" }); await p.waitForTimeout(300);
  if (inject) { await p.addStyleTag({ content: inject }); await p.waitForTimeout(800); }
  const r = await p.evaluate(PROBE);
  r.statut = resp && resp.status(); r.at = new Date().toISOString();
  return { r, p, ctx };
}

(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const out = { id, route, url, debut: new Date().toISOString() };
  const capDir = path.join(outDir, "captures"); fs.mkdirSync(capDir, { recursive: true });
  // 6.3 — 320×640
  {
    const { r, p, ctx } = await run(browser, { width: 320, height: 640 }, null, aborted);
    delete r.controles; delete r.controlesTous; out.l320 = r;
    if (r.defilementHorizontal) { await p.screenshot({ path: path.join(capDir, `${id}-320-ecran.jpg`), type: "jpeg", quality: 50 }); r.capture = `captures/${id}-320-ecran.jpg`; }
    await ctx.close();
  }
  // référence 1280×800 sans zoom
  const base = await run(browser, { width: 1280, height: 800 }, null, aborted); await base.ctx.close();
  // 6.4 a — zoom 200 %
  {
    const { r, p, ctx } = await run(browser, { width: 640, height: 400, dsf: 2 }, null, aborted);
    const baseCoupes = new Set(base.r.textesCoupes.map((c) => c.sel + "|" + c.texte));
    const baseSup = new Set(base.r.textesSuperposes.map((s) => s.a + "|" + s.b));
    r.textesCoupesNouveaux = r.textesCoupes.filter((c) => !baseCoupes.has(c.sel + "|" + c.texte));
    r.textesSuperposesNouveaux = r.textesSuperposes.filter((s) => !baseSup.has(s.a + "|" + s.b));
    // contrôles visibles à 1280 absents du DOM à 200 % (absents, pas seulement repliés dans un menu)
    const tous = new Set(r.controlesTous);
    r.controlesAbsentsDuDom = [...new Set(base.r.controles)].filter((c) => !tous.has(c));
    const vis = new Set(r.controles);
    r.controlesMasques = [...new Set(base.r.controles)].filter((c) => !vis.has(c) && tous.has(c)).length;
    delete r.controles; delete r.controlesTous;
    await p.screenshot({ path: path.join(capDir, `${id}-zoom200-ecran.jpg`), type: "jpeg", quality: 45 }); r.capture = `captures/${id}-zoom200-ecran.jpg`;
    out.zoom200 = r; await ctx.close();
  }
  // 6.4 b — espacements WCAG 1.4.12
  {
    const { r, ctx } = await run(browser, { width: 1280, height: 800 }, SPACING, aborted);
    const baseCoupes = new Set(base.r.textesCoupes.map((c) => c.sel + "|" + c.texte));
    const baseSup = new Set(base.r.textesSuperposes.map((s) => s.a + "|" + s.b));
    r.textesCoupesNouveaux = r.textesCoupes.filter((c) => !baseCoupes.has(c.sel + "|" + c.texte));
    r.textesSuperposesNouveaux = r.textesSuperposes.filter((s) => !baseSup.has(s.a + "|" + s.b));
    delete r.controles; delete r.controlesTous; out.espacements = r; await ctx.close();
  }
  delete base.r.controles; delete base.r.controlesTous; out.reference1280 = base.r;
  out.requetesAbandonnees = aborted; out.fin = new Date().toISOString();
  await browser.close();
  fs.writeFileSync(path.join(outDir, "mesures", `${id}-reflow.json`), JSON.stringify(out, null, 1));
  console.log(`[${id}-reflow]`, JSON.stringify({ l320: [out.l320.largeurDocument, out.l320.nbDepassements], zoomCoupes: out.zoom200.textesCoupesNouveaux.length, zoomSup: out.zoom200.textesSuperposesNouveaux.length, absents: out.zoom200.controlesAbsentsDuDom.length, espCoupes: out.espacements.textesCoupesNouveaux.length, espSup: out.espacements.textesSuperposesNouveaux.length }));
})().catch((e) => { console.error(e); process.exit(1); });
