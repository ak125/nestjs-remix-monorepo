// Complément n° 2 DZ — injection d'une feuille d'option dans une page déjà chargée (Playwright addStyleTag).
// La balise porte data-dz-option ; un MutationObserver la remet si l'hydratation ou une navigation interne la retire.
// presence() relève : balise présente, nombre de règles lues par le navigateur (une règle invalide serait ignorée).
const fs = require("node:fs"); const path = require("node:path");
const FEUILLES = { a: path.join(__dirname, "..", "option-a.css"), b: path.join(__dirname, "..", "option-b.css"), c: path.join(__dirname, "..", "option-c.css"), a2: path.join(__dirname, "..", "option-a2.css"), a3: path.join(__dirname, "..", "option-a3.css") };
const css = (v) => (FEUILLES[v] ? fs.readFileSync(FEUILLES[v], "utf8") : null);
async function presence(page) {
  return page.evaluate(() => { const s = document.querySelector("style[data-dz-option]"); return { presente: !!s, variante: s ? s.getAttribute("data-dz-option") : null, regles: s && s.sheet ? s.sheet.cssRules.length : 0 }; }).catch((e) => ({ erreur: String(e.message).split("\n")[0] }));
}
async function injecte(page, v) {
  const c = css(v); if (!c) return { variante: "avant", injectee: false };
  const avant = await presence(page);
  if (!avant.presente) {
    const h = await page.addStyleTag({ content: c });
    await h.evaluate((s, v) => {
      s.setAttribute("data-dz-option", v);
      if (!window.__dzObs) { window.__dzObs = new MutationObserver(() => { if (!document.querySelector("style[data-dz-option]")) { document.head.appendChild(s); window.__dzReinjections = (window.__dzReinjections || 0) + 1; } }); window.__dzObs.observe(document.documentElement, { childList: true, subtree: true }); }
    }, v);
  }
  await page.waitForTimeout(250);
  const apres = await presence(page);
  const reinj = await page.evaluate(() => window.__dzReinjections || 0).catch(() => null);
  return { variante: v, at: new Date().toISOString(), dejaPresente: !!avant.presente, ...apres, reinjectionsObservateur: reinj };
}
module.exports = { injecte, presence, css };
