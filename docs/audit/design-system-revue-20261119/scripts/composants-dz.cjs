// Mandat DZ — 6.7 : tableau des composants partagés. Lecture seule des fichiers bruts mesures/<page>-<390|1440>.json.
// Zones (en-tête, pied de page, barre mobile, sélecteur) : champ « zone » attribué au relevé.
// Primitives ui/* : reconnues par un jeu de classes de base de chaque composant (frontend/app/components/ui/*.tsx au commit de base)
// sur l'élément mesuré (texte, bord, cible) ; « carte » par la présence de bg-card dans le chemin du sélecteur.
// Limite : un composant dont aucun élément n'entre dans un relevé n'est pas compté ; le focus ne porte pas de classes.
// Usage (depuis docs/audit/design-system-revue-20261119) : node scripts/composants-dz.cjs > mesures/composants.md
const fs = require("node:fs");
// classes rendues réordonnées par cn()/tailwind-merge : reconnaissance par jeu de classes, pas par sous-chaîne
const has = (e, toks) => { const c = new Set(String(e.classes || "").split(/\s+/)); return toks.every((t) => c.has(t)); };
const SIG = [
  ["en-tête", "frontend/app/components/Navbar.tsx", (e) => e.zone === "en-tete"],
  ["pied de page", "frontend/app/components/home/Footer.tsx", (e) => e.zone === "pied-de-page"],
  ["barre mobile", "frontend/app/components/layout/BottomNav.tsx", (e) => e.zone === "barre-mobile"],
  ["sélecteur de véhicule", "frontend/app/components/vehicle/VehicleSelector.tsx", (e) => e.zone === "selecteur-vehicule"],
  ["bouton", "frontend/app/components/ui/button.tsx", (e) => has(e, ["inline-flex", "whitespace-nowrap", "rounded-md", "ring-offset-background"])],
  ["champ", "frontend/app/components/ui/input.tsx", (e) => has(e, ["ring-offset-background", "file:border-0", "file:bg-transparent"])],
  ["case à cocher", "frontend/app/components/ui/checkbox.tsx", (e) => e.type === "case" && has(e, ["border-input", "ring-offset-background", "focus-visible:ring-ring"])],
  ["carte", "frontend/app/components/ui/card.tsx", (e) => /\.bg-card\b/.test(e.sel || "") || has(e, ["bg-card", "text-card-foreground"])],
  ["onglets", "frontend/app/components/ui/tabs.tsx", (e) => has(e, ["bg-muted", "p-1", "text-muted-foreground"]) || has(e, ["rounded-sm", "whitespace-nowrap", "ring-offset-background", "transition-all"])],
  ["menu déroulant", "frontend/app/components/ui/dropdown-menu.tsx", (e) => has(e, ["bg-popover", "text-popover-foreground"]) || has(e, ["cursor-default", "select-none", "rounded-sm"])],
];
const files = fs.readdirSync("mesures").filter((f) => /^[a-z0-9-]+-(390|1440)\.json$/.test(f) && !/^(selecteur|feuilles|focus-marque)-/.test(f)).sort();
const res = SIG.map(([nom, fichier]) => ({ nom, fichier, presente: new Set(), texte: new Set(), bord: new Set(), cible: new Set(), focus: new Set() }));
for (const f of files) {
  const r = JSON.parse(fs.readFileSync("mesures/" + f, "utf8")); const page = r.id;
  const items = [
    ...(r.textes?.liste || []).map((e) => ({ ...e, k: "texte", d: e.defaut })),
    ...(r.bords || []).map((e) => ({ ...e, k: "bord", d: e.defaut })),
    ...(r.cibles?.sous24 || []).map((e) => ({ ...e, k: "cible", d: !e.exception })),
    ...(r.cibles?.entre24et44 || []).map((e) => ({ ...e, k: "cible", d: false })),
    ...(r.focus || []).map((e) => ({ ...e, k: "focus", d: !e.visible || (e.indicateur && e.indicateur.comparable && e.indicateur.ratioP90 < 3) || e.pointsCaches > 0 })),
  ];
  SIG.forEach(([, , m], i) => { for (const e of items) if (m(e)) { res[i].presente.add(page); if (e.d) res[i][e.k].add(page); } });
}
const n = (s) => s.size;
console.log("| composant | fichier (déduit du code) | pages où il est relevé | pages avec texte sous seuil | avec bord < 3:1 | avec cible < 24 sans exception | avec focus en défaut |");
console.log("|---|---|---|---|---|---|---|");
for (const c of res) console.log(`| ${c.nom} | \`${c.fichier}\` | ${n(c.presente)} | ${n(c.texte)} | ${n(c.bord)} | ${n(c.cible)} | ${c.nom.match(/bouton|champ|case|carte|onglets|menu/) ? "non attribuable (pas de classes sur les arrêts)" : n(c.focus)} |`);
console.log(`\nSur ${new Set(files.map((f) => f.replace(/-(390|1440)\.json$/, ""))).size} pages (${files.length} passages). Généré ${new Date().toISOString()}.`);
