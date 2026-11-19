// Captures de la section #reference (cartes véhicule) et de la navigation rapide. Usage : node capt-du3.cjs <url> <prefixe> <W> <H>
const { chromium } = require(process.env.PW);
const [, , url, pre, W, H] = process.argv;
(async () => { const b = await chromium.launch(); const m = Number(W) < 800;
  const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, isMobile: m, hasTouch: m })).newPage();
  await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(3000);
  for (let y = 0; y < 20000; y += 800) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(80); }
  const ref = p.locator("#reference"); await ref.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  const bx = await ref.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }); await p.screenshot({ path: pre + "-cartes-" + W + ".png", fullPage: true, clip: { x: bx.x, y: bx.y, width: bx.w, height: Math.min(bx.h, m ? 1600 : 1100) }, animations: "disabled" });
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
  const nav = p.locator('nav[aria-label="Navigation rapide"]'); await nav.scrollIntoViewIfNeeded(); await nav.screenshot({ path: pre + "-nav-" + W + ".png", animations: "disabled" });
  await b.close(); })().catch((e) => { console.error(e); process.exit(1); });
