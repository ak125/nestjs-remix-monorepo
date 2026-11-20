const { chromium } = require(process.env.PW);
(async () => {
  const [, , url, W, delay, N] = process.argv;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); const ev = [];
  p.on("pageerror", (e) => ev.push("PAGEERROR " + String(e.stack || e.message).split("\n").slice(0,4).join(" | ").slice(0, 400)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|hydrated but some attributes/.test(m.text())) ev.push("CONSOLE " + m.text().slice(0, 400)); });
  p.on("requestfailed", (r) => { if (/\.js|\.css/.test(r.url())) ev.push("REQFAIL " + r.url().replace(/^https?:\/\/[^/]+/, "") + " " + r.failure()?.errorText); });
  await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(3000);
  const seq = [];
  for (let i = 1; i <= +N; i++) {
    await p.keyboard.press("Tab"); if (+delay) await p.waitForTimeout(+delay);
    const s = await p.evaluate(() => { const e = document.activeElement; const sec = e.closest("section[id],header,footer,nav[aria-label]"); return `${(sec && (sec.id || sec.tagName.toLowerCase() + ":" + (sec.getAttribute("aria-label")||""))) || "body"} « ${(e.getAttribute("aria-label") || e.innerText || e.tagName).replace(/\s+/g," ").trim().slice(0, 32)} »${/Réessayer/.test(document.body.innerText) ? " [ÉCRAN ERREUR]" : ""}`; });
    seq.push(i + ". " + s + (ev.length ? "\n      " + ev.splice(0).join("\n      ") : ""));
  }
  console.log(seq.join("\n")); await b.close();
})();
