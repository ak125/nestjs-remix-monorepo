// Complément n° 5 au mandat DU : phrases des cartes motorisation lues dans le DOM rendu
// (rendu SSR + hydratation, sans proxy de substitution). Usage : node cartes-du5.cjs <url> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const [, , url, out] = process.argv;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/*", (r) => (/google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  const resp = await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  // Tous les boutons « Voir les N autres » de la section motorisations, pour sortir les cartes repliées
  for (const b of await page.locator("section button").all()) { const t = (await b.textContent()) || ""; if (/autres/i.test(t)) { try { await b.click({ timeout: 3000 }); } catch {} } }
  await page.waitForTimeout(800);
  const ssr = await (await fetch(url)).text();
  const cards = await page.evaluate(() => [...document.querySelectorAll("h3")].map((h) => { const card = h.closest("a,article,li,div.group") || h.parentElement; const p = card && card.querySelector("p.text-sm.text-gray-700"); return p ? { titre: h.textContent.trim(), phrase: p.textContent.trim(), lien: card.getAttribute("href") } : null; }).filter(Boolean));
  const inSsr = cards.map((c) => ssr.includes(c.phrase.replace(/'/g, "&#x27;")) || ssr.includes(c.phrase));
  fs.writeFileSync(out, JSON.stringify({ url, status: resp.status(), at: new Date().toISOString(), n: cards.length, distinctes: new Set(cards.map((c) => c.phrase)).size, toutesDansHtmlSsr: inSsr.every(Boolean), cards }, null, 2));
  console.log(url, "status", resp.status(), "cartes", cards.length, "distinctes", new Set(cards.map((c) => c.phrase)).size, "ssr", inSsr.filter(Boolean).length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
