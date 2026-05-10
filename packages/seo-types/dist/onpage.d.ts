import { z } from "zod";
export declare const AuditTypeSchema: z.ZodEnum<["schema_violation", "image_seo", "canonical_conflict", "meta_experiment", "internal_link_suggestion"]>;
export type AuditType = z.infer<typeof AuditTypeSchema>;
export declare const SeveritySchema: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
export type Severity = z.infer<typeof SeveritySchema>;
export declare const SchemaViolationPayloadSchema: z.ZodObject<{
    schema_type: z.ZodEnum<["Product", "FAQ", "Breadcrumb", "Article", "HowTo", "LocalBusiness", "Person"]>;
    error_type: z.ZodEnum<["missing_required_field", "invalid_value", "deprecated_property", "type_mismatch", "url_unreachable"]>;
    field: z.ZodOptional<z.ZodString>;
    expected: z.ZodOptional<z.ZodString>;
    observed: z.ZodOptional<z.ZodString>;
    rich_results_eligible: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    schema_type: "Product" | "FAQ" | "Breadcrumb" | "Article" | "HowTo" | "LocalBusiness" | "Person";
    error_type: "missing_required_field" | "invalid_value" | "deprecated_property" | "type_mismatch" | "url_unreachable";
    expected?: string | undefined;
    field?: string | undefined;
    observed?: string | undefined;
    rich_results_eligible?: boolean | undefined;
}, {
    schema_type: "Product" | "FAQ" | "Breadcrumb" | "Article" | "HowTo" | "LocalBusiness" | "Person";
    error_type: "missing_required_field" | "invalid_value" | "deprecated_property" | "type_mismatch" | "url_unreachable";
    expected?: string | undefined;
    field?: string | undefined;
    observed?: string | undefined;
    rich_results_eligible?: boolean | undefined;
}>;
export type SchemaViolationPayload = z.infer<typeof SchemaViolationPayloadSchema>;
export declare const ImageSeoPayloadSchema: z.ZodObject<{
    image_url: z.ZodString;
    alt_present: z.ZodBoolean;
    alt_text: z.ZodNullable<z.ZodString>;
    format: z.ZodEnum<["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "other"]>;
    width: z.ZodNullable<z.ZodNumber>;
    height: z.ZodNullable<z.ZodNumber>;
    file_size_kb: z.ZodNullable<z.ZodNumber>;
    lazy_loading: z.ZodNullable<z.ZodBoolean>;
    in_viewport_initially: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    image_url: string;
    alt_present: boolean;
    alt_text: string | null;
    format: "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "other";
    width: number | null;
    height: number | null;
    file_size_kb: number | null;
    lazy_loading: boolean | null;
    in_viewport_initially?: boolean | undefined;
}, {
    image_url: string;
    alt_present: boolean;
    alt_text: string | null;
    format: "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "other";
    width: number | null;
    height: number | null;
    file_size_kb: number | null;
    lazy_loading: boolean | null;
    in_viewport_initially?: boolean | undefined;
}>;
export type ImageSeoPayload = z.infer<typeof ImageSeoPayloadSchema>;
export declare const CanonicalConflictPayloadSchema: z.ZodObject<{
    declared_canonical: z.ZodNullable<z.ZodString>;
    computed_canonical: z.ZodString;
    conflict_type: z.ZodEnum<["self_referencing_missing", "points_to_404", "points_to_redirect", "duplicate_cross_role", "wrong_domain"]>;
    duplicate_pages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    declared_canonical: string | null;
    computed_canonical: string;
    conflict_type: "self_referencing_missing" | "points_to_404" | "points_to_redirect" | "duplicate_cross_role" | "wrong_domain";
    duplicate_pages?: string[] | undefined;
}, {
    declared_canonical: string | null;
    computed_canonical: string;
    conflict_type: "self_referencing_missing" | "points_to_404" | "points_to_redirect" | "duplicate_cross_role" | "wrong_domain";
    duplicate_pages?: string[] | undefined;
}>;
export type CanonicalConflictPayload = z.infer<typeof CanonicalConflictPayloadSchema>;
export declare const MetaExperimentPayloadSchema: z.ZodObject<{
    experiment_id: z.ZodString;
    variant_label: z.ZodEnum<["A", "B"]>;
    meta_field: z.ZodEnum<["title", "description"]>;
    variant_value: z.ZodString;
    control_value: z.ZodString;
    started_at: z.ZodString;
    ended_at: z.ZodNullable<z.ZodString>;
    ctr_baseline: z.ZodNullable<z.ZodNumber>;
    ctr_observed: z.ZodNullable<z.ZodNumber>;
    ctr_delta_pct: z.ZodNullable<z.ZodNumber>;
    sample_size: z.ZodNullable<z.ZodNumber>;
    winner: z.ZodNullable<z.ZodEnum<["A", "B", "inconclusive"]>>;
}, "strip", z.ZodTypeAny, {
    experiment_id: string;
    variant_label: "A" | "B";
    meta_field: "title" | "description";
    variant_value: string;
    control_value: string;
    started_at: string;
    ended_at: string | null;
    ctr_baseline: number | null;
    ctr_observed: number | null;
    ctr_delta_pct: number | null;
    sample_size: number | null;
    winner: "A" | "B" | "inconclusive" | null;
}, {
    experiment_id: string;
    variant_label: "A" | "B";
    meta_field: "title" | "description";
    variant_value: string;
    control_value: string;
    started_at: string;
    ended_at: string | null;
    ctr_baseline: number | null;
    ctr_observed: number | null;
    ctr_delta_pct: number | null;
    sample_size: number | null;
    winner: "A" | "B" | "inconclusive" | null;
}>;
export type MetaExperimentPayload = z.infer<typeof MetaExperimentPayloadSchema>;
export declare const InternalLinkSuggestionPayloadSchema: z.ZodObject<{
    source_page: z.ZodString;
    target_page: z.ZodString;
    anchor_suggestion: z.ZodString;
    similarity_score: z.ZodNumber;
    rationale: z.ZodOptional<z.ZodString>;
    applied_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source_page: string;
    target_page: string;
    anchor_suggestion: string;
    similarity_score: number;
    applied_at: string | null;
    rationale?: string | undefined;
}, {
    source_page: string;
    target_page: string;
    anchor_suggestion: string;
    similarity_score: number;
    applied_at: string | null;
    rationale?: string | undefined;
}>;
export type InternalLinkSuggestionPayload = z.infer<typeof InternalLinkSuggestionPayloadSchema>;
export declare const AuditFindingSchema: z.ZodDiscriminatedUnion<"audit_type", [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    audit_type: z.ZodLiteral<"schema_violation">;
    entity_url: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        schema_type: z.ZodEnum<["Product", "FAQ", "Breadcrumb", "Article", "HowTo", "LocalBusiness", "Person"]>;
        error_type: z.ZodEnum<["missing_required_field", "invalid_value", "deprecated_property", "type_mismatch", "url_unreachable"]>;
        field: z.ZodOptional<z.ZodString>;
        expected: z.ZodOptional<z.ZodString>;
        observed: z.ZodOptional<z.ZodString>;
        rich_results_eligible: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        schema_type: "Product" | "FAQ" | "Breadcrumb" | "Article" | "HowTo" | "LocalBusiness" | "Person";
        error_type: "missing_required_field" | "invalid_value" | "deprecated_property" | "type_mismatch" | "url_unreachable";
        expected?: string | undefined;
        field?: string | undefined;
        observed?: string | undefined;
        rich_results_eligible?: boolean | undefined;
    }, {
        schema_type: "Product" | "FAQ" | "Breadcrumb" | "Article" | "HowTo" | "LocalBusiness" | "Person";
        error_type: "missing_required_field" | "invalid_value" | "deprecated_property" | "type_mismatch" | "url_unreachable";
        expected?: string | undefined;
        field?: string | undefined;
        observed?: string | undefined;
        rich_results_eligible?: boolean | undefined;
    }>;
    detected_at: z.ZodString;
    resolved_at: z.ZodNullable<z.ZodString>;
    fixed_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        schema_type: "Product" | "FAQ" | "Breadcrumb" | "Article" | "HowTo" | "LocalBusiness" | "Person";
        error_type: "missing_required_field" | "invalid_value" | "deprecated_property" | "type_mismatch" | "url_unreachable";
        expected?: string | undefined;
        field?: string | undefined;
        observed?: string | undefined;
        rich_results_eligible?: boolean | undefined;
    };
    resolved_at: string | null;
    audit_type: "schema_violation";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        schema_type: "Product" | "FAQ" | "Breadcrumb" | "Article" | "HowTo" | "LocalBusiness" | "Person";
        error_type: "missing_required_field" | "invalid_value" | "deprecated_property" | "type_mismatch" | "url_unreachable";
        expected?: string | undefined;
        field?: string | undefined;
        observed?: string | undefined;
        rich_results_eligible?: boolean | undefined;
    };
    resolved_at: string | null;
    audit_type: "schema_violation";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    audit_type: z.ZodLiteral<"image_seo">;
    entity_url: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        image_url: z.ZodString;
        alt_present: z.ZodBoolean;
        alt_text: z.ZodNullable<z.ZodString>;
        format: z.ZodEnum<["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "other"]>;
        width: z.ZodNullable<z.ZodNumber>;
        height: z.ZodNullable<z.ZodNumber>;
        file_size_kb: z.ZodNullable<z.ZodNumber>;
        lazy_loading: z.ZodNullable<z.ZodBoolean>;
        in_viewport_initially: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        image_url: string;
        alt_present: boolean;
        alt_text: string | null;
        format: "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "other";
        width: number | null;
        height: number | null;
        file_size_kb: number | null;
        lazy_loading: boolean | null;
        in_viewport_initially?: boolean | undefined;
    }, {
        image_url: string;
        alt_present: boolean;
        alt_text: string | null;
        format: "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "other";
        width: number | null;
        height: number | null;
        file_size_kb: number | null;
        lazy_loading: boolean | null;
        in_viewport_initially?: boolean | undefined;
    }>;
    detected_at: z.ZodString;
    resolved_at: z.ZodNullable<z.ZodString>;
    fixed_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        image_url: string;
        alt_present: boolean;
        alt_text: string | null;
        format: "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "other";
        width: number | null;
        height: number | null;
        file_size_kb: number | null;
        lazy_loading: boolean | null;
        in_viewport_initially?: boolean | undefined;
    };
    resolved_at: string | null;
    audit_type: "image_seo";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        image_url: string;
        alt_present: boolean;
        alt_text: string | null;
        format: "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "other";
        width: number | null;
        height: number | null;
        file_size_kb: number | null;
        lazy_loading: boolean | null;
        in_viewport_initially?: boolean | undefined;
    };
    resolved_at: string | null;
    audit_type: "image_seo";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    audit_type: z.ZodLiteral<"canonical_conflict">;
    entity_url: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        declared_canonical: z.ZodNullable<z.ZodString>;
        computed_canonical: z.ZodString;
        conflict_type: z.ZodEnum<["self_referencing_missing", "points_to_404", "points_to_redirect", "duplicate_cross_role", "wrong_domain"]>;
        duplicate_pages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        declared_canonical: string | null;
        computed_canonical: string;
        conflict_type: "self_referencing_missing" | "points_to_404" | "points_to_redirect" | "duplicate_cross_role" | "wrong_domain";
        duplicate_pages?: string[] | undefined;
    }, {
        declared_canonical: string | null;
        computed_canonical: string;
        conflict_type: "self_referencing_missing" | "points_to_404" | "points_to_redirect" | "duplicate_cross_role" | "wrong_domain";
        duplicate_pages?: string[] | undefined;
    }>;
    detected_at: z.ZodString;
    resolved_at: z.ZodNullable<z.ZodString>;
    fixed_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        declared_canonical: string | null;
        computed_canonical: string;
        conflict_type: "self_referencing_missing" | "points_to_404" | "points_to_redirect" | "duplicate_cross_role" | "wrong_domain";
        duplicate_pages?: string[] | undefined;
    };
    resolved_at: string | null;
    audit_type: "canonical_conflict";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        declared_canonical: string | null;
        computed_canonical: string;
        conflict_type: "self_referencing_missing" | "points_to_404" | "points_to_redirect" | "duplicate_cross_role" | "wrong_domain";
        duplicate_pages?: string[] | undefined;
    };
    resolved_at: string | null;
    audit_type: "canonical_conflict";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    audit_type: z.ZodLiteral<"meta_experiment">;
    entity_url: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        experiment_id: z.ZodString;
        variant_label: z.ZodEnum<["A", "B"]>;
        meta_field: z.ZodEnum<["title", "description"]>;
        variant_value: z.ZodString;
        control_value: z.ZodString;
        started_at: z.ZodString;
        ended_at: z.ZodNullable<z.ZodString>;
        ctr_baseline: z.ZodNullable<z.ZodNumber>;
        ctr_observed: z.ZodNullable<z.ZodNumber>;
        ctr_delta_pct: z.ZodNullable<z.ZodNumber>;
        sample_size: z.ZodNullable<z.ZodNumber>;
        winner: z.ZodNullable<z.ZodEnum<["A", "B", "inconclusive"]>>;
    }, "strip", z.ZodTypeAny, {
        experiment_id: string;
        variant_label: "A" | "B";
        meta_field: "title" | "description";
        variant_value: string;
        control_value: string;
        started_at: string;
        ended_at: string | null;
        ctr_baseline: number | null;
        ctr_observed: number | null;
        ctr_delta_pct: number | null;
        sample_size: number | null;
        winner: "A" | "B" | "inconclusive" | null;
    }, {
        experiment_id: string;
        variant_label: "A" | "B";
        meta_field: "title" | "description";
        variant_value: string;
        control_value: string;
        started_at: string;
        ended_at: string | null;
        ctr_baseline: number | null;
        ctr_observed: number | null;
        ctr_delta_pct: number | null;
        sample_size: number | null;
        winner: "A" | "B" | "inconclusive" | null;
    }>;
    detected_at: z.ZodString;
    resolved_at: z.ZodNullable<z.ZodString>;
    fixed_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        experiment_id: string;
        variant_label: "A" | "B";
        meta_field: "title" | "description";
        variant_value: string;
        control_value: string;
        started_at: string;
        ended_at: string | null;
        ctr_baseline: number | null;
        ctr_observed: number | null;
        ctr_delta_pct: number | null;
        sample_size: number | null;
        winner: "A" | "B" | "inconclusive" | null;
    };
    resolved_at: string | null;
    audit_type: "meta_experiment";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        experiment_id: string;
        variant_label: "A" | "B";
        meta_field: "title" | "description";
        variant_value: string;
        control_value: string;
        started_at: string;
        ended_at: string | null;
        ctr_baseline: number | null;
        ctr_observed: number | null;
        ctr_delta_pct: number | null;
        sample_size: number | null;
        winner: "A" | "B" | "inconclusive" | null;
    };
    resolved_at: string | null;
    audit_type: "meta_experiment";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    audit_type: z.ZodLiteral<"internal_link_suggestion">;
    entity_url: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    payload: z.ZodObject<{
        source_page: z.ZodString;
        target_page: z.ZodString;
        anchor_suggestion: z.ZodString;
        similarity_score: z.ZodNumber;
        rationale: z.ZodOptional<z.ZodString>;
        applied_at: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source_page: string;
        target_page: string;
        anchor_suggestion: string;
        similarity_score: number;
        applied_at: string | null;
        rationale?: string | undefined;
    }, {
        source_page: string;
        target_page: string;
        anchor_suggestion: string;
        similarity_score: number;
        applied_at: string | null;
        rationale?: string | undefined;
    }>;
    detected_at: z.ZodString;
    resolved_at: z.ZodNullable<z.ZodString>;
    fixed_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        source_page: string;
        target_page: string;
        anchor_suggestion: string;
        similarity_score: number;
        applied_at: string | null;
        rationale?: string | undefined;
    };
    resolved_at: string | null;
    audit_type: "internal_link_suggestion";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}, {
    entity_url: string;
    severity: "high" | "medium" | "low" | "critical" | "info";
    payload: {
        source_page: string;
        target_page: string;
        anchor_suggestion: string;
        similarity_score: number;
        applied_at: string | null;
        rationale?: string | undefined;
    };
    resolved_at: string | null;
    audit_type: "internal_link_suggestion";
    detected_at: string;
    fixed_at: string | null;
    id?: string | undefined;
}>]>;
export type AuditFinding = z.infer<typeof AuditFindingSchema>;
export declare const OnpageAuditSummarySchema: z.ZodObject<{
    total_findings_open: z.ZodNumber;
    by_audit_type: z.ZodRecord<z.ZodEnum<["schema_violation", "image_seo", "canonical_conflict", "meta_experiment", "internal_link_suggestion"]>, z.ZodNumber>;
    by_severity: z.ZodRecord<z.ZodEnum<["critical", "high", "medium", "low", "info"]>, z.ZodNumber>;
    last_audit_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    total_findings_open: number;
    by_audit_type: Partial<Record<"schema_violation" | "image_seo" | "canonical_conflict" | "meta_experiment" | "internal_link_suggestion", number>>;
    by_severity: Partial<Record<"high" | "medium" | "low" | "critical" | "info", number>>;
    last_audit_at: string;
}, {
    total_findings_open: number;
    by_audit_type: Partial<Record<"schema_violation" | "image_seo" | "canonical_conflict" | "meta_experiment" | "internal_link_suggestion", number>>;
    by_severity: Partial<Record<"high" | "medium" | "low" | "critical" | "info", number>>;
    last_audit_at: string;
}>;
export type OnpageAuditSummary = z.infer<typeof OnpageAuditSummarySchema>;
//# sourceMappingURL=onpage.d.ts.map