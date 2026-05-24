/**
 * FunnelStep — ordre canonique du parcours conversion.
 *
 * Mirror strict de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` §funnel_steps_order.
 * Ordre dans le tableau = ordre business attendu. Validation `previous_funnel_step
 * <= funnel_step` faite côté collector via FUNNEL_STEP_ORDER lookup.
 */

import type { Surface } from './surface';

export const FUNNEL_STEP_VALUES = [
  'landing',
  'view_listing',
  'view_product',
  'view_guide',
  'view_diagnostic',
  'view_vehicle',
  'view_search',
  'view_account',
  'view_other',
  'add_cart',
  'checkout_entry',
  'checkout_step',
  'payment',
  'completed',
] as const;

export type FunnelStep = (typeof FUNNEL_STEP_VALUES)[number];

/** Lookup ordre (0-indexed) — utilisé pour valider previous_funnel_step <= funnel_step. */
export const FUNNEL_STEP_ORDER: Readonly<Record<FunnelStep, number>> = Object.freeze(
  FUNNEL_STEP_VALUES.reduce(
    (acc, step, idx) => {
      acc[step] = idx;
      return acc;
    },
    {} as Record<FunnelStep, number>,
  ),
);

/** Mapping Surface → FunnelStep canonique (par défaut, peut être overridé via context). */
export const SURFACE_TO_FUNNEL_STEP: Readonly<Record<Surface, FunnelStep>> = Object.freeze({
  R2_PRODUCT: 'view_product',
  R2_GAMME_VEHICLE: 'view_listing',
  R3_GUIDE: 'view_guide',
  R5_DIAGNOSTIC: 'view_diagnostic',
  R8_VEHICLE: 'view_vehicle',
  SEARCH: 'view_search',
  HOME: 'landing',
  CART: 'checkout_entry',
  CHECKOUT: 'checkout_step',
  PAYMENT: 'payment',
  ACCOUNT: 'view_account',
  OTHER: 'view_other',
});

export function isFunnelStep(value: unknown): value is FunnelStep {
  return (
    typeof value === 'string' &&
    (FUNNEL_STEP_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Validate that `previous` precedes (or equals) `current` in funnel order.
 * Returns true if `previous` is null/undefined (initial step).
 */
export function isValidFunnelTransition(
  previous: FunnelStep | null | undefined,
  current: FunnelStep,
): boolean {
  if (previous === null || previous === undefined) return true;
  return FUNNEL_STEP_ORDER[previous] <= FUNNEL_STEP_ORDER[current];
}
