// Complément n° 9 : règle axe link-in-text-block seule, violations et cas « incomplets » (non décidés par axe).
// Usage : PW=<node_modules>/playwright AXE=<node_modules>/@axe-core/playwright node axe-lien-du9.cjs <url> <w> <h> <out.json>
const fs = require("node:fs");
const { chromium } = require(process.env.PW); const { AxeBuilder } = require(process.env.AXE);
const [, , url, W, H, out] = process.argv;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: +H } }); const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2500);
  const r = await new AxeBuilder({ page: p }).withRules(["link-in-text-block"]).analyze();
  const f = (arr) => arr.flatMap((x) => x.nodes.map((n) => ({ cible: n.target.join(" "), html: n.html.slice(0, 120), messages: [...n.any, ...n.all, ...n.none].map((c) => c.message) })));
  const res = { url, viewport: `${W}x${H}`, at: new Date().toISOString(), violations: f(r.violations), incomplets: f(r.incomplete), conformes: f(r.passes) };
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  for (const k of ["violations", "incomplets", "conformes"]) for (const n of res[k]) if (/conseils\/filtre|reference-auto\/filtre/.test(n.html)) console.log(W, k, n.html.slice(0, 70), "|", n.messages.join(" / ").slice(0, 200));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
