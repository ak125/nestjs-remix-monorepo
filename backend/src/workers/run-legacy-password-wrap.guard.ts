/**
 * Garde de l'enveloppe des anciennes empreintes (mandat AP).
 *
 * Sans `PASSWORD_WRAP_CONFIRM=APPLY` exactement, le script ne fait que lire :
 * comptes par format et nombre de lignes qu'il envelopperait. Toute autre
 * valeur (absente, `true`, `apply`, `1`) reste en lecture seule.
 */
export const PASSWORD_WRAP_CONFIRM_ENV = 'PASSWORD_WRAP_CONFIRM';
export const PASSWORD_WRAP_CONFIRM_VALUE = 'APPLY';

export function isWrapApplyConfirmed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[PASSWORD_WRAP_CONFIRM_ENV] === PASSWORD_WRAP_CONFIRM_VALUE;
}

/** Borne optionnelle par table, pour un premier passage limité. */
export function parseMaxRows(
  env: Record<string, string | undefined> = process.env,
): number | undefined {
  const raw = env.PASSWORD_WRAP_MAX_ROWS;
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('PASSWORD_WRAP_MAX_ROWS must be a positive integer');
  }
  return n;
}
