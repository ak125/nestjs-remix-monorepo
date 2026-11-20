// Complément n° 2 DZ — conteneurs à fond sombre (luminance < 0,08) : balise et classes, pour les sélecteurs
// de contexte « sur fond navy » des feuilles d'options. Lecture seule.
// Usage (depuis options/) : NODE_PATH=/opt/automecanik/app/node_modules node scripts/fonds-sombres-options-dz.cjs <id> <chemin> <W> <H> .
const fs = require("node:fs"); const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("../../scripts/lib-dz.cjs");
const [, , id, route, Ws, Hs, outDir] = process.argv; const W = +Ws, H = +Hs;
(async () => {
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted }); const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4500); await scrollThrough(p);
  const r = await p.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgb = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return d; };
    const lum = (d) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[0]) + 0.7152 * f(d[1]) + 0.0722 * f(d[2]); };
    const out = {};
    for (const e of document.querySelectorAll("body *")) {
      const rc = e.getBoundingClientRect(); if (rc.width < 40 || rc.height < 20) continue;
      const cs = getComputedStyle(e); let dark = false;
      if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") { const d = rgb(cs.backgroundColor); if (d[3] > 200 && lum(d) < 0.08) dark = true; }
      if (!dark && cs.backgroundImage.includes("gradient")) { const m = cs.backgroundImage.match(/(rgba?|oklch|oklab|lab)\([^)]*\)/); if (m) { const d = rgb(m[0]); if (d[3] > 200 && lum(d) < 0.08) dark = true; } }
      if (!dark) continue;
      const k = e.tagName.toLowerCase() + " | " + (typeof e.className === "string" ? e.className : "").split(/\s+/).filter((c) => /^(bg-|from-|via-|to-)/.test(c)).join(" ");
      (out[k] = out[k] || { n: 0, ex: "" }).n++; if (!out[k].ex) out[k].ex = (e.innerText || "").trim().replace(/\s+/g, " ").slice(0, 50);
    }
    return out;
  });
  fs.writeFileSync(path.join(outDir, "mesures", `fonds-sombres-${id}-${W}.json`), JSON.stringify({ id, route, viewport: `${W}x${H}`, at: new Date().toISOString(), conteneurs: r, requetesAbandonnees: aborted }));
  await browser.close(); console.log(id, W, JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.n + " " + v.ex]))));
})().catch((e) => { console.error(e); process.exit(1); });
