/**
 * CrUX (Chrome User Experience Report) — Zod schemas for field CWV monitoring.
 *
 * Backed by 2 Postgres tables (cf. backend/supabase/migrations/20260514_seo_crux_field_history.sql) :
 *  - __seo_crux_field_history : timeseries hebdo p75 LCP/INP/CLS/TTFB/FCP
 *                               (CrUX History API renvoie 40 périodes hebdo
 *                                par fetch, rolling 28j chacune)
 *  - __seo_crux_alert_state   : state machine OPEN → STILL_OPEN → RESOLVED
 *                               (fire-once anti-spam quotidien)
 *
 * Refs :
 *  - ADR-063 (Accepted 2026-05-14) — CWV Monitoring PROD via CrUX API
 *  - ADR-045 (amends) — SEO Monitoring Cron V0
 *  - https://developer.chrome.com/docs/crux/api
 *
 * NOTE PG : la PK des deux tables utilise `url_key TEXT GENERATED ALWAYS AS
 * (COALESCE(url, '')) STORED` car PostgreSQL refuse les expressions dans la
 * PK d'une table partitionnée. Origin-level rows ont `url_key = ''`.
 */
import { z } from "zod";

// ─── Enums (mirror DB CHECK constraints) ──────────────────────────────────

/** CrUX form factor (cf. https://developer.chrome.com/docs/crux/api#formFactor) */
export const CruxFormFactorSchema = z.enum([
  "PHONE",
  "DESKTOP",
  "TABLET",
  "ALL_FORM_FACTORS",
]);
export type CruxFormFactor = z.infer<typeof CruxFormFactorSchema>;

/** CrUX field metric keys exposed in V1 (5 Web Vitals). */
export const CruxMetricKeySchema = z.enum(["lcp", "inp", "cls", "ttfb", "fcp"]);
export type CruxMetricKey = z.infer<typeof CruxMetricKeySchema>;

/** Source API distinguishing V1 (history) from future V2 (record snapshot 28j). */
export const CruxSourceApiSchema = z.enum(["history", "record"]);
export type CruxSourceApi = z.infer<typeof CruxSourceApiSchema>;

/** Alert severity (matches Google thresholds + relative drift). */
export const CruxAlertSeveritySchema = z.enum(["WARN", "CRIT"]);
export type CruxAlertSeverity = z.infer<typeof CruxAlertSeveritySchema>;

/** Alert state machine values. */
export const CruxAlertStateSchema = z.enum(["OPEN", "STILL_OPEN", "RESOLVED"]);
export type CruxAlertState = z.infer<typeof CruxAlertStateSchema>;

/** Detector kind : `absolute` = seuils Google ; `delta` = Δ% rolling baseline. */
export const CruxAlertDetectorSchema = z.enum(["absolute", "delta"]);
export type CruxAlertDetector = z.infer<typeof CruxAlertDetectorSchema>;

// ─── DB row schemas ──────────────────────────────────────────────────────

/**
 * One row of `__seo_crux_field_history` — one (origin, url_key, form_factor,
 * collection_period_end_date) tuple.
 *
 * `url_key` n'est PAS exposé côté API (généré côté DB depuis `url`). Les
 * consumers travaillent toujours avec `url: string | null`.
 */
export const CruxFieldHistoryRowSchema = z.object({
  origin: z.string().url(),
  url: z.string().url().nullable(),
  form_factor: CruxFormFactorSchema,
  /** ISO date string YYYY-MM-DD */
  collection_period_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** ISO date string YYYY-MM-DD */
  collection_period_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Largest Contentful Paint p75 (ms). */
  p75_lcp_ms: z.number().int().nonnegative().nullable(),
  /** Interaction to Next Paint p75 (ms). */
  p75_inp_ms: z.number().int().nonnegative().nullable(),
  /** Cumulative Layout Shift p75 (unitless). */
  p75_cls: z.number().nonnegative().nullable(),
  /** Time to First Byte p75 (ms). */
  p75_ttfb_ms: z.number().int().nonnegative().nullable(),
  /** First Contentful Paint p75 (ms). */
  p75_fcp_ms: z.number().int().nonnegative().nullable(),
  /** ISO timestamp. */
  fetched_at: z.string(),
  source_api: CruxSourceApiSchema.default("history"),
});
export type CruxFieldHistoryRow = z.infer<typeof CruxFieldHistoryRowSchema>;

/** One row of `__seo_crux_alert_state`. */
export const CruxAlertStateRowSchema = z.object({
  origin: z.string().url(),
  url: z.string().url().nullable(),
  form_factor: CruxFormFactorSchema,
  metric: CruxMetricKeySchema,
  state: CruxAlertStateSchema,
  severity: CruxAlertSeveritySchema,
  detector: CruxAlertDetectorSchema,
  /** ISO timestamp — first OPEN transition. */
  opened_at: z.string(),
  /** ISO timestamp — last sink emission. */
  last_emitted_at: z.string(),
  /** ISO timestamp — RESOLVED transition (null if still open). */
  resolved_at: z.string().nullable(),
  /** Last observed p75 (or CLS) value at the time of last detector run. */
  last_observed_value: z.number().nullable(),
  /** Median of the trailing-4-periods used by the delta detector. */
  last_baseline_median: z.number().nullable(),
  /** Δ% relative to baseline (NULL for absolute detector). */
  last_delta_pct: z.number().nullable(),
});
export type CruxAlertStateRow = z.infer<typeof CruxAlertStateRowSchema>;

// ─── CrUX API request/response shapes ─────────────────────────────────────

/**
 * History API request body (POST /v1/records:queryHistoryRecord).
 * Body uses either `origin` OR `url`, never both (CrUX API constraint).
 * V1 uses `collectionPeriodCount: 40` (~9 months hebdo).
 */
export const CruxHistoryRequestOriginSchema = z.object({
  origin: z.string().url(),
  formFactor: CruxFormFactorSchema.optional(),
  metrics: z.array(z.string()).min(1),
  collectionPeriodCount: z.number().int().min(1).max(40).default(40),
});
export type CruxHistoryRequestOrigin = z.infer<typeof CruxHistoryRequestOriginSchema>;

export const CruxHistoryRequestUrlSchema = z.object({
  url: z.string().url(),
  formFactor: CruxFormFactorSchema.optional(),
  metrics: z.array(z.string()).min(1),
  collectionPeriodCount: z.number().int().min(1).max(40).default(40),
});
export type CruxHistoryRequestUrl = z.infer<typeof CruxHistoryRequestUrlSchema>;

/**
 * History API timeseries metric — array of p75 values, one per collection
 * period. NULL values mean the metric was not reportable for that period
 * (e.g. insufficient sample).
 */
export const CruxTimeseriesMetricSchema = z.object({
  percentilesTimeseries: z.object({
    p75s: z.array(z.union([z.number(), z.string(), z.null()])),
  }),
});
export type CruxTimeseriesMetric = z.infer<typeof CruxTimeseriesMetricSchema>;

/**
 * History API collection period — start/end date pair. CrUX returns up to
 * `collectionPeriodCount` of these in `collectionPeriods` array.
 */
export const CruxCollectionPeriodSchema = z.object({
  firstDate: z.object({
    year: z.number().int(),
    month: z.number().int(),
    day: z.number().int(),
  }),
  lastDate: z.object({
    year: z.number().int(),
    month: z.number().int(),
    day: z.number().int(),
  }),
});
export type CruxCollectionPeriod = z.infer<typeof CruxCollectionPeriodSchema>;

/**
 * History API response (queryHistoryRecord). `record.metrics` is keyed by
 * CrUX metric name (e.g. `largest_contentful_paint`, `interaction_to_next_paint`,
 * `cumulative_layout_shift`, `experimental_time_to_first_byte`, `first_contentful_paint`).
 */
export const CruxHistoryResponseSchema = z.object({
  record: z.object({
    key: z.object({
      origin: z.string().optional(),
      url: z.string().optional(),
      formFactor: CruxFormFactorSchema.optional(),
    }),
    metrics: z.record(z.string(), CruxTimeseriesMetricSchema),
    collectionPeriods: z.array(CruxCollectionPeriodSchema),
  }),
  urlNormalizationDetails: z
    .object({
      originalUrl: z.string(),
      normalizedUrl: z.string(),
    })
    .optional(),
});
export type CruxHistoryResponse = z.infer<typeof CruxHistoryResponseSchema>;

// ─── Admin API timeseries endpoint shape ──────────────────────────────────

/**
 * Query params for `GET /api/admin/seo-monitoring/timeseries/crux`.
 * Both `origin` and `url` are mutually exclusive — endpoint enforces it.
 */
export const CruxTimeseriesQuerySchema = z
  .object({
    /** Lookback window in days (default 180 ≈ 26 weeks). */
    days: z.coerce.number().int().positive().max(365).default(180),
    /** Origin-level lookup. */
    origin: z.string().url().optional(),
    /** URL-level lookup (mutually exclusive with `origin`). */
    url: z.string().url().optional(),
    /** Form factor filter (defaults to PHONE). */
    formFactor: CruxFormFactorSchema.default("PHONE"),
  })
  .refine((data) => !(data.origin && data.url), {
    message: "origin and url are mutually exclusive",
    path: ["url"],
  })
  .refine((data) => data.origin || data.url, {
    message: "either origin or url is required",
    path: ["origin"],
  });
export type CruxTimeseriesQuery = z.infer<typeof CruxTimeseriesQuerySchema>;

/** Response shape — paginated list of history rows. */
export const CruxTimeseriesResponseSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origin: z.string().url().nullable(),
  url: z.string().url().nullable(),
  form_factor: CruxFormFactorSchema,
  rows: z.array(CruxFieldHistoryRowSchema),
});
export type CruxTimeseriesResponse = z.infer<typeof CruxTimeseriesResponseSchema>;

// ─── Thresholds (Google Web Vitals canonical) ─────────────────────────────

/**
 * Google Web Vitals absolute thresholds — official values from
 * https://web.dev/articles/vitals (validated 2026-05-14).
 *
 * `WARN` = "needs improvement" lower bound, `CRIT` = "poor" lower bound.
 * The detector raises WARN if p75 ≥ WARN threshold, CRIT if ≥ CRIT.
 */
export const CRUX_ABSOLUTE_THRESHOLDS = {
  lcp: { warn_ms: 2500, crit_ms: 4000 },
  inp: { warn_ms: 200, crit_ms: 500 },
  cls: { warn: 0.1, crit: 0.25 },
} as const;

/**
 * Δ% relative thresholds for the `delta` detector (V1 origin-level only).
 * Compared against `median(trailing 4 periods)`. The detector also enforces
 * a minimum absolute delta to avoid noise on small baselines.
 */
export const CRUX_DELTA_THRESHOLDS = {
  lcp: { warn_pct: 15, warn_min_ms: 200, crit_pct: 30, crit_min_ms: 400 },
  inp: { warn_pct: 15, warn_min_ms: 30, crit_pct: 30, crit_min_ms: 60 },
  cls: { warn_pct: 15, warn_min: 0.02, crit_pct: 30, crit_min: 0.05 },
} as const;
