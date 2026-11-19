const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +process.argv[3], height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  const seq = [];
  for (let i = 0; i < 45; i++) { await p.keyboard.press("Tab"); seq.push(await p.evaluate(() => { const e = document.activeElement; const s = e.closest("section[id],header,footer,nav[aria-label]"); const lab = (e.getAttribute("aria-label") || e.innerText || e.getAttribute("placeholder") || e.getAttribute("title") || "").replace(/\s+/g," ").trim().slice(0,40); return `${e.tagName.toLowerCase()}${e.getAttribute("role")?"["+e.getAttribute("role")+"]":""} @${s ? (s.id || s.tagName.toLowerCase()+(s.getAttribute("aria-label")?":"+s.getAttribute("aria-label"):"")) : "body"} « ${lab} »${lab?"":" ⚠SANS-LIBELLÉ"}`; })); }
  console.log(seq.map((s,i)=>(i+1)+". "+s).join("\n"));
  const unl = await p.evaluate(() => [...document.querySelectorAll("a[href],button,input,select,[role=tab]")].filter(e => { const r=e.getBoundingClientRect(); return r.width && !(e.getAttribute("aria-label")||e.innerText.trim()||e.getAttribute("title")||e.querySelector("img[alt]:not([alt=''])")||(e.id&&document.querySelector(`label[for="${e.id}"]`))||e.getAttribute("aria-labelledby")); }).map(e => e.tagName + " @" + (e.closest("section[id]")?.id||"-") + " " + (e.getAttribute("href")||"")));
  console.log("SANS NOM ACCESSIBLE:", unl.length, unl.slice(0,12));
  await b.close();
})();
