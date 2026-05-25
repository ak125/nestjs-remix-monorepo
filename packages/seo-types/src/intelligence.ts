/**
 * Intelligence — Zod schemas for unified event log + anomaly detection + alerting.
 *
 * Backed by single Postgres table `__seo_event_log` (replaces 3 originally proposed:
 * anomalies, alerts_log, monitoring_runs). Discrimination by `event_type` ENUM
 * + typed `payload` per variant.
 */
import { z } from "zod";
import { SeveritySchema } from "./onpage.js";

// ─── Discriminator ────────────────────────────────────────────────────────

export const EventTypeSchema = z.enum([
  "anomaly_detected",
  "alert_sent",
  "ingestion_run_started",
  "ingestion_run_completed",
  "ingestion_run_failed",
  "forecast_generated",
  "digest_sent",
  // Commerce-Loop V1 — funnel de l'outil diagnostic → commande (étape 4-A).
  // Mirror: migration 20260521_seo_event_funnel_enum.sql.
  "diag_hub_view",
  "diag_wizard_start",
  "diag_analyze_complete",
  "diag_gamme_cta_click",
  "r2_view",
  "r2_add_to_cart",
  "r2_order_placed",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ─── Funnel enums (étape 4-A) ───────────────────────────────────────────────

/** Device bucket — le drop-off mobile est un suspect prioritaire (Reality Audit). */
export const FunnelDeviceSchema = z.enum(["mobile", "desktop", "tablet", "unknown"]);
export type FunnelDevice = z.infer<typeof FunnelDeviceSchema>;

/** Porte d'entrée du parcours produit — rend les events r2_* entry-agnostic. */
export const FunnelReferrerSchema = z.enum([
  "diagnostic",
  "organic",
  "internal",
  "direct",
  "paid",
  "other",
]);
export type FunnelReferrer = z.infer<typeof FunnelReferrerSchema>;

/** Score de confiance d'une gamme suggérée par le moteur diagnostic. */
export const FunnelConfidenceSchema = z.enum(["high", "medium", "low"]);
export type FunnelConfidence = z.infer<typeof FunnelConfidenceSchema>;

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

// ─── Funnel payload variants (étape 4-A) ────────────────────────────────────
// session_id stitche les marches du funnel pour un même visiteur.

export const DiagHubViewPayloadSchema = z.object({
  session_id: z.string().min(1),
  referrer_source: FunnelReferrerSchema.optional(),
  device: FunnelDeviceSchema.default("unknown"),
});
export type DiagHubViewPayload = z.infer<typeof DiagHubViewPayloadSchema>;

export const DiagWizardStartPayloadSchema = z.object({
  session_id: z.string().min(1),
  device: FunnelDeviceSchema.default("unknown"),
});
export type DiagWizardStartPayload = z.infer<typeof DiagWizardStartPayloadSchema>;

export const DiagAnalyzeCompletePayloadSchema = z.object({
  session_id: z.string().min(1),
  hypothesis_count: z.number().int().nonnegative(),
  has_suggested_gammes: z.boolean(),
  vehicle_known: z.boolean(),
});
export type DiagAnalyzeCompletePayload = z.infer<typeof DiagAnalyzeCompletePayloadSchema>;

export const DiagGammeCtaClickPayloadSchema = z.object({
  session_id: z.string().min(1),
  gamme_slug: z.string().min(1),
  confidence: FunnelConfidenceSchema.nullable(),
});
export type DiagGammeCtaClickPayload = z.infer<typeof DiagGammeCtaClickPayloadSchema>;

export const R2ViewPayloadSchema = z.object({
  session_id: z.string().min(1),
  referrer: FunnelReferrerSchema,
  gamme_slug: z.string().nullable(),
});
export type R2ViewPayload = z.infer<typeof R2ViewPayloadSchema>;

export const R2AddToCartPayloadSchema = z.object({
  session_id: z.string().min(1),
  product_id: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price_cents: z.number().int().nonnegative().nullable(),
  // Page d'où l'add_to_cart a été émis (pathname + search), pour corréler
  // page source → panier en runtime (investigation 2026-05-25).
  source_url: z.string().nullable().optional(),
});
export type R2AddToCartPayload = z.infer<typeof R2AddToCartPayloadSchema>;

export const R2OrderPlacedPayloadSchema = z.object({
  session_id: z.string().min(1).nullable(),
  order_id: z.string().min(1),
  item_count: z.number().int().positive(),
  revenue_cents: z.number().int().nonnegative().nullable(),
  referrer: FunnelReferrerSchema.nullable(),
});
export type R2OrderPlacedPayload = z.infer<typeof R2OrderPlacedPayloadSchema>;

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
  // ─── Funnel outil diagnostic (étape 4-A) — entity_url = URL de la page émettrice.
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("diag_hub_view"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: DiagHubViewPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("diag_wizard_start"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: DiagWizardStartPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("diag_analyze_complete"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: DiagAnalyzeCompletePayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("diag_gamme_cta_click"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: DiagGammeCtaClickPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("r2_view"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: R2ViewPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("r2_add_to_cart"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: R2AddToCartPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
  z.object({
    id: z.string().uuid().optional(),
    event_type: z.literal("r2_order_placed"),
    entity_url: z.string().url().nullable(),
    severity: SeveritySchema,
    payload: R2OrderPlacedPayloadSchema,
    created_at: z.string().datetime(),
    ack_at: z.null(),
    resolved_at: z.null(),
  }),
]);
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

// ─── Funnel event INPUT contract (étape 4-A) ────────────────────────────────
// Contrat public posté par le beacon frontend → POST /api/seo/funnel/event.
// Le serveur fixe severity='info' + created_at ; le client ne fournit que
// event_type (∈ funnel) + payload typé + entity_url optionnel (URL page).

const funnelInput = <T extends z.ZodTypeAny>(
  eventType:
    | "diag_hub_view"
    | "diag_wizard_start"
    | "diag_analyze_complete"
    | "diag_gamme_cta_click"
    | "r2_view"
    | "r2_add_to_cart"
    | "r2_order_placed",
  payload: T,
) =>
  z.object({
    event_type: z.literal(eventType),
    entity_url: z.string().url().nullable().optional(),
    payload,
  });

export const FunnelEventInputSchema = z.discriminatedUnion("event_type", [
  funnelInput("diag_hub_view", DiagHubViewPayloadSchema),
  funnelInput("diag_wizard_start", DiagWizardStartPayloadSchema),
  funnelInput("diag_analyze_complete", DiagAnalyzeCompletePayloadSchema),
  funnelInput("diag_gamme_cta_click", DiagGammeCtaClickPayloadSchema),
  funnelInput("r2_view", R2ViewPayloadSchema),
  funnelInput("r2_add_to_cart", R2AddToCartPayloadSchema),
  funnelInput("r2_order_placed", R2OrderPlacedPayloadSchema),
]);
export type FunnelEventInput = z.infer<typeof FunnelEventInputSchema>;

/** Liste des event_type funnel — utile pour filtrer le dashboard. */
export const FUNNEL_EVENT_TYPES = [
  "diag_hub_view",
  "diag_wizard_start",
  "diag_analyze_complete",
  "diag_gamme_cta_click",
  "r2_view",
  "r2_add_to_cart",
  "r2_order_placed",
] as const;
