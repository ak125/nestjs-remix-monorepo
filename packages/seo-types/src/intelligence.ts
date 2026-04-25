/**
 * Intelligence — Zod schemas for unified event log + anomaly detection + alerting.
 *
 * Backed by single Postgres table `__seo_event_log` (replaces 3 originally proposed:
 * anomalies, alerts_log, monitoring_runs). Discrimination by `event_type` ENUM
 * + typed `payload` per variant.
 */
import { z } from "zod";
import { SeveritySchema } from "./onpage";

// ─── Discriminator ────────────────────────────────────────────────────────

export const EventTypeSchema = z.enum([
  "anomaly_detected",
  "alert_sent",
  "ingestion_run_started",
  "ingestion_run_completed",
  "ingestion_run_failed",
  "forecast_generated",
  "digest_sent",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ─── Payload variants ─────────────────────────────────────────────────────

export const AnomalyDetectedPayloadSchema = z.object({
  metric: z.enum([
    "clicks",
    "impressions",
    "ctr",
    "position",
    "sessions",
    "conversions",
    "lcp",
    "cls",
    "inp",
  ]),
  page: z.string().url(),
  baseline_value: z.number(),
  observed_value: z.number(),
  baseline_window_days: z.number().int().positive(),
  z_score: z.number(),
  delta_pct: z.number(),
  detector: z.enum(["rolling_zscore", "seasonal_decompose", "prophet"]),
});
export type AnomalyDetectedPayload = z.infer<typeof AnomalyDetectedPayloadSchema>;

export const AlertSentPayloadSchema = z.object({
  alert_id: z.string().uuid(),
  channel: z.enum(["email", "slack", "discord", "webhook"]),
  recipient: z.string(),
  subject: z.string(),
  trigger: z.enum([
    "anomaly_threshold",
    "regression_position",
    "regression_traffic",
    "indexation_drop",
    "schema_critical",
    "weekly_digest",
  ]),
  related_event_id: z.string().uuid().nullable(),
});
export type AlertSentPayload = z.infer<typeof AlertSentPayloadSchema>;

export const IngestionRunStartedPayloadSchema = z.object({
  run_id: z.string().uuid(),
  source: z.enum(["gsc", "ga4", "cwv", "gsc_links", "indexation"]),
  scope: z.string(),
  expected_pages: z.number().int().nullable(),
});
export type IngestionRunStartedPayload = z.infer<typeof IngestionRunStartedPayloadSchema>;

export const IngestionRunCompletedPayloadSchema = z.object({
  run_id: z.string().uuid(),
  source: z.enum(["gsc", "ga4", "cwv", "gsc_links", "indexation"]),
  rows_inserted: z.number().int().nonnegative(),
  rows_updated: z.number().int().nonnegative(),
  duration_seconds: z.number().nonnegative(),
  api_calls: z.number().int().nonnegative(),
  warnings: z.array(z.string()).optional(),
});
export type IngestionRunCompletedPayload = z.infer<typeof IngestionRunCompletedPayloadSchema>;

export const IngestionRunFailedPayloadSchema = z.object({
  run_id: z.string().uuid(),
  source: z.enum(["gsc", "ga4", "cwv", "gsc_links", "indexation"]),
  error_class: z.enum([
    "quota_exceeded",
    "auth_failure",
    "network",
    "schema_drift",
    "db_constraint",
    "unknown",
  ]),
  error_message: z.string(),
  partial_rows_inserted: z.number().int().nonnegative(),
  retry_scheduled: z.boolean(),
});
export type IngestionRunFailedPayload = z.infer<typeof IngestionRunFailedPayloadSchema>;

export const ForecastGeneratedPayloadSchema = z.object({
  page: z.string().url(),
  metric: z.enum(["clicks", "sessions", "conversions"]),
  horizon_days: z.number().int().positive(),
  predicted_values: z.array(
    z.object({
      date: z.string(),
      value: z.number(),
      lower_ci: z.number(),
      upper_ci: z.number(),
    }),
  ),
  model: z.enum(["moving_average", "prophet", "exponential_smoothing"]),
});
export type ForecastGeneratedPayload = z.infer<typeof ForecastGeneratedPayloadSchema>;

export const DigestSentPayloadSchema = z.object({
  digest_period: z.enum(["daily", "weekly", "monthly"]),
  sent_to: z.string(),
  top_wins_count: z.number().int().nonnegative(),
  top_losses_count: z.number().int().nonnegative(),
  anomalies_count: z.number().int().nonnegative(),
});
export type DigestSentPayload = z.infer<typeof DigestSentPayloadSchema>;

// ─── Discriminated union ─────────────────────────────────────────────────

/** One event log row. Mirrors __seo_event_log table. */
export const EventLogEntrySchema = z.discriminatedUnion("event_type", [
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("anomaly_detected"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: AnomalyDetectedPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.string().datetime().nullable(),
    resolved_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("alert_sent"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: AlertSentPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.string().datetime().nullable(),
    resolved_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("ingestion_run_started"),
    entity_url: z.null(),
    severity: SeveritySchema,
    payload: IngestionRunStartedPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("ingestion_run_completed"),
    entity_url: z.null(),
    severity: SeveritySchema,
    payload: IngestionRunCompletedPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("ingestion_run_failed"),
    entity_url: z.null(),
    severity: SeveritySchema,
    payload: IngestionRunFailedPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.string().datetime().nullable(),
    resolved_at: z.string().datetime().nullable(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("forecast_generated"),
    entity_url: z.string().url(),
    severity: SeveritySchema,
    payload: ForecastGeneratedPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("digest_sent"),
    entity_url: z.null(),
    severity: SeveritySchema,
    payload: DigestSentPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
]);
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;
