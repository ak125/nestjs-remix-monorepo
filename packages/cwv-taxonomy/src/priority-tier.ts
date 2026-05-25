/**
 * PriorityTier — pondération business pour alerting & dashboards.
 *
 * Mirror strict de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` §priority_tiers.
 *
 * CWV_P0 = surveillance stricte (alerts trend-divergence-sustained, bloc 6).
 * CWV_P1 = monitoring standard (dashboard, pas d'alert auto).
 * CWV_P2 = best-effort (tracking sans alerte).
 */

import type { Surface } from './surface';

export const PRIORITY_TIER_VALUES = ['CWV_P0', 'CWV_P1', 'CWV_P2'] as const;

export type PriorityTier = (typeof PRIORITY_TIER_VALUES)[number];

export const SURFACE_TO_PRIORITY_TIER: Readonly<Record<Surface, PriorityTier>> =
  Object.freeze({
    PAYMENT: 'CWV_P0',
    CHECKOUT: 'CWV_P0',
    CART: 'CWV_P0',
    R5_DIAGNOSTIC: 'CWV_P0',
    R2_PRODUCT: 'CWV_P0',
    R2_GAMME_VEHICLE: 'CWV_P1',
    R8_VEHICLE: 'CWV_P1',
    SEARCH: 'CWV_P1',
    R3_GUIDE: 'CWV_P1',
    HOME: 'CWV_P2',
    ACCOUNT: 'CWV_P2',
    OTHER: 'CWV_P2',
  });

export function isPriorityTier(value: unknown): value is PriorityTier {
  return (
    typeof value === 'string' &&
    (PRIORITY_TIER_VALUES as readonly string[]).includes(value)
  );
}

export function priorityTierFromSurface(surface: Surface): PriorityTier {
  return SURFACE_TO_PRIORITY_TIER[surface];
}
