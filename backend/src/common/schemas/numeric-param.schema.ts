import { z } from 'zod';

/**
 * Param path numérique strict — **SCALAR PARAM ONLY**.
 *
 * À utiliser uniquement avec `@Param('name', PositiveSmallIntParamPipe)`,
 * jamais avec `@Param(pipe)` qui passerait l'objet `params` entier
 * (la pipe parserait un objet au lieu d'une string).
 *
 * Pipeline 3-étages :
 *  1. `z.string().regex(/^[1-9]\d*$/)` — garde la string décimale stricte
 *     (interdit `'0'`, `'00'`, `'00042'`, `'-1'`, `'+30'`, `' 30'`,
 *     `'30abc'`, `'0x1E'`, `''`). Canon SEO/cache : un id `42` n'a qu'une
 *     seule forme canonique `'42'`.
 *  2. `.transform(Number)` — coerce vers `number`. Sûr car le regex amont
 *     élimine déjà tous les vecteurs `Number()`-permissifs (espaces,
 *     hex, scientifique, signe). Plus simple/rapide que `parseInt(s, 10)`.
 *  3. `.pipe(z.number().finite().int().min(1).max(...))` — valide le range
 *     numérique avec un schéma Zod typé `number`, auto-suffisant.
 */
export const PositiveSmallIntParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, {
    message: 'Must be a positive integer without leading zero',
  })
  .transform(Number)
  .pipe(
    z
      .number()
      .finite()
      .int()
      .min(1, { message: 'Out of smallint range (min 1)' })
      .max(32767, { message: 'Out of smallint range (max 32767)' }),
  );

/**
 * Variante int4 pour les ids hors range smallint
 * (type vehicle 60000-83456, ids legacy étendus).
 * SCALAR PARAM ONLY — même contrat que ci-dessus.
 */
export const PositiveIntParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, {
    message: 'Must be a positive integer without leading zero',
  })
  .transform(Number)
  .pipe(
    z
      .number()
      .finite()
      .int()
      .min(1, { message: 'Out of int4 range (min 1)' })
      .max(2147483647, { message: 'Out of int4 range (max 2147483647)' }),
  );
