/**
 * Content Operations — schemas for editorial calendar + freshness rotation.
 *
 * Two locations :
 *  - `__seo_editorial_calendar` (new table — workflow state machine, doesn't fit JSONB)
 *  - `__seo_entity_health.freshness_state` JSONB column (extension, no new table)
 */
import { z } from "zod";

// ─── Editorial Calendar (table) ───────────────────────────────────────────

export const EditorialRoleSchema = z.enum([
  "R0",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
]);
export type EditorialRole = z.infer<typeof EditorialRoleSchema>;

export const EditorialStateSchema = z.enum([
  "planned",
  "brief_draft",
  "brief_approved",
  "in_progress",
  "review",
  "published",
  "blocked",
  "cancelled",
]);
export type EditorialState = z.infer<typeof EditorialStateSchema>;

/** One row of __seo_editorial_calendar. */
export const EditorialCalendarEntrySchema = z.object({
  id: z.string().uuid().optional(),
  /** FK __seo_entity.entity_id (gamme, vehicule, guide, diagnostic). */
  entity_id: z.string(),
  role: EditorialRoleSchema,
  scheduled_at: z.string().datetime(),
  state: EditorialStateSchema,
  assignee: z.string().nullable(),
  brief_id: z.string().uuid().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type EditorialCalendarEntry = z.infer<typeof EditorialCalendarEntrySchema>;

// ─── Freshness State (JSONB column on __seo_entity_health) ────────────────

export const FreshnessStateSchema = z.object({
  last_updated_at: z.string().datetime(),
  last_traffic_window_days: z.number().int().positive(),
  /** Sessions over the last N days (per last_traffic_window_days). */
  traffic_window: z.number().int().nonnegative(),
  /**
   * 0-100 score : higher = fresher and more trafficked.
   * Algo : ratio of (recency × traffic) — see runbook.
   */
  freshness_score: z.number().min(0).max(100),
  /**
   * Refresh priority — used by the rotator to pick top-N pages each week.
   * `urgent` = high traffic + stale (>12mo), `low` = low traffic or recent.
   */
  refresh_priority: z.enum(["urgent", "high", "medium", "low"]),
  /** When the freshness algorithm last computed this snapshot. */
  computed_at: z.string().datetime(),
});
export type FreshnessState = z.infer<typeof FreshnessStateSchema>;
