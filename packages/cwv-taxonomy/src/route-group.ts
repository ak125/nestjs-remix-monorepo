/**
 * RouteGroup + classifyRoute() — mapping déterministe path → route_group → surface.
 *
 * Mirror strict de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` §route_groups.
 * Whitelist fermée — ajout d'une nouvelle route = PR explicite (anti-discovery).
 *
 * Algorithm : first-match-wins par ordre de spécificité (plus longue ou
 * suffix-distinctive d'abord).
 */

import type { FunnelStep } from './funnel-step';
import { SURFACE_TO_FUNNEL_STEP } from './funnel-step';
import type { PriorityTier } from './priority-tier';
import { SURFACE_TO_PRIORITY_TIER } from './priority-tier';
import type { Surface } from './surface';

export const ROUTE_GROUP_VALUES = [
  'pieces_product',
  'pieces_gamme_vehicle',
  'r3_guide',
  'r5_diagnostic',
  'r8_vehicle',
  'marques_listing',
  'search',
  'cart',
  'checkout',
  'payment',
  'account',
  'home',
  'other',
] as const;

export type RouteGroup = (typeof ROUTE_GROUP_VALUES)[number];

export const ROUTE_GROUP_TO_SURFACE: Readonly<Record<RouteGroup, Surface>> = Object.freeze({
  pieces_product: 'R2_PRODUCT',
  pieces_gamme_vehicle: 'R2_GAMME_VEHICLE',
  r3_guide: 'R3_GUIDE',
  r5_diagnostic: 'R5_DIAGNOSTIC',
  r8_vehicle: 'R8_VEHICLE',
  marques_listing: 'R2_GAMME_VEHICLE',
  search: 'SEARCH',
  cart: 'CART',
  checkout: 'CHECKOUT',
  payment: 'PAYMENT',
  account: 'ACCOUNT',
  home: 'HOME',
  other: 'OTHER',
});

export function isRouteGroup(value: unknown): value is RouteGroup {
  return (
    typeof value === 'string' &&
    (ROUTE_GROUP_VALUES as readonly string[]).includes(value)
  );
}

export interface RouteClassification {
  route_group: RouteGroup;
  surface: Surface;
  priority_tier: PriorityTier;
  funnel_step: FunnelStep;
}

/**
 * Classify a pathname (no query/hash) into the taxonomy.
 *
 * Algorithm (first match wins, order matters):
 *   1. Exact match `/` → home
 *   2. `/pieces/...` + `.html` → pieces_product (5-segments URL canonical)
 *   3. `/pieces/...` (no `.html`)         → pieces_gamme_vehicle (4-segments listing)
 *   4. `/conseils/...`     → r3_guide
 *   5. `/diagnostic/...`   → r5_diagnostic
 *   6. `/constructeurs/...`→ r8_vehicle
 *   7. `/marques/...`      → marques_listing
 *   8. `/recherche`        → search
 *   9. `/panier`           → cart
 *   10. `/checkout`        → checkout
 *   11. `/paiement`        → payment
 *   12. `/compte/...`      → account
 *   13. fallback           → other
 *
 * Input is a pathname (e.g. from `URL.pathname`) — query/hash must be stripped
 * by caller. Empty/null/undefined → 'other'.
 */
export function classifyRoute(pathname: string | null | undefined): RouteClassification {
  let group: RouteGroup = 'other';

  if (pathname !== null && pathname !== undefined && pathname.length > 0) {
    if (pathname === '/') {
      group = 'home';
    } else if (pathname.startsWith('/pieces/')) {
      group = pathname.endsWith('.html') ? 'pieces_product' : 'pieces_gamme_vehicle';
    } else if (pathname.startsWith('/conseils/')) {
      group = 'r3_guide';
    } else if (pathname.startsWith('/diagnostic/')) {
      group = 'r5_diagnostic';
    } else if (pathname.startsWith('/constructeurs/')) {
      group = 'r8_vehicle';
    } else if (pathname.startsWith('/marques/')) {
      group = 'marques_listing';
    } else if (pathname.startsWith('/recherche')) {
      group = 'search';
    } else if (pathname.startsWith('/panier')) {
      group = 'cart';
    } else if (pathname.startsWith('/checkout')) {
      group = 'checkout';
    } else if (pathname.startsWith('/paiement')) {
      group = 'payment';
    } else if (pathname.startsWith('/compte')) {
      group = 'account';
    }
  }

  const surface = ROUTE_GROUP_TO_SURFACE[group];
  return {
    route_group: group,
    surface,
    priority_tier: SURFACE_TO_PRIORITY_TIER[surface],
    funnel_step: SURFACE_TO_FUNNEL_STEP[surface],
  };
}
