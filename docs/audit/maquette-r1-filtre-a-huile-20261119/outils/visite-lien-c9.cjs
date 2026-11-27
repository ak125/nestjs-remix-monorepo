// Complément n° 9 au mandat DS : un lien d'un conteneur éditorial de #bien-choisir, #qualite-prix ou
// #emplacement dans l'état « lien déjà visité ». Copie de visite-lien-c8.cjs (complément n° 8), seule
// différence : le lien est désigné par SEL (sélecteur CSS) et HREF (sa cible, attendue après le clic).
// Méthode inchangée : Chrome complet (CHROME=/usr/bin/google-chrome), profil persistant temporaire, mesure
// avant visite, clic réel sur le lien, retour sur la page R1, mesure après visite, au repos et au survol ;
// pixel du texte = pixel le plus éloigné du fond dominant de la première ligne du lien ; témoin = lien sans
// classe vers HREF, qui prouve que :visited est actif. Échelle 1, mouvement réduit, GET seulement.
// Usage : URL_PATH=/pieces/… SEL='#emplacement a[href="…"]' HREF=… CHROME=/usr/bin/google-chrome \
//         node visite-lien-c9.cjs <base> <largeur> <hauteur> <profil> <sortie.json>
const fs = require("node:fs");
const path = require("node:path");
const WT = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(WT, "node_modules/playwright"));
const { PNG } = require(path.join(WT, "node_modules/pngjs"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const HREF = process.env.HREF || "/blog-pieces-auto/conseils/filtre-a-huile";
const SEL = process.env.SEL || `#reference a[href="${HREF}"]`;
const [, , base, W, H, prof, out] = process.argv;
const lum = (r, g, b) => { const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const hx = (d, i) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");

async function lire(p, tag) {
  const a = p.locator(SEL).first();
  const info = await a.evaluate((el) => {
    const t = el.getClientRects()[0];
    return { box: { x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.width), h: Math.round(t.height) }, classes: String(el.className), noVisited: el.classList.contains("no-visited") };
  });
  const r = info.box;
  const buf = await p.screenshot({ clip: { x: r.x, y: r.y - 1, width: r.w, height: r.h + 4 } });
  fs.writeFileSync(out.replace(/\.json$/, `-${tag}.png`), buf);
  const img = PNG.sync.read(buf); const counts = new Map();
  for (let i = 0; i < img.data.length; i += 4) { const k = hx(img.data, i); counts.set(k, (counts.get(k) || 0) + 1); }
  const fond = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const fv = [1, 3, 5].map((i) => parseInt(fond.slice(i, i + 2), 16));
  let ext = null, extD = -1;
  for (let i = 0; i < img.data.length; i += 4) { const d = Math.abs(img.data[i] - fv[0]) + Math.abs(img.data[i + 1] - fv[1]) + Math.abs(img.data[i + 2] - fv[2]); if (d > extD) { extD = d; ext = [img.data[i], img.data[i + 1], img.data[i + 2]]; } }
  return { fondDominant: fond, pixelDuTexte: "#" + ext.map((v) => v.toString(16).padStart(2, "0")).join(""), ratioTexteFond: ratio(lum(...ext), lum(...fv)), noVisited: info.noVisited };
}

async function temoin(p) {
  const tb = await p.evaluate((HREF_T) => { const t = document.createElement("a"); t.href = HREF_T; t.textContent = "TEMOIN"; t.id = "c7-temoin"; t.style.cssText = "position:fixed;top:0;left:0;z-index:99999;font:700 40px sans-serif;background:#fff;padding:4px"; document.body.appendChild(t); const q = t.getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; }, HREF);
  await p.waitForTimeout(300); const ti = PNG.sync.read(await p.screenshot({ clip: tb })); let tc = null, tcD = -1;
  for (let i = 0; i < ti.data.length; i += 4) { const d = 765 - (ti.data[i] + ti.data[i + 1] + ti.data[i + 2]); if (d > tcD) { tcD = d; tc = hx(ti.data, i); } }
  await p.evaluate(() => document.getElementById("c7-temoin").remove());
  return tc;
}

async function mesure(p, etat) {
  await p.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500); await p.mouse.move(1, 1);
  const a = p.locator(SEL).first();
  await a.scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  const repos = await lire(p, `${etat}-repos`);
  await a.hover(); await p.waitForTimeout(600);
  const survol = await lire(p, `${etat}-survol`);
  await p.mouse.move(1, 1); await p.waitForTimeout(300);
  return { repos, survol, temoinCouleur: await temoin(p) };
}

(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  const res = { url: base + URL_PATH, selecteur: SEL, href: HREF, largeur: +W, hauteur: +H, navigateur: ctx.browser() ? ctx.browser().version() : "chrome (profil persistant)", at: new Date().toISOString(), seuil: 4.5 };
  res.avantVisite = await mesure(p, "avant-visite");
  await p.goto(base + URL_PATH, { waitUntil: "load" }); await p.waitForTimeout(2000);
  const a0 = p.locator(SEL).first(); await a0.scrollIntoViewIfNeeded();
  await Promise.all([p.waitForURL((u) => u.pathname === HREF, { timeout: 60000 }), a0.click()]); await p.waitForTimeout(2000);
  res.visite = p.url();
  res.apresVisite = await mesure(p, "apres-visite");
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  for (const k of ["avantVisite", "apresVisite"]) {
    const m = res[k];
    console.log(`${W}px ${k.padEnd(11)} repos ${m.repos.ratioTexteFond} (${m.repos.pixelDuTexte} sur ${m.repos.fondDominant}) | survol ${m.survol.ratioTexteFond} (${m.survol.pixelDuTexte} sur ${m.survol.fondDominant}) | témoin ${m.temoinCouleur} | souligné : voir liens-c9.cjs`);
  }
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
