/**
 * Component Contracts - Validation des props avec Zod
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md Section 9
 *
 * Interfaces strictes pour garantir la robustesse des composants admin.
 * Validation runtime en dev uniquement pour performance.
 */

import { z } from "zod";
import { logger } from "~/utils/logger";

// ============================================
// STATUS TYPES
// ============================================

/**
 * Types de status sémantiques
 */
export const StatusTypeSchema = z.enum([
  "PASS",
  "FAIL",
  "WARN",
  "PENDING",
  "INFO",
  "NEUTRAL",
]);
export type StatusType = z.infer<typeof StatusTypeSchema>;

/**
 * Status de test (lowercase pour compatibilité SectionKCard)
 */
export const TestStatusSchema = z.enum(["pass", "fail"]).nullable();
export type TestStatus = z.infer<typeof TestStatusSchema>;

// ============================================
// KPI CARD
// ============================================

/**
 * Variantes de KpiCard
 */
export const KpiVariantSchema = z.enum([
  "default",
  "success",
  "warning",
  "danger",
  "info",
]);
export type KpiVariant = z.infer<typeof KpiVariantSchema>;

/**
 * Trend direction
 */
export const TrendDirectionSchema = z.enum(["up", "down"]);
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

/**
 * Props de KpiCard
 */
export const KpiCardPropsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  value: z.union([z.string(), z.number()]),
  icon: z.any(), // LucideIcon - can't validate at runtime
  variant: KpiVariantSchema.optional().default("default"),
  trend: z
    .object({
      value: z.number(),
      direction: TrendDirectionSchema,
    })
    .optional(),
  subtitle: z.string().optional(),
  className: z.string().optional(),
});
export type KpiCardProps = z.infer<typeof KpiCardPropsSchema>;

// ============================================
// STATUS BADGE
// ============================================

/**
 * Props de StatusBadge
 */
export const StatusBadgePropsSchema = z.object({
  status: StatusTypeSchema,
  label: z.string().optional(),
  hideIcon: z.boolean().optional().default(false),
  size: z.enum(["sm", "default"]).optional().default("default"),
  className: z.string().optional(),
});
export type StatusBadgeProps = z.infer<typeof StatusBadgePropsSchema>;

// ============================================
// AUDIT TABLE
// ============================================

/**
 * Item de test (ValidationPanel, SectionKCard)
 */
export const TestItemSchema = z.object({
  id: z.string().min(1, "Test ID is required"),
  label: z.string().min(1, "Test label is required"),
  value: z.union([z.string(), z.number()]),
  status: TestStatusSchema,
  highlight: z.enum(["red", "orange"]).nullable().optional(),
});
export type TestItem = z.infer<typeof TestItemSchema>;

/**
 * Ligne d'audit générique
 */
export const AuditRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  status: StatusTypeSchema.nullable().optional(),
});
export type AuditRow = z.infer<typeof AuditRowSchema>;

// ============================================
// DRILL DOWN
// ============================================

/**
 * Item de drill-down
 */
export const DrillDownItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  sublabel: z.string().optional(),
});
export type DrillDownItem = z.infer<typeof DrillDownItemSchema>;

/**
 * Section de drill-down
 */
export const DrillDownSectionSchema = z.object({
  count: z.number().int().min(0),
  items: z.array(DrillDownItemSchema),
  variant: z.enum(["error", "warning"]),
  title: z.string(),
});
export type DrillDownSection = z.infer<typeof DrillDownSectionSchema>;

// ============================================
// SECTION K METRICS
// ============================================

/**
 * Métriques Section K (V-Level conformité)
 */
export const SectionKMetricsSchema = z.object({
  pg_id: z.number().int().positive(),
  gamme_name: z.string(),
  catalog_valid: z.number().int().min(0),
  covered_v2v3: z.number().int().min(0),
  expected_v4: z.number().int().min(0),
  actual_v4: z.number().int().min(0),
  missing: z.number().int().min(0),
  extras: z.number().int().min(0),
  status: z.enum(["CONFORME", "NON_CONFORME"]),
});
export type SectionKMetrics = z.infer<typeof SectionKMetricsSchema>;

// ============================================
// FILTER BAR
// ============================================

/**
 * Filtre actif
 */
export const ActiveFilterSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
});
export type ActiveFilter = z.infer<typeof ActiveFilterSchema>;

// ============================================
// DENSITY
// ============================================

/**
 * Modes de densité
 */
export const DensityModeSchema = z.enum(["compact", "comfortable", "reading"]);
export type DensityMode = z.infer<typeof DensityModeSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Valide les props en dev uniquement (performance)
 *
 * @example
 * ```tsx
 * const validated = validateProps(KpiCardPropsSchema, props);
 * ```
 */
export function validateProps<T>(
  schema: z.ZodSchema<T>,
  props: unknown,
  componentName = "Component",
): T {
  if (process.env.NODE_ENV === "development") {
    const result = schema.safeParse(props);
    if (!result.success) {
      logger.error(`[${componentName}] Invalid props:`, result.error.format());
      // En dev, on throw pour attraper les erreurs tôt
      throw new Error(
        `[${componentName}] Invalid props: ${result.error.message}`,
      );
    }
    return result.data;
  }
  // En prod, on fait confiance (perf)
  return props as T;
}

/**
 * Valide les props silencieusement (warning only)
 */
export function validatePropsSafe<T>(
  schema: z.ZodSchema<T>,
  props: unknown,
  componentName = "Component",
): T {
  if (process.env.NODE_ENV === "development") {
    const result = schema.safeParse(props);
    if (!result.success) {
      logger.warn(
        `[${componentName}] Invalid props (continuing anyway):`,
        result.error.format(),
      );
    }
  }
  return props as T;
}

/**
 * Type guard pour status
 */
export function isValidStatus(value: unknown): value is StatusType {
  return StatusTypeSchema.safeParse(value).success;
}

/**
 * Type guard pour test status
 */
export function isValidTestStatus(value: unknown): value is TestStatus {
  return TestStatusSchema.safeParse(value).success;
}
