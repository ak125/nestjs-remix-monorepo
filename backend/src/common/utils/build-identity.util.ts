/**
 * Identité déclarée du build servi : `GIT_SHA` (posé à la construction de l'image,
 * build.yml → Dockerfile) ou `SOURCE_COMMIT` (aucun émetteur dans ce dépôt).
 *
 * Contrôle de forme et de concordance seulement : une valeur valide reste une
 * déclaration, pas une attestation de liaison à la construction. Jamais le HEAD du
 * checkout. Une valeur refusée n'est jamais recopiée : `sha` vaut null et
 * `problem` porte le motif.
 */
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

export type BuildIdentityProblem =
  | 'build identity invalid'
  | 'build identity divergent'
  | 'build identity absent';

export interface BuildIdentity {
  sha: string | null;
  problem: BuildIdentityProblem | null;
}

/** SHA de commit complet, en minuscules : seule forme servie ou enregistrée. */
export function isCommitSha(value: string | undefined): value is string {
  return value !== undefined && COMMIT_SHA_RE.test(value);
}

export function resolveBuildIdentity(
  env: NodeJS.ProcessEnv = process.env,
): BuildIdentity {
  const declared = [env.GIT_SHA, env.SOURCE_COMMIT].filter(Boolean) as string[];
  if (declared.some((v) => !isCommitSha(v)))
    return { sha: null, problem: 'build identity invalid' };
  const distinct = new Set(declared);
  if (distinct.size > 1)
    return { sha: null, problem: 'build identity divergent' };
  if (distinct.size === 0)
    return { sha: null, problem: 'build identity absent' };
  return { sha: [...distinct][0], problem: null };
}
