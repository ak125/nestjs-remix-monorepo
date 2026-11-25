// Complément n° 6 DZ — condense les sorties de cls-causes-dz.cjs en tableaux Markdown (aucun chiffre recalculé à la main).
// Usage : node scripts/condense-cls-dz.cjs <dossier-json> <sortie.md> [dossier-correctifs]
const fs = require("node:fs"); const path = require("node:path");
const [DIR, OUT, DIRC] = process.argv.slice(2);
const PAGES = ["r1-gamme", "r2-produit", "r0-accueil", "panier-vide", "connexion"];
const runs = fs.readdirSync(DIR).filter((f) => /\.json$/.test(f) && !f.startsWith("echauffement") && !f.startsWith("test-")).map((f) => ({ f, ...JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) }));
const nb = (x) => (x === null || x === undefined ? "—" : String(x).replace(".", ","));
const W = (r) => r.viewport.split("x")[0];
const ordre = (a, b) => PAGES.indexOf(a.id) - PAGES.indexOf(b.id) || W(a) - W(b) || ["parcours", "sauts", "molette"].indexOf(a.methode) - ["parcours", "sauts", "molette"].indexOf(b.methode) || (a.variante === "avant" ? -1 : 1);
runs.sort(ordre);
const L = [];
const T = (titre, entetes, lignes) => { L.push(`### ${titre}`, "", "| " + entetes.join(" | ") + " |", "|" + entetes.map(() => "---").join("|") + "|", ...lignes.map((l) => "| " + l.join(" | ") + " |"), ""); };
const ok = (v) => (v <= 0.1 ? "oui" : "**non**");

T("CLS par passage (hors saisie, hors phase d'injection de la feuille)", ["page", "largeur", "méthode", "variante", "CLS (plus grande fenêtre de session)", "somme", "dont chargement", "dont défilement", "décalages (hors saisie / avec saisie)", "≤ 0,1"],
  runs.map((r) => [r.id, W(r), r.methode, r.variante, nb(r.cls.horsInjection.officiel), nb(r.cls.horsInjection.somme), nb(r.cls.chargement ? r.cls.chargement.somme : null), nb(r.cls.defilement.somme), `${r.cls.horsInjection.n} / ${r.cls.horsInjection.nSaisie}`, ok(r.cls.horsInjection.officiel)]));

// Décalages du chargement, avec et sans ceux que Chromium marque « saisie récente » (aucune saisie n'est envoyée à ce moment).
const sommeCh = (r, avecSaisie) => Math.round(r.shifts.filter((s) => s.phase === "chargement" && (avecSaisie || !s.input)).reduce((a, s) => a + s.v, 0) * 10000) / 10000;
T("Chargement seul : somme des décalages avant toute action, y compris ceux marqués « saisie récente »", ["page", "largeur", "passages", "somme avec saisie (min – max)", "somme hors saisie (min – max)", "passages avec décalage"],
  [...new Set(runs.map((r) => r.id + "|" + W(r)))].map((k) => { const rr = runs.filter((r) => r.id + "|" + W(r) === k); const a = rr.map((r) => sommeCh(r, true)), h = rr.map((r) => sommeCh(r, false));
    return [k.split("|")[0], k.split("|")[1], rr.length, `${nb(Math.min(...a))} – ${nb(Math.max(...a))}`, `${nb(Math.min(...h))} – ${nb(Math.max(...h))}`, a.filter((x) => x > 0).length]; }));

T("Méthode « parcours » (ordre de mesure-dz.cjs) : somme par phase", ["page", "largeur", "variante", "chargement", "injection (exclue)", "tabulation", "sauts", "centrage", "cv forcée", "cv retirée", "fin"],
  runs.filter((r) => r.methode === "parcours").map((r) => { const p = r.cls.parPhase; const g = (k) => nb(p[k] ? p[k].somme : null); return [r.id, W(r), r.variante, g("chargement"), g("injection"), g("tabulation"), g("sauts"), g("centrage"), g("cv-forcee"), g("cv-retiree"), g("fin")]; }));

T("Injection de la feuille A3 après chargement (artefact de la maquette, exclu ci-dessus)", ["page", "largeur", "méthode", "somme", "règles lues"],
  runs.filter((r) => r.variante === "a3").map((r) => [r.id, W(r), r.methode, nb(r.cls.parPhase.injection ? r.cls.parPhase.injection.somme : null), r.injection && r.injection.regles]));

const court = (s) => (s || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").slice(0, 110);
const lignes = [];
for (const r of runs) for (const s of r.shifts) {
  if (s.v < 0.01) continue;
  const src = s.sources.slice(0, 2).map((x) => `\`${court(x.sel)}\` ${JSON.stringify(x.avant)}→${JSON.stringify(x.apres)}`).join("<br>");
  const p = (s.poussoirs || []).filter((x) => !x.repercute).slice(0, 2).map((x) => `${x.type}${x.dh !== undefined ? " " + (x.dh > 0 ? "+" : "") + x.dh + " px" : ""}${x.attr ? " " + x.attr + " « " + court(x.ancien).slice(0, 40) + " » → « " + court(x.nouveau).slice(0, 40) + " »" : ""} \`${court(x.sel)}\``).join("<br>") || "aucun relevé";
  lignes.push([r.id, W(r), r.variante, r.methode, s.phase, Math.round(s.t), s.y, nb(s.v), s.input ? "oui" : "non", src, p]);
}
T("Décalages au-dessus de 0,01, un par ligne", ["page", "largeur", "variante", "méthode", "phase", "instant (ms)", "défilement (px)", "valeur", "saisie récente", "sources (sélecteur, rectangle avant → après [x, y, l, h])", "poussoir relevé (hors ancêtres qui répercutent)"], lignes);
if (DIRC) {
  const rc = fs.readdirSync(DIRC).filter((f) => /\.json$/.test(f)).map((f) => ({ f, ...JSON.parse(fs.readFileSync(path.join(DIRC, f), "utf8")) }));
  rc.sort((a, b) => PAGES.indexOf(a.id) - PAGES.indexOf(b.id) || W(a) - W(b) || (a.correctif ? 1 : 0) - (b.correctif ? 1 : 0) || a.f.localeCompare(b.f));
  T("Démonstration des correctifs (feuille écrite dans le HTML reçu, méthode molette, 3 répétitions)", ["page", "largeur", "correctif", "fichier", "chargement avec saisie", "chargement hors saisie", "défilement (somme)", "CLS hors saisie (plus grande fenêtre)", "décalages > 0,01"],
    rc.map((r) => [r.id, W(r), r.correctif ? r.correctif.replace(" (dans le HTML)", "") : "aucun (AVANT)", r.f, nb(sommeCh(r, true)), nb(sommeCh(r, false)), nb(r.cls.defilement.somme), nb(r.cls.horsInjection.officiel), r.shifts.filter((s) => s.v >= 0.01).map((s) => `${nb(s.v)} à ${Math.round(s.t)} ms${s.input ? " (saisie)" : ""}`).join(", ") || "aucun"]));
}
fs.writeFileSync(OUT, L.join("\n"));
console.log(runs.length, "passages,", lignes.length, "décalages > 0,01");
