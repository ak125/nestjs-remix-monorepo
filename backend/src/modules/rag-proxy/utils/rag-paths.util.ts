import { BadRequestException } from '@nestjs/common';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Chemins du module RAG : confinement à un répertoire et format des noms
 * reçus d'une requête. Tout chemin construit à partir d'une valeur reçue passe
 * par `resolveConfinedPath` avant une lecture ou une écriture.
 */

/**
 * Résout `candidate` par rapport à `root` et renvoie son chemin réel, liens
 * symboliques résolus, seulement s'il existe, s'il se trouve dans `root` et
 * s'il est du type attendu : fichier ordinaire (`'file'`) ou répertoire
 * (`'directory'`, `root` lui-même compris). Renvoie `null` dans tous les
 * autres cas, sans distinguer la cause.
 *
 * L'appelant lit ou écrit le chemin renvoyé, pas la valeur reçue.
 */
export function resolveConfinedPath(
  root: string,
  candidate: string,
  kind: 'file' | 'directory' = 'file',
): string | null {
  if (typeof root !== 'string' || typeof candidate !== 'string') return null;

  try {
    const realRoot = realpathSync(path.resolve(root));
    const real = realpathSync(path.resolve(root, candidate));

    // `root` lui-même n'est admis que là où un répertoire est attendu.
    if (real === realRoot) {
      return kind === 'directory' && statSync(realRoot).isDirectory()
        ? realRoot
        : null;
    }

    if (!real.startsWith(realRoot + path.sep)) return null;

    const stats = statSync(real);
    const expected =
      kind === 'directory' ? stats.isDirectory() : stats.isFile();
    return expected ? real : null;
  } catch {
    return null;
  }
}

/**
 * Alias de gamme, tel qu'il nomme le fichier `gammes/<alias>.md` : lettres
 * minuscules et chiffres, en segments séparés par un tiret.
 */
const GAMME_ALIAS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GAMME_ALIAS_MAX_LENGTH = 100;

/** Refuse (400) une valeur qui n'a pas le format d'un alias de gamme. */
export function assertGammeAlias(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length > GAMME_ALIAS_MAX_LENGTH ||
    !GAMME_ALIAS.test(value)
  ) {
    throw new BadRequestException('Invalid pgAlias format');
  }
}
