// Audit a11y (mandat DU) : axe-core 4.12 (WCAG 2.0/2.1/2.2 A+AA + best-practice) à 390x844,
// après défilement complet (contenus différés et content-visibility rendus), sans bridage.
// Ajout : relevé des cibles tactiles < 44x44 par section (seuil des skills, pas celui de WCAG 2.2 AA = 24).
// Usage : node audit-a11y-du.cjs <url> <out.json> [width=390] [height=844]
const fs = require("node:fs");
const { chromium } = require(process.env.PW || "playwright");
const { default: AxeBuilder } = require(process.env.AXE || "@axe-core/playwright");
const [, , url, out, W = "390", H = "844"] = process.argv;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route("**/*", (route) => {
    const r = route.request();
    if (!["GET", "HEAD"].includes(r.method()) || /google-analytics|googletagmanager|doubleclick|clarity\.ms|facebook|hotjar/.test(r.url())) return route.abort("blockedbyclient");
    return route.continue();
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3000);
  for (let y = 0; y < 30000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  const violations = [];
  for (const v of axe.violations) {
    const nodes = [];
    for (const n of v.nodes.slice(0, 40)) {
      const target = n.target.join(" ");
      const where = await page.evaluate((t) => {
        try { const el = document.querySelector(t); if (!el) return "?"; const s = el.closest("section[id], nav, header, footer, aside, main > div[id]"); const txt = (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 60); return (s ? (s.id ? "#" + s.id : s.tagName.toLowerCase() + (s.getAttribute("aria-label") ? "[" + s.getAttribute("aria-label") + "]" : "")) : "body") + " | " + txt; } catch { return "?"; }
      }, target);
      nodes.push({ target: target.slice(0, 120), where, summary: (n.failureSummary || "").split("\n").slice(1, 2).join(" ").slice(0, 200), data: n.any?.[0]?.data && { fg: n.any[0].data.fgColor, bg: n.any[0].data.bgColor, ratio: n.any[0].data.contrastRatio, size: n.any[0].data.fontSize } });
    }
    violations.push({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, nodes });
  }
  const small = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("a[href], button, [role=button], [role=tab], input, select, summary")) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.width >= 44 && r.height >= 44) continue;
      const s = el.closest("section[id], nav, header, footer, aside");
      const key = s ? (s.id ? "#" + s.id : s.tagName.toLowerCase() + (s.getAttribute("aria-label") ? "[" + s.getAttribute("aria-label") + "]" : "")) : "body";
      (out[key] ||= { n: 0, ex: [] }).n++;
      if (out[key].ex.length < 4) out[key].ex.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} « ${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40)} »`);
    }
    return out;
  });
  const headings = await page.evaluate(() => [...document.querySelectorAll("main h1, main h2, h1, h2")].map((h) => h.tagName + " " + h.innerText.trim().slice(0, 70)).filter((v, i, a) => a.indexOf(v) === i));
  const emoji = await page.evaluate(() => { const re = /\p{Extended_Pictographic}/u; const hits = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (re.test(n.nodeValue)) { const s = n.parentElement.closest("section[id], header, footer, nav"); hits.push(((s && (s.id ? "#" + s.id : s.tagName.toLowerCase())) || "body") + " | " + n.nodeValue.trim().slice(0, 50)); } } return [...new Set(hits)].slice(0, 30); });
  await browser.close();
  fs.writeFileSync(out, JSON.stringify({ url, viewport: `${W}x${H}`, axe: axe.testEngine, at: new Date().toISOString(), violations, smallTargets: small, headings, emoji }, null, 2));
  console.log(JSON.stringify(violations.map((v) => [v.id, v.impact, v.count])), "\nsmall:", JSON.stringify(Object.fromEntries(Object.entries(small).map(([k, v]) => [k, v.n]))));
})().catch((e) => { console.error(e); process.exit(1); });
