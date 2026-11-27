// Complément n° 4 au mandat DS : contraste mesuré au pixel (méthode du mandat DU, complément n° 4)
// pour les quatre zones R1 qu'axe classe « incomplete » : fil d'Ariane du hero, onglet « Type Mine »,
// badge « 2 min », bande réassurance + liens utiles sous le hero. À 390×844 et 1440×900, DPR 2,
// prefers-reduced-motion: reduce. Écrit <label>-contraste.json et une capture par zone.
//
// Méthode, pour chaque nœud texte visible de la zone :
//  - cadre = rectangle du texte seul (Range.getBoundingClientRect), élargi de 3 px ;
//  - couleur du texte = couleur calculée de l'élément, alpha et opacités des ancêtres composés
//    sur chaque couleur de fond candidate ;
//  - fonds candidats = couleurs de pixel couvrant plus de 3 % du cadre ; on retient le pire rapport
//    (rapports ≤ 1,05 écartés : ce sont les pixels du texte lui-même).
// Usage : node contraste-c4.cjs <baseUrl> <label> <outDir>
// GET seulement ; écritures et suivi analytique bloqués.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const [, , base, label, outDir] = process.argv;

// Marque (data-c4-zone) chaque zone dans la page ; renvoie les zones trouvées.
function markZones() {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const found = [];
  const h1 = document.querySelector("h1");
  const hero = h1 && h1.closest("section");
  const crumb = hero && [...hero.querySelectorAll("nav")].find((n) => n.querySelector('a[href="/"]'));
  if (crumb) { crumb.setAttribute("data-c4-zone", "fil-ariane"); found.push("fil-ariane"); }
  const tab = [...document.querySelectorAll("button")].find((b) => /Type Mine/.test(b.textContent) && vis(b));
  const tabs = tab && (tab.closest("[role=tablist]") || tab.parentElement);
  if (tabs) { tabs.setAttribute("data-c4-zone", "onglet-type-mine"); found.push("onglet-type-mine"); }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, badge = null;
  while ((n = w.nextNode())) if (n.nodeValue.trim() === "2 min" && vis(n.parentElement)) { badge = n.parentElement; break; }
  const badgeRow = badge && badge.closest("span.rounded-full") && badge.closest("span.rounded-full").parentElement;
  if (badgeRow) { badgeRow.setAttribute("data-c4-zone", "badge-2-min"); found.push("badge-2-min"); }
  const band = document.querySelector("div.py-4.bg-slate-50.border-b");
  if (band) { band.setAttribute("data-c4-zone", "bande-sous-hero"); found.push("bande-sous-hero"); }
  return found;
}

// Liste les nœuds texte d'une zone (élément porteur marqué data-c4-t) avec leur style.
function listTexts(zone) {
  const root = document.querySelector(`[data-c4-zone="${zone}"]`);
  const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n, i = 0;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.trim(); if (!t) continue;
    const el = n.parentElement; const s = getComputedStyle(el);
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    if (!r.width || s.visibility === "hidden" || s.display === "none") continue;
    let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity);
    const tops = new Set([...rg.getClientRects()].map((q) => Math.round(q.top)));
    const id = `${zone}-${i++}`;
    out.push({ id, text: t.slice(0, 40), color: s.color, op, px: parseFloat(s.fontSize), weight: Number(s.fontWeight), lignes: tops.size,
      cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 160),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height } });
  }
  return out;
}

async function worstRatio(page, png, color, op) {
  return page.evaluate(async ({ b64, color, op }) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d");
    cx.fillStyle = color; cx.fillRect(0, 0, 1, 1); const f = cx.getImageData(0, 0, 1, 1).data; const fa = (f[3] / 255) * op;
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const lum = (r, g, b) => { const q = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * q(r) + 0.7152 * q(g) + 0.0722 * q(b); };
    const hx = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); }
    const tot = d.length / 4;
    const rows = [...m.entries()].filter(([, n]) => n > tot * 0.03).map(([k]) => {
      const br = k >> 16, bg = (k >> 8) & 255, bb = k & 255;
      const fr = f[0] * fa + br * (1 - fa), fg = f[1] * fa + bg * (1 - fa), fb = f[2] * fa + bb * (1 - fa);
      const l1 = lum(fr, fg, fb), l2 = lum(br, bg, bb);
      return { texte: hx(fr, fg, fb), fond: hx(br, bg, bb), ratio: Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100 };
    }).filter((r) => r.ratio > 1.05).sort((a, b) => a.ratio - b.ratio);
    return rows[0] || { ratio: null };
  }, { b64: png.toString("base64"), color, op });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, label, at: new Date().toISOString(), methode: "pixel, pire fond > 3 % du cadre du texte, DPR 2, reduced-motion", vues: {} };
  for (const vp of [{ n: "390x844", w: 390, h: 844, m: true }, { n: "1440x900", w: 1440, h: 900, m: false }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
    await ctx.route("**/*", (route) => {
      const r = route.request();
      if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(3000);
    const zones = await page.evaluate(markZones);
    const vue = (report.vues[vp.n] = {});
    for (const zone of ["fil-ariane", "onglet-type-mine", "badge-2-min", "bande-sous-hero"]) {
      if (!zones.includes(zone)) { vue[zone] = "introuvable"; continue; }
      const loc = page.locator(`[data-c4-zone="${zone}"]`);
      await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(400);
      await loc.screenshot({ path: path.join(outDir, `${label}-${zone}-${vp.n.split("x")[0]}.png`) });
      const texts = await page.evaluate(listTexts, zone);
      const rows = [];
      for (const t of texts) {
        const png = await page.screenshot({ clip: { x: Math.max(0, t.rect.x - 3), y: Math.max(0, t.rect.y - 3), width: t.rect.w + 6, height: t.rect.h + 6 } });
        const r = await worstRatio(page, png, t.color, t.op);
        const seuil = t.px >= 24 || (t.px >= 18.66 && t.weight >= 700) ? 3 : 4.5;
        rows.push({ text: t.text, px: t.px, lignes: t.lignes, couleurCalculee: t.color, ...r, seuil, verdict: r.ratio !== null && r.ratio >= seuil ? "ok" : "ÉCHEC", cls: t.cls });
      }
      vue[zone] = rows;
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-contraste.json`), JSON.stringify(report, null, 2));
  for (const [v, zs] of Object.entries(report.vues)) {
    console.log(`== ${label} ${v}`);
    for (const [z, rows] of Object.entries(zs)) {
      if (!Array.isArray(rows)) { console.log(`  ${z}: ${rows}`); continue; }
      for (const r of rows) console.log(`  ${z.padEnd(17)} ${r.verdict.padEnd(5)} ${String(r.ratio).padEnd(6)} ${r.texte} sur ${r.fond} | ${r.px}px ${r.lignes}l | ${r.text} | ${r.couleurCalculee}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
