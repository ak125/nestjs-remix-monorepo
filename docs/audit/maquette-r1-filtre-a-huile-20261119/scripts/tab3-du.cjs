const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +(process.argv[3]||390), height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); const ev = [];
  p.on("pageerror", (e) => ev.push("PAGEERROR " + String(e.stack || e.message).split("\n").slice(0,3).join(" | ").slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) ev.push("CONSOLE " + m.text().slice(0, 300)); });
  await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  for (let i = 1; i <= 6; i++) {
    await p.keyboard.press("Tab"); await p.waitForTimeout(700);
    const s = await p.evaluate(() => ({ a: (document.activeElement.getAttribute("aria-label") || document.activeElement.innerText || document.activeElement.tagName).trim().slice(0, 30), err: /Réessayer/.test(document.body.innerText), h1: document.querySelector("h1")?.innerText.slice(0, 40) }));
    console.log(i, JSON.stringify(s), ev.splice(0).join("\n   "));
  }
  await p.screenshot({ path: "crops/tab-err-" + (process.argv[4]||"x") + ".png" });
  await b.close();
})();
