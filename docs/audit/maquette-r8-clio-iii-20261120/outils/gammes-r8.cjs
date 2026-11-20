// Complément n° 13 au mandat DS : gammes du catalogue R8 annoncées par la page (« +N pièces ») contre gammes qui ont
// un <a href> dans le HTML serveur. Le catalogue affiche 5 gammes par famille et rend les autres
// seulement après le clic « +N pièces » (displayedGammes, constructeurs.$brand.$model.$type.tsx).
// Gammes sans lien = somme des N des boutons « +N pièces » rendus par le serveur (pas de lecture du flux du loader).
// GET simple. Usage : URL_PATH=/constructeurs/… node gammes-r8.cjs <base> <label> <dossier>
const fs = require("node:fs");
const path = require("node:path");
const URL_PATH = process.env.URL_PATH;
const [, , base, label, outDir] = process.argv;
const SLUG = URL_PATH.replace(/^\/constructeurs\//, "").replace(/\.html$/, "").replace(/\//g, "_");
const SUFFIX = URL_PATH.replace(/^\/constructeurs/, "");
(async () => {
  const html = await (await fetch(base + URL_PATH, { headers: { "user-agent": "gammes-r8 (audit local)" } })).text();
  // flux turbo-stream : clés et valeurs sous forme de chaînes ; on relève les alias suivis d'un identifiant de gamme
  const rendus = [...new Set([...html.matchAll(/href="(\/pieces\/([a-z0-9-]+)-(\d+)[^"]*?)"/g)].filter((m) => m[1].endsWith(SUFFIX)).map((m) => m[2] + "-" + m[3]))];
  // familles et nombre de gammes : texte du bouton « +N pièces » rendu par le serveur
  const boutons = [...html.matchAll(/\+<!-- -->(\d+)<!-- --> pièces|\+(\d+) pièces/g)].map((m) => Number(m[1] || m[2]));
  const res = { url: base + URL_PATH, label, at: new Date().toISOString(), gammesAvecLien: rendus.length, familiesAvecBouton: boutons.length, gammesSansLienDansLeHtml: boutons.reduce((a, b) => a + b, 0), boutons };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-gammes.json`), JSON.stringify(res, null, 2));
  console.log(`== ${label} ${URL_PATH} | gammes avec <a href> ${res.gammesAvecLien} | familles repliées ${res.familiesAvecBouton} | gammes sans lien dans le HTML ${res.gammesSansLienDansLeHtml} (${boutons.join("+")})`);
})().catch((e) => { console.error(e); process.exit(1); });
