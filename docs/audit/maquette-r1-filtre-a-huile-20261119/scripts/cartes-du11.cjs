// cartes-du11.cjs — complément n° 11 : ligne « Fabrication » des cartes véhicule R1, mesurée sur le rendu.
// Usage : CHROME=/usr/bin/google-chrome PW=<node_modules>/playwright node cartes-du11.cjs <base> <R1 path> <w> <h> <profil> <out.json>
// Mesures : texte et style calculé de chaque ligne ; nombre de lignes de texte et coupure de la plage ;
// hauteur des cartes et vide sous le bouton (rangée de deux à 1440) ; contraste au pixel (ligne agrandie en place) ;
// cartes masquées révélées par le bouton ; CLS (layout-shift hors entrée récente) sur chargement + défilement complet.
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [, , base, R1, W, H, prof, out] = process.argv;
const BIG = +W < 600 ? 26 : 64;
const lum = (r, g, b) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratioL = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const hx = (d, i) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ratioHex = (a, b) => ratioL(lum(...rgb(a)), lum(...rgb(b)));
const dist = (d, i, v) => Math.abs(d[i] - v[0]) + Math.abs(d[i + 1] - v[1]) + Math.abs(d[i + 2] - v[2]);
// R1 masque le titre de la section (hideTitle) : la section est retrouvée depuis la première ligne « Fabrication ».
const SECTION = `(() => { const f = [...document.querySelectorAll("p")].find((e) => /^Fabrication/.test(e.textContent.trim())); return f ? f.closest("section") : null; })()`;
async function cartes(p) {
  return p.evaluate((SECTION) => {
    const sec = eval(SECTION); if (!sec) return null;
    const hex = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    const R = (r) => ({ x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
    const lignes = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return [...new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))].length; };
    const grid = [...sec.querySelectorAll(".grid")].find((g) => [...g.children].some((c) => c.tagName === "A"));
    return [...grid.children].map((a) => {
      const fab = [...a.querySelectorAll("p")].find((x) => /^Fabrication/.test(x.textContent.trim()));
      const span = fab && fab.querySelector("span");
      const cta = [...a.querySelectorAll("div")].find((d) => /^Voir les pièces$/.test(d.textContent.trim()));
      const autresP = [...a.querySelectorAll("p")].filter((x) => x !== fab).map((x) => x.textContent.trim().slice(0, 80));
      const ar = a.getBoundingClientRect(), cr = cta && cta.getBoundingClientRect();
      const s = fab && getComputedStyle(fab);
      return {
        titre: a.querySelector("h3")?.textContent.trim(), href: a.getAttribute("href"),
        badges: [...a.querySelectorAll(".rounded-full")].map((b) => b.textContent.trim()),
        ligne: fab ? fab.textContent.replace(/ /g, "␣") : null,
        annees: span ? span.textContent : null,
        style: s ? { couleur: hex(s.color), taille: s.fontSize, graisse: s.fontWeight, hauteurLigne: s.lineHeight, margeBas: s.marginBottom } : null,
        lignesTexte: fab ? lignes(fab) : null, lignesPlage: span ? lignes(span) : null,
        memeLigne: span ? lignes(fab) === 1 : null,
        autresParagraphes: autresP,
        carte: R(ar), cta: cr ? R(cr) : null,
        videSousBouton: cr ? Math.round(ar.bottom - cr.bottom) : null,
      };
    });
  }, SECTION);
}
(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.addInitScript(() => { window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, t: Math.round(e.startTime), recent: e.hadRecentInput, src: (e.sources || []).map((s) => { const n = s.node; return n && n.nodeType === 1 ? (n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + "." + String(n.className).slice(0, 60)) : String(n && n.nodeName); }) }); }).observe({ type: "layout-shift", buffered: true }); });
  const p = ctx.pages()[0] || (await ctx.newPage());
  const res = { base, page: R1, viewport: `${W}x${H}`, at: new Date().toISOString() };
  const r = await p.goto(base + R1, { waitUntil: "load", timeout: 120000 }); res.http = r.status(); await p.waitForTimeout(3000);
  // défilement complet, pas de 300 px (CLS en conditions de lecture)
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
  await p.waitForTimeout(1500);
  res.cartesAvantBouton = await cartes(p);
  // CLS : fenêtres de session (≤ 5 s, écart ≤ 1 s), maximum
  const ls = await p.evaluate(() => window.__ls);
  let best = 0, cur = 0, start = -1, prev = -1; for (const e of ls.filter((e) => !e.recent)) { if (start < 0 || e.t - prev > 1000 || e.t - start > 5000) { cur = 0; start = e.t; } cur += e.v; prev = e.t; best = Math.max(best, cur); }
  res.cls = { max: Math.round(best * 10000) / 10000, entrees: ls.filter((e) => !e.recent).length, sourcesCartes: ls.filter((e) => e.src.some((s) => /grid|rounded-xl|Fabrication/.test(s))).length, detail: ls.slice(0, 15) };
  // capture des quatre premières cartes
  const c0 = res.cartesAvantBouton[0], c3 = res.cartesAvantBouton[Math.min(3, res.cartesAvantBouton.length - 1)];
  await p.evaluate((y) => scrollTo(0, y - 20), c0.carte.y); await p.waitForTimeout(800);
  const sy = await p.evaluate(() => scrollY);
  const clip = { x: 0, y: c0.carte.y - sy - 10, width: +W, height: Math.min(+H - (c0.carte.y - sy - 10), c3.carte.y + c3.carte.h - c0.carte.y + 20) };
  fs.writeFileSync(out.replace(/\.json$/, ".png"), await p.screenshot({ clip }));
  // contraste au pixel : première ligne, taille réelle puis agrandie en place
  const fab = p.locator(`xpath=(//p[starts-with(normalize-space(.),'Fabrication')])[1]`);
  // centrée (block center) : à 390, la barre collante du haut recouvrait la ligne
  await fab.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })); await p.mouse.move(1, 1); await p.waitForTimeout(500);
  const bb = await fab.boundingBox();
  const img = PNG.sync.read(await p.screenshot({ clip: { x: bb.x, y: bb.y, width: bb.width, height: bb.height } }));
  const cn = new Map(); for (let i = 0; i < img.data.length; i += 4) { const k = hx(img.data, i); cn.set(k, (cn.get(k) || 0) + 1); }
  const fond = [...cn.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let ext = null, extD = -1; for (let i = 0; i < img.data.length; i += 4) { const d = dist(img.data, i, rgb(fond)); if (d > extD) { extD = d; ext = hx(img.data, i); } }
  await fab.evaluate((el, big) => { el.dataset.fs = el.style.cssText; el.style.fontSize = big + "px"; el.style.lineHeight = big + 10 + "px"; el.style.whiteSpace = "nowrap"; el.style.display = "inline-block"; }, BIG);
  await fab.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(400);
  const bb2 = await fab.boundingBox();
  const big = PNG.sync.read(await p.screenshot({ clip: { x: Math.max(0, bb2.x), y: bb2.y, width: Math.min(bb2.width, +W - Math.max(0, bb2.x)), height: bb2.height } }));
  fs.writeFileSync(out.replace(/\.json$/, "-agrandi.png"), PNG.sync.write(big));
  const bc = new Map(); for (let i = 0; i < big.data.length; i += 4) { const k = hx(big.data, i); bc.set(k, (bc.get(k) || 0) + 1); }
  const fondBig = [...bc.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const tc = new Map(); for (let i = 0; i < big.data.length; i += 4) { if (dist(big.data, i, rgb(fondBig)) > 200) { const k = hx(big.data, i); tc.set(k, (tc.get(k) || 0) + 1); } }
  const t = [...tc.entries()].sort((a, b) => b[1] - a[1])[0];
  await fab.evaluate((el) => { el.style.cssText = el.dataset.fs; });
  res.contraste = { tailleReelle: { fond, pixelLePlusContraste: ext, ratio: ratioHex(ext, fond) }, agrandi: { taille: BIG, fond: fondBig, texteDominant: t[0], pixels: t[1], ratio: ratioHex(t[0], fondBig) } };
  // cartes masquées : bouton « Voir … »
  const btn = p.locator("section button", { hasText: /Voir|Afficher/ }).filter({ hasNotText: /pièces/ }).first();
  if (await btn.count()) { res.bouton = (await btn.textContent()).trim().replace(/\s+/g, " "); await btn.click(); await p.waitForTimeout(800); res.cartesApresBouton = await cartes(p); }
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  const all = res.cartesApresBouton || res.cartesAvantBouton;
  const rangées = []; for (let i = 0; i < all.length; i += (+W >= 1024 ? 2 : 1)) rangées.push(all.slice(i, i + (+W >= 1024 ? 2 : 1)).map((c) => c.carte.h));
  console.log(W, R1, "http", res.http, "cartes", res.cartesAvantBouton.length, "->", all.length, "bouton", res.bouton || "-");
  console.log("  lignes:", all.map((c) => c.annees ?? "∅").join(" | "));
  console.log("  style:", JSON.stringify(all[0].style), "lignesTexte max", Math.max(...all.map((c) => c.lignesTexte || 0)), "plage coupée", all.filter((c) => c.lignesPlage > 1).length, "pas sur une ligne", all.filter((c) => c.memeLigne === false).length, "autres p", all.filter((c) => c.autresParagraphes.length).length);
  console.log("  hauteurs:", JSON.stringify(rangées), "vide sous bouton min/max", Math.min(...all.map((c) => c.videSousBouton)), Math.max(...all.map((c) => c.videSousBouton)));
  console.log("  contraste:", JSON.stringify(res.contraste), "cls", JSON.stringify({ max: res.cls.max, n: res.cls.entrees, cartes: res.cls.sourcesCartes }));
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
