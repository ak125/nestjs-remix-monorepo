// Complément n° 11 au mandat DS : le bouton flottant de discussion (ChatWidget, élément commun au site,
// position fixed) recouvre-t-il la ligne « Fabrication » d'une carte véhicule pendant le défilement, à 390×844 ?
// Relevé seulement, rien n'est corrigé.
// Cibles : BULLE=chat (défaut) : button[aria-label="Ouvrir le chat"] de components/rag/ChatWidget.tsx (fixed bottom-24
// right-4, 56 px) ; BULLE=remonter : bouton « remonter en haut » de root.tsx (fixed bottom-40 right-4, 48 px), juste au-dessus.
// Méthode : toutes les cartes dépliées ; rect du bouton (viewport, fixe) ; pour chaque ligne de faits, rects de
// ses lignes de texte (Range). Le bouton étant fixe, une ligne de texte passe sous lui pendant le défilement si
// et seulement si leurs étendues horizontales se croisent (le défilement vertical amène la ligne à sa hauteur).
// Preuve directe : pour chaque carte concernée, défilement qui centre la ligne sur le bouton, puis
// elementFromPoint au milieu de la zone commune (bouton au-dessus = recouvrement réel) ; capture de la
// première carte recouverte et de la première carte non recouverte.
// Usage : URL_PATH=/pieces/… node bulle-c11.cjs <base> <label> <dossier>. GET seulement ; analytique bloquée.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const [, , base, label, outDir] = process.argv;
const FAITS = /^(Début de |Fin de )?[Ff]abrication\s:\s/;
const BULLE = process.env.BULLE || "chat";
const SEL = BULLE === "chat" ? 'button[aria-label="Ouvrir le chat"]' : "button.fixed.bottom-40";

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => (!["GET", "HEAD"].includes(r.request().method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort("blockedbyclient") : r.continue()));
  const page = await ctx.newPage();
  await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
  const plus = page.locator("button", { hasText: /Voir les \d+ autres compatibilités/ });
  if (await plus.count()) { await plus.first().click(); await page.waitForTimeout(800); }
  await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important}" });
  await page.waitForSelector(SEL, { state: "attached", timeout: 15000 }).catch(() => null);
  const info = await page.evaluate(([src, sel]) => {
    const FAITS = new RegExp(src);
    const el = document.querySelector(sel);
    const bulle = el && getComputedStyle(el).position === "fixed" ? { e: el, r: el.getBoundingClientRect() } : null;
    if (!bulle) return { bulle: null, cartes: [] };
    bulle.e.setAttribute("data-c11-bulle", "1");
    const b = bulle.r;
    const links = [...document.querySelectorAll('a[href*="/pieces/"][href$=".html"]')].filter((a) => a.querySelector("h3") && /Voir les pièces/.test(a.textContent));
    const cartes = links.map((a, i) => {
      a.setAttribute("data-c11-carte", String(i));
      const p = [...a.querySelectorAll("p")].find((x) => FAITS.test(x.innerText.trim()));
      if (!p) return { i, titre: a.querySelector("h3").innerText.trim(), ligne: null };
      p.setAttribute("data-c11-ligne", String(i));
      const rg = document.createRange(); rg.selectNodeContents(p);
      const lignes = [...rg.getClientRects()].filter((q) => q.width > 0).map((q) => ({ x0: Math.round(q.left), x1: Math.round(q.right), y: Math.round(q.top + window.scrollY) }));
      const xs = Math.min(...lignes.map((q) => q.x0)), xe = Math.max(...lignes.map((q) => q.x1));
      const chevauchement = Math.max(0, Math.min(xe, b.right) - Math.max(xs, b.left));
      return { i, titre: a.querySelector("h3").innerText.trim(), ligne: p.innerText.trim(), x: [xs, xe], chevauchementHorizontalPx: Math.round(chevauchement) };
    });
    return { bulle: { selecteur: bulle.e.tagName.toLowerCase() + "." + [...bulle.e.classList].slice(0, 4).join("."), aria: bulle.e.getAttribute("aria-label"), opacite: getComputedStyle(bulle.e).opacity, x: [Math.round(b.left), Math.round(b.right)], y: [Math.round(b.top), Math.round(b.bottom)] }, cartes };
  }, [FAITS.source, SEL]);
  const res = { url: base + URL_PATH, label, cible: BULLE, selecteurCible: SEL, at: new Date().toISOString(), vue: "390×844", ...info, preuves: [] };
  if (info.bulle) {
    const b = info.bulle; const cy = (b.y[0] + b.y[1]) / 2;
    let capRecouvert = false, capLibre = false;
    for (const c of info.cartes.filter((c) => c.ligne)) {
      const loc = page.locator(`[data-c11-ligne="${c.i}"]`);
      // amène la ligne au centre vertical du bouton
      await loc.evaluate((p, cy) => { const r = p.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - cy, behavior: "instant" }); }, cy);
      await page.waitForTimeout(120);
      const hit = await loc.evaluate((p, b) => {
        const r = p.getBoundingClientRect();
        const x0 = Math.max(r.left, b.x[0]), x1 = Math.min(r.right, b.x[1]);
        const rg = document.createRange(); rg.selectNodeContents(p);
        const txt = [...rg.getClientRects()].filter((q) => q.width > 0);
                // point au milieu de la partie du texte placée sous le bouton, s'il y en a une
        const q = txt.find((q) => Math.min(q.right, b.x[1]) > Math.max(q.left, b.x[0]) && Math.min(q.bottom, b.y[1]) > Math.max(q.top, b.y[0])) || null;
        if (!q || x1 <= x0) return { texteSousBouton: false };
        const px = (Math.max(q.left, b.x[0]) + Math.min(q.right, b.x[1])) / 2, py = (q.top + q.bottom) / 2;
        const top = document.elementFromPoint(px, py);
        return { texteSousBouton: true, point: [Math.round(px), Math.round(py)], dessus: top && (top.closest("[data-c11-bulle]") ? "bouton flottant" : top.closest(`[data-c11-ligne]`) ? "ligne Fabrication" : top.tagName.toLowerCase()) };
      }, b);
      c.preuve = hit;
      const recouvert = hit.texteSousBouton && hit.dessus === "bouton flottant";
      c.recouverte = recouvert;
      if (recouvert && !capRecouvert) { await page.screenshot({ path: path.join(outDir, `${label}-${SLUG}-${BULLE}-recouvre-390.png`) }); capRecouvert = true; c.capture = `${label}-${SLUG}-${BULLE}-recouvre-390.png`; }
      if (!recouvert && !capLibre) { await page.screenshot({ path: path.join(outDir, `${label}-${SLUG}-${BULLE}-libre-390.png`) }); capLibre = true; c.capture = `${label}-${SLUG}-${BULLE}-libre-390.png`; }
    }
  }
  const avec = res.cartes.filter((c) => c.ligne);
  res.synthese = { cartes: res.cartes.length, avecLigne: avec.length, chevauchementHorizontal: avec.filter((c) => c.chevauchementHorizontalPx > 0).length, recouvertesPendantDefilement: avec.filter((c) => c.recouverte).length };
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-${BULLE}.json`), JSON.stringify(res, null, 2));
  console.log(`== ${label} ${SLUG} 390 px | ${BULLE} | ${res.bulle ? `${res.bulle.selecteur} x ${res.bulle.x} y ${res.bulle.y}` : "absent"} | ${JSON.stringify(res.synthese)}`);
  for (const c of avec) console.log(`   ${c.titre} «${c.ligne}» x ${c.x} chevauchement ${c.chevauchementHorizontalPx}px ${c.recouverte ? "RECOUVERTE" : "libre"} ${c.capture || ""}`);
})().catch((e) => { console.error(e); process.exit(1); });
