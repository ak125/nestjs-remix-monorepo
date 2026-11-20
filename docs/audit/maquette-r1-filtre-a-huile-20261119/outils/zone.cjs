// Complément n° 2 au mandat DS : zone touchée (navigation rapide, cartes véhicule) de la page R1.
// Usage : node zone.cjs <baseUrl> <label> <outDir>
// GET seulement ; écritures et suivi analytique bloqués. Mesure :
//  - taille des cibles de la navigation rapide (getBoundingClientRect) ;
//  - contraste minimal du texte des cartes : texte rendu transparent, fond réel capturé,
//    contraste calculé pixel par pixel sous les boîtes du texte (WCAG 2.x, alpha composé), pire pixel retenu ;
//  - mouvement : animation de l'en-tête et transformations au survol, avec et sans reduced-motion.
const path = require("node:path");
const fs = require("node:fs");
const W = "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const sharp = require(path.join(W, "node_modules/sharp"));

const [, , base, label, outDir] = process.argv;
const URL_PATH = "/pieces/filtre-a-huile-7.html";
const VIEWPORTS = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "1440", width: 1440, height: 900, mobile: false },
];

const lum = (r, g, b) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function newCtx(browser, vp, reducedMotion) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion,
    userAgent: (vp.mobile ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" : "Mozilla/5.0 (X11; Linux x86_64)") + " mandat-ds-capture",
  });
  await ctx.route("**/*", (route) => {
    const r = route.request();
    if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
    return route.continue();
  });
  return ctx;
}

async function load(page) {
  await page.goto(base + URL_PATH, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important}" });
  await page.waitForSelector("#reference a[href*='/pieces/']", { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function toWebp(png, dest) {
  await sharp(png).webp({ quality: 80 }).toFile(dest);
  fs.unlinkSync(png);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, label, at: new Date().toISOString(), viewports: {}, motion: {} };

  for (const vp of VIEWPORTS) {
    const ctx = await newCtx(browser, vp, "no-preference");
    const page = await ctx.newPage();
    await load(page);
    const dpr = vp.mobile ? 2 : 1;

    // 1. Navigation rapide : cibles
    const nav = page.locator('nav[aria-label="Navigation rapide"]');
    const targets = await nav.evaluate((n) => [...n.querySelectorAll("a,button")].map((b) => {
      const r = b.getBoundingClientRect();
      return { tag: b.tagName.toLowerCase(), text: b.textContent.trim(), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
    }));
    await nav.scrollIntoViewIfNeeded();
    await nav.screenshot({ path: path.join(outDir, `${label}-nav-${vp.name}.png`) });
    await toWebp(path.join(outDir, `${label}-nav-${vp.name}.png`), path.join(outDir, `${label}-nav-${vp.name}.webp`));

    // 2. Cartes véhicule : capture de la zone (en-tête + premières cartes)
    const sec = page.locator("#reference section").first();
    await sec.scrollIntoViewIfNeeded();
    const box = await sec.boundingBox();
    const scrollY = await page.evaluate(() => window.scrollY);
    const clipH = Math.min(box.height, vp.mobile ? 1300 : 900);
    await page.screenshot({ path: path.join(outDir, `${label}-cartes-${vp.name}.png`), fullPage: true,
      clip: { x: box.x, y: box.y + scrollY, width: box.width, height: clipH } });
    await toWebp(path.join(outDir, `${label}-cartes-${vp.name}.png`), path.join(outDir, `${label}-cartes-${vp.name}.webp`));

    // 3. Contraste : repère des éléments porteurs de texte dans la section
    const names = await page.evaluate(() => {
      const s = document.querySelector("#reference section");
      const out = [];
      const tag = (el, name) => { if (el) { el.setAttribute("data-c2", name); out.push(name); } };
      const head = s.firstElementChild;
      tag(head.querySelector("p"), "en-tete-intro");
      tag([...head.querySelectorAll("span")].find((x) => /motorisations/.test(x.textContent))?.parentElement, "en-tete-compteur");
      const cards = [...s.querySelectorAll("a[href]")].filter((a) => /Voir les pièces/.test(a.textContent)).slice(0, 2);
      cards.forEach((c, i) => {
        const pills = c.querySelectorAll("h3 + div > div");
        tag(pills[0], `carte${i + 1}-pastille-moteur`);
        tag(pills[1], `carte${i + 1}-pastille-puissance`);
        tag([...c.querySelectorAll("span")].find((x) => x.textContent.trim() === "Voir les pièces")?.parentElement, `carte${i + 1}-bouton-voir-les-pieces`);
      });
      tag([...s.querySelectorAll("button")].find((b) => /autres compatibilités/.test(b.textContent)), "bouton-autres-compatibilites");
      return out;
    });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    const contrast = [];
    for (const name of names) {
      const el = page.locator(`[data-c2="${name}"]`);
      await el.scrollIntoViewIfNeeded();
      // couleurs réelles du texte (toutes les feuilles de texte), normalisées en RGBA par un canvas
      const textColors = await el.evaluate((e) => {
        const cv = document.createElement("canvas"); cv.width = cv.height = 1;
        const g = cv.getContext("2d", { willReadFrequently: true });
        const rgba = (c) => { g.clearRect(0, 0, 1, 1); g.fillStyle = "#000"; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
        const els = [e, ...e.querySelectorAll("*")].filter((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
        return [...new Set(els.map((x) => getComputedStyle(x).color))].map((c) => ({ css: c, rgba: rgba(c) }));
      });
      await el.evaluate((e) => e.setAttribute("data-c2-hide", ""));
      await page.addStyleTag({ content: "[data-c2-hide],[data-c2-hide] *{color:transparent!important}[data-c2-hide] svg{visibility:hidden!important}" });
      const b = await el.boundingBox();
      // fond pris exactement sous le texte : boîtes des nœuds texte (Range.getClientRects)
      const rects = await el.evaluate((e) => {
        const out = []; const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) out.push({ x: q.x, y: q.y, width: q.width, height: q.height });
        }
        return out;
      });
      const bufs = [];
      for (const r of rects) bufs.push(await page.screenshot({ clip: r }));
      await el.evaluate((e) => e.removeAttribute("data-c2-hide"));
      let worst = Infinity, best = 0, worstPx = null, worstText = null;
      for (const buf of bufs) {
      const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += info.channels) {
        const bg = [data[i], data[i + 1], data[i + 2]];
        for (const t of textColors) {
          // texte semi-transparent : couleur composée sur le fond réel (WCAG)
          const [r, g2, b2, a] = t.rgba;
          const fg = [r * a + bg[0] * (1 - a), g2 * a + bg[1] * (1 - a), b2 * a + bg[2] * (1 - a)];
          const c = ratio(lum(...fg), lum(...bg));
          if (c < worst) { worst = c; worstPx = bg; worstText = t.css; }
          if (c > best) best = c;
        }
      }
      }
      contrast.push({ element: name, textColors: textColors.map((t) => t.css), worstTextColor: worstText, contrastMin: Math.round(worst * 100) / 100, contrastMax: Math.round(best * 100) / 100,
        worstBackground: `rgb(${worstPx.join(",")})`, size: `${Math.round(b.width)}x${Math.round(b.height)}` });
    }
    report.viewports[vp.name] = { dpr, quickNavTargets: targets, contrast };
    await ctx.close();
  }

  // 4. Mouvement : animation de l'en-tête et transformations au survol (desktop, survol réel)
  for (const rm of ["no-preference", "reduce"]) {
    const ctx = await newCtx(browser, VIEWPORTS[1], rm);
    const page = await ctx.newPage();
    await load(page);
    const shimmer = await page.evaluate(() => {
      const el = document.querySelector('#reference section [class*="shimmer"]');
      return el ? { animationName: getComputedStyle(el).animationName } : null;
    });
    const card = page.locator("#reference section a[href]").filter({ hasText: "Voir les pièces" }).first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(500);
    const hover = await card.evaluate((c) => {
      const cta = [...c.querySelectorAll("span")].find((x) => x.textContent.trim() === "Voir les pièces").parentElement;
      const t = (e) => { const s = getComputedStyle(e); return `translate=${s.translate} scale=${s.scale} transform=${s.transform}`; };
      return { carte: t(c), image: t(c.querySelector("img")), bouton: t(cta), fleche: t(cta.querySelector("svg")) };
    });
    const navBtn = page.locator('nav[aria-label="Navigation rapide"] a, nav[aria-label="Navigation rapide"] button').first();
    await navBtn.scrollIntoViewIfNeeded();
    await navBtn.hover();
    await page.waitForTimeout(400);
    hover.navigationRapide = await navBtn.evaluate((b) => { const s = getComputedStyle(b); return `translate=${s.translate} scale=${s.scale} transform=${s.transform}`; });
    if (rm === "reduce") {
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.waitForTimeout(500);
      const b = await card.boundingBox();
      await page.screenshot({ path: path.join(outDir, `${label}-reduced-motion-survol-1440.png`), clip: { x: b.x - 10, y: b.y - 10, width: b.width + 20, height: b.height + 20 } });
      await toWebp(path.join(outDir, `${label}-reduced-motion-survol-1440.png`), path.join(outDir, `${label}-reduced-motion-survol-1440.webp`));
    }
    report.motion[rm] = { shimmer, hover };
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-zone.json`), JSON.stringify(report, null, 2));
  for (const [k, v] of Object.entries(report.viewports)) {
    console.log(`== ${label} ${k}px`);
    console.log("  nav:", v.quickNavTargets.map((t) => `${t.text} ${t.width}x${t.height}`).join(" | "));
    for (const c of v.contrast) console.log(`  ${c.element}: min ${c.contrastMin}:1 (fond ${c.worstBackground}) max ${c.contrastMax}:1 ${c.size}`);
  }
  console.log(JSON.stringify(report.motion));
})().catch((e) => { console.error(e); process.exit(1); });
