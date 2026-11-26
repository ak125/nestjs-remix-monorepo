// Complément n° 2 DZ — rôle des éléments colorés (texte, balise, fond peint) pour classer chaque famille
// (succès, erreur, avertissement, décoratif, surface). Lecture seule, sans feuille injectée.
// Usage (depuis options/) : NODE_PATH=/opt/automecanik/app/node_modules node scripts/roles-options-dz.cjs <id> <chemin> <W> <H> .
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("../../scripts/lib-dz.cjs");
const [, , id, route, Ws, Hs, outDir] = process.argv; const W = +Ws, H = +Hs;
const FAM = "(orange|amber|yellow|cta|semantic-action|green|emerald|lime|teal|cyan|sky|red|rose|pink|fuchsia|violet|purple|indigo|blue)";
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4500); await scrollThrough(p);
  const r = await p.evaluate((fam) => {
    const RE = new RegExp("(^|:)(text|bg|border|from|via|to)-" + fam + "(-[0-9]+|-hover|-light|-dark)?(\\/[0-9.\\[\\]]+)?$");
    const out = [];
    for (const e of document.querySelectorAll("body *")) {
      const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
      const cl = (typeof e.className === "string" ? e.className : e.getAttribute("class") || "").split(/\s+/).filter((c) => RE.test(c) && !/^(hover|group-hover|focus|group-data|data-|disabled|md|lg|sm)/.test(c));
      if (!cl.length) continue;
      out.push({ classes: cl.join(" "), tag: e.tagName.toLowerCase(), role: e.getAttribute("role"), texte: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50), zone: e.closest("header") ? "en-tete" : e.closest("footer") ? "pied" : e.closest('nav[aria-label="Navigation mobile"]') ? "barre-mobile" : "contenu" });
    }
    const forms = [...document.querySelectorAll("form")].map((f) => ({ action: f.getAttribute("action"), method: f.getAttribute("method"), zone: f.closest("header") ? "en-tete" : f.closest("footer") ? "pied" : "contenu", submit: [...f.querySelectorAll('button[type=submit],button:not([type]),input[type=submit]')].map((b) => (b.innerText || b.value || b.getAttribute("aria-label") || "").trim().slice(0, 40)) }));
    return { elements: out, forms };
  }, FAM);
  const agg = {}; for (const e of r.elements) { const k = e.classes + " | " + e.zone; (agg[k] = agg[k] || { n: 0, ex: [] }).n++; if (agg[k].ex.length < 3 && e.texte) agg[k].ex.push(e.tag + ":" + e.texte); }
  fs.writeFileSync(path.join(outDir, "mesures", `roles-${id}-${W}.json`), JSON.stringify({ id, route, viewport: `${W}x${H}`, at: new Date().toISOString(), groupes: agg, formulaires: r.forms, requetesAbandonnees: aborted }));
  await browser.close(); console.log(id, W, Object.keys(agg).length, "groupes", r.forms.length, "formulaires");
})().catch((e) => { console.error(e); process.exit(1); });
