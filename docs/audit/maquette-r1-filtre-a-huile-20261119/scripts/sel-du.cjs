const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  console.log(JSON.stringify(await p.evaluate(() => {
    const t0 = [...document.querySelectorAll("[tabindex='0']")].map(e => e.tagName + " role=" + e.getAttribute("role") + " txt=" + e.innerText.replace(/\s+/g," ").slice(0, 50));
    const hero = document.querySelector('[role="tablist"]')?.closest("section,div[class*='hero'],header") || document.body;
    const ctrls = [...document.querySelectorAll("select, [role=combobox], input")].slice(0, 12).map(e => { const r = e.getBoundingClientRect(); const lab = e.getAttribute("aria-label") || (e.id && document.querySelector(`label[for="${e.id}"]`)?.innerText) || e.getAttribute("aria-labelledby") || e.getAttribute("placeholder"); return `${e.tagName}${e.disabled?"[disabled]":""} ${Math.round(r.width)}x${Math.round(r.height)} label=${(lab||"∅").slice(0,30)} @${e.closest("section[id],nav[aria-label]")?.id || e.closest("nav")?.getAttribute("aria-label") || "body"}`; });
    return { tabindex0: t0, ctrls };
  }), null, 1));
  await b.close();
})();
