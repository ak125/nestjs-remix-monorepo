const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  for (let y = 0; y < 30000; y += 700) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(100); }
  const hs = await p.evaluate(() => [...document.querySelectorAll("h1,h2,h3")].map(h => { const s = h.closest("section[id],footer,header,nav,aside"); return h.tagName + " [" + (s ? (s.id || s.tagName) : "-") + "] " + h.textContent.replace(/\s+/g," ").trim().slice(0, 90); }));
  console.log(hs.join("\n"));
  const card = p.locator("#reference a").filter({ hasText: "Voir les pièces" }).first();
  await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await card.screenshot({ path: "crops/du-carte-vehicule-390.png" });
  const btn = p.locator("#reference button", { hasText: "autres compatibilités" }).first();
  await btn.scrollIntoViewIfNeeded(); await btn.screenshot({ path: "crops/du-bouton-autres-390.png" });
  const hdr = p.locator("#reference section > div").first(); await hdr.screenshot({ path: "crops/du-entete-motorisations-390.png" });
  await b.close();
})();
