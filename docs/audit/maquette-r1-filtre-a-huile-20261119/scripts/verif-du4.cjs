// Complément n° 4 au mandat DU : vérifications ponctuelles. (a) « Conseils entretien » : pixels
// de fond, élément centré dans la fenêtre (hors en-tête collant) ; (b) taille du lien
// d'évitement une fois focalisé ; (c) badge « 2 min » : couleur calculée et classes en conflit.
// Usage : node verif-du4.cjs <url> <width> <height>
const { chromium } = require(process.env.PW || "playwright");
const [, , url, W, H] = process.argv;
(async () => {
  const b = await chromium.launch(); const mobile = Number(W) < 800;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(3000);
  const out = {};
  const ce = p.locator('a:has-text("Conseils entretien")').first();
  await ce.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(400);
  const box = await ce.boundingBox();
  const buf = await p.screenshot({ clip: { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4 } });
  out.conseils = await p.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3); }, buf.toString("base64"));
  const lum = (h) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const n = parseInt(h.slice(1), 16); return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const bg = out.conseils[0][0]; out.conseilsRatioPixelCentre = Math.round(((lum(bg) + 0.05) / (lum("#1e8449") + 0.05)) * 100) / 100;
  out.conseilsBox = box;
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await p.keyboard.press("Tab"); await p.waitForTimeout(200);
  out.premierFocus = await p.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); return { text: (e.textContent || "").trim().slice(0, 40), w: r.width, h: r.height, cls: String(e.className).slice(0, 120) }; });
  out.badge = await p.evaluate(() => { const e = [...document.querySelectorAll(".text-cta-700")].find((x) => /2 min/.test(x.textContent)); return e && { color: getComputedStyle(e).color, classes: String(e.className) }; });
  console.log(JSON.stringify(out));
  await b.close();
})();
