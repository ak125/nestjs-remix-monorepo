// Complément n° 5 au mandat DU : phrases des cartes contre les lexiques interdits R1.
// Usage : SEO_ROLES=<packages/seo-roles/dist/index.js> node lexique-du5.cjs <cartes.json>... > out.json
const fs = require("node:fs");
const r = require(process.env.SEO_ROLES);
const canon = r.getForbiddenOverlap(r.RoleId.R1_ROUTER).map(r.normalizePhrase).filter(Boolean);
const lists = {
  "canon getForbiddenOverlap(R1) (début de mot)": (t) => canon.filter((k) => (" " + r.normalizePhrase(t)).includes(" " + k)),
  "backend FORBIDDEN_KEYWORDS_R1 (sous-chaîne)": (t) => ["bruit","usé","cassé","problème","symptôme","panne","défaillance","vibration","claquement","quand","pourquoi","comment diagnostiquer","comment savoir","causes","risques","danger","conséquences","si vous ne changez pas"].filter((k) => t.toLowerCase().includes(k)),
  "r1-router-validator.md (absolus + lexique dominant)": (t) => ["prix","stock","panier","promo","ajouter au panier","livraison","en stock","démonter","remonter","symptôme","panne","qu'est-ce que","meilleur choix avant achat"].filter((k) => t.toLowerCase().includes(k)),
  "mandat (prix, achat, achetez, stock, livraison, promo, pas cher, €)": (t) => ["prix","achat","achetez","stock","livraison","promo","pas cher","€"].filter((k) => t.toLowerCase().includes(k)),
  "procédure de montage": (t) => (t.match(/\b(mont(er|age|é)|démont\w*|remont\w*|install\w*|étapes?|remplac\w*|chang(er|ement)|serr(er|age)|vidange|outil\w*|dévisser|visser)\b/giu) || []),
  "garde front r1-copy-gate.ts": (t) => [/\b(vérifier|contrôler|remplacer)\s+(si|s[''']|en cas|l[''']état|leurs?|régulièrement)/i,/\b(bruit|vibration|crissement|grincement|frotte|fuit|fuite|claque|grince|lâche)/i,/\b(usure|usé|usée|usées|fissuré|voilé|coincé|bloqué|tordu|cassé|mort|défaillant|défectueux|hs)\b/i,/\b(témoin|voyant)\s+(allumé|d[''']usure)/i,/\b(épaisseur|limite)\s+d[''']usure/i,/\btous\s+les\s+\d+\s*0{3}\s*km/i,/\bdurée\s+de\s+vie\b/i,/\bchanger\s+soi-même\b/i].filter((re) => re.test(t)).map(String),
};
const out = {};
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const hits = {};
  for (const [name, fn] of Object.entries(lists)) hits[name] = j.cards.map((c) => ({ phrase: c.phrase, hit: fn(c.phrase) })).filter((x) => x.hit.length);
  out[j.url] = { n: j.cards.length, hits };
}
console.log(JSON.stringify(out, null, 2));
