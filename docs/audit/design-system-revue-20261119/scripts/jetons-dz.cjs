// Mandat DZ — point 6.7 : pour une couleur en défaut sur un fond donné, quel jeton EXISTANT de
// packages/design-tokens/src/tokens.json atteint le seuil (texte 4,5:1 ou 3:1, bord 3:1).
// Aucune couleur nouvelle n'est proposée : on ne fait que calculer le ratio des jetons présents.
// Lecture seule, sans navigateur. Usage :
//   node jetons-dz.cjs <tokens.json> <fond #rrggbb> <seuil> [famille]   → jetons triés par ratio
//   node jetons-dz.cjs <tokens.json> --liste                             → tous les jetons couleur à plat
const fs = require("node:fs");
const [, , file, a1, a2, fam] = process.argv;
const tokens = JSON.parse(fs.readFileSync(file, "utf8"));
const flat = [];
(function walk(o, p) {
  if (!o || typeof o !== "object") return;
  const v = o.$value ?? o.value; if (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) { flat.push({ jeton: p.join("."), hex: v.toLowerCase() }); return; }
  for (const k of Object.keys(o)) walk(o[k], [...p, k]);
})(tokens.color || tokens, ["color"]);
const rgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
if (a1 === "--liste") { console.log(JSON.stringify(flat, null, 1)); process.exit(0); }
const fond = a1.toLowerCase(), seuil = Number(a2);
const rows = flat.filter((t) => !fam || t.jeton.startsWith("color." + fam)).map((t) => ({ ...t, ratio: ratio(t.hex, fond), atteint: ratio(t.hex, fond) >= seuil }));
rows.sort((x, y) => x.ratio - y.ratio);
console.log(JSON.stringify({ fond, seuil, famille: fam || "toutes", jetons: rows }, null, 1));
module.exports = { ratio, flat };
