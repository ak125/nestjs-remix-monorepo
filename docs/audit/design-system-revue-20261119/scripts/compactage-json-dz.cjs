// Mandat DZ — 6.6 : réécrit les fichiers mesures/*.json sans indentation pour tenir sous 20 Mo.
// Contenu inchangé : chaque fichier est relu après écriture et comparé à l'original (JSON.parse, égalité profonde).
// Usage (depuis docs/audit/design-system-revue-20261119) : node scripts/compactage-json-dz.cjs
const fs = require("node:fs");
const assert = require("node:assert");
let avant = 0, apres = 0;
for (const f of fs.readdirSync("mesures").filter((x) => x.endsWith(".json"))) {
  const p = "mesures/" + f, s = fs.readFileSync(p, "utf8"), o = JSON.parse(s), c = JSON.stringify(o);
  fs.writeFileSync(p, c); assert.deepStrictEqual(JSON.parse(fs.readFileSync(p, "utf8")), o);
  avant += Buffer.byteLength(s); apres += Buffer.byteLength(c);
}
console.log(JSON.stringify({ avant, apres }));
