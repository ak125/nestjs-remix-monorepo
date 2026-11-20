const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  for (let i = 1; i <= 12; i++) { await p.keyboard.press("Tab"); await p.waitForTimeout(250);
    if (i >= 8) console.log(i, await p.evaluate(() => { const e = document.activeElement; return `${e.tagName} id=${e.id} name=${e.getAttribute("name")} aria=${e.getAttribute("aria-label")} disabled=${e.disabled} visible=${!!e.getBoundingClientRect().width}`; })); }
  await b.close();
})();
