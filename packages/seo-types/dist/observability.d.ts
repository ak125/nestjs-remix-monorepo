import { z } from "zod";
export declare const GSCDailyRowSchema: z.ZodObject<{
    date: z.ZodString;
    page: z.ZodString;
    query: z.ZodString;
    device: z.ZodDefault<z.ZodEnum<["all", "mobile", "desktop", "tablet"]>>;
    clicks: z.ZodNumber;
    impressions: z.ZodNumber;
    ctr: z.ZodNumber;
    position: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    date: string;
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    query: string;
    device: "all" | "mobile" | "desktop" | "tablet";
}, {
    date: string;
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    query: string;
    device?: "all" | "mobile" | "desktop" | "tablet" | undefined;
}>;
export type GSCDailyRow = z.infer<typeof GSCDailyRowSchema>;
export declare const GSCTimeseriesResponseSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    group_by: z.ZodEnum<["page", "query", "device", "date"]>;
    rows: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        page: z.ZodString;
        query: z.ZodString;
        device: z.ZodDefault<z.ZodEnum<["all", "mobile", "desktop", "tablet"]>>;
        clicks: z.ZodNumber;
        impressions: z.ZodNumber;
        ctr: z.ZodNumber;
        position: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        page: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
        query: string;
        device: "all" | "mobile" | "desktop" | "tablet";
    }, {
        date: string;
        page: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
        query: string;
        device?: "all" | "mobile" | "desktop" | "tablet" | undefined;
    }>, "many">;
    totals: z.ZodObject<{
        clicks: z.ZodNumber;
        impressions: z.ZodNumber;
        ctr: z.ZodNumber;
        avg_position: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        clicks: number;
        impressions: number;
        ctr: number;
        avg_position: number;
    }, {
        clicks: number;
        impressions: number;
        ctr: number;
        avg_position: number;
    }>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    group_by: "date" | "page" | "query" | "device";
    rows: {
        date: string;
        page: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
        query: string;
        device: "all" | "mobile" | "desktop" | "tablet";
    }[];
    totals: {
        clicks: number;
        impressions: number;
        ctr: number;
        avg_position: number;
    };
}, {
    from: string;
    to: string;
    group_by: "date" | "page" | "query" | "device";
    rows: {
        date: string;
        page: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
        query: string;
        device?: "all" | "mobile" | "desktop" | "tablet" | undefined;
    }[];
    totals: {
        clicks: number;
        impressions: number;
        ctr: number;
        avg_position: number;
    };
}>;
export type GSCTimeseriesResponse = z.infer<typeof GSCTimeseriesResponseSchema>;
export declare const GA4DailyRowSchema: z.ZodObject<{
    date: z.ZodString;
    page: z.ZodString;
    channel: z.ZodDefault<z.ZodString>;
    sessions: z.ZodNumber;
    conversions: z.ZodNumber;
    bounce_rate: z.ZodNullable<z.ZodNumber>;
    avg_session_duration: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    date: string;
    page: string;
    sessions: number;
    conversions: number;
    channel: string;
    bounce_rate: number | null;
    avg_session_duration: number | null;
}, {
    date: string;
    page: string;
    sessions: number;
    conversions: number;
    bounce_rate: number | null;
    avg_session_duration: number | null;
    channel?: string | undefined;
}>;
export type GA4DailyRow = z.infer<typeof GA4DailyRowSchema>;
export declare const GA4TimeseriesResponseSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    rows: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        page: z.ZodString;
        channel: z.ZodDefault<z.ZodString>;
        sessions: z.ZodNumber;
        conversions: z.ZodNumber;
        bounce_rate: z.ZodNullable<z.ZodNumber>;
        avg_session_duration: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        page: string;
        sessions: number;
        conversions: number;
        channel: string;
        bounce_rate: number | null;
        avg_session_duration: number | null;
    }, {
        date: string;
        page: string;
        sessions: number;
        conversions: number;
        bounce_rate: number | null;
        avg_session_duration: number | null;
        channel?: string | undefined;
    }>, "many">;
    totals: z.ZodObject<{
        sessions: z.ZodNumber;
        conversions: z.ZodNumber;
        avg_bounce_rate: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sessions: number;
        conversions: number;
        avg_bounce_rate: number | null;
    }, {
        sessions: number;
        conversions: number;
        avg_bounce_rate: number | null;
    }>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    rows: {
        date: string;
        page: string;
        sessions: number;
        conversions: number;
        channel: string;
        bounce_rate: number | null;
        avg_session_duration: number | null;
    }[];
    totals: {
        sessions: number;
        conversions: number;
        avg_bounce_rate: number | null;
    };
}, {
    from: string;
    to: string;
    rows: {
        date: string;
        page: string;
        sessions: number;
        conversions: number;
        bounce_rate: number | null;
        avg_session_duration: number | null;
        channel?: string | undefined;
    }[];
    totals: {
        sessions: number;
        conversions: number;
        avg_bounce_rate: number | null;
    };
}>;
export type GA4TimeseriesResponse = z.infer<typeof GA4TimeseriesResponseSchema>;
export declare const CWVDailyRowSchema: z.ZodObject<{
    date: z.ZodString;
    page: z.ZodString;
    lcp: z.ZodNullable<z.ZodNumber>;
    fid: z.ZodNullable<z.ZodNumber>;
    cls: z.ZodNullable<z.ZodNumber>;
    inp: z.ZodNullable<z.ZodNumber>;
    ttfb: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    date: string;
    page: string;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fid: number | null;
    ttfb: number | null;
}, {
    date: string;
    page: string;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fid: number | null;
    ttfb: number | null;
}>;
export type CWVDailyRow = z.infer<typeof CWVDailyRowSchema>;
export declare const GSCLinkSchema: z.ZodObject<{
    snapshot_date: z.ZodString;
    source_domain: z.ZodString;
    source_url: z.ZodString;
    target_url: z.ZodString;
    anchor_text: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    snapshot_date: string;
    source_domain: string;
    source_url: string;
    target_url: string;
    anchor_text: string | null;
}, {
    snapshot_date: string;
    source_domain: string;
    source_url: string;
    target_url: string;
    anchor_text: string | null;
}>;
export type GSCLink = z.infer<typeof GSCLinkSchema>;
export declare const IndexationStatusSchema: z.ZodObject<{
    url: z.ZodString;
    is_indexed: z.ZodBoolean;
    status: z.ZodEnum<["INDEXED", "NOT_INDEXED", "BLOCKED_BY_ROBOTS", "NOT_FOUND", "REDIRECT", "SOFT_404", "DUPLICATE_WITHOUT_CANONICAL", "UNKNOWN"]>;
    first_seen_at: z.ZodNullable<z.ZodString>;
    last_crawl_at: z.ZodNullable<z.ZodString>;
    crawl_count_30d: z.ZodNumber;
    status_source: z.ZodEnum<["gsc_inspection", "googlebot_log", "manual"]>;
    canonical_url: z.ZodNullable<z.ZodString>;
    robots_indexable: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status: "INDEXED" | "NOT_INDEXED" | "BLOCKED_BY_ROBOTS" | "NOT_FOUND" | "REDIRECT" | "SOFT_404" | "DUPLICATE_WITHOUT_CANONICAL" | "UNKNOWN";
    url: string;
    is_indexed: boolean;
    first_seen_at: string | null;
    last_crawl_at: string | null;
    crawl_count_30d: number;
    status_source: "gsc_inspection" | "googlebot_log" | "manual";
    canonical_url: string | null;
    robots_indexable: boolean | null;
}, {
    status: "INDEXED" | "NOT_INDEXED" | "BLOCKED_BY_ROBOTS" | "NOT_FOUND" | "REDIRECT" | "SOFT_404" | "DUPLICATE_WITHOUT_CANONICAL" | "UNKNOWN";
    url: string;
    is_indexed: boolean;
    first_seen_at: string | null;
    last_crawl_at: string | null;
    crawl_count_30d: number;
    status_source: "gsc_inspection" | "googlebot_log" | "manual";
    canonical_url: string | null;
    robots_indexable: boolean | null;
}>;
export type IndexationStatus = z.infer<typeof IndexationStatusSchema>;
//# sourceMappingURL=observability.d.ts.map