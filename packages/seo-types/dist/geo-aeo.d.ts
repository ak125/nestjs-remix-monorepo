import { z } from "zod";
export declare const EEATScoresSchema: z.ZodObject<{
    experience: z.ZodNumber;
    expertise: z.ZodNumber;
    authoritativeness: z.ZodNumber;
    trustworthiness: z.ZodNumber;
    signals: z.ZodObject<{
        has_author_declared: z.ZodBoolean;
        author_has_schema_person: z.ZodBoolean;
        has_citations_to_sources: z.ZodBoolean;
        citation_count: z.ZodNumber;
        last_updated_recency_days: z.ZodNumber;
        external_mentions_count: z.ZodNumber;
        has_first_hand_experience_signals: z.ZodBoolean;
        has_credentials_or_bio: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        has_author_declared: boolean;
        author_has_schema_person: boolean;
        has_citations_to_sources: boolean;
        citation_count: number;
        last_updated_recency_days: number;
        external_mentions_count: number;
        has_first_hand_experience_signals: boolean;
        has_credentials_or_bio: boolean;
    }, {
        has_author_declared: boolean;
        author_has_schema_person: boolean;
        has_citations_to_sources: boolean;
        citation_count: number;
        last_updated_recency_days: number;
        external_mentions_count: number;
        has_first_hand_experience_signals: boolean;
        has_credentials_or_bio: boolean;
    }>;
    computed_at: z.ZodString;
    algo_version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    computed_at: string;
    experience: number;
    expertise: number;
    authoritativeness: number;
    trustworthiness: number;
    signals: {
        has_author_declared: boolean;
        author_has_schema_person: boolean;
        has_citations_to_sources: boolean;
        citation_count: number;
        last_updated_recency_days: number;
        external_mentions_count: number;
        has_first_hand_experience_signals: boolean;
        has_credentials_or_bio: boolean;
    };
    algo_version: string;
}, {
    computed_at: string;
    experience: number;
    expertise: number;
    authoritativeness: number;
    trustworthiness: number;
    signals: {
        has_author_declared: boolean;
        author_has_schema_person: boolean;
        has_citations_to_sources: boolean;
        citation_count: number;
        last_updated_recency_days: number;
        external_mentions_count: number;
        has_first_hand_experience_signals: boolean;
        has_credentials_or_bio: boolean;
    };
    algo_version: string;
}>;
export type EEATScores = z.infer<typeof EEATScoresSchema>;
export declare const HelpfulContentAuditSchema: z.ZodObject<{
    depth_score: z.ZodNumber;
    originality_score: z.ZodNumber;
    expertise_signals: z.ZodObject<{
        has_first_person_voice: z.ZodBoolean;
        has_specific_examples: z.ZodBoolean;
        has_technical_specs: z.ZodBoolean;
        has_step_by_step: z.ZodBoolean;
        has_comparisons: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        has_first_person_voice: boolean;
        has_specific_examples: boolean;
        has_technical_specs: boolean;
        has_step_by_step: boolean;
        has_comparisons: boolean;
    }, {
        has_first_person_voice: boolean;
        has_specific_examples: boolean;
        has_technical_specs: boolean;
        has_step_by_step: boolean;
        has_comparisons: boolean;
    }>;
    verdict: z.ZodEnum<["helpful", "borderline", "thin", "low_value"]>;
    audit_date: z.ZodString;
}, "strip", z.ZodTypeAny, {
    depth_score: number;
    originality_score: number;
    expertise_signals: {
        has_first_person_voice: boolean;
        has_specific_examples: boolean;
        has_technical_specs: boolean;
        has_step_by_step: boolean;
        has_comparisons: boolean;
    };
    verdict: "helpful" | "borderline" | "thin" | "low_value";
    audit_date: string;
}, {
    depth_score: number;
    originality_score: number;
    expertise_signals: {
        has_first_person_voice: boolean;
        has_specific_examples: boolean;
        has_technical_specs: boolean;
        has_step_by_step: boolean;
        has_comparisons: boolean;
    };
    verdict: "helpful" | "borderline" | "thin" | "low_value";
    audit_date: string;
}>;
export type HelpfulContentAudit = z.infer<typeof HelpfulContentAuditSchema>;
export declare const AnswerEngineFormatSuggestionSchema: z.ZodObject<{
    page: z.ZodString;
    current: z.ZodObject<{
        bullet_ratio: z.ZodNumber;
        has_faq_schema: z.ZodBoolean;
        has_summary_box: z.ZodBoolean;
        avg_paragraph_length: z.ZodNumber;
        has_table_of_contents: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        bullet_ratio: number;
        has_faq_schema: boolean;
        has_summary_box: boolean;
        avg_paragraph_length: number;
        has_table_of_contents: boolean;
    }, {
        bullet_ratio: number;
        has_faq_schema: boolean;
        has_summary_box: boolean;
        avg_paragraph_length: number;
        has_table_of_contents: boolean;
    }>;
    suggestions: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["add_summary_box", "add_faq_schema", "shorten_paragraphs", "add_bullet_list", "add_table_of_contents", "split_long_section"]>;
        rationale: z.ZodString;
        priority: z.ZodEnum<["high", "medium", "low"]>;
    }, "strip", z.ZodTypeAny, {
        type: "add_summary_box" | "add_faq_schema" | "shorten_paragraphs" | "add_bullet_list" | "add_table_of_contents" | "split_long_section";
        rationale: string;
        priority: "high" | "medium" | "low";
    }, {
        type: "add_summary_box" | "add_faq_schema" | "shorten_paragraphs" | "add_bullet_list" | "add_table_of_contents" | "split_long_section";
        rationale: string;
        priority: "high" | "medium" | "low";
    }>, "many">;
    computed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    computed_at: string;
    page: string;
    current: {
        bullet_ratio: number;
        has_faq_schema: boolean;
        has_summary_box: boolean;
        avg_paragraph_length: number;
        has_table_of_contents: boolean;
    };
    suggestions: {
        type: "add_summary_box" | "add_faq_schema" | "shorten_paragraphs" | "add_bullet_list" | "add_table_of_contents" | "split_long_section";
        rationale: string;
        priority: "high" | "medium" | "low";
    }[];
}, {
    computed_at: string;
    page: string;
    current: {
        bullet_ratio: number;
        has_faq_schema: boolean;
        has_summary_box: boolean;
        avg_paragraph_length: number;
        has_table_of_contents: boolean;
    };
    suggestions: {
        type: "add_summary_box" | "add_faq_schema" | "shorten_paragraphs" | "add_bullet_list" | "add_table_of_contents" | "split_long_section";
        rationale: string;
        priority: "high" | "medium" | "low";
    }[];
}>;
export type AnswerEngineFormatSuggestion = z.infer<typeof AnswerEngineFormatSuggestionSchema>;
//# sourceMappingURL=geo-aeo.d.ts.map