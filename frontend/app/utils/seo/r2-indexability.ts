/**
 * R2 vehicle-listing indexability rule (owner rule 2026-06-10).
 *
 * Page = `/pieces/:gamme/:marque/:modele/:type.html` (gamme × véhicule listing).
 *
 * Rule, simple and explicit:
 *   - a page is indexable as soon as it has at least `R2_MIN_SELLABLE_PRODUCTS`
 *     (default **1**) product a user can actually buy. Only a page with **0
 *     sellable** product → `noindex, follow`.
 *   - 1 sellable product is a LEGITIMATE page (some vehicles have a single
 *     compatible part per gamme) → keep it indexed; thinness is fixed by the
 *     page's existing structural vehicle-aware content (FAQ / buying guide /
 *     compatibility / cross-selling / sg_content), NEVER by generic filler.
 *   - **Always `follow`** — even unindexed, the page still passes internal nav.
 *
 * "Sellable" reuses the storefront predicate {@link isSellable}
 * (`price > 0` AND `stock_status ∈ {IN_STOCK, LOW_STOCK, PREORDER}`) — PREORDER
 * counts as sellable (`pri_dispo='3'`, delivered with a delay). We must NOT use
 * `stock_status !== 'OUT_OF_STOCK'`: the R2 RPC removed its stock filter
 * (`20260118_rm_remove_stock_filter.sql`, v1.4.0), so an OUT_OF_STOCK piece still
 * carries its real `price_ttc` — only the explicit allow-list excludes it.
 *
 * Gate OFF by default: behaviour is byte-identical to the legacy
 * `count >= 2 || (count === 1 && dataQuality >= 50)` rule until an operator
 * flips `SEO_R2_SELLABLE_NOINDEX_ENABLED=true` (measure on DEV before PROD).
 */
import { isSellable } from "~/utils/stock.utils";

/**
 * Default minimum sellable products for an R2 listing to stay indexable.
 * `1` → only a page with ZERO sellable product is noindexed. A single
 * compatible part is a legitimate page (owner decision 2026-06-10).
 */
export const R2_MIN_SELLABLE_PRODUCTS = 1;

export type RobotsDirective = "index, follow" | "noindex, follow";

/** Minimal shape needed to judge a product's sellability. */
export interface SellableProduct {
  price_ttc?: number;
  stock_status?: string;
}

/**
 * Count products a user can actually obtain (price > 0 AND sellable stock).
 * Reuses the governed storefront {@link isSellable} predicate — no new rule.
 */
export function countSellableProducts(
  products: ReadonlyArray<SellableProduct> | null | undefined,
): number {
  if (!products) return 0;
  return products.reduce(
    (n, p) => (isSellable(p.price_ttc, p.stock_status) ? n + 1 : n),
    0,
  );
}

export interface R2RobotsInput {
  /** OFF by default → legacy rule preserved. */
  sellableGateEnabled: boolean;
  /**
   * Whether this page's gamme is one of the 232 catalog gammes
   * (`pg_display='1' AND pg_level IN ('1','2')`). The sellable gate applies
   * ONLY to catalog gammes (owner scope 2026-06-10); off-catalog gammes keep
   * the legacy rule. See catalog-gammes.server.ts.
   */
  isCatalogGamme: boolean;
  sellableCount: number;
  minSellable: number;
  /** Legacy inputs (used when the gate is OFF or the gamme is off-catalog). */
  count: number;
  dataQuality: number;
}

/**
 * Resolve the R2 listing robots directive. Always returns a `follow` value.
 * - Gate ON **and** catalog gamme → indexable iff `sellableCount >= minSellable`.
 * - Otherwise (gate OFF, or off-catalog gamme) → legacy rule
 *   (`count >= 2 || (count === 1 && dataQuality >= 50)`), byte-identical.
 */
export function resolveR2Robots(input: R2RobotsInput): RobotsDirective {
  if (input.sellableGateEnabled && input.isCatalogGamme) {
    return input.sellableCount >= input.minSellable
      ? "index, follow"
      : "noindex, follow";
  }
  return input.count >= 2 || (input.count === 1 && input.dataQuality >= 50)
    ? "index, follow"
    : "noindex, follow";
}

export interface R2SellableGateConfig {
  enabled: boolean;
  minSellable: number;
}

/**
 * Read the server-only enablement + threshold. OFF by default.
 * `SEO_R2_SELLABLE_NOINDEX_ENABLED` (true|false) — follows the existing
 * `SEO_<X>_ENABLED` convention. `SEO_R2_MIN_SELLABLE_PRODUCTS` (int) overrides
 * the threshold ({@link R2_MIN_SELLABLE_PRODUCTS} otherwise).
 */
export function readR2SellableGateConfig(
  env: Record<string, string | undefined> = process.env,
): R2SellableGateConfig {
  const enabled = env.SEO_R2_SELLABLE_NOINDEX_ENABLED === "true";
  const parsed = Number.parseInt(env.SEO_R2_MIN_SELLABLE_PRODUCTS ?? "", 10);
  const minSellable =
    Number.isInteger(parsed) && parsed > 0 ? parsed : R2_MIN_SELLABLE_PRODUCTS;
  return { enabled, minSellable };
}
