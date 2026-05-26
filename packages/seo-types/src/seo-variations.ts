/**
 * 🎯 SEO H1 suffix rotation — shared helper for R2 H1 visible component.
 *
 * Restaure le comportement legacy PHP (`#CompSwitch_2#` per-gamme technique
 * suffix + `#PrixPasCher#` fallback price variation) après que PR #763
 * a réparé la disambiguation `type_name` mais laissé le suffix figé sur
 * `"au meilleur prix"` partout.
 *
 * Architecture validée owner :
 * - Backend (`@fafa/backend rm-builder.service.ts`) expose uniquement
 *   `seo.compSwitch2: string[]` chargé via `loadSeoCtxSwitches(pgId)`
 *   depuis `__seo_gamme_car_switch.sgcs_alias=2` (per-pg_id technique
 *   variations, 1000 rows / 396 distinctes).
 * - Frontend (`PiecesHeader.tsx`) consomme `compSwitch2` + importe
 *   `SEO_PRICE_VARIATIONS` constant côté package (pas via API).
 * - Rotation déterministe par `(typeId + pgId + offset) % pool.length`.
 *
 * Fallback chain : compSwitch2 > priceVariations > literal.
 */

export interface ContextKeys {
  typeId: number;
  pgId: number;
}

/**
 * Strip trailing punctuation + collapse whitespace. Defensive vs DB content
 * quirks (legacy `sgcs_content` parfois avec ponctuation finale ou double
 * espaces). Backend `loadCompSwitches` décode déjà HTML entities.
 *
 * Bounded quantifiers `{1,N}` pour éviter ReDoS (js/polynomial-redos) — les
 * inputs réels (DB `sgcs_content`) sont bornés à ~100 chars practically,
 * 50 espaces/dots max couvre tous les cas avec marge.
 */
function normalizeSuffix(s: string): string {
  return s
    .replace(/\s{1,50}/g, " ")
    .replace(/[.。]{1,10}$/g, "")
    .trim();
}

/**
 * Déterministe rotation : `(typeId + pgId + offset) % pool.length`.
 * Retourne `undefined` si pool vide.
 */
export function selectFromPool<T>(
  pool: readonly T[],
  ctx: ContextKeys,
  offset = 0,
): T | undefined {
  if (!pool.length) return undefined;
  const len = pool.length;
  const idx = (((ctx.typeId + ctx.pgId + offset) % len) + len) % len;
  return pool[idx];
}

/**
 * Build R2 H1 suffix : compSwitch2 primary > priceVariations fallback > literal.
 * Tous suffixes passent par `normalizeSuffix` avant retour.
 */
export function pickH1Suffix(opts: {
  compSwitch2?: readonly string[];
  priceVariations: readonly string[];
  ctx: ContextKeys;
  literalFallback?: string;
}): string {
  const c2 = selectFromPool(opts.compSwitch2 ?? [], opts.ctx, 2);
  if (c2 && c2.trim()) return normalizeSuffix(c2);
  const pv = selectFromPool(opts.priceVariations, opts.ctx);
  if (pv && pv.trim()) return normalizeSuffix(pv);
  return opts.literalFallback ?? "au meilleur prix";
}

/**
 * Rotation prix générique (7 variantes), fallback si pg_id n'a pas de
 * `compSwitch2` chargé via `__seo_gamme_car_switch.sgcs_alias=2`.
 * Constante volontairement côté package partagé — pas exposée via API.
 */
export const SEO_PRICE_VARIATIONS = [
  "à prix imbattables",
  "pas cher",
  "à petit prix",
  "économique",
  "à prix réduit",
  "à tarif avantageux",
  "au meilleur prix",
] as const;
