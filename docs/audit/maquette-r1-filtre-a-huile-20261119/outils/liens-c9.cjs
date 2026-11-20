// Complément n° 9 au mandat DS : liens des conteneurs éditoriaux de #bien-choisir, #qualite-prix et
// #emplacement d'une page R1. Dérivé de lien-c8.cjs (complément n° 8), étendu à tous les liens des trois blocs.
// À 390×844 (échelle 2, mobile) et 1440×900 (échelle 1), mouvement réduit, Chromium de Playwright.
// Pour chaque lien : styles calculés (couleur, text-decoration, décalage, couleur du trait), rapport lien /
// texte voisin, pixels du soulignement (diff. avec text-decoration:none forcé sur ce lien), contraste au pixel
// sur le fond dominant de chaque ligne du lien au repos et au survol, focus clavier (Tab depuis l'élément focalisable précédent).
// Les sections portent cv-auto : chaque lien est centré à l'écran avant mesure.
// Captures : paragraphe de chaque lien, au repos (lien centré). L'état « visité » se mesure avec visite-lien-c8.cjs (SEL=…).
// Usage : URL_PATH=/pieces/… node liens-c9.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const BLOCS = ["bien-choisir", "qualite-prix", "emplacement"];
const [, , base, label, outDir] = process.argv;

async function px(page, clip) {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    return Array.from(x.getImageData(0, 0, c.width, c.height).data);
  }, png.toString("base64"));
}
function ratioOf(a, b) {
  const q = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (c) => 0.2126 * q(c[0]) + 0.7152 * q(c[1]) + 0.0722 * q(c[2]);
  const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
const TO_RGB = `window.__c9rgb = (c) => { const cv = document.createElement("canvas"); cv.width = cv.height = 1; const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,1,1); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return d[0] + ", " + d[1] + ", " + d[2]; };`;
const hx = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function worstBg(data, color) {
  const m = new Map(); for (let i = 0; i < data.length; i += 4) { const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
  const tot = data.length / 4; let best = null;
  for (const [k, n] of m) { if (n <= tot * 0.03) continue; const bg = [k >> 16, (k >> 8) & 255, k & 255]; const r = ratioOf(color, bg); if (r <= 1.05) continue; if (!best || r < best.ratio) best = { ratio: r, fond: hx(bg) }; }
  return best;
}
// fond = couleur dominante de chaque ligne du lien (boîte de ligne, getClientRects) ; rapport = couleur
// calculée du lien contre ce fond ; on garde la pire ligne. La boîte englobante d'un lien sur plusieurs
// lignes contient du texte voisin : elle n'est utilisée que pour le diff du soulignement et le focus.
async function parLigne(page, rects, color) {
  let best = null;
  for (const q of rects) {
    const d = await px(page, { x: Math.max(0, q.x), y: q.y, width: q.w, height: q.h + 3 });
    const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
    const k = [...m.entries()].sort((x, y) => y[1] - x[1])[0][0]; const bg = [k >> 16, (k >> 8) & 255, k & 255];
    const r = ratioOf(color, bg); if (!best || r < best.ratio) best = { ratio: r, fond: hx(bg) };
  }
  return best;
}
function diff(a, b) { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n; }

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, label, at: new Date().toISOString(), vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true, s: 2 }, { n: "1440", w: 1440, h: 900, m: false, s: 1 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
    await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.addScriptTag({ content: TO_RGB });
    const ids = await page.evaluate((BLOCS) => {
      const out = [];
      for (const b of BLOCS) document.querySelectorAll(`section#${b} .gamme-editorial`).forEach((c, ci) => {
        c.setAttribute("data-c9-cont", `${b}-${ci}`);
        c.querySelectorAll("a").forEach((a, ai) => { const id = `${b}-${ci}-${ai}`; a.setAttribute("data-c9", id); out.push({ id, bloc: b }); });
      });
      return out;
    }, BLOCS);
    const v = (report.vues[vp.n] = { conteneurs: {}, liens: [] });
    for (const b of BLOCS) { const c = page.locator(`[data-c9-cont^="${b}-"]`).first(); if (await c.count()) v.conteneurs[b] = await c.evaluate((e) => e.className); }
    for (const { id, bloc } of ids) {
      const sel = `[data-c9="${id}"]`; const a = page.locator(sel);
      await a.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await page.waitForTimeout(400);
      const info = await a.evaluate((el) => {
        const cs = getComputedStyle(el); const ps = getComputedStyle(el.parentElement); const r = el.getBoundingClientRect();
        return { texte: el.textContent.trim().slice(0, 70), href: el.getAttribute("href"), classe: el.className || "", couleur: window.__c9rgb(cs.color), texteVoisin: window.__c9rgb(ps.color), decoration: cs.textDecorationLine, decalage: cs.textUnderlineOffset, couleurTrait: window.__c9rgb(cs.textDecorationColor), alphaTrait: cs.textDecorationColor, boite: { x: r.x, y: r.y, w: r.width, h: r.height }, rects: [...el.getClientRects()].map((q) => `${Math.round(q.width)}×${Math.round(q.height)}`), lignes: [...el.getClientRects()].map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height })) };
      });
      // capture : paragraphe du lien, lien centré (un conteneur plus haut que la vue sort vide : cv-auto)
      await a.evaluate((el) => el.parentElement.setAttribute("data-c9-p", "1"));
      await page.locator('[data-c9-p="1"]').screenshot({ path: path.join(outDir, `${label}-${SLUG}-${id}-${vp.n}.png`) });
      await a.evaluate((el) => el.parentElement.removeAttribute("data-c9-p"));
      const L = { id, bloc, ...info, rapportLienTexteVoisin: ratioOf(rgb(info.couleur), rgb(info.texteVoisin)) };
      const b = info.boite; const clip = { x: Math.max(0, b.x - 2), y: b.y - 2, width: b.w + 4, height: b.h + 4 };
      const on = await px(page, clip);
      await page.addStyleTag({ content: `${sel}{text-decoration:none!important}` }); await page.waitForTimeout(100);
      const off = await px(page, clip);
      await page.evaluate(() => document.querySelectorAll("style").forEach((s) => { if (s.textContent.includes("text-decoration:none!important")) s.remove(); }));
      L.pixelsDuSoulignement = diff(on, off);
      L.repos = await parLigne(page, info.lignes, rgb(info.couleur));
      await a.hover(); await page.waitForTimeout(350);
      const hc = await a.evaluate((el) => ({ couleur: window.__c9rgb(getComputedStyle(el).color), decoration: getComputedStyle(el).textDecorationLine }));
      L.survol = { ...hc, ...(await parLigne(page, info.lignes, rgb(hc.couleur))) };
      await page.mouse.move(1, 1); await page.waitForTimeout(250);
      const fclip = { x: Math.max(0, b.x - 8), y: b.y - 8, width: b.w + 16, height: b.h + 16 };
      const before = await px(page, fclip);
      await a.evaluate((el) => { const f = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.offsetParent !== null || e === el); const i = f.indexOf(el); f[i - 1].focus(); });
      await page.keyboard.press("Tab"); await page.waitForTimeout(250);
      const foc = await a.evaluate((el) => ({ actif: document.activeElement === el, focusVisible: el.matches(":focus-visible"), contour: `${getComputedStyle(el).outlineWidth} ${getComputedStyle(el).outlineStyle} rgb(${window.__c9rgb(getComputedStyle(el).outlineColor)})` }));
      L.focus = { ...foc, pixelsChanges: diff(before, await px(page, fclip)) };
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      v.liens.push(L);
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-liens.json`), JSON.stringify(report, null, 2));
  for (const [n, v] of Object.entries(report.vues)) {
    console.log(`== ${label} ${SLUG} ${n} px`);
    for (const L of v.liens) console.log(`  ${L.bloc.padEnd(12)} ${L.texte.slice(0, 34).padEnd(34)} [${L.classe || "-"}] ${L.decoration}/${L.decalage} trait ${L.alphaTrait.slice(0, 28)} px=${L.pixelsDuSoulignement} voisin ${L.rapportLienTexteVoisin} | repos ${L.repos && L.repos.ratio}/${L.repos && L.repos.fond} survol ${L.survol.ratio} ${L.survol.decoration} | focus ${L.focus.actif && L.focus.focusVisible} ${L.focus.contour} ${L.focus.pixelsChanges} | ${L.rects.join("+")}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
