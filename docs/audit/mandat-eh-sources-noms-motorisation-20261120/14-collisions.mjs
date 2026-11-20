// Mandat EH, 6.5 : contrôle de doublons des deux migrations (nom d'affichage et
// nom d'origine) avec la règle de 09-collisions.mjs (mandat EE) et le module de
// #2212 fusionné (packages/seo-types/src/vehicle-aware-label.ts, sha256 fb778f72…).
// Rejouable, lecture de fichiers seulement.
// Usage : node 14-collisions.mjs <decisions.tsv> <voisins.tsv> <vehicle-aware-label.ts> <exclusions.tsv>
//   stdout : une ligne par correction (avant/après, verdict) ; <exclusions.tsv> : corrections écartées.
//
// Différence avec 09 : une correction peut changer type_name ET type_name_meta.
// On contrôle donc trois clés, toutes au sens de #2212 (r2TitleCollisionKey) :
// - Nom R8 (<title>) : même modèle, même nom d'affichage pickVehicleDisplayName(meta, type_name).
// - H1 R8 : même modèle, même « type_name puissance ch » : le H1 servi est
//   `marque modèle type_name puissance ch dates` (frontend/app/components/vehicle/r8/r8-transform.ts:150).
//   Les dates ne sont pas comparées : la clé est plus stricte que le H1 réel.
// - Titre R2 : modèles voisins (même marque, nom brut ou affiché égal), même
//   buildR2TitleTypeLabel sur le nom d'affichage.
// Règle inchangée : une page unique avant ne doit pas cesser de l'être ; une
// correction qui fait perdre l'unicité est écartée ; on recalcule jusqu'à stabilité.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [decisionsPath, voisinsPath, labelPath, exclusionsPath] = process.argv.slice(2);
const L = await import(pathToFileURL(labelPath).href);
const K = L.r2TitleCollisionKey;
const tsv = (p) => {
  const [h, ...rows] = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
  const cols = h.split("\t");
  return rows.map((r) => Object.fromEntries(r.split("\t").map((v, i) => [cols[i], v])));
};
const corr = new Map(tsv(decisionsPath).filter((r) => r.migration === "affichage" || r.migration === "origine")
  .map((r) => [r.type_id, { nom: r.type_name_apres, meta: r.meta_apres, migration: r.migration }]));
const types = tsv(voisinsPath);
const byId = new Map(types.map((t) => [t.type_id, t]));
const absents = [...corr.keys()].filter((id) => !byId.has(id));
if (absents.length) throw new Error(`corrections absentes des types affichés : ${absents}`);

const modeles = new Map(types.map((t) => [t.type_modele_id, t]));
const nomModele = (m) => K(m.modele_name);
const nomModeleAff = (m) => K(L.pickVehicleDisplayName(m.modele_name_meta, m.modele_name));
const voisinsModele = new Map();
for (const m of modeles.values()) {
  voisinsModele.set(m.type_modele_id, [...modeles.values()].filter((o) =>
    o.modele_marque_id === m.modele_marque_id &&
    (o.type_modele_id === m.type_modele_id || o.modele_display === "1") &&
    (nomModele(o) === nomModele(m) || nomModeleAff(o) === nomModeleAff(m))).map((o) => o.type_modele_id));
}
const parModele = new Map();
for (const t of types) {
  if (!parModele.has(t.type_modele_id)) parModele.set(t.type_modele_id, []);
  parModele.get(t.type_modele_id).push(t);
}
const nom = (t, appl) => (appl.has(t.type_id) ? corr.get(t.type_id).nom : t.type_name);
const meta = (t, appl) => (appl.has(t.type_id) ? corr.get(t.type_id).meta : t.type_name_meta);
const aff = (t, appl) => L.pickVehicleDisplayName(meta(t, appl), nom(t, appl));
const r8 = (t, appl) => K(aff(t, appl));
const h1 = (t, appl) => K(`${nom(t, appl)} ${t.type_power_ps} ch`);
const r2 = (t, appl) => K(`${L.pickVehicleDisplayName(t.modele_name_meta, t.modele_name)} ${L.buildR2TitleTypeLabel({
  typeName: aff(t, appl), powerPs: t.type_power_ps ?? "", fuel: t.type_fuel ?? "" })}`);
const voisinsR8 = (t) => parModele.get(t.type_modele_id).filter((o) => o.type_id !== t.type_id);
const voisinsR2 = (t) => voisinsModele.get(t.type_modele_id).flatMap((id) => parModele.get(id)).filter((o) => o.type_id !== t.type_id);
const memes = (t, appl, cle, vois) => vois(t).filter((o) => cle(o, appl) === cle(t, appl)).map((o) => o.type_id);
const CLES = [["R8", r8, voisinsR8], ["H1", h1, voisinsR8], ["R2", r2, voisinsR2]];

const examen = new Set();
for (const id of corr.keys()) for (const mid of voisinsModele.get(byId.get(id).type_modele_id)) for (const t of parModele.get(mid)) examen.add(t.type_id);
const aucun = new Set();
const avant = new Map([...examen].map((id) => { const t = byId.get(id);
  return [id, Object.fromEntries(CLES.map(([n, c, v]) => [n, memes(t, aucun, c, v)]))]; }));

const appl = new Set(corr.keys());
const exclues = new Map();
for (let tour = 1; ; tour++) {
  const nouvelles = new Map();
  for (const id of examen) {
    const t = byId.get(id);
    for (const [n, cle, vois] of CLES) {
      if (avant.get(id)[n].length) continue;
      const ap = memes(t, appl, cle, vois);
      if (!ap.length) continue;
      const resp = appl.has(id) ? [id] : ap.filter((o) => appl.has(o));
      for (const r of resp) if (!nouvelles.has(r)) nouvelles.set(r, `${n} : type ${id} « ${cle(t, appl)} » deviendrait identique à ${ap.join(",")} (tour ${tour})`);
    }
  }
  if (!nouvelles.size) break;
  for (const [id, motif] of nouvelles) { appl.delete(id); exclues.set(id, motif); }
}

console.log(["type_id", "migration", "type_name", "meta_actuel", "type_name_apres", "meta_apres",
  "r8_avant", "r8_apres", "h1_avant", "h1_apres", "r2_avant", "r2_apres", "verdict", "motif"].join("\t"));
const bilan = { corrections: corr.size, retenues: 0, exclues: exclues.size, pages_examinees: examen.size };
for (const [n] of CLES) { bilan[`${n}_doublons_avant`] = 0; bilan[`${n}_doublons_apres`] = 0; }
for (const id of examen) {
  const t = byId.get(id);
  for (const [n, c, v] of CLES) { bilan[`${n}_doublons_avant`] += avant.get(id)[n].length > 0; bilan[`${n}_doublons_apres`] += memes(t, appl, c, v).length > 0; }
}
for (const id of [...corr.keys()].sort((a, b) => a - b)) {
  const t = byId.get(id); const c = corr.get(id);
  const ok = appl.has(id); bilan.retenues += ok;
  console.log([id, c.migration, t.type_name, t.type_name_meta, c.nom, c.meta,
    ...CLES.flatMap(([n, k, v]) => [avant.get(id)[n].join(","), memes(t, appl, k, v).join(",")]),
    ok ? "retenue" : "écartée", exclues.get(id) ?? ""].join("\t"));
}
console.error(JSON.stringify(bilan));
writeFileSync(exclusionsPath, ["type_id\tmotif", ...[...exclues].sort((a, b) => a[0] - b[0]).map(([i, m]) => `${i}\t${m}`)].join("\n") + "\n");
