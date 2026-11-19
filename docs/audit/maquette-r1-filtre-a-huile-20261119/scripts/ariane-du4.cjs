// Complément n° 4 au mandat DU : couleur calculée des liens du fil d'Ariane du hero et de
// l'onglet inactif « Type Mine », avec la règle CSS qui la fixe (origine de la couleur).
const { chromium } = require(process.env.PW || "playwright");
const [, , url, W, H] = process.argv;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: +H }, reducedMotion: "reduce" });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(2000);
  const cdp = await ctx.newCDPSession(p); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const out = [];
  for (const [label, sel] of [["Accueil", "section nav a >> nth=0"], ["Type Mine", 'button:has-text("Type Mine") >> visible=true']]) {
    const loc = p.locator(sel).first(); if (!(await loc.count())) { out.push([label, "absent"]); continue; }
    const info = await loc.evaluate((e) => ({ text: e.textContent.trim().slice(0, 30), color: getComputedStyle(e).color, parentColor: getComputedStyle(e.parentElement).color, cls: String(e.className).slice(0, 140), disabled: e.disabled === true, ariaSelected: e.getAttribute("aria-selected") }));
    await loc.evaluate((e) => e.setAttribute("data-a4", "1"));
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 }); const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-a4]" });
    const m = await cdp.send("CSS.getMatchedStylesForNode", { nodeId });
    const rules = m.matchedCSSRules.filter((r) => r.rule.style.cssProperties.some((pp) => pp.name === "color" && pp.value)).map((r) => r.rule.selectorList.text.slice(0, 60) + " → " + r.rule.style.cssProperties.find((pp) => pp.name === "color").value);
    await loc.evaluate((e) => e.removeAttribute("data-a4"));
    out.push({ label, ...info, reglesColor: rules });
  }
  console.log(W, JSON.stringify(out));
  await b.close();
})();
