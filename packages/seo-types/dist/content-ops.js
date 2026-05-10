import { z } from "zod";
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
export const EditorialCalendarEntrySchema = z.object({
    id: z.string().uuid().optional(),
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
export const FreshnessStateSchema = z.object({
    last_updated_at: z.string().datetime(),
    last_traffic_window_days: z.number().int().positive(),
    traffic_window: z.number().int().nonnegative(),
    freshness_score: z.number().min(0).max(100),
    refresh_priority: z.enum(["urgent", "high", "medium", "low"]),
    computed_at: z.string().datetime(),
});
//# sourceMappingURL=content-ops.js.map