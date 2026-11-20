#!/usr/bin/env node
// Complément n° 3 DZ — condensation de l'option C (r2-produit, 390 et 1440) : ratios du bouton d'achat A / B / C,
// résidus de couleur de C, éléments verts visibles dans le même écran que le bouton d'achat.
// Usage (depuis options/) : node scripts/condense-option-c-dz.cjs .
// Lit mesures/captures-r2-produit-<W>.json (A, B : complément n° 2), mesures/captures-r2-produit-<W>-c.json et
// mesures/verts-r2-produit-<W>-c.json et -avant.json (comparaison). Écrit mesures/synthese-option-c-dz.json et .md. Aucun accès réseau.
const fs = require("fs"), path = require("path");
const OPT = process.argv[2] || ".";
const M = (f) => JSON.parse(fs.readFileSync(path.join(OPT, "mesures", f)));
const out = { genere: new Date().toISOString(), boutons: {}, residus: {}, verts: {} };
for (const W of [390, 1440]) {
  const ab = M(`captures-r2-produit-${W}.json`), c = M(`captures-r2-produit-${W}-c.json`), v = M(`verts-r2-produit-${W}-c.json`), va = M(`verts-r2-produit-${W}-avant.json`);
  const V = { A: ab.variantes.a, B: ab.variantes.b, C: c.variantes.c };
  for (const [n, r] of Object.entries(V)) for (const b of r.boutons || []) {
    const k = `r2-produit-${W} · ${b.bouton}`; out.boutons[k] = out.boutons[k] || {};
    out.boutons[k][n] = b.etats.map((e) => ({ etat: e.etat.startsWith("désactivé") ? "désactivé (simulé)" : e.etat, fond: e.fond, texte: e.texteCouleur, ratioTexte: e.ratioTexte, ratioBoutonPage: e.ratioBoutonPage, opacite: e.opacite, anneau: e.anneau, ratioAnneauPage: e.ratioAnneauPage, ratioAnneauBouton: e.ratioAnneauBouton }));
  }
  out.residus[`r2-produit-${W}`] = { C: { repos: V.C.residus.totalProprietes, survol: V.C.residusSurvol.totalProprietes, elementsSurvolForces: V.C.residusSurvol.elementsForces, injection: V.C.injection } };
  out.verts[`r2-produit-${W}`] = { critere: v.critere, injection: v.injection, requetesAbandonnees: v.requetesAbandonnees, ecrans: v.ecrans, toutePage: v.toutePage, avant: { ecrans: va.ecrans.map((e) => ({ ecran: e.ecran, scrollY: e.scrollY, nombreVertsHorsAchat: e.nombreVertsHorsAchat, verts: e.verts })), toutePageHorsAchat: va.toutePage.nombreHorsAchat } };
}
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-c-dz.json"), JSON.stringify(out, null, 1));

const L = [];
L.push("| Bouton | Option | Repos (fond / texte : ratio) | Survol | Focus (anneau : ratio anneau/page) | Bouton / page au repos | Désactivé simulé |", "|---|---|---|---|---|---|---|");
for (const [k, vs] of Object.entries(out.boutons)) for (const n of ["A", "B", "C"]) {
  const e = Object.fromEntries((vs[n] || []).map((x) => [x.etat, x]));
  const f = (x) => (x ? `${x.fond} / ${x.texte} : ${x.ratioTexte}${x.opacite && x.opacite !== "1" ? ` (opacité ${x.opacite})` : ""}` : "—");
  L.push(`| ${k} | ${n} | ${f(e.repos)} | ${f(e.survol)} | ${e.focus ? `${e.focus.anneau || "aucun"} : ${e.focus.ratioAnneauPage ?? "—"}` : "—"} | ${e.repos ? e.repos.ratioBoutonPage ?? "—" : "—"} | ${f(e["désactivé (simulé)"])} |`);
}
L.push("");
L.push("| Passage | Résidus hors jeu C, repos | Résidus C, survol forcé | Éléments survolés |", "|---|---|---|---|");
for (const [p, r] of Object.entries(out.residus)) L.push(`| ${p} | ${r.C.repos} | ${r.C.survol} | ${r.C.elementsSurvolForces} |`);
L.push("");
L.push("| Passage · écran | Verts hors achat, AVANT | Verts hors achat, C | Toute la page, AVANT / C |", "|---|---|---|---|");
for (const [p, v] of Object.entries(out.verts)) v.ecrans.forEach((e, i) => L.push(`| ${p} · ${e.ecran} (défilement ${e.scrollY}) | ${v.avant.ecrans[i].nombreVertsHorsAchat} | ${e.nombreVertsHorsAchat} | ${i ? "" : `${v.avant.toutePageHorsAchat} / ${v.toutePage.nombreHorsAchat}`} |`));
L.push("");
for (const [p, v] of Object.entries(out.verts)) for (const e of v.ecrans) {
  const achat = e.boutonsAchat.filter((b) => b.entierementVisible).map((b) => `« ${b.texte} »`).join(", ") || "aucun entièrement visible";
  L.push(`**${p}, ${e.ecran === "premier-ecran" ? "premier écran" : "premier écran où « Ajouter » est entier"}** (défilement ${e.scrollY} px ; bouton d'achat visible : ${achat}) — ${e.nombreVertsHorsAchat} élément(s) vert(s) hors bouton d'achat. Capture : [\`captures/${e.capture}.webp\`](captures/${e.capture}.webp)`, "");
  L.push("| N° | Élément | Texte | Couleur(s) verte(s) | Position (x, y, l, h) |", "|---|---|---|---|---|");
  e.verts.forEach((o, i) => L.push(`| ${i + 1}${o.achat ? " (achat)" : ""} | \`${o.tag}\` ${o.classes ? `\`${o.classes.slice(0, 60).replace(/\|/g, "/")}\`` : ""} | ${(o.texte || "—").replace(/\|/g, "/")} | ${o.props.map((x) => `${x[0]} ${x[1]}`).join(", ")} | ${o.rect.join(", ")} |`));
  L.push("");
}
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-c-dz.md"), L.join("\n"));
console.log(L.join("\n"));
