// Complément n° 2 DZ — captures AVANT / OPTION A / OPTION B d'une page à une taille, résidus de couleur, bouton d'achat.
// AVANT = page servie telle quelle ; A et B = même page, feuille injectée (injection-dz.cjs) après chargement.
// Sorties : <brut>/<id>-<W>-<v>-ecran.png et -page.png (sources des planches, hors dépôt), <brut>/bouton-*.png,
//           <options>/mesures/captures-<id>-<W>.json (injection, résidus, ratios du bouton par état).
// Lecture seule : les requêtes non GET sont abandonnées et consignées (lib-dz.cjs). Aucun clic, aucune saisie.
// Usage (depuis options/) : node scripts/options-captures-dz.cjs <id> <chemin> <W> <H> <dossier-options> <dossier-brut> [variantes]
// [variantes] (complément n° 3) : liste séparée par des virgules, par défaut avant,a,b ; autre liste ⇒ sortie captures-<id>-<W>-<liste>.json.
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("../../scripts/lib-dz.cjs");
const { injecte, presence } = require("./injection-dz.cjs");
const [, , id, route, Ws, Hs, optDir, brut, vlist = "avant,a,b"] = process.argv; const W = +Ws, H = +Hs; const VARIANTES = vlist.split(",");
fs.mkdirSync(brut, { recursive: true });
const ACHAT = [
  { nom: "Ajouter … au panier", sel: 'button[aria-label^="Ajouter"][aria-label$="au panier"]' },
  { nom: "Panier (bouton collant)", sel: 'button.bg-orange-500.rounded-xl' },
  { nom: "Se connecter (bouton principal du formulaire)", sel: 'form[method="post" i] button[type="submit"]' },
];
const PAGE_FN = () => {
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgb = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const hex = (o) => "#" + [o.r, o.g, o.b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  const lum = (o) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(o.r) + 0.7152 * f(o.g) + 0.0722 * f(o.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
  const blend = (f, b) => ({ r: Math.round(f.r * f.a + b.r * (1 - f.a)), g: Math.round(f.g * f.a + b.g * (1 - f.a)), b: Math.round(f.b * f.a + b.b * (1 - f.a)), a: 1 });
  const fondDe = (e) => { const pile = []; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); const g = cs.backgroundImage.match(/(rgba?|oklch|oklab|lab|color)\([^)]*\)/); if (g && cs.backgroundImage.includes("gradient")) { pile.push(rgb(g[0])); break; } const c = rgb(cs.backgroundColor); if (c.a > 0) { pile.push(c); if (c.a >= 0.99) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (const c of pile.reverse()) b = blend(c, b); return b; };
  const hsl = (o) => { const r = o.r / 255, g = o.g / 255, b = o.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
  return { rgb, hex, ratio, blend, fondDe, hsl };
};
async function residus(page) {
  return page.evaluate(([fnSrc, achatSels]) => {
    const { rgb, hex, hsl } = eval("(" + fnSrc + ")")();
    const OK = ["#0F1E38", "#0F4C81", "#1E8449", "#C0392B", "#FEF3C7"];
    const ACH = ["#F97316", "#EA580C", "#C2410C", "#9A3412", "#1E8449", "#196F3D"];
    const fam = (c) => { if (c.a < 0.35) return null; const x = hsl(c); if (x.s < 0.45 || x.l < 0.3 || x.l > 0.9) return null; const h = x.h;
      if (h >= 15 && h < 65) return "orange, ambre, jaune"; if (h >= 65 && h < 170) return "vert vif"; if (h >= 170 && h < 255) return "bleu, cyan"; if (h >= 255 && h < 340) return "violet, rose"; return "rouge, corail"; };
    const out = {}; const ex = {}; let n = 0;
    const add = (f, e, prop, c) => { out[f] = (out[f] || 0) + 1; (ex[f] = ex[f] || []).length < 6 && ex[f].push({ prop, couleur: hex(c), balise: e.tagName.toLowerCase(), classes: (e.getAttribute("class") || "").slice(0, 90), texte: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40) }); };
    for (const e of document.querySelectorAll("body *")) {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
      const dansAchat = achatSels.some((s) => e.closest(s));
      const props = [["color", cs.color], ["background-color", cs.backgroundColor]];
      if (parseFloat(cs.borderTopWidth) > 0) props.push(["border-color", cs.borderTopColor]);
      if (e instanceof SVGElement) { props.push(["fill", cs.fill], ["stroke", cs.stroke]); }
      for (const m of cs.backgroundImage.includes("gradient") ? cs.backgroundImage.match(/(rgba?|oklch|oklab|lab|color)\([^)]*\)/g) || [] : []) props.push(["background-image (dégradé)", m]);
      for (const [p, v] of props) { if (!v || v === "none" || v.startsWith("url")) continue; if (p === "color" && !(e.childNodes && [...e.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) && !(e instanceof SVGElement)) continue;
        const c = rgb(v); const h = hex(c); if (OK.includes(h) || (dansAchat && ACH.includes(h))) continue; const f = fam(c); if (f) { add(f, e, p, c); n++; } }
    }
    const imgs = [...document.querySelectorAll("img")].filter((i) => i.getBoundingClientRect().width > 0).length;
    const enLigne = [...document.querySelectorAll("body [style]")].filter((e) => /color|background|gradient/i.test(e.getAttribute("style")) && e.getBoundingClientRect().width > 0).length;
    const svgDurs = [...document.querySelectorAll("svg [fill]:not([fill=none]):not([fill=currentColor]), svg [stroke]:not([stroke=none]):not([stroke=currentColor])")].filter((e) => e.getBoundingClientRect().width > 0).length;
    return { totalProprietes: n, parFamille: out, exemples: ex, imagesVisibles: imgs, stylesEnLigneCouleur: enLigne, svgCouleurEnDur: svgDurs };
  }, [PAGE_FN.toString(), ACHAT.map((a) => a.sel)]);
}
// Résidus au survol : :hover forcé par CDP (CSS.forcePseudoState) sur tous les éléments porteurs d'une classe hover:
// et sur tous les groupes (group, group/…), en même temps, puis retiré. Aucun clic, aucun déplacement de souris.
async function survolForce(ctx, page) {
  const cdp = await ctx.newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: '[class*="hover:"], [class~="group"], [class*="group/"]' });
  for (const nodeId of nodeIds) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
  await page.waitForTimeout(1000);
  const r = await residus(page);
  for (const nodeId of nodeIds) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] }).catch(() => {});
  await cdp.detach(); await page.waitForTimeout(400);
  return { elementsForces: nodeIds.length, ...r };
}
async function bouton(page, a, v, crops) {
  const loc = page.locator(a.sel).filter({ visible: true }).first();
  if (!(await loc.count())) return null;
  const lire = async (etat) => {
    const d = await loc.evaluate((e, fnSrc) => {
      const { rgb, hex, ratio, blend, fondDe } = eval("(" + fnSrc + ")")();
      const cs = getComputedStyle(e); const fondPage = fondDe(e.parentElement); const bg0 = rgb(cs.backgroundColor); const bg = blend(bg0, fondPage); const fg = blend(rgb(cs.color), bg);
      const out = { texte: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " "), fond: hex(bg), texteCouleur: hex(fg), fondPage: hex(fondPage), ratioTexte: ratio(fg, bg), ratioBoutonPage: ratio(bg, fondPage), opacite: cs.opacity, survol: e.matches(":hover"), focusVisible: e.matches(":focus-visible"), desactive: e.disabled };
      if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) { const oc = blend(rgb(cs.outlineColor), fondPage); Object.assign(out, { anneau: `${cs.outlineWidth} ${cs.outlineStyle} ${hex(oc)}`, ratioAnneauPage: ratio(oc, fondPage), ratioAnneauBouton: ratio(oc, bg) }); }
      else if (cs.boxShadow && cs.boxShadow !== "none") out.ombreOuAnneau = cs.boxShadow.slice(0, 120);
      if (+cs.opacity < 1) { const op = +cs.opacity; const bgE = blend({ ...bg, a: op }, fondPage), fgE = blend({ ...fg, a: op }, fondPage); Object.assign(out, { fondEffectif: hex(bgE), texteEffectif: hex(fgE), ratioTexteEffectif: ratio(fgE, bgE), ratioBoutonPageEffectif: ratio(bgE, fondPage), noteOpacite: `opacité ${op} : ratios effectifs = couleurs composées avec le fond de page` }); }
      return out;
    }, PAGE_FN.toString());
    const bb = await loc.boundingBox();
    if (bb && crops) { const f = path.join(brut, `bouton-${id}-${W}-${a.sel.includes("aria-label") ? "ajouter" : a.sel.includes("rounded-xl") ? "panier" : "connexion"}-${v}-${etat}.png`); await page.screenshot({ path: f, clip: { x: Math.max(0, bb.x - 12), y: Math.max(0, bb.y - 12), width: bb.width + 24, height: bb.height + 24 }, animations: "disabled" }); d.capture = path.basename(f); }
    return { etat, ...d };
  };
  await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await page.waitForTimeout(400);
  const res = [];
  await page.mouse.move(1, 1); await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.waitForTimeout(250); res.push(await lire("repos"));
  await loc.hover({ force: true }); await page.waitForTimeout(350); res.push(await lire("survol"));
  await page.mouse.move(1, 1); await page.waitForTimeout(200); await page.keyboard.press("Shift"); await loc.focus(); await page.waitForTimeout(300);
  let f = await lire("focus"); if (!f.focusVisible) { await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); await page.waitForTimeout(300); f = await lire("focus"); f.note = "focus repris par Maj+Tab puis Tab"; } res.push(f);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await loc.evaluate((e) => { e.dataset.dzDisabledAvant = e.hasAttribute("disabled") ? "1" : "0"; e.setAttribute("disabled", ""); }); await page.waitForTimeout(250);
  const ds = await lire("désactivé (simulé : attribut disabled posé dans le DOM)"); res.push(ds);
  await loc.evaluate((e) => { if (e.dataset.dzDisabledAvant === "0") e.removeAttribute("disabled"); delete e.dataset.dzDisabledAvant; });
  return { bouton: a.nom, selecteur: a.sel, etats: res };
}
(async () => {
  const browser = await chromium.launch(); const aborted = []; const res = { id, route, viewport: `${W}x${H}`, debut: new Date().toISOString(), variantes: {} };
  for (const v of VARIANTES) {
    const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
    const r = { debut: new Date().toISOString() };
    const resp = await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); r.statut = resp && resp.status();
    await settle(p, 4500); r.injection = [await injecte(p, v)];
    await scrollThrough(p); await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(1200);
    r.injection.push({ etape: "avant captures", ...(await presence(p)) });
    await p.mouse.move(1, 1);
    await p.screenshot({ path: path.join(brut, `${id}-${W}-${v}-ecran.png`), animations: "disabled" });
    await p.screenshot({ path: path.join(brut, `${id}-${W}-${v}-page.png`), fullPage: true, animations: "disabled" });
    r.residus = await residus(p);
    r.residusSurvol = await survolForce(ctx, p);
    r.boutons = [];
    for (const a of ACHAT) { const b = await bouton(p, a, v, true).catch((e) => ({ bouton: a.nom, erreur: String(e.message).split("\n")[0] })); if (b) r.boutons.push(b); }
    r.injection.push({ etape: "fin", ...(await presence(p)) }); r.fin = new Date().toISOString();
    res.variantes[v] = r; await ctx.close();
  }
  res.requetesAbandonnees = aborted; res.fin = new Date().toISOString();
  fs.writeFileSync(path.join(optDir, "mesures", vlist === "avant,a,b" ? `captures-${id}-${W}.json` : `captures-${id}-${W}-${VARIANTES.join("")}.json`), JSON.stringify(res, null, 1));
  await browser.close();
  console.log(id, W, Object.entries(res.variantes).map(([v, r]) => `${v}: résidus ${r.residus.totalProprietes}, survol ${r.residusSurvol.totalProprietes}/${r.residusSurvol.elementsForces}, boutons ${r.boutons.length}, regles ${r.injection[r.injection.length - 1].regles}`).join(" | "));
})().catch((e) => { console.error(e); process.exit(1); });
