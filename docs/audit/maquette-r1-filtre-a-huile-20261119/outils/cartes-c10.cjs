// Complément n° 10 au mandat DS : cartes véhicule (section des motorisations) d'une page R1.
// À 390×844 (échelle 2, mobile) et 1440×900 (échelle 1), mouvement réduit, Chromium de Playwright, GET seulement.
// Clique « Voir les N autres compatibilités » pour relever toutes les cartes. Pour chaque carte : lien, titre,
// badges, paragraphes (texte), taille de la carte (largeur × hauteur), et pour chaque paragraphe sa couleur
// calculée et son contraste au pixel contre le fond dominant de chacune de ses lignes (rects d'un Range sur le
// texte), la pire ligne retenue. Doublons : cartes dont la ligne mesurée ('faits' : paragraphe qui commence
// par « Fabrication : » ; 'phrase' : dernier autre paragraphe avant le bouton, hors période « 📅 »)
// est identique à celle d'une autre carte de la même page.
// Captures à 390 : section entière et trois premières cartes.
// Usage : URL_PATH=/pieces/… node cartes-c10.cjs <base> <label> <dossier>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
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
const hx = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const TO_RGB = `window.__c10rgb = (c) => { const cv = document.createElement("canvas"); cv.width = cv.height = 1; const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,1,1); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return d[0] + ", " + d[1] + ", " + d[2]; };`;
async function parLigne(page, rects, color) {
  let best = null;
  for (const q of rects) {
    if (q.w < 1 || q.h < 1) continue;
    const d = await px(page, { x: Math.max(0, q.x), y: q.y, width: q.w, height: q.h });
    const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
    const k = [...m.entries()].sort((x, y) => y[1] - x[1])[0][0]; const bg = [k >> 16, (k >> 8) & 255, k & 255];
    const r = ratioOf(color, bg); if (!best || r < best.ratio) best = { ratio: r, fond: hx(bg) };
  }
  return best;
}
const FAITS = /^Fabrication\s:\s/;

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
    for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
    await page.addScriptTag({ content: TO_RGB });
    const sel = 'a[href*="/pieces/"][href$=".html"]';
    const isCard = (a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent);
    const avantClic = await page.evaluate(([sel]) => [...document.querySelectorAll(sel)].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent)).length, [sel]);
    const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
    if (await plus.count()) { await plus.first().click(); await page.waitForTimeout(800); }
    await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important} *,*::before,*::after{animation-play-state:paused!important;transition:none!important} header.fixed, header.sticky, nav[aria-label='Navigation mobile'], [class*='z-[9999]']{visibility:hidden!important}" });
    const n = await page.evaluate(([sel]) => {
      const links = [...document.querySelectorAll(sel)].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent));
      const section = links[0] && links[0].closest("section"); if (section) section.setAttribute("data-c10", "section");
      links.forEach((a, i) => { a.setAttribute("data-c10-carte", String(i)); a.querySelectorAll("p").forEach((p, j) => p.setAttribute("data-c10-p", `${i}-${j}`)); });
      return links.length;
    }, [sel]);
    const cartes = [];
    for (let i = 0; i < n; i++) {
      const a = page.locator(`[data-c10-carte="${i}"]`);
      await a.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await page.waitForTimeout(150);
      const info = await a.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const ps = [...el.querySelectorAll("p")].map((p) => {
          const rg = document.createRange(); rg.selectNodeContents(p);
          return { id: p.getAttribute("data-c10-p"), texte: p.innerText.trim(), classe: p.className, couleur: window.__c10rgb(getComputedStyle(p).color), taille: getComputedStyle(p).fontSize, graisse: getComputedStyle(p).fontWeight,
            lignes: [...rg.getClientRects()].map((q) => ({ x: q.x, y: q.y, w: q.width, h: q.height })) };
        });
        return { href: el.getAttribute("href"), titre: el.querySelector("h3").innerText.trim(), badges: [...el.querySelectorAll("div.rounded-full")].map((d) => d.innerText.trim()), taille: `${Math.round(r.width)}×${Math.round(r.height)}`, largeur: Math.round(r.width), hauteur: Math.round(r.height), paragraphes: ps };
      });
      for (const p of info.paragraphes) { p.contraste = await parLigne(page, p.lignes, rgb(p.couleur)); p.nLignes = new Set(p.lignes.map((q) => Math.round(q.y))).size; delete p.lignes; }
      cartes.push(info);
    }
    // ligne mesurée par carte
    for (const c of cartes) {
      const f = c.paragraphes.find((p) => FAITS.test(p.texte));
      const ph = c.paragraphes.filter((p) => !/^📅/.test(p.texte) && !FAITS.test(p.texte)).pop();
      c.ligneFaits = f ? f.texte : null; c.phrase = ph ? ph.texte : null;
    }
    const dup = (key) => { const m = new Map(); for (const c of cartes) { const k = c[key]; if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); } const doublons = cartes.filter((c) => c[key] != null && m.get(c[key]) > 1).length; return { distinctes: m.size, cartesAvecLigne: cartes.filter((c) => c[key] != null).length, cartesAvecLigneIdentiqueAUneAutre: doublons, groupes: [...m.entries()].filter(([, v]) => v > 1).map(([k, v]) => ({ ligne: k, cartes: v })) }; };
    const h = cartes.map((c) => c.hauteur);
    report.vues[vp.n] = { cartesAvantClic: avantClic, cartes: cartes.length, hauteur: { min: Math.min(...h), max: Math.max(...h), moyenne: Math.round(h.reduce((s, v) => s + v, 0) / h.length) }, largeurs: [...new Set(cartes.map((c) => c.largeur))], doublonsFaits: dup("ligneFaits"), doublonsPhrase: dup("phrase"), liste: cartes };
    if (vp.n === "390") {
      const sec = page.locator('[data-c10="section"]');
      await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await sec.screenshot({ path: path.join(outDir, `${label}-${SLUG}-cartes-390.png`) });
      const box = await page.evaluate(() => { const c = [0, 1, 2].map((i) => document.querySelector(`[data-c10-carte="${i}"]`)).filter(Boolean).map((e) => e.getBoundingClientRect()); return { top: Math.min(...c.map((r) => r.top)) + window.scrollY, bottom: Math.max(...c.map((r) => r.bottom)) + window.scrollY }; });
      await page.evaluate((y) => window.scrollTo(0, y - 10), box.top); await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${label}-${SLUG}-cartes-1a3-390.png`), fullPage: true, clip: { x: 0, y: box.top - 8, width: 390, height: box.bottom - box.top + 16 } });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-cartes.json`), JSON.stringify(report, null, 2));
  for (const [n, v] of Object.entries(report.vues)) {
    console.log(`== ${label} ${SLUG} ${n} px : ${v.cartes} cartes (avant clic ${v.cartesAvantClic}), hauteur ${JSON.stringify(v.hauteur)}, largeurs ${v.largeurs}`);
    console.log(`   doublons faits ${JSON.stringify({ d: v.doublonsFaits.distinctes, n: v.doublonsFaits.cartesAvecLigne, dup: v.doublonsFaits.cartesAvecLigneIdentiqueAUneAutre })} phrase ${JSON.stringify({ d: v.doublonsPhrase.distinctes, n: v.doublonsPhrase.cartesAvecLigne, dup: v.doublonsPhrase.cartesAvecLigneIdentiqueAUneAutre })}`);
    for (const c of v.liste.slice(0, 3)) console.log(`   ${c.titre} [${c.badges.join(" / ")}] ${c.taille} :: ${c.paragraphes.map((p) => `«${p.texte.slice(0, 70)}» ${p.couleur} ${p.taille} ${p.contraste && p.contraste.ratio}/${p.contraste && p.contraste.fond} ${p.nLignes}l`).join(" | ")}`);
    const worst = v.liste.flatMap((c) => c.paragraphes).filter((p) => p.contraste).sort((a, b) => a.contraste.ratio - b.contraste.ratio)[0];
    console.log(`   pire contraste paragraphe : ${worst && `${worst.contraste.ratio} «${worst.texte.slice(0, 40)}» sur ${worst.contraste.fond}`}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
