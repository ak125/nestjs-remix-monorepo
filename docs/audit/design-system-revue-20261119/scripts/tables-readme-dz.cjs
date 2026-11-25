// Mandat DZ — 6.7 : produit les tableaux du README à partir des fichiers bruts (mesures/*.json) et de
// mesures/synthese.json, pour qu'aucun chiffre du README ne soit recopié à la main.
// Pour chaque couleur en défaut : jeton EXISTANT de packages/design-tokens/src/tokens.json le plus proche
// de la couleur fautive (distance RVB) qui atteint le seuil sur le même fond, avec son ratio ; « aucun » sinon.
// Aucune couleur nouvelle n'est proposée. Lecture seule, sans navigateur.
// Usage (depuis docs/audit/design-system-revue-20261119) :
//   node scripts/tables-readme-dz.cjs ../../../packages/design-tokens/src/tokens.json > mesures/tables-readme.md
const fs = require("node:fs");
const path = require("node:path");
const tokFile = process.argv[2];
const S = JSON.parse(fs.readFileSync("mesures/synthese.json", "utf8"));
const tokens = JSON.parse(fs.readFileSync(tokFile, "utf8"));
const flat = [];
(function walk(o, p) {
  if (!o || typeof o !== "object") return;
  const v = o.$value ?? o.value; if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) { flat.push({ jeton: p.join("."), hex: v.toLowerCase() }); return; }
  for (const k of Object.keys(o)) walk(o[k], [...p, k]);
})(tokens.color || tokens, []);
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
// Choix du jeton : famille du jeton existant le plus proche de la couleur fautive (même teinte de rôle),
// puis, dans cette famille, le jeton le plus proche qui atteint le seuil ; à défaut, toutes familles confondues.
const fam = (j) => j.split(".")[0];
const jeton = (fg, bg, seuil) => {
  if (!/^#[0-9a-f]{6}$/i.test(fg || "") || !/^#[0-9a-f]{6}$/i.test(bg || "")) return "non calculé (couleur non unie)";
  const dmin = Math.min(...flat.map((t) => dist(t.hex, fg)));
  const fams = new Set(flat.filter((t) => dist(t.hex, fg) === dmin).map((t) => fam(t.jeton))); // ex aequo : toutes leurs familles
  const f0 = [...fams].join("/");
  const ok = flat.map((t) => ({ ...t, r: ratio(t.hex, bg), d: dist(t.hex, fg) })).filter((t) => t.r >= seuil).sort((a, b) => a.d - b.d);
  const best = ok.find((t) => fams.has(fam(t.jeton))) || ok[0];
  return best ? `color.${best.jeton} ${best.hex} (${String(best.r).replace(".", ",")})${fams.has(fam(best.jeton)) ? "" : " — hors famille " + f0}` : "aucun";
};
const nb = (x) => String(x).replace(".", ",");
const pagesDe = (l) => [...new Set(l.map((p) => p.split("@")[0]))];
const esc = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 70);
const out = [];
const T = (titre, entetes, lignes) => { out.push(`\n#### ${titre}\n`, "| " + entetes.join(" | ") + " |", "|" + entetes.map(() => "---").join("|") + "|", ...lignes.map((l) => "| " + l.map(esc).join(" | ") + " |")); };

// fichiers bruts par passage
const runs = S.passages.map((p) => ({ ...p, r: JSON.parse(fs.readFileSync(p.fichier, "utf8")) }));
out.push(`<!-- généré par scripts/tables-readme-dz.cjs le ${new Date().toISOString()} depuis mesures/synthese.json (généré ${S.genere}) -->`);

T("Passages mesurés (6.1, 6.2)", ["page", "taille", "statut", "début UTC", "fin UTC", "fichier brut"],
  runs.map((p) => [p.page, p.viewport, p.statut, p.debut, p.fin, p.fichier]));

T("a. axe (WCAG 2.0, 2.1, 2.2 A et AA) — par règle, tous passages", ["règle", "impact", "nœuds", "passages", "pages"],
  S.axeParRegle.map((a) => [a.regle, a.impact, a.noeuds, a.pages.length, pagesDe(a.pages).join(", ")]));

T("Par passage — décompte des défauts par angle", ["passage", "axe (nœuds)", "b. textes sous seuil", "c. bords < 3:1", "d. cibles < 24 sans exception", "d. cibles 24–44", "e. focus invisible / < 3:1 / masqué / perte", "f. textes < 12 px", "g. animations en cours (réduire activé) / sans fin", "h. images sans dimension / priorité haute", "h. LCP", "h. CLS chargement", "i. sombre change"],
  runs.map(({ r, page, viewport }) => {
    const ax = (r.axe?.violations || []).reduce((s, v) => s + (v.noeuds ?? v.nodes?.length ?? 0), 0);
    const tx = (r.textes?.liste || []).filter((t) => t.defaut).length;
    const bd = (r.bords || []).filter((b) => b.defaut).length;
    const f = S.focus.find((x) => x.page === `${page}@${viewport.split("x")[0]}`) || {};
    const ty = S.typo.find((x) => x.page === `${page}@${viewport.split("x")[0]}`) || {};
    const mv = S.mouvement.find((x) => x.page === `${page}@${viewport.split("x")[0]}`) || {};
    const im = S.images.find((x) => x.page === `${page}@${viewport.split("x")[0]}`) || {};
    return [`${page}@${viewport.split("x")[0]}`, ax, tx, bd, (r.cibles?.sous24 || []).filter((c) => !c.exception).length, (r.cibles?.entre24et44 || []).length,
      `${(f.invisibles || []).length} / ${(f.sous3a1 || []).length} / ${(f.masques || []).length} / ${(f.pertes || []).length}`,
      ty.sous12 ?? "", `${mv.enCours ?? ""} / ${(mv.infinies || []).length}`, `${im.sansDimensionAffichees ?? ""} / ${im.prioriteHaute ?? ""}`,
      im.lcp ? `${im.lcp.ms} ms ${im.lcp.tag || "aucun élément"}` : "", nb(im.clsChargement ?? ""), r.themeSombre ? (r.themeSombre.change ? "oui" : "non") : ""];
  }));

const ct = [...S.contrasteTextes].sort((a, b) => pagesDe(b.pages).length - pagesDe(a.pages).length || a.ratioMin - b.ratioMin);
T(`b. Contraste des textes — groupes couleur × fond × classe (${ct.length} groupes ; tri : pages touchées puis ratio)`,
  ["couleur", "fond peint", "classe", "zone", "ratio min", "seuil", "pages", "occurrences", "exemple (page, texte, px/graisse)", "jeton existant le plus proche qui atteint le seuil"],
  ct.map((g) => { const e = g.exemples?.[0] || {}; return [g.couleur, g.fond, g.classe, g.zone, nb(g.ratioMin), nb(g.seuil), pagesDe(g.pages).length, g.occurrences, `${e.page} « ${String(e.texte).slice(0, 30)} » ${e.px}px/${e.graisse}`, jeton(g.couleur, g.fond, g.seuil)]; }));

T("c. Bords des champs, listes, cases et boutons sans autre repère (seuil 3:1)", ["type", "zone", "classes", "bord", "fond voisin", "ratio", "pages", "jeton existant le plus proche qui atteint 3:1"],
  S.bords.map((b) => [b.type, b.zone, b.classes.slice(0, 60), b.bord, b.fondAutour, nb(b.ratioBord), pagesDe(b.pages).length, jeton(b.bord, b.fondAutour, 3)]));

T("d. Cibles < 24×24 px sans exception WCAG 2.5.8", ["zone", "texte", "taille", "sélecteur", "pages"],
  S.cibles.sous24SansException.map((c) => [c.zone, c.texte || "(vide)", `${c.l}×${c.h}`, c.sel, c.pages.join(", ")]));
const exc = {}; for (const c of S.cibles.sous24AvecException) for (const [k, n] of c.exceptions) { const kk = k === "null" ? "aucune (détail au tableau précédent)" : k; exc[kk] = (exc[kk] || 0) + n; }
T("d. Cibles < 24 px couvertes par une exception WCAG 2.5.8 (somme sur tous les passages)", ["exception", "cibles"], Object.entries(exc));
T("d. Cibles entre 24 et 44 px dans les zones partagées", ["zone", "texte", "taille", "passages"],
  S.cibles.entre24et44Partagees.map((c) => [c.zone, c.texte, c.taille, c.pages.length]));

const fz = {};
for (const f of S.focus) for (const [k, l] of [["invisible", f.invisibles], ["< 3:1", f.sous3a1], ["masqué", f.masques], ["hors écran", f.horsEcran]]) for (const x of l || []) { const key = `${(x.zone || "").split("#")[0]}|${k}`; fz[key] = fz[key] || { n: 0, p: new Set() }; fz[key].n++; fz[key].p.add(f.page); }
T("e. Focus au clavier (40 premiers arrêts) — par zone et nature", ["zone", "nature", "arrêts", "passages"], Object.entries(fz).sort().map(([k, v]) => [...k.split("|"), v.n, v.p.size]));
T("e. Pertes de focus (le focus revient sur body)", ["passage", "arrêt", "après"], S.focus.flatMap((f) => (f.pertes || []).map((p) => [f.page, p.arret, p.apres])));

T("f. Textes < 12 px par zone", ["passage", "< 12 px", "par zone"], S.typo.filter((t) => t.sous12).map((t) => [t.page, t.sous12, JSON.stringify(t.sous12ParZone)]));
T("f. Paragraphes de plus de 3 lignes au-delà de 80 caractères par ligne", ["passage", "longs / mesurés"], S.typo.filter((t) => (t.lignesLongues || []).length).map((t) => [t.page, `${(t.lignesLongues || []).length} / ${t.lignesMesurees ?? ""}`]));
const gr = {}; for (const t of S.typo) for (const g of t.graisses || []) if (g.etat !== "chargée") { const k = `${g.famille} ${g.graisse}|${g.etat}`; gr[k] = gr[k] || new Set(); gr[k].add(t.page); }
T("f. Graisses demandées non servies par un fichier de police", ["famille et graisse", "état", "passages"], Object.entries(gr).map(([k, v]) => [...k.split("|"), [...v].join(", ")]));

T("g. Mouvement avec « réduire les animations » activé", ["passage", "animations en cours", "sans fin", "scroll-behavior html"], S.mouvement.filter((m) => m.enCours).map((m) => [m.page, m.enCours, (m.infinies || []).join(" ; "), m.defilement?.html]));
T("h. Images sans width/height ni aspect-ratio (affichées)", ["passage", "images", "sans dimension", "priorité haute", "CLS après défilement"], S.images.filter((i) => i.total).map((i) => [i.page, i.total, i.sansDimensionAffichees, i.prioriteHaute, nb(i.clsApresDefilement)]));

T("6.3 et 6.4 — 320×640, zoom 200 % (1280×800 émulé), espacements WCAG 1.4.12", ["page", "320 : largeur / dépassements", "zoom : défilement horiz. / coupés / superposés (heuristique) / contrôles absents / masqués", "espacements : coupés / superposés (heuristique)", "début UTC"],
  S.reflow.map((x) => [x.page, `${x.l320.largeur} / ${x.l320.depassements}`, `${x.zoom200.defilementHorizontal ? "oui" : "non"} / ${x.zoom200.coupesNouveaux} / ${x.zoom200.superposesNouveaux} / ${x.zoom200.controlesAbsentsDuDom} / ${x.zoom200.controlesMasques}`,
    `${x.espacements.coupesNouveaux.map((c) => `${c.zone} « ${c.texte} » ${c.debordePx.join("×")} px`).join(" ; ") || "0"} / ${x.espacements.superposesNouveaux}`, x.debut]));

T("6.5 — Sélecteur de véhicule, états (fichiers bruts mesures/selecteur-*.json)", ["passage", "état", "heure UTC", "textes sous seuil", "bords < 3:1", "indicateur de focus (P90 / max)", "remarque", "capture"],
  S.selecteur.flatMap((s) => { const raw = JSON.parse(fs.readFileSync(s.fichier, "utf8")); return s.etats.map((e, i) => { const r = raw.etats[i] || {}; return [`${s.page}@${s.viewport.split("x")[0]}`, e.etat, e.at || "", e.textesSous, e.bordsSous3,
    r.indicateur ? `${nb(r.indicateur.ratioP90)} / ${nb(r.indicateur.ratioMax)}` : "", r.nonApplicable || e.nonMesurable || (r.messageErreur ? `message : ${JSON.stringify(r.messageErreur).slice(0, 50)}` : "") || (r.indiceChargement ? `chargement : ${JSON.stringify(r.indiceChargement).slice(0, 50)}` : ""), r.capture || ""]; }); }));

T("Zones partagées — passages touchés par angle", ["zone", "pages", "angles (pages)"], Object.entries(S.zonesPartagees).map(([z, v]) => [z, v.nbPages, Object.entries(v.angles).map(([a, n]) => `${a} : ${n}`).join(" ; ")]));
T("Requêtes abandonnées (toutes exécutions)", ["requête", "nombre"], Object.entries(S.abandonsTous));
T("Vérification à la main (point 9) — recalcul Python indépendant", ["cas", "nature", "page", "taille", "texte", "texte peint", "fond peint", "ratio", "heure UTC"],
  S.verifManuelle.map((v) => [v.n, v.nature, v.page, v.viewport, v.texte, v.textePeint, v.fondPeint, nb(v.ratioRecalcule), v.at]));
process.stdout.write(out.join("\n") + "\n");
