// Complément n° 4 au mandat DU : captures des zones touchées par le complément n° 3 de DS, à 390
// et 1440 px, avec reducedMotion=reduce (rendu figé). Clip en coordonnées de page (fullPage).
// Usage : node captures-du4.cjs <url> <dossier> <prefixe>
const { chromium } = require(process.env.PW || "playwright");
const [, , url, dir, prefix] = process.argv;
const ZONES = {
  "fil-ariane-et-liens-utiles": () => { const a = document.querySelector("div.py-4.bg-slate-50.border-b"); const h = [...document.querySelectorAll("a")].find((x) => x.textContent.trim() === "Pièces Auto"); return [h && (h.closest("nav, ol") || h.parentElement), a]; },
  "bien-choisir": () => [document.getElementById("bien-choisir")],
  "badge-2-min": () => { const b = [...document.querySelectorAll("span.rounded-full")].find((x) => x.textContent.trim() === "2 min"); return [b && b.closest("section, .rounded-2xl, .rounded-xl")]; },
  "legendes-images": () => [...document.querySelectorAll("figcaption")].map((f) => f.closest("figure") || f),
  "aller-plus-loin": () => [document.getElementById("aller-plus-loin")],
};
(async () => {
  const b = await chromium.launch();
  for (const W of [390, 1440]) {
    const mobile = W < 800;
    const ctx = await b.newContext({ viewport: { width: W, height: mobile ? 844 : 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
    const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
    for (let y = 0; y < 30000; y += 700) { await p.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y); await p.waitForTimeout(100); }
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(800);
    for (const [name, fn] of Object.entries(ZONES)) {
      const rects = await p.evaluate(`(${fn})().filter(Boolean).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; })`);
      if (!rects.length) { console.log("absent", name, W); continue; }
      // Une zone = un ou plusieurs éléments. Élément unique : capture de l'élément (défilement
      // automatique, donc rendu même sous content-visibility). Zone composée (haut de page) : clip.
      const n = await p.evaluate(`(() => { const els = (${fn})().filter(Boolean); els.forEach((e, i) => e.setAttribute("data-c4", "${name}-" + i)); return els.length; })()`);
      for (let i = 0; i < n; i++) {
        const single = name !== "fil-ariane-et-liens-utiles";
        const f = `${dir}/${prefix}-${name}${name === "legendes-images" ? "-" + (i + 1) : ""}-${W}.png`;
        if (single) {
          const loc = p.locator(`[data-c4="${name}-${i}"]`);
          await loc.evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" })); await p.waitForTimeout(600);
          await loc.screenshot({ path: f, animations: "disabled" });
        } else {
          const r = rects.reduce((a, c) => ({ x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), r: Math.max(a.r, c.x + c.w), b: Math.max(a.b, c.y + c.h) }), { x: 1e9, y: 1e9, r: 0, b: 0 });
          await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(400);
          await p.screenshot({ path: f, clip: { x: 0, y: Math.max(0, r.y - 8), width: W, height: r.b - r.y + 16 }, fullPage: true, animations: "disabled" });
        }
        console.log(f.split("/").pop());
        if (!single) break;
      }
    }
    await ctx.close();
  }
  await b.close();
})();
