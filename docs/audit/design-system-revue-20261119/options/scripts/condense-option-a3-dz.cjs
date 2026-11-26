#!/usr/bin/env node
// Complément n° 5 DZ — condensation AVANT / A2 / A3 : défauts (textes, bords, focus, axe) relevés par la mesure livrée
// (mesure-dz.cjs, non modifiée) relancée sous chaque feuille ; ratios des actions orange et à contour (A2 / A3) ;
// actions orange par écran (A2 / A3) ; liste un par un des défauts restants sous A3 avec leur cause ; défauts nouveaux sous A3.
// Usage : node scripts/condense-option-a3-dz.cjs <dossier-mesures-hors-depot> <dossier-options>
//   <hors-dépôt>/{avant,a2,a3}/mesures/<id>-<W>.json ; <options>/mesures/captures-<id>-<W>-{a2,a3}.json ; actions-orange-<id>-<W>-{a2,a3}.json
// Écrit <options>/mesures/synthese-option-a3-dz.json et .md, copie les journaux d'injection A3. Les sorties antérieures ne sont pas touchées.
// Les causes sont attribuées par la table CAUSES ci-dessous (motif de sélecteur ou de cacheur → cause relevée par lecture du code
// ou par sonde) ; un défaut sans cause connue sort « cause non qualifiée » et fait échouer le script (code 2).
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const [SRC, OPT] = process.argv.slice(2);
const V = ["avant", "a2", "a3"], NOM = { avant: "AVANT", a2: "A2", a3: "A3" }, N = V.map((v) => NOM[v]);
const pages = fs.readFileSync(path.join(OPT, "scripts/pages-options-dz.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t")[0]);
const passages = pages.flatMap((id) => [390, 1440].map((w) => `${id}-${w}`));
const J = (f) => JSON.parse(fs.readFileSync(f));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const focusDefaut = (x) => x.indicateurVisible === false || x.indicateur3a1 === false || x.pointsCaches > 0;
const court = (s, n = 70) => (s || "").replace(/\s+/g, " ").trim().slice(0, n).replace(/\|/g, "/");

// Causes des défauts restants (complément n° 5, point 5). statut : « faux positif de mesure », « image », « changement de code nécessaire ».
const CAUSES = [
  { type: "focus", si: (x) => /nav\.fixed\.bottom-0/.test(x.cacheur || ""), statut: "changement de code nécessaire",
    cause: "recouvert par la barre mobile fixe (nav « Navigation mobile », BottomNav.tsx:68, fixed bottom-0, 63 px) : le défilement au clavier ne réserve pas sa hauteur" },
  { type: "focus", si: (x) => /div\.fixed\.left-0/.test(x.cacheur || ""), statut: "changement de code nécessaire",
    cause: "recouvert par la barre d'actions R2 (div[role=toolbar] « Actions », MobileBottomBar.tsx:66, fixed, 63 px au-dessus de la barre mobile)" },
  { type: "focus", si: (x) => /button\.fixed\.bottom-(24|40)/.test(x.cacheur || ""), statut: "changement de code nécessaire",
    cause: "recouvert par la bulle d'aide (ChatWidget.tsx:210, fixed bottom-24, 56 px) ou le bouton de retour en haut (root.tsx:363, fixed bottom-40)" },
  { type: "focus", si: (x) => /div\.sticky\.top-24/.test(x.cacheur || ""), statut: "changement de code nécessaire",
    cause: "recouvert par la carte de filtres collante de la colonne latérale R2 (div.sticky.top-24) qui glisse sur « Gammes similaires », placé dans la même colonne sous elle" },
  { type: "focus", si: (x) => /div\.rounded-2xl\.shadow-lg|div\.bg-white\/95/.test(x.cacheur || ""), statut: "changement de code nécessaire",
    cause: "recouvert par la barre d'outils R2 collante (PiecesToolbar.tsx:75, sticky top-24 z-10, 126 px de haut en 390) ; la marge haute de la feuille (230 px) ne s'applique qu'au défilement provoqué par la prise de focus" },
  { type: "focus", si: (x) => /nav.*Navigation principale|nav\.sticky\.top-0/.test(x.cacheur || ""), statut: "changement de code nécessaire",
    cause: "recouvert par l'en-tête collant (Navbar.tsx:156)" },
  { type: "focus", si: (x) => !x.pointsCaches && x.indicateur && x.indicateur.defilementEntreCaptures, statut: "faux positif de mesure",
    cause: "la page a défilé entre les deux captures qui encadrent la prise de focus (defilementEntreCaptures) : le ratio P90 compare deux vues décalées ; l'anneau posé est navy 2 px (16,63:1 sur blanc)" },
  { type: "texte", si: (x) => /backdrop-blur-xs\.rounded-full/.test(x.sel || ""), statut: "changement de code nécessaire",
    cause: "pastille de résultats sur l'en-tête sombre du filtre (PiecesFilterSidebar.tsx:115–121, fond blanc à 15 %, « résultats » blanc à 60 %)" },
  { type: "texte", si: (x) => /text-slate-300/.test(x.classes || "") && /from-slate-800/.test(x.sel || ""), statut: "changement de code nécessaire",
    cause: "sous-titre text-slate-300 sur l'en-tête OEM en dégradé slate-800 → slate-700 (PiecesOemSection.tsx:53 et 70)" },
  { type: "texte", si: (x) => /line-clamp-1/.test(x.classes || "") && x.ratio >= x.seuil, statut: "faux positif de mesure",
    cause: "paragraphe tronqué à une ligne (CatalogueSection.tsx:90, line-clamp-1) : la boîte mesurée par pixels couvre les lignes masquées et le contenu voisin (P10 bas, médiane au seuil) ; couleur calculée au seuil" },
  { type: "texte", si: (x) => /bg-neutral-900\/20/.test(x.classes || "") || /5 min/.test(x.texte || ""), statut: "image",
    cause: "badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134)" },
  { type: "texte", si: (x) => x.surImage || x.fondImage, statut: "image",
    cause: "texte posé sur une image : ratio pixel P10 dominé par l'image, non corrigeable par la feuille sans masquer l'image" },
  { type: "texte", si: (x) => x.aVerifierPixels && x.ratio >= x.seuil && x.ratioRetenu < x.seuil, statut: "faux positif de mesure",
    cause: "ratio calculé au seuil ; seul le P10 des pixels du cadre est sous le seuil, tiré par des pixels sombres voisins (pictogramme, filet) compris dans la boîte du texte" },
  { type: "bord", si: (x) => /Sélectionner/.test(x.sel || "") || /border-slate-200/.test(x.classes || ""), statut: "changement de code nécessaire",
    cause: "case « Sélectionner » des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0, 1,23:1 sur blanc)" },
  { type: "axe", si: (x) => /bg-neutral-900\/20/.test(x.html || x.cible || ""), statut: "image",
    cause: "badge « 5 min » sur photo (BlogCarousel.tsx:47 et 134) ; même nœud que le défaut de texte" },
];
const qualifie = (type, x) => { const c = CAUSES.find((c) => c.type === type && c.si(x)); return c ? { statut: c.statut, cause: c.cause } : { statut: "cause non qualifiée", cause: "—" }; };

const out = { genere: new Date().toISOString(), sources: {}, defauts: {}, restantsA3: [], nouveauxA3: [], defautsA2: [], corrigesA2versA3: {}, boutons: {}, actionsOrange: {} };
const items = {}; // items[p][v] = { texte:[], bord:[], focus:[], axe:[] }
for (const p of passages) {
  out.defauts[p] = {}; items[p] = {};
  for (const v of V) {
    const f = path.join(SRC, v, "mesures", `${p}.json`);
    if (!fs.existsSync(f)) { out.defauts[p][NOM[v]] = null; continue; }
    const d = J(f); out.sources[`${v}/${p}`] = { sha256: sha(f), debut: d.debut };
    const cc = d.axe.violations.find((x) => x.id === "color-contrast");
    const it = { texte: d.textes.liste.filter((t) => t.defaut), bord: d.bords.filter((b) => b.defaut), focus: d.focus.filter(focusDefaut), axe: cc ? cc.exemples || [] : [] };
    items[p][v] = it;
    out.defauts[p][NOM[v]] = { textes: it.texte.length, bords: it.bord.length, focus: it.focus.length, axeContraste: cc ? cc.noeuds : 0 };
    const inj = path.join(SRC, v, "mesures", `injection-${p}.json`);
    if (v === "a3" && fs.existsSync(inj)) fs.copyFileSync(inj, path.join(OPT, "mesures/injection", `a3-${p}.json`));
  }
  const cle = { texte: (x) => `${x.sel}|${x.texte}`, bord: (x) => x.sel, focus: (x) => `${x.sel}|${x.texte}`, axe: (x) => x.cible };
  const a2 = items[p].a2, a3 = items[p].a3;
  for (const t of ["texte", "bord", "focus", "axe"]) {
    const k2 = new Set(a2[t].map(cle[t])), k3 = new Set(a3[t].map(cle[t]));
    out.corrigesA2versA3[p] = out.corrigesA2versA3[p] || {}; out.corrigesA2versA3[p][t] = a2[t].filter((x) => !k3.has(cle[t](x))).length;
    for (const x of a2[t]) {
      const q = qualifie(t, x), corrige = !k3.has(cle[t](x));
      const m = t === "texte" ? `${x.fg} sur ${x.bg} : calculé ${x.ratio}, pixels P10 ${x.ratioPixelsP10 ?? "—"}, retenu ${x.ratioRetenu}`
        : t === "bord" ? `bord ${x.bord} sur ${x.fondAutour} : ${x.ratioBord}`
        : t === "focus" ? `${x.pointsCaches} point(s) sur 5 caché(s)${x.pointsCaches ? ` par \`${court(x.cacheur, 200).split(" > ").slice(-1)[0]}\`` : ""} ; P90 ${x.indicateur ? x.indicateur.ratioP90 : "—"}${x.indicateur && x.indicateur.defilementEntreCaptures ? ", défilement entre captures" : ""}`
        : `${x.donnees && x.donnees.fg} sur ${x.donnees && x.donnees.bg} : ${x.donnees && x.donnees.ratio}`;
      out.defautsA2.push({ passage: p, type: t, selecteur: t === "axe" ? x.cible : x.sel, texte: court(x.texte || x.html, 40), mesure: m, cause: q.cause, statutSiRestant: q.statut, sousA3: corrige ? "corrigé" : "restant" });
    }
    for (const x of a3[t]) {
      const base = { passage: p, type: t };
      let e;
      if (t === "texte") e = { ...base, selecteur: x.sel, texte: court(x.texte, 40), classes: court(x.classes, 90), fg: x.fg, bg: x.bg, ratioCalcule: x.ratio, ratioPixelsP10: x.ratioPixelsP10, ratioRetenu: x.ratioRetenu, seuil: x.seuil, surImage: x.surImage, ...qualifie("texte", x) };
      else if (t === "bord") e = { ...base, selecteur: x.sel, texte: court(x.texte, 40), classes: court(x.classes, 90), bord: x.bord, fondAutour: x.fondAutour, ratioBord: x.ratioBord, ratioRemplissage: x.ratioRemplissage, ...qualifie("bord", x) };
      else if (t === "focus") e = { ...base, selecteur: x.sel, texte: court(x.texte, 40), rect: x.rect, pointsCaches: x.pointsCaches, cacheur: court(x.cacheur, 120), ratioP90: x.indicateur && x.indicateur.ratioP90, defilementEntreCaptures: !!(x.indicateur && x.indicateur.defilementEntreCaptures), outline: x.outline, ...qualifie("focus", x) };
      else e = { ...base, selecteur: x.cible, html: court(x.html, 120), ratio: x.donnees && x.donnees.ratio, fg: x.donnees && x.donnees.fg, bg: x.donnees && x.donnees.bg, ...qualifie("axe", { ...x, html: x.html }) };
      if (!k2.has(cle[t](x))) out.nouveauxA3.push(e);
      out.restantsA3.push(e);
    }
  }
  // Actions : ratios A2 / A3 (repos, survol, focus, désactivé ; contour relevé sous A3).
  for (const v of ["a2", "a3"]) {
    const c = J(path.join(OPT, "mesures", `captures-${p}-${v}.json`)).variantes[v];
    for (const b of c.boutons || []) {
      const k = `${p} · ${b.bouton}`; out.boutons[k] = out.boutons[k] || {};
      out.boutons[k][NOM[v]] = (b.etats || []).map((e) => ({ etat: e.etat.startsWith("désactivé (état réel") ? "désactivé (réel)" : e.etat.startsWith("désactivé") ? "désactivé (simulé)" : e.etat, fond: e.fond, texte: e.texteCouleur, fondPage: e.fondPage, ratioTexte: e.ratioTexte, ratioBoutonPage: e.ratioBoutonPage, contour: e.contour, ratioContourPage: e.ratioContourPage, anneau: e.anneau, ratioAnneauPage: e.ratioAnneauPage, opacite: e.opacite, note: e.note }));
    }
  }
  for (const v of V) {
    const ao = path.join(OPT, "mesures", `actions-orange-${p}-${v}.json`);
    if (fs.existsSync(ao)) { const a = J(ao); (out.actionsOrange[p] = out.actionsOrange[p] || {})[NOM[v]] = { debut: a.debut, premierEcran: a.premierEcran, parEcran: a.ecrans.map((e) => e.entieres), ecransAPlusieurs: a.ecransAPlusieurs, maxParEcran: a.maxParEcran, detailEcransAPlusieurs: a.ecrans.filter((e) => e.entieres > 1), toutePage: a.toutePage.nombre, requetesAbandonnees: a.requetesAbandonnees.length }; }
  }
}
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-a3-dz.json"), JSON.stringify(out, null, 1));

const L = [], tot = Object.fromEntries(N.map((n) => [n, [0, 0, 0, 0]]));
L.push("## Défauts mesurés, AVANT / A2 / A3", "", "| Passage | Textes sous seuil (AVANT / A2 / A3) | Bords sous 3:1 | Focus invisible ou masqué | axe color-contrast (nœuds) |", "|---|---|---|---|---|");
for (const p of passages) {
  const g = (k) => N.map((n) => (out.defauts[p][n] ? out.defauts[p][n][k] : "—")).join(" / ");
  N.forEach((n) => { const d = out.defauts[p][n]; if (d) ["textes", "bords", "focus", "axeContraste"].forEach((k, i) => (tot[n][i] += d[k])); });
  L.push(`| ${p} | ${g("textes")} | ${g("bords")} | ${g("focus")} | ${g("axeContraste")} |`);
}
L.push(`| **Total** | ${[0, 1, 2, 3].map((i) => `**${N.map((n) => tot[n][i]).join(" / ")}**`).join(" | ")} |`, "");
out.totaux = tot;

L.push("## Actions orange et à contour, A2 / A3", "", "| Action | Option | Repos (fond / texte : ratio) | Bouton / page | Contour / page | Survol | Focus (anneau : ratio anneau/page) | Désactivé |", "|---|---|---|---|---|---|---|---|");
for (const [k, vs] of Object.entries(out.boutons)) for (const n of ["A2", "A3"]) {
  if (!vs[n]) continue; const e = Object.fromEntries(vs[n].map((x) => [x.etat, x]));
  const f = (x) => (x ? `${x.fond} / ${x.texte} : ${x.ratioTexte}` : "—");
  const d = e["désactivé (réel)"] || e["désactivé (simulé)"];
  L.push(`| ${k} | ${n} | ${f(e.repos)} | ${e.repos ? e.repos.ratioBoutonPage : "—"} | ${e.repos && e.repos.contour ? `${e.repos.contour} : ${e.repos.ratioContourPage}` : "—"} | ${f(e.survol)} | ${e.focus ? `${e.focus.anneau || "aucun"} : ${e.focus.ratioAnneauPage ?? "—"}` : "—"} | ${d ? `${f(d)}${e["désactivé (réel)"] ? " (réel)" : " (simulé)"}${d.contour ? ` ; contour ${d.contour} : ${d.ratioContourPage}` : ""}` : "—"} |`);
}
L.push("", "« Rechercher des pièces » : désactivé réel tant qu'aucun véhicule n'est choisi ; repos, survol et focus mesurés après retrait local de l'attribut disabled. Désactivé « simulé » : attribut disabled posé dans le DOM. Aucun clic, aucune saisie.", "");

L.push("## Actions orange par écran, AVANT → A2 → A3", "", "Une action compte si elle est entière dans la fenêtre et non recouverte en son centre ; un écran = une hauteur de fenêtre, du haut au bas de la page.", "", "| Passage | Premier écran AVANT | Premier écran A2 | Premier écran A3 | Par écran AVANT | Par écran A2 | Par écran A3 | Écrans à plusieurs AVANT → A2 → A3 | Maximum par écran AVANT → A2 → A3 |", "|---|---|---|---|---|---|---|---|---|");
for (const [p, a] of Object.entries(out.actionsOrange)) {
  const pe = (x) => (x ? `${x.premierEcran.entieres}${x.premierEcran.textes.length ? ` (${x.premierEcran.textes.join(" ; ").replace(/\|/g, "/")})` : ""}` : "—");
  const g = (k) => N.map((n) => (a[n] ? a[n][k] : "—")).join(" → ");
  L.push(`| ${p} | ${pe(a.AVANT)} | ${pe(a.A2)} | ${pe(a.A3)} | ${a.AVANT ? a.AVANT.parEcran.join(" ") : "—"} | ${a.A2 ? a.A2.parEcran.join(" ") : "—"} | ${a.A3 ? a.A3.parEcran.join(" ") : "—"} | ${g("ecransAPlusieurs")} | ${g("maxParEcran")} |`);
}
L.push("");

L.push("## Défauts restants sous A3, un par un", "", "| Passage | Type | Sélecteur | Texte | Mesure | Statut | Cause |", "|---|---|---|---|---|---|---|");
for (const e of out.restantsA3) {
  const m = e.type === "texte" ? `${e.fg} sur ${e.bg} : calculé ${e.ratioCalcule}, pixels P10 ${e.ratioPixelsP10 ?? "—"}, retenu ${e.ratioRetenu} (seuil ${e.seuil})`
    : e.type === "bord" ? `bord ${e.bord} sur ${e.fondAutour} : ${e.ratioBord}`
    : e.type === "focus" ? `${e.pointsCaches} point(s) sur 5 caché(s)${e.pointsCaches ? ` par \`${e.cacheur.split(" > ").slice(-1)[0]}\`` : ""} ; P90 ${e.ratioP90}${e.defilementEntreCaptures ? ", défilement entre captures" : ""}`
    : `${e.fg} sur ${e.bg} : ${e.ratio}`;
  L.push(`| ${e.passage} | ${e.type} | \`${court(e.selecteur, 110)}\` | ${e.texte || "—"} | ${m} | ${e.statut} | ${e.cause} |`);
}
L.push("");
L.push("## Défauts relevés sous A2, un par un, et leur devenir sous A3", "", "| Passage | Type | Sélecteur | Texte | Mesure sous A2 | Cause | Sous A3 |", "|---|---|---|---|---|---|---|");
for (const e of out.defautsA2) L.push(`| ${e.passage} | ${e.type} | \`${court(e.selecteur, 110)}\` | ${e.texte || "—"} | ${e.mesure} | ${e.cause} | ${e.sousA3}${e.sousA3 === "restant" ? ` (${e.statutSiRestant})` : ""} |`);
L.push("");
L.push("## Défauts présents sous A3 et absents sous A2", "");
if (!out.nouveauxA3.length) L.push("Aucun.", "");
else { L.push("| Passage | Type | Sélecteur | Texte | Statut | Cause |", "|---|---|---|---|---|---|"); for (const e of out.nouveauxA3) L.push(`| ${e.passage} | ${e.type} | \`${court(e.selecteur, 110)}\` | ${e.texte || "—"} | ${e.statut} | ${e.cause} |`); L.push(""); }
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-a3-dz.tableaux.md"), L.join("\n") + "\n");
fs.writeFileSync(path.join(OPT, "mesures/synthese-option-a3-dz.json"), JSON.stringify(out, null, 1));
console.log(L.join("\n"));
const nq = [...out.restantsA3.filter((e) => e.statut === "cause non qualifiée"), ...out.defautsA2.filter((e) => e.cause === "—")];
if (nq.length) { console.error(`${nq.length} défaut(s) sans cause qualifiée`); process.exit(2); }
