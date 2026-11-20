// Complément n° 8 au mandat DU : bouton « Lancer le diagnostic » (classe no-visited) après visite réelle de /diagnostic-auto.
// Chrome complet + profil persistant temporaire (historique réel ; le Chromium réduit de Playwright et les
// contextes éphémères n'appliquent pas :visited). Mouvement non réduit, reflet mis en pause et masqué
// pour les mesures sur fond plein.
// Pour chaque état (avant visite, après visite) × (repos, survol) :
//  a. pixels du libellé tel qu'affiché : pixel le plus éloigné du fond, contre le fond dominant
//     (mesure « au pixel », anticrénelage compris) ;
//  b. couleur réelle du texte : libellé agrandi (26 px à 390, 64 px à 1440, une ligne) dans le même état (:visited reste appliqué),
//     couleur dominante des pixels pleins du texte, contre le fond plein autour (même voile éventuel) ;
//     le rapport contre la couleur calculée du fond est donné à part (il ignore le voile du reflet) ;
//  c. fond seul (texte transparent) : pixel le plus clair et le plus sombre sous le libellé ;
//  d. lien témoin sans classe de couleur vers /diagnostic-auto : violet = :visited actif.
// Usage : CHROME=/usr/bin/google-chrome PW=<node_modules>/playwright node visite-du8.cjs <base> <w> <h> <profil> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [, , base, W, H, prof, out] = process.argv;
const REDUCE = process.env.MODE === "reduce"; // mouvement réduit, reflet laissé visible (conditions de DS)
const BIG = +W < 600 ? 26 : 64;
async function centre(p, a) { let y0 = null; for (let i = 0; i < 12; i++) { await a.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(350); const b = await a.boundingBox(); if (y0 !== null && Math.abs(b.y - y0) < 1) break; y0 = b.y; } }
async function survoler(p, a) { const b = await a.boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height - 6); await p.waitForTimeout(700); }
const lum = (r, g, b) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratioL = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const hx = (d, i) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const R1 = "/pieces/filtre-a-huile-7.html";
const SEL = 'a[href="/diagnostic-auto"]';
async function textRect(a) {
  return a.evaluate((el) => { const tn = [...el.childNodes].find((c) => c.nodeType === 3 && c.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn); const t = rg.getBoundingClientRect(); return { x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.width), h: Math.round(t.height) }; });
}
async function etat(p, survol, tag) {
  await p.goto(base + R1, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500); await p.mouse.move(1, 1);
  const a = p.locator(SEL, { hasText: "Lancer le diagnostic" }).first(); await centre(p, a);
  const classe = await a.evaluate((el) => el.classList.contains("no-visited"));
  // reflet arrêté et masqué : fond plein, mesures stables
  if (!REDUCE) await a.evaluate((el) => { const s = el.querySelector(".animate-shimmer"); if (s) { s.getAnimations().forEach((x) => x.cancel()); s.style.visibility = "hidden"; } });
  const refletAnime = await a.evaluate((el) => { const s = el.querySelector(".animate-shimmer"); return s ? { animations: s.getAnimations().length, visibility: getComputedStyle(s).visibility, animationName: getComputedStyle(s).animationName } : null; });
  if (survol) await survoler(p, a);
  const dessus = await a.evaluate((el) => { const tn = [...el.childNodes].find((c) => c.nodeType === 3 && c.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn); const t = rg.getBoundingClientRect(); const e = document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2); return el.contains(e) ? "bouton" : (e && (e.tagName + "." + String(e.className).slice(0, 60))); });
  const r = await textRect(a);
  const clip = { x: r.x - 26, y: r.y - 2, width: r.w + 28, height: r.h + 4 };
  const buf = await p.screenshot({ clip }); fs.writeFileSync(out.replace(/\.json$/, `-${tag}.png`), buf);
  const img = PNG.sync.read(buf); const counts = new Map();
  for (let i = 0; i < img.data.length; i += 4) { const k = hx(img.data, i); counts.set(k, (counts.get(k) || 0) + 1); }
  const fond = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0]; const fv = rgb(fond);
  let ext = null, extD = -1, noirsPurs = 0;
  for (let i = 0; i < img.data.length; i += 4) { const d = Math.abs(img.data[i] - fv[0]) + Math.abs(img.data[i + 1] - fv[1]) + Math.abs(img.data[i + 2] - fv[2]); if (d > extD) { extD = d; ext = hx(img.data, i); } if (!img.data[i] && !img.data[i + 1] && !img.data[i + 2]) noirsPurs++; }
  const affiche = { fondDominant: fond, pixelDuTexteLePlusContraste: ext, pixelsNoirsPurs: noirsPurs, ratioAuPixel: ratioL(lum(...rgb(ext)), lum(...fv)) };
  // c. fond seul sous le libellé (texte transparent, transition coupée)
  await a.evaluate((el) => { el.style.transition = "none"; el.style.setProperty("color", "transparent", "important"); });
  await p.waitForTimeout(250);
  const fi = PNG.sync.read(await p.screenshot({ clip: { x: r.x - 1, y: r.y - 1, width: r.w + 2, height: r.h + 2 } }));
  let clair = null, cL = -1, sombre = null, sL = 2;
  for (let i = 0; i < fi.data.length; i += 4) { const L = lum(fi.data[i], fi.data[i + 1], fi.data[i + 2]); if (L > cL) { cL = L; clair = hx(fi.data, i); } if (L < sL) { sL = L; sombre = hx(fi.data, i); } }
  await a.evaluate((el) => { el.style.removeProperty("color"); });
  await p.waitForTimeout(250);
  // b. couleur réelle du texte : libellé agrandi (même lien, même état :visited)
  await a.evaluate((el, big) => { el.style.fontSize = big + "px"; el.style.lineHeight = big + 8 + "px"; el.style.whiteSpace = "nowrap"; }, BIG);
  await centre(p, a); await p.mouse.move(1, 1); if (survol) await survoler(p, a); else await p.waitForTimeout(300);
  const rb = await textRect(a);
  const big = PNG.sync.read(await p.screenshot({ clip: { x: Math.max(0, rb.x), y: Math.max(0, rb.y), width: Math.min(rb.w, +W - Math.max(0, rb.x)), height: rb.h } }));
  const bc = new Map(); for (let i = 0; i < big.data.length; i += 4) { const k = hx(big.data, i); bc.set(k, (bc.get(k) || 0) + 1); }
  const topBig = [...bc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
  const fondBig = topBig[0][0]; const fbv = rgb(fondBig);
  // couleur du texte = couleur la plus fréquente parmi les pixels éloignés du fond (intérieur des traits)
  const tc = new Map(); for (let i = 0; i < big.data.length; i += 4) { const d = Math.abs(big.data[i] - fbv[0]) + Math.abs(big.data[i + 1] - fbv[1]) + Math.abs(big.data[i + 2] - fbv[2]); if (d > 200) { const k = hx(big.data, i); tc.set(k, (tc.get(k) || 0) + 1); } }
  const texteReel = [...tc.entries()].sort((x, y) => y[1] - x[1])[0];
  const fondBouton = await a.evaluate((el) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = getComputedStyle(el).backgroundColor; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); });
  fs.writeFileSync(out.replace(/\.json$/, `-${tag}-agrandi.png`), PNG.sync.write(big));
  const couleurReelle = { texte: texteReel && texteReel[0], pixelsPleins: texteReel && texteReel[1], fondPlein: fondBig, fondBoutonCalcule: fondBouton, ratioTexteContreFondPlein: texteReel ? ratioL(lum(...rgb(texteReel[0])), lum(...rgb(fondBig))) : null, ratioTexteContreFondCalcule: texteReel ? ratioL(lum(...rgb(texteReel[0])), lum(...rgb(fondBouton))) : null };
  const fondSeul = { pixelLePlusClair: clair, pixelLePlusSombre: sombre, ratioNoirContreClair: ratioL(0, cL), ratioNoirContreSombre: ratioL(0, sL) };
  // d. lien témoin
  await p.mouse.move(1, 1);
  const tb = await p.evaluate(() => { const t = document.createElement("a"); t.href = "/diagnostic-auto"; t.textContent = "TEMOIN"; t.style.cssText = "position:fixed;top:0;left:0;z-index:99999;font:700 40px sans-serif;background:#fff;padding:4px"; document.body.appendChild(t); const q = t.getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; });
  await p.waitForTimeout(300); const ti = PNG.sync.read(await p.screenshot({ clip: tb }));
  const tcc = new Map(); for (let i = 0; i < ti.data.length; i += 4) { if (ti.data[i] + ti.data[i + 1] + ti.data[i + 2] < 500) { const k = hx(ti.data, i); tcc.set(k, (tcc.get(k) || 0) + 1); } }
  const temoin = [...tcc.entries()].sort((x, y) => y[1] - x[1])[0][0];
  return { classeNoVisited: classe, elementAuCentreDuLibelle: dessus, reflet: refletAnime, temoin, affiche, couleurReelle, fondSeul };
}
(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1, reducedMotion: REDUCE ? "reduce" : "no-preference" });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  const res = { base, viewport: `${W}x${H}`, mouvementReduit: REDUCE, at: new Date().toISOString(), navigateur: ctx.browser()?.version?.() || "chrome" };
  res.avantVisiteRepos = await etat(p, false, "avant-repos");
  res.avantVisiteSurvol = await etat(p, true, "avant-survol");
  // visite réelle : clic sur le bouton lui-même depuis R1
  await p.goto(base + R1, { waitUntil: "load" }); await p.waitForTimeout(2000);
  const a0 = p.locator(SEL, { hasText: "Lancer le diagnostic" }).first(); await centre(p, a0);
  await Promise.all([p.waitForURL(/diagnostic-auto/, { timeout: 60000 }), a0.click()]); await p.waitForTimeout(2000);
  res.apresVisiteRepos = await etat(p, false, "apres-repos");
  res.apresVisiteSurvol = await etat(p, true, "apres-survol");
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  for (const k of ["avantVisiteRepos", "avantVisiteSurvol", "apresVisiteRepos", "apresVisiteSurvol"]) { const e = res[k]; console.log(W, REDUCE ? "reduce" : "", k, JSON.stringify({ dessus: e.elementAuCentreDuLibelle, nv: e.classeNoVisited, temoin: e.temoin, affiche: e.affiche, reel: e.couleurReelle, fond: e.fondSeul })); }
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
