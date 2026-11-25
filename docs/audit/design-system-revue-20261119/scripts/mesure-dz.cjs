// Mandat DZ — mesure d'une page à une taille de fenêtre (points 6.2 a à i, et 6.6).
// Usage : node mesure-dz.cjs <id> <chemin> <largeur> <hauteur> <dossier-sortie>
// Sorties : <dossier>/mesures/<id>-<largeur>.json, <dossier>/captures/<id>-<largeur>-ecran.jpg, -page.jpg
// Reprises de DU (#2211, tête aef4cda090e1) : audit-a11y-du.cjs (axe + interception), apparence-du.cjs
// (contraste calculé puis contrôle aux pixels, getAnimations). Changements DZ : toutes les zones de la page
// au lieu de #reference ; pixels lus texte rendu transparent (fond réellement peint) au lieu de la couleur
// majoritaire ; ajout bords, cibles 24/44 avec exceptions 2.5.8, focus par Tab, polices, images, thème sombre.
const fs = require("node:fs");
const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("./lib-dz.cjs");
const AxeBuilder = require(process.env.AXE || "/opt/automecanik/app/node_modules/@axe-core/playwright").default;

const [, , id, route, Ws, Hs, outDir] = process.argv;
const W = Number(Ws), H = Number(Hs);
const url = BASE + route;
const mesures = path.join(outDir, "mesures"); const captures = path.join(outDir, "captures");
fs.mkdirSync(mesures, { recursive: true }); fs.mkdirSync(captures, { recursive: true });
const t0 = new Date().toISOString();
const log = (...a) => console.error(`[${id}-${W}]`, ...a);

async function pixelStats(page, buf, fg) {
  return page.evaluate(async ({ b64, fg }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const rs = []; const cnt = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const bg = { r: d[i], g: d[i + 1], b: d[i + 2], a: 1 };
      const f = __dz.blend(fg, bg); rs.push(__dz.ratio(f, bg));
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    rs.sort((a, b) => a - b);
    const q = (p) => rs[Math.min(rs.length - 1, Math.floor(p * rs.length))];
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => "#" + k.toString(16).padStart(6, "0") + " " + Math.round((100 * n) / (d.length / 4)) + "%");
    return { min: __dz.r2(rs[0]), p10: __dz.r2(q(0.1)), median: __dz.r2(q(0.5)), fondsMajoritaires: top, px: rs.length };
  }, { b64: buf.toString("base64"), fg });
}

(async () => {
  const browser = await chromium.launch();
  const aborted = [];
  const result = { id, route, url, viewport: `${W}x${H}`, debut: t0, ua: W < 800 ? "mobile" : "desktop" };
  const ctx = await newContext(browser, { width: W, height: H, aborted });
  const page = await ctx.newPage();
  const consoleErr = []; page.on("pageerror", (e) => consoleErr.push(String(e.message).slice(0, 200)));
  const navigations = [];
  page.on("load", () => { navigations.push({ t: new Date().toISOString(), type: "load", url: page.url().replace(BASE, "") }); });
  page.on("console", (m) => { if (/reload|chunk|dynamically imported/i.test(m.text())) consoleErr.push("console: " + m.text().slice(0, 160)); });
  const resp = await page.goto(url, { waitUntil: "load", timeout: 120000 });
  result.statut = resp && resp.status(); result.urlFinale = page.url().replace(BASE, "");
  result.redirections = [];
  for (let r = resp && resp.request().redirectedFrom(); r; r = r.redirectedFrom()) result.redirections.push(r.url().replace(BASE, ""));
  await settle(page, 4500);

  // ---- h (partie 1) : LCP / CLS de labo au chargement, avant toute interaction ----
  result.perf = await page.evaluate(() => {
    const p = window.__dzPerf; const l = p.lcp;
    return { lcp: l ? { ms: Math.round(l.startTime), taille: l.size, element: l.element ? __dz.sel(l.element) : null, tag: l.element ? l.element.tagName.toLowerCase() : null, url: l.url ? l.url.replace(location.origin, "").slice(0, 140) : "" } : null, clsChargement: Math.round(p.cls * 10000) / 10000, decalages: p.shifts.slice(0, 10) };
  });
  await page.screenshot({ path: path.join(captures, `${id}-${W}-ecran.jpg`), type: "jpeg", quality: 55 });

  // ---- e : focus clavier, 40 arrêts, depuis le début du document ----
  const focus = [];
  let prev = null;
  for (let i = 1; i <= 40; i++) {
    await page.keyboard.press("Tab"); await page.waitForTimeout(160);
    const info = await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      e.setAttribute("data-dz-focus", "1");
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const vis = __dz.visible(e) && r.bottom > 0 && r.top < vh;
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]];
      let cache = 0; let cacheur = null;
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
        const t = document.elementFromPoint(x, y);
        if (t && t !== e && !e.contains(t) && !t.contains(e)) { const f = __dz.fixedAncestor(t); if (f && !f.contains(e)) { cache++; cacheur = __dz.zone(t) + " | " + __dz.sel(f).slice(-70); } }
      }
      const fixe = !!__dz.fixedAncestor(e);
      return { tag: e.tagName.toLowerCase(), sel: __dz.sel(e), zone: __dz.zone(e), texte: (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || e.value || "").trim().replace(/\s+/g, " ").slice(0, 50), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], docY: Math.round(r.top + scrollY), fixe, visible: vis, pointsCaches: cache, cacheur, outline: cs.outlineStyle !== "none" ? `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor} off ${cs.outlineOffset}` : "aucun", boxShadow: cs.boxShadow === "none" ? "aucune" : cs.boxShadow.slice(0, 120), focusVisible: e.matches(":focus-visible") };
    });
    if (!info) {
      // focus sur <body> : soit fin du document (le focus part vers le navigateur), soit focus perdu en cours de page
      const dernierBody = focus.length && focus[focus.length - 1].tag === "body";
      const ctxBody = await page.evaluate(() => ({ docAFocus: document.hasFocus(), defilementY: Math.round(scrollY) }));
      focus.push({ arret: i, tag: "body", apres: prev ? prev.sel + " « " + prev.texte + " »" : null, ...ctxBody, note: "focus sur <body> (aucun élément focalisé)" });
      if (dernierBody) { focus[focus.length - 1].note += " ; deux fois de suite : fin du parcours"; break; }
      continue;
    }
    if (focus.length && focus[0].sel === info.sel && focus[0].texte === info.texte && i > 2) {
      focus.push({ arret: i, tag: info.tag, note: "bouclage : retour au premier arrêt, fin du parcours" }); break;
    }
    // indicateur : capture focalisée, puis Maj+Tab (l'élément perd le focus), capture, puis Tab pour revenir
    let indic = null;
    if (info.visible) {
      const pad = 5;
      const clipOf = async () => page.evaluate((pad) => { const e = document.querySelector("[data-dz-focus]"); const r = e.getBoundingClientRect(); const vw = document.documentElement.clientWidth, vh = window.innerHeight; const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad); return { x, y, width: Math.max(1, Math.min(vw, r.right + pad) - x), height: Math.max(1, Math.min(vh, r.bottom + pad) - y) }; }, pad);
      try {
        const c1 = await clipOf(); const a = await page.screenshot({ clip: c1, animations: "disabled" });
        await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(160);
        const c2 = await clipOf(); const b = await page.screenshot({ clip: c2, animations: "disabled" });
        await page.keyboard.press("Tab"); await page.waitForTimeout(120);
        const back = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-dz-focus"));
        const deplace = Math.abs(c1.y - c2.y) > 1 || Math.abs(c1.x - c2.x) > 1;
        indic = await page.evaluate(async ({ a, b }) => {
          const load = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
          const A = await load(a), B = await load(b);
          if (A.width !== B.width || A.height !== B.height) return { comparable: false };
          const rs = []; let changed = 0;
          for (let i = 0; i < A.data.length; i += 4) {
            const p = { r: A.data[i], g: A.data[i + 1], b: A.data[i + 2] }, q = { r: B.data[i], g: B.data[i + 1], b: B.data[i + 2] };
            if (Math.abs(p.r - q.r) + Math.abs(p.g - q.g) + Math.abs(p.b - q.b) < 12) continue;
            changed++; rs.push(__dz.ratio(p, q));
          }
          rs.sort((x, y) => x - y);
          const q = (f) => (rs.length ? rs[Math.min(rs.length - 1, Math.floor(f * rs.length))] : 0);
          return { comparable: true, pixelsChanges: changed, ratioP90: __dz.r2(q(0.9)), ratioMax: __dz.r2(rs.length ? rs[rs.length - 1] : 0) };
        }, { a: a.toString("base64"), b: b.toString("base64") });
        indic.retourOk = back; indic.defilementEntreCaptures = deplace;
      } catch (e) { indic = { erreur: String(e.message).split("\n")[0] }; }
    }
    await page.evaluate(() => document.querySelectorAll("[data-dz-focus]").forEach((e) => e.removeAttribute("data-dz-focus")));
    const visibleIndic = indic && indic.comparable ? indic.pixelsChanges >= 20 && indic.ratioP90 >= 1.2 : null;
    const ordre = prev && !info.fixe && !prev.fixe && info.docY < prev.docY - 40 ? "retour en arrière" : "ok";
    focus.push({ arret: i, ...info, indicateur: indic, indicateurVisible: visibleIndic, indicateur3a1: indic && indic.comparable ? indic.ratioP90 >= 3 : null, ordre });
    prev = info;
  }
  result.focus = focus;
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });

  // ---- rendre les contenus différés ----
  await scrollThrough(page);

  // ---- a : axe WCAG 2.0/2.1/2.2 A+AA ----
  try {
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    result.axe = { version: axe.testEngine.version, violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, aide: v.help, criteres: v.tags.filter((t) => /^wcag\d/.test(t)), noeuds: v.nodes.length, exemples: v.nodes.slice(0, 25).map((n) => ({ cible: n.target.join(" ").slice(0, 160), html: n.html.slice(0, 160), resume: (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 220), donnees: n.any && n.any[0] && n.any[0].data && typeof n.any[0].data === "object" ? { fg: n.any[0].data.fgColor, bg: n.any[0].data.bgColor, ratio: n.any[0].data.contrastRatio, taille: n.any[0].data.fontSize, graisse: n.any[0].data.fontWeight } : undefined })) })), incomplets: axe.incomplete.map((v) => ({ id: v.id, noeuds: v.nodes.length })) };
  } catch (e) { result.axe = { erreur: String(e.message).split("\n")[0] }; }

  // ---- b + f : textes visibles (contraste calculé, tailles, graisses, polices) ----
  const textes = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img, picture, video, canvas")].filter((e) => __dz.visible(e)).map((e) => { const r = e.getBoundingClientRect(); return { e, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; });
    const out = []; const seen = new Map(); let idx = 0;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t) continue;
      const el = n.parentElement; if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "OPTION"].includes(el.tagName)) continue;
      if (el.hasAttribute("data-dz-t")) { const k = el.getAttribute("data-dz-t"); const it = out[Number(k)]; if (it) it.texte = (it.texte + " " + t).slice(0, 60); continue; }
      if (!__dz.visible(el)) continue;
      const cs = getComputedStyle(el);
      const rng = document.createRange(); rng.selectNodeContents(n); const rr = rng.getBoundingClientRect(); if (rr.width < 1 || rr.height < 1) continue;
      const bg = __dz.bgOf(el, false);
      let fg = __dz.parse(cs.color); const op = __dz.opacityChain(el); fg = { ...fg, a: fg.a * op };
      const clipText = cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text";
      const fgb = __dz.blend(fg, bg.color);
      const px = parseFloat(cs.fontSize), wgt = Number(cs.fontWeight);
      const grand = px >= 24 || (px >= 18.66 && wgt >= 700);
      const ratio = __dz.r2(__dz.ratio(fgb, bg.color));
      const ax = rr.left + scrollX, ay = rr.top + scrollY;
      const surImage = imgs.some((m) => !el.contains(m.e) && !m.e.contains(el) && ax < m.x + m.w && ax + rr.width > m.x && ay < m.y + m.h && ay + rr.height > m.y);
      const inactif = !!el.closest("[disabled], [aria-disabled=true]");
      const role = /^H[1-6]$/.test(el.tagName) || el.closest("h1,h2,h3,h4,h5,h6") ? "titre" : el.closest("td, th, [class*=price], [class*=prix], .tabular-nums, .font-mono, [class*=font-mono], data, time") ? "donnees" : "texte";
      const item = { i: idx, texte: t.slice(0, 60), sel: __dz.sel(el), zone: __dz.zone(el), fg: __dz.hex(fgb), fgAlpha: __dz.r2(fg.a), fgBrut: { r: fg.r, g: fg.g, b: fg.b, a: fg.a }, bg: __dz.hex(bg.color), ratio, seuil: grand ? 3 : 4.5, px, graisse: wgt, famille: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), grand, role, inactif, fondImage: bg.images.length > 0, imagesFond: bg.images.slice(0, 2), translucide: bg.translucide, flou: bg.blur, surImage, texteDegrade: clipText, classes: __dz.cls(el).slice(0, 12).join(" ") };
      item.sousSeuil = ratio < item.seuil;
      item.aVerifierPixels = item.fondImage || item.surImage || item.translucide || item.flou || item.sousSeuil;
      el.setAttribute("data-dz-t", String(out.length));
      out.push(item); idx++;
    }
    return out;
  });
  // contrôle aux pixels : texte rendu transparent, capture du fond réellement peint
  const aVerifier = textes.filter((t) => t.aVerifierPixels && !t.texteDegrade);
  const groupes = new Map();
  for (const t of aVerifier) { const k = t.sel + "|" + t.fg + "|" + t.bg + "|" + (t.fondImage || t.surImage); if (!groupes.has(k)) groupes.set(k, t); }
  let nPix = 0;
  for (const t of groupes.values()) {
    if (nPix >= 90) { t.pixels = { nonFait: "plafond de 90 contrôles atteint" }; continue; }
    const loc = page.locator(`[data-dz-t="${t.i}"]`).first();
    try {
      // centré dans la fenêtre (et non « si nécessaire ») : un texte laissé au bord peut passer sous l'en-tête ou la barre fixe
      await loc.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" })); await page.waitForTimeout(120);
      const clip = await loc.evaluate((e) => {
        const n = [...e.childNodes].find((c) => c.nodeType === 3 && c.nodeValue.trim()); const rg = document.createRange(); rg.selectNodeContents(n || e); const r = rg.getBoundingClientRect();
        const h = document.elementFromPoint(Math.min(window.innerWidth - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(window.innerHeight - 1, Math.max(0, (r.top + r.bottom) / 2)));
        const fx = h && !e.contains(h) && !h.contains(e) ? __dz.fixedAncestor(h) : null;
        if (fx) return { recouvertPar: __dz.sel(fx) };
        const cb = __dz.clippedBy(e, r); if (cb) return { recouvertPar: "rogné (" + cb + ")" };
        e.style.setProperty("color", "transparent", "important"); e.style.setProperty("-webkit-text-fill-color", "transparent", "important"); e.style.setProperty("text-shadow", "none", "important"); e.style.setProperty("text-decoration-color", "transparent", "important");
        const vw = document.documentElement.clientWidth, vh = window.innerHeight; const x = Math.max(0, r.left), y = Math.max(0, r.top);
        return { x, y, width: Math.max(1, Math.min(vw, r.right) - x), height: Math.max(1, Math.min(vh, r.bottom) - y) };
      });
      if (clip.recouvertPar) { t.pixels = { nonFait: "texte non peint à sa place au moment du contrôle (élément fixe au-dessus, ou rogné) : " + clip.recouvertPar }; continue; }
      // deux images d'affichage : le texte rendu transparent doit être repeint avant la capture (calques backdrop-blur compris)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.waitForTimeout(60);
      const buf = await page.screenshot({ clip, animations: "disabled" });
      await loc.evaluate((e) => { for (const p of ["color", "-webkit-text-fill-color", "text-shadow", "text-decoration-color"]) e.style.removeProperty(p); });
      // couleur du texte avant mélange (alpha conservé) : mélangée pixel par pixel au fond réellement peint
      t.pixels = await pixelStats(page, buf, t.fgBrut);
      nPix++;
    } catch (e) { t.pixels = { erreur: String(e.message).split("\n")[0] }; }
  }
  // reporter le contrôle aux pixels sur les doublons du même groupe ; ratio retenu = p10 pixel si contrôlé
  for (const t of textes) {
    const k = t.sel + "|" + t.fg + "|" + t.bg + "|" + (t.fondImage || t.surImage); const g = groupes.get(k);
    if (g && g.pixels && g.pixels.p10 !== undefined) t.ratioPixelsP10 = g.pixels.p10, t.ratioPixelsMedian = g.pixels.median;
    t.ratioRetenu = t.ratioPixelsP10 !== undefined ? t.ratioPixelsP10 : t.ratio;
    t.defaut = !t.inactif && t.ratioRetenu < t.seuil;
  }
  result.textes = { total: textes.length, controlesPixels: nPix, liste: textes };

  // ---- f : polices et graisses ----
  result.polices = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].map((f) => ({ famille: f.family.replace(/["']/g, ""), graisse: f.weight, style: f.style, statut: f.status }));
    return { faces };
  });
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const doc = await cdp.send("DOM.getDocument", { depth: 0 });
    const rendu = {};
    const roles = [["titre-h1", "h1"], ["titre-h2", "main h2, h2"], ["texte", "main p, p, main li"], ["donnees", "[class*=price], [class*=prix], td, .tabular-nums, .font-mono, [class*=font-mono]"], ["bouton", "button, a[class*=bg-]"]];
    await page.evaluate((roles) => { for (const [nom, s] of roles) { const e = [...document.querySelectorAll(s)].flatMap((x) => [x, ...x.querySelectorAll("*")]).find((x) => __dz.visible(x) && [...x.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim().length > 1)); if (e) e.setAttribute("data-dz-role", nom); } }, roles);
    for (const [roleNom, s0] of roles) {
      const s = `[data-dz-role="${roleNom}"]`;
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: s });
      if (!nodeId) { rendu[roleNom] = null; continue; }
      const r = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      const cs = await cdp.send("CSS.getComputedStyleForNode", { nodeId });
      const get = (n) => (cs.computedStyle.find((p) => p.name === n) || {}).value;
      const elSel = await page.evaluate((s) => __dz.sel(document.querySelector(s)), s);
      rendu[roleNom] = { selecteur: elSel, demande: get("font-family"), graisse: get("font-weight"), taille: get("font-size"), rendu: r.fonts.map((f) => `${f.familyName} (${f.isCustomFont ? "web" : "système"}, ${f.glyphCount} glyphes)`) };
    }
    result.polices.renduParRole = rendu;
  } catch (e) { result.polices.erreurCdp = String(e.message).split("\n")[0]; }
  // graisses demandées sans fichier chargé
  {
    const faces = result.polices.faces.filter((f) => f.statut === "loaded");
    const parFam = {};
    for (const t of textes) { const k = t.famille + "|" + t.graisse; parFam[k] = (parFam[k] || 0) + 1; }
    const rng = (g) => { const p = String(g).split(" ").map(Number); return [p[0], p[1] || p[0]]; };
    result.polices.graissesDemandees = Object.entries(parFam).map(([k, n]) => {
      const [fam, g] = k.split("|"); const w = Number(g);
      const fs2 = faces.filter((f) => f.famille.toLowerCase() === fam.toLowerCase());
      if (!fs2.length) return { famille: fam, graisse: w, textes: n, etat: "famille sans fichier web chargé (police de secours)" };
      const exact = fs2.some((f) => { const [a, b] = rng(f.graisse); return w >= a && w <= b; });
      if (exact) return { famille: fam, graisse: w, textes: n, etat: "chargée" };
      const max = Math.max(...fs2.map((f) => rng(f.graisse)[1]));
      return { famille: fam, graisse: w, textes: n, etat: w >= 600 && max < 600 ? "faux gras (synthétisé)" : `non chargée, rendue avec la graisse ${max} la plus proche`, graissesChargees: [...new Set(fs2.map((f) => f.graisse))] };
    });
  }
  // longueur de ligne des paragraphes de plus de trois lignes
  // content-visibility:auto saute la mise en page hors écran : on la neutralise le temps de la mesure
  await page.addStyleTag({ content: "*{content-visibility:visible !important}" }).then((h) => h.evaluate((e) => e.setAttribute("data-dz-cv", "1")));
  await page.waitForTimeout(300);
  result.lignes = await page.evaluate(() => {
    const out = [];
    for (const p of document.querySelectorAll("p")) {
      if (!__dz.visible(p)) continue; const cs = getComputedStyle(p); const r = p.getBoundingClientRect();
      const lh = cs.lineHeight === "normal" ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
      const lignes = Math.round(r.height / lh); if (lignes <= 3) continue;
      const txt = p.textContent.replace(/\s+/g, " ").trim(); if (!txt) continue;
      out.push({ sel: __dz.sel(p), zone: __dz.zone(p), lignes, caracteresParLigne: Math.round(txt.length / lignes), largeurPx: Math.round(r.width), px: parseFloat(cs.fontSize), debut: txt.slice(0, 40) });
    }
    return out;
  });
  await page.evaluate(() => document.querySelectorAll("style[data-dz-cv]").forEach((e) => e.remove()));

  // ---- c : bords des champs et boutons ----
  result.bords = await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('input:not([type=hidden]), select, textarea, [role=combobox], [role=checkbox], [role=radio], [role=switch], button, [role=button]')) {
      if (!__dz.visible(e)) continue;
      const cs = getComputedStyle(e); const outside = __dz.bgOf(e, true);
      let fill = __dz.parse(cs.backgroundColor); fill = fill.a > 0 ? __dz.blend(fill, outside.color) : outside.color;
      const bw = Math.max(parseFloat(cs.borderTopWidth), parseFloat(cs.borderBottomWidth), parseFloat(cs.borderLeftWidth));
      let bc = __dz.parse(cs.borderBottomColor); bc = __dz.blend({ ...bc, a: bc.a * __dz.opacityChain(e) }, outside.color);
      const type = e.tagName === "BUTTON" || e.getAttribute("role") === "button" ? "bouton" : e.type === "checkbox" || e.type === "radio" || /checkbox|radio|switch/.test(e.getAttribute("role") || "") ? "case" : e.tagName === "SELECT" || e.getAttribute("role") === "combobox" ? "liste" : "champ";
      const natif = (e.type === "checkbox" || e.type === "radio") && cs.appearance !== "none";
      const rFill = __dz.r2(__dz.ratio(fill, outside.color)); const rBord = bw >= 1 ? __dz.r2(__dz.ratio(bc, outside.color)) : null;
      const texte = (e.innerText || e.value || e.getAttribute("placeholder") || e.getAttribute("aria-label") || "").trim().slice(0, 40);
      const aTexteOuIcone = type === "bouton" && (e.innerText.trim().length > 0 || !!e.querySelector("svg, img"));
      const inactif = e.disabled || e.getAttribute("aria-disabled") === "true";
      // défaut : champ/liste/case dont ni le remplissage ni le bord n'atteint 3:1 ; bouton seulement s'il a un bord comme seul contour
      let defaut = false;
      if (!inactif && !natif) {
        if (type !== "bouton") defaut = Math.max(rFill, rBord || 0) < 3;
        else defaut = rFill < 1.1 && rBord !== null && rBord < 3 && !aTexteOuIcone;
      }
      out.push({ type, sel: __dz.sel(e), zone: __dz.zone(e), texte, natif, inactif, fondAutour: __dz.hex(outside.color), remplissage: __dz.hex(fill), ratioRemplissage: rFill, bord: bw >= 1 ? __dz.hex(bc) : null, largeurBord: bw, ratioBord: rBord, boutonContourSeul: type === "bouton" && rFill < 1.1 && bw >= 1, defaut, classes: __dz.cls(e).filter((c) => /border|bg-|ring/.test(c)).slice(0, 8).join(" ") });
    }
    return out;
  });

  // ---- d : cibles ----
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(300);
  result.cibles = await page.evaluate(() => {
    const S = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option], [tabindex]:not([tabindex="-1"])';
    const els = [...document.querySelectorAll(S)].filter((e) => __dz.visible(e) && !e.closest("[inert]") && getComputedStyle(e).pointerEvents !== "none");
    const uniq = els.filter((e) => !els.some((o) => o !== e && o.contains(e) && o.matches("a[href], button")));
    const rects = uniq.map((e) => {
      let r = e.getBoundingClientRect(); let viaLabel = false;
      if ((e.type === "checkbox" || e.type === "radio") && e.labels && e.labels.length) { const l = e.labels[0].getBoundingClientRect(); if (l.width * l.height > r.width * r.height) { r = l; viaLabel = true; } }
      const fx = !!__dz.fixedAncestor(e);
      return { e, x: r.left + (fx ? 0 : scrollX), y: r.top + (fx ? 0 : scrollY), w: r.width, h: r.height, viaLabel, fx };
    });
    const circleHits = (c, R, o) => { const nx = Math.max(o.x, Math.min(c[0], o.x + o.w)), ny = Math.max(o.y, Math.min(c[1], o.y + o.h)); return (nx - c[0]) ** 2 + (ny - c[1]) ** 2 < R * R; };
    const petits = [], moyens = []; let n = 0;
    for (const t of rects) {
      n++;
      const d = { sel: __dz.sel(t.e), zone: __dz.zone(t.e), texte: (t.e.innerText || t.e.getAttribute("aria-label") || t.e.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 40), l: Math.round(t.w * 10) / 10, h: Math.round(t.h * 10) / 10, viaLibelle: t.viaLabel };
      if (t.w >= 44 && t.h >= 44) continue;
      if (t.w >= 24 && t.h >= 24) { moyens.push(d); continue; }
      // exceptions WCAG 2.5.8
      const cs = getComputedStyle(t.e); const par = t.e.parentElement;
      const enLigne = cs.display === "inline" && par && /^(P|LI|SPAN|TD|DD|LABEL|DIV)$/.test(par.tagName) && (par.innerText || "").trim().length > (t.e.innerText || "").trim().length + 15;
      const c = [t.x + t.w / 2, t.y + t.h / 2];
      const espace = !rects.some((o) => o !== t && o.fx === t.fx && (o.w >= 24 && o.h >= 24 ? circleHits(c, 12, o) : Math.hypot(o.x + o.w / 2 - c[0], o.y + o.h / 2 - c[1]) < 24));
      const natif = (t.e.type === "checkbox" || t.e.type === "radio") && cs.appearance !== "none";
      d.exception = enLigne ? "en ligne (texte)" : espace ? "espacement (cercle de 24 px libre)" : natif ? "contrôle natif non stylé (agent utilisateur)" : null;
      d.classes = __dz.cls(t.e).filter((x) => /^(w-|h-|p-|px-|py-|size-|min-)/.test(x)).join(" ");
      petits.push(d);
    }
    return { total: n, sous24: petits, sous24SansException: petits.filter((p) => !p.exception).length, entre24et44: moyens };
  });

  // ---- h (partie 2) : images ----
  result.images = await page.evaluate(() => {
    const all = [...document.images];
    const sans = all.filter((im) => { const cs = getComputedStyle(im); const attrs = im.hasAttribute("width") && im.hasAttribute("height"); const ar = cs.aspectRatio && cs.aspectRatio !== "auto"; return !attrs && !ar; }).map((im) => { const r = im.getBoundingClientRect(); const cs = getComputedStyle(im); const p = im.parentElement; const pcs = p ? getComputedStyle(p) : null; return { src: (im.currentSrc || im.src).replace(location.origin, "").slice(0, 110), alt: (im.alt || "").slice(0, 40), zone: __dz.zone(im), sel: __dz.sel(im), affichee: r.width > 0 && r.height > 0, rendu: [Math.round(r.width), Math.round(r.height)], positionAbsolue: cs.position === "absolute", conteneurAspect: !!(pcs && pcs.aspectRatio !== "auto"), tailleCssFixe: /\b(w|h|size)-\d/.test(String(im.className)) }; });
    return { total: all.length, sansDimension: sans.length, sansDimensionAffichees: sans.filter((s) => s.affichee).length, liste: sans, prioriteHaute: all.filter((im) => im.getAttribute("fetchpriority") === "high").map((im) => (im.currentSrc || im.src).replace(location.origin, "").slice(0, 110)), lazyPremierEcran: all.filter((im) => im.loading === "lazy" && im.getBoundingClientRect().top < innerHeight && im.getBoundingClientRect().width > 0).length };
  });
  result.perf.clsApresDefilement = await page.evaluate(() => Math.round(window.__dzPerf.cls * 10000) / 10000);

  await page.screenshot({ path: path.join(captures, `${id}-${W}-page.jpg`), type: "jpeg", quality: 40, fullPage: true }).catch((e) => { result.captureErreur = String(e.message).split("\n")[0]; });
  result.erreursPage = consoleErr; result.chargementsDocument = navigations;
  await ctx.close();

  // ---- g : mouvement, réglage « réduire les animations » ----
  {
    const c2 = await newContext(browser, { width: W, height: H, reducedMotion: "reduce", aborted });
    const p2 = await c2.newPage(); await p2.goto(url, { waitUntil: "load", timeout: 120000 }); await settle(p2, 3500);
    await scrollThrough(p2);
    result.mouvement = await p2.evaluate(() => {
      const anims = document.getAnimations().map((a) => { const t = a.effect && a.effect.target; const tm = a.effect ? a.effect.getComputedTiming() : {}; return { type: a.constructor.name, nom: a.animationName || a.transitionProperty || "", iterations: tm.iterations === Infinity ? "infinie" : tm.iterations, dureeMs: tm.duration, etat: a.playState, zone: t ? __dz.zone(t) : "?", sel: t ? __dz.sel(t) : "?", visible: t ? __dz.visible(t) : false }; });
      const sb = { html: getComputedStyle(document.documentElement).scrollBehavior, body: getComputedStyle(document.body).scrollBehavior };
      const regles = [];
      for (const s of document.styleSheets) { let rs; try { rs = s.cssRules; } catch { continue; } const walk = (list, media) => { for (const r of list) { if (r.cssRules && r.conditionText !== undefined) walk(r.cssRules, (media ? media + " & " : "") + r.conditionText); else if (r.style && r.style.scrollBehavior) regles.push({ selecteur: r.selectorText, valeur: r.style.scrollBehavior, condition: media || "aucune", feuille: (s.href || "inline").replace(location.origin, "").slice(0, 80) }); } }; walk(rs, ""); }
      return { animations: anims, enCours: anims.filter((a) => a.etat === "running").length, infinies: anims.filter((a) => a.iterations === "infinie" && a.etat === "running"), defilement: sb, reglesScrollBehavior: regles };
    });
    await c2.close();
  }

  // ---- i : thème sombre ----
  {
    const fp = async (scheme) => {
      const c = await newContext(browser, { width: W, height: H, colorScheme: scheme, aborted });
      const p = await c.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await settle(p, 3000);
      const f = await p.evaluate(() => { const v = []; for (const e of document.querySelectorAll("body *")) { const r = e.getBoundingClientRect(); if (r.top > innerHeight || r.bottom < 0 || !r.width) continue; const cs = getComputedStyle(e); v.push(cs.backgroundColor + "|" + cs.color); if (v.length > 400) break; } return { html: document.documentElement.className.slice(0, 120), body: getComputedStyle(document.body).backgroundColor + " / " + getComputedStyle(document.body).color, empreinte: v.join(";") }; });
      let shot = null; if (scheme === "dark") shot = await p.screenshot({ type: "jpeg", quality: 50 });
      await c.close(); return { ...f, shot };
    };
    const L = await fp("light"), D = await fp("dark");
    const change = L.empreinte !== D.empreinte || L.body !== D.body;
    result.themeSombre = { change, clair: L.body, sombre: D.body, classesHtmlSombre: D.html };
    if (change) { fs.writeFileSync(path.join(captures, `${id}-${W}-sombre.jpg`), D.shot); result.themeSombre.capture = `captures/${id}-${W}-sombre.jpg`; }
  }

  result.requetesAbandonnees = aborted;
  result.fin = new Date().toISOString();
  await browser.close();
  fs.writeFileSync(path.join(mesures, `${id}-${W}.json`), JSON.stringify(result, null, 1));
  const tx = result.textes.liste.filter((t) => t.defaut);
  log(JSON.stringify({ statut: result.statut, axe: (result.axe.violations || []).map((v) => v.id + ":" + v.noeuds), textesDefaut: tx.length, bords: result.bords.filter((b) => b.defaut).length, sous24: result.cibles.sous24SansException, focusInvisible: result.focus.filter((f) => f.indicateurVisible === false).length, imgSansDim: result.images.sansDimension, infinies: result.mouvement.infinies.length, sombre: result.themeSombre.change, abandons: aborted.length, duree: (Date.parse(result.fin) - Date.parse(t0)) / 1000 }));
})().catch((e) => { console.error(e); process.exit(1); });
