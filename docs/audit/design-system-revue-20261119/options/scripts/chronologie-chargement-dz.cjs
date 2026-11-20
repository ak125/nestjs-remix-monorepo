// Complément n° 6 DZ — chronologie du chargement : toutes les 25 ms jusqu'à 3 s, position et taille des éléments qui
// bougent dans les décalages de chargement relevés par cls-causes-dz.cjs (image du haut de la gamme, premières cartes
// produit), nombre de feuilles de style, état du document, polices, hydratation ; puis taille naturelle des images.
// Lecture seule : aucune saisie, aucun défilement. Usage : node scripts/chronologie-chargement-dz.cjs <chemin> <L> <H> <sortie.json>
const fs = require("node:fs");
const OPT = require("node:path").join(__dirname, "..");
const { chromium, BASE, newContext, settle } = require(OPT + "/../scripts/lib-dz.cjs");
const [route, Ws, Hs, sortie] = process.argv.slice(2);
const W = +Ws, H = +Hs;
const SONDE = String.raw`
(() => {
  const C = window.__chrono = { points: [], shifts: [] };
  const t0 = () => Math.round(performance.now());
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top + scrollY), Math.round(b.height)]; };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) C.shifts.push([Math.round(e.startTime), Math.round(e.value * 100000) / 100000, e.hadRecentInput]); }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  const releve = () => {
    const img = document.querySelector("picture.block.w-full.h-full > img");
    const cartes = document.querySelectorAll(".pieces-product-card");
    const liens = [...document.querySelectorAll('link[rel="stylesheet"]')].length, styles = document.querySelectorAll("style").length;
    C.points.push({ t: t0(), etat: document.readyState, feuilles: document.styleSheets.length, liens, styles, hauteur: document.documentElement.scrollHeight,
      polices: document.fonts ? document.fonts.status : null, hydrate: !!window.__reactRouterRouteModules,
      image: r(img), imageCharge: img ? img.complete && img.naturalWidth > 0 : null, carte1: r(cartes[0]), carte3: r(cartes[2]), nCartes: cartes.length,
      main: r(document.querySelector("main")) });
  };
  const id = setInterval(() => { if (document.documentElement) releve(); if (performance.now() > 3000) clearInterval(id); }, 25);
})();
`;
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted });
  await ctx.addInitScript({ content: SONDE });
  const page = await ctx.newPage();
  const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
  await settle(page, 4500);
  const fin = await page.evaluate(() => ({
    images: [...document.querySelectorAll("picture.block.w-full.h-full > img, .pieces-product-card img")].slice(0, 4).map((i) => ({
      src: (i.currentSrc || i.src).replace(location.origin, "").slice(0, 140), attrL: i.getAttribute("width"), attrH: i.getAttribute("height"),
      naturel: [i.naturalWidth, i.naturalHeight], rendu: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)] })),
    hauteur: document.documentElement.scrollHeight }));
  const C = await page.evaluate(() => window.__chrono);
  // Ne garder que les instants où quelque chose change (le reste est identique au point précédent).
  const cle = (p) => JSON.stringify({ ...p, t: 0 });
  const points = C.points.filter((p, i, a) => i === 0 || cle(p) !== cle(a[i - 1]));
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  fs.writeFileSync(sortie, JSON.stringify({ route, viewport: `${W}x${H}`, statut: resp && resp.status(), date: new Date().toISOString(), nav, shifts: C.shifts, points, fin, nonGet: aborted.filter((a) => a.method && a.method !== "GET").length }, null, 1));
  console.log(JSON.stringify({ route, W, nav, shifts: C.shifts, nPoints: points.length, fin }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
