/**
 * Règles de remise fournisseur × marque × famille / sous-famille
 * (complément CH-2, décision de Marwane du 18/11 17:01).
 *
 * Une règle = une ligne de `supplier_price_profiles` qui porte une remise
 * et/ou une marge (`default_remise_pct`, `default_marge_pct`) pour une portée :
 *
 *   scope_level | scope_code                    | brand_pm_id
 *   SUPPLIER    | NULL                          | NULL
 *   BRAND       | NULL                          | obligatoire
 *   FAMILY      | code famille (pri_code_fam_nu) | facultatif
 *   SUBFAMILY   | code sous-famille (…sfam_nu)  | facultatif
 *
 * Fonctions pures, sans I/O. NON BRANCHÉES au calcul des prix : PricingModule
 * et `resolveProfile` n'appellent pas ce fichier (mandat séparé, après la
 * fusion). La fiche s'en sert pour dire quelle règle est en vigueur.
 */

export type PriceRuleLevel = 'SUPPLIER' | 'BRAND' | 'FAMILY' | 'SUBFAMILY';

export interface PriceRule {
  id: number;
  supplierId: string;
  /** pieces_marque.pm_id en texte, ou null. */
  brandPmId: string | null;
  scopeLevel: PriceRuleLevel;
  scopeCode: string | null;
  /** Début inclus (ISO), ou null. */
  effectiveFrom: string | null;
  /** Fin exclue (ISO), ou null. */
  effectiveTo: string | null;
  active: boolean;
  version: number;
  remisePct: number | null;
  margePct: number | null;
}

interface PriceRuleContext {
  supplierId: string;
  brandPmId?: string | null;
  famCode?: string | null;
  sfamCode?: string | null;
  at: Date;
}

/**
 * Rang de précision, du plus précis (6) au moins précis (1) :
 * marque × sous-famille, marque × famille, marque, sous-famille, famille,
 * fournisseur.
 */
function rankOf(rule: PriceRule): number {
  const branded = rule.brandPmId !== null;
  switch (rule.scopeLevel) {
    case 'SUBFAMILY':
      return branded ? 6 : 3;
    case 'FAMILY':
      return branded ? 5 : 2;
    case 'BRAND':
      return 4;
    default:
      return 1;
  }
}

/** Une promotion = une règle datée (début et/ou fin). */
export function isDatedRule(rule: PriceRule): boolean {
  return rule.effectiveFrom !== null || rule.effectiveTo !== null;
}

function time(iso: string | null): number | null {
  if (iso === null) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function inPeriod(rule: PriceRule, at: number): boolean {
  const from = time(rule.effectiveFrom);
  const to = time(rule.effectiveTo);
  return (from === null || at >= from) && (to === null || at < to);
}

/** Ligne sans remise ni marge : profil d'import seul, pas une règle. */
function carriesValue(rule: PriceRule): boolean {
  return rule.remisePct !== null || rule.margePct !== null;
}

function matches(rule: PriceRule, ctx: PriceRuleContext, at: number): boolean {
  if (!rule.active || rule.supplierId !== ctx.supplierId) return false;
  if (!carriesValue(rule) || !inPeriod(rule, at)) return false;
  if (rule.brandPmId !== null && rule.brandPmId !== (ctx.brandPmId ?? null))
    return false;
  if (rule.scopeLevel === 'SUBFAMILY')
    return rule.scopeCode === (ctx.sfamCode ?? null);
  if (rule.scopeLevel === 'FAMILY')
    return rule.scopeCode === (ctx.famCode ?? null);
  return true;
}

/** Ordre de préférence à rang égal : promo datée, puis la plus récente. */
function compare(a: PriceRule, b: PriceRule): number {
  return (
    rankOf(b) - rankOf(a) ||
    Number(isDatedRule(b)) - Number(isDatedRule(a)) ||
    (time(b.effectiveFrom) ?? -Infinity) -
      (time(a.effectiveFrom) ?? -Infinity) ||
    b.version - a.version ||
    b.id - a.id
  );
}

/**
 * Règle applicable à une pièce (fournisseur, marque, famille, sous-famille) à
 * la date `at`, ou null. La portée la plus précise gagne ; à portée égale, une
 * promo datée prime sur la règle permanente pendant sa période. La règle
 * gagnante s'applique entière (remise et marge ensemble).
 */
export function resolvePriceRule<T extends PriceRule>(
  rules: readonly T[],
  ctx: PriceRuleContext,
): T | null {
  const at = ctx.at.getTime();
  const candidates = rules.filter((r) => matches(r, ctx, at));
  if (candidates.length === 0) return null;
  return [...candidates].sort(compare)[0];
}

export type PriceRuleStatus =
  | 'en_vigueur'
  | 'remplacee'
  | 'a_venir'
  | 'expiree'
  | 'inactive'
  | 'sans_taux';

/**
 * État d'une règle à la date `at`, sur sa propre portée : en vigueur, ou
 * remplacée par une autre (une promo de même portée, par exemple).
 */
export function priceRuleStatus(
  rule: PriceRule,
  rules: readonly PriceRule[],
  at: Date,
): { status: PriceRuleStatus; supersededBy: number | null } {
  if (!rule.active) return { status: 'inactive', supersededBy: null };
  if (!carriesValue(rule)) return { status: 'sans_taux', supersededBy: null };
  const t = at.getTime();
  const from = time(rule.effectiveFrom);
  if (from !== null && t < from)
    return { status: 'a_venir', supersededBy: null };
  if (!inPeriod(rule, t)) return { status: 'expiree', supersededBy: null };
  const winner = resolvePriceRule(rules, {
    supplierId: rule.supplierId,
    brandPmId: rule.brandPmId,
    famCode: rule.scopeLevel === 'FAMILY' ? rule.scopeCode : null,
    sfamCode: rule.scopeLevel === 'SUBFAMILY' ? rule.scopeCode : null,
    at,
  });
  return winner === null || winner.id === rule.id
    ? { status: 'en_vigueur', supersededBy: null }
    : { status: 'remplacee', supersededBy: winner.id };
}

/** Même clé d'unicité (index supplier_price_profiles_active_rule_uniq). */
export function samePriceRuleKey(a: PriceRule, b: PriceRule): boolean {
  return (
    a.supplierId === b.supplierId &&
    a.brandPmId === b.brandPmId &&
    a.scopeLevel === b.scopeLevel &&
    a.scopeCode === b.scopeCode &&
    time(a.effectiveFrom) === time(b.effectiveFrom) &&
    time(a.effectiveTo) === time(b.effectiveTo)
  );
}

/**
 * Profil d'import de base : portée fournisseur, sans marque ni date. C'est la
 * ligne que l'import tarifaire (`resolveProfile`) retient aujourd'hui.
 */
export function isBaseImportProfile(rule: PriceRule): boolean {
  return (
    rule.active &&
    rule.scopeLevel === 'SUPPLIER' &&
    rule.brandPmId === null &&
    !isDatedRule(rule)
  );
}

/**
 * Niveaux que `resolveProfile` (PricingModule, non modifié) retient à l'import,
 * qui ne lui passe que le fournisseur : SUPPLIER et BRAND. Une telle ligne doit
 * donc reprendre les paramètres d'import du profil de base.
 */
export function selectedByImport(level: PriceRuleLevel): boolean {
  return level === 'SUPPLIER' || level === 'BRAND';
}
