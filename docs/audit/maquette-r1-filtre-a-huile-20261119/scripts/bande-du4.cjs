// Complément n° 4 au mandat DU : contraste au pixel de chaque texte de la bande sous le hero
// (réassurance + liens utiles), où une ombre portée assombrit le fond. Fond = couleur de pixel
// la plus fréquente et la plus sombre du cadre de l'élément (hors couleur du texte).
// Usage : node bande-du4.cjs <url> <width> <height>
const { chromium } = require(process.env.PW || "playwright");
const [, , url, W, H] = process.argv;
(async () => {
  const b = await chromium.launch(); const mobile = +W < 800;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const band = p.locator("div.py-4.bg-slate-50.border-b").first();
  await band.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await p.waitForTimeout(300);
  const items = await band.evaluate((root) => { const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n, i = 0; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement; el.setAttribute("data-b4", i); out.push({ i: i++, text: t, color: getComputedStyle(el).color, px: parseFloat(getComputedStyle(el).fontSize) }); } return out; });
  const res = [];
  for (const it of items) {
    const loc = p.locator(`[data-b4="${it.i}"]`); const box = await loc.boundingBox(); if (!box) continue;
    const buf = await p.screenshot({ clip: { x: box.x - 3, y: box.y - 3, width: box.width + 6, height: box.height + 6 } });
    res.push({ text: it.text, px: it.px, ...(await p.evaluate(async ({ b64, color }) => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d"); cx.fillStyle = color; cx.fillRect(0, 0, 1, 1); const f = cx.getImageData(0, 0, 1, 1).data;
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
      const lum = (r, g, b) => { const q = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * q(r) + 0.7152 * q(g) + 0.0722 * q(b); };
      const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
      const tot = d.length / 4; const bgs = [...m.entries()].filter(([, n]) => n > tot * 0.03).map(([k]) => k);
      const lf = lum(f[0], f[1], f[2]); const ratios = bgs.map((k) => { const l = lum(k >> 16, (k >> 8) & 255, k & 255); return [(Math.max(l, lf) + 0.05) / (Math.min(l, lf) + 0.05), "#" + k.toString(16).padStart(6, "0")]; }).sort((a, b) => a[0] - b[0]);
      return { fg: "#" + [f[0], f[1], f[2]].map((v) => v.toString(16).padStart(2, "0")).join(""), pireFond: ratios[0][1], ratioPire: Math.round(ratios[0][0] * 100) / 100 };
    }, { b64: buf.toString("base64"), color: it.color })) });
  }
  console.log(W + "x" + H, JSON.stringify(res.map((r) => [r.text.slice(0, 22), r.fg, r.pireFond, r.ratioPire])));
  await b.close();
})();
