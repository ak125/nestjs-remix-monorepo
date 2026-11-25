// Complément n° 6 DZ — causes du décalage de mise en page (CLS) : liste des layout-shift avec leurs sources, ce qui
// change de taille ou de classe au même instant (« poussoirs »), la phase du parcours et la position de défilement.
// Lecture seule : aucune saisie ni clic ; seule la touche Tab est pressée dans la méthode « parcours » (comme mesure-dz.cjs).
// Usage : node scripts/cls-causes-dz.cjs <id> <chemin> <L> <H> <avant|a3> <parcours|sauts|molette> <fichier-sortie.json> [correctif.css]
//   parcours : reproduit l'ordre de mesure-dz.cjs (chargement, 40 Tab, sauts de 700 px, centrage de 90 textes,
//              content-visibility forcée 300 ms puis retirée) — la méthode qui a produit les chiffres du rapport ;
//   sauts    : chargement puis scrollThrough de lib-dz.cjs seul (sauts instantanés de 700 px toutes les 110 ms, retour en haut) ;
//   molette  : chargement puis défilement progressif à la molette (100 px toutes les 50 ms) jusqu'en bas, puis remontée.
// La feuille d'option est injectée après chargement par injection-dz.cjs (même convention que les n° 2 à 5) : la phase
// « injection » est isolée et exclue du CLS de défilement. Un correctif optionnel (feuille de démonstration) est injecté pareil.
const fs = require("node:fs");
const OPT = require("node:path").join(__dirname, "..");
const { chromium, BASE, newContext, settle, scrollThrough } = require(OPT + "/../scripts/lib-dz.cjs");
const { injecte } = require(OPT + "/scripts/injection-dz.cjs");
const [id, route, Ws, Hs, variante, methode, sortie, correctif] = process.argv.slice(2);
const W = +Ws, H = +Hs;

const ENREGISTREUR = String.raw`
(() => {
  const C = window.__cls = { phase: "chargement", phases: [{ p: "chargement", t: 0, y: 0 }], shifts: [], nodes: [], scroll: [], rz: [], rzRefs: [], mut: [], mutRefs: [], fonts: [], imgs: [] };
  const now = () => Math.round(performance.now() * 10) / 10;
  C.setPhase = (p) => { C.phase = p; C.phases.push({ p, t: now(), y: Math.round(scrollY) }); };
  addEventListener("scroll", () => { C.scroll.push([now(), Math.round(scrollY)]); }, { passive: true, capture: true });
  const rect = (r) => r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) {
      C.shifts.push({ t: Math.round(e.startTime * 10) / 10, v: e.value, input: e.hadRecentInput, yRappel: Math.round(scrollY), etat: document.readyState, feuilles: document.styleSheets.length, hydrate: !!window.__reactRouterRouteModules,
        sources: (e.sources || []).map((s) => { let k = -1; if (s.node) { k = C.nodes.indexOf(s.node); if (k < 0) { C.nodes.push(s.node); k = C.nodes.length - 1; } } return { k, avant: rect(s.previousRect), apres: rect(s.currentRect) }; }) });
    } }).observe({ type: "layout-shift", buffered: true });
  } catch (e) { C.erreurObs = String(e); }
  const tailles = new WeakMap();
  const ro = new ResizeObserver((ents) => { const t = now(); for (const en of ents) { const e = en.target; const r = e.getBoundingClientRect(); const prev = tailles.get(e); tailles.set(e, [r.width, r.height]);
    if (!prev) continue; const dw = r.width - prev[0], dh = r.height - prev[1]; if (Math.abs(dh) < 2 && Math.abs(dw) < 2) continue;
    if (C.rz.length < 20000) { C.rz.push({ t, dw: Math.round(dw), dh: Math.round(dh), h: Math.round(r.height), yDoc: Math.round(r.top + scrollY) }); C.rzRefs.push(e); } } });
  const suivre = (n) => { if (n.nodeType !== 1) return; ro.observe(n); for (const c of n.querySelectorAll("*")) ro.observe(c); };
  const mo = new MutationObserver((ms) => { const t = now(); for (const m of ms) {
    if (m.type === "childList") { for (const n of m.addedNodes) { suivre(n); if (n.nodeType === 1 && C.mut.length < 8000) { const r = n.getBoundingClientRect(); C.mut.push({ t, type: "ajout", h: Math.round(r.height), yDoc: Math.round(r.top + scrollY) }); C.mutRefs.push(n); } }
      for (const n of m.removedNodes) if (n.nodeType === 1 && C.mut.length < 8000) { C.mut.push({ t, type: "retrait", tag: n.tagName.toLowerCase(), cls: String(n.className && (n.className.baseVal ?? n.className)).slice(0, 90) }); C.mutRefs.push(m.target); } }
    else if (m.type === "attributes" && C.mut.length < 8000) { const e = m.target; if (/^data-dz/.test(m.attributeName)) continue; const cs = getComputedStyle(e);
      C.mut.push({ t, type: "attribut", attr: m.attributeName, ancien: String(m.oldValue || "").slice(0, 120), nouveau: String(e.getAttribute(m.attributeName) || "").slice(0, 120), position: cs.position, display: cs.display }); C.mutRefs.push(e); } } });
  const demarrer = () => { suivre(document.documentElement); mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open"], attributeOldValue: true }); };
  if (document.documentElement) demarrer(); else addEventListener("DOMContentLoaded", demarrer);
  try { document.fonts.addEventListener("loadingdone", (e) => C.fonts.push({ t: now(), polices: e.fontfaces.map((f) => f.family + " " + f.weight) })); } catch (e) {}
  addEventListener("load", (e) => { const im = e.target; if (im && im.tagName === "IMG") C.imgs.push({ t: now(), src: (im.currentSrc || im.src || "").replace(location.origin, "").slice(0, 110), dims: im.hasAttribute("width") && im.hasAttribute("height") }); }, true);
})();
`;

async function molette(page, sens) {
  await page.mouse.move(Math.round(W / 2), Math.round(H / 2));
  let immobile = 0, pas = 0, y0 = -1;
  while (pas < 900 && immobile < 15) {
    await page.mouse.wheel(0, sens * 100); await page.waitForTimeout(50); pas++;
    const y = await page.evaluate(() => Math.round(scrollY)); immobile = y === y0 ? immobile + 1 : 0; y0 = y;
  }
  return pas;
}

(async () => {
  const debut = new Date().toISOString();
  const browser = await chromium.launch(); const aborted = [];
  const ctx = await newContext(browser, { width: W, height: H, aborted });
  await ctx.addInitScript({ content: ENREGISTREUR });
  // DZ_CORRECTIF_TOT=1 : le correctif est écrit dans le <head> du document HTML reçu (dans ce navigateur seulement, requête
  // GET), pour démontrer l'effet sur les décalages du chargement qu'une feuille ajoutée après chargement ne peut pas toucher.
  const tot = !!correctif && process.env.DZ_CORRECTIF_TOT === "1";
  if (tot) {
    const css = fs.readFileSync(correctif, "utf8");
    await ctx.route((u) => u.href === BASE + route, async (r) => {
      if (r.request().method() !== "GET") return r.fallback();
      const rep = await r.fetch(); const html = (await rep.text()).replace("</head>", `<style data-dz-correctif="tot">${css}</style></head>`);
      return r.fulfill({ response: rep, body: html });
    });
  }
  const page = await ctx.newPage();
  const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
  await settle(page, 4500);
  const phase = (p) => page.evaluate((p) => window.__cls.setPhase(p), p);
  let injection = { variante: "avant", injectee: false }, injCorrectif = tot ? correctif.split("/").pop() + " (dans le HTML)" : null;
  if (variante !== "avant" || (correctif && !tot)) {
    await phase("injection");
    if (variante !== "avant") injection = await injecte(page, variante);
    if (correctif && !tot) { const h = await page.addStyleTag({ content: fs.readFileSync(correctif, "utf8") }); await h.evaluate((s) => s.setAttribute("data-dz-correctif", "1")); injCorrectif = correctif.split("/").pop(); }
    await page.waitForTimeout(1200);
  }
  const deroule = {};
  if (methode === "parcours") {
    await phase("tabulation"); for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(160); }
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
    await page.waitForTimeout(600);
    await phase("sauts"); await scrollThrough(page);
    await phase("centrage");
    const n = await page.evaluate(() => { const L = [...document.querySelectorAll("body *")].filter((e) => __dz.visible(e) && [...e.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())); L.slice(0, 90).forEach((e, i) => e.setAttribute("data-dz-c", String(i))); return Math.min(90, L.length); });
    for (let i = 0; i < n; i++) { await page.evaluate((i) => { const e = document.querySelector(`[data-dz-c="${i}"]`); e && e.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }); }, i); await page.waitForTimeout(120); }
    deroule.centrage = n;
    await phase("cv-forcee");
    await page.addStyleTag({ content: "*{content-visibility:visible !important}" }).then((h) => h.evaluate((e) => e.setAttribute("data-dz-cv", "1")));
    await page.waitForTimeout(300);
    await phase("cv-retiree"); await page.evaluate(() => document.querySelectorAll("style[data-dz-cv]").forEach((e) => e.remove()));
    await page.waitForTimeout(300);
    await phase("fin"); await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(1500);
  } else if (methode === "sauts") {
    await phase("sauts"); await scrollThrough(page); await phase("fin"); await page.waitForTimeout(1500);
  } else if (methode === "molette") {
    await phase("molette-descente"); deroule.pasDescente = await molette(page, 1); await page.waitForTimeout(1500);
    await phase("molette-remontee"); deroule.pasRemontee = await molette(page, -1); await phase("fin"); await page.waitForTimeout(1500);
  } else throw new Error("méthode inconnue : " + methode);

  const res = await page.evaluate(() => {
    const C = window.__cls;
    const trace = (e) => { const out = []; for (let x = e, i = 0; x && x.nodeType === 1 && i < 5; x = x.parentElement, i++) { const c = String(x.className && (x.className.baseVal ?? x.className)).split(/\s+/).filter(Boolean).slice(0, 6).join("."); out.push(x.tagName.toLowerCase() + (x.id ? "#" + x.id : "") + (c ? "." + c : "")); } return out; };
    const desc = (e) => e && e.nodeType === 1 ? { sel: __dz.sel(e), texte: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 60), trace: trace(e), position: getComputedStyle(e).position } : { sel: e ? "#text" : null };
    const phaseDe = (t) => { let p = C.phases[0].p; for (const x of C.phases) if (x.t <= t) p = x.p; return p; };
    const yDe = (t) => { let y = 0; for (const [ts, v] of C.scroll) { if (ts <= t) y = v; else break; } return y; };
    const shifts = C.shifts.map((s) => ({ t: s.t, v: Math.round(s.v * 100000) / 100000, input: s.input, phase: phaseDe(s.t), y: yDe(s.t), yRappel: s.yRappel, etat: s.etat, feuilles: s.feuilles, hydrate: s.hydrate,
      sources: s.sources.map((x) => ({ ...desc(C.nodes[x.k]), avant: x.avant, apres: x.apres })) }));
    // poussoirs : changements de taille, ajouts et changements de classe dans la fenêtre [t-150, t+30] ms ; on garde ceux qui sont
    // au-dessus d'une source (dans le document) ou qui la contiennent, et pas à l'intérieur d'une source.
    for (const [i, s] of shifts.entries()) {
      if (s.v < 0.01) continue;
      const srcs = C.shifts[i].sources.map((x) => C.nodes[x.k]).filter((n) => n && n.nodeType === 1);
      const yMin = Math.min(...C.shifts[i].sources.map((x) => (x.avant ? x.avant[1] : 1e9))) + s.y;
      const garde = (e, yDoc) => e && e.nodeType === 1 && !srcs.some((n) => n.contains(e) && n !== e) && (srcs.some((n) => e.contains(n)) || yDoc <= yMin + 2 || srcs.some((n) => e.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING));
      const cand = [];
      C.rz.forEach((r, j) => { if (r.t >= s.t - 150 && r.t <= s.t + 30 && garde(C.rzRefs[j], r.yDoc)) cand.push({ type: "taille", t: r.t, dh: r.dh, dw: r.dw, h: r.h, yDoc: r.yDoc, contientSource: srcs.some((n) => C.rzRefs[j].contains(n)), ...desc(C.rzRefs[j]) }); });
      C.mut.forEach((m, j) => { if (m.t >= s.t - 300 && m.t <= s.t + 30 && (m.type !== "attribut" || garde(C.mutRefs[j], 0))) cand.push({ ...m, ...desc(C.mutRefs[j]) }); });
      // le plus grand changement de hauteur d'abord ; on retire les ancêtres qui ne font que répercuter la hauteur d'un descendant listé
      const refs = new Map(); C.rz.forEach((r, j) => refs.set(r, C.rzRefs[j]));
      const tailles = cand.filter((c) => c.type === "taille");
      for (const c of tailles) { const e = C.rzRefs[C.rz.findIndex((r) => r.t === c.t && r.dh === c.dh && r.h === c.h && r.yDoc === c.yDoc)];
        c.profondeur = 0; for (let x = e; x; x = x.parentElement) c.profondeur++;
        c.repercute = !!e && tailles.some((d) => d !== c && d.dh === c.dh && Math.abs(d.t - c.t) < 1 && d.profondeur !== undefined && (() => { const f = C.rzRefs[C.rz.findIndex((r) => r.t === d.t && r.dh === d.dh && r.h === d.h && r.yDoc === d.yDoc)]; return f && f !== e && e.contains(f); })()); }
      cand.sort((a, b) => (a.repercute ? 1 : 0) - (b.repercute ? 1 : 0) || Math.abs(b.dh || 0) - Math.abs(a.dh || 0) || (b.profondeur || 0) - (a.profondeur || 0));
      s.poussoirs = cand.slice(0, 12);
      s.poussoirsTotal = cand.length;
    }
    return { shifts, phases: C.phases, scrollDebut: C.scroll.slice(0, 8), navigation: (() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; })(), fonts: C.fonts, imgs: C.imgs.length, imgsSansDims: C.imgs.filter((x) => !x.dims).map((x) => x.src).slice(0, 10), nScroll: C.scroll.length, scrollHeight: document.documentElement.scrollHeight, erreurObs: C.erreurObs || null };
  });
  // CLS : somme hors saisie, et CLS « officiel » = plus grande fenêtre de session (écart < 1 s, durée ≤ 5 s), hors saisie.
  const cls = (L) => { let max = 0, cur = 0, debutF = -1, dernier = -1; const fen = [];
    for (const s of L) { if (s.input) continue; if (dernier < 0 || s.t - dernier >= 1000 || s.t - debutF > 5000) { cur = 0; debutF = s.t; } cur += s.v; dernier = s.t; if (cur > max) { max = cur; } }
    return { somme: Math.round(L.filter((s) => !s.input).reduce((a, s) => a + s.v, 0) * 10000) / 10000, officiel: Math.round(max * 10000) / 10000, n: L.filter((s) => !s.input).length, nSaisie: L.filter((s) => s.input).length };
  };
  const parPhase = {}; for (const p of [...new Set(res.phases.map((x) => x.p))]) parPhase[p] = cls(res.shifts.filter((s) => s.phase === p));
  const horsInjection = res.shifts.filter((s) => s.phase !== "injection");
  const defilement = res.shifts.filter((s) => !["chargement", "injection"].includes(s.phase));
  const out = { id, route, viewport: `${W}x${H}`, variante, methode, correctif: injCorrectif, debut, fin: new Date().toISOString(), statut: resp && resp.status(),
    injection, deroule, cls: { total: cls(res.shifts), horsInjection: cls(horsInjection), chargement: parPhase.chargement || null, defilement: cls(defilement), parPhase }, ...res,
    requetesAbandonnees: aborted.length, nonGet: aborted.filter((a) => a.raison === "non GET").length };
  fs.writeFileSync(sortie, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ id, W, variante, methode, correctif: injCorrectif, total: out.cls.horsInjection, chargement: out.cls.chargement, defilement: out.cls.defilement, phases: Object.fromEntries(Object.entries(parPhase).map(([k, v]) => [k, v.somme])) }));
  await browser.close();
})().catch((e) => { console.error("ERREUR", id, W, variante, methode, e.message); process.exit(1); });
