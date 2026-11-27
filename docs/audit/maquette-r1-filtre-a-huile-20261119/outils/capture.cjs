// Captures + relevé des blocs (mandat DS). Usage :
// node capture.cjs <baseUrl> <label> <outDir> [variantQuery]
// GET seulement ; aucune interaction autre que le défilement.
const path = require("node:path");
const fs = require("node:fs");
const W = "/home/deploy/worktrees/claude-ds-maquette-r1-20261119";
const { chromium } = require(path.join(W, "node_modules/playwright"));
const sharp = require(path.join(W, "node_modules/sharp"));

const [, , base, label, outDir, query = ""] = process.argv;
const URL_PATH = "/pieces/filtre-a-huile-7.html" + query;
const VIEWPORTS = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "1440", width: 1440, height: 900, mobile: false },
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: base + URL_PATH, label, at: new Date().toISOString(), viewports: {} };
  for (const vp of VIEWPORTS) {
    const SNAP = process.env.SNAPSHOT_HTML; // rendu SSR d'un HTML obtenu par GET (sans JS)
    const ctx = await browser.newContext({
      // JS actif : le document vient du GET fourni ; les écritures restent bloquées ci-dessous
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.mobile ? 2 : 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 mandat-ds-capture"
        : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 mandat-ds-capture",
    });
    // GET strict : aucune écriture (balises POST) ni suivi analytique vers DEV/PROD
    const blocked = [];
    await ctx.route("**/*", (route) => {
      const r = route.request();
      const u = r.url();
      if (SNAP && r.resourceType() === "document" && u.startsWith(base + URL_PATH)) {
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fs.readFileSync(SNAP) });
      }
      if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(u)) {
        blocked.push(`${r.method()} ${u.slice(0, 120)}`);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && !/ERR_BLOCKED_BY_CLIENT/.test(m.text()) && consoleErrors.push(m.text().slice(0, 300)));
    page.on("response", (r) => r.status() >= 400 && consoleErrors.push(`HTTP ${r.status()} ${r.url().slice(0, 200)}`));
    page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).slice(0, 300)));
    page.on("framenavigated", (f) => f === page.mainFrame() && process.env.DEBUG_NAV && console.error("NAV", f.url()));
    const resp = await page.goto(base + URL_PATH, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    if (process.env.VIDEO_SLOT) {
      // Variante de capture UNIQUEMENT (rien dans le code livré) : emplacement vidéo prévu (décision 43)
      await page.evaluate(() => {
        const faq = document.querySelector("section#faq");
        if (!faq) return;
        const el = document.createElement("section");
        el.id = "video-emplacement-prevu";
        el.setAttribute("aria-label", "Emplacement prévu");
        el.style.cssText = "padding:40px 16px;background:#fff";
        el.innerHTML = '<div style="max-width:1280px;margin:0 auto"><div style="aspect-ratio:9/16;max-width:320px;margin:0 auto;border:2px dashed #94a3b8;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#475569;font:600 15px/1.4 system-ui;text-align:center;padding:16px">' +
          '<span style="font-size:13px;letter-spacing:.08em;text-transform:uppercase">Emplacement prévu</span>' +
          '<span>Vidéo courte 30–60 s<br>(décision 43)</span>' +
          '<span style="font-size:12px;font-weight:400">Variante de maquette — non livrée, aucune vidéo existante</span></div></div>';
        faq.parentElement.insertBefore(el, faq);
      });
    }
    const fold = path.join(outDir, `${label}-${vp.name}-fold`);
    await page.screenshot({ path: fold + ".png" });
    // défilement progressif pour déclencher les rendus différés
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    // capture seulement : rendre les sections .cv-auto (content-visibility) hors écran
    await page.addStyleTag({ content: ".cv-auto{content-visibility:visible!important}" });
    await page.waitForTimeout(800);
    const full = path.join(outDir, `${label}-${vp.name}-full`);
    await page.screenshot({ path: full + ".png", fullPage: true });
    // Relevé des blocs : enfants directs du conteneur de page
    const blocks = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      if (!h1) return [{ tag: "NO_H1", id: null, heads: [document.title, document.body.innerText.slice(0, 200)], top: 0, height: 0 }];
      // conteneur = plus proche ancêtre commun du H1 et de #faq (ou du dernier H2)
      const anchor = document.querySelector("section#faq") || [...document.querySelectorAll("h2")].pop() || h1;
      let container = h1.parentElement;
      while (container && !container.contains(anchor)) container = container.parentElement;
      container = container || document.body;
      return [...container.children].map((el) => {
        const r = el.getBoundingClientRect();
        const heads = [...el.querySelectorAll("h1,h2")].map((h) => h.tagName + " " + h.textContent.trim().replace(/\s+/g, " ").slice(0, 70));
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          dataSection: el.getAttribute("data-section"),
          heads,
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
          visible: r.height > 0 && getComputedStyle(el).display !== "none",
        };
      });
    });
    report.viewports[vp.name] = {
      status: resp.status(),
      scrollHeight: await page.evaluate(() => document.body.scrollHeight),
      consoleErrors,
      blockedRequests: blocked,
      blocks,
    };
    for (const f of [fold, full]) {
      const meta = await sharp(f + ".png", { limitInputPixels: false }).metadata();
      // pleine page ramenée à 1x ; plafond WebP 16 383 px de haut
      let img = sharp(f + ".png", { limitInputPixels: false });
      if (f === full) {
        const scale = Math.min(vp.width / meta.width, 16000 / meta.height);
        img = img.resize(Math.round(meta.width * scale), Math.round(meta.height * scale));
      }
      await img.webp({ quality: 72 }).toFile(f + ".webp");
      fs.unlinkSync(f + ".png");
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `${label}-blocs.json`), JSON.stringify(report, null, 2));
  for (const [k, v] of Object.entries(report.viewports)) {
    console.log(`${label} ${k}px status=${v.status} h=${v.scrollHeight} errors=${v.consoleErrors.length}`);
    for (const b of v.blocks) console.log(`  ${b.top}\t${b.height}\t${b.tag}#${b.id || ""}\t${b.heads.join(" | ")}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
