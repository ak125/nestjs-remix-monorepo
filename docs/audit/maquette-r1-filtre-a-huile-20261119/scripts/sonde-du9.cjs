// Complément n° 9 : styles calculés des liens du conteneur souligné de #reference et pas vertical des listes de liens.
// Usage : PW=<node_modules>/playwright node sonde-du9.cjs <base> <w> <h> <out.json> <url...>
const fs = require("node:fs");
const { chromium } = require(process.env.PW);
const [, , base, W, H, out, ...urls] = process.argv;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +W, height: +H } });
  const res = [];
  for (const u of urls) {
    await p.goto(base + u, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const hex = (c) => { const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
      const c = [...document.querySelectorAll("#reference div")].find((d) => d.className.includes("[&_a]:underline"));
      if (!c) return null;
      return [...c.querySelectorAll("a")].map((a) => { const s = getComputedStyle(a); const rs = [...a.getClientRects()].map((q) => ({ x: Math.round(q.x), y: Math.round(q.y + scrollY), w: Math.round(q.width), h: Math.round(q.height) })); const par = a.parentElement; const pr = par.getBoundingClientRect();
        return { texte: a.textContent.trim(), classe: a.className || null, couleur: hex(s.color), soulignement: s.textDecorationLine, couleurSoulignement: s.textDecorationColor, decalage: s.textUnderlineOffset, graisse: s.fontWeight, display: s.display, parent: par.tagName.toLowerCase(), boites: rs, parentBoite: { y: Math.round(pr.y + scrollY), h: Math.round(pr.height) } }; });
    });
    res.push({ url: u, liens: r });
  }
  fs.writeFileSync(out, JSON.stringify({ base, viewport: `${W}x${H}`, at: new Date().toISOString(), res }, null, 2));
  for (const x of res) for (const l of x.liens || []) console.log(W, x.url, JSON.stringify([l.texte.slice(0, 30), l.classe, l.couleur, l.soulignement, l.couleurSoulignement, l.decalage, l.parent, l.boites.map((q) => `${q.y}/${q.h}/${q.w}`).join(" ")]));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
