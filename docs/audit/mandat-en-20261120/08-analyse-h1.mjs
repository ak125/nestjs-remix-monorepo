// Mandat EN — H1 R2 actuel (reproduit) et proposé, sur toutes les pages du
// sitemap R2. Lit les exports 01, 02, 03, 05, 06, 07 et les titres #2212 du
// dossier DW ; n'écrit que dans le dossier de sortie.
// Usage : tsx 08-analyse-h1.mjs <dossier exports> <titres DW .tsv.gz> <sortie>
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  buildR2H1Emitted, buildR2CleanH1, resolveR2H1Level,
} from "../../../packages/seo-types/src/build-r2-h1.ts";
import { pickR2TitleMotorCode, r2TitleCollisionKey } from "../../../packages/seo-types/src/vehicle-aware-label.ts";

const [dir, dwTitles, out] = process.argv.slice(2);
const parse = (text) => {
  const [head, ...rows] = text.replace(/\r/g, "").trimEnd().split("\n");
  const cols = head.split("\t");
  return rows.map((r) => Object.fromEntries(r.split("\t").map((v, i) => [cols[i], v])));
};
const tsv = (f) => parse(readFileSync(`${dir}/${f}`, "utf8"));
// Entités HTML : mêmes cas que decodeHtmlEntities (backend/src/utils/html-entities.ts)
// utiles ici (contenus de switch et texte du crawl).
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô",
  icirc: "î", iuml: "ï", ucirc: "û", ugrave: "ù", Eacute: "É", euml: "ë", oelig: "œ", laquo: "«", raquo: "»" };
const decode = (s) => (s ?? "")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m);
const key = (s) => r2TitleCollisionKey(decode(s));

const types = new Map(tsv("02-export-types.tsv").map((t) => [t.type_id, t]));
const vehicle = (t) => ({
  typeId: t.type_id, marqueName: t.marque_name, modeleName: t.modele_name,
  modeleNameMeta: t.modele_name_meta, typeName: t.type_name,
  typeNameMeta: t.type_name_meta, powerPs: t.type_power_ps, fuel: t.type_fuel,
});
const pages = tsv("01-export-pages.tsv");
const switch2 = new Map();
for (const s of tsv("03-export-switch2.tsv")) {
  if (!switch2.has(s.sgcs_pg_id)) switch2.set(s.sgcs_pg_id, []);
  switch2.get(s.sgcs_pg_id).push(decode(s.content));
}
const dw = new Map(parse(gunzipSync(readFileSync(dwTitles)).toString("utf8"))
  .map((r) => [`${r.pg_id}:${r.type_id}`, r]));
const crawl = new Map(tsv("06-crawl-r2.tsv").map((r) => [r.url, r]));

// Types ayant des pièces dans la gamme : pages du sitemap + candidats vérifiés.
const withPieces = new Map();
const addPieces = (pg, type) => {
  if (!withPieces.has(pg)) withPieces.set(pg, new Set());
  withPieces.get(pg).add(type);
};
for (const p of pages) addPieces(p.pg_id, p.type_id);
for (const c of tsv("05-pieces-candidats.tsv")) addPieces(c.pg_id, c.type_id);
// Index par gamme et par clé de niveau 0.
const l0 = (t) => r2TitleCollisionKey(buildR2CleanH1("", vehicle(t), 0));
const groups = new Map();
for (const [pg, set] of withPieces) {
  for (const id of set) {
    const t = types.get(id);
    if (!t) continue;
    const k = `${pg}|${l0(t)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(vehicle(t));
  }
}

// Départage du titre (complément 1 et 2 de DW) parmi les types de même H1 de
// niveau 0 ayant des pièces : code moteur, sinon noms bruts, sinon rien.
const codesOf = (id) => (types.get(id)?.motor_codes ?? "").split("|").filter(Boolean);
const departage = (v, siblings) => {
  const others = siblings.filter((s) => s.typeId !== v.typeId);
  const label = (s, raw) => r2TitleCollisionKey(buildR2CleanH1("", s, 2, { motorCode: "", rawNames: raw }));
  for (const raw of [false, true]) {
    const colliding = others.filter((s) => label(s, raw) === label(v, raw));
    if (colliding.length === 0) return { motorCode: "", rawNames: raw };
    const code = pickR2TitleMotorCode(codesOf(v.typeId), colliding.map((s) => codesOf(s.typeId)));
    if (code) return { motorCode: code, rawNames: raw };
  }
  return { motorCode: "", rawNames: true };
};

const rows = [];
for (const p of pages) {
  const t = types.get(p.type_id);
  const v = vehicle(t);
  const url = `/pieces/${p.pg_alias}-${p.pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.type_id}.html`;
  const d = dw.get(`${p.pg_id}:${p.type_id}`);
  // Fragments chargés seulement quand la gamme a un gabarit (rm-builder,
  // étape SEO sous `if (seoTemplates && seoCtx)`) ; sinon rotation prix.
  const avecGabarit = d?.source_titre === "migration";
  const actuel = buildR2H1Emitted({
    gammeName: p.pg_name, marque: t.marque_name, modele: t.modele_name,
    typeName: t.type_name, typePowerPs: t.type_power_ps, typeFuel: t.type_fuel,
    ctx: { typeId: Number(p.type_id), pgId: Number(p.pg_id) },
    compSwitch2: avecGabarit ? (switch2.get(p.pg_id) ?? []) : [],
  });
  const siblings = groups.get(`${p.pg_id}|${l0(t)}`) ?? [];
  const niveau = resolveR2H1Level(v, siblings);
  const titre = d ? d.nouveau_titre : "";
  // Niveau 2 : le titre #2212 sur les gammes à gabarit ; ailleurs, le même
  // départage que R2TitleCollisionService.resolveTitle(pg, type, true).
  const propose = niveau === 2 && avecGabarit
    ? titre
    : buildR2CleanH1(p.pg_name, v, niveau, niveau === 2 ? departage(v, siblings) : undefined);
  const c = crawl.get(url);
  rows.push({
    pg_id: p.pg_id, type_id: p.type_id, url, indexable: p.indexable,
    marque: t.marque_name, gamme: p.pg_name,
    h1_actuel_reproduit: actuel, h1_servi_crawl: c ? decode(c.h1_servi) : "",
    crawl_utc: c ? c.releve_utc : "", titre_2212: titre, source_titre: d?.source_titre ?? "",
    niveau, h1_propose: propose, longueur_actuel: [...actuel].length,
    longueur_propose: [...propose].length,
    types_meme_h1_niveau0: siblings.filter((s) => s.typeId !== p.type_id).map((s) => s.typeId).join(" "),
  });
}
const cols = Object.keys(rows[0]);
writeFileSync(`${out}/h1-r2-toutes-pages.tsv.gz`, gzipSync(
  [cols.join("\t"), ...rows.map((r) => cols.map((c) => r[c]).join("\t"))].join("\n") + "\n"));

// --- Mesures -------------------------------------------------------------
const lines = [];
const say = (...a) => lines.push(a.join("\t"));
const idx = rows.filter((r) => r.indexable === "t");
say("mesure", "servables", "indexables");
say("pages", rows.length, idx.length);
for (const n of [0, 1, 2]) say(`niveau_${n}`, rows.filter((r) => r.niveau === n).length, idx.filter((r) => r.niveau === n).length);

// Parité de la reproduction avec le H1 servi (crawl PROD).
const crawled = rows.filter((r) => r.h1_servi_crawl);
const same = crawled.filter((r) => r.h1_servi_crawl === r.h1_actuel_reproduit);
say("parite_h1_actuel_crawl", `${same.length}/${crawled.length}`, "");
writeFileSync(`${out}/parite-ecarts.tsv`, "url\th1_servi_crawl\th1_actuel_reproduit\tcrawl_utc\n" +
  crawled.filter((r) => r.h1_servi_crawl !== r.h1_actuel_reproduit).slice(0, 200)
    .map((r) => [r.url, r.h1_servi_crawl, r.h1_actuel_reproduit, r.crawl_utc].join("\t")).join("\n") + "\n");

// Doublons de H1 sur l'ensemble du site R2.
const dupes = (field, set, ref = rows) => {
  const count = new Map();
  for (const r of ref) { const k = key(r[field]); count.set(k, (count.get(k) ?? 0) + 1); }
  const inDup = set.filter((r) => count.get(key(r[field])) > 1);
  const groupsN = new Set(inDup.map((r) => key(r[field]))).size;
  return { pages: inDup.length, groups: groupsN, inDup };
};
for (const r of rows) {
  const t = types.get(r.type_id);
  r.h1_actuel_sans_accroche = buildR2H1Emitted({
    gammeName: r.gamme, marque: t.marque_name, modele: t.modele_name, typeName: t.type_name,
    typePowerPs: t.type_power_ps, typeFuel: t.type_fuel, ctx: { typeId: 0, pgId: 0 },
    compSwitch2: ["X"],
  }).replace(/ X$/, "");
}
for (const [label, field] of [["h1_actuel", "h1_actuel_reproduit"], ["h1_actuel_sans_accroche", "h1_actuel_sans_accroche"], ["titre_2212", "titre_2212"], ["h1_propose", "h1_propose"]]) {
  const s = dupes(field, rows), i = dupes(field, idx, rows);
  say(`doublons_${label}_pages`, s.pages, i.pages);
  say(`doublons_${label}_groupes`, s.groups, i.groups);
}
const restants = dupes("h1_propose", rows).inDup.sort((a, b) => key(a.h1_propose).localeCompare(key(b.h1_propose)));
writeFileSync(`${out}/doublons-restants.tsv`, "h1_propose\tpg_id\ttype_id\tindexable\turl\n" +
  restants.map((r) => [r.h1_propose, r.pg_id, r.type_id, r.indexable, r.url].join("\t")).join("\n") + "\n");

// H1 proposé égal au titre ; longueurs.
say("h1_propose_egal_titre_2212", rows.filter((r) => r.titre_2212 && key(r.titre_2212) === key(r.h1_propose)).length,
  idx.filter((r) => r.titre_2212 && key(r.titre_2212) === key(r.h1_propose)).length);
const dist = (arr, f) => {
  const v = arr.map((r) => r[f]).sort((a, b) => a - b);
  const q = (x) => v[Math.min(v.length - 1, Math.floor(x * v.length))];
  const b = (lo, hi) => v.filter((x) => x >= lo && x <= hi).length;
  return `min ${v[0]} | médiane ${q(0.5)} | p90 ${q(0.9)} | max ${v[v.length - 1]} | ≤40 ${b(0, 40)} | 41-60 ${b(41, 60)} | 61-70 ${b(61, 70)} | 71-80 ${b(71, 80)} | >80 ${b(81, 1e9)}`;
};
say("longueur_h1_actuel", dist(rows, "longueur_actuel"), dist(idx, "longueur_actuel"));
say("longueur_h1_propose", dist(rows, "longueur_propose"), dist(idx, "longueur_propose"));

// Cannibalisation : égalité avec un H1 ou titre R1, R3, R8.
const autres = tsv("07-autres-roles.tsv");
const autresKeys = new Map();
for (const a of autres) { const k = key(a.regexp_replace ?? Object.values(a)[2]); if (!autresKeys.has(k)) autresKeys.set(k, `${a.role}:${a.source}`); }
const canni = rows.filter((r) => autresKeys.has(key(r.h1_propose)));
const canniAvant = rows.filter((r) => autresKeys.has(key(r.h1_actuel_reproduit)));
say("cannibalisation_egalite_R1_R3_R8_avant", canniAvant.length, "");
say("cannibalisation_egalite_R1_R3_R8_apres", canni.length, "");
// Le H1 R2 contient-il un H1 R1 de sa gamme à l'identique (attendu : oui, c'est sa racine) ?
say("textes_autres_roles", autres.length, autresKeys.size);
writeFileSync(`${out}/mesures.tsv`, lines.join("\n") + "\n");
console.log(lines.join("\n"));
