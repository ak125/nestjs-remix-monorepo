// Complément n° 4 au mandat DU : revérification de la page R1 entière, mesure directe.
//  1. axe-core (WCAG 2.0/2.1/2.2 A+AA + best-practice) : violations par règle, chaque nœud
//     color-contrast localisé (zone R1, pied de page, barre mobile du bas, en-tête du site).
//  2. Contraste direct des textes portant les jetons changés (text-neutral-400, text-cta-700,
//     text-success) hors pied de page et barre mobile : couleur calculée + pixels.
//  3. Cibles sous 24 px (2.5.8) : taille, contexte (dans une phrase, masquée, espacement).
//  4. Avec reducedMotion=reduce : animations actives (document.getAnimations), boucles,
//     défilement de la navigation rapide (position 60 ms et 1,5 s après le clic).
// Usage : node page-du4.cjs <url> <out.json> <width> <height> [reduce=0|1]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const { default: AxeBuilder } = require(process.env.AXE || "@axe-core/playwright");
const [, , url, out, W, H, reduceArg = "1"] = process.argv;
const reduce = reduceArg === "1";
const ZONE = `(el) => {
  if (!el) return "?";
  if (el.closest('nav[aria-label="Navigation mobile"]')) return "GLOBAL barre mobile du bas";
  if (el.closest("footer")) return "GLOBAL pied de page";
  const hdr = el.closest("header"); if (hdr && !el.closest("main")) return "GLOBAL en-tête du site";
  const s = el.closest("section[id], nav[aria-label], aside, main > div[id]");
  return "R1 " + (s ? (s.id ? "#" + s.id : s.tagName.toLowerCase() + (s.getAttribute("aria-label") ? "[" + s.getAttribute("aria-label") + "]" : "")) : (el.closest("main") ? "main" : "body"));
}`;
(async () => {
  const browser = await chromium.launch();
  const mobile = Number(W) < 800;
  const ctx = await browser.newContext({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.route("**/*", (r) => (["GET", "HEAD"].includes(r.request().method()) && !/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.continue() : r.abort("blockedbyclient")));
  const page = await ctx.newPage();
  const resp = await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3000);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y); await page.waitForTimeout(110); }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1500);
  await page.evaluate(`window.__zone = ${ZONE}`);

  // ---------- 1. axe ----------
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  const violations = [];
  for (const v of axe.violations) {
    const nodes = [];
    for (const n of v.nodes) {
      const target = n.target.join(" ");
      const info = await page.evaluate((t) => { try { const el = document.querySelector(t); return { zone: window.__zone(el), text: el ? (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 50) : "?" }; } catch { return { zone: "?", text: "?" }; } }, target);
      const d = n.any?.[0]?.data;
      nodes.push({ target: target.slice(0, 140), ...info, data: d && d.fgColor ? { fg: d.fgColor, bg: d.bgColor, ratio: d.contrastRatio, size: d.fontSize } : undefined });
    }
    violations.push({ id: v.id, impact: v.impact, count: v.nodes.length, nodes });
  }
  const ccIncomplete = (axe.incomplete.find((v) => v.id === "color-contrast") || { nodes: [] }).nodes.length;

  // ---------- 2. Contraste direct des textes aux jetons changés ----------
  const direct = await page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
    const parse = (c) => { if (!c || c === "transparent") return { r: 0, g: 0, b: 0, a: 0 }; cx.clearRect(0, 0, 1, 1); cx.fillStyle = "rgba(0,0,0,0)"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const res = []; let i = 0;
    for (const el of document.querySelectorAll(".text-neutral-400, .text-cta-700, .text-success")) {
      if (el.closest("footer, nav[aria-label='Navigation mobile']")) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim(); if (!t) continue;
      let bg = null; const layers = []; const images = [];
      for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.backgroundImage !== "none") images.push(s.backgroundImage.slice(0, 60)); const c = parse(s.backgroundColor); if (c.a > 0) { layers.push(c); if (c.a >= 1) { bg = c; break; } } }
      bg = bg || { r: 255, g: 255, b: 255, a: 1 }; for (let k = layers.length - 2; k >= 0; k--) bg = blend(layers[k], bg);
      let fg = parse(cs.color); let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity);
      const fgb = blend({ ...fg, a: fg.a * op }, bg);
      const tok = [...el.classList].find((c) => /^text-(neutral-400|cta-700|success)$/.test(c));
      el.setAttribute("data-du4", String(i));
      res.push({ idx: i++, zone: window.__zone(el), token: tok, text: t.slice(0, 50), fontPx: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), fg: hex(fgb), bg: hex(bg), ratio: Math.round(ratio(fgb, bg) * 100) / 100, bgImages: images });
    }
    return res;
  });
  for (const t of direct) {
    try {
      const loc = page.locator(`[data-du4="${t.idx}"]`);
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 }); await page.waitForTimeout(120);
      const box = await loc.boundingBox(); if (!box) continue;
      const buf = await page.screenshot({ clip: { x: Math.max(0, box.x - 2), y: Math.max(0, box.y - 2), width: box.width + 4, height: box.height + 4 }, animations: "disabled" });
      Object.assign(t, await page.evaluate(async ({ b64, fg }) => {
        const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data; const cnt = new Map();
        for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
        const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const h = (s) => ({ r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16) });
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const a = lum(h(fg)), bb = lum({ r: top >> 16, g: (top >> 8) & 255, b: top & 255 });
        return { bgPixel: "#" + top.toString(16).padStart(6, "0"), ratioPixel: Math.round(((Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05)) * 100) / 100 };
      }, { b64: buf.toString("base64"), fg: t.fg }));
    } catch (e) { t.pixelError = String(e.message).split("\n")[0]; }
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(500);

  // ---------- 3. Cibles ----------
  const targets = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a[href], button, [role=button], [role=tab], input:not([type=hidden]), select, summary")].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return s.display !== "none" && s.visibility !== "hidden" && (r.width || r.height); });
    const rects = all.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + scrollY }; });
    const res = { sous24: [], de24a44: 0, total: all.length };
    all.forEach((e, i) => {
      const r = e.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 24) { if (r.width < 44 || r.height < 44) res.de24a44++; return; }
      const p = e.parentElement; const block = e.closest("p, li, dd, td, figcaption") || p;
      const txt = (block.textContent || "").replace(/\s+/g, " ").trim(); const own = (e.textContent || "").replace(/\s+/g, " ").trim();
      const inline = getComputedStyle(e).display.startsWith("inline") && !getComputedStyle(e).display.includes("flex") && txt.length > own.length + 15;
      const s = getComputedStyle(e); const srOnly = e.classList.contains("sr-only") || (r.width <= 1 && r.height <= 1);
      // exception d'espacement : cercle de 24 px centré sur la cible, sans croiser celui d'une autre cible
      let minDist = Infinity; rects.forEach((o, j) => { if (j !== i) minDist = Math.min(minDist, Math.hypot(o.x - rects[i].x, o.y - rects[i].y)); });
      res.sous24.push({ zone: window.__zone(e), tag: e.tagName.toLowerCase(), text: (own || e.getAttribute("aria-label") || "").slice(0, 50), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, display: s.display, dansUnePhrase: inline, phrase: inline ? txt.slice(0, 90) : undefined, srOnly, classes: String(e.className).slice(0, 80), distanceCentreVoisin: Math.round(minDist) });
    });
    return res;
  });

  // ---------- 4. Mouvement ----------
  const anims = await page.evaluate(() => document.getAnimations().map((a) => {
    const t = a.effect && a.effect.target; const tm = a.effect ? a.effect.getComputedTiming() : {};
    return { type: a.constructor.name, name: a.animationName || a.transitionProperty || "", iterations: tm.iterations === Infinity ? "infinite" : tm.iterations, duration: tm.duration, playState: a.playState, zone: t ? window.__zone(t) : "?", el: t ? t.tagName.toLowerCase() + " " + String(t.className.baseVal ?? t.className).split(" ").filter((c) => /animate|motion/.test(c)).join(" ") : "" };
  }));
  const loops = anims.filter((a) => a.iterations === "infinite" && a.playState === "running");
  const htmlScrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  let scroll = null;
  try {
    const btn = page.locator('nav[aria-label="Navigation rapide"] button').last();
    const label = (await btn.innerText()).trim();
    await btn.scrollIntoViewIfNeeded(); const y0 = await page.evaluate(() => scrollY);
    await btn.click(); await page.waitForTimeout(60); const y60 = await page.evaluate(() => scrollY);
    await page.waitForTimeout(1500); const y1500 = await page.evaluate(() => scrollY);
    scroll = { bouton: label, y0, y60, y1500, instantane: Math.abs(y60 - y1500) < 2 };
  } catch (e) { scroll = { error: String(e.message).split("\n")[0] }; }

  await browser.close();
  const result = { url, status: resp && resp.status(), viewport: `${W}x${H}`, reducedMotion: reduce, axe: axe.testEngine.version, at: new Date().toISOString(), violations, colorContrastIncomplete: ccIncomplete, contrasteDirect: direct, cibles: targets, animations: anims, boucles: loops, htmlScrollBehavior, defilementNavRapide: scroll };
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  const cc = violations.find((v) => v.id === "color-contrast");
  const ccz = {}; for (const n of cc ? cc.nodes : []) ccz[n.zone] = (ccz[n.zone] || 0) + 1;
  console.log(JSON.stringify({ status: result.status, vp: result.viewport, reduce, axe: violations.map((v) => [v.id, v.count]), ccZones: ccz, ccIncomplete, direct: direct.map((t) => [t.zone, t.token, t.text.slice(0, 22), t.fg, t.bg, t.ratio, t.ratioPixel, t.fontPx]), sous24: targets.sous24.map((t) => [t.zone, t.text.slice(0, 25), t.w + "x" + t.h, t.dansUnePhrase, t.srOnly, t.distanceCentreVoisin]), de24a44: targets.de24a44, boucles: loops.map((a) => [a.zone, a.name, a.el]), autresAnims: anims.filter((a) => a.iterations !== "infinite").length, htmlScrollBehavior, scroll }, null, 0));
})().catch((e) => { console.error(e); process.exit(1); });
