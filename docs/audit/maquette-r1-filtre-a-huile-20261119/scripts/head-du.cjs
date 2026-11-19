const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick|facebook|hotjar/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); const resp = await p.goto(process.argv[2], { waitUntil: "load", timeout: 120000 });
  const xrobots = resp.headers()["x-robots-tag"] || null;
  await p.waitForTimeout(2500);
  for (let y = 0; y < 30000; y += 700) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(100); }
  const r = await p.evaluate(() => {
    const m = (s) => document.querySelector(s)?.getAttribute("content") ?? null;
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { const j = JSON.parse(s.textContent); const items = Array.isArray(j) ? j : (j["@graph"] || [j]); return items.map(i => { const t = i["@type"]; let extra = ""; if (t === "FAQPage") extra = " q=" + (i.mainEntity||[]).length; if (t === "ItemList") extra = " n=" + (i.itemListElement||[]).length; if (t === "BreadcrumbList") extra = " n=" + (i.itemListElement||[]).length; if (i.offers || i.aggregateOffer) extra += " OFFERS"; return t + extra; }).join(","); } catch (e) { return "PARSE_ERR"; } });
    const imgs = [...document.querySelectorAll("img")].map(i => { const r = i.getBoundingClientRect(); return { src: (i.currentSrc||i.src).replace(location.origin,"").slice(0,90), alt: i.getAttribute("alt"), w: i.getAttribute("width"), h: i.getAttribute("height"), loading: i.getAttribute("loading"), fp: i.getAttribute("fetchpriority"), nat: i.naturalWidth + "x" + i.naturalHeight, box: Math.round(r.width)+"x"+Math.round(r.height), sec: i.closest("section[id]")?.id || (i.closest("header,footer,nav")?.tagName) || "-" }; });
    const links = [...document.querySelectorAll("main a[href], body a[href]")].map(a => a.getAttribute("href"));
    const counts = {}; links.forEach(h => counts[h] = (counts[h]||0)+1);
    return { title: document.title, desc: m('meta[name="description"]'), robots: m('meta[name="robots"]'), canonical: document.querySelector('link[rel="canonical"]')?.href ?? null, ogUrl: m('meta[property="og:url"]'), hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].length, h1: [...document.querySelectorAll("h1")].map(h=>h.textContent.trim()), ld, imgs, nLinks: links.length, dupLinks: Object.entries(counts).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,25), extLinks: links.filter(h=>/^https?:/.test(h) && !h.includes(location.host)).slice(0,10) };
  });
  r.xrobots = xrobots; r.status = resp.status();
  require("fs").writeFileSync(process.argv[3], JSON.stringify(r, null, 2));
  console.log(JSON.stringify({ status: r.status, xrobots, title: r.title, desc: r.desc, robots: r.robots, canonical: r.canonical, ogUrl: r.ogUrl, h1: r.h1, ld: r.ld, nLinks: r.nLinks, nImgs: r.imgs.length }, null, 1));
  await b.close();
})();
