// Complément n° 13 au mandat DS : contenus répétés entre deux pages R8 sœurs (même modèle, motorisations différentes).
// Entrée : deux relevés ssr-r8.cjs. Pour chaque bloc data-section commun : texte identique, identique une fois
// neutralisés les faits propres au type (puissance, type_id, codes moteur, années), ou différent ; part de phrases
// communes (phrases ≥ 6 mots). Aucune requête réseau.
// Usage : node compare-r8.cjs <releve-A.json> <releve-B.json> <sortie.json>
const fs = require("node:fs");
const [, , fa, fb, out] = process.argv;
const A = JSON.parse(fs.readFileSync(fa, "utf8")), B = JSON.parse(fs.readFileSync(fb, "utf8"));
const neutre = (s) => s.replace(/\b\d{4,6}\b/g, "#").replace(/\b\d{2,3}\s?(ch|kw|cv)\b/gi, "# ch").replace(/K9K\s?\d{3}/g, "K9K #").replace(/\b\d+\b/g, "#");
const phrases = (s) => s.split(/(?<=[.!?:])\s+|\s{2,}|\s[|•·]\s/).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 6);
const res = { a: A.url, b: B.url, blocs: [] };
for (const id of A.blocs.filter((x) => B.blocs.includes(x))) {
  const ta = A.texteParBloc[id] || "", tb = B.texteParBloc[id] || "";
  const pa = phrases(ta), pb = new Set(phrases(tb));
  const communes = pa.filter((p) => pb.has(p)).length;
  res.blocs.push({ id, motsA: ta.split(/\s+/).length, motsB: tb.split(/\s+/).length,
    etat: ta === tb ? "identique" : neutre(ta) === neutre(tb) ? "identique hors faits du type" : "différent",
    phrasesA: pa.length, phrasesCommunes: communes });
}
res.titleIdentiqueHorsSuffixe = A.title.replace(/ (à prix discount|en promotion|.*)$/, "") === B.title.replace(/ (à prix discount|en promotion|.*)$/, "");
fs.writeFileSync(out, JSON.stringify(res, null, 2));
console.log(`== ${A.url}\n   vs ${B.url}`);
for (const b of res.blocs) console.log(`   ${b.id.padEnd(14)} ${b.etat.padEnd(28)} mots ${b.motsA}/${b.motsB} phrases communes ${b.phrasesCommunes}/${b.phrasesA}`);
