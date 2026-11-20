// liens-du13.cjs — complément n° 13 : cartes véhicule R1 repliées (classe `hidden`) sur le rendu réel.
// Usage : CHROME=/usr/bin/google-chrome PW=<node_modules>/playwright node liens-du13.cjs <base> <R1 path> <w> <h> <profil> <out.json> [nojs]
// Mesures : cartes du DOM (visibles / masquées) ; images des cartes masquées demandées ou non avant le clic ;
// CLS et LCP de laboratoire ; parcours clavier (Tab sur toute la page, puis autour du bouton) ; attributs du bouton ;
// MASK=1 : images de la section masquées sur les captures (leur état de chargement varie d'un passage à l'autre).
// arbre d'accessibilité de la section avant et après ; dépliage par Entrée, repliage par Espace ; captures de la section.
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
let res = {};
const [, , base, R1, W, H, prof, out, mode] = process.argv;
const NOJS = mode === "nojs";
const SECTION = `(() => { const f = [...document.querySelectorAll("p")].find((e) => /^(Début de fabrication|Fin de fabrication|Fabrication)/.test(e.textContent.trim())); return f ? f.closest("section") : null; })()`;
(async () => {
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME, headless: true, viewport: { width: +W, height: +H }, deviceScaleFactor: 1, javaScriptEnabled: !NOJS, isMobile: +W < 600, hasTouch: +W < 600 });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const reqs = []; ctx.on("request", (q) => { if (q.resourceType() === "image") reqs.push(q.url()); });
  await ctx.addInitScript(() => { window.__ls = []; window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, t: e.startTime, recent: e.hadRecentInput }); }).observe({ type: "layout-shift", buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName + "." + String(e.element.className).slice(0, 50) : null }); }).observe({ type: "largest-contentful-paint", buffered: true }); });
  const p = ctx.pages()[0] || (await ctx.newPage());
  res = { base, R1, W: +W, H: +H, js: !NOJS };
  const r = await p.goto(base + R1, { waitUntil: "load", timeout: 120000 }); res.http = r.status(); await p.waitForTimeout(3000);
  const etat = () => p.evaluate((SECTION) => {
    const sec = eval(SECTION); if (!sec) return null;
    const grid = [...sec.querySelectorAll(".grid")].find((g) => [...g.children].some((c) => c.tagName === "A"));
    const cs = [...grid.children].filter((a) => a.tagName === "A");
    const vis = (a) => a.getClientRects().length > 0;
    const btn = [...sec.querySelectorAll("button")].find((b) => /compatibilités|Masquer les véhicules/.test(b.textContent));
    return { cartes: cs.length, visibles: cs.filter(vis).length, masquees: cs.filter((a) => !vis(a)).length, classeHidden: cs.filter((a) => a.classList.contains("hidden")).length,
      displayMasquees: [...new Set(cs.filter((a) => !vis(a)).map((a) => getComputedStyle(a).display))],
      hrefs: cs.map((a) => a.getAttribute("href")), imgMasquees: cs.filter((a) => !vis(a)).map((a) => a.querySelector("img") && a.querySelector("img").getAttribute("src")),
      imgVisibles: cs.filter(vis).map((a) => a.querySelector("img") && a.querySelector("img").getAttribute("src")),
      bouton: btn ? { texte: btn.textContent.trim().replace(/\s+/g, " "), type: btn.getAttribute("type"), ariaExpanded: btn.getAttribute("aria-expanded"), ariaControls: btn.getAttribute("aria-controls") } : null };
  }, SECTION);
  res.avant = await etat();
  await p.evaluate((SECTION) => eval(SECTION).setAttribute("data-du13", "1"), SECTION);
  // défilement complet (déclenche le chargement paresseux de tout ce qui est visible)
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 300) { await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await p.waitForTimeout(60); }
  await p.waitForTimeout(2000);
  const seul = (srcs, autres) => srcs.filter((s) => s && !autres.includes(s));
  const absUrl = (s) => new URL(s, base).href;
  const imgSeulesMasquees = seul(res.avant.imgMasquees, res.avant.imgVisibles);
  res.imagesMasqueesAvantClic = { uniquesAuxMasquees: imgSeulesMasquees.length, demandees: imgSeulesMasquees.filter((s) => reqs.includes(absUrl(s))).length, partageesAvecVisibles: res.avant.imgMasquees.length - imgSeulesMasquees.length };
  res.requetesImagesAvantClic = reqs.length;
  if (!NOJS) {
    const m = await p.evaluate(() => { let best = 0, cur = 0, s0 = -1, prev = -1; for (const e of window.__ls.filter((e) => !e.recent)) { if (prev < 0 || e.t - prev > 1000 || e.t - s0 > 5000) { cur = 0; s0 = e.t; } cur += e.v; prev = e.t; best = Math.max(best, cur); } return { cls: Math.round(best * 10000) / 10000, lcp: window.__lcp.slice(-1)[0] || null }; });
    res.cls = m.cls; res.lcp = m.lcp;
  }
  // capture de la section, premier affichage
  const secH = await p.evaluateHandle(SECTION);
  await p.mouse.move(1, 1);
  await secH.evaluate((s) => s.scrollIntoView({ block: "start", behavior: "instant" })); await p.waitForTimeout(800);
  fs.writeFileSync(out.replace(/\.json$/, "-avant-clic.png"), await secH.screenshot({ animations: "disabled", mask: process.env.MASK ? [p.locator("[data-du13] img")] : [] }));
  if (!NOJS) {
    // 1) parcours Tab de toute la page depuis le haut : aucune carte masquée ne doit recevoir le focus
    await p.reload({ waitUntil: "load" }); await p.waitForTimeout(3000); // point de départ du focus = début du document
    await p.evaluate((SECTION) => eval(SECTION).setAttribute("data-du13", "1"), SECTION);
    const tab = { appuis: 0, focusCartesVisibles: 0, focusCartesMasquees: 0, boutonAtteint: false, ordreAutourBouton: null };
    let prevDesc = null;
    for (let i = 0; i < 700; i++) {
      await p.keyboard.press("Tab"); tab.appuis++;
      const f = await p.evaluate((SECTION) => { const a = document.activeElement; if (!a || a === document.body) return { fin: true }; const sec = eval(SECTION);
        const carte = a.closest("a") && sec && sec.contains(a) && a.closest("a").querySelector("h3") ? a.closest("a") : null;
        const estBouton = a.tagName === "BUTTON" && /compatibilités/.test(a.textContent);
        return { carte: !!carte, carteMasquee: carte ? carte.getClientRects().length === 0 : false, estBouton, desc: carte ? "carte " + carte.querySelector("h3").textContent.trim().slice(0, 40) : a.tagName + " " + (a.textContent || "").trim().slice(0, 40) }; }, SECTION);
      if (f.fin) { tab.retoursAuBody = (tab.retoursAuBody || 0) + 1; if (tab.retoursAuBody > 3) break; continue; }
      if (f.carte) { if (f.carteMasquee) tab.focusCartesMasquees++; else tab.focusCartesVisibles++; }
      if (f.estBouton) { tab.boutonAtteint = true; tab.ordreAutourBouton = { avantBouton: prevDesc, appuisJusquAuBouton: tab.appuis }; break; }
      prevDesc = f.desc;
    }
    res.tab = tab;
    // 2) Entrée sur le bouton focalisé
    res.boutonFocalise = await p.evaluate(() => document.activeElement.tagName + " " + document.activeElement.textContent.trim().replace(/\s+/g, " "));
    await p.keyboard.press("Enter"); await p.waitForTimeout(800);
    res.apresEntree = await etat();
    res.focusApresEntree = await p.evaluate(() => document.activeElement.tagName + " " + document.activeElement.textContent.trim().replace(/\s+/g, " ").slice(0, 60));
    await p.keyboard.press("Shift+Tab");
    res.shiftTabApresEntree = await p.evaluate(() => { const a = document.activeElement; const h = a.querySelector && a.querySelector("h3"); return (h ? "carte " + h.textContent.trim() : a.tagName + " " + a.textContent.trim().slice(0, 40)) + " | href=" + a.getAttribute("href"); });
    res.ariaSection = {};
    // images des cartes révélées : chargées une fois visibles
    await p.evaluate((SECTION) => { const sec = eval(SECTION); sec.scrollIntoView({ block: "end", behavior: "instant" }); }, SECTION); await p.waitForTimeout(2500);
    const secH2 = await p.evaluateHandle(SECTION);
    res.imagesMasqueesApresClic = { demandees: imgSeulesMasquees.filter((s) => reqs.includes(absUrl(s))).length, sur: imgSeulesMasquees.length };
    await p.mouse.move(1, 1);
    await secH2.evaluate((s) => s.scrollIntoView({ block: "start", behavior: "instant" })); await p.waitForTimeout(800);
    fs.writeFileSync(out.replace(/\.json$/, "-apres-clic.png"), await secH2.screenshot({ animations: "disabled", mask: process.env.MASK ? [p.locator("[data-du13] img")] : [] }));
    res.ariaSection.apres = await p.locator("[data-du13]").ariaSnapshot();
    // 3) Espace replie
    await p.locator("button", { hasText: /Masquer les véhicules/ }).focus();
    await p.keyboard.press("Space"); await p.waitForTimeout(800);
    res.apresEspace = await etat();
    res.ariaSection.avant = await p.locator("[data-du13]").ariaSnapshot();
    for (const k of ["avant", "apres"]) { const t = res.ariaSection[k] || ""; res.ariaSection[k + "Liens"] = (t.match(/^\s*- '?link /gm) || []).length; res.ariaSection[k + "Bouton"] = (t.match(/^\s*- button .*$/m) || [null])[0]; }
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  await ctx.close();
})().catch((e) => { console.error(e); try { fs.writeFileSync(out, JSON.stringify(Object.assign({ erreur: String(e).slice(0, 300) }, res), null, 2)); } catch (_) {} process.exit(1); });
