const { chromium } = require(process.env.PW);
(async () => {
  const [, , url, W, mobile, block] = process.argv;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: 844 }, isMobile: mobile === "1", hasTouch: mobile === "1" });
  await ctx.route("**/*", (r) => { const ok = ["GET","HEAD"].includes(r.request().method()); if (!ok) return r.abort(); if (block === "1" && /googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) return r.abort(); return r.continue(); });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR " + String(e.message).slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 200)); });
  await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(4000);
  const st = await p.evaluate(() => ({ h1: document.querySelector("h1")?.textContent.trim().slice(0, 60), hasRef: !!document.getElementById("reference"), err: /Réessayer|Signaler le problème/.test(document.body.innerText), errTxt: [...document.querySelectorAll("h1,h2")].map(h => h.textContent.trim()).slice(0, 4) }));
  console.log(W, "mobile=" + mobile, "block=" + block, JSON.stringify(st)); errs.slice(0, 8).forEach((e) => console.log("   ", e));
  await p.screenshot({ path: `crops/err-${W}-${mobile}-${block}.png` });
  await b.close();
})();
