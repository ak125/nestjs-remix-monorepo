#!/usr/bin/env node
/**
 * scripts/ops/dev-compile-watch.js — `dev:compile` du stack DEV, en UN seul processus.
 *
 * Compile en continu (`tsc --build --watch`) ET réécrit les alias `@auth/*`, `@modules/*`…
 * en chemins relatifs avec la fonction de tsc-alias — celle qu'utilise déjà le build PROD
 * (`tsc --build && tsc-alias -p tsconfig.json`) — juste après chaque émission, dans le même
 * processus, avant que le watcher TypeScript traite le changement suivant.
 *
 * Pourquoi un seul processus (incident du 2026-09-11) : la paire
 * `tsc --build --watch` + `tsc-alias -p tsconfig.json --watch` faisait surveiller les ~2 800
 * fichiers émis par un second processus. Le backend compile en non-incrémental : changer un
 * commentaire réémet les 4 152 fichiers de dist/, soit ~18 400 événements inotify d'un coup.
 * tsc-alias traite chaque événement sans borne de concurrence ; sa mémoire explose (mesuré :
 * 792 Mo à la première réémission, au-delà de 2 Go à la deuxième), V8 finit par l'abattre
 * (SIGABRT) et `run-p` arrête alors toute la chaîne dev — DEV:3000 à terre jusqu'à une relance
 * manuelle. Sept abandons de ce type entre le 2026-09-09 et le 2026-09-11 (journal apport).
 * Un seul écrivain supprime aussi la course qui tronquait des fichiers de dist/
 * (deux processus réécrivant le même fichier en place).
 *
 * Usage : node ../scripts/ops/dev-compile-watch.js [-p tsconfig.json]   (cwd = backend/)
 */
const path = require('path');
const ts = require('typescript');
const { prepareSingleFileReplaceTscAliasPaths } = require('tsc-alias');

const projectArgIndex = process.argv.findIndex((arg) => arg === '-p' || arg === '--project');
const projectArg = projectArgIndex === -1 ? 'tsconfig.json' : process.argv[projectArgIndex + 1];
const tsconfig = path.resolve(process.cwd(), projectArg);

// Extensions que tsc-alias réécrit (son inputGlob par défaut) ; les .map n'ont pas d'import.
const REWRITTEN = /\.(?:[mc]?js|jsx|d\.[mc]?ts|d\.tsx)$/;

async function main() {
  // watch: true désactive le cache d'existence de tsc-alias : un module ajouté pendant la
  // session doit être résolu au cycle suivant, pas servi depuis un cache négatif.
  const replaceAliases = await prepareSingleFileReplaceTscAliasPaths({
    configFile: tsconfig,
    watch: true,
  });

  const host = ts.createSolutionBuilderWithWatchHost(ts.sys);
  const writeFile = host.writeFile;
  const emitted = new Map();

  host.writeFile = (file, data, writeByteOrderMark) => {
    writeFile(file, data, writeByteOrderMark);
    if (REWRITTEN.test(file)) emitted.set(file, { data, writeByteOrderMark });
  };

  // Après l'émission complète du cycle : tous les fichiers sont sur disque, donc un alias
  // pointant vers un module émis plus tard dans le même cycle (imports croisés) se résout.
  host.afterProgramEmitAndDiagnostics = () => {
    for (const [file, { data, writeByteOrderMark }] of emitted) {
      const aliased = replaceAliases({ fileContents: data, filePath: file });
      if (aliased !== data) writeFile(file, aliased, writeByteOrderMark);
    }
    emitted.clear();
  };

  ts.createSolutionBuilderWithWatch(host, [tsconfig], { preserveWatchOutput: true }).build();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
