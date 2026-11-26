// Complément n° 5 DZ, point 2 : le bouton « Rechercher des pièces » existe-t-il dans le DOM en 1440 (accueil, gamme) ?
// Lecture seule : aucun clic, aucune saisie, requêtes non GET abandonnées (lib-dz). Usage : node … <dossier-options> <chemin> <L> <H> <avant|a2|a3>
const OPT = process.argv[2]; const { chromium, BASE, newContext, settle } = require(OPT + "/../scripts/lib-dz.cjs");
const { injecte } = require(OPT + "/scripts/injection-dz.cjs");
const [route, Ws, Hs, v] = process.argv.slice(3);
(async () => { const b = await chromium.launch(); const aborted = []; const ctx = await newContext(b, { width: +Ws, height: +Hs, aborted }); const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4500);
  if (v !== "avant") await injecte(p, v);
  const r = await p.evaluate(() => {
    const desc = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 6).join(".") : "");
    const boutons = [...document.querySelectorAll("button")].filter((e) => /Rechercher des pi/.test(e.textContent)).map((e) => {
      let masque = null; for (let a = e; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).display === "none") { masque = desc(a); break; }
      const q = e.getBoundingClientRect(); return { rect: [q.left, q.top, q.width, q.height].map(Math.round), disabled: e.disabled, ancetreDisplayNone: masque, fond: getComputedStyle(e).backgroundColor };
    });
    const selecteursVisibles = [...document.querySelectorAll("select, button[aria-label='Réinitialiser la sélection de véhicule']")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.getAttribute("aria-label") || e.getAttribute("name") || desc(e)).slice(0, 60));
    return { boutons, selecteursVisibles };
  });
  console.log(JSON.stringify({ route, viewport: [+Ws, +Hs], variante: v, ...r, requetesAbandonnees: aborted.length })); await b.close(); })();
