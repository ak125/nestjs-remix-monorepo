// Complément n° 2 DZ — relance la mesure livrée (../../scripts/mesure-dz.cjs, NON MODIFIÉE) avec une feuille d'option injectée.
// Principe : lib-dz.cjs est chargée d'abord ; sa fonction settle() est enveloppée pour injecter la feuille (injection-dz.cjs)
// avant et après l'attente. mesure-dz.cjs appelle settle() juste après chaque chargement de page, avant le parcours au clavier,
// axe, le contraste et les bords : la même mesure s'applique donc à AVANT (rien d'injecté), A et B.
// Usage (depuis options/) : node scripts/mesure-option-dz.cjs <avant|a|b> <id> <chemin> <W> <H> <dossier-sortie>
const fs = require("node:fs"); const path = require("node:path");
const [, , variante, id, route, W, H, outDir] = process.argv;
const libPath = path.resolve(__dirname, "../../scripts/lib-dz.cjs");
const lib = require(libPath);
const { injecte } = require("./injection-dz.cjs");
const journal = [];
const settle0 = lib.settle;
lib.settle = async (page, ms) => { journal.push({ etape: "avant attente", ...(await injecte(page, variante)) }); await settle0(page, ms); journal.push({ etape: "après attente", ...(await injecte(page, variante)) }); };
fs.mkdirSync(path.join(outDir, "mesures"), { recursive: true });
process.on("exit", () => fs.writeFileSync(path.join(outDir, "mesures", `injection-${id}-${W}.json`), JSON.stringify({ variante, id, route, viewport: `${W}x${H}`, journal }, null, 1)));
process.argv = [process.argv[0], path.resolve(__dirname, "../../scripts/mesure-dz.cjs"), id, route, W, H, outDir];
require(path.resolve(__dirname, "../../scripts/mesure-dz.cjs"));
