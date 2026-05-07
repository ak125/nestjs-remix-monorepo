/**
 * Per-role canonical intent matrix.
 *
 * Each role declares THREE distinct intent slots :
 *   - `primary`         : dominant editorial axis (single intent)
 *   - `secondary`       : parallel intents acceptable without role drift
 *   - `allowedLeakage`  : edge-case tolerance for classifier acceptance only
 *
 * **`allowedLeakage` is NOT a feature signal.** A consumer that observes
 * `transactionnelle` in `allowedLeakage` MUST NOT render prices, "add to cart"
 * CTAs, promo banners, or any other transactional UI. It exists solely so
 * `isIntentAllowedForRole()` accepts borderline keywords during classification
 * (e.g. "filtre huile pas cher" → R1_ROUTER even though the keyword carries a
 * transactional tail). Editorial surfaces (R3, R4, R6_*) keep `allowedLeakage`
 * empty by design — preserve the role purity required by the canon planners.
 *
 * Source : `.claude/prompts/R<role>/planner.md` rerouting rules and the matching
 * `contract.md` frontmatter `intent`. Hand-curated mirror; the future
 * `canon.json` build pipeline (PR-A.bis) will derive this matrix from the
 * prompts directly.
 */

import { RoleId } from "./canonical";
import { type SearchIntent } from "./keyword-intent";

export interface RoleIntents {
  readonly primary: SearchIntent;
  readonly secondary: readonly SearchIntent[];
  readonly allowedLeakage: readonly SearchIntent[];
}

/**
 * Returns the canonical intent slots for a role.
 *
 * Roles not listed (legacy / forbidden / unknown) fall back to a safe
 * `informationnelle`-only baseline — never grants leakage by default.
 */
export function getRoleIntents(role: RoleId): RoleIntents {
  switch (role) {
    case RoleId.R2_PRODUCT:
      return { primary: "transactionnelle", secondary: [], allowedLeakage: [] };
    case RoleId.R5_DIAGNOSTIC:
      return { primary: "diagnostique", secondary: [], allowedLeakage: [] };
    case RoleId.R4_REFERENCE:
      return {
        primary: "informationnelle",
        secondary: ["navigationnelle"],
        allowedLeakage: [],
      };
    case RoleId.R1_ROUTER:
      return {
        primary: "navigationnelle",
        secondary: [],
        allowedLeakage: ["transactionnelle"],
      };
    case RoleId.R7_BRAND:
      return {
        primary: "navigationnelle",
        secondary: ["informationnelle"],
        allowedLeakage: [],
      };
    case RoleId.R8_VEHICLE:
      return {
        primary: "navigationnelle",
        secondary: [],
        allowedLeakage: ["transactionnelle"],
      };
    case RoleId.R3_CONSEILS:
      // Strict editorial how-to surface — no leakage tolerated.
      return { primary: "informationnelle", secondary: [], allowedLeakage: [] };
    case RoleId.R6_GUIDE_ACHAT:
      // Buying guide = investigation_commerciale primary. Editorial layer
      // alongside R3/R4 — no transactional leakage (price/CTA belong to R2).
      return {
        primary: "investigation_commerciale",
        secondary: ["informationnelle"],
        allowedLeakage: [],
      };
    case RoleId.R6_SUPPORT:
      return { primary: "informationnelle", secondary: [], allowedLeakage: [] };
    case RoleId.R0_HOME:
      return {
        primary: "navigationnelle",
        secondary: ["informationnelle"],
        allowedLeakage: [],
      };
    default:
      return { primary: "informationnelle", secondary: [], allowedLeakage: [] };
  }
}

/**
 * Read-only predicate : is `intent` in the role's primary/secondary/leakage set?
 *
 * Use ONLY for classifier acceptance and Zod refinement on cluster shapes.
 * Do NOT use this to gate feature behaviour (price rendering, CTA visibility,
 * promo blocks) — those decisions must check `getRoleIntents(role).primary`
 * against an explicit allow-list, NOT the union including `allowedLeakage`.
 */
export function isIntentAllowedForRole(
  role: RoleId,
  intent: SearchIntent,
): boolean {
  const slots = getRoleIntents(role);
  return (
    slots.primary === intent ||
    slots.secondary.includes(intent) ||
    slots.allowedLeakage.includes(intent)
  );
}
