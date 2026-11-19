const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  const info = await p.evaluate(() => {
    const re = [...document.querySelectorAll("button,a")].find(e => /Réessayer/.test(e.textContent));
    const chain = []; let n = re; while (n && n !== document.body) { const cs = getComputedStyle(n); chain.push(`${n.tagName.toLowerCase()}${n.id?"#"+n.id:""}.${(n.className||"").toString().slice(0,50)} disp=${cs.display} vis=${cs.visibility} op=${cs.opacity} aria-hidden=${n.getAttribute("aria-hidden")} inert=${n.hasAttribute("inert")}`); n = n.parentElement; }
    const inertEls = [...document.querySelectorAll("[inert]")].map(e => e.tagName + "#" + e.id + "." + (e.className||"").toString().slice(0,40));
    const r = re && re.getBoundingClientRect();
    const main = document.querySelector("main"); const mainFocusable = main ? main.querySelectorAll("a[href],button,input,[tabindex]:not([tabindex='-1'])").length : -1;
    return { reBox: r && [r.x, r.y, r.width, r.height].map(Math.round), chain: chain.slice(0, 8), inertEls, mainFocusable, mainTag: !!main };
  });
  console.log(JSON.stringify(info, null, 1));
  // try focusing the first quicknav button directly then Tab
  await p.focus('nav[aria-label="Navigation rapide"] button').catch(e=>console.log("focus fail", e.message.split("\n")[0]));
  const a = await p.evaluate(() => document.activeElement.outerHTML.slice(0,100)); console.log("after focus:", a);
  await b.close();
})();
