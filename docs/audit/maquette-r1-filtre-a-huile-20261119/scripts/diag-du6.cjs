// Complément n° 6 au mandat DU : contraste du bloc « Diagnostic gratuit » (GammeDiagnosticCTA) au pixel.
// - couleurs calculées du dégradé du bouton et de la pastille (variables --color-orange-* du CSS construit) ;
// - texte blanc du bouton : fond mesuré sous le texte (texte rendu transparent), à chaque position du reflet
//   (animation animate-shimmer mise en pause et placée à N instants), aux deux bouts du dégradé, au survol ;
// - titre et paragraphe du bloc ; icône blanche sur sa pastille (1.4.11, 3:1) ;
// - zones cliquables (lien et bouton).
// Usage : PW=<node_modules>/playwright node diag-du6.cjs <url> <width> <height> <out.json> [hover]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [, , url, W, H, out, hoverArg] = process.argv;
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const lumRgb = (r, g, b) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const lumHex = (h) => lumRgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const ratioL = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const ratio = (a, b) => ratioL(lumHex(a), lumHex(b));
// Statistiques de fond dans un rectangle (coordonnées relatives à la capture) : pixel le plus clair (pire cas
// face à un texte blanc), médiane, et contraste de fg contre chacun.
function bgStats(img, rect, fg) {
  const ls = []; let light = null, lightL = -1;
  for (let y = Math.max(0, rect.y); y < Math.min(img.height, rect.y + rect.h); y++)
    for (let x = Math.max(0, rect.x); x < Math.min(img.width, rect.x + rect.w); x++) {
      const i = (y * img.width + x) * 4; const L = lumRgb(img.data[i], img.data[i + 1], img.data[i + 2]); ls.push(L);
      if (L > lightL) { lightL = L; light = hex(img.data[i], img.data[i + 1], img.data[i + 2]); }
    }
  ls.sort((a, b) => a - b); const med = ls[Math.floor(ls.length / 2)];
  const fgL = lumHex(fg);
  return { pixels: ls.length, fondLePlusClair: light, ratioPire: ratioL(fgL, lightL), ratioMedian: ratioL(fgL, med), ratioFondLePlusSombre: ratioL(fgL, ls[0]) };
}
function px(img, x, y) { const i = (y * img.width + x) * 4; return hex(img.data[i], img.data[i + 1], img.data[i + 2]); }
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: "no-preference", deviceScaleFactor: 1 });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const btn = page.locator('a[href="/diagnostic-auto"] button', { hasText: "Lancer le diagnostic" }).first();
  await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  // Simulation d'une correction, dans ce navigateur seulement (rien n'est écrit) : SIM_BG = background-image,
  // SIM_FG = couleur du texte, SIM_NO_SHIMMER=1 retire le reflet.
  if (process.env.SIM_BG || process.env.SIM_FG || process.env.SIM_NO_SHIMMER) await btn.evaluate((b, s) => { b.style.transition = "none"; if (s.bg) b.style.backgroundImage = s.bg; if (s.fg) b.style.setProperty("color", s.fg, "important"); if (s.noSh) b.querySelector(".animate-shimmer")?.remove(); }, { bg: process.env.SIM_BG, fg: process.env.SIM_FG, noSh: process.env.SIM_NO_SHIMMER });
  if (hoverArg === "hover") { await btn.hover(); await page.waitForTimeout(600); }
  const info = await btn.evaluate((b) => {
    const cv = document.createElement("canvas").getContext("2d");
    const toHex = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const root = getComputedStyle(document.documentElement);
    const vars = {}; for (const v of ["--color-orange-500", "--color-orange-600", "--color-orange-100", "--color-orange-200", "--color-cta-500", "--color-cta-600", "--color-cta-700", "--color-cta-800", "--color-slate-500", "--color-slate-900", "--color-cta"]) { const raw = root.getPropertyValue(v).trim(); vars[v] = raw ? { brut: raw, hex: toHex(raw) } : null; }
    const card = b.closest("div.bg-white"); const pastille = card.querySelector("div.bg-gradient-to-br"); const h2 = card.querySelector("h2"); const p = card.querySelector("p");
    const shimmer = b.querySelector(".animate-shimmer");
    const tn = [...b.childNodes].find((c) => c.nodeType === 3 && c.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn);
    const tr = rg.getBoundingClientRect(); const lignes = new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
    const anims = shimmer ? shimmer.getAnimations() : [];
    const cs = getComputedStyle(b);
    return {
      vars,
      bouton: { backgroundImage: cs.backgroundImage, color: toHex(cs.color), fontSize: cs.fontSize, fontWeight: cs.fontWeight, box: box(b), lien: box(b.closest("a")), translate: cs.translate, texte: { x: Math.round(tr.x), y: Math.round(tr.y), w: Math.round(tr.width), h: Math.round(tr.height), lignes }, icone: box(b.querySelector("svg")) },
      reflet: shimmer ? { animations: anims.length, nom: anims[0]?.animationName, duree: anims[0]?.effect?.getTiming().duration, backgroundImage: getComputedStyle(shimmer).backgroundImage } : null,
      pastille: { backgroundImage: getComputedStyle(pastille).backgroundImage, box: box(pastille), icone: box(pastille.querySelector("svg")), iconeColor: toHex(getComputedStyle(pastille.querySelector("svg")).color) },
      titre: { texte: h2.textContent.trim(), color: toHex(getComputedStyle(h2).color), fontSize: getComputedStyle(h2).fontSize, fontWeight: getComputedStyle(h2).fontWeight, box: box(h2) },
      paragraphe: { texte: p.textContent.trim().replace(/\s+/g, " "), color: toHex(getComputedStyle(p).color), fontSize: getComputedStyle(p).fontSize, fontWeight: getComputedStyle(p).fontWeight, box: box(p) },
      carte: { bg: toHex(getComputedStyle(card).backgroundColor), box: box(card) },
    };
  });
  // Couleurs du dégradé du bouton, converties en hexadécimal (oklch → sRGB par le canevas)
  info.bouton.degrade = await page.evaluate((bi) => { const cv = document.createElement("canvas").getContext("2d"); return (bi.match(/(oklch|rgb|rgba|oklab|color)\([^)]*\)/g) || []).map((c) => { cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { css: c, hex: "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("") }; }); }, info.bouton.backgroundImage);
  info.pastille.degrade = await page.evaluate((bi) => { const cv = document.createElement("canvas").getContext("2d"); return (bi.match(/(oklch|rgb|rgba|oklab|color)\([^)]*\)/g) || []).map((c) => { cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { css: c, hex: "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("") }; }); }, info.pastille.backgroundImage);
  const B = info.bouton.box; const fg = info.bouton.color;
  const rel = (r, pad = 1) => ({ x: r.x - B.x - pad, y: r.y - B.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });
  // Texte et icônes transparents : il ne reste que le fond (dégradé + reflet)
  await btn.evaluate((b) => { b.style.transition = "none"; b.dataset.du6 = b.style.color; b.style.color = "transparent"; }); await page.waitForTimeout(250);
  const N = 24; const frames = [];
  const shot = async () => PNG.sync.read(await page.screenshot({ clip: { x: B.x, y: B.y, width: B.w, height: B.h } }));
  if (info.reflet && info.reflet.animations) {
    for (let k = 0; k < N; k++) {
      await btn.evaluate((b, f) => { const a = b.querySelector(".animate-shimmer").getAnimations()[0]; a.pause(); a.currentTime = f * Number(a.effect.getTiming().duration); }, k / N);
      await page.waitForTimeout(60);
      const img = await shot();
      frames.push({ k, t: Math.round((k / N) * 100) / 100, texte: bgStats(img, rel(info.bouton.texte), fg), icone: bgStats(img, rel(info.bouton.icone), fg), boutGauche: px(img, 6, Math.round(B.h / 2)), boutDroit: px(img, B.w - 7, Math.round(B.h / 2)) });
      if (k === 0) fs.writeFileSync(out.replace(/\.json$/, "-fond-t0.png"), PNG.sync.write(img));
    }
  } else {
    const img = await shot(); frames.push({ k: 0, sansReflet: true, texte: bgStats(img, rel(info.bouton.texte), fg), icone: bgStats(img, rel(info.bouton.icone), fg), boutGauche: px(img, 6, Math.round(B.h / 2)), boutDroit: px(img, B.w - 7, Math.round(B.h / 2)) });
  }
  // Fond sans reflet : le reflet masqué, pour les deux bouts du dégradé sans éclaircissement
  await btn.evaluate((b) => { const s = b.querySelector(".animate-shimmer"); if (s) s.style.visibility = "hidden"; });
  await page.waitForTimeout(60);
  const nu = await shot();
  const sansReflet = { texte: bgStats(nu, rel(info.bouton.texte), fg), boutGauche: px(nu, 6, Math.round(B.h / 2)), boutDroit: px(nu, B.w - 7, Math.round(B.h / 2)) };
  sansReflet.ratioBoutGauche = ratio(fg, sansReflet.boutGauche); sansReflet.ratioBoutDroit = ratio(fg, sansReflet.boutDroit);
  await btn.evaluate((b) => { const s = b.querySelector(".animate-shimmer"); if (s) s.style.visibility = ""; b.style.color = b.dataset.du6 || ""; });
  await page.waitForTimeout(100);
  const vis = await page.screenshot({ clip: { x: B.x, y: B.y, width: B.w, height: B.h } });
  fs.writeFileSync(out.replace(/\.json$/, "-bouton.png"), vis);
  // Pastille : icône masquée, fond sous l'icône ; contraste blanc contre le pixel le plus clair
  const P = info.pastille.box;
  await page.evaluate(() => { const s = [...document.querySelectorAll("div.bg-gradient-to-br svg")].find((x) => x.closest("div.bg-white")); });
  const pastHandle = btn.locator("xpath=ancestor::div[contains(@class,'bg-white')][1]//div[contains(@class,'bg-gradient-to-br')]").first();
  await pastHandle.evaluate((e) => { e.querySelector("svg").style.visibility = "hidden"; });
  await page.waitForTimeout(60);
  const pimg = PNG.sync.read(await page.screenshot({ clip: { x: P.x, y: P.y, width: P.w, height: P.h } }));
  const I = info.pastille.icone;
  info.pastille.mesure = bgStats(pimg, { x: I.x - P.x, y: I.y - P.y, w: I.w, h: I.h }, info.pastille.iconeColor);
  await pastHandle.evaluate((e) => { e.querySelector("svg").style.visibility = ""; });
  await page.waitForTimeout(60);
  fs.writeFileSync(out.replace(/\.json$/, "-pastille.png"), await page.screenshot({ clip: { x: P.x, y: P.y, width: P.w, height: P.h } }));
  // Titre et paragraphe : couleur calculée contre le fond majoritaire mesuré dans leur boîte
  const maj = async (r) => { const img = PNG.sync.read(await page.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h } })); const m = new Map(); for (let i = 0; i < img.data.length; i += 4) { const k = hex(img.data[i], img.data[i + 1], img.data[i + 2]); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
  for (const k of ["titre", "paragraphe"]) { const bg = await maj(info[k].box); info[k].fondMesure = bg; info[k].ratio = ratio(info[k].color, bg); }
  const pire = frames.reduce((a, f) => (f.texte.ratioPire < a.texte.ratioPire ? f : a), frames[0]);
  const pireIcone = frames.reduce((a, f) => (f.icone.ratioPire < a.icone.ratioPire ? f : a), frames[0]);
  const res = { url, at: new Date().toISOString(), viewport: `${W}x${H}`, survol: hoverArg === "hover", info, sansReflet, framesReflet: frames, pire: { t: pire.t, ...pire.texte }, pireIconeBouton: { t: pireIcone.t, ...pireIcone.icone }, meilleurSousReflet: Math.max(...frames.map((f) => f.texte.ratioPire)) };
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  await browser.close();
  console.log(JSON.stringify({ viewport: res.viewport, survol: res.survol, couleurs: info.vars, degradeBouton: info.bouton.degrade.map((d) => d.hex), texteBouton: { fg, size: info.bouton.fontSize, weight: info.bouton.fontWeight, lignes: info.bouton.texte.lignes }, sansReflet, pireTexte: res.pire, pireIconeBouton: res.pireIconeBouton, reflet: info.reflet && { n: info.reflet.animations, nom: info.reflet.nom, duree: info.reflet.duree }, pastille: { degrade: info.pastille.degrade.map((d) => d.hex), icone: info.pastille.iconeColor, mesure: info.pastille.mesure, box: P }, titre: { c: info.titre.color, bg: info.titre.fondMesure, r: info.titre.ratio, fs: info.titre.fontSize }, paragraphe: { c: info.paragraphe.color, bg: info.paragraphe.fondMesure, r: info.paragraphe.ratio, fs: info.paragraphe.fontSize }, cibles: { bouton: B, lien: info.bouton.lien }, translate: info.bouton.translate }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
