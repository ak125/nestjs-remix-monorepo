// Complément n° 5 au mandat DU : captures du rendu de la tête de #2210 servi par le backend et le
// frontend de la branche (sans proxy de substitution) : haut de page, bande sous le haut de page,
// trois premières cartes motorisation. reducedMotion=reduce. Usage : node captures-du5.cjs <url> <dossier> <prefixe>
const { chromium } = require(process.env.PW || "playwright");
const [, , url, dir, prefix] = process.argv;
(async () => {
  const browser = await chromium.launch();
  for (const [W, H] of [[390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: "reduce" });
    await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${dir}/${prefix}-haut-${W}.png` });
    const band = page.locator("div.bg-slate-50.border-b").first();
    try { await band.scrollIntoViewIfNeeded({ timeout: 5000 }); await band.screenshot({ path: `${dir}/${prefix}-bande-${W}.png` }); } catch (e) { console.log("bande", e.message.split("\n")[0]); }
    const card = page.locator("h3").filter({ has: page.locator("xpath=..") }).first();
    const cards = await page.$$eval("p.text-sm.text-gray-700", (ps) => ps.length);
    const first = page.locator("p.text-sm.text-gray-700").first();
    try {
      await first.scrollIntoViewIfNeeded({ timeout: 5000 }); await page.waitForTimeout(400);
      const grid = first.locator("xpath=ancestor::*[contains(@class,'grid')][1]");
      const box = await grid.boundingBox(); const fb = await first.locator("xpath=ancestor::a[1]").boundingBox();
      const h = Math.min(box.height, (fb ? fb.height : 400) * (W < 640 ? 2 : 1) + 24);
      await page.screenshot({ path: `${dir}/${prefix}-cartes-${W}.png`, clip: { x: box.x, y: box.y, width: box.width, height: h }, fullPage: false });
    } catch (e) { console.log("cartes", e.message.split("\n")[0]); }
    console.log(W, "phrases de carte dans le DOM :", cards);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
