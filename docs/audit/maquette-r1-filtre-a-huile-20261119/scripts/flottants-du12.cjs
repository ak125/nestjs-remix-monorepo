// flottants-du12.cjs — boutons flottants (position fixed) contre les lignes de fabrication des cartes R1.
// Pour chaque ligne : chevauchement horizontal entre la fin du texte et chaque bouton fixe ; puis, ligne amenée
// sous le bouton par défilement, nombre de pixels de l'année réellement couverts (elementFromPoint).
// Usage : CHROME=... PW=... node flottants-du12.cjs <url> <w> <h> <profil> <out.json>
const fs = require("node:fs"); const { chromium } = require(process.env.PW);
const [, , url, W, H, prof, out] = process.argv;
(async () => {
  fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = ctx.pages()[0] || (await ctx.newPage());
  await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const res0 = {};
  const btn = p.locator("section button", { hasText: /Voir les \d+ autres/ }).first(); if (await btn.count()) { await btn.click(); await p.waitForTimeout(800); }
  // AVANT=1 : reconstitue dans le DOM le texte de 31fa098f4 (« Fabrication : dès AAAA » / « jusqu'en AAAA »), même balisage
  if (process.env.AVANT === "1") res0.avant = await p.evaluate(() => { let n = 0; for (const e of document.querySelectorAll("a p")) { const m = e.textContent.trim().match(/^(Début|Fin) de fabrication\u00a0:\s*(\d{4})$/); if (m) { e.innerHTML = 'Fabrication&nbsp;: <span class="whitespace-nowrap">' + (m[1] === "Début" ? "dès " : "jusqu'en ") + m[2] + "</span>"; n++; } } return n; });
  await p.waitForTimeout(300);
  // descendre jusqu'aux cartes pour faire apparaître le bouton « remonter »
  await p.evaluate(() => { const f = [...document.querySelectorAll("a p")].find((e) => /fabrication/i.test(e.textContent)); f.scrollIntoView({ block: "center", behavior: "instant" }); }); await p.waitForTimeout(1200);
  const fixes = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); if (s.position !== "fixed" || s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.width < 120 && r.height > 0 && r.height < 120 && r.bottom > innerHeight / 2; })
    .map((e) => { const r = e.getBoundingClientRect(); e.dataset.du12 = "fixe"; return { tag: e.tagName, label: e.getAttribute("aria-label") || e.textContent.trim().slice(0, 40), classes: e.className.toString().slice(0, 120), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
  const lignes = await p.evaluate(() => [...document.querySelectorAll("a p")].filter((e) => /^(Début de fabrication|Fin de fabrication|Fabrication)/.test(e.textContent.trim())).map((f, i) => { f.dataset.du12l = i; const sp = f.querySelector("span"); const rg = document.createRange(); rg.selectNodeContents(sp); const rs = [...rg.getClientRects()].filter((r) => r.width > 0); const r = rs[rs.length - 1]; return { i, titre: f.closest("a").querySelector("h3")?.textContent.trim().slice(0, 40), texte: f.textContent.replace(/ /g, " "), anneesDroite: Math.round(r.right), anneesGauche: Math.round(r.left) }; }));
  const res = { url, viewport: `${W}x${H}`, at: new Date().toISOString(), etat: process.env.AVANT === "1" ? "reconstitution 31fa098f4" : "tête", lignesReecrites: res0.avant ?? 0, fixes, lignes: [] };
  for (const l of lignes) {
    const par = [];
    for (const b of fixes) {
      const chevauche = Math.max(0, Math.min(l.anneesDroite, b.x + b.w) - Math.max(l.anneesGauche, b.x));
      let couverts = 0, verif = null;
      if (chevauche > 0) {
        // amener la ligne à la hauteur du centre du bouton, puis tester chaque pixel de l'année sur sa ligne médiane
        verif = await p.evaluate(({ i, b }) => {
          const f = document.querySelector(`[data-du12l="${i}"]`); const sp = f.querySelector("span");
          const rg0 = document.createRange(); rg0.selectNodeContents(sp); const r0 = [...rg0.getClientRects()].filter((r) => r.width > 0).pop();
          document.documentElement.style.scrollBehavior = "auto"; window.scrollBy({ top: r0.top + r0.height / 2 - (b.y + b.h / 2), behavior: "instant" });
          const rg = document.createRange(); rg.selectNodeContents(sp); const r = [...rg.getClientRects()].filter((x) => x.width > 0).pop();
          const y = r.top + r.height / 2; let n = 0;
          for (let x = Math.ceil(r.left); x < r.right; x++) { const e = document.elementFromPoint(x, y); if (e && !sp.contains(e) && e !== f && e.closest("[data-du12=fixe]")) n++; }
          return { couverts: n, largeurAnnees: Math.round(r.width), yCentre: Math.round(y) };
        }, { i: l.i, b });
        couverts = verif.couverts;
      }
      par.push({ bouton: b.label, chevauchementHorizontal: chevauche, pixelsCouverts: couverts, verif });
    }
    res.lignes.push({ ...l, boutons: par });
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log(W, url.split("/").pop(), "boutons fixes :", fixes.map((b) => `${b.label} [${b.x},${b.y} ${b.w}x${b.h}]`).join(" ; "));
  for (const b of fixes) { const t = res.lignes.map((l) => l.boutons.find((x) => x.bouton === b.label)); const touch = t.filter((x) => x.pixelsCouverts > 0); console.log("   ", b.label, ": lignes touchées", touch.length, "/", res.lignes.length, "pixels couverts", touch.length ? `${Math.min(...touch.map((x) => x.pixelsCouverts))}–${Math.max(...touch.map((x) => x.pixelsCouverts))}` : "-"); }
  await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
