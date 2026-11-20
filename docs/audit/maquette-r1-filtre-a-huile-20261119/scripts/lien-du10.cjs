// lien-du10.cjs (dérivé de lien-du9.cjs) : soulignement au pixel, contrastes repos / survol / après visite réelle, focus clavier.
// Usage : CHROME=/usr/bin/google-chrome PW=<node_modules>/playwright R1=... SEL=... CIBLE=... node lien-du10.cjs <base> <w> <h> <profil> <out.json>
// Chrome complet + profil persistant temporaire (historique réel, :visited appliqué). Mouvement non réduit.
// Pour chaque état (avant visite, après visite réelle par clic sur le lien lui-même) × (repos, survol, focus clavier) :
//  a. styles calculés (couleur, soulignement, décalage, contour) ; NB : getComputedStyle masque :visited ;
//  b. soulignement au pixel : sous la première ligne du lien, lignes de pixels couvrant ≥ 80 % de sa largeur ;
//  c. couleur réelle du texte : lien agrandi (26 px à 390, 64 px à 1440), couleur dominante des pixels pleins,
//     contre le fond plein ; rapport contre le texte voisin (couleur calculée du paragraphe) ;
//  d. focus clavier (Tab depuis l'élément focalisable précédent, puis recentrage) : différence avec / sans contour,
//     couleur dominante de l'anneau, rapport contre le fond ;
//  e. lien témoin sans couleur vers la même adresse : violet = :visited actif ;
//  f. cible : boîtes de ligne du lien, hauteur de ligne du paragraphe, position dans le paragraphe.
// Usage : CHROME=/usr/bin/google-chrome PW=<node_modules>/playwright LIEN=conseils node lien-du9.cjs <base> <w> <h> <profil> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [, , base, W, H, prof, out] = process.argv;
const BIG = +W < 600 ? 26 : 64;
// Complément n° 10 : lien choisi par variables d'environnement.
// R1=/pieces/<gamme>.html  SEL='#bien-choisir .gamme-editorial a[href="..."]'  CIBLE=<regex de l'URL atteinte au clic>
const L = { sel: process.env.SEL, cible: new RegExp(process.env.CIBLE) };
const R1 = process.env.R1;
const lum = (r, g, b) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratioL = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const hx = (d, i) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ratioHex = (a, b) => ratioL(lum(...rgb(a)), lum(...rgb(b)));
const dist = (d, i, v) => Math.abs(d[i] - v[0]) + Math.abs(d[i + 1] - v[1]) + Math.abs(d[i + 2] - v[2]);
async function centre(p, a) { let y0 = null; for (let i = 0; i < 12; i++) { await a.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(350); const b = await a.boundingBox(); if (y0 !== null && Math.abs(b.y - y0) < 1) break; y0 = b.y; } }
async function rects(a) { return a.evaluate((el) => [...el.getClientRects()].map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }))); }
async function survoler(p, a) { const r = (await rects(a))[0]; await p.mouse.move(r.x + Math.min(r.w / 2, 30), r.y + r.h / 2); await p.waitForTimeout(500); }
async function calc(a) {
  return a.evaluate((el) => {
    const hex = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    const s = getComputedStyle(el), ps = getComputedStyle(el.parentElement);
    return { couleur: hex(s.color), soulignement: s.textDecorationLine, couleurSoulignement: hex(s.textDecorationColor), epaisseur: s.textDecorationThickness, decalage: s.textUnderlineOffset, contour: `${s.outlineStyle} ${s.outlineWidth} ${hex(s.outlineColor)} décalage ${s.outlineOffset}`, classes: el.className || null, parent: el.parentElement.tagName.toLowerCase(), couleurTexteVoisin: hex(ps.color), taille: s.fontSize, graisse: s.fontWeight, hauteurLigneParagraphe: ps.lineHeight, matchFocusVisible: el.matches(":focus-visible"), matchHover: el.matches(":hover") };
  });
}
function soulignementAuPixel(img, fondV) {
  // lignes (rangées) du bas de la boîte où ≥ 80 % de la largeur diffère du fond
  const rows = [];
  for (let y = 0; y < img.height; y++) { let n = 0; const cc = new Map(); for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (dist(img.data, i, fondV) > 60) { n++; const k = hx(img.data, i); cc.set(k, (cc.get(k) || 0) + 1); } } const cov = n / img.width; if (cov >= 0.8) rows.push({ rangee: y, couverture: Math.round(cov * 100) / 100, couleur: [...cc.entries()].sort((a, b) => b[1] - a[1])[0][0] }); }
  return rows;
}
async function mesurer(p, a, etatNom, tag) {
  const r0 = (await rects(a))[0];
  const ca = await calc(a);
  // b. soulignement au pixel sur la première ligne (boîte + 6 px dessous)
  const clip = { x: r0.x, y: r0.y, width: r0.w, height: r0.h + 6 };
  const buf = await p.screenshot({ clip }); fs.writeFileSync(out.replace(/\.json$/, `-${tag}.png`), buf);
  const img = PNG.sync.read(buf); const counts = new Map();
  for (let i = 0; i < img.data.length; i += 4) { const k = hx(img.data, i); counts.set(k, (counts.get(k) || 0) + 1); }
  const fond = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const rows = soulignementAuPixel(img, rgb(fond));
  let ext = null, extD = -1; for (let i = 0; i < img.data.length; i += 4) { const d = dist(img.data, i, rgb(fond)); if (d > extD) { extD = d; ext = hx(img.data, i); } }
  return { etat: etatNom, calcule: ca, premiereLigne: r0, fondDominant: fond, pixelLePlusContraste: ext, ratioAuPixel: ratioHex(ext, fond), soulignementAuPixel: rows };
}
async function couleurReelle(p, a, survol, focus, tag) {
  // agrandi en place : même lien, même état (:visited, :hover, :focus-visible)
  await a.evaluate((el, big) => { el.dataset.fs = el.style.cssText; el.style.fontSize = big + "px"; el.style.lineHeight = big + 10 + "px"; el.style.whiteSpace = "nowrap"; el.style.display = "inline-block"; el.style.textDecoration = "none"; el.style.outline = "none"; el.style.transition = "none"; }, BIG);
  await centre(p, a); await p.mouse.move(1, 1); if (survol) await survoler(p, a); else await p.waitForTimeout(300);
  const r = (await rects(a))[0];
  const big = PNG.sync.read(await p.screenshot({ clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.w, +W - Math.max(0, r.x)), height: r.h } }));
  fs.writeFileSync(out.replace(/\.json$/, `-${tag}-agrandi.png`), PNG.sync.write(big));
  const bc = new Map(); for (let i = 0; i < big.data.length; i += 4) { const k = hx(big.data, i); bc.set(k, (bc.get(k) || 0) + 1); }
  const fondBig = [...bc.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const tc = new Map(); for (let i = 0; i < big.data.length; i += 4) { if (dist(big.data, i, rgb(fondBig)) > 200) { const k = hx(big.data, i); tc.set(k, (tc.get(k) || 0) + 1); } }
  const t = [...tc.entries()].sort((x, y) => y[1] - x[1])[0];
  const voisin = await a.evaluate((el) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = getComputedStyle(el.parentElement).color; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); });
  await a.evaluate((el) => { el.style.cssText = el.dataset.fs; delete el.dataset.fs; });
  await p.mouse.move(1, 1); await p.waitForTimeout(200);
  return { texte: t[0], pixelsPleins: t[1], fondPlein: fondBig, ratioContreFond: ratioHex(t[0], fondBig), texteVoisin: voisin, ratioContreTexteVoisin: ratioHex(t[0], voisin) };
}
async function focusClavier(p, a, tag) {
  // élément focalisable précédent dans l'ordre du document, puis Tab ; ensuite recentrage, capture avec l'anneau,
  // puis même capture avec contour et anneau masqués (outline-style et box-shadow à none) : la différence est l'indicateur.
  await p.mouse.move(1, 1);
  await a.evaluate((el) => { const all = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((e) => !e.disabled && e.offsetParent !== null); const i = all.indexOf(el); (all[i - 1] || document.body).focus(); });
  await p.keyboard.press("Tab"); await p.waitForTimeout(400);
  const actif = await a.evaluate((el) => document.activeElement === el);
  await a.evaluate((el) => { el.style.transition = "none"; });
  await centre(p, a);
  const ca = Object.assign(await calc(a), await a.evaluate((el) => ({ ombre: getComputedStyle(el).boxShadow })));
  const r = (await rects(a))[0]; const clip = { x: Math.max(0, r.x - 8), y: r.y - 8, width: Math.min(r.w + 16, +W - Math.max(0, r.x - 8)), height: r.h + 16 };
  const avecBuf = await p.screenshot({ clip }); fs.writeFileSync(out.replace(/\.json$/, `-${tag}.png`), avecBuf);
  const avec = PNG.sync.read(avecBuf);
  await a.evaluate((el) => { el.style.outlineStyle = "none"; el.style.boxShadow = "none"; }); await p.waitForTimeout(200);
  const sans = PNG.sync.read(await p.screenshot({ clip }));
  await a.evaluate((el) => { el.style.removeProperty("outline-style"); el.style.removeProperty("box-shadow"); });
  const toujoursActif = await a.evaluate((el) => document.activeElement === el && el.matches(":focus-visible"));
  const cc = new Map(); let n = 0;
  for (let i = 0; i < avec.data.length; i += 4) { if (dist(avec.data, i, [sans.data[i], sans.data[i + 1], sans.data[i + 2]]) > 30) { n++; const k = hx(avec.data, i); cc.set(k, (cc.get(k) || 0) + 1); } }
  const anneau = n ? [...cc.entries()].sort((x, y) => y[1] - x[1])[0][0] : null;
  // fond juste à l'extérieur de l'anneau : pixels de la bordure de la capture sans anneau
  const fc = new Map(); for (let y = 0; y < sans.height; y++) for (let x = 0; x < sans.width; x++) { if (y > 1 && y < sans.height - 2 && x > 1 && x < sans.width - 2) continue; const i = (y * sans.width + x) * 4; const k = hx(sans.data, i); fc.set(k, (fc.get(k) || 0) + 1); }
  const fond = [...fc.entries()].sort((x, y) => y[1] - x[1])[0][0];
  return { actif, toujoursActif, calcule: ca, pixelsAnneau: n, couleurAnneau: anneau, fond, ratioAnneauContreFond: anneau ? ratioHex(anneau, fond) : null };
}
async function temoin(p) {
  await p.mouse.move(1, 1);
  const href = L.sel.match(/href="([^"]+)"/)[1];
  const tb = await p.evaluate((h) => { const t = document.createElement("a"); t.href = h; t.textContent = "TEMOIN"; t.style.cssText = "position:fixed;top:0;left:0;z-index:99999;font:700 40px sans-serif;background:#fff;padding:4px;text-decoration:none"; document.body.appendChild(t); const q = t.getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; }, href);
  await p.waitForTimeout(300); const ti = PNG.sync.read(await p.screenshot({ clip: tb }));
  await p.evaluate(() => document.body.lastElementChild.remove());
  const tcc = new Map(); for (let i = 0; i < ti.data.length; i += 4) { if (ti.data[i] + ti.data[i + 1] + ti.data[i + 2] < 500) { const k = hx(ti.data, i); tcc.set(k, (tcc.get(k) || 0) + 1); } }
  return [...tcc.entries()].sort((x, y) => y[1] - x[1])[0][0];
}
async function cible(a) {
  return a.evaluate((el) => {
    const par = el.parentElement; const ps = getComputedStyle(par);
    const txt = par.textContent.replace(/\s+/g, " ").trim(); const lt = el.textContent.replace(/\s+/g, " ").trim();
    const idx = txt.indexOf(lt);
    const autres = [...par.querySelectorAll("a")].filter((x) => x !== el).map((x) => { const r = x.getBoundingClientRect(); return { texte: x.textContent.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
    return { boites: [...el.getClientRects()].map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })), display: getComputedStyle(el).display, parent: par.tagName.toLowerCase(), hauteurLigneParagraphe: ps.lineHeight, taillePolice: ps.fontSize, texteAvant: txt.slice(Math.max(0, idx - 80), idx), texteApres: txt.slice(idx + lt.length, idx + lt.length + 40), autresLiensDuParagraphe: autres };
  });
}
async function etat(p, tag) {
  const res = {};
  await p.goto(base + R1, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500); await p.mouse.move(1, 1);
  const a = p.locator(L.sel).first(); await centre(p, a);
  res.cible = await cible(a);
  res.repos = await mesurer(p, a, "repos", `${tag}-repos`);
  res.repos.couleurReelle = await couleurReelle(p, a, false, false, `${tag}-repos`);
  await centre(p, a); await survoler(p, a);
  res.survol = await mesurer(p, a, "survol", `${tag}-survol`);
  res.survol.couleurReelle = await couleurReelle(p, a, true, false, `${tag}-survol`);
  await centre(p, a);
  res.focus = await focusClavier(p, a, `${tag}-focus`);
  res.focus.couleurReelle = await couleurReelle(p, a, false, true, `${tag}-focus`);
  res.temoin = await temoin(p);
  return res;
}
(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  const res = { base, lien: process.env.SEL, page: R1, selecteur: L.sel, viewport: `${W}x${H}`, at: new Date().toISOString(), navigateur: ctx.browser()?.version?.() || "chrome" };
  res.avantVisite = await etat(p, "avant");
  // visite réelle : clic sur le lien lui-même depuis R1
  await p.goto(base + R1, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2000);
  const a0 = p.locator(L.sel).first(); await centre(p, a0);
  await Promise.all([p.waitForURL(L.cible, { timeout: 120000 }), a0.click()]); await p.waitForTimeout(2000);
  res.visite = { url: p.url().replace(base, "") };
  res.apresVisite = await etat(p, "apres");
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  for (const k of ["avantVisite", "apresVisite"]) { const e = res[k]; for (const s of ["repos", "survol", "focus"]) { const m = e[s]; console.log(W, k, s, JSON.stringify({ calc: { c: m.calcule.couleur, sl: m.calcule.soulignement, off: m.calcule.decalage, fv: m.calcule.matchFocusVisible, hv: m.calcule.matchHover }, pix: m.ratioAuPixel, souligne: (m.soulignementAuPixel || []).map((r) => r.rangee + ":" + r.couleur + ":" + r.couverture).join(","), reel: m.couleurReelle, anneau: s === "focus" ? { actif: m.actif, n: m.pixelsAnneau, c: m.couleurAnneau, f: m.fond, r: m.ratioAnneauContreFond } : undefined })); } console.log(W, k, "temoin", e.temoin, "cible", JSON.stringify(e.cible.boites), e.cible.hauteurLigneParagraphe); }
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
