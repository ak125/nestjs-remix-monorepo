// Mandat DZ — 6.4 : contrôle visuel des superpositions « nouvelles » relevées par reflow-dz.cjs.
// Pour chaque paire distincte (jusqu'à 3 par page et par condition), recharge la page dans la même condition
// (zoom 200 % émulé 640×400 densité 2, ou 1280×800 avec espacements WCAG 1.4.12), centre l'élément A
// et capture le cadre englobant A et B (marge 24 px). Lecture seule ; l'œil humain tranche sur la capture.
// Usage : node sonde-superpositions-dz.cjs <id> <chemin> <dossier-sortie>
const fs = require("node:fs");
const path = require("node:path");
const { chromium, BASE, newContext, settle, scrollThrough } = require("./lib-dz.cjs");
const [, , id, route, outDir] = process.argv;
const SPACING = "*{line-height:1.5 !important;letter-spacing:0.12em !important;word-spacing:0.16em !important} p{margin-bottom:2em !important}";
const src = JSON.parse(fs.readFileSync(path.join(outDir, "mesures", `${id}-reflow.json`), "utf8"));
(async () => {
  const browser = await chromium.launch(); const aborted = []; const res = [];
  for (const [cond, vp, inject] of [["zoom200", { width: 640, height: 400, dsf: 2 }, null], ["espacements", { width: 1280, height: 800 }, SPACING]]) {
    const vus = new Set(); const paires = src[cond].textesSuperposesNouveaux.filter((s) => { const k = [s.a, s.b].sort().join("|"); if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 3);
    if (!paires.length) continue;
    const ctx = await newContext(browser, { ...vp, aborted }); const p = await ctx.newPage();
    await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4000); await scrollThrough(p);
    await p.addStyleTag({ content: "*{content-visibility:visible !important}" }); await p.waitForTimeout(300);
    if (inject) { await p.addStyleTag({ content: inject }); await p.waitForTimeout(800); }
    let n = 0;
    for (const s of paires) {
      n++; const r = { condition: cond, a: s.a, texteA: s.texteA, b: s.b, texteB: s.texteB, recouvrementPx: s.recouvrementPx, at: new Date().toISOString() };
      try {
        const box = await p.evaluate(({ a, b, ta, tb }) => {
          const pick = (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(t.slice(0, 20)));
          const ea = pick(a, ta), eb = pick(b, tb); if (!ea || !eb) return null;
          ea.scrollIntoView({ block: "center", behavior: "instant" });
          const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
          const x0 = Math.max(0, Math.min(ra.left, rb.left) - 24), y0 = Math.max(0, Math.min(ra.top, rb.top) - 24);
          const x1 = Math.min(document.documentElement.clientWidth, Math.max(ra.right, rb.right) + 24), y1 = Math.min(innerHeight, Math.max(ra.bottom, rb.bottom) + 24);
          return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
        }, { a: s.a, b: s.b, ta: s.texteA, tb: s.texteB });
        if (!box || box.width < 2 || box.height < 2) { r.erreur = "éléments non retrouvés ou hors fenêtre"; }
        else { await p.waitForTimeout(150); const f = `captures/superposition-${id}-${cond}-${n}.jpg`; await p.screenshot({ path: path.join(outDir, f), clip: box, type: "jpeg", quality: 60, animations: "disabled" }); r.capture = f; }
      } catch (e) { r.erreur = String(e.message).split("\n")[0]; }
      res.push(r);
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "mesures", `superpositions-${id}.json`), JSON.stringify({ id, route, cas: res, requetesAbandonnees: aborted }, null, 1));
  console.log(`[superpositions-${id}]`, JSON.stringify(res.map((r) => [r.condition, r.texteA.slice(0, 20), r.texteB.slice(0, 20), r.capture || r.erreur])));
})().catch((e) => { console.error(e); process.exit(1); });
