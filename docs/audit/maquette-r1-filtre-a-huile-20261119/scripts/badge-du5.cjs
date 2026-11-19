// Complément n° 5 au mandat DU : texte « 2 min » du badge — couleur calculée du nœud qui porte le
// texte, fond opaque, nombre de lignes réelles (Range.getClientRects groupés par ordonnée),
// et contraste au pixel (capture du badge, couleur majoritaire hors texte).
// Usage : node badge-du5.cjs <url> <width> <height> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [, , url, W, H, out] = process.argv;
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.floor(((x + 0.05) / (y + 0.05)) * 100) / 100; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const handle = await page.evaluateHandle(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.textContent.trim() === "2 min") return n.parentElement; return null; });
  await handle.asElement().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const info = await handle.evaluate((e) => {
    const toHex = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    const tn = [...e.childNodes].find((c) => c.nodeType === 3 && c.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn); // nœud texte seul : l'icône horloge a sa propre ordonnée
    const tops = [...new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))];
    let bg = null, n = e; while (n) { const b = getComputedStyle(n).backgroundColor; if (b && !/rgba?\(0, 0, 0, 0\)|transparent/.test(b)) { bg = toHex(b); break; } n = n.parentElement; }
    const badge = e.closest("[class*='rounded']") || e.parentElement; const br = badge.getBoundingClientRect();
    return { text: e.textContent.trim(), cls: String(e.className), badgeCls: String(badge.className), color: toHex(getComputedStyle(e).color), fontSize: getComputedStyle(e).fontSize, fontWeight: getComputedStyle(e).fontWeight, lignesTexte: tops.length, badgeBox: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) }, badgeWhiteSpace: getComputedStyle(badge).whiteSpace, bg, hasTextNode: !!tn };
  });
  const png = await page.screenshot({ clip: { x: info.badgeBox.x, y: info.badgeBox.y, width: info.badgeBox.w, height: info.badgeBox.h } });
  fs.writeFileSync(out.replace(/\.json$/, ".png"), png);
  const img = PNG.sync.read(png); const m = new Map(); for (let i = 0; i < img.data.length; i += 4) { const k = "#" + [img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""); m.set(k, (m.get(k) || 0) + 1); }
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round((v / (img.width * img.height)) * 1000) / 10]);
  const fondPixel = top.find(([k]) => k !== info.color)[0];
  const res = { url, viewport: `${W}x${H}`, at: new Date().toISOString(), ...info, pixelsTop5: top, fondPixel, ratioCalcule: ratio(info.color, info.bg), ratioPixel: ratio(info.color, fondPixel) };
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log(W, `texte « ${res.text} » ${res.color} ${res.fontSize}/${res.fontWeight} fond ${res.bg} → ${res.ratioCalcule} ; pixel ${res.fondPixel} → ${res.ratioPixel} ; lignes ${res.lignesTexte} ; badge ${res.badgeBox.w}x${res.badgeBox.h} ws=${res.badgeWhiteSpace}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
