// Complément n° 10 : capture du conteneur éditorial d'un bloc (rendu servi), pour juger l'effet visuel du soulignement.
// Usage : PW=<node_modules>/playwright node capture-bloc-du10.cjs <url> <sélecteur du conteneur> <largeur> <out.png>
const { chromium } = require(process.env.PW);
const [, , url, sel, W, out] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: +W, height: 900 } });
  await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2000);
  const c = p.locator(sel).first(); await c.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  await c.screenshot({ path: out });
  console.log(W, JSON.stringify(await c.evaluate((el) => [...el.querySelectorAll("a")].map((a) => ({ t: a.textContent.trim().slice(0, 50), d: getComputedStyle(a).textDecorationLine, h: Math.round(a.getBoundingClientRect().height) })))));
  await b.close();
})();
