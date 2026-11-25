#!/usr/bin/env node
// Complément n° 2 DZ — condensation des mesures AVANT / A / B (30 JSON hors dépôt) et des captures (10 JSON du dépôt).
// Usage : node scripts/condense-options-dz.cjs <dossier-mesures-hors-depot> <dossier-options>
//   <dossier-mesures-hors-depot>/{avant,a,b}/mesures/<id>-<W>.json (mesure-dz.cjs enveloppé par mesure-option-dz.cjs)
// Écrit <options>/mesures/synthese-options-dz.json, synthese-options-dz.md et copie les journaux d'injection.
// Lecture seule : aucun accès réseau.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const [SRC, OPT] = process.argv.slice(2);
const V = ["avant", "a", "b"], NOM = { avant: "AVANT", a: "A", b: "B" };
const pages = fs.readFileSync(path.join(OPT, "scripts/pages-options-dz.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t")[0]);
const passages = pages.flatMap((id) => [390, 1440].map((w) => `${id}-${w}`));
fs.mkdirSync(path.join(OPT, "mesures/injection"), { recursive: true });

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const out = { genere: new Date().toISOString(), sources: {}, defauts: {}, axe: {}, residus: {}, boutons: {} };

for (const p of passages) {
  out.defauts[p] = {}; out.axe[p] = {};
  for (const v of V) {
    const f = path.join(SRC, v, "mesures", `${p}.json`);
    if (!fs.existsSync(f)) { out.defauts[p][NOM[v]] = null; continue; }
    out.sources[`${v}/${p}`] = { sha256: sha(f), debut: JSON.parse(fs.readFileSync(f)).debut };
    const d = JSON.parse(fs.readFileSync(f));
    const textes = d.textes.liste.filter((t) => t.defaut);
    const bords = d.bords.filter((b) => b.defaut);
    const focus = d.focus.filter((x) => x.indicateurVisible === false || x.indicateur3a1 === false || x.pointsCaches > 0);
    const cc = d.axe.violations.find((x) => x.id === "color-contrast");
    out.defauts[p][NOM[v]] = {
      textes: textes.length, bords: bords.length, focus: focus.length, axeContraste: cc ? cc.noeuds : 0,
      exemplesTextes: textes.slice(0, 6).map((t) => ({ texte: (t.texte || "").slice(0, 40), fg: t.fg, bg: t.bg, ratio: t.ratioRetenu ?? t.ratio, seuil: t.seuil, classes: t.classes })),
      exemplesBords: bords.slice(0, 4).map((b) => ({ type: b.type, texte: (b.texte || "").slice(0, 30), bord: b.bord, fondAutour: b.fondAutour, ratio: b.ratioBord })),
      exemplesFocus: focus.slice(0, 6).map((x) => ({ texte: (x.texte || "").slice(0, 30), zone: x.zone, visible: x.indicateurVisible, a3: x.indicateur3a1, caches: x.pointsCaches, outline: x.outline })),
    };
    out.axe[p][NOM[v]] = d.axe.violations.map((x) => `${x.id}:${x.noeuds}`);
    const inj = path.join(SRC, v, "mesures", `injection-${p}.json`);
    if (fs.existsSync(inj)) fs.copyFileSync(inj, path.join(OPT, "mesures/injection", `${v}-${p}.json`));
  }
  const c = JSON.parse(fs.readFileSync(path.join(OPT, "mesures", `captures-${p}.json`)));
  out.residus[p] = Object.fromEntries(V.map((v) => [NOM[v], { repos: c.variantes[v].residus.totalProprietes, survol: c.variantes[v].residusSurvol.totalProprietes, elementsSurvolForces: c.variantes[v].residusSurvol.elementsForces, familles: c.variantes[v].residusSurvol.parFamille }]));
  for (const v of V) for (const b of c.variantes[v].boutons || []) {
    const k = `${p} · ${b.bouton}`; out.boutons[k] = out.boutons[k] || {};
    out.boutons[k][NOM[v]] = b.etats.map((e) => ({ etat: e.etat.startsWith("désactivé") ? "désactivé (simulé)" : e.etat, fond: e.fond, texte: e.texteCouleur, ratioTexte: e.ratioTexte, ratioBoutonPage: e.ratioBoutonPage, opacite: e.opacite, anneau: e.anneau, ratioAnneauPage: e.ratioAnneauPage, ratioAnneauBouton: e.ratioAnneauBouton, fondEffectif: e.fondEffectif, texteEffectif: e.texteEffectif, ratioTexteEffectif: e.ratioTexteEffectif }));
  }
}
fs.writeFileSync(path.join(OPT, "mesures/synthese-options-dz.json"), JSON.stringify(out, null, 1));

// Tableaux Markdown (repris dans le README).
const L = [];
const tot = { AVANT: [0, 0, 0, 0], A: [0, 0, 0, 0], B: [0, 0, 0, 0] };
L.push("| Passage | Textes sous seuil (AVANT / A / B) | Bords sous 3:1 | Focus invisible ou masqué | axe color-contrast |", "|---|---|---|---|---|");
for (const p of passages) {
  const g = (k) => ["AVANT", "A", "B"].map((n) => (out.defauts[p][n] ? out.defauts[p][n][k] : "—")).join(" / ");
  ["AVANT", "A", "B"].forEach((n) => { const d = out.defauts[p][n]; if (d) ["textes", "bords", "focus", "axeContraste"].forEach((k, i) => (tot[n][i] += d[k])); });
  L.push(`| ${p} | ${g("textes")} | ${g("bords")} | ${g("focus")} | ${g("axeContraste")} |`);
}
L.push(`| **Total** | ${[0, 1, 2, 3].map((i) => ["AVANT", "A", "B"].map((n) => tot[n][i]).join(" / ")).map((s) => `**${s}**`).join(" | ")} |`, "");
L.push("| Passage | Résidus au repos (AVANT / A / B) | Résidus au survol forcé | Éléments survolés |", "|---|---|---|---|");
for (const p of passages) { const r = out.residus[p]; L.push(`| ${p} | ${["AVANT", "A", "B"].map((n) => r[n].repos).join(" / ")} | ${["AVANT", "A", "B"].map((n) => r[n].survol).join(" / ")} | ${r.A.elementsSurvolForces} |`); }
L.push("");
L.push("| Bouton | Variante | Repos (fond, texte, ratio) | Survol | Focus (anneau, ratio anneau/page) | Désactivé simulé |", "|---|---|---|---|---|---|");
for (const [k, vs] of Object.entries(out.boutons)) for (const n of ["AVANT", "A", "B"]) {
  const e = Object.fromEntries((vs[n] || []).map((x) => [x.etat, x]));
  const f = (x) => (x ? `${x.fond} / ${x.texte} : ${x.ratioTexte}${x.opacite !== "1" ? ` (opacité ${x.opacite}${x.ratioTexteEffectif ? `, effectif ${x.fondEffectif} / ${x.texteEffectif} : ${x.ratioTexteEffectif}` : ""})` : ""}` : "—");
  L.push(`| ${k} | ${n} | ${f(e.repos)} | ${f(e.survol)} | ${e.focus ? `${e.focus.anneau || "aucun"} : ${e.focus.ratioAnneauPage ?? "—"}` : "—"} | ${f(e["désactivé (simulé)"])} |`);
}
fs.writeFileSync(path.join(OPT, "mesures/synthese-options-dz.md"), L.join("\n") + "\n");
console.log(L.join("\n"));
