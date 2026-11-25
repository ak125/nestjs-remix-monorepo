/**
 * Garde : le module `seo-logs` ne construit aucune commande shell.
 *
 * Échoue si un fichier du module importe de nouveau le lanceur de processus
 * de Node. Un seul fichier y est autorisé, pour un seul usage : exécuter
 * directement le script d'audit (chemin fixe, sans interpréteur de commandes).
 * Les routes passent par `fetch` et par l'API fichiers.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

const MODULE_ROOT = __dirname;

// Seul fichier autorisé à importer le lanceur, et seule fonction autorisée.
const ALLOWED_FILE = 'services/seo-audit-scheduler.service.ts';
const ALLOWED_IMPORT = 'execFile';

// Toute référence au module, quelle que soit la forme (import, require,
// import dynamique, préfixe `node:`).
const LAUNCHER_MODULE = /['"`](?:node:)?child_process['"`]/g;
const NAMED_IMPORT =
  /import\s*\{([^}]*)\}\s*from\s*['"](?:node:)?child_process['"]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [full]
      : [];
  });
}

const files = sourceFiles(MODULE_ROOT).map((full) => ({
  name: relative(MODULE_ROOT, full).split(sep).join('/'),
  source: readFileSync(full, 'utf-8'),
}));

describe('seo-logs — aucun lanceur de commandes dans le module', () => {
  it('le détecteur reconnaît chaque forme de référence au lanceur', () => {
    const samples = [
      "import { exec } from 'child_process';",
      'import * as cp from "child_process";',
      "import { spawn } from 'node:child_process';",
      "const cp = require('child_process');",
      "const cp = await import('node:child_process');",
    ];
    for (const sample of samples) {
      expect(sample.match(LAUNCHER_MODULE)).toHaveLength(1);
    }
  });

  it('parcourt bien les sources du module', () => {
    const names = files.map((file) => file.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'controllers/seo-kpi.controller.ts',
        'controllers/seo-audit.controller.ts',
        'controllers/crawl-budget-audit.controller.ts',
        'controllers/crawl-budget-experiment.controller.ts',
        ALLOWED_FILE,
        'seo-logs.module.ts',
      ]),
    );
  });

  it("aucun fichier n'importe le lanceur, hors le fichier autorisé", () => {
    const offenders = files
      .filter((file) => file.name !== ALLOWED_FILE)
      .filter((file) => (file.source.match(LAUNCHER_MODULE) ?? []).length > 0)
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });

  it('le fichier autorisé importe seulement le lancement direct, sans shell', () => {
    const allowed = files.find((file) => file.name === ALLOWED_FILE);
    expect(allowed).toBeDefined();
    const source = allowed!.source;

    const references = source.match(LAUNCHER_MODULE) ?? [];
    const namedImports = [...source.matchAll(NAMED_IMPORT)].map((match) =>
      match[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    );

    // Une seule référence, et c'est un import nommé de la seule fonction
    // autorisée : ni import global, ni require, ni alias.
    expect(references).toHaveLength(1);
    expect(namedImports).toEqual([[ALLOWED_IMPORT]]);
    // Aucune option qui rétablirait un interpréteur de commandes.
    expect(source).not.toMatch(/\bshell\s*:/);
  });
});
