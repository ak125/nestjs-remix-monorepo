import { z } from 'zod';

/**
 * Validateur **canonique unique** des path-params d'id numériques.
 * **SCALAR PARAM ONLY** — à utiliser via `@Param('name', PositiveIntParamPipe)`,
 * jamais `@Param(pipe)` (qui passerait l'objet `params` entier → la pipe
 * parserait un objet au lieu d'une string).
 *
 * Borne = `int4` (1..2_147_483_647), soit la **borne de stockage Postgres
 * `integer`**, qui est le type de toutes les colonnes PK d'id de ce codebase
 * (ex. `auto_modele.modele_id` max 667022, `auto_marque.marque_id`,
 * `auto_type.type_modele_id`). On valide contre le **type de la colonne**,
 * jamais contre l'étendue des données du moment.
 *
 * ⚠️ Pas de variante `smallint` (1..32767). Un plafond plus étroit que la
 * colonne rejette silencieusement des ids valides : un pipe smallint sur
 * `modele_id` (int4) renvoyait 400 sur ~82% des modèles (incident
 * 2026-05-22, PR #686). Garde mécanique :
 * `.ast-grep/rules/backend-no-subint4-ceiling-on-id-param.yml`.
 *
 * Pipeline 3-étages :
 *  1. `z.string().regex(/^[1-9]\d*$/)` — string décimale stricte canonique
 *     (interdit `'0'`, `'00'`, `'00042'`, `'-1'`, `'+30'`, `' 30'`,
 *     `'30abc'`, `'0x1E'`, `''`). Un id `42` n'a qu'une forme : `'42'`.
 *  2. `.transform(Number)` — coerce vers `number`. Sûr car le regex amont
 *     élimine déjà tous les vecteurs `Number()`-permissifs (espaces, hex,
 *     scientifique, signe).
 *  3. `.pipe(z.number().finite().int().min(1).max(int4))` — range numérique
 *     typé `number`, auto-suffisant.
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
