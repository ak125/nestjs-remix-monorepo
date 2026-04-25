import { z } from "zod";
export declare const EventTypeSchema: z.ZodEnum<["anomaly_detected", "alert_sent", "ingestion_run_started", "ingestion_run_completed", "ingestion_run_failed", "forecast_generated", "digest_sent"]>;
export type EventType = z.infer<typeof EventTypeSchema>;
export declare const AnomalyDetectedPayloadSchema: z.ZodObject<{
    metric: z.ZodEnum<["clicks", "impressions", "ctr", "position", "sessions", "conversions", "lcp", "cls", "inp"]>;
    page: z.ZodString;
    baseline_value: z.ZodNumber;
    observed_value: z.ZodNumber;
    baseline_window_days: z.ZodNumber;
    z_score: z.ZodNumber;
    delta_pct: z.ZodNumber;
    detector: z.ZodEnum<["rolling_zscore", "seasonal_decompose", "prophet"]>;
}, "strip", z.ZodTypeAny, {
    page: string;
    metric: "clicks" | "impressions" | "ctr" | "position" | "sessions" | "conversions" | "lcp" | "cls" | "inp";
    baseline_value: number;
    observed_value: number;
    baseline_window_days: number;
    z_score: number;
    delta_pct: number;
    detector: "rolling_zscore" | "seasonal_decompose" | "prophet";
}, {
    page: string;
    metric: "clicks" | "impressions" | "ctr" | "position" | "sessions" | "conversions" | "lcp" | "cls" | "inp";
    baseline_value: number;
    observed_value: number;
    baseline_window_days: number;
    z_score: number;
    delta_pct: number;
    detector: "rolling_zscore" | "seasonal_decompose" | "prophet";
}>;
export type AnomalyDetectedPayload = z.infer<typeof AnomalyDetectedPayloadSchema>;
export declare const AlertSentPayloadSchema: z.ZodObject<{
    alert_id: z.ZodString;
    channel: z.ZodEnum<["email", "slack", "discord", "webhook"]>;
    recipient: z.ZodString;
    subject: z.ZodString;
    trigger: z.ZodEnum<["anomaly_threshold", "regression_position", "regression_traffic", "indexation_drop", "schema_critical", "weekly_digest"]>;
    related_event_id: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    alert_id: string;
    channel: "email" | "slack" | "discord" | "webhook";
    recipient: string;
    subject: string;
    trigger: "anomaly_threshold" | "regression_position" | "regression_traffic" | "indexation_drop" | "schema_critical" | "weekly_digest";
    related_event_id: string | null;
}, {
    alert_id: string;
    channel: "email" | "slack" | "discord" | "webhook";
    recipient: string;
    subject: string;
    trigger: "anomaly_threshold" | "regression_position" | "regression_traffic" | "indexation_drop" | "schema_critical" | "weekly_digest";
    related_event_id: string | null;
}>;
export type AlertSentPayload = z.infer<typeof AlertSentPayloadSchema>;
export declare const IngestionRunStartedPayloadSchema: z.ZodObject<{
    run_id: z.ZodString;
    source: z.ZodEnum<["gsc", "ga4", "cwv", "gsc_links", "indexation"]>;
    scope: z.ZodString;
    expected_pages: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    run_id: string;
    source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
    scope: string;
    expected_pages: number | null;
}, {
    run_id: string;
    source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
    scope: string;
    expected_pages: number | null;
}>;
export type IngestionRunStartedPayload = z.infer<typeof IngestionRunStartedPayloadSchema>;
export declare const IngestionRunCompletedPayloadSchema: z.ZodObject<{
    run_id: z.ZodString;
    source: z.ZodEnum<["gsc", "ga4", "cwv", "gsc_links", "indexation"]>;
    rows_inserted: z.ZodNumber;
    rows_updated: z.ZodNumber;
    duration_seconds: z.ZodNumber;
    api_calls: z.ZodNumber;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    run_id: string;
    source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
    rows_inserted: number;
    rows_updated: number;
    duration_seconds: number;
    api_calls: number;
    warnings?: string[] | undefined;
}, {
    run_id: string;
    source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
    rows_inserted: number;
    rows_updated: number;
    duration_seconds: number;
    api_calls: number;
    warnings?: string[] | undefined;
}>;
export type IngestionRunCompletedPayload = z.infer<typeof IngestionRunCompletedPayloadSchema>;
export declare const IngestionRunFailedPayloadSchema: z.ZodObject<{
    run_id: z.ZodString;
    source: z.ZodEnum<["gsc", "ga4", "cwv", "gsc_links", "indexation"]>;
    error_class: z.ZodEnum<["quota_exceeded", "auth_failure", "network", "schema_drift", "db_constraint", "unknown"]>;
    error_message: z.ZodString;
    partial_rows_inserted: z.ZodNumber;
    retry_scheduled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    run_id: string;
    source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
    error_class: "unknown" | "quota_exceeded" | "auth_failure" | "network" | "schema_drift" | "db_constraint";
    error_message: string;
    partial_rows_inserted: number;
    retry_scheduled: boolean;
}, {
    run_id: string;
    source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
    error_class: "unknown" | "quota_exceeded" | "auth_failure" | "network" | "schema_drift" | "db_constraint";
    error_message: string;
    partial_rows_inserted: number;
    retry_scheduled: boolean;
}>;
export type IngestionRunFailedPayload = z.infer<typeof IngestionRunFailedPayloadSchema>;
export declare const ForecastGeneratedPayloadSchema: z.ZodObject<{
    page: z.ZodString;
    metric: z.ZodEnum<["clicks", "sessions", "conversions"]>;
    horizon_days: z.ZodNumber;
    predicted_values: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        value: z.ZodNumber;
        lower_ci: z.ZodNumber;
        upper_ci: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: number;
        date: string;
        lower_ci: number;
        upper_ci: number;
    }, {
        value: number;
        date: string;
        lower_ci: number;
        upper_ci: number;
    }>, "many">;
    model: z.ZodEnum<["moving_average", "prophet", "exponential_smoothing"]>;
}, "strip", z.ZodTypeAny, {
    page: string;
    metric: "clicks" | "sessions" | "conversions";
    horizon_days: number;
    predicted_values: {
        value: number;
        date: string;
        lower_ci: number;
        upper_ci: number;
    }[];
    model: "prophet" | "moving_average" | "exponential_smoothing";
}, {
    page: string;
    metric: "clicks" | "sessions" | "conversions";
    horizon_days: number;
    predicted_values: {
        value: number;
        date: string;
        lower_ci: number;
        upper_ci: number;
    }[];
    model: "prophet" | "moving_average" | "exponential_smoothing";
}>;
export type ForecastGeneratedPayload = z.infer<typeof ForecastGeneratedPayloadSchema>;
export declare const DigestSentPayloadSchema: z.ZodObject<{
    digest_period: z.ZodEnum<["daily", "weekly", "monthly"]>;
    sent_to: z.ZodString;
    top_wins_count: z.ZodNumber;
    top_losses_count: z.ZodNumber;
    anomalies_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    digest_period: "daily" | "weekly" | "monthly";
    sent_to: string;
    top_wins_count: number;
    top_losses_count: number;
    anomalies_count: number;
}, {
    digest_period: "daily" | "weekly" | "monthly";
    sent_to: string;
    top_wins_count: number;
    top_losses_count: number;
    anomalies_count: number;
}>;
export type DigestSentPayload = z.infer<typeof DigestSentPayloadSchema>;
export declare const EventLogEntrySchema: z.ZodDiscriminatedUnion<"event_type", [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"anomaly_detected">;
    entity_url: z.ZodNullable<z.ZodString>;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        metric: z.ZodEnum<["clicks", "impressions", "ctr", "position", "sessions", "conversions", "lcp", "cls", "inp"]>;
        page: z.ZodString;
        baseline_value: z.ZodNumber;
        observed_value: z.ZodNumber;
        baseline_window_days: z.ZodNumber;
        z_score: z.ZodNumber;
        delta_pct: z.ZodNumber;
        detector: z.ZodEnum<["rolling_zscore", "seasonal_decompose", "prophet"]>;
    }, "strip", z.ZodTypeAny, {
        page: string;
        metric: "clicks" | "impressions" | "ctr" | "position" | "sessions" | "conversions" | "lcp" | "cls" | "inp";
        baseline_value: number;
        observed_value: number;
        baseline_window_days: number;
        z_score: number;
        delta_pct: number;
        detector: "rolling_zscore" | "seasonal_decompose" | "prophet";
    }, {
        page: string;
        metric: "clicks" | "impressions" | "ctr" | "position" | "sessions" | "conversions" | "lcp" | "cls" | "inp";
        baseline_value: number;
        observed_value: number;
        baseline_window_days: number;
        z_score: number;
        delta_pct: number;
        detector: "rolling_zscore" | "seasonal_decompose" | "prophet";
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNullable<z.ZodString>;
    resolved_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "anomaly_detected";
    entity_url: string | null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        page: string;
        metric: "clicks" | "impressions" | "ctr" | "position" | "sessions" | "conversions" | "lcp" | "cls" | "inp";
        baseline_value: number;
        observed_value: number;
        baseline_window_days: number;
        z_score: number;
        delta_pct: number;
        detector: "rolling_zscore" | "seasonal_decompose" | "prophet";
    };
    ack_at: string | null;
    resolved_at: string | null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "anomaly_detected";
    entity_url: string | null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        page: string;
        metric: "clicks" | "impressions" | "ctr" | "position" | "sessions" | "conversions" | "lcp" | "cls" | "inp";
        baseline_value: number;
        observed_value: number;
        baseline_window_days: number;
        z_score: number;
        delta_pct: number;
        detector: "rolling_zscore" | "seasonal_decompose" | "prophet";
    };
    ack_at: string | null;
    resolved_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"alert_sent">;
    entity_url: z.ZodNullable<z.ZodString>;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        alert_id: z.ZodString;
        channel: z.ZodEnum<["email", "slack", "discord", "webhook"]>;
        recipient: z.ZodString;
        subject: z.ZodString;
        trigger: z.ZodEnum<["anomaly_threshold", "regression_position", "regression_traffic", "indexation_drop", "schema_critical", "weekly_digest"]>;
        related_event_id: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        alert_id: string;
        channel: "email" | "slack" | "discord" | "webhook";
        recipient: string;
        subject: string;
        trigger: "anomaly_threshold" | "regression_position" | "regression_traffic" | "indexation_drop" | "schema_critical" | "weekly_digest";
        related_event_id: string | null;
    }, {
        alert_id: string;
        channel: "email" | "slack" | "discord" | "webhook";
        recipient: string;
        subject: string;
        trigger: "anomaly_threshold" | "regression_position" | "regression_traffic" | "indexation_drop" | "schema_critical" | "weekly_digest";
        related_event_id: string | null;
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNullable<z.ZodString>;
    resolved_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "alert_sent";
    entity_url: string | null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        alert_id: string;
        channel: "email" | "slack" | "discord" | "webhook";
        recipient: string;
        subject: string;
        trigger: "anomaly_threshold" | "regression_position" | "regression_traffic" | "indexation_drop" | "schema_critical" | "weekly_digest";
        related_event_id: string | null;
    };
    ack_at: string | null;
    resolved_at: string | null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "alert_sent";
    entity_url: string | null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        alert_id: string;
        channel: "email" | "slack" | "discord" | "webhook";
        recipient: string;
        subject: string;
        trigger: "anomaly_threshold" | "regression_position" | "regression_traffic" | "indexation_drop" | "schema_critical" | "weekly_digest";
        related_event_id: string | null;
    };
    ack_at: string | null;
    resolved_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"ingestion_run_started">;
    entity_url: z.ZodNull;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        run_id: z.ZodString;
        source: z.ZodEnum<["gsc", "ga4", "cwv", "gsc_links", "indexation"]>;
        scope: z.ZodString;
        expected_pages: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        scope: string;
        expected_pages: number | null;
    }, {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        scope: string;
        expected_pages: number | null;
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNull;
    resolved_at: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "ingestion_run_started";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        scope: string;
        expected_pages: number | null;
    };
    ack_at: null;
    resolved_at: null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "ingestion_run_started";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        scope: string;
        expected_pages: number | null;
    };
    ack_at: null;
    resolved_at: null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"ingestion_run_completed">;
    entity_url: z.ZodNull;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        run_id: z.ZodString;
        source: z.ZodEnum<["gsc", "ga4", "cwv", "gsc_links", "indexation"]>;
        rows_inserted: z.ZodNumber;
        rows_updated: z.ZodNumber;
        duration_seconds: z.ZodNumber;
        api_calls: z.ZodNumber;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        rows_inserted: number;
        rows_updated: number;
        duration_seconds: number;
        api_calls: number;
        warnings?: string[] | undefined;
    }, {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        rows_inserted: number;
        rows_updated: number;
        duration_seconds: number;
        api_calls: number;
        warnings?: string[] | undefined;
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNull;
    resolved_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "ingestion_run_completed";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        rows_inserted: number;
        rows_updated: number;
        duration_seconds: number;
        api_calls: number;
        warnings?: string[] | undefined;
    };
    ack_at: null;
    resolved_at: string | null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "ingestion_run_completed";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        rows_inserted: number;
        rows_updated: number;
        duration_seconds: number;
        api_calls: number;
        warnings?: string[] | undefined;
    };
    ack_at: null;
    resolved_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"ingestion_run_failed">;
    entity_url: z.ZodNull;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        run_id: z.ZodString;
        source: z.ZodEnum<["gsc", "ga4", "cwv", "gsc_links", "indexation"]>;
        error_class: z.ZodEnum<["quota_exceeded", "auth_failure", "network", "schema_drift", "db_constraint", "unknown"]>;
        error_message: z.ZodString;
        partial_rows_inserted: z.ZodNumber;
        retry_scheduled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        error_class: "unknown" | "quota_exceeded" | "auth_failure" | "network" | "schema_drift" | "db_constraint";
        error_message: string;
        partial_rows_inserted: number;
        retry_scheduled: boolean;
    }, {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        error_class: "unknown" | "quota_exceeded" | "auth_failure" | "network" | "schema_drift" | "db_constraint";
        error_message: string;
        partial_rows_inserted: number;
        retry_scheduled: boolean;
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNullable<z.ZodString>;
    resolved_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "ingestion_run_failed";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        error_class: "unknown" | "quota_exceeded" | "auth_failure" | "network" | "schema_drift" | "db_constraint";
        error_message: string;
        partial_rows_inserted: number;
        retry_scheduled: boolean;
    };
    ack_at: string | null;
    resolved_at: string | null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "ingestion_run_failed";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        run_id: string;
        source: "gsc" | "ga4" | "cwv" | "gsc_links" | "indexation";
        error_class: "unknown" | "quota_exceeded" | "auth_failure" | "network" | "schema_drift" | "db_constraint";
        error_message: string;
        partial_rows_inserted: number;
        retry_scheduled: boolean;
    };
    ack_at: string | null;
    resolved_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"forecast_generated">;
    entity_url: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        page: z.ZodString;
        metric: z.ZodEnum<["clicks", "sessions", "conversions"]>;
        horizon_days: z.ZodNumber;
        predicted_values: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            value: z.ZodNumber;
            lower_ci: z.ZodNumber;
            upper_ci: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            date: string;
            lower_ci: number;
            upper_ci: number;
        }, {
            value: number;
            date: string;
            lower_ci: number;
            upper_ci: number;
        }>, "many">;
        model: z.ZodEnum<["moving_average", "prophet", "exponential_smoothing"]>;
    }, "strip", z.ZodTypeAny, {
        page: string;
        metric: "clicks" | "sessions" | "conversions";
        horizon_days: number;
        predicted_values: {
            value: number;
            date: string;
            lower_ci: number;
            upper_ci: number;
        }[];
        model: "prophet" | "moving_average" | "exponential_smoothing";
    }, {
        page: string;
        metric: "clicks" | "sessions" | "conversions";
        horizon_days: number;
        predicted_values: {
            value: number;
            date: string;
            lower_ci: number;
            upper_ci: number;
        }[];
        model: "prophet" | "moving_average" | "exponential_smoothing";
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNull;
    resolved_at: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "forecast_generated";
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        page: string;
        metric: "clicks" | "sessions" | "conversions";
        horizon_days: number;
        predicted_values: {
            value: number;
            date: string;
            lower_ci: number;
            upper_ci: number;
        }[];
        model: "prophet" | "moving_average" | "exponential_smoothing";
    };
    ack_at: null;
    resolved_at: null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "forecast_generated";
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        page: string;
        metric: "clicks" | "sessions" | "conversions";
        horizon_days: number;
        predicted_values: {
            value: number;
            date: string;
            lower_ci: number;
            upper_ci: number;
        }[];
        model: "prophet" | "moving_average" | "exponential_smoothing";
    };
    ack_at: null;
    resolved_at: null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    event_type: z.ZodLiteral<"digest_sent">;
    entity_url: z.ZodNull;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        digest_period: z.ZodEnum<["daily", "weekly", "monthly"]>;
        sent_to: z.ZodString;
        top_wins_count: z.ZodNumber;
        top_losses_count: z.ZodNumber;
        anomalies_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        digest_period: "daily" | "weekly" | "monthly";
        sent_to: string;
        top_wins_count: number;
        top_losses_count: number;
        anomalies_count: number;
    }, {
        digest_period: "daily" | "weekly" | "monthly";
        sent_to: string;
        top_wins_count: number;
        top_losses_count: number;
        anomalies_count: number;
    }>;
    created_at: z.ZodString;
    ack_at: z.ZodNull;
    resolved_at: z.ZodNull;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    event_type: "digest_sent";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        digest_period: "daily" | "weekly" | "monthly";
        sent_to: string;
        top_wins_count: number;
        top_losses_count: number;
        anomalies_count: number;
    };
    ack_at: null;
    resolved_at: null;
    id?: string | undefined;
}, {
    created_at: string;
    event_type: "digest_sent";
    entity_url: null;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        digest_period: "daily" | "weekly" | "monthly";
        sent_to: string;
        top_wins_count: number;
        top_losses_count: number;
        anomalies_count: number;
    };
    ack_at: null;
    resolved_at: null;
    id?: string | undefined;
}>]>;
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;
//# sourceMappingURL=intelligence.d.ts.map