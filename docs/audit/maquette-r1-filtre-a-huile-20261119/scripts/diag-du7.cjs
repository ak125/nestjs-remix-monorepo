// Complément n° 7 au mandat DU : revérification du bouton « Lancer le diagnostic » (GammeDiagnosticCTA, variante B).
// Mesures au pixel : texte et icône du bouton contre le fond réel (texte rendu transparent, transition coupée),
// aux deux bouts, à chaque position du reflet (animation en pause à N instants), au survol, au focus clavier.
// Le pire cas est le minimum des rapports contre le pixel de fond le plus clair et le plus sombre (vaut pour
// un texte clair ou foncé). Anneau de focus : pixels qui changent entre l'état sans focus et l'état focus
// clavier, autour du lien ; contraste de leur couleur contre le fond voisin (carte) et contre le bouton.
// Usage : PW=<node_modules>/playwright node diag-du7.cjs <url> <width> <height> <out.json> [hover|focus|reduce]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [, , url, W, H, out, mode] = process.argv;
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const lumRgb = (r, g, b) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const lumHex = (h) => lumRgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const ratioL = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const ratio = (a, b) => ratioL(lumHex(a), lumHex(b));
function bgStats(img, rect, fg) {
  const ls = []; let light = null, lightL = -1, dark = null, darkL = 2;
  for (let y = Math.max(0, rect.y); y < Math.min(img.height, rect.y + rect.h); y++)
    for (let x = Math.max(0, rect.x); x < Math.min(img.width, rect.x + rect.w); x++) {
      const i = (y * img.width + x) * 4; const L = lumRgb(img.data[i], img.data[i + 1], img.data[i + 2]); ls.push(L);
      if (L > lightL) { lightL = L; light = hex(img.data[i], img.data[i + 1], img.data[i + 2]); }
      if (L < darkL) { darkL = L; dark = hex(img.data[i], img.data[i + 1], img.data[i + 2]); }
    }
  ls.sort((a, b) => a - b); const fgL = lumHex(fg);
  const rl = ratioL(fgL, lightL), rd = ratioL(fgL, darkL);
  return { pixels: ls.length, fondLePlusClair: light, fondLePlusSombre: dark, ratioContreClair: rl, ratioContreSombre: rd, ratioMedian: ratioL(fgL, ls[Math.floor(ls.length / 2)]), pire: Math.min(rl, rd) };
}
const px = (img, x, y) => { const i = (y * img.width + x) * 4; return hex(img.data[i], img.data[i + 1], img.data[i + 2]); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: mode === "reduce" ? "reduce" : "no-preference", deviceScaleFactor: 1 });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const link = page.locator('a[href="/diagnostic-auto"]', { hasText: "Lancer le diagnostic" }).first();
  await link.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  const res = { url, at: new Date().toISOString(), viewport: `${W}x${H}`, mode: mode || "repos" };
  // Structure : un seul élément interactif, rôle et nom accessibles, imbrications
  res.structure = await link.evaluate((a) => {
    const card = a.closest("div.bg-white");
    const focusables = [...card.querySelectorAll("a[href], button, input, select, textarea, [tabindex], [role=button], [role=link]")];
    return {
      tag: a.tagName.toLowerCase(), href: a.getAttribute("href"), role: a.getAttribute("role"),
      descendantsInteractifs: a.querySelectorAll("a, button, input, select, textarea, [tabindex], [role=button], [role=link]").length,
      ancetreInteractif: !!a.parentElement.closest("a, button, [role=button], [role=link]"),
      interactifsDansLaCarte: focusables.map((e) => `${e.tagName.toLowerCase()}${e.getAttribute("href") ? "[href=" + e.getAttribute("href") + "]" : ""}`),
      liensDiagnosticDansLaPage: document.querySelectorAll('a[href="/diagnostic-auto"]').length,
      svg: [...a.querySelectorAll("svg")].map((s) => ({ ariaHidden: s.getAttribute("aria-hidden"), focusable: s.getAttribute("focusable") })),
      tabIndex: a.tabIndex,
    };
  });
  res.structure.nomAccessible = await page.getByRole("link", { name: "Lancer le diagnostic", exact: true }).count();
  res.structure.ariaSnapshot = await link.ariaSnapshot();
  // Couleurs et jetons servis
  const read = () => link.evaluate((a) => {
    const cv = document.createElement("canvas").getContext("2d");
    const toHex = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const cs = getComputedStyle(a); const card = a.closest("div.bg-white");
    const tn = [...a.childNodes].find((c) => c.nodeType === 3 && c.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn);
    const tr = rg.getBoundingClientRect();
    const shimmer = a.querySelector(".animate-shimmer"); const anims = shimmer ? shimmer.getAnimations() : [];
    const root = getComputedStyle(document.documentElement);
    const pastIcon = card.querySelector("div.bg-gradient-to-br svg");
    return {
      bg: toHex(cs.backgroundColor), bgImage: cs.backgroundImage, color: toHex(cs.color), colorBrut: cs.color, colorBlack: root.getPropertyValue("--color-black").trim(),
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, boxShadow: cs.boxShadow, translate: cs.translate, transform: cs.transform,
      outline: { style: cs.outlineStyle, width: cs.outlineWidth, color: toHex(cs.outlineColor), offset: cs.outlineOffset }, focusVisible: a.matches(":focus-visible"), focus: a === document.activeElement,
      box: box(a), texte: { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height), lignes: new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size },
      icone: box(a.querySelector("svg")), iconeAnimations: a.querySelector("svg").getAnimations().length,
      reflet: { animations: anims.length, nom: anims[0]?.animationName, duree: anims[0]?.effect?.getTiming().duration, bgImage: shimmer && getComputedStyle(shimmer).backgroundImage, animationCss: shimmer && getComputedStyle(shimmer).animation },
      iconePastilleAnimations: pastIcon ? pastIcon.getAnimations().length : null, iconePastilleAnimationCss: pastIcon ? getComputedStyle(pastIcon).animation : null,
      carteBg: toHex(getComputedStyle(card).backgroundColor), transition: cs.transition,
    };
  });
  if (mode === "hover") { await link.hover(); await page.waitForTimeout(700); }
  if (mode === "focus") {
    // Focus clavier réel : on donne le focus à l'élément focalisable qui précède le lien, puis Tab.
    await link.evaluate((a) => { const all = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.offsetParent !== null || e.getClientRects().length); const i = all.indexOf(a); const prev = all[i - 1]; prev.focus(); });
    await page.keyboard.press("Tab"); await page.waitForTimeout(400);
  }
  res.etat = await read();
  const B = res.etat.box; const fg = res.etat.color;
  const rel = (r, pad = 1) => ({ x: r.x - B.x - pad, y: r.y - B.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });
  const shot = async (clip) => PNG.sync.read(await page.screenshot({ clip }));
  const clipBtn = { x: B.x, y: B.y, width: B.w, height: B.h };
  fs.writeFileSync(out.replace(/\.json$/, "-bouton.png"), await page.screenshot({ clip: clipBtn }));
  // Anneau de focus : différence entre focus et sans focus, autour du lien (12 px de marge)
  if (mode === "focus") {
    const M = 12; const clipR = { x: B.x - M, y: B.y - M, width: B.w + 2 * M, height: B.h + 2 * M };
    const withF = await shot(clipR); fs.writeFileSync(out.replace(/\.json$/, "-anneau.png"), PNG.sync.write(withF));
    await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(400);
    const noF = await shot(clipR);
    const changed = new Map(); let n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = 0; y < withF.height; y++) for (let x = 0; x < withF.width; x++) {
      const inside = x >= M + 2 && x < M + B.w - 2 && y >= M + 2 && y < M + B.h - 2; if (inside) continue; // hors intérieur du bouton (reflet animé)
      const i = (y * withF.width + x) * 4; if (Math.abs(withF.data[i] - noF.data[i]) + Math.abs(withF.data[i + 1] - noF.data[i + 1]) + Math.abs(withF.data[i + 2] - noF.data[i + 2]) > 30) { n++; const k = px(withF, x, y); changed.set(k, (changed.get(k) || 0) + 1); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    const top = [...changed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const ringColor = top[0] && top[0][0];
    res.anneau = { pixelsChanges: n, couleursDominantes: top, etendue: n ? { x0: minX - M, x1: maxX - M - B.w + 1, y0: minY - M, y1: maxY - M - B.h + 1 } : null, couleur: ringColor,
      fondVoisinCarte: res.etat.carteBg, ratioContreCarte: ringColor ? ratio(ringColor, res.etat.carteBg) : null, ratioContreBouton: ringColor ? ratio(ringColor, res.etat.bg) : null,
      // contraste entre état focus et état sans focus pour les pixels de l'anneau (2.4.13, informatif)
    };
    // remettre le focus pour les mesures de texte
    await link.evaluate((a) => { const all = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.getClientRects().length); all[all.indexOf(a) - 1].focus(); });
    await page.keyboard.press("Tab"); await page.waitForTimeout(400);
    res.anneau.focusVisibleApresRetour = await link.evaluate((a) => a.matches(":focus-visible"));
  }
  // Fond seul : texte et icône transparents, transition coupée
  await link.evaluate((a) => { a.style.transition = "none"; a.style.setProperty("color", "transparent", "important"); });
  await page.waitForTimeout(250);
  const frames = []; const N = 24;
  if (mode !== "reduce" && res.etat.reflet.animations) {
    for (let k = 0; k < N; k++) {
      await link.evaluate((a, f) => { const an = a.querySelector(".animate-shimmer").getAnimations()[0]; an.pause(); an.currentTime = f * Number(an.effect.getTiming().duration); }, k / N);
      await page.waitForTimeout(50);
      const img = await shot(clipBtn);
      frames.push({ t: Math.round((k / N) * 100) / 100, texte: bgStats(img, rel(res.etat.texte), fg), icone: bgStats(img, rel(res.etat.icone), fg), boutGauche: px(img, 6, Math.round(B.h / 2)), boutDroit: px(img, B.w - 7, Math.round(B.h / 2)) });
    }
  } else {
    const img = await shot(clipBtn); frames.push({ t: null, texte: bgStats(img, rel(res.etat.texte), fg), icone: bgStats(img, rel(res.etat.icone), fg), boutGauche: px(img, 6, Math.round(B.h / 2)), boutDroit: px(img, B.w - 7, Math.round(B.h / 2)) });
  }
  await link.evaluate((a) => { const s = a.querySelector(".animate-shimmer"); if (s) s.style.visibility = "hidden"; });
  await page.waitForTimeout(60);
  const nu = await shot(clipBtn);
  res.sansReflet = { texte: bgStats(nu, rel(res.etat.texte), fg), icone: bgStats(nu, rel(res.etat.icone), fg), boutGauche: px(nu, 6, Math.round(B.h / 2)), boutDroit: px(nu, B.w - 7, Math.round(B.h / 2)) };
  res.sansReflet.ratioBoutGauche = ratio(fg, res.sansReflet.boutGauche); res.sansReflet.ratioBoutDroit = ratio(fg, res.sansReflet.boutDroit);
  res.framesReflet = frames;
  res.pireTexte = frames.reduce((a, f) => (f.texte.pire < a.texte.pire ? f : a), frames[0]);
  res.pireIcone = frames.reduce((a, f) => (f.icone.pire < a.icone.pire ? f : a), frames[0]);
  res.pireBouts = Math.min(...frames.map((f) => Math.min(ratio(fg, f.boutGauche), ratio(fg, f.boutDroit))));
  // Mouvement réduit : deux captures à 900 ms d'intervalle doivent être identiques (bouton et pastille)
  if (mode === "reduce") {
    await link.evaluate((a) => { a.style.transition = ""; a.style.color = ""; const s = a.querySelector(".animate-shimmer"); if (s) s.style.visibility = ""; });
    const card = await link.evaluate((a) => { const r = a.closest("div.bg-white").getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; });
    await page.waitForTimeout(600); // fin de la transition de couleur rétablie
    const a1 = await shot(card); await page.waitForTimeout(900); const a2 = await shot(card); await page.waitForTimeout(700); const a3 = await shot(card);
    let d12 = 0, d13 = 0, d23 = 0; for (let i = 0; i < a1.data.length; i++) { if (a1.data[i] !== a2.data[i]) d12++; if (a1.data[i] !== a3.data[i]) d13++; if (a2.data[i] !== a3.data[i]) d23++; }
    fs.writeFileSync(out.replace(/\.json$/, "-carte.png"), PNG.sync.write(a3));
    await link.hover(); await page.waitForTimeout(700);
    const tr = await link.evaluate((a) => ({ translate: getComputedStyle(a).translate, transitionDuration: getComputedStyle(a).transitionDuration }));
    res.mouvementReduit = { octetsDifferents_0_900ms: d12, octetsDifferents_0_1600ms: d13, octetsDifferents_900_1600ms: d23, survolSousMouvementReduit: tr };
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  await browser.close();
  const e = res.etat;
  console.log(JSON.stringify({ v: res.viewport, mode: res.mode, bg: e.bg, fg: e.color, colorBrut: e.colorBrut, fs: e.fontSize, fw: e.fontWeight, lignes: e.texte.lignes, box: e.box, translate: e.translate, outline: e.outline, focusVisible: e.focusVisible, reflet: { n: e.reflet.animations, d: e.reflet.duree, css: e.reflet.animationCss }, iconeAnim: e.iconeAnimations, pastilleAnim: e.iconePastilleAnimations,
    sansReflet: { texte: res.sansReflet.texte.pire, icone: res.sansReflet.icone.pire, g: res.sansReflet.ratioBoutGauche, d: res.sansReflet.ratioBoutDroit }, pireTexte: { t: res.pireTexte.t, r: res.pireTexte.texte.pire, clair: res.pireTexte.texte.fondLePlusClair, sombre: res.pireTexte.texte.fondLePlusSombre }, pireIcone: { t: res.pireIcone.t, r: res.pireIcone.icone.pire }, pireBouts: res.pireBouts,
    anneau: res.anneau, mouvementReduit: res.mouvementReduit, structure: { ...res.structure, ariaSnapshot: res.structure.ariaSnapshot } }));
})().catch((e) => { console.error(e); process.exit(1); });
