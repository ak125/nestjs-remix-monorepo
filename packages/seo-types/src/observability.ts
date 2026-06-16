/**
 * Observability — Zod schemas for GSC, GA4, CWV, indexation, GSC Links.
 *
 * Backed by 4 Postgres time-series tables (partitioned monthly) :
 *  - __seo_gsc_daily
 *  - __seo_ga4_daily
 *  - __seo_cwv_daily
 *  - __seo_gsc_links_weekly
 *
 * Plus extension on existing __seo_index_status (no new table for index state).
 */
import { z } from "zod";

// ─── GSC Search Analytics ─────────────────────────────────────────────────

/** One row of GSC daily data — one (date, page, query, device) tuple. */
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
export type GSCDailyRow = z.infer<typeof GSCDailyRowSchema>;

/** Aggregated GSC timeseries response from API endpoint. */
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
export type GSCTimeseriesResponse = z.infer<typeof GSCTimeseriesResponseSchema>;

// ─── GSC multi-grain (PR1 — ingestion fidèle, anti-anonymisation) ──────────
//
// `__seo_gsc_daily` (date+page+query+device) sous-capture ~4× les totaux car la
// dimension `query` déclenche l'anonymisation Google. On NE dérive PAS un total
// d'un grain page/query. 3 grains explicites (1 table/grain → les RPC ne
// mélangent jamais les grains), cf. 20260613_seo_gsc_multilevel_grains.sql.

const GSC_ISO_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD");
const GSC_DEVICE = z
  .enum(["all", "mobile", "desktop", "tablet"])
  .default("all");
/**
 * GSC country = ISO-3166-1 alpha-3 lowercase (ex. "fra"). "zzz" = inconnu.
 * Permissif (string) — l'API peut renvoyer des codes hors-liste ; le contrat
 * absorbe sans casser (cf. philosophie GA4_CHANNEL_CANON ci-dessous).
 */
const GSC_COUNTRY = z.string().min(2).max(8).default("zzz");

/** Grain GLOBAL : date seule (aucune dimension) → volume le plus complet. */
export const GSCDailyPropertyTotalRowSchema = z.object({
  date: GSC_ISO_DATE,
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number().min(0).max(1),
  position: z.number().min(0),
});
export type GSCDailyPropertyTotalRow = z.infer<
  typeof GSCDailyPropertyTotalRowSchema
>;

/** Grain SEGMENTÉ : date+country+device (sans page ni query). */
export const GSCDailyTotalsRowSchema = z.object({
  date: GSC_ISO_DATE,
  country: GSC_COUNTRY,
  device: GSC_DEVICE,
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number().min(0).max(1),
  position: z.number().min(0),
});
export type GSCDailyTotalsRow = z.infer<typeof GSCDailyTotalsRowSchema>;

/** Grain PAGE : date+page+country+device (sans query) → réactions par URL. */
export const GSCDailyPagesRowSchema = z.object({
  date: GSC_ISO_DATE,
  page: z.string().url(),
  country: GSC_COUNTRY,
  device: GSC_DEVICE,
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number().min(0).max(1),
  position: z.number().min(0),
});
export type GSCDailyPagesRow = z.infer<typeof GSCDailyPagesRowSchema>;

/** Grain de couverture GSC (date seule en sortie de l'API, dim `date`). */
export const GSC_GRAIN = ["property_total", "totals", "pages", "queries"] as const;
export type GscGrain = (typeof GSC_GRAIN)[number];

// ─── GA4 Data API ────────────────────────────────────────────────────────

/**
 * GA4 `sessionDefaultChannelGroup` canonical values (lowercased).
 *
 * Reference: GA4 Default channel group, 19 standard values returned by the
 * Data API dimension `sessionDefaultChannelGroup`. The fetcher service
 * (`ga4-daily-fetcher.service.ts:133`) lowercases the value before insert,
 * so this canon mirrors that normalization.
 *
 * Schema below stays permissive (`z.string()`) to absorb new channels GA4
 * may add over time — this const is the documented expectation, not a
 * runtime enum gate. Consumers wanting strict validation can build a
 * `z.enum(GA4_CHANNEL_CANON)` schema locally.
 */
export const GA4_CHANNEL_CANON = [
  "direct",
  "organic search",
  "paid search",
  "display",
  "paid social",
  "organic social",
  "referral",
  "email",
  "affiliates",
  "audio",
  "video",
  "cross-network",
  "sms",
  "mobile push notifications",
  "unassigned",
  "organic shopping",
  "paid shopping",
  "paid other",
  "organic video",
] as const;
export type GA4ChannelCanon = (typeof GA4_CHANNEL_CANON)[number];

/** One row of GA4 daily data — one (date, page, channel) tuple. */
export const GA4DailyRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  page: z.string().url(),
  /**
   * GA4 default channel group, lowercased by the fetcher. Not enum-gated
   * because GA4 may add new channels (e.g. "audio" was added 2024). See
   * `GA4_CHANNEL_CANON` for the documented expected values.
   */
  channel: z.string().default("organic"),
  sessions: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  bounce_rate: z.number().min(0).max(1).nullable(),
  avg_session_duration: z.number().nonnegative().nullable(),
});
export type GA4DailyRow = z.infer<typeof GA4DailyRowSchema>;

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
export type GA4TimeseriesResponse = z.infer<typeof GA4TimeseriesResponseSchema>;

// ─── Core Web Vitals (PageSpeed Insights + Chrome UX Report) ─────────────

/** CWV daily row — sample top 1k pages, not 50k full. */
export const CWVDailyRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  page: z.string().url(),
  /** Largest Contentful Paint (ms) */
  lcp: z.number().nonnegative().nullable(),
  /** First Input Delay (ms) — deprecated, kept for backward compat */
  fid: z.number().nonnegative().nullable(),
  /** Cumulative Layout Shift (unitless) */
  cls: z.number().nonnegative().nullable(),
  /** Interaction to Next Paint (ms) — replaces FID since Mar 2024 */
  inp: z.number().nonnegative().nullable(),
  /** Time to First Byte (ms) */
  ttfb: z.number().nonnegative().nullable(),
});
export type CWVDailyRow = z.infer<typeof CWVDailyRowSchema>;

// ─── GSC Links (free backlinks via GSC) ───────────────────────────────────

export const GSCLinkSchema = z.object({
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_domain: z.string(),
  source_url: z.string().url(),
  target_url: z.string().url(),
  anchor_text: z.string().nullable(),
});
export type GSCLink = z.infer<typeof GSCLinkSchema>;

// ─── Indexation Status (extends existing __seo_index_status) ──────────────

/** Already in DB via 20260123_seo_enterprise_dashboard.sql:10 — schema mirror. */
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
export type IndexationStatus = z.infer<typeof IndexationStatusSchema>;
