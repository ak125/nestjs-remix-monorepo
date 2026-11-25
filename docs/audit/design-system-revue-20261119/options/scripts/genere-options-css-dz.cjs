// Complément n° 2 DZ — génère options/option-a.css et options/option-b.css à partir d'une seule table de règles.
// Les deux feuilles ne diffèrent que par le point 2 (action d'achat). Maquette par feuille injectée, pas une implémentation.
// Usage (depuis options/) : node scripts/genere-options-css-dz.cjs .
const fs = require("node:fs"); const path = require("node:path");
const out = process.argv[2] || ".";
const T = { navy: "#0F1E38", lien: "#0F4C81", texte: "#1F2937", texte2: "#4B5563", texte2Sombre: "#9CA3AF", bord: "#6B7280", succes: "#1E8449", erreur: "#C0392B", avert: "#FEF3C7", neutre50: "#F5F7FA", neutre100: "#E5E7EB", blanc: "#FFFFFF" };
const OPTIONS = {
  a: { nom: "OPTION A", fond: "#F97316", texte: T.navy, survol: "#EA580C", note: "fond cta.500 #F97316, texte navy ; survol cta.600 #EA580C (un ton plus foncé de la même échelle)" },
  b: { nom: "OPTION B", fond: "#C2410C", texte: T.blanc, survol: "#9A3412", note: "fond cta.700 #C2410C, texte blanc ; survol cta.800 #9A3412 (un ton plus foncé de la même échelle)" },
  // Complément n° 3 : jeu réduit de A, sauf le bouton d'achat (r2-produit seulement sur les planches).
  c: { nom: "OPTION C", complement: "n° 3", fond: "#1E8449", texte: T.blanc, survol: "#196F3D", note: "fond semantic.success #1E8449, texte blanc ; survol #196F3D (VALEUR NOUVELLE, absente des jetons : semantic.success n'a pas d'échelle). Les états positifs (en stock, compatible, validé) gardent #1E8449 (point 7), volontairement" },
  // Complément n° 4 : option A corrigée (A2). Trois changements seulement par rapport à A : logo orange,
  // action principale de chaque page en orange (pas seulement l'achat), fil d'Ariane lisible sur navy.
  a2: { nom: "OPTION A2", complement: "n° 4", fond: "#F97316", texte: T.navy, survol: "#EA580C", principales: true,
        desactive: { fond: "#FED7AA", texte: T.navy }, logo: "#F97316",
        note: "action principale de chaque page (achat, « Rechercher des pièces », « Trouver une pièce », « Se connecter ») : fond cta.500 #F97316, texte navy ; survol cta.600 #EA580C ; désactivé fond cta.200 #FED7AA, texte navy, opacité 1. Logo « MECANIK » cta.500 #F97316 sur navy. Fil d'Ariane sur navy : neutral.300 #9CA3AF, page courante blanc" },
  // Complément n° 5 : A3 = A2 + règles ajoutées après celles d'A2 (A2 retenue par Marwane, 20 nov. 2026 12:03 Tunis).
  // Seules différences : « Ajouter » des cartes R2 en contour navy (une seule action orange par écran), « Inscription » en
  // contour blanc sur navy, marges de défilement sous les barres fixes, bords et badges sous seuil corrigés.
  a3: { nom: "OPTION A3", complement: "n° 5", fond: "#F97316", texte: T.navy, survol: "#EA580C", principales: true, a3: true,
        desactive: { fond: "#FED7AA", texte: T.navy }, logo: "#F97316",
        note: "comme A2 (fond cta.500 #F97316, texte navy ; survol cta.600 #EA580C ; désactivé #FED7AA, texte navy, opacité 1), sauf « Ajouter » des cartes de la liste R2 : contour navy 2 px, fond transparent, texte navy ; survol fond navy à 8 % ; désactivé fond neutral.50 #F5F7FA, contour et texte neutral.500 #4B5563 en pointillé. Une seule action orange par écran : « Panier » de la barre collante (390) ou l'achat principal de la fiche" },
};
const q = (c) => `[class~="${c.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;                 // classe rendue exacte
const L = (...cs) => cs.map(q).join(",\n");
const hov = (...cs) => cs.map((c) => `${q(c)}:hover`).join(",\n");
const gh = (...cs) => cs.map((c) => `[class~="group"]:hover ${q(c)}`).join(",\n");
const ghLink = (...cs) => cs.map((c) => `[class~="group/link"]:hover ${q(c)}`).join(",\n");
const gActive = (...cs) => cs.map((c) => `[class~="group"][data-state="active"] ${q(c)}`).join(",\n");
const join = (...xs) => xs.filter(Boolean).join(",\n");
// Arrêts de dégradé saturés relevés sur les 5 pages (sonde classes-colorees, 09:2xZ) et non couverts par une classe from-* ci-dessous :
// visibles surtout au survol (filet de carte to-pink-500) ou sur des tuiles non rendues au repos.
const ARRETS_FORTS = ["from-cyan-400", "from-emerald-600", "from-fuchsia-500", "from-lime-500", "from-orange-600", "from-rose-600", "from-sky-400", "from-teal-600", "from-violet-600", "to-amber-500", "to-amber-600", "to-blue-700", "to-cta-hover", "to-cta-light", "to-cyan-500", "to-cyan-600", "to-cyan-700", "to-emerald-500", "to-emerald-600", "to-green-500", "to-green-600", "to-green-700", "to-lime-500", "to-orange-600", "to-pink-500", "to-pink-600", "to-pink-700", "to-purple-800", "to-red-700", "to-rose-600", "to-rose-700", "to-semantic-action/90", "to-teal-600", "to-violet-700", "via-green-500", "via-sky-500"];
const ARRETS_CLAIRS = ["to-blue-100", "to-emerald-50", "to-red-50", "to-yellow-100"];
// Surfaces fortes que la feuille rend navy : leurs descendants sont alors « sur fond navy ».
const FORTES = ["bg-cta", "bg-cta/90", "bg-orange-500", "bg-amber-500", "bg-blue-600", "bg-blue-500", "from-cta", "from-orange-500", "from-semantic-action", "from-yellow-400", "from-blue-500", "from-blue-400", "from-indigo-500", "from-purple-600", "from-pink-500", "from-red-600", "from-emerald-500", "from-emerald-400", "from-green-400", "from-green-500", "from-blue-950", "to-blue-600", ...ARRETS_FORTS];
const SOMBRE = `:is(${["header", "footer", q("bg-navy"), '[class*="from-navy"]', q("bg-slate-900"), '[class*="from-slate-900"]', '[class*="from-slate-800"]', q("bg-neutral-900/80"), 'section[class~="text-white"][style*="gradient"]', ...FORTES.map(q)].join(", ")})`;
// Surfaces claires posées dans une zone sombre (carte blanche du bandeau d'accueil, par exemple) : on y revient au contexte clair.
const CLAIR = `:is(${["bg-white", "bg-white/95", "bg-white/90", "bg-slate-50", "bg-gray-50", "bg-card", "bg-background"].map(q).join(", ")})`;
// Contexte sombre : sous une surface sombre, sauf sous une carte claire posée dedans ; une surface sombre
// imbriquée dans cette carte claire (onglets bg-slate-900 du sélecteur véhicule) redevient sombre.
const inSombre = (sel) => sel.split(",\n").flatMap((s) => [`${SOMBRE} ${s}:not(${SOMBRE} ${CLAIR} *)`, `${SOMBRE} ${CLAIR} ${SOMBRE} ${s}`]).join(",\n");
// Surface sombre en mobile seulement (bg-slate-900 md:bg-white/95, bandeau véhicule R2) : à partir de 768 px, contexte clair.
const CLAIR_MD = '[class*="md:bg-white"]';
const ACHAT = `:is(button[aria-label^="Ajouter"][aria-label$="au panier"], button${q("bg-orange-500")}${q("rounded-xl")}, form[method="post" i] button[type="submit"]):not(#dz-option)`;
const BARRE = 'nav[aria-label="Navigation mobile"]';
// Complément n° 4 (A2 seulement) : action principale de chaque page, en plus de l'achat. Sélecteurs relevés par sonde
// en lecture seule (20 nov. 2026) : « Rechercher des pièces » du sélecteur véhicule mobile (r0, r1 ; bg-cta + disabled:opacity-40,
// unique sur les 5 pages) et « Trouver une pièce » du panier vide (lien bg-blue-600 h-12 px-8, unique). « Se connecter » est
// déjà couvert par ACHAT (bouton submit d'un formulaire POST).
const PRINCIPALE = `:is(button[aria-label^="Ajouter"][aria-label$="au panier"], button${q("bg-orange-500")}${q("rounded-xl")}, form[method="post" i] button[type="submit"], button${q("bg-cta")}${q("disabled:opacity-40")}, a${q("bg-blue-600")}${q("h-12")}${q("px-8")}):not(#dz-option)`;
const LOGO = `:is(header, nav${q("bg-navy")}) a[href="/"] span${q("text-cta")}:not(#dz-logo)`;
const ARIANE = `[class*="from-navy"] nav${q("text-[10px]")}`;

function regles(o) {
  const R = [];
  const r = (point, quoi, sel, decl, media) => R.push({ point, quoi, sel, decl, media });
  // ---------- 1 : structure navy ----------
  r(1, "en-tête, pied de page et barres de structure navy", join(L("bg-navy"), "footer"), `background-color:${T.navy}`);
  r(1, "bandeau R2 à dégradé de marque en style en ligne (noir → jaune) ramené à navy (style en ligne écrasé par !important)", 'section[class~="text-white"][style*="gradient"]', `background-image:none;background-color:${T.navy}`);
  r(1, "titres navy sur fond clair (y compris carte claire posée dans une zone sombre)", join(`:is(h1,h2,h3,h4):not(${SOMBRE} *):not(${q("text-white")})`, `${SOMBRE} ${CLAIR} :is(h1,h2,h3,h4):not(${q("text-white")})`), `color:${T.navy}`);
  // ---------- 3 : l'orange (et l'ambre / le jaune décoratifs) disparaît hors action d'achat ----------
  r(3, "arrêts de dégradé saturés (orange, ambre, bleu, cyan, vert vif, rose, violet) → navy, texte blanc ; placés avant les états (point 7), qui gardent la main", L(...ARRETS_FORTS), `background-image:none;background-color:${T.navy};color:${T.blanc}`);
  r(3, "arrêts de dégradé clairs (bleu, vert, rouge, jaune 50 à 100) → neutre 50 ; l'avertissement (point 7) garde la main", L(...ARRETS_CLAIRS), `background-image:none;background-color:${T.neutre50}`);
  r(3, "surfaces orange, ambre, jaune et dégradés orange non achat → navy, texte blanc", join(L("bg-cta", "bg-cta/90", "bg-orange-500", "bg-amber-500", "from-cta", "from-orange-500", "from-semantic-action", "from-yellow-400"), hov("hover:bg-cta", "hover:bg-cta-hover", "hover:bg-orange-600"), ghLink("group-hover/link:bg-cta")), `background-image:none;background-color:${T.navy};color:${T.blanc}`);
  r(3, "filet décoratif en dégradé orange (via-cta/50) → filet navy atténué", L("via-cta/50"), `background-image:none;background-color:rgba(15,30,56,.25)`);
  r(3, "teintes claires orange, ambre et jaune décoratives → neutre 50", join(L("bg-cta/10", "bg-cta/15", "bg-orange-50", "bg-orange-50/80", "bg-orange-100", "from-orange-50", "bg-amber-50", "bg-amber-100"), hov("hover:bg-orange-50", 'hover:bg-orange-50"', "hover:bg-orange-100", "hover:bg-amber-200"), gh("group-hover:bg-orange-50", "group-hover:bg-cta/15"), gActive("group-data-[state=active]:bg-cta/10")), `background-image:none;background-color:${T.neutre50}`);
  r(3, "textes orange, ambre, jaune et semantic-action → navy (graisse inchangée)", L("text-cta", "text-cta-light", "text-orange-500", "text-orange-600", "text-orange-700", "text-orange-800", "text-orange-900", "text-semantic-action", "text-semantic-action/70", "text-amber-400", "text-amber-600", "text-amber-700", "text-amber-800", "text-yellow-600", "text-yellow-800"), `color:${T.navy}`);
  r(3, "survols de texte orange → lien #0F4C81", join(hov("hover:text-cta", "hover:text-amber-900"), gh("group-hover:text-cta", "group-hover:text-semantic-action", "group-hover:text-semantic-action/80")), `color:${T.lien}`);
  r(3, "onglet actif (texte orange) → navy, graisse plus forte", gActive("group-data-[state=active]:text-cta"), `color:${T.navy};font-weight:800`);
  r(3, "bords orange, ambre, jaune décoratifs → neutre 100", L("border-orange-100", "border-orange-200", "border-amber-200", "border-yellow-200"), `border-color:${T.neutre100}`);
  r(3, "bords orange au survol ou au focus de champ → navy", join(hov("hover:border-cta", "hover:border-cta/30", "hover:border-orange-400", "hover:border-semantic-action"), L("border-cta"), `${q("focus:border-cta")}:focus`), `border-color:${T.navy}`);
  r(3, "ombres et anneaux décoratifs orange ou indigo → ombre neutre", L("shadow-orange-200", "shadow-cta/30", "shadow-indigo-500/30", "ring-orange-500/30", "ring-cta-light/30", "ring-amber-100", "ring-violet-100", "ring-blue-100", "ring-blue-200"), `--tw-shadow-color:rgba(15,30,56,.12);--tw-ring-color:${T.neutre100}`);
  // ---------- 4 : liens et actions secondaires #0F4C81 ; bleu brut ramené ----------
  r(4, "liens à texte orange ou vert → #0F4C81", join(`a${q("text-cta")}`, `a ${q("text-cta")}`, `a${q("text-orange-900")}`, `a${q("text-emerald-600")}`, `a${q("text-teal-600")}`, `a${q("text-amber-700")}`, `${q("gamme-editorial")} a`, `a${q("seo-internal-link")}`), `color:${T.lien}`);
  r(4, "texte bleu brut (600, 700, 500, 400) → #0F4C81", L("text-blue-400", "text-blue-500", "text-blue-600", "text-blue-700", "text-emerald-600", "text-teal-600", "text-cyan-700"), `color:${T.lien}`);
  r(4, "texte bleu foncé (800, 900) → navy", L("text-blue-800", "text-blue-900"), `color:${T.navy}`);
  r(4, "surfaces bleues brutes et dégradés bleus → navy, texte blanc", join(L("bg-blue-600", "bg-blue-500", "from-blue-500", "from-blue-400", "from-indigo-500", "from-blue-950", "to-blue-600"), hov("hover:bg-blue-700"), `${q("focus:bg-blue-500")}:focus`), `background-image:none;background-color:${T.navy};color:${T.blanc}`);
  r(4, "teintes bleues claires (fond de carte, puce) → neutre 50", join(L("bg-blue-50", "bg-blue-100", "bg-blue-50/50", "bg-blue-500/10", "bg-blue-500/20", "from-blue-50", "via-blue-50/30", "to-blue-50", "bg-cyan-50"), hov('hover:bg-blue-50"', "hover:bg-blue-50")), `background-image:none;background-color:${T.neutre50}`);
  r(4, "bords bleus décoratifs → neutre 100 ; survol → navy", L("border-blue-100", "border-blue-200", "border-indigo-200", "border-purple-200"), `border-color:${T.neutre100}`);
  r(4, "bords bleus au survol et filet d'accent de titre → navy", join(hov("hover:border-blue-200", "hover:border-blue-400", "hover:border-indigo-400"), L("border-blue-500"), gh("group-hover:ring-indigo-400/30")), `border-color:${T.navy};--tw-ring-color:rgba(15,30,56,.3)`);
  // ---------- 5 : texte ----------
  r(5, "texte courant #1F2937", join("body", L("text-slate-700", "text-slate-800", "text-gray-700", "text-gray-800")), `color:${T.texte}`);
  r(5, "texte secondaire jamais plus clair que #4B5563 sur fond clair (gris 300 à 500, muted, blanc translucide)", L("text-slate-300", "text-slate-400", "text-slate-500", "text-gray-300", "text-gray-400", "text-gray-500", "text-neutral-400", "text-neutral-500", "text-muted-foreground", "text-white/15", "text-white/20", "text-white/25", "text-white/30", "text-white/35", "text-white/40"), `color:${T.texte2}`);
  r(5, "texte indicatif des champs sur fond clair → #4B5563", `:is(input,textarea)::placeholder`, `color:${T.texte2};opacity:1`);
  r(5, "texte bleu très clair → neutre 100 (sur fond sombre)", L("text-blue-100"), `color:${T.neutre100}`);
  // ---------- 6 : bords des champs, listes et cases ----------
  r(6, "bords des champs, listes et cases #6B7280", join("input:not([type=hidden]):not([type=range])", "select", "textarea", '[role="combobox"]', '[role="checkbox"]', '[role="radio"]', L("border-input", "border-blue-400", "border-cyan-400", "border-emerald-400", "border-amber-400")), `border-color:${T.bord}`);
  // ---------- 7 : états ----------
  r(7, "succès : pastilles et étiquettes vertes → #1E8449, texte blanc", join(L("bg-green-500", "bg-emerald-400", "bg-emerald-500"), `${q("bg-green-100")}${q("text-green-700")}`), `background-image:none;background-color:${T.succes};color:${T.blanc}`);
  r(7, "erreur : icônes rouges → #C0392B ; survol rouge → #C0392B", join(L("text-red-500"), gh("group-hover:bg-red-500")), `color:${T.erreur}`);
  r(7, "erreur : fond de survol rouge → #C0392B, texte blanc", gh("group-hover:bg-red-500"), `background-color:${T.erreur};color:${T.blanc}`);
  r(7, "teintes rouges et vertes de cartes (non états) → neutre", L("bg-red-50", "bg-green-50/50", "bg-green-100", "bg-emerald-50", "from-green-50"), `background-image:none;background-color:${T.neutre50}`);
  r(7, "bords rouges et verts de cartes → neutre 100", L("border-red-100", "border-green-100", "border-green-200", "border-emerald-200"), `border-color:${T.neutre100}`);
  r(7, "avertissement (VALEUR NOUVELLE #FEF3C7, absente des jetons) : encadrés ambre ou jaune à message → fond jaune clair, texte #1F2937", join(`${q("bg-amber-50")}${q("border-amber-200")}`, L("bg-amber-50/50", "from-yellow-50")), `background-image:none;background-color:${T.avert};border-color:${T.avert};color:${T.texte}`);
  r(7, "avertissement : textes de l'encadré → #1F2937 ; lien de l'encadré → #0F4C81 sur blanc", join(`:is(${q("bg-amber-50")}${q("border-amber-200")}, ${q("from-yellow-50")}) :is(${L("text-amber-800", "text-amber-600", "text-yellow-800", "text-yellow-600").replace(/\n/g, " ")})`), `color:${T.texte}`);
  r(7, "avertissement : lien d'action de l'encadré", `${q("text-amber-700")}${q("bg-amber-100")}`, `background-color:${T.blanc};color:${T.lien}`);
  // ---------- 9 : violets, roses, corail, vert vif ----------
  r(9, "tuiles de catégorie violettes, roses, corail, vertes, jaunes et barres vert vif → navy", L("from-purple-600", "from-pink-500", "from-red-600", "from-emerald-500", "from-emerald-400", "from-green-400", "from-green-500"), `background-image:none;background-color:${T.navy};color:${T.blanc}`);
  r(9, "prix et notes en vert vif → navy (ni lien ni état)", L("text-green-600", "text-green-700", "text-emerald-700"), `color:${T.navy}`);
  r(9, "puces de filtre colorées (ambre, bleu, émeraude, cyan) → neutres : fond blanc, texte #1F2937", join(...["amber", "blue", "emerald", "cyan"].map((c) => `button${q(`bg-${c}-50`)}[class*="border-${c}-400"]`)), `background-color:${T.blanc};color:${T.texte}`);
  r(9, "étiquette « GRATUIT » verte → neutre, texte navy", `${q("text-emerald-700")}${q("bg-emerald-50")}`, `background-color:${T.neutre50};color:${T.navy}`);
  // ---------- survol et focus (points 3, 4, 8) : classes d'état relevées sur les 5 pages ----------
  r(4, "survols de texte bleu, orange, vert ou primary → lien #0F4C81", join(hov("hover:text-blue-300", "hover:text-blue-600", "hover:text-blue-700", "hover:text-blue-800", "hover:text-blue-900", "md:hover:text-blue-800", "hover:text-cta-hover", "hover:text-cta-light", "hover:text-emerald-800", "hover:text-primary", "hover:text-semantic-action", "hover:text-teal-800"), gh("group-hover:text-blue-500", "group-hover:text-blue-600", "group-hover:text-blue-700", "group-hover:text-blue-900", "group-hover:text-cta-light")), `color:${T.lien}`);
  r(4, "texte bleu aux points de rupture md/lg → #0F4C81", L("md:text-blue-600", "lg:text-blue-600"), `color:${T.lien}`);
  r(4, "teintes bleues et orange claires au survol ou au point de rupture md → neutre 50", join(L("md:bg-blue-100"), hov("hover:bg-blue-100", "md:hover:bg-blue-50", "hover:bg-orange-50/50"), gh("group-hover:bg-blue-100")), `background-image:none;background-color:${T.neutre50}`);
  r(3, "bords bleus ou rouges au survol, bords orange au focus → navy", join(hov("hover:border-blue-300", "hover:border-red-200"), `${q("focus-visible:border-cta")}:focus-visible`, `${q("focus-visible:border-cta/40")}:focus-visible`), `border-color:${T.navy}`);
  r(3, "ombres orange (au repos et au survol) et anneau vert décoratif → neutres", join(L("shadow-orange-500/25", "ring-emerald-100"), hov("hover:shadow-cta/40")), `--tw-shadow-color:rgba(15,30,56,.12);--tw-ring-color:${T.neutre100}`);
  r(8, "anneaux de focus orange ou bleus (focus:ring-*, y compris focus à la souris) → navy", join(...["focus:ring-blue-300", "focus:ring-cta/20", "focus:ring-cta/50"].map((c) => `${q(c)}:focus`), ...["focus-visible:ring-cta/10", "focus-visible:ring-cta/50"].map((c) => `${q(c)}:focus-visible`)), `--tw-ring-color:${T.navy}`);
  // ---------- contexte sombre (règles 1, 3, 4, 5) : sur fond navy ----------
  r(3, "sur fond navy : textes orange, bleus et verts → blanc", inSombre(L("text-cta", "text-cta-light", "text-blue-400", "text-emerald-300", "text-orange-500")), `color:${T.blanc}`);
  r(4, "sur fond navy : survols de texte colorés → blanc", join(inSombre(hov("hover:text-blue-300", "hover:text-cta-light", "hover:text-cta-hover", "hover:text-blue-600")), inSombre(gh("group-hover:text-cta-light", "group-hover:text-blue-500"))), `color:${T.blanc}`);
  r(3, "sur fond navy : teintes claires orange → blanc translucide", inSombre(L("bg-cta/10", "bg-cta/15")), `background-color:rgba(255,255,255,.1)`);
  r(5, "sur fond navy : texte secondaire jamais plus sombre que #9CA3AF", inSombre(L("text-slate-300", "text-gray-300", "text-slate-400", "text-slate-500", "text-gray-400", "text-gray-500", "text-white/15", "text-white/20", "text-white/25", "text-white/30", "text-white/35", "text-white/40", "text-white/45", "text-white/50")), `color:${T.texte2Sombre}`);
  r(5, "sur fond navy : texte indicatif des champs → #9CA3AF", `${SOMBRE} :is(input,textarea):not(${SOMBRE} ${CLAIR} *)::placeholder`, `color:${T.texte2Sombre};opacity:1`);
  r(6, "sur fond navy : bords de champs → #9CA3AF (seuil sombre du point 5)", inSombre(":is(input:not([type=hidden]), select, textarea)"), `border-color:${T.texte2Sombre}`);
  r(1, "sur fond navy : titres blancs, y compris leurs portions en text-foreground (bandeau R2)", join(inSombre(":is(h1,h2,h3,h4)"), inSombre(`:is(h1,h2,h3,h4) ${q("text-foreground")}`)), `color:${T.blanc}`);
  // ---------- 3 : barre mobile ----------
  r(3, "barre mobile : onglet actif orange → navy et graisse plus forte", `${BARRE} ${q("text-cta")}`, `color:${T.navy};font-weight:800`);
  r(3, "barre mobile : indicateur en dégradé orange → navy", `${BARRE} :is(${q("from-cta")}, ${q("via-cta/50")})`, `background-image:none;background-color:${T.navy}`);
  r(5, "barre mobile : onglets au repos gris 400 → #4B5563", `${BARRE} ${q("text-slate-400")}`, `color:${T.texte2}`);
  // ---------- 8 : focus ----------
  r(8, "focus : anneau de 2 px navy sur fond clair", `:focus-visible`, `outline:2px solid ${T.navy};outline-offset:2px;--tw-ring-color:${T.navy}`);
  r(8, "focus sur fond navy ou sur une surface sombre : anneau blanc de 2 px doublé d'un liseré navy de 2 px (visible sur fond navy comme sur fond clair, car le fond réel autour de l'élément n'est pas connu de la feuille)", join(inSombre(":focus-visible"), `${SOMBRE}:focus-visible`), `outline:2px solid ${T.blanc};outline-offset:2px;box-shadow:0 0 0 6px ${T.navy};--tw-ring-color:${T.blanc}`);
  // Bandeau véhicule R2 (bg-slate-900 en mobile, md:bg-white/95 à partir de 768 px) : contexte clair au-dessus de 768 px.
  r(5, "≥ 768 px, surface md:bg-white : texte secondaire #4B5563", `${CLAIR_MD} :is(${L("text-slate-300", "text-slate-400", "text-gray-400", "text-gray-500").split(",\n").join(", ")}):not(#dz-clair)`, `color:${T.texte2}`, "(min-width: 768px)");
  r(4, "≥ 768 px, surface md:bg-white : lien #0F4C81", `${CLAIR_MD} :is(${L("text-blue-400", "md:text-blue-600").split(",\n").join(", ")}):not(#dz-clair)`, `color:${T.lien}`, "(min-width: 768px)");
  r(8, "≥ 768 px, surface md:bg-white : focus navy de 2 px", `${CLAIR_MD} :focus-visible:not(#dz-clair)`, `outline:2px solid ${T.navy};outline-offset:2px;box-shadow:none;--tw-ring-color:${T.navy}`, "(min-width: 768px)");
  if (o.principales) {
    // ---------- complément n° 4 : logo, fil d'Ariane, action principale (A2) ----------
    r(3, `logo « MECANIK » : orange ${o.logo} sur navy, comme sur main (complément n° 4)`, LOGO, `color:${o.logo}`);
    r(5, `fil d'Ariane sur navy (R1) : liens, séparateurs et page courante → neutral.300 ${T.texte2Sombre} (complément n° 4)`, `${ARIANE} :is(a, span, svg):not(#dz-ariane)`, `color:${T.texte2Sombre}`);
    r(5, "fil d'Ariane sur navy : page courante et survol de lien → blanc (complément n° 4)", join(`${ARIANE} span${q("text-white/60")}:not(#dz-ariane)`, `${ARIANE} a:hover:not(#dz-ariane)`), `color:${T.blanc}`);
    r(2, `action principale de chaque page — ${o.nom} : ${o.note}`, PRINCIPALE, `background-image:none;background-color:${o.fond};color:${o.texte};border-color:${o.fond};--tw-shadow-color:rgba(15,30,56,.15)`);
    r(2, `action principale — ${o.nom} : texte et icônes intérieurs à la couleur du texte du bouton`, `${PRINCIPALE} *`, `color:${o.texte}`);
    r(2, `action principale — ${o.nom} : survol, un ton plus foncé (${o.survol})`, `${PRINCIPALE}:hover`, `background-color:${o.survol}`);
    r(2, `action principale — ${o.nom} : désactivé, fond orange clair ${o.desactive.fond} (cta.200), texte ${o.desactive.texte}, opacité 1 (au lieu de l'opacité 0,4)`, join(`${PRINCIPALE}:disabled`, `${PRINCIPALE}:disabled:hover`), `background-image:none;background-color:${o.desactive.fond};color:${o.desactive.texte};border-color:${o.desactive.fond};opacity:1;box-shadow:none;cursor:not-allowed`);
    r(8, "action principale : anneau de focus navy de 2 px, hors du bouton (fond clair)", `${PRINCIPALE}:focus-visible`, `outline:2px solid ${T.navy};outline-offset:2px`);
    if (o.a3) a3(r);
    return R;
  }
  // ---------- 2 : action d'achat seule ----------
  r(2, `action d'achat (ajouter au panier, bouton collant « Panier », bouton principal d'un formulaire POST) — ${o.nom} : ${o.note}`, ACHAT, `background-image:none;background-color:${o.fond};color:${o.texte};border-color:${o.fond};--tw-shadow-color:rgba(15,30,56,.15)`);
  r(2, `action d'achat — ${o.nom} : texte et icônes intérieurs à la couleur du texte du bouton`, `${ACHAT} *`, `color:${o.texte}`);
  r(2, `action d'achat — ${o.nom} : survol, un ton plus foncé (${o.survol})`, `${ACHAT}:hover`, `background-color:${o.survol}`);
  r(8, "action d'achat : anneau de focus navy de 2 px, hors du bouton (fond clair)", `${ACHAT}:focus-visible`, `outline:2px solid ${T.navy};outline-offset:2px`);
  return R;
}
// ---------- complément n° 5 : règles A3, placées après celles d'A2 ; deux :not(#…) pour l'emporter sur PRINCIPALE (un seul :not(#…)) ----------
const X = ":not(#dz-a3):not(#dz-a3b)";
const CARTE = `button[aria-label^="Ajouter"][aria-label$="au panier"]:not([role="toolbar"] *)${X}`;   // « Ajouter » des cartes, hors barre collante
const INSCRIPTION = `nav a[href="/register"]${q("bg-cta")}${X}`;
function a3(r) {
  r(2, "« Ajouter » des cartes de la liste R2 : action secondaire, contour navy 2 px, fond transparent, texte et icône navy (complément n° 5, point 1)", CARTE, `background-image:none;background-color:transparent;color:${T.navy};border:2px solid ${T.navy};box-shadow:none;--tw-shadow-color:transparent`);
  r(2, "« Ajouter » des cartes : texte et icône intérieurs navy", `${CARTE} *`, `color:${T.navy}`);
  r(2, "« Ajouter » des cartes : survol, fond navy à 8 % sur blanc (#EDEEF1), texte navy", `${CARTE}:hover`, `background-color:rgba(15,30,56,.08);color:${T.navy}`);
  r(8, "« Ajouter » des cartes : focus, anneau navy de 2 px hors du bouton", `${CARTE}:focus-visible`, `outline:2px solid ${T.navy};outline-offset:2px`);
  r(2, `« Ajouter » des cartes : désactivé, fond ${T.neutre50}, contour pointillé et texte ${T.texte2}, opacité 1`, join(`${CARTE}:disabled`, `${CARTE}:disabled:hover`), `background-color:${T.neutre50};color:${T.texte2};border:2px dashed ${T.texte2};opacity:1;cursor:not-allowed`);
  r(2, `« Ajouter » des cartes : désactivé, texte et icône intérieurs ${T.texte2}`, `${CARTE}:disabled *`, `color:${T.texte2}`);
  r(2, "« Inscription » de l'en-tête (≥ 1024 px) : action secondaire sur navy, contour blanc 2 px, fond transparent, texte blanc ; pas d'orange (complément n° 5, point 6)", join(INSCRIPTION, `${INSCRIPTION} *`), `background-image:none;background-color:transparent;color:${T.blanc};border:2px solid ${T.blanc}`);
  r(2, "« Inscription » : survol, fond blanc à 12 % sur navy, texte blanc", `${INSCRIPTION}:hover`, `background-color:rgba(255,255,255,.12);color:${T.blanc}`);
  // Marges de défilement limitées au mobile : en 1440, aucune barre fixe ne masquait le focus sous A2, et une marge basse
  // de 152 px faisait défiler la colonne collante R2 (PiecesVehicleContent.tsx:327) jusqu'au bas de son conteneur (1re passe A3).
  r(8, "< 768 px : marges de défilement ; un élément atteint au clavier ou par ancre ne passe plus sous l'en-tête collant (Navbar.tsx:156, --navbar-height posée par Navbar.tsx:117, 123 px mesurés en 390) ni sous la barre mobile (BottomNav.tsx:68), la barre d'actions R2 (MobileBottomBar.tsx:66), la bulle d'aide (ChatWidget.tsx:210, bottom-24, 56 px) et le retour en haut (root.tsx:363, bottom-40, 48 px) : bas 160 + 48 + 8 = 216 px (complément n° 5, points 3 et 5)", "html", "scroll-padding-top:calc(var(--navbar-height, 64px) + 8px);scroll-padding-bottom:216px", "(max-width: 767.98px)");
  r(8, "< 768 px, page à barre d'outils R2 collante (PiecesToolbar.tsx:75, sticky top-24, 126 px de haut mesurés en 390, bas à 222 px) : marge haute 222 + 8 = 230 px (complément n° 5, point 5)", `html:has(div[translate="no"]${q("sticky")}${q("top-24")})`, "scroll-padding-top:230px", "(max-width: 767.98px)");
  r(8, "< 768 px, page courte sans barre mobile (connexion) : la bulle d'aide (ChatWidget.tsx:210, bottom-24 + 56 px = 152 px du bas) couvre les derniers liens, que le défilement ne peut plus dégager en bas de page ; espace réservé de 152 + 8 = 160 px après le contenu (complément n° 5, point 5). Étendue à toutes les pages à bulle, elle corrigeait le lien téléphone du panier mais ajoutait sur gamme 390 un arrêt masqué par la barre mobile et 3 nœuds axe (mesure du 20 nov. 12:00Z, écartée)", 'html:has(button[aria-label="Ouvrir le chat"]):not(:has([data-bottom-nav])) body::after', 'content:"";display:block;height:160px', "(max-width: 767.98px)");
  r(6, "case de sélection des cartes R2 (PiecesGridView.tsx:263, border-slate-200 #E2E8F0 = 1,23:1 sur blanc) → bord neutral.400 #6B7280 (complément n° 5, point 5)", join(`button[aria-label^="Sélectionner "]${q("w-6")}${q("h-6")}${X}`, `button[aria-label^="Sélectionner "]${q("w-6")}${q("h-6")}:hover${X}`), `border-color:${T.bord}`);
  r(5, "badge « 5 min » posé sur photo (BlogCarousel.tsx:47 et 134, fond neutral-900 à 20 % sur image) → fond navy opaque, texte blanc (complément n° 5, point 5)", join(`${q("bg-neutral-900/20")}${q("backdrop-blur")}${X}`, `${q("bg-neutral-900/20")}${q("backdrop-blur")} *`), `background-color:${T.navy};color:${T.blanc};-webkit-backdrop-filter:none;backdrop-filter:none`);
  r(5, "pastille de résultats sur l'en-tête sombre du filtre (PiecesFilterSidebar.tsx:115, fond blanc à 15 %, « résultats » blanc à 60 %) → fond navy opaque, textes blancs (complément n° 5, point 5)", join(`${q("bg-white/15")}${q("backdrop-blur-xs")}${q("rounded-full")}${X}`, `${q("bg-white/15")}${q("backdrop-blur-xs")}${q("rounded-full")} span`), `background-color:${T.navy};color:${T.blanc};border-color:${T.texte2Sombre};-webkit-backdrop-filter:none;backdrop-filter:none`);
  r(5, "en-tête OEM (PiecesOemSection.tsx:53, dégradé slate-800 → slate-700) → navy plein, sous-titre (ligne 70) blanc : fond réel déterminable, texte à 16,6:1 (complément n° 5, point 5)", `${q("from-slate-800")}${q("to-slate-700")}${X}`, `background-image:none;background-color:${T.navy}`);
  r(5, "en-tête OEM : sous-titre text-slate-300 → blanc", `${q("from-slate-800")}${q("to-slate-700")} p${q("text-slate-300")}${X}`, `color:${T.blanc}`);
}
const NON_COUVERT = [
  "images matricielles (photos de pièces, logos de marques, bannières) : leurs couleurs ne sont pas modifiables par une feuille",
  "SVG en <img> ou en fond (url()) : couleurs figées dans le fichier ; seuls les SVG en ligne en currentColor suivent la couleur du texte",
  "attributs fill/stroke codés en dur dans des SVG en ligne (par exemple étoiles ou pictogrammes colorés)",
  "styles en ligne autres que le bandeau R2 à dégradé (style=\"background-image:…\") : non ciblés un par un",
  "dégradés d'image (radial-gradient décoratifs en style en ligne, voiles opacity-[0.06])",
  "couleurs posées par JavaScript au rendu (graphiques, canvas) et contenus de tiers",
  "éléments non rendus pendant la capture (menus fermés, fenêtres modales, toasts, états d'erreur des formulaires)",
  "le rôle (état, décoratif, lien, surface) a été déduit de la classe et du texte visibles ; voir README, « Rôles déduits »",
];
for (const [k, o] of Object.entries(OPTIONS)) {
  const R = regles(o);
  const head = `/* Complément ${o.complement || "n° 2"} au mandat DZ — ${o.nom} (jeu réduit, 20 nov. 2026).
 * MAQUETTE PAR FEUILLE INJECTÉE, PAS UNE IMPLÉMENTATION. Rien n'est en vigueur ; décisions 45, 55 et 57 inchangées.
 * Injectée par Playwright (page.addStyleTag) après le chargement de la page ; aucun fichier du frontend,
 * des jetons ni de Tailwind n'est modifié. Toutes les déclarations portent !important pour écraser les utilitaires.
 * Sélecteurs : classes réellement rendues (inventaire options/mesures/inventaire-*.json et roles-*.json).
 * Chaque règle indique le point 1 à 9 du jeu réduit qu'elle applique.
 * Jetons (packages/design-tokens/src/tokens.json) : navy ${T.navy}, secondary/info ${T.lien}, neutral.800 ${T.texte},
 * neutral.500 ${T.texte2}, neutral.300 ${T.texte2Sombre}, neutral.400 ${T.bord}, neutral.100 ${T.neutre100}, neutral.50 ${T.neutre50},
 * success ${T.succes}, danger ${T.erreur}, cta.500 #F97316, cta.600 #EA580C, cta.700 #C2410C, cta.800 #9A3412.
 * VALEUR NOUVELLE, absente des jetons : avertissement ${T.avert}.
 * Point 2 (${o.nom}) : ${o.note}.
 *
 * Ce que la feuille ne couvre pas (liste aussi dans options/README.md) :
${NON_COUVERT.map((x) => " *  - " + x).join("\n")}
 */
`;
  const bloc = (x) => `${x.sel} {\n  ${x.decl.split(";").filter(Boolean).map((d) => d + " !important").join(";\n  ")};\n}`;
  const body = R.map((x) => `/* point ${x.point} — ${x.quoi} */\n${x.media ? `@media ${x.media} {\n${bloc(x)}\n}` : bloc(x)}`).join("\n\n");
  fs.writeFileSync(path.join(out, `option-${k}.css`), head + "\n" + body + "\n");
  console.log(`option-${k}.css`, R.length, "règles", fs.statSync(path.join(out, `option-${k}.css`)).size, "octets");
}
