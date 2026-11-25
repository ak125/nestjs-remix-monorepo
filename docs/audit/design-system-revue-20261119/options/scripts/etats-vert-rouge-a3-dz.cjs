// Complément n° 5 DZ, point 7 : textes de teinte verte ou rouge-orangé (couleurs d'état) sous le seuil, AVANT / A2 / A3.
// Lit les mesures déjà relancées (aucun accès réseau). Classement par teinte : vert si G > R + 40 et G > B + 10 ;
// rouge-orangé si R > G + 80, R > B + 60 et G < 120 (inclut l'orange #F97316, signalé à part). Usage : node … <dossier-mesures>
const fs = require("fs"); const D = process.argv[2];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const teinte = (h) => { if (!/^#[0-9a-f]{6}$/i.test(h || "")) return null; const [r, g, b] = rgb(h);
  if (g > r + 40 && g > b + 10) return "vert"; if (r > g + 80 && r > b + 60 && g < 120) return "rouge-orangé"; return null; };
const out = {};
for (const v of ["avant", "a2", "a3"]) { const o = { textesDeTeinteEtat: 0, sousSeuil: [] };
  for (const f of fs.readdirSync(`${D}/${v}/mesures`).filter((f) => /^(r0|r1|r2|panier|connexion)[a-z0-9-]*-\d+\.json$/.test(f))) {
    const j = JSON.parse(fs.readFileSync(`${D}/${v}/mesures/${f}`));
    for (const x of j.textes.liste) { const t = teinte(x.fg) || teinte(x.bg); if (!t) continue; o.textesDeTeinteEtat++;
      const rr = x.ratioRetenu ?? x.ratio; if (rr < x.seuil) o.sousSeuil.push({ passage: f.replace(".json", ""), teinte: t, fg: x.fg, bg: x.bg, ratio: rr, seuil: x.seuil, texte: (x.texte || "").slice(0, 40), sel: x.sel }); } }
  out[v] = o; console.log(v, "textes de teinte d'état", o.textesDeTeinteEtat, "sous seuil", o.sousSeuil.length); }
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
