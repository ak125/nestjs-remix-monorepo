import { z } from "zod";
export const GSCDailyRowSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD"),
    page: z.string().url(),
    query: z.string().min(1),
    device: z.enum(["all", "mobile", "desktop", "tablet"]).default("all"),
    clicks: z.number().int().nonnegative(),
    impressions: z.number().int().nonnegative(),
    ctr: z.number().min(0).max(1),
    position: z.number().min(0),
});
export const GSCTimeseriesResponseSchema = z.object({
    from: z.string(),
    to: z.string(),
    group_by: z.enum(["page", "query", "device", "date"]),
    rows: z.array(GSCDailyRowSchema),
    totals: z.object({
        clicks: z.number().int(),
        impressions: z.number().int(),
        ctr: z.number(),
        avg_position: z.number(),
    }),
});
export const GA4DailyRowSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    page: z.string().url(),
    channel: z.string().default("organic"),
    sessions: z.number().int().nonnegative(),
    conversions: z.number().int().nonnegative(),
    bounce_rate: z.number().min(0).max(1).nullable(),
    avg_session_duration: z.number().nonnegative().nullable(),
});
export const GA4TimeseriesResponseSchema = z.object({
    from: z.string(),
    to: z.string(),
    rows: z.array(GA4DailyRowSchema),
    totals: z.object({
        sessions: z.number().int(),
        conversions: z.number().int(),
        avg_bounce_rate: z.number().nullable(),
    }),
});
export const CWVDailyRowSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    page: z.string().url(),
    lcp: z.number().nonnegative().nullable(),
    fid: z.number().nonnegative().nullable(),
    cls: z.number().nonnegative().nullable(),
    inp: z.number().nonnegative().nullable(),
    ttfb: z.number().nonnegative().nullable(),
});
export const GSCLinkSchema = z.object({
    snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source_domain: z.string(),
    source_url: z.string().url(),
    target_url: z.string().url(),
    anchor_text: z.string().nullable(),
});
export const IndexationStatusSchema = z.object({
    url: z.string().url(),
    is_indexed: z.boolean(),
    status: z.enum([
        "INDEXED",
        "NOT_INDEXED",
        "BLOCKED_BY_ROBOTS",
        "NOT_FOUND",
        "REDIRECT",
        "SOFT_404",
        "DUPLICATE_WITHOUT_CANONICAL",
        "UNKNOWN",
    ]),
    first_seen_at: z.string().datetime().nullable(),
    last_crawl_at: z.string().datetime().nullable(),
    crawl_count_30d: z.number().int().nonnegative(),
    status_source: z.enum(["gsc_inspection", "googlebot_log", "manual"]),
    canonical_url: z.string().url().nullable(),
    robots_indexable: z.boolean().nullable(),
});
//# sourceMappingURL=observability.js.map