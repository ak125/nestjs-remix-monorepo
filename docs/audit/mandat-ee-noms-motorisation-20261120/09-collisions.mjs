// Mandat EE, point 6.6 : une correction ne doit rendre identique ni le nom R8 ni
// le titre R2 (#2212) de deux motorisations. Rejouable, lecture de fichiers seulement.
// Usage : node 09-collisions.mjs <classement.tsv> <voisins.tsv> <vehicle-aware-label.ts de #2212> <exclusions.tsv>
//   stdout : une ligne par erreur (avant/après, verdict 6.6) ; <exclusions.tsv> : corrections écartées.
// Module de #2212 chargé tel quel (head 10eb48d0, sha256 fb778f72…).
//
// Règle : une page « unique » avant (aucune autre motorisation de même nom) ne
// doit pas cesser de l'être. Une page déjà en doublon qui change de partenaire
// n'aggrave rien. Une correction qui fait perdre l'unicité à une page est
// écartée de la migration ; on recalcule jusqu'à stabilité.
// - Nom R8 : même modèle, même type_name_meta (casse et espaces ignorés) ; le
//   <title> R8 ne porte pas la puissance (r8-transform.ts:146).
// - Titre R2 : même marque, modèle de même nom brut ou affiché, même
//   buildR2TitleTypeLabel sur les noms d'affichage (complément 2 de #2212).
//   Critère plus strict que #2212, qui exige en plus des pièces dans la même gamme.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [classementPath, voisinsPath, labelPath, exclusionsPath] = process.argv.slice(2);
const L = await import(pathToFileURL(labelPath).href);
const K = L.r2TitleCollisionKey;
const tsv = (p) => {
  const [h, ...rows] = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
  const cols = h.split("\t");
  return rows.map((r) => Object.fromEntries(r.split("\t").map((v, i) => [cols[i], v])));
};
const erreurs = new Map(tsv(classementPath).filter((r) => r.verdict === "erreur").map((r) => [r.type_id, r.valeur_corrigee]));
const types = tsv(voisinsPath);
const byId = new Map(types.map((t) => [t.type_id, t]));
const absents = [...erreurs.keys()].filter((id) => !byId.has(id));
if (absents.length) throw new Error(`erreurs absentes des types affichés : ${absents}`);

const modeles = new Map(types.map((t) => [t.type_modele_id, t]));
const nomModele = (m) => K(m.modele_name);
const nomModeleAff = (m) => K(L.pickVehicleDisplayName(m.modele_name_meta, m.modele_name));
// Modèles voisins au sens de #2212 (nom brut ou affiché égal, même marque).
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
const meta = (t, appl) => (appl.has(t.type_id) ? erreurs.get(t.type_id) : t.type_name_meta);
const r8 = (t, appl) => K(L.pickVehicleDisplayName(meta(t, appl), t.type_name));
const r2 = (t, appl) => K(`${L.pickVehicleDisplayName(t.modele_name_meta, t.modele_name)} ${L.buildR2TitleTypeLabel({
  typeName: L.pickVehicleDisplayName(meta(t, appl), t.type_name), powerPs: t.type_power_ps ?? "", fuel: t.type_fuel ?? "" })}`);
const voisinsR8 = (t) => parModele.get(t.type_modele_id).filter((o) => o.type_id !== t.type_id);
const voisinsR2 = (t) => voisinsModele.get(t.type_modele_id).flatMap((id) => parModele.get(id)).filter((o) => o.type_id !== t.type_id);
const memes = (t, appl, cle, vois) => vois(t).filter((o) => cle(o, appl) === cle(t, appl)).map((o) => o.type_id);

// Pages à examiner : erreurs et types des modèles voisins (seules pages dont l'état peut changer).
const examen = new Set();
for (const id of erreurs.keys()) for (const mid of voisinsModele.get(byId.get(id).type_modele_id)) for (const t of parModele.get(mid)) examen.add(t.type_id);
const aucun = new Set();
const avant = new Map([...examen].map((id) => { const t = byId.get(id);
  return [id, { r8: memes(t, aucun, r8, voisinsR8), r2: memes(t, aucun, r2, voisinsR2) }]; }));

const appl = new Set(erreurs.keys());
const exclues = new Map();
for (let tour = 1; ; tour++) {
  const nouvelles = new Map();
  for (const id of examen) {
    const t = byId.get(id);
    for (const [nom, cle, vois] of [["R8", r8, voisinsR8], ["R2", r2, voisinsR2]]) {
      if (avant.get(id)[nom.toLowerCase()].length) continue;      // déjà en doublon avant
      const ap = memes(t, appl, cle, vois);
      if (!ap.length) continue;                                     // toujours unique
      // Responsable : la page elle-même si elle est corrigée, sinon les corrections venues sur son nom.
      const resp = appl.has(id) ? [id] : ap.filter((o) => appl.has(o));
      for (const r of resp) if (!nouvelles.has(r)) nouvelles.set(r, `${nom} : type ${id} « ${cle(t, appl)} » deviendrait identique à ${ap.join(",")} (tour ${tour})`);
    }
  }
  if (!nouvelles.size) break;
  for (const [id, motif] of nouvelles) { appl.delete(id); exclues.set(id, motif); }
}

const enTete = ["type_id", "modele", "type_name", "meta_actuel", "valeur_corrigee", "r8_meme_nom_avant", "r8_meme_nom_apres",
  "r2_meme_titre_avant", "r2_meme_titre_apres", "verdict_6_6", "motif"];
console.log(enTete.join("\t"));
const bilan = { erreurs: erreurs.size, retenues: 0, exclues: exclues.size, pages_examinees: examen.size,
  r8_doublons_avant: 0, r8_doublons_apres: 0, r2_doublons_avant: 0, r2_doublons_apres: 0 };
for (const id of examen) {
  const t = byId.get(id);
  bilan.r8_doublons_avant += avant.get(id).r8.length > 0; bilan.r2_doublons_avant += avant.get(id).r2.length > 0;
  bilan.r8_doublons_apres += memes(t, appl, r8, voisinsR8).length > 0; bilan.r2_doublons_apres += memes(t, appl, r2, voisinsR2).length > 0;
}
for (const id of [...erreurs.keys()].sort((a, b) => a - b)) {
  const t = byId.get(id);
  const ok = appl.has(id); bilan.retenues += ok;
  console.log([id, t.modele_name, t.type_name, t.type_name_meta, erreurs.get(id), avant.get(id).r8.join(","),
    memes(t, appl, r8, voisinsR8).join(","), avant.get(id).r2.join(","), memes(t, appl, r2, voisinsR2).join(","),
    ok ? "retenue" : "écartée", exclues.get(id) ?? ""].join("\t"));
}
writeFileSync(exclusionsPath, ["type_id\tmotif", ...[...exclues].sort((a, b) => a[0] - b[0]).map(([i, m]) => `${i}\t${m}`)].join("\n") + "\n");
console.error(JSON.stringify(bilan));
