// Mandat DZ — 6.5 : que devient le focus clavier quand il arrive sur la liste « Marque » avant le chargement des marques ?
// Place le focus sur l'élément focalisable qui précède la liste visible, presse Tab une fois, puis relève
// document.activeElement et l'état de la liste à 0, 30, 100, 300, 1000 et 2500 ms. Les GET de marques ne sont pas retardés.
// Usage : node sonde-focus-marque-dz.cjs <id> <chemin> <W> <H> <dossier>
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle } = require("./lib-dz.cjs");
const [, , id, route, W, H, outDir = "."] = process.argv;
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: +W, height: +H, aborted }); const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4000);
  const prev = await p.evaluate(() => {
    const s = [...document.querySelectorAll('select[aria-label="Marque"], select[aria-label*="marque" i]')].find((x) => x.getClientRects().length);
    const all = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter((e) => e.tabIndex >= 0 && !e.disabled && e.getClientRects().length);
    const i = all.indexOf(s); if (i < 1) return "introuvable : index " + i + " sur " + all.length + (s ? "" : " (liste absente)"); const pr = all[i - 1]; pr.setAttribute("data-dz-prev", "1"); return (pr.tagName + " " + (pr.getAttribute("aria-label") || pr.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 40);
  });
  if (/^introuvable/.test(prev)) { console.log(prev); await browser.close(); return; }
  await p.focus('[data-dz-prev="1"]'); const t0 = Date.now(); await p.keyboard.press("Tab");
  const releves = [];
  for (const ms of [0, 30, 100, 300, 1000, 2500]) {
    const wait = ms - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait);
    releves.push({ ms: Date.now() - t0, ...(await p.evaluate(() => { const e = document.activeElement; const s = [...document.querySelectorAll('select[aria-label="Marque"], select[aria-label*="marque" i]')].find((x) => x.getClientRects().length); return { actif: e === document.body ? "body" : e === s ? "liste Marque" : (e.tagName + " " + (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 40), listeDesactivee: s.disabled, options: s.options.length, premiereOption: s.options[0] && s.options[0].textContent }; })) });
  }
  await p.keyboard.press("Tab"); await p.waitForTimeout(300);
  const apresTabSuivant = await p.evaluate(() => { const e = document.activeElement; return e === document.body ? "body" : (e.tagName + " " + (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 40); });
  const out = { id, route, viewport: `${W}x${H}`, at: new Date().toISOString(), elementPrecedent: prev, releves, apresTabSuivant, requetesAbandonnees: aborted };
  fs.writeFileSync(path.join(outDir, "mesures", `focus-marque-${id}-${W}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
