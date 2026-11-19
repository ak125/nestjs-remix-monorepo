// Complément n° 3 au mandat DU : déplacement au survol des éléments corrigés, avec et sans
// prefers-reduced-motion. Tailwind 4 déplace via les propriétés CSS `translate` et `scale`
// (pas `transform`) : on lit les trois. Usage : node survol-du.cjs <url> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const [, , url, out] = process.argv;
const targets = [
  ["nav-rapide (bouton)", 'nav[aria-label="Navigation rapide"] button', null],
  ["carte (lien)", "#reference a.group", null],
  ["carte > image", "#reference a.group", "img"],
  ["carte > Voir les pièces", "#reference a.group", "span.bg-navy.rounded-lg, .bg-navy.rounded-lg"],
  ["carte > chevron", "#reference a.group", ".bg-navy.rounded-lg svg"],
  ["Voir les N autres", "#reference button.bg-navy", null],
];
(async () => {
  const browser = await chromium.launch();
  const res = {};
  for (const rm of ["no-preference", "reduce"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: rm });
    await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(3000);
    res[rm] = {};
    for (const [name, sel, child] of targets) {
      try {
        const host = page.locator(sel).first();
        await host.scrollIntoViewIfNeeded({ timeout: 8000 });
        await page.mouse.move(1, 1); await page.waitForTimeout(500);
        const read = () => host.evaluate((e, c) => { const t = c ? e.querySelector(c) : e; if (!t) return null; const s = getComputedStyle(t); return { translate: s.translate, scale: s.scale, transform: s.transform, transitionDuration: s.transitionDuration, transitionProperty: s.transitionProperty }; }, child);
        const before = await read();
        await host.hover(); await page.waitForTimeout(800);
        const after = await read();
        const nul = (v) => !v || ["none", "0px", "0px 0px", "1", "1 1"].includes(v.translate === undefined ? v : v);
        const moved = !!after && (!nul(after.translate) || !nul(after.scale) || after.transform !== "none");
        res[rm][name] = { before, after, moved };
      } catch (e) { res[rm][name] = { error: String(e.message).split("\n")[0] }; }
    }
    // Ailleurs sur la page : éléments à classe de déplacement au survol non neutralisée par motion-reduce
    res[rm].__ailleurs = await page.evaluate(() => [...document.querySelectorAll("[class]")].filter((e) => { const c = String(e.className.baseVal ?? e.className); return /(hover|group-hover):-?(translate|scale)/.test(c) && !/motion-reduce:(group-)?hover:(translate|scale)/.test(c); }).map((e) => { const sec = e.closest("section[id],nav[aria-label],header,footer"); return (sec ? (sec.id ? "#" + sec.id : sec.tagName.toLowerCase() + (sec.getAttribute("aria-label") ? "[" + sec.getAttribute("aria-label") + "]" : "")) : "body") + " " + e.tagName.toLowerCase() + " " + (String(e.className.baseVal ?? e.className).match(/(group-)?hover:-?(translate|scale)[^ ]*/g) || []).join(","); }));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify({ url, at: new Date().toISOString(), viewport: "1440x900", res }, null, 2));
  for (const rm of Object.keys(res)) for (const [k, v] of Object.entries(res[rm])) if (k !== "__ailleurs") console.log(rm.padEnd(13), k.padEnd(26), v.error || `moved=${v.moved} translate:${v.before?.translate}→${v.after?.translate} scale:${v.before?.scale}→${v.after?.scale} prop:${v.after?.transitionProperty}`);
  console.log('ailleurs (reduce):', JSON.stringify(res.reduce.__ailleurs.reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {}), null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
