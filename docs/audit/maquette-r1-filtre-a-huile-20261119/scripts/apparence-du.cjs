// Complément n° 3 au mandat DU : revérification indépendante des corrections d'apparence de #2210.
// Mesure directe, sans reprendre les chiffres de DS :
//  1. contraste de chaque texte des cartes véhicule (#reference) : couleur calculée du texte
//     contre le fond réel. Fond lu de deux façons : (a) styles calculés (première couleur de fond
//     opaque en remontant, avec signalement de tout background-image) ; (b) pixels : capture de
//     l'élément, couleur la plus fréquente = fond.
//  2. taille de chaque bouton de la navigation rapide.
//  3. avec prefers-reduced-motion: reduce : animations encore actives (document.getAnimations)
//     et transformation résiduelle après survol des éléments corrigés.
// Usage : node apparence-du.cjs <url> <out.json> <width> <height> [reduce=0|1]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const [, , url, out, W, H, reduceArg = "0"] = process.argv;
const reduce = reduceArg === "1";
(async () => {
  const browser = await chromium.launch();
  const mobile = Number(W) < 800;
  const ctx = await browser.newContext({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.route("**/*", (r) => (["GET", "HEAD"].includes(r.request().method()) && !/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.continue() : r.abort("blockedbyclient")));
  const page = await ctx.newPage();
  const resp = await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(4000);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(100); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  // ---------- 1. Contraste (styles calculés) ----------
  const texts = await page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
    const parse = (c) => { if (!c || c === "transparent") return { r: 0, g: 0, b: 0, a: 0 }; cx.clearRect(0, 0, 1, 1); cx.fillStyle = "rgba(0,0,0,0)"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const root = document.getElementById("reference"); if (!root) return { error: "#reference absent" };
    const res = []; const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; let i = 0;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue.trim(); if (!t) continue;
      const el = n.parentElement; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      // fond : remonter jusqu'à un fond opaque ; noter les background-image traversés
      let bg = null; const layers = []; let images = [];
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.backgroundImage && s.backgroundImage !== "none") images.push(a.className.toString().slice(0, 60) + " :: " + s.backgroundImage.slice(0, 90));
        const c = parse(s.backgroundColor);
        if (c && c.a > 0) { layers.push(c); if (c.a >= 1) { bg = c; break; } }
      }
      bg = bg || { r: 255, g: 255, b: 255, a: 1 };
      for (let k = layers.length - 2; k >= 0; k--) bg = blend(layers[k], bg);
      let fg = parse(cs.color); let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity);
      fg = { ...fg, a: fg.a * op }; const fgb = blend(fg, bg);
      const card = el.closest("a[href]"); const zone = card ? "carte" : el.closest("button") ? "bouton-voir-autres" : (el.closest(".bg-navy") ? "en-tete" : "corps");
      const role = el.closest(".bg-navy.rounded-full") ? "pastille-type" : el.closest(".bg-success") ? "pastille-puissance" : el.closest(".bg-navy.rounded-lg") ? "cta-voir-les-pieces" : zone;
      const key = role + "|" + t.slice(0, 30) + "|" + hex(fgb) + "|" + hex(bg);
      const px = parseFloat(cs.fontSize), w = Number(cs.fontWeight);
      const large = px >= 24 || (px >= 18.66 && w >= 700);
      const item = { idx: i++, role, text: t.slice(0, 50), fg: hex(fgb), bg: hex(bg), ratio: Math.round(ratio(fgb, bg) * 100) / 100, fontPx: px, weight: w, large, seuil: large ? 3 : 4.5, bgImages: images.slice(0, 3) };
      item.ok = item.ratio >= item.seuil;
      el.setAttribute("data-du-idx", String(item.idx));
      if (!seen.has(key)) { seen.add(key); res.push(item); } else res.push({ ...item, dup: true });
    }
    return res;
  });

  // ---------- 1b. Contraste (pixels) : un exemplaire de chaque rôle ----------
  const pixel = [];
  if (Array.isArray(texts)) {
    const byRole = {};
    for (const t of texts) if (!t.dup && !byRole[t.role + t.fg]) byRole[t.role + t.fg] = t;
    for (const t of Object.values(byRole)) {
      const loc = page.locator(`[data-du-idx="${t.idx}"]`);
      try {
        await loc.scrollIntoViewIfNeeded({ timeout: 5000 }); await page.waitForTimeout(150);
        const box = await loc.boundingBox(); if (!box) continue;
        const pad = 2; const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: box.height + 2 * pad };
        const buf = await page.screenshot({ clip, animations: "disabled" });
        const r = await page.evaluate(async ({ b64, fg }) => {
          const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
          const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height).data; const cnt = new Map();
          for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
          const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
          const bg = { r: top >> 16, g: (top >> 8) & 255, b: top & 255 };
          const h = (s) => ({ r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16) });
          const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
          const f = h(fg); const a = lum(f), bb = lum(bg);
          // pire pixel de fond (le plus proche de la couleur du texte parmi les 5 couleurs majoritaires)
          return { bgPixel: "#" + top.toString(16).padStart(6, "0"), ratioPixel: Math.round(((Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05)) * 100) / 100 };
        }, { b64: buf.toString("base64"), fg: t.fg });
        pixel.push({ role: t.role, text: t.text, fg: t.fg, bgCalcule: t.bg, ratioCalcule: t.ratio, ...r });
      } catch (e) { pixel.push({ role: t.role, text: t.text, error: String(e.message).split("\n")[0] }); }
    }
  }

  // ---------- 2. Navigation rapide ----------
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  const nav = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Navigation rapide"] button')].map((b) => { const r = b.getBoundingClientRect(); return { label: b.innerText.trim(), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, aa24: r.width >= 24 && r.height >= 24, vise44: r.width >= 44 && r.height >= 44 }; }));

  // ---------- 3. Mouvement ----------
  const anims = await page.evaluate(() => document.getAnimations().map((a) => {
    const t = a.effect && a.effect.target; const timing = a.effect ? a.effect.getComputedTiming() : {};
    const sec = t && t.closest ? t.closest("section[id], nav, header, footer, aside, [id]") : null;
    return { type: a.constructor.name, name: a.animationName || a.transitionProperty || "", iterations: timing.iterations === Infinity ? "infinite" : timing.iterations, duration: timing.duration, playState: a.playState, zone: sec ? (sec.id ? "#" + sec.id : sec.tagName.toLowerCase()) : "body", el: t ? (t.tagName.toLowerCase() + "." + String(t.className).split(" ").filter((c) => /animate|motion|shimmer|ping|float|pulse|marquee/.test(c)).join(".")).slice(0, 120) : "?" };
  }));
  const hoverTargets = [
    ["nav-rapide-1", 'nav[aria-label="Navigation rapide"] button'],
    ["carte-1", "#reference a[href] >> nth=0"],
    ["bouton-voir-autres", "#reference button:has-text('autres compatibilités')"],
  ];
  const hover = {};
  if (!mobile) {
    for (const [name, sel] of hoverTargets) {
      try {
        const loc = page.locator(sel).first(); await loc.scrollIntoViewIfNeeded({ timeout: 5000 }); await page.mouse.move(0, 0); await page.waitForTimeout(400);
        const before = await loc.evaluate((e) => getComputedStyle(e).transform);
        await loc.hover(); await page.waitForTimeout(700);
        const after = await loc.evaluate((e) => {
          const out = { self: getComputedStyle(e).transform };
          for (const c of e.querySelectorAll("img, .bg-navy.rounded-lg, svg")) { const tr = getComputedStyle(c).transform; if (tr !== "none") out[c.tagName.toLowerCase() + "." + String(c.className.baseVal ?? c.className).split(" ")[0]] = tr; }
          return out;
        });
        hover[name] = { before, after };
      } catch (e) { hover[name] = { error: String(e.message).split("\n")[0] }; }
    }
  }
  await browser.close();
  const fails = Array.isArray(texts) ? texts.filter((t) => !t.ok && !t.dup) : [];
  fs.writeFileSync(out, JSON.stringify({ url, status: resp && resp.status(), viewport: `${W}x${H}`, reducedMotion: reduce, at: new Date().toISOString(), contrasteCalcule: texts, contrastePixels: pixel, navRapide: nav, animations: anims, survol: hover }, null, 2));
  const uniq = Array.isArray(texts) ? texts.filter((t) => !t.dup) : [];
  const roles = {}; for (const t of uniq) { const r = (roles[t.role] ||= { n: 0, min: 99, bgImg: 0 }); r.n++; r.min = Math.min(r.min, t.ratio); if (t.bgImages.length) r.bgImg++; }
  console.log(JSON.stringify({ status: resp && resp.status(), vp: `${W}x${H}`, reduce, roles, echecs: fails.map((f) => [f.role, f.text, f.fg, f.bg, f.ratio]), pixels: pixel.map((p) => [p.role, p.text?.slice(0, 20), p.fg, p.bgPixel, p.ratioPixel, p.ratioCalcule]), nav: nav.map((b) => `${b.label} ${b.w}x${b.h}`), animsInfinite: anims.filter((a) => a.iterations === "infinite").map((a) => `${a.zone} ${a.name} ${a.el}`), hover }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
