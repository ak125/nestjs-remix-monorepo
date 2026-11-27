// Complément n° 5 au mandat DU : badge « 2 min » (couleur, fond, nombre de lignes) et lien
// « Guide d'achat » de la bande : couleur calculée, fond opaque de l'ancêtre, histogramme des
// pixels de l'élément (capture) et contraste couleur du texte / couleur de fond majoritaire.
// Usage : node elements-du5.cjs <url> <width> <height> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const [, , url, W, H, out] = process.argv;
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: "reduce" });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const res = {};
  for (const [name, loc] of [["badge 2 min", page.locator("span", { hasText: /^\s*2 min\s*$/ }).first()], ["Guide d'achat (bande)", page.locator("a", { hasText: /^\s*Guide d'achat\s*$/ }).first()]]) {
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 8000 }); await page.waitForTimeout(300);
      const info = await loc.evaluate((e) => {
        const toHex = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
        const host = e.closest("[class*='badge'],div,span") ; const s = getComputedStyle(e);
        let bg = null, n = e; while (n && n !== document.documentElement) { const b = getComputedStyle(n).backgroundColor; if (b && !/rgba?\(0, 0, 0, 0\)|transparent/.test(b)) { bg = { el: n.tagName.toLowerCase() + "." + String(n.className).split(" ").slice(0, 6).join("."), color: toHex(b), raw: b }; break; } n = n.parentElement; }
        const r = e.getBoundingClientRect(); const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
        const rects = [...e.getClientRects()].length; const txt = e.textContent.replace(/\s+/g, " ").trim();
        return { text: txt, cls: String(e.className), color: toHex(s.color), rawColor: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, whiteSpace: s.whiteSpace, box: { w: Math.round(r.width), h: Math.round(r.height) }, lineHeight: lh, lignes: Math.round(r.height / lh), clientRects: rects, bg, parentCls: String(e.parentElement.className) };
      });
      const png = await loc.screenshot();
      const { PNG } = (() => { try { return require(require.resolve("pngjs", { paths: [process.env.PW] })); } catch { return {}; } })();
      let hist = null;
      if (PNG) { const img = PNG.sync.read(png); const m = new Map(); for (let i = 0; i < img.data.length; i += 4) { const k = "#" + [img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""); m.set(k, (m.get(k) || 0) + 1); } const tot = img.width * img.height; hist = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round((v / tot) * 1000) / 10]); }
      const bgPix = hist ? hist.find(([k]) => k !== info.color)?.[0] : null;
      res[name] = { ...info, pixelsTop5: hist, fondPixel: bgPix, ratioTexteFondCalcule: info.bg ? ratio(info.color, info.bg.color) : null, ratioTexteFondPixel: bgPix ? ratio(info.color, bgPix) : null };
      fs.writeFileSync(out.replace(/\.json$/, `-${name.split(" ")[0].replace(/\W/g, "")}.png`), png);
    } catch (e) { res[name] = { error: String(e.message).split("\n")[0] }; }
  }
  fs.writeFileSync(out, JSON.stringify({ url, viewport: `${W}x${H}`, at: new Date().toISOString(), res }, null, 2));
  for (const [k, v] of Object.entries(res)) console.log(W, k, v.error || `couleur ${v.color} fond calc ${v.bg?.color} (${v.ratioTexteFondCalcule}) fond pixel ${v.fondPixel} (${v.ratioTexteFondPixel}) lignes ${v.lignes} rects ${v.clientRects} box ${v.box.w}x${v.box.h} ws ${v.whiteSpace} top ${JSON.stringify(v.pixelsTop5)}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
