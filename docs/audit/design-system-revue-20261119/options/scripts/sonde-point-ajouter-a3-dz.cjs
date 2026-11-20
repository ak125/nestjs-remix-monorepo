// Complément n° 5 DZ, point 4 : nature du point devant « Ajouter » (cartes R2). Lecture seule.
// Usage : BRUT=<dossier-brut> node scripts/sonde-point-ajouter-a3-dz.cjs <dossier-options> <chemin> <L> <H> <avant|a2|a3>  → une ligne JSON par appel, capture <BRUT>/point-ajouter-<L>-<variante>.png
const OPT = process.argv[2]; const { chromium, BASE, newContext, settle } = require(OPT + "/../scripts/lib-dz.cjs");
const { injecte } = require(OPT + "/scripts/injection-dz.cjs");
const [route, Ws, Hs, v] = process.argv.slice(3);
(async () => { const b = await chromium.launch(); const aborted = []; const ctx = await newContext(b, { width: +Ws, height: +Hs, aborted }); const p = await ctx.newPage();
  await p.goto(BASE + route, { waitUntil: "load", timeout: 120000 }); await settle(p, 4500);
  if (v !== "avant") await injecte(p, v);
  const r = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button[aria-label^="Ajouter"][aria-label$="au panier"]')];
    const e = btns.find((x) => x.innerText.trim() === "Ajouter") || btns[0]; if (!e) return null;
    e.scrollIntoView({ block: "center" });
    const st = (n, ps) => { const s = getComputedStyle(n, ps); return { content: s.content, display: s.display, w: s.width, h: s.height, bg: s.backgroundColor, color: s.color, stroke: s.stroke, fill: s.fill, opacity: s.opacity }; };
    const kids = [...e.querySelectorAll("*")].map((n) => { const q = n.getBoundingClientRect(); return { tag: n.tagName.toLowerCase(), cls: String(n.getAttribute("class") || "").slice(0, 60), rect: [q.left, q.top, q.width, q.height].map((x) => Math.round(x * 10) / 10), ...st(n) }; });
    const q = e.getBoundingClientRect();
    return { nb: btns.length, cls: String(e.className), rect: [q.left, q.top, q.width, q.height].map(Math.round), btn: st(e), avant: st(e, "::before"), apres: st(e, "::after"), kids, html: e.innerHTML.slice(0, 300) };
  });
  await p.waitForTimeout(500);
  const box = await p.evaluate(() => { const btns = [...document.querySelectorAll('button[aria-label^="Ajouter"][aria-label$="au panier"]')]; const e = btns.find((x) => x.innerText.trim() === "Ajouter") || btns[0]; const q = e.getBoundingClientRect(); return { x: q.left - 4, y: q.top - 4, width: q.width + 8, height: q.height + 8 }; });
  await p.screenshot({ path: `${process.env.BRUT}/point-ajouter-${Ws}-${v}.png`, clip: box });
  console.log(v, JSON.stringify(r, null, 0)); await b.close(); })();
