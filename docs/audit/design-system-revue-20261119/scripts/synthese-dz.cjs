// Mandat DZ — point 6.7 : synthèse des fichiers bruts de mesures/ en tableaux par angle.
// Lecture seule, sans navigateur. Ne recalcule aucune mesure : regroupe et compte.
// Usage : node synthese-dz.cjs <dossier-livrable>   → écrit mesures/synthese.json
const fs = require("node:fs");
const path = require("node:path");
const dir = process.argv[2] || ".";
const md = path.join(dir, "mesures");
const files = fs.readdirSync(md).filter((f) => /^[a-z0-9-]+-(390|1440)\.json$/.test(f) && !/^(selecteur|feuilles|focus-marque)-/.test(f)).sort();
const runs = files.map((f) => ({ f, ...JSON.parse(fs.readFileSync(path.join(md, f), "utf8")) }));
const PARTAGEES = ["en-tete", "pied-de-page", "barre-mobile", "selecteur-vehicule", "chat"];
const vp = (r) => r.viewport.split("x")[0];
const key = (r) => `${r.id}@${vp(r)}`;
const colorClass = (c) => (String(c || "").split(/\s+/).find((x) => /^(text-|placeholder:text-)(?!xs|sm|base|lg|xl|\d|left|right|center|balance|pretty|wrap|nowrap|ellipsis|clip)/.test(x)) || "hérité");
const out = { genere: new Date().toISOString(), passages: runs.map((r) => ({ fichier: "mesures/" + r.f, page: r.id, route: r.route, viewport: r.viewport, statut: r.statut, debut: r.debut, fin: r.fin })) };

// a — axe
out.axe = runs.map((r) => ({ page: key(r), violations: (r.axe.violations || []).map((v) => `${v.id}:${v.noeuds}`), incomplets: (r.axe.incomplets || []).length }));
const axeTot = {}; for (const r of runs) for (const v of r.axe.violations || []) { axeTot[v.id] = axeTot[v.id] || { regle: v.id, impact: v.impact, noeuds: 0, pages: new Set() }; axeTot[v.id].noeuds += v.noeuds; axeTot[v.id].pages.add(key(r)); }
out.axeParRegle = Object.values(axeTot).map((x) => ({ ...x, pages: [...x.pages] })).sort((a, b) => b.noeuds - a.noeuds);

// b — contraste des textes (ratio retenu = pixels p10 si contrôlé, sinon calcul)
const grp = new Map();
for (const r of runs) for (const t of r.textes.liste) {
  if (!t.defaut) continue;
  const fond = t.pixels && t.pixels.fondsMajoritaires ? t.pixels.fondsMajoritaires[0].split(" ")[0] : t.bg;
  const k = [t.fg, fond, colorClass(t.classes), PARTAGEES.includes(t.zone) ? t.zone : "contenu"].join("|");
  const g = grp.get(k) || { couleur: t.fg, fond, classe: colorClass(t.classes), zone: PARTAGEES.includes(t.zone) ? t.zone : "contenu", ratioMin: 99, seuil: t.seuil, pages: new Set(), occurrences: 0, exemples: [], methode: new Set() };
  g.ratioMin = Math.min(g.ratioMin, t.ratioRetenu); g.seuil = Math.min(g.seuil, t.seuil); g.pages.add(key(r)); g.occurrences++;
  g.methode.add(t.pixels && t.pixels.p10 !== undefined ? "pixels" : "calcul");
  if (g.exemples.length < 3) g.exemples.push({ page: key(r), texte: t.texte, sel: t.sel, px: t.px, graisse: t.graisse });
  grp.set(k, g);
}
out.contrasteTextes = [...grp.values()].map((g) => ({ ...g, pages: [...g.pages], nbPages: new Set([...g.pages].map((p) => p.split("@")[0])).size, methode: [...g.methode].join("+") })).sort((a, b) => b.nbPages - a.nbPages || a.ratioMin - b.ratioMin);

// c — bords
const gb = new Map();
for (const r of runs) for (const b of r.bords || []) {
  if (!b.defaut) continue;
  const k = [b.type, b.zone, b.classes, b.fondAutour].join("|");
  const g = gb.get(k) || { type: b.type, zone: b.zone, classes: b.classes, fondAutour: b.fondAutour, bord: b.bord, remplissage: b.remplissage, ratioBord: b.ratioBord, ratioRemplissage: b.ratioRemplissage, pages: new Set(), exemple: b.texte };
  g.pages.add(key(r)); gb.set(k, g);
}
out.bords = [...gb.values()].map((g) => ({ ...g, pages: [...g.pages] })).sort((a, b) => b.pages.length - a.pages.length);

// d — cibles
const gc = new Map(), g44 = new Map();
for (const r of runs) {
  for (const c of (r.cibles.sous24 || []).filter((x) => !x.exception)) { const k = [c.zone, c.texte, c.l + "×" + c.h].join("|"); const g = gc.get(k) || { ...c, pages: new Set() }; g.pages.add(key(r)); gc.set(k, g); }
  for (const c of r.cibles.entre24et44 || []) { const k = [PARTAGEES.includes(c.zone) ? c.zone : "contenu", c.texte].join("|"); const g = g44.get(k) || { zone: c.zone, texte: c.texte, taille: c.l + "×" + c.h, pages: new Set() }; g.pages.add(key(r)); g44.set(k, g); }
}
out.cibles = { sous24SansException: [...gc.values()].map((g) => ({ ...g, pages: [...g.pages] })), sous24AvecException: runs.map((r) => ({ page: key(r), n: (r.cibles.sous24 || []).length, exceptions: Object.entries((r.cibles.sous24 || []).reduce((a, c) => ((a[c.exception] = (a[c.exception] || 0) + 1), a), {})) })), entre24et44: runs.map((r) => ({ page: key(r), n: (r.cibles.entre24et44 || []).length })), entre24et44Partagees: [...g44.values()].filter((g) => PARTAGEES.includes(g.zone)).map((g) => ({ ...g, pages: [...g.pages] })) };

// e — focus
out.focus = runs.map((r) => {
  const f = r.focus.filter((x) => x.tag !== "body" && !/bouclage/.test(x.note || ""));
  return {
    page: key(r), arrets: f.length, bouclage: r.focus.some((x) => /bouclage|fin du parcours/.test(x.note || "")),
    pertes: r.focus.filter((x) => x.tag === "body").map((x) => ({ arret: x.arret, apres: x.apres || null })),
    invisibles: f.filter((x) => x.indicateurVisible === false).map((x) => ({ arret: x.arret, zone: x.zone, texte: x.texte, sel: x.sel, p90: x.indicateur && x.indicateur.ratioP90, outline: x.outline })),
    sous3a1: f.filter((x) => x.indicateurVisible && x.indicateur3a1 === false).map((x) => ({ arret: x.arret, zone: x.zone, texte: x.texte, p90: x.indicateur.ratioP90, outline: x.outline })),
    masques: f.filter((x) => x.pointsCaches > 0).map((x) => ({ arret: x.arret, zone: x.zone, texte: x.texte, pointsCaches: x.pointsCaches, cacheur: x.cacheur })),
    horsEcran: f.filter((x) => x.visible === false).map((x) => ({ arret: x.arret, zone: x.zone, texte: x.texte, sel: x.sel })),
    retours: f.filter((x) => x.ordre !== "ok").map((x) => ({ arret: x.arret, zone: x.zone, texte: x.texte })),
  };
});

// f — typographie
out.typo = runs.map((r) => {
  const hist = {}; const sous12 = [];
  for (const t of r.textes.liste) { const k = Math.round(t.px); hist[k] = (hist[k] || 0) + 1; if (t.px < 12) sous12.push({ px: t.px, zone: t.zone, texte: t.texte, classes: (String(t.classes).match(/text-\[?[0-9.]+(px|rem)\]?|text-(xs|\[\d+px\])/g) || []).join(" ") }); }
  return { page: key(r), histogramme: hist, sous12: sous12.length, sous12Exemples: sous12.slice(0, 12), sous12ParZone: sous12.reduce((a, x) => ((a[x.zone.startsWith("contenu") ? "contenu" : x.zone] = (a[x.zone.startsWith("contenu") ? "contenu" : x.zone] || 0) + 1), a), {}), rendu: r.polices.renduParRole, graisses: r.polices.graissesDemandees, faces: r.polices.faces, lignesLongues: (r.lignes || []).filter((l) => l.caracteresParLigne > 80).map((l) => ({ zone: l.zone, cpl: l.caracteresParLigne, largeurPx: l.largeurPx, debut: l.debut })), lignesMesurees: (r.lignes || []).length };
});

// g — mouvement ; h — images/perf ; i — sombre
out.mouvement = runs.map((r) => ({ page: key(r), enCours: r.mouvement.enCours, infinies: r.mouvement.infinies.map((a) => `${a.nom} (${a.zone}, ${a.dureeMs} ms)`), defilement: r.mouvement.defilement }));
out.images = runs.map((r) => ({ page: key(r), total: r.images.total, sansDimension: r.images.sansDimension, sansDimensionAffichees: r.images.sansDimensionAffichees, exemples: (r.images.liste || []).slice(0, 5), prioriteHaute: (r.images.prioriteHaute || []).length, lazyPremierEcran: r.images.lazyPremierEcran, lcp: r.perf.lcp && { ms: r.perf.lcp.ms, tag: r.perf.lcp.tag, element: r.perf.lcp.element }, clsChargement: r.perf.clsChargement, clsApresDefilement: r.perf.clsApresDefilement }));
out.sombre = runs.map((r) => ({ page: key(r), change: r.themeSombre.change, capture: r.themeSombre.capture || null }));

// composants partagés : pages touchées par au moins un défaut dans la zone
const zones = {};
const touch = (z, r, angle) => { if (!PARTAGEES.includes(z)) return; zones[z] = zones[z] || { pages: new Set(), angles: {} }; zones[z].pages.add(r.id); zones[z].angles[angle] = zones[z].angles[angle] || new Set(); zones[z].angles[angle].add(r.id); };
for (const r of runs) {
  for (const t of r.textes.liste) if (t.defaut) touch(t.zone, r, "contraste texte");
  for (const b of r.bords || []) if (b.defaut) touch(b.zone, r, "bord");
  for (const c of (r.cibles.sous24 || []).filter((x) => !x.exception)) touch(c.zone, r, "cible < 24");
  for (const f of r.focus) { if (f.indicateurVisible === false) touch(f.zone, r, "focus invisible"); else if (f.indicateur3a1 === false) touch(f.zone, r, "focus < 3:1"); if (f.pointsCaches > 0) touch(f.zone, r, "focus masqué"); }
}
out.zonesPartagees = Object.fromEntries(Object.entries(zones).map(([z, v]) => [z, { nbPages: v.pages.size, pages: [...v.pages].sort(), angles: Object.fromEntries(Object.entries(v.angles).map(([a, s]) => [a, s.size])) }]));
out.abandons = runs.flatMap((r) => r.requetesAbandonnees.map((a) => `${a.method} ${a.url.replace(/^https?:\/\/127\.0\.0\.1:3000/, "")} (${a.raison})`)).reduce((acc, x) => ((acc[x] = (acc[x] || 0) + 1), acc), {});
out.erreursPage = runs.map((r) => ({ page: key(r), erreurs: (r.erreursPage || []).length, chargementsDocument: (r.chargementsDocument || []).length }));
// 6.3 / 6.4 — reflow (un fichier par page)
const J = (f) => JSON.parse(fs.readFileSync(path.join(md, f), "utf8"));
const lst = (re) => fs.readdirSync(md).filter((f) => re.test(f)).sort();
out.reflow = lst(/-reflow\.json$/).map((f) => { const r = J(f); return { page: r.id, l320: { largeur: r.l320.largeurDocument, depassements: r.l320.nbDepassements, defilementHorizontal: r.l320.defilementHorizontal },
  zoom200: { defilementHorizontal: r.zoom200.defilementHorizontal, coupesNouveaux: r.zoom200.textesCoupesNouveaux.length, superposesNouveaux: r.zoom200.textesSuperposesNouveaux.length, controlesAbsentsDuDom: r.zoom200.controlesAbsentsDuDom.length, controlesMasques: r.zoom200.controlesMasques },
  espacements: { coupesNouveaux: r.espacements.textesCoupesNouveaux.map((c) => ({ zone: c.zone, texte: c.texte, ellipse: c.ellipse, lineClamp: c.lineClamp, debordePx: c.debordePx })), superposesNouveaux: r.espacements.textesSuperposesNouveaux.length }, debut: r.debut, fin: r.fin }; });
// 6.5 — sélecteur de véhicule, sonde de perte de focus, feuilles de style, superpositions, en-tête
out.selecteur = lst(/^selecteur-.*\.json$/).map((f) => { const r = J(f); return { fichier: "mesures/" + f, page: r.id, viewport: r.viewport, debut: r.debut, etats: r.etats.map((e) => ({ etat: e.etat, at: e.at, textesSous: (e.textes || []).filter((t) => t.ratio < t.seuil).length, bordsSous3: (e.bords || []).filter((b) => b.defaut).length, focus: e.focus || null, note: e.note || null, nonMesurable: e.nonMesurable || null })), parcoursClavierMarque: r.parcoursClavierMarque }; });
out.focusMarque = lst(/^focus-marque-.*\.json$/).map((f) => { const r = J(f); return { page: r.id, viewport: r.viewport, at: r.at, elementPrecedent: r.elementPrecedent, releves: r.releves, tabSuivante: r.tabSuivante || null }; });
out.feuilles = lst(/^feuilles-.*\.json$/).map((f) => ({ fichier: "mesures/" + f, ...J(f) }));
out.superpositionsVerifiees = lst(/^superpositions-.*\.json$/).flatMap((f) => J(f).cas.map((c) => ({ page: J(f).id, ...c })));
out.verifManuelle = fs.existsSync(path.join(md, "verif-manuelle.json")) ? J("verif-manuelle.json").cas : [];
// requêtes abandonnées de tous les fichiers (mesure, reflow, sélecteur, sondes)
for (const f of lst(/\.json$/).filter((f) => !/^(synthese|verif-manuelle)\.json$/.test(f))) { const r = J(f); for (const a of r.requetesAbandonnees || []) { const k = `${a.method} ${a.url.replace(/^https?:\/\/127\.0\.0\.1:3000/, "").replace(/\?.*$/, "?…")} (${a.raison})`; out.abandonsTous = out.abandonsTous || {}; out.abandonsTous[k] = (out.abandonsTous[k] || 0) + 1; } }
fs.writeFileSync(path.join(md, "synthese.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ passages: runs.length, groupesContraste: out.contrasteTextes.length, groupesBords: out.bords.length, zones: out.zonesPartagees }, null, 1));
