// Mandat EN — étape 1 : types affichés hors sitemap dont le H1 de niveau 0
// égale celui d'une page du sitemap de la même gamme. Leur présence de pièces
// dans la gamme est ensuite vérifiée en base (05-pieces-candidats.sql).
// Usage : tsx 04-candidats-hors-sitemap.mjs <dossier des exports>
import { readFileSync, writeFileSync } from "node:fs";
import { buildR2H1VehicleLabel } from "../../../packages/seo-types/src/build-r2-h1.ts";
import { r2TitleCollisionKey } from "../../../packages/seo-types/src/vehicle-aware-label.ts";

const dir = process.argv[2];
const tsv = (f) => {
  const [head, ...rows] = readFileSync(`${dir}/${f}`, "utf8").trimEnd().split("\n");
  const cols = head.split("\t");
  return rows.map((r) => Object.fromEntries(r.split("\t").map((v, i) => [cols[i], v])));
};
const types = new Map(tsv("02-export-types.tsv").map((t) => [t.type_id, t]));
const vehicle = (t) => ({
  typeId: t.type_id, marqueName: t.marque_name, modeleName: t.modele_name,
  modeleNameMeta: t.modele_name_meta, typeName: t.type_name,
  typeNameMeta: t.type_name_meta, powerPs: t.type_power_ps, fuel: t.type_fuel,
});
const k0 = (t) => r2TitleCollisionKey(buildR2H1VehicleLabel(vehicle(t), 0));
const byKey = new Map();
for (const t of types.values()) {
  const k = k0(t);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(t.type_id);
}
const pages = tsv("01-export-pages.tsv");
const inSitemap = new Set(pages.map((p) => `${p.pg_id}:${p.type_id}`));
const pairs = new Set();
for (const p of pages) {
  const t = types.get(p.type_id);
  for (const id of byKey.get(k0(t)) ?? []) {
    if (id !== p.type_id && !inSitemap.has(`${p.pg_id}:${id}`)) pairs.add(`${p.pg_id}\t${id}`);
  }
}
writeFileSync(`${dir}/04-candidats.tsv`, "pg_id\ttype_id\n" + [...pairs].join("\n") + "\n");
console.log(`pages=${pages.length} types=${types.size} cles_niveau0=${byKey.size} paires_hors_sitemap=${pairs.size}`);
