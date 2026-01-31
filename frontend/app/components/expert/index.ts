/**
 * Expert Components (R2/Product Pages)
 * @description Pack Confiance - Trust-First + Compatibility
 *
 * V1 Components (original DCO V2):
 * - ProductStickyCTA, CompatibilitySheet, TrustRow
 * - Generic green CTA (#34C759)
 * - Basic trust badges
 *
 * V2 Components (ui-ux-pro-max + frontend-design skills):
 * - ProductStickyCTAV2, CompatibilitySheetV2, TrustRowV2
 * - Trust & Authority design system
 * - Professional Blue CTA (#0369A1) + Trust Teal (#0F766E)
 * - Lexend + Source Sans 3 typography
 * - Enhanced animations (verified-reveal, metric-pulse, stat-reveal)
 * - Anti-AI-slop design (no Inter/Roboto, no purple gradients)
 */

// ============================================================================
// V1 Components (Original)
// ============================================================================

export { ProductStickyCTA, ProductStickyCTASkeleton } from "./ProductStickyCTA";
export type { ProductStickyCTAProps } from "./ProductStickyCTA";

export { CompatibilitySheet } from "./CompatibilitySheet";
export type {
  CompatibilitySheetProps,
  VehicleInfo,
} from "./CompatibilitySheet";

export {
  TrustRow,
  ProductTrustRow,
  CompactTrustBadges,
  FooterTrustRow,
} from "./TrustRow";
export type { TrustRowProps, TrustBadge } from "./TrustRow";

// ============================================================================
// V2 Components (Trust & Authority Design System)
// ============================================================================

export {
  ProductStickyCTAV2,
  ProductStickyCTAV2Skeleton,
} from "./ProductStickyCTAV2";
export type { ProductStickyCTAV2Props } from "./ProductStickyCTAV2";

export { CompatibilitySheetV2 } from "./CompatibilitySheetV2";
export type {
  CompatibilitySheetV2Props,
  VehicleInfoV2,
} from "./CompatibilitySheetV2";

export {
  TrustRowV2,
  ProductTrustRowV2,
  CompactTrustBadgesV2,
  FooterTrustRowV2,
} from "./TrustRowV2";
export type { TrustRowV2Props, TrustBadgeV2 } from "./TrustRowV2";

// ============================================================================
// V2 Killer Feature: Compatibility Badge + Resolver
// ============================================================================

export { CompatibilityBadgeV2 } from "./CompatibilityBadgeV2";
export type { CompatibilityBadgeV2Props } from "./CompatibilityBadgeV2";

export { CompatibilityResolverModal } from "./CompatibilityResolverModal";
export type { CompatibilityResolverModalProps } from "./CompatibilityResolverModal";

// ============================================================================
// Design System
// ============================================================================

export * from "./design-system";
