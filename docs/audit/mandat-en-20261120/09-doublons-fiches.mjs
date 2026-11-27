// Mandat EN — fiches de type homonymes en base : types affichés de même
// marque et de même libellé complet (modèle, type, carburant, puissance), en
// noms d'affichage ET en noms bruts. Seul le code moteur peut alors les
// départager ; s'il est identique aussi, rien ne les distingue (colonne
// meme_code). Comptage et liste seulement (hors périmètre du mandat).
// Usage : tsx 09-doublons-fiches.mjs <dossier exports> <sortie>
import { readFileSync, writeFileSync } from "node:fs";
import { buildR2CleanH1 } from "../../../packages/seo-types/src/build-r2-h1.ts";
import { r2TitleCollisionKey } from "../../../packages/seo-types/src/vehicle-aware-label.ts";

const [dir, out] = process.argv.slice(2);
const tsv = (f) => {
  const [head, ...rows] = readFileSync(`${dir}/${f}`, "utf8").replace(/\r/g, "").trimEnd().split("\n");
  const cols = head.split("\t");
  return rows.map((r) => Object.fromEntries(r.split("\t").map((v, i) => [cols[i], v])));
};
const types = tsv("02-export-types.tsv");
const sitemapTypes = new Set(tsv("01-export-pages.tsv").map((p) => p.type_id));
const firstCode = (t) => (t.motor_codes || "").split("|").map((c) => c.trim()).filter(Boolean).sort()[0] ?? "";
const groups = new Map();
for (const t of types) {
  const v = { typeId: t.type_id, marqueName: t.marque_name, modeleName: t.modele_name,
    modeleNameMeta: t.modele_name_meta, typeName: t.type_name, typeNameMeta: t.type_name_meta,
    powerPs: t.type_power_ps, fuel: t.type_fuel };
  const k = [r2TitleCollisionKey(buildR2CleanH1("", v, 2)),
    r2TitleCollisionKey(buildR2CleanH1("", v, 2, { motorCode: "", rawNames: true }))].join("|");
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(t);
}
const dup = [...groups.values()].filter((g) => g.length > 1);
const rows = [];
const sameCode = (g) => new Set(g.map(firstCode)).size < g.length;
dup.forEach((g, i) => g.forEach((t) => rows.push([i + 1, sameCode(g) ? "oui" : "non", t.type_id, t.marque_name, t.modele_name,
  t.type_name, t.type_name_meta, t.type_power_ps, t.type_fuel, t.year_from, t.year_to,
  t.motor_codes, sitemapTypes.has(t.type_id) ? "oui" : "non"].join("\t"))));
writeFileSync(`${out}/doublons-fiches-base.tsv`,
  "groupe\tmeme_code\ttype_id\tmarque\tmodele\ttype_name\ttype_name_meta\tpuissance\tcarburant\tannee_debut\tannee_fin\tcodes_moteur\tdans_sitemap\n" + rows.join("\n") + "\n");
const inMap = dup.filter((g) => g.filter((t) => sitemapTypes.has(t.type_id)).length > 1).length;
const oneInMap = dup.filter((g) => g.filter((t) => sitemapTypes.has(t.type_id)).length === 1).length;
console.log(`meme_code_groupes=${dup.filter(sameCode).length} `);
console.log(`groupes=${dup.length} types=${rows.length} groupes_2plus_dans_sitemap=${inMap} groupes_1_dans_sitemap=${oneInMap} groupes_hors_sitemap=${dup.length - inMap - oneInMap}`);
