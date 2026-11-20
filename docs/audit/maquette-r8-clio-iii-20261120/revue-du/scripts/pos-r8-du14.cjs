// Complément n° 14 au mandat DU : position verticale (px, haut du document) des blocs de la page R8,
// champ de recherche de pièce, premier lien de pièce, plan des titres, à une largeur donnée.
// Usage : PW=... CHROME=... IMG_FROM=http://localhost:3000 node pos-r8-du14.cjs <url> <largeur> <hauteur> <sortie.json> [capture.png]
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const [, , url, W, H, out, png] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: +W < 600, hasTouch: +W < 600 });
  const IMG = process.env.IMG_FROM; // images /img/* lues sur le DEV (GET seul), comme Caddy les sert
  await ctx.route("**/*", async (r) => { const u = r.request().url();
    if (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(u)) return r.abort();
    if (IMG && /^http:\/\/localhost:\d+\/img\//.test(u) && r.request().method() === "GET") return r.fulfill({ response: await r.fetch({ url: u.replace(/^http:\/\/localhost:\d+/, IMG) }) });
    return r.continue(); });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const y = (el) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
    const secs = [...document.querySelectorAll("[data-section]")].map((e) => ({ s: e.getAttribute("data-section"), y: y(e), h: Math.round(e.getBoundingClientRect().height) }));
    const inputs = [...document.querySelectorAll("main input[type=search], main input[type=text], main input:not([type])")].filter((i) => i.offsetParent).map((i) => ({ ph: i.placeholder, y: y(i), lab: i.getAttribute("aria-label") }));
    const r2 = [...document.querySelectorAll("main a[href^='/pieces/']")].filter((a) => a.offsetParent && /\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html$/.test(a.getAttribute("href")));
    const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({ t: h.tagName, txt: h.textContent.trim().replace(/\s+/g, " ").slice(0, 70), y: y(h), sec: h.closest("[data-section]")?.getAttribute("data-section") || (h.closest("footer") ? "footer" : null) }));
    return { largeur: innerWidth, hauteur: innerHeight, docH: document.documentElement.scrollHeight, sections: secs, recherche: inputs, premierLienR2: r2[0] ? { href: r2[0].getAttribute("href"), y: y(r2[0]) } : null, liensR2VisiblesPremierEcran: r2.filter((a) => y(a) < innerHeight).length, liensR2Visibles: r2.length, titres: heads };
  });
  if (png) await p.screenshot({ path: png, fullPage: false });
  fs.writeFileSync(out, JSON.stringify(r, null, 1)); await b.close();
  console.log(W, "docH", r.docH, "recherche", JSON.stringify(r.recherche), "1er R2", r.premierLienR2 && r.premierLienR2.y, "R2 1er écran", r.liensR2VisiblesPremierEcran, "/", r.liensR2Visibles);
  for (const s of r.sections) console.log("  ", s.s, s.y, "h", s.h);
})().catch((e) => { console.error(e); process.exit(1); });
