// Complément n° 6 au mandat DS : bouton « Lancer le diagnostic » de la page R1 (GammeDiagnosticCTA).
// Contraste mesuré au pixel, à 390×844 et 1440×900, échelle 1 (comme DU, §14 de sa revue), mouvement non réduit.
// Méthode :
//  - texte et icône rendus transparents (transition coupée), puis capture du fond dans la boîte du texte
//    (Range du nœud texte) et de l'icône, 1 px de marge ;
//  - rapport = couleur calculée du texte contre CHAQUE pixel de fond ; on retient le pire (le plus bas) ;
//  - reflet animate-shimmer figé à 24 positions de son cycle (Animation.currentTime) ;
//  - « bouts » = colonne de pixels à 12 px du bord gauche et du bord droit du bouton, reflet masqué ;
//  - survol : pointeur posé sur le bouton à 1440 px ;
//  - pastille de l'en-tête : icône blanche contre le fond sous sa boîte (seuil 3:1, 1.4.11) ;
//  - zone cliquable et imbrication (élément interactif dans un lien).
// Les rapports sont tronqués au centième. Usage : node diag-c6.cjs <baseUrl> <label> <outDir>
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const [, , base, label, outDir] = process.argv;
const trunc = (x) => (x == null ? null : Math.floor(x * 100) / 100);

// Marque la carte, le bouton visible, le texte, l'icône du bouton, la pastille et le reflet.
function mark() {
  const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Diagnostic gratuit");
  if (!h2) return null;
  const card = h2.closest("div.overflow-hidden");
  card.setAttribute("data-c6", "carte");
  const link = card.querySelector('a[href="/diagnostic-auto"]');
  const inner = link.querySelector("button, [role=button]");
  const btn = inner || link; // boîte visible du bouton
  btn.setAttribute("data-c6", "bouton");
  const btnIcon = btn.querySelector("svg"); btnIcon.setAttribute("data-c6", "icone-bouton");
  const shimmer = btn.querySelector(".animate-shimmer"); if (shimmer) shimmer.setAttribute("data-c6", "reflet");
  const pastIcon = h2.parentElement.querySelector("svg"); pastIcon.setAttribute("data-c6", "icone-pastille");
  const interactifsDansLien = link.querySelectorAll("a, button, input, select, textarea, [role=button], [tabindex]").length;
  const r = link.getBoundingClientRect(); const rb = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  return { lien: { w: r.width, h: r.height }, bouton: { tag: btn.tagName.toLowerCase(), w: rb.width, h: rb.height },
    interactifsDansLien, couleurTexte: cs.color, fond: cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor,
    couleurIconePastille: getComputedStyle(pastIcon).color, classes: String(btn.className) };
}

function boxes() {
  const btn = document.querySelector('[data-c6="bouton"]');
  const w = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT); let n, tr = null;
  while ((n = w.nextNode())) if (n.nodeValue.trim()) { const rg = document.createRange(); rg.selectNodeContents(n); tr = rg.getBoundingClientRect(); }
  const b = btn.getBoundingClientRect();
  const ic = document.querySelector('[data-c6="icone-bouton"]').getBoundingClientRect();
  const pi = document.querySelector('[data-c6="icone-pastille"]').getBoundingClientRect();
  const o = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
  return { texte: o(tr), icone: o(ic), pastille: o(pi), bouton: o(b) };
}

async function worst(page, clip, color) {
  const png = await page.screenshot({ clip: { x: Math.max(0, clip.x - 1), y: Math.max(0, clip.y - 1), width: clip.w + 2, height: clip.h + 2 } });
  return page.evaluate(async ({ b64, color }) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d");
    cx.fillStyle = color; cx.fillRect(0, 0, 1, 1); const f = cx.getImageData(0, 0, 1, 1).data;
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const q = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * q(r) + 0.7152 * q(g) + 0.0722 * q(b);
    const hx = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    const lt = lum(f[0], f[1], f[2]); let best = null;
    for (let i = 0; i < d.length; i += 4) {
      const l = lum(d[i], d[i + 1], d[i + 2]); const r = (Math.max(l, lt) + 0.05) / (Math.min(l, lt) + 0.05);
      if (!best || r < best.ratio) best = { ratio: r, fond: hx(d[i], d[i + 1], d[i + 2]) };
    }
    return { ...best, texte: hx(f[0], f[1], f[2]) };
  }, { b64: png.toString("base64"), color });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, label, at: new Date().toISOString(), methode: "pixel, pire pixel de fond sous la boîte (1 px de marge), échelle 1, reflet figé à 24 positions", vues: {} };
  for (const vp of [{ n: "390", w: 390, h: 844, m: true }, { n: "1440", w: 1440, h: 900, m: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "no-preference" });
    await ctx.route("**/*", (route) => {
      const r = route.request();
      if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(mark);
    if (!info) { report.vues[vp.n] = "carte introuvable"; await ctx.close(); continue; }
    const v = (report.vues[vp.n] = { ...info });
    const card = page.locator('[data-c6="carte"]');
    await card.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(600);
    // Capture visible (texte présent), reflet figé à mi-parcours si présent.
    await page.evaluate(() => { const s = document.querySelector('[data-c6="reflet"]'); if (s) for (const a of s.getAnimations()) { a.pause(); a.currentTime = 0.25 * a.effect.getTiming().duration; } });
    await card.screenshot({ path: path.join(outDir, `${label}-carte-${vp.n}.png`) });
    // Texte et icônes transparents, transitions coupées.
    const colors = await page.evaluate(() => {
      const btn = document.querySelector('[data-c6="bouton"]'); const pi = document.querySelector('[data-c6="icone-pastille"]');
      const out = { texte: getComputedStyle(btn).color, iconeBouton: getComputedStyle(document.querySelector('[data-c6="icone-bouton"]')).color, pastille: getComputedStyle(pi).color };
      const st = document.createElement("style"); st.id = "c6-transparent";
      st.textContent = '[data-c6="bouton"],[data-c6="bouton"] *{color:transparent!important;transition:none!important}[data-c6="icone-pastille"]{color:transparent!important;animation:none!important}';
      document.head.appendChild(st); return out;
    });
    const bx = await page.evaluate(boxes);
    const hasShimmer = await page.evaluate(() => !!document.querySelector('[data-c6="reflet"]'));
    const setShimmer = (t) => page.evaluate((t) => { const s = document.querySelector('[data-c6="reflet"]'); if (!s) return; if (t === null) { s.style.visibility = "hidden"; return; } s.style.visibility = ""; for (const a of s.getAnimations()) { a.pause(); a.currentTime = t * a.effect.getTiming().duration; } }, t);
    // sans reflet
    await setShimmer(null); await page.waitForTimeout(100);
    v.sansReflet = { texte: await worst(page, bx.texte, colors.texte), icone: await worst(page, bx.icone, colors.iconeBouton) };
    const col = (x) => ({ x, y: bx.bouton.y + 8, w: 1, h: bx.bouton.h - 16 });
    v.bouts = { gauche: await worst(page, col(bx.bouton.x + 12), colors.texte), droit: await worst(page, col(bx.bouton.x + bx.bouton.w - 13), colors.texte) };
    // reflet
    if (hasShimmer) {
      const pos = [];
      for (let i = 0; i < 24; i++) { const t = i / 24; await setShimmer(t); await page.waitForTimeout(30); pos.push({ t: Math.round(t * 1000) / 1000, texte: await worst(page, bx.texte, colors.texte), icone: await worst(page, bx.icone, colors.iconeBouton) }); }
      const wt = pos.reduce((a, b) => (b.texte.ratio < a.texte.ratio ? b : a)); const wi = pos.reduce((a, b) => (b.icone.ratio < a.icone.ratio ? b : a));
      v.reflet = { pireTexte: { t: wt.t, ...wt.texte }, pireIcone: { t: wi.t, ...wi.icone }, positions: pos };
    } else v.reflet = "absent";
    // pastille de l'en-tête
    v.pastille = await worst(page, bx.pastille, colors.pastille);
    // survol (1440 seulement : pas de survol au toucher)
    if (!vp.m) {
      await page.evaluate(() => document.getElementById("c6-transparent").remove());
      await page.locator('[data-c6="bouton"]').hover(); await page.waitForTimeout(500);
      const hcol = await page.evaluate(() => { const b = document.querySelector('[data-c6="bouton"]'); const cs = getComputedStyle(b); return { texte: cs.color, fond: cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor }; });
      await setShimmer(0.25);
      await page.locator('[data-c6="carte"]').screenshot({ path: path.join(outDir, `${label}-carte-1440-survol.png`) });
      await page.evaluate(() => { const st = document.createElement("style"); st.id = "c6-transparent"; st.textContent = '[data-c6="bouton"],[data-c6="bouton"] *{color:transparent!important;transition:none!important}'; document.head.appendChild(st); });
      const hb = await page.evaluate(boxes);
      await setShimmer(null);
      const hs = { couleurs: hcol, sansReflet: await worst(page, hb.texte, hcol.texte) };
      if (hasShimmer) { let w = null; for (let i = 0; i < 24; i++) { await setShimmer(i / 24); await page.waitForTimeout(30); const r = await worst(page, hb.texte, hcol.texte); if (!w || r.ratio < w.ratio) w = { t: Math.round((i / 24) * 1000) / 1000, ...r }; } hs.pireReflet = w; }
      v.survol = hs;
    }
    await ctx.close();
  }
  await browser.close();
  // troncature au centième
  const walk = (o) => { if (o && typeof o === "object") for (const k of Object.keys(o)) { if (k === "ratio") o[k] = trunc(o[k]); else walk(o[k]); } };
  walk(report);
  fs.writeFileSync(path.join(outDir, `${label}-mesures.json`), JSON.stringify(report, null, 2));
  for (const [n, v] of Object.entries(report.vues)) {
    if (typeof v === "string") { console.log(n, v); continue; }
    console.log(`== ${label} ${n} px | ${v.bouton.tag} ${Math.round(v.bouton.w)}×${Math.round(v.bouton.h)} | lien ${Math.round(v.lien.w)}×${Math.round(v.lien.h)} | interactifs dans le lien ${v.interactifsDansLien} | texte ${v.couleurTexte}`);
    console.log(`   sans reflet : texte ${v.sansReflet.texte.ratio} (${v.sansReflet.texte.fond}) icône ${v.sansReflet.icone.ratio} | bouts ${v.bouts.gauche.ratio} (${v.bouts.gauche.fond}) / ${v.bouts.droit.ratio} (${v.bouts.droit.fond})`);
    if (typeof v.reflet === "object") console.log(`   reflet, pire : texte ${v.reflet.pireTexte.ratio} à t=${v.reflet.pireTexte.t} (${v.reflet.pireTexte.fond}) | icône ${v.reflet.pireIcone.ratio} à t=${v.reflet.pireIcone.t}`); else console.log("   reflet : absent");
    console.log(`   pastille en-tête : ${v.pastille.ratio} (${v.pastille.texte} sur ${v.pastille.fond})`);
    if (v.survol) console.log(`   survol : ${v.survol.couleurs.texte} sur ${v.survol.couleurs.fond} | sans reflet ${v.survol.sansReflet.ratio}${v.survol.pireReflet ? ` | pire reflet ${v.survol.pireReflet.ratio} à t=${v.survol.pireReflet.t}` : ""}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
