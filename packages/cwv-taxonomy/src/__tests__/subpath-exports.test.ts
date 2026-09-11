/**
 * Sous-chemins d'export client — classifyRoute() et priorityTierFromSurface()
 * sans charger schema.ts ni zod.
 *
 * La racine "." réexporte schema.ts, donc zod. Ce package est CommonJS : importé
 * par la racine, il embarque zod en entier dans le bundle navigateur, dans le
 * chunk évalué au démarrage de chaque page. Le code client
 * (frontend/app/utils/web-vitals.client.ts, runtime-errors.client.ts) importe
 * donc par sous-chemin les seuls modules dont il a besoin.
 *
 * Contrat :
 *   1. chaque sous-chemin client pointe types, import et require vers le dist
 *      CommonJS du module src de même nom (le backend consomme ce package en CJS) ;
 *   2. charger ce module ne charge aucun module zod ;
 *   3. témoin : la racine "." est inchangée et charge bien zod, sinon la sonde 2
 *      serait vacante.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';

const PACKAGE_DIR = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
const { compilerOptions } = JSON.parse(readFileSync(join(PACKAGE_DIR, 'tsconfig.json'), 'utf8'));

/** Modules importés par le code navigateur (types compris). */
const CLIENT_SUBPATHS = ['./surface', './priority-tier', './route-group', './metric'] as const;

interface ExportTargets {
  types: string;
  import: string;
  require: string;
}

/** Fichier src compilé vers `distTarget`, d'après outDir/rootDir du tsconfig. */
function sourceOf(distTarget: string): string {
  const inOutDir = relative(compilerOptions.outDir, distTarget);
  assert.ok(!inOutDir.startsWith('..'), `${distTarget} n'est pas sous ${compilerOptions.outDir}`);
  return join(PACKAGE_DIR, compilerOptions.rootDir, inOutDir.replace(/\.js$/, '.ts'));
}

/** Modules zod présents dans require.cache après chargement de `sourceFile`, en processus isolé. */
function zodModulesLoadedBy(sourceFile: string): string[] {
  const zodSegment = `${sep}node_modules${sep}zod${sep}`;
  const probe =
    `require(${JSON.stringify(sourceFile)});` +
    `process.stdout.write(JSON.stringify(Object.keys(require.cache)` +
    `.filter((p) => p.includes(${JSON.stringify(zodSegment)}))));`;
  const run = spawnSync(process.execPath, ['--require', 'tsx/cjs', '-e', probe], {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout) as string[];
}

function exportTargets(subpath: string): ExportTargets {
  const targets = manifest.exports?.[subpath] as ExportTargets | undefined;
  assert.ok(targets, `package.json#exports ne déclare pas "${subpath}"`);
  return targets;
}

for (const subpath of CLIENT_SUBPATHS) {
  const name = subpath.slice('./'.length);

  test(`exports "${subpath}" : types, import et require vers le dist CommonJS`, () => {
    const targets = exportTargets(subpath);
    assert.deepEqual(targets, {
      types: `./dist/${name}.d.ts`,
      import: `./dist/${name}.js`,
      require: `./dist/${name}.js`,
    });
    assert.ok(existsSync(sourceOf(targets.require)), `source absente pour ${targets.require}`);
  });

  test(`exports "${subpath}" : ne charge aucun module zod`, () => {
    assert.deepEqual(zodModulesLoadedBy(sourceOf(exportTargets(subpath).require)), []);
  });
}

test('exports "." : inchangé, et charge zod (témoin de la sonde)', () => {
  const targets = exportTargets('.');
  assert.deepEqual(targets, {
    types: './dist/index.d.ts',
    import: './dist/index.js',
    require: './dist/index.js',
  });
  assert.ok(zodModulesLoadedBy(sourceOf(targets.require)).length > 0);
});
