import { z } from "zod";
export const EEATScoresSchema = z.object({
    experience: z.number().min(0).max(100),
    expertise: z.number().min(0).max(100),
    authoritativeness: z.number().min(0).max(100),
    trustworthiness: z.number().min(0).max(100),
    signals: z.object({
        has_author_declared: z.boolean(),
        author_has_schema_person: z.boolean(),
        has_citations_to_sources: z.boolean(),
        citation_count: z.number().int().nonnegative(),
        last_updated_recency_days: z.number().int().nonnegative(),
        external_mentions_count: z.number().int().nonnegative(),
        has_first_hand_experience_signals: z.boolean(),
        has_credentials_or_bio: z.boolean(),
    }),
    computed_at: z.string().datetime(),
    algo_version: z.string(),
});
export const HelpfulContentAuditSchema = z.object({
    depth_score: z.number().min(0).max(100),
    originality_score: z.number().min(0).max(100),
    expertise_signals: z.object({
        has_first_person_voice: z.boolean(),
        has_specific_examples: z.boolean(),
        has_technical_specs: z.boolean(),
        has_step_by_step: z.boolean(),
        has_comparisons: z.boolean(),
    }),
    verdict: z.enum(["helpful", "borderline", "thin", "low_value"]),
    audit_date: z.string().datetime(),
});
export const AnswerEngineFormatSuggestionSchema = z.object({
    page: z.string().url(),
    current: z.object({
        bullet_ratio: z.number().min(0).max(1),
        has_faq_schema: z.boolean(),
        has_summary_box: z.boolean(),
        avg_paragraph_length: z.number(),
        has_table_of_contents: z.boolean(),
    }),
    suggestions: z.array(z.object({
        type: z.enum([
            "add_summary_box",
            "add_faq_schema",
            "shorten_paragraphs",
            "add_bullet_list",
            "add_table_of_contents",
            "split_long_section",
        ]),
        rationale: z.string(),
        priority: z.enum(["high", "medium", "low"]),
    })),
    computed_at: z.string().datetime(),
});
//# sourceMappingURL=geo-aeo.js.map