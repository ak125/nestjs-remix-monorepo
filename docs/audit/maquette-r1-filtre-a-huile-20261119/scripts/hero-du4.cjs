// Complément n° 4 au mandat DU : contraste au pixel des textes du hero R1 (fond navy en dégradé
// ou image, qu'axe classe « incomplete »). Couleur du texte = couleur calculée composée (alpha et
// opacité) sur la couleur de fond de pixel ; fond retenu = la couleur de pixel (>3 % du cadre)
// qui donne le plus faible rapport. Usage : node hero-du4.cjs <url> <width> <height>
const { chromium } = require(process.env.PW || "playwright");
const [, , url, W, H] = process.argv;
(async () => {
  const b = await chromium.launch(); const mobile = +W < 800;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const items = await p.evaluate(() => {
    const h1 = document.querySelector("h1"); const hero = h1.closest("section") || h1.parentElement.parentElement;
    const out = []; const w = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT); let n, i = 0;
    while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); if (!r.width || s.display === "none" || s.visibility === "hidden") continue; if (el.closest("select, option")) continue;
      let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity);
      el.setAttribute("data-h4", i); out.push({ i: i++, text: t.slice(0, 40), color: s.color, op, px: parseFloat(s.fontSize), weight: Number(s.fontWeight), cls: String(el.className).match(/text-(white|slate|blue|neutral)[^ ]*/g) }); }
    return out;
  });
  const res = [];
  for (const it of items) {
    const loc = p.locator(`[data-h4="${it.i}"]`); const box = await loc.boundingBox(); if (!box || box.y > +H * 1.5) continue;
    const buf = await p.screenshot({ clip: { x: Math.max(0, box.x - 3), y: Math.max(0, box.y - 3), width: box.width + 6, height: box.height + 6 } });
    res.push({ ...it, ...(await p.evaluate(async ({ b64, color, op }) => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d"); cx.fillStyle = color; cx.fillRect(0, 0, 1, 1); const f = cx.getImageData(0, 0, 1, 1).data; const fa = (f[3] / 255) * op;
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
      const lum = (r, g, b) => { const q = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * q(r) + 0.7152 * q(g) + 0.0722 * q(b); };
      const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
      const tot = d.length / 4; const hx = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      const rows = [...m.entries()].filter(([, n]) => n > tot * 0.03).map(([k]) => { const br = k >> 16, bg = (k >> 8) & 255, bb = k & 255; const fr = f[0] * fa + br * (1 - fa), fg = f[1] * fa + bg * (1 - fa), fb = f[2] * fa + bb * (1 - fa); const l1 = lum(fr, fg, fb), l2 = lum(br, bg, bb); return { fond: hx(br, bg, bb), texte: hx(fr, fg, fb), ratio: Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100 }; }).filter((r) => r.ratio > 1.05).sort((a, b) => a.ratio - b.ratio);
      return rows[0] || { ratio: null };
    }, { b64: buf.toString("base64"), color: it.color, op: it.op })) });
  }
  const seuil = (r) => (r.px >= 24 || (r.px >= 18.66 && r.weight >= 700) ? 3 : 4.5);
  console.log(W + "x" + H, JSON.stringify(res.map((r) => [r.text.slice(0, 26), (r.cls || []).join(" "), r.texte, r.fond, r.ratio, r.ratio !== null && r.ratio < seuil(r) ? "ÉCHEC" : "ok"])));
  await b.close();
})();
