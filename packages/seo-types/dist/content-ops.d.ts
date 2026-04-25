import { z } from "zod";
export declare const EditorialRoleSchema: z.ZodEnum<["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]>;
export type EditorialRole = z.infer<typeof EditorialRoleSchema>;
export declare const EditorialStateSchema: z.ZodEnum<["planned", "brief_draft", "brief_approved", "in_progress", "review", "published", "blocked", "cancelled"]>;
export type EditorialState = z.infer<typeof EditorialStateSchema>;
export declare const EditorialCalendarEntrySchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    entity_id: z.ZodString;
    role: z.ZodEnum<["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]>;
    scheduled_at: z.ZodString;
    state: z.ZodEnum<["planned", "brief_draft", "brief_approved", "in_progress", "review", "published", "blocked", "cancelled"]>;
    assignee: z.ZodNullable<z.ZodString>;
    brief_id: z.ZodNullable<z.ZodString>;
    completed_at: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    entity_id: string;
    role: "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";
    scheduled_at: string;
    state: "planned" | "brief_draft" | "brief_approved" | "in_progress" | "review" | "published" | "blocked" | "cancelled";
    assignee: string | null;
    brief_id: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    id?: string | undefined;
}, {
    entity_id: string;
    role: "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";
    scheduled_at: string;
    state: "planned" | "brief_draft" | "brief_approved" | "in_progress" | "review" | "published" | "blocked" | "cancelled";
    assignee: string | null;
    brief_id: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    id?: string | undefined;
}>;
export type EditorialCalendarEntry = z.infer<typeof EditorialCalendarEntrySchema>;
export declare const FreshnessStateSchema: z.ZodObject<{
    last_updated_at: z.ZodString;
    last_traffic_window_days: z.ZodNumber;
    traffic_window: z.ZodNumber;
    freshness_score: z.ZodNumber;
    refresh_priority: z.ZodEnum<["urgent", "high", "medium", "low"]>;
    computed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    last_updated_at: string;
    last_traffic_window_days: number;
    traffic_window: number;
    freshness_score: number;
    refresh_priority: "urgent" | "high" | "medium" | "low";
    computed_at: string;
}, {
    last_updated_at: string;
    last_traffic_window_days: number;
    traffic_window: number;
    freshness_score: number;
    refresh_priority: "urgent" | "high" | "medium" | "low";
    computed_at: string;
}>;
export type FreshnessState = z.infer<typeof FreshnessStateSchema>;
//# sourceMappingURL=content-ops.d.ts.map