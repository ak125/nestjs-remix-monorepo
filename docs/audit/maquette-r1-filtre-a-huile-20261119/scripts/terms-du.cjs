const { chromium } = require(process.env.PW);
const fs = require("node:fs");
const R1KW = ["bruit","usé","cassé","problème","symptôme","panne","défaillance","vibration","claquement","quand","pourquoi","comment diagnostiquer","comment savoir","causes","risques","danger","conséquences","si vous ne changez pas"];
const R2 = ["€","prix","ajouter au panier","commander","livraison gratuite","en stock","rupture de stock","garantie constructeur","réf. constructeur","frais de port"];
const R5 = ["symptôme","diagnostic","signe de","signes de","usure prématurée","code dtc","code obd"];
const R4 = ["définition","qu'est-ce que","désigne","composé de","glossaire","ne pas confondre avec"];
const R3 = ["démontage","dépose","repose","pas à pas","outils nécessaires","couple de serrage","vérification finale","essai routier"];
const LEX = ["livraison","en stock","promo","pas cher","meilleur prix"];
const GATEA = [/étape\s+[0-9]/gi,/étape\s+(un|deux|trois|quatre|cinq)/gi,/outils?\s+nécessaires?/gi,/couple\s+de\s+serrage/gi,/\b(démonter|déposer|reposer|remonter)\b/gi,/\b(tutoriel|tuto|pas[\s-]à[\s-]pas)\b/gi,/\b(définition|glossaire|encyclopédie)\b/gi];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/*", (r) => (["GET","HEAD"].includes(r.request().method()) && !/googletag|google-analytics|clarity|doubleclick/.test(r.request().url())) ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(process.argv[2], { waitUntil: "load" }); await p.waitForTimeout(3000);
  for (let y = 0; y < 30000; y += 700) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(100); }
  const d = await p.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    const vis = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || n.getAttribute("aria-hidden") === "true") return false; } return true; };
    const txt = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n, out = []; while ((n = w.nextNode())) { const pe = n.parentElement; if (!pe || /SCRIPT|STYLE|NOSCRIPT/.test(pe.tagName)) continue; if (vis(pe)) out.push(n.nodeValue); } return out.join(" ").replace(/\s+/g, " "); };
    const secs = {}; for (const s of main.querySelectorAll("section[id]")) secs[s.id] = txt(s);
    const links = [...main.querySelectorAll("a[href]")].map(a => ({ h: a.getAttribute("href"), sec: a.closest("section[id]")?.id || "hero/autre" }));
    return { text: txt(main), secs, links };
  });
  await b.close();
  const low = (t) => t.toLowerCase();
  const count = (t, list) => Object.fromEntries(list.map(k => [k, low(t).split(k).length - 1]).filter(([, n]) => n));
  const words = d.text.split(/\s+/).filter(Boolean).length;
  const role = (h) => /^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html/.test(h) ? "R2" : /^\/pieces\/[a-z0-9-]+-\d+\.html/.test(h) ? "R1" : /guide-achat/.test(h) ? "R6" : /conseils/.test(h) ? "R3" : /reference-auto/.test(h) ? "R4" : /diagnostic-auto/.test(h) ? "R5" : /^#|^\/#/.test(h) ? "ancre" : /^tel:|^mailto:/.test(h) ? "contact" : "autre:" + h.slice(0, 40);
  const byRole = {}; for (const l of d.links) { const r = role(l.h); byRole[r] = (byRole[r] || 0) + 1; }
  const bySec = {}; for (const [id, t] of Object.entries(d.secs)) { const c = { R1kw: count(t, R1KW), R2: count(t, R2), lex: count(t, LEX), R4: count(t, R4), R3: count(t, R3), R5: count(t, R5) }; for (const k in c) if (!Object.keys(c[k]).length) delete c[k]; if (Object.keys(c).length) bySec[id] = c; }
  const gateA = GATEA.map(re => [re.source, (d.text.match(re) || []).length]).filter(([, n]) => n);
  const out = { url: process.argv[2], words, total: { R1kw: count(d.text, R1KW), R2: count(d.text, R2), R5: count(d.text, R5), R4: count(d.text, R4), R3: count(d.text, R3), lex: count(d.text, LEX) }, gateA, bySec, linksByRole: byRole };
  fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
})();
