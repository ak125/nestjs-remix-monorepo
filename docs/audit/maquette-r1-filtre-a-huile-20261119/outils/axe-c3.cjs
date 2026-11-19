// Complément n° 3 au mandat DS : axe-core à 390×844 + cibles + mouvement, page R1.
// Usage : node axe-c3.cjs <baseUrl> <label> <outDir>
// GET seulement ; écritures et suivi analytique bloqués.
// Produit <label>-axe-390x844.json :
//  - violations axe (WCAG 2.0/2.1/2.2 A+AA + bonnes pratiques), tous les nœuds, couleurs et ratio ;
//  - cibles interactives sous 44 px (largeur ou hauteur), avec la marque « < 24 px » ;
//  - avec prefers-reduced-motion: reduce : animations CSS infinies encore actives
//    (document.getAnimations) et comportement du défilement de la navigation rapide.
const path = require("node:path");
const fs = require("node:fs");
const W = process.env.WT || "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const { default: AxeBuilder } = require(path.join(W, "node_modules/@axe-core/playwright"));
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const [, , base, label, outDir] = process.argv;

async function open(browser, reducedMotion) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 mandat-ds-axe",
  });
  await ctx.route("**/*", (route) => {
    const r = route.request();
    if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
    return route.continue();
  });
  const page = await ctx.newPage();
  await page.goto(base + URL_PATH, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3000);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  return { ctx, page };
}

// Localisation d'un nœud : section à id, nav nommée, header/footer… (définie dans chaque page.evaluate).

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, label, at: new Date().toISOString(), viewport: "390x844 DPR2" };

  // 1) axe + cibles, sans préférence de mouvement
  {
    const { ctx, page } = await open(browser, "no-preference");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    report.axeVersion = axe.testEngine.version;
    report.violations = [];
    for (const v of axe.violations) {
      const nodes = [];
      for (const n of v.nodes) {
        const target = n.target.join(" ");
        const info = await page.evaluate((t) => {
          const where = (el) => {
            const s = el.closest("section[id], nav[aria-label], header, footer, aside, [data-section]");
            if (!s) return "body";
            if (s.id) return "#" + s.id;
            const lab = s.getAttribute("aria-label") || s.getAttribute("data-section");
            return s.tagName.toLowerCase() + (lab ? `[${lab}]` : "");
          };
          try {
            const el = document.querySelector(t); if (!el) return { where: "?", text: "" };
            return { where: where(el), text: (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 60), cls: String(el.className || "").slice(0, 200) };
          } catch { return { where: "?", text: "" }; }
        }, target);
        const d = n.any?.[0]?.data;
        nodes.push({ target, ...info, data: d && typeof d === "object" ? { fg: d.fgColor, bg: d.bgColor, ratio: d.contrastRatio, expected: d.expectedContrastRatio, size: d.fontSize, weight: d.fontWeight } : d || null });
      }
      report.violations.push({ id: v.id, impact: v.impact, count: v.nodes.length, nodes });
    }
    report.incomplete = axe.incomplete.map((v) => ({ id: v.id, count: v.nodes.length }));
    report.smallTargets = await page.evaluate(() => {
      const where = (el) => {
        const s = el.closest("section[id], nav[aria-label], header, footer, aside, [data-section]");
        if (!s) return "body";
        if (s.id) return "#" + s.id;
        const lab = s.getAttribute("aria-label") || s.getAttribute("data-section");
        return s.tagName.toLowerCase() + (lab ? `[${lab}]` : "");
      };
      const out = [];
      for (const el of document.querySelectorAll("a[href], button, [role=button], [role=tab], input, select, summary")) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (r.width >= 44 && r.height >= 44) continue;
        out.push({ tag: el.tagName.toLowerCase(), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, under24: r.width < 24 || r.height < 24,
          text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 50), where: where(el), cls: String(el.className || "").slice(0, 160) });
      }
      return out;
    });
    await ctx.close();
  }

  // 2) mouvement avec reduced-motion
  {
    const { ctx, page } = await open(browser, "reduce");
    report.reduce = {};
    report.reduce.infiniteAnimations = await page.evaluate(() => document.getAnimations()
      .filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.playState === "running")
      .map((a) => { const el = a.effect.target; return { name: a.animationName || a.constructor.name, cls: String(el && el.className && el.className.baseVal !== undefined ? el.className.baseVal : el && el.className || "").slice(0, 140) }; }));
    // défilement de la navigation rapide : position 60 ms après le clic (smooth = position intermédiaire)
    const btn = page.locator('nav[aria-label="Navigation rapide"] button', { hasText: "FAQ" });
    if (await btn.count()) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      const target = await page.evaluate(() => { const el = document.getElementById("faq"); return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null; });
      await btn.first().click();
      await page.waitForTimeout(60);
      const y60 = await page.evaluate(() => Math.round(window.scrollY));
      await page.waitForTimeout(1500);
      const yEnd = await page.evaluate(() => Math.round(window.scrollY));
      report.reduce.quickNavScroll = { faqTop: target, scrollYAt60ms: y60, scrollYEnd: yEnd, instant: Math.abs(y60 - yEnd) < 4 };
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-axe-390x844.json`), JSON.stringify(report, null, 2));
  console.log(`== ${label} axe ${report.axeVersion}`);
  for (const v of report.violations) console.log(`  ${v.id} (${v.impact}) : ${v.count}`);
  for (const n of (report.violations.find((v) => v.id === "color-contrast") || { nodes: [] }).nodes)
    console.log(`    ${n.data && n.data.ratio}:1 ${n.data && n.data.fg} sur ${n.data && n.data.bg} ${n.data && n.data.size} | ${n.where} | ${n.text} | ${n.cls.slice(0, 90)}`);
  console.log(`  cibles < 44 : ${report.smallTargets.length} ; < 24 : ${report.smallTargets.filter((t) => t.under24).length}`);
  for (const t of report.smallTargets) console.log(`    ${t.under24 ? "<24" : "   "} ${t.tag} ${t.w}x${t.h} | ${t.where} | ${t.text} | ${t.cls.slice(0, 80)}`);
  console.log("  reduce, boucles actives :", JSON.stringify(report.reduce.infiniteAnimations));
  console.log("  reduce, défilement :", JSON.stringify(report.reduce.quickNavScroll));
})().catch((e) => { console.error(e); process.exit(1); });
