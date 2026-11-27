// Complément n° 8 au mandat DS : lien « Conseils : changer un filtre à huile étape par étape » (#reference, page R1).
// À 390×844 et 1440×900, échelle 2 pour 390 (comme les captures du dossier) et 1 pour 1440, mouvement réduit.
// Mesures, dans le Chromium de Playwright :
//  - styles calculés du lien et du texte voisin (couleur, text-decoration, décalage du soulignement) ;
//  - rapport couleur du lien / couleur du texte voisin (1.4.1 : < 3:1 ⇒ un autre signe que la couleur est requis) ;
//  - soulignement visible : pixels qui changent dans la boîte du lien quand on force text-decoration:none ;
//  - contraste au pixel du lien sur son fond, au repos et au survol (pire fond > 3 % de la boîte, comme le complément n° 4) ;
//  - focus clavier : Tab depuis l'élément focalisable précédent, :focus-visible, contour calculé, pixels changés ;
//  - boîte du lien (cible) ; liens du bloc #reference touchés par la règle.
// L'état « visité » se mesure avec visite-lien-c8.cjs (Chrome complet, profil persistant).
// Usage : node lien-c8.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const HREF = process.env.HREF || "/blog-pieces-auto/conseils/filtre-a-huile";
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
const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number); // n'accepte que des chaînes « r, g, b » déjà converties
const TO_RGB = `window.__c8rgb = (c) => { const cv = document.createElement("canvas"); cv.width = cv.height = 1; const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,1,1); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return d[0] + ", " + d[1] + ", " + d[2]; };`;
const hx = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function worstBg(data, color) {
  const m = new Map(); for (let i = 0; i < data.length; i += 4) { const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
  const tot = data.length / 4; let best = null;
  for (const [k, n] of m) { if (n <= tot * 0.03) continue; const bg = [k >> 16, (k >> 8) & 255, k & 255]; const r = ratioOf(color, bg); if (r <= 1.05) continue; if (!best || r < best.ratio) best = { ratio: r, fond: hx(bg) }; }
  return best;
}
function diff(a, b) { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n; }

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, href: HREF, label, at: new Date().toISOString(), vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true, s: 2 }, { n: "1440", w: 1440, h: 900, m: false, s: 1 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.s, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
    await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.addScriptTag({ content: TO_RGB });
    const sel = `#reference a[href="${HREF}"]`;
    const a = page.locator(sel).first();
    await a.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(500);
    const info = await a.evaluate((el) => {
      const cs = getComputedStyle(el); const p = el.parentElement; const ps = getComputedStyle(p);
      const r = el.getBoundingClientRect(); const rects = [...el.getClientRects()].map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height }));
      const refLinks = [...document.querySelectorAll("#reference .gamme-editorial a")].map((x) => ({ texte: x.textContent.trim().slice(0, 50), classe: x.className || "", souligne: getComputedStyle(x).textDecorationLine }));
      return { couleur: window.__c8rgb(cs.color), couleurCalculee: cs.color, texteVoisin: window.__c8rgb(ps.color), decoration: cs.textDecorationLine, decalage: cs.textUnderlineOffset, epaisseur: cs.textDecorationThickness, police: cs.fontSize, boite: { x: r.x, y: r.y, w: r.width, h: r.height }, lignes: rects.length, rects, liensReference: refLinks };
    });
    const v = (report.vues[vp.n] = { ...info });
    v.rapportLienTexteVoisin = ratioOf(rgb(info.couleur), rgb(info.texteVoisin));
    const b = info.boite; const clip = { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4 };
    // capture du paragraphe
    await a.evaluate((el) => el.parentElement.setAttribute("data-c8", "p"));
    await page.locator('[data-c8="p"]').screenshot({ path: path.join(outDir, `${label}-paragraphe-${vp.n}.png`) });
    // soulignement : diff avec text-decoration forcé à none
    const on = await px(page, clip);
    await page.addStyleTag({ content: `${sel}{text-decoration:none!important}` }); await page.waitForTimeout(100);
    const off = await px(page, clip);
    await page.evaluate(() => document.querySelectorAll("style").forEach((s) => { if (s.textContent.includes("text-decoration:none!important")) s.remove(); }));
    v.pixelsDuSoulignement = diff(on, off);
    // contraste au repos
    v.repos = worstBg(on, rgb(info.couleur));
    // survol (390 : pas de survol au toucher, mesuré quand même à titre indicatif ; 1440 fait foi)
    await a.hover(); await page.waitForTimeout(400);
    const hc = await a.evaluate((el) => ({ couleur: window.__c8rgb(getComputedStyle(el).color), decoration: getComputedStyle(el).textDecorationLine }));
    const hov = await px(page, clip);
    v.survol = { ...hc, ...worstBg(hov, rgb(hc.couleur)) };
    await page.mouse.move(1, 1); await page.waitForTimeout(300);
    // focus clavier
    const before = await px(page, { x: b.x - 8, y: b.y - 8, width: b.w + 16, height: b.h + 16 });
    await a.evaluate((el) => { const f = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.offsetParent !== null || e === el); const i = f.indexOf(el); f[i - 1].focus(); });
    await page.keyboard.press("Tab"); await page.waitForTimeout(300);
    const foc = await a.evaluate((el) => ({ actif: document.activeElement === el, focusVisible: el.matches(":focus-visible"), contour: `${getComputedStyle(el).outlineWidth} ${getComputedStyle(el).outlineStyle} rgb(${window.__c8rgb(getComputedStyle(el).outlineColor)})`, decalage: getComputedStyle(el).outlineOffset, anneau: getComputedStyle(el).boxShadow }));
    const after = await px(page, { x: b.x - 8, y: b.y - 8, width: b.w + 16, height: b.h + 16 });
    await page.locator('[data-c8="p"]').screenshot({ path: path.join(outDir, `${label}-focus-${vp.n}.png`) });
    v.focus = { ...foc, pixelsChanges: diff(before, after), rapportContourFond: foc.contour.includes("rgb") ? ratioOf(rgb(foc.contour.slice(foc.contour.indexOf("rgb"))), [248, 250, 252]) : null };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-lien.json`), JSON.stringify(report, null, 2));
  for (const [n, v] of Object.entries(report.vues)) {
    console.log(`== ${label} ${n} px | ${v.couleur} voisin ${v.texteVoisin} (rapport ${v.rapportLienTexteVoisin}) | decoration ${v.decoration} décalage ${v.decalage} | pixels soulignement ${v.pixelsDuSoulignement}`);
    console.log(`   repos ${v.repos && v.repos.ratio} sur ${v.repos && v.repos.fond} | survol ${v.survol.couleur} ${v.survol.decoration} ${v.survol.ratio} | lignes ${v.rects.map((q) => `${Math.round(q.w)}×${Math.round(q.h)}`).join(" + ")}, police ${v.police}`);
    console.log(`   focus actif=${v.focus.actif} visible=${v.focus.focusVisible} contour ${v.focus.contour} (fond ${v.focus.rapportContourFond}) pixels ${v.focus.pixelsChanges}`);
    console.log(`   liens #reference : ${v.liensReference.map((l) => `${l.texte.slice(0, 22)}[${l.classe || "-"}|${l.souligne}]`).join(" ; ")}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
