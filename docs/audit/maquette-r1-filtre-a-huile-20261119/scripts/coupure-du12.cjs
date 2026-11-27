// coupure-du12.cjs — où se coupe la ligne « Début de fabrication : AAAA » des cartes R1, et pourquoi.
// Usage : CHROME=... PW=... node coupure-du12.cjs <url> <w> <h> <profil> <out.json>
const fs = require("node:fs"); const { chromium } = require(process.env.PW);
const [, , url, W, H, prof, out] = process.argv;
(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const btn = p.locator("section button", { hasText: /Voir les \d+ autres/ }).first(); if (await btn.count()) { await btn.click(); await p.waitForTimeout(800); }
  const res = await p.evaluate(() => [...document.querySelectorAll("a p")].filter((e) => /^(Début|Fin) de fabrication/.test(e.textContent.trim())).map((fab) => {
    const lignesDe = (node) => { const rg = document.createRange(); rg.selectNodeContents(node); return [...rg.getClientRects()].filter((r) => r.width > 0).map((r) => ({ x: Math.round(r.x), top: Math.round(r.top), w: Math.round(r.width) })); };
    const span = fab.querySelector("span"); const label = fab.firstChild;
    const parent = fab.parentElement; const ps = getComputedStyle(parent); const fs_ = getComputedStyle(fab);
    const rp = fab.getBoundingClientRect(), rpar = parent.getBoundingClientRect();
    // largeur que prendrait la ligne sans coupure
    const c = fab.cloneNode(true); c.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;width:auto"; document.body.appendChild(c); const naturelle = Math.round(c.getBoundingClientRect().width); c.remove();
    return { titre: fab.closest("a").querySelector("h3")?.textContent.trim(), texte: fab.textContent, libelle: lignesDe(label), annees: lignesDe(span),
      p: { w: Math.round(rp.width), x: Math.round(rp.x) }, largeurNaturelle: naturelle,
      parent: { tag: parent.tagName, classes: parent.className.slice(0, 160), display: ps.display, flexDirection: ps.flexDirection, w: Math.round(rpar.width) },
      pStyle: { display: fs_.display, flex: fs_.flex, whiteSpace: fs_.whiteSpace } };
  }));
  fs.writeFileSync(out, JSON.stringify({ url, viewport: `${W}x${H}`, at: new Date().toISOString(), lignes: res }, null, 2));
  for (const r of res) console.log(W, r.titre, "| p", r.p.w, "px, naturelle", r.largeurNaturelle, "px | libellé sur", new Set(r.libelle.map((x) => x.top)).size, "ligne(s), années top", r.annees.map((x) => x.top), "libellé tops", [...new Set(r.libelle.map((x) => x.top))], "| parent", r.parent.display, r.parent.flexDirection, r.parent.w);
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
