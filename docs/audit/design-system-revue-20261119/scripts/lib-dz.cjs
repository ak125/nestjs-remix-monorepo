// Mandat DZ — outils communs (côté Node et côté page).
// Repris de DU (#2211, tête aef4cda090e1, scripts/apparence-du.cjs) : la lecture des couleurs par
// canvas 1×1, la luminance relative WCAG, le mélange alpha et la remontée des fonds opaques.
// Ajouté par DZ : sélecteur court, zone (en-tête, pied, barre mobile, sélecteur véhicule, chat),
// interception qui abandonne toute requête non GET/HEAD et la journalise.
const { chromium } = require(process.env.PW || "/opt/automecanik/app/node_modules/playwright");

const BASE = process.env.DZ_BASE || "http://127.0.0.1:3000";
// UA de Chrome ordinaire : root.tsx (BOT_UA_PATTERN) traite « headless » comme un robot.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const UA_MOBILE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const TRACKERS = /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar|analytics\.google/;

function cleanUrl(u) {
  try { const x = new URL(u); return x.origin + x.pathname + (x.search ? "?" + [...x.searchParams.keys()].join("&") : ""); } catch { return String(u).slice(0, 120); }
}

async function newContext(browser, { width, height, reducedMotion = "no-preference", colorScheme = "light", dsf = 1, aborted }) {
  const mobile = width < 800;
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? UA_MOBILE : UA, reducedMotion, colorScheme, locale: "fr-FR",
  });
  await ctx.route("**/*", (route) => {
    const r = route.request();
    const m = r.method();
    if (!["GET", "HEAD"].includes(m)) { aborted.push({ method: m, url: cleanUrl(r.url()), raison: "non GET" }); return route.abort("blockedbyclient"); }
    if (TRACKERS.test(r.url())) { aborted.push({ method: m, url: cleanUrl(r.url()), raison: "traceur tiers" }); return route.abort("blockedbyclient"); }
    return route.continue();
  });
  // navigator.sendBeacon passe aussi par le réseau (POST) : il est donc abandonné par la route ci-dessus.
  await ctx.addInitScript({ content: PAGE_HELPERS });
  return ctx;
}

// Code injecté dans chaque page : window.__dz
const PAGE_HELPERS = String.raw`
(() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  let cx = null;
  const parse = (c) => {
    if (!c || c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    cx = cx || cv.getContext("2d", { willReadFrequently: true });
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = "rgba(0,0,0,0)"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    // fillRect pré-multiplie : on relit la couleur exacte quand elle est opaque, sinon on reprend l'alpha de la chaîne
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); if (p.length >= 3 && p.every((v) => !Number.isNaN(v))) return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const r2 = (v) => Math.round(v * 100) / 100;
  // Fond peint derrière un élément (styles calculés) : remonte les ancêtres jusqu'à un fond opaque,
  // mélange les couches semi-transparentes, signale images/dégradés/filtres rencontrés.
  const bgOf = (el, startAtParent) => {
    const layers = []; const images = []; let bg = null; let blur = false;
    for (let a = startAtParent ? el.parentElement : el; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.backgroundImage && s.backgroundImage !== "none") images.push((a.tagName.toLowerCase() + "." + String(a.className.baseVal ?? a.className).split(" ").slice(0, 3).join(".")).slice(0, 80) + " :: " + s.backgroundImage.slice(0, 80));
      if (s.backdropFilter && s.backdropFilter !== "none") blur = true;
      const c = parse(s.backgroundColor);
      if (c.a > 0) { layers.push(c); if (c.a >= 1) { bg = c; break; } }
    }
    let out = bg || { r: 255, g: 255, b: 255, a: 1 };
    for (let k = (bg ? layers.length - 2 : layers.length - 1); k >= 0; k--) out = blend(layers[k], out);
    return { color: out, images, translucide: layers.some((l) => l.a < 1), blur };
  };
  const opacityChain = (el) => { let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity); return op; };
  const cls = (e) => String(e.className && (e.className.baseVal ?? e.className)).split(/\s+/).filter(Boolean);
  const sel = (el) => {
    const parts = [];
    for (let a = el, i = 0; a && a.nodeType === 1 && i < 4; a = a.parentElement, i++) {
      if (a.id) { parts.unshift(a.tagName.toLowerCase() + "#" + a.id); break; }
      const al = a.getAttribute("aria-label");
      let p = a.tagName.toLowerCase();
      if (al && i > 0) p += '[aria-label="' + al.slice(0, 40) + '"]';
      else { const c = cls(a).filter((x) => !/[:\[\]\/]/.test(x)).slice(0, 2); if (c.length) p += "." + c.join("."); }
      parts.unshift(p);
      if (a.tagName === "BODY") break;
    }
    return parts.join(" > ");
  };
  const zone = (el) => {
    if (!el || !el.closest) return "?";
    if (el.closest('nav[aria-label="Navigation mobile"]')) return "barre-mobile";
    if (el.closest("footer")) return "pied-de-page";
    if (el.closest('[data-dz-chat], [class*="chat-widget"], [aria-label*="chat" i], [aria-label*="assistant" i]')) return "chat";
    const vs = el.closest("[data-nosnippet][data-noindex]"); if (vs && vs.querySelector('select[aria-label="Marque"], select[aria-label*="marque" i]')) return "selecteur-vehicule";
    if (el.closest('header, nav[aria-label="Navigation principale"]')) return "en-tete";
    const s = el.closest("section[id], main [id]");
    return "contenu" + (s && s.id ? "#" + s.id : "");
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") return false;
    if (opacityChain(el) < 0.05) return false;
    if (r.right <= 0 || r.left >= document.documentElement.clientWidth) return false;
    // sr-only : clip rect(0,0,0,0) ou 1×1
    if ((cs.clip && cs.clip.startsWith("rect(0")) || (cs.clipPath && cs.clipPath.includes("inset(50%"))) return false;
    for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflow === "hidden" && (a.getBoundingClientRect().width <= 1 || a.getBoundingClientRect().height <= 1)) return false; }
    return true;
  };
  const fixedAncestor = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === "fixed" || p === "sticky") return a; } return null; };
  // texte rogné : centre du rectangle texte hors de la fenêtre, ou hors du cadre d'un ancêtre qui masque son débordement (carrousel)
  const clippedBy = (el, r) => {
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    if (cx < 0 || cy < 0 || cx > document.documentElement.clientWidth || cy > window.innerHeight) return "hors de la fenêtre";
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(s.overflowX + " " + s.overflowY)) { const b = a.getBoundingClientRect(); if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) return sel(a); } }
    return null;
  };
  window.__dz = { parse, lum, blend, ratio, hex, r2, bgOf, opacityChain, sel, zone, visible, cls, fixedAncestor, clippedBy };
  // LCP et CLS de labo
  window.__dzPerf = { lcp: null, cls: 0, shifts: [] };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__dzPerf.lcp = e; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__dzPerf.cls += e.value; window.__dzPerf.shifts.push({ t: Math.round(e.startTime), v: e.value, src: (e.sources || []).slice(0, 3).map((s) => s.node && s.node.nodeType === 1 ? window.__dz.sel(s.node) : "#text") }); } }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {}
})();
`;

async function settle(page, ms = 4000) { await page.waitForTimeout(ms); }
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, 40000); y += 700) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y); await page.waitForTimeout(110); }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(1200);
}

module.exports = { chromium, BASE, newContext, settle, scrollThrough, cleanUrl };
