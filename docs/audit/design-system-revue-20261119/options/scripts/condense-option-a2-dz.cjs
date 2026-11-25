#!/usr/bin/env node
// Complément n° 4 DZ — condensation AVANT / A / A2 / B : mêmes mesures qu'au n° 2 (textes, bords, focus, axe, résidus
// hors jeu) avec la colonne A2, ratios des actions principales A2 (repos, survol, focus, désactivé) et actions orange par écran.
// Usage : node scripts/condense-option-a2-dz.cjs <dossier-mesures-hors-depot> <dossier-options>
//   <hors-dépôt>/{avant,a,b,a2}/mesures/<id>-<W>.json (mesure-dz.cjs enveloppé par mesure-option-dz.cjs)
//   <options>/mesures/captures-<id>-<W>.json (AVANT, A, B : n° 2), captures-<id>-<W>-a2.json, actions-orange-<id>-<W>-a2.json
// Écrit <options>/mesures/synthese-option-a2-dz.json et .md, copie les journaux d'injection A2. Les sorties du n° 2 ne sont pas touchées.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const [SRC, OPT] = process.argv.slice(2);
const V = ["avant", "a", "a2", "b"], NOM = { avant: "AVANT", a: "A", a2: "A2", b: "B" }, N = V.map((v) => NOM[v]);
const pages = fs.readFileSync(path.join(OPT, "scripts/pages-options-dz.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t")[0]);
const passages = pages.flatMap((id) => [390, 1440].map((w) => `${id}-${w}`));
const J = (f) => JSON.parse(fs.readFileSync(f));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const out = { genere: new Date().toISOString(), sources: {}, defauts: {}, axe: {}, residus: {}, boutons: {}, actionsOrange: {} };
for (const p of passages) {
  out.defauts[p] = {}; out.axe[p] = {};
  for (const v of V) {
    const f = path.join(SRC, v, "mesures", `${p}.json`);
    if (!fs.existsSync(f)) { out.defauts[p][NOM[v]] = null; continue; }
    const d = J(f); out.sources[`${v}/${p}`] = { sha256: sha(f), debut: d.debut };
    const textes = d.textes.liste.filter((t) => t.defaut), bords = d.bords.filter((b) => b.defaut);
    const focus = d.focus.filter((x) => x.indicateurVisible === false || x.indicateur3a1 === false || x.pointsCaches > 0);
    const cc = d.axe.violations.find((x) => x.id === "color-contrast");
    out.defauts[p][NOM[v]] = { textes: textes.length, bords: bords.length, focus: focus.length, axeContraste: cc ? cc.noeuds : 0,
      exemplesTextes: textes.slice(0, 6).map((t) => ({ texte: (t.texte || "").slice(0, 40), fg: t.fg, bg: t.bg, ratio: t.ratioRetenu ?? t.ratio, seuil: t.seuil, classes: t.classes })) };
    out.axe[p][NOM[v]] = d.axe.violations.map((x) => `${x.id}:${x.noeuds}`);
    const inj = path.join(SRC, v, "mesures", `injection-${p}.json`);
    if (v === "a2" && fs.existsSync(inj)) fs.copyFileSync(inj, path.join(OPT, "mesures/injection", `a2-${p}.json`));
  }
  const c = J(path.join(OPT, "mesures", `captures-${p}.json`)), c2 = J(path.join(OPT, "mesures", `captures-${p}-a2.json`));
  const VC = { AVANT: c.variantes.avant, A: c.variantes.a, A2: c2.variantes.a2, B: c.variantes.b };
  out.residus[p] = Object.fromEntries(N.map((n) => [n, { repos: VC[n].residus.totalProprietes, survol: VC[n].residusSurvol.totalProprietes, elementsSurvolForces: VC[n].residusSurvol.elementsForces, logoOrangeExclu: VC[n].residus.logoOrangeExclu, familles: VC[n].residus.parFamille }]));
  out.residus[p].requetesAbandonneesA2 = c2.requetesAbandonnees.length;
  for (const n of ["A", "A2"]) for (const b of VC[n].boutons || []) {
    const k = `${p} · ${b.bouton}`; out.boutons[k] = out.boutons[k] || {};
    out.boutons[k][n] = b.etats.map((e) => ({ etat: e.etat.startsWith("désactivé (état réel") ? "désactivé (réel)" : e.etat.startsWith("désactivé") ? "désactivé (simulé)" : e.etat, fond: e.fond, texte: e.texteCouleur, fondPage: e.fondPage, ratioTexte: e.ratioTexte, ratioBoutonPage: e.ratioBoutonPage, opacite: e.opacite, anneau: e.anneau, ratioAnneauPage: e.ratioAnneauPage, ratioAnneauBouton: e.ratioAnneauBouton, ratioTexteEffectif: e.ratioTexteEffectif, note: e.note, capture: e.capture }));
  }
  const ao = path.join(OPT, "mesures", `actions-orange-${p}-a2.json`);
  if (fs.existsSync(ao)) { const a = J(ao); out.actionsOrange[p] = { premierEcran: a.premierEcran, ecrans: a.ecrans.length, ecransAPlusieurs: a.ecransAPlusieurs, maxParEcran: a.maxParEcran, detailEcransAPlusieurs: a.ecrans.filter((e) => e.entieres > 1), toutePage: a.toutePage.nombre }; }
}
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-a2-dz.json"), JSON.stringify(out, null, 1));

const L = [], tot = Object.fromEntries(N.map((n) => [n, [0, 0, 0, 0]]));
L.push("| Passage | Textes sous seuil (AVANT / A / A2 / B) | Bords sous 3:1 | Focus invisible ou masqué | axe color-contrast |", "|---|---|---|---|---|");
for (const p of passages) {
  const g = (k) => N.map((n) => (out.defauts[p][n] ? out.defauts[p][n][k] : "—")).join(" / ");
  N.forEach((n) => { const d = out.defauts[p][n]; if (d) ["textes", "bords", "focus", "axeContraste"].forEach((k, i) => (tot[n][i] += d[k])); });
  L.push(`| ${p} | ${g("textes")} | ${g("bords")} | ${g("focus")} | ${g("axeContraste")} |`);
}
L.push(`| **Total** | ${[0, 1, 2, 3].map((i) => `**${N.map((n) => tot[n][i]).join(" / ")}**`).join(" | ")} |`, "");
L.push("| Passage | Résidus hors jeu au repos (AVANT / A / A2 / B) | Au survol forcé | Logo orange exclu (A2) |", "|---|---|---|---|");
for (const p of passages) { const r = out.residus[p]; L.push(`| ${p} | ${N.map((n) => r[n].repos).join(" / ")} | ${N.map((n) => r[n].survol).join(" / ")} | ${r.A2.logoOrangeExclu ?? "—"} |`); }
L.push("");
L.push("| Action | Option | Repos (fond / texte : ratio) | Bouton / page | Survol | Focus (anneau : ratio anneau/page) | Désactivé |", "|---|---|---|---|---|---|---|");
for (const [k, vs] of Object.entries(out.boutons)) for (const n of ["A", "A2"]) {
  if (!vs[n]) continue; const e = Object.fromEntries(vs[n].map((x) => [x.etat, x]));
  const f = (x) => (x ? `${x.fond} / ${x.texte} : ${x.ratioTexte}${x.opacite && x.opacite !== "1" ? ` (opacité ${x.opacite}${x.ratioTexteEffectif ? `, effectif ${x.ratioTexteEffectif}` : ""})` : ""}` : "—");
  const d = e["désactivé (réel)"] || e["désactivé (simulé)"];
  L.push(`| ${k}${e.repos && e.repos.note && e.repos.note.includes("simulé") ? " ¹" : ""} | ${n} | ${f(e.repos)} | ${e.repos ? e.repos.ratioBoutonPage : "—"} | ${f(e.survol)} | ${e.focus ? `${e.focus.anneau || "aucun"} : ${e.focus.ratioAnneauPage ?? "—"}` : "—"} | ${d ? `${f(d)}${e["désactivé (réel)"] ? " (réel)" : " (simulé)"} ; bouton/page ${d.ratioBoutonPage}` : "—"} |`);
}
L.push("", "¹ « Rechercher des pièces » est désactivé tant qu'aucun véhicule n'est choisi : repos, survol et focus sont mesurés après retrait local de l'attribut disabled (aucun clic, aucune saisie).", "");
L.push("| Passage | Actions orange entières, premier écran (A2) | Écrans de la page | Écrans à plusieurs actions orange | Maximum par écran | Toute la page |", "|---|---|---|---|---|---|");
for (const [p, a] of Object.entries(out.actionsOrange)) L.push(`| ${p} | ${a.premierEcran.entieres}${a.premierEcran.textes.length ? ` (${a.premierEcran.textes.join(" ; ").replace(/\|/g, "/")})` : ""} | ${a.ecrans} | ${a.ecransAPlusieurs} | ${a.maxParEcran} | ${a.toutePage} |`);
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-a2-dz.md"), L.join("\n") + "\n");
console.log(L.join("\n"));
