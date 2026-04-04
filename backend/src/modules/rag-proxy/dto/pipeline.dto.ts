import { z } from 'zod';

export const PipelineLaunchSchema = z.object({
  step: z.enum(['audit', 'enrich', 'reindex']),
  scope: z
    .union([
      z.literal('all'),
      z
        .string()
        .trim()
        .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
        .min(2)
        .max(80),
    ])
    .optional()
    .default('all'),
  dry_run: z.boolean().optional().default(false),
  triggered_by: z.string().optional().default('manual'),
  origin: z
    .enum([
      'paperclip_routine',
      'paperclip_ticket',
      'admin_manual',
      'test_local',
    ])
    .optional()
    .default('admin_manual'),
});

export type PipelineLaunchDto = z.infer<typeof PipelineLaunchSchema>;

export interface PipelineArtifact {
  artifact_type:
    | 'audit_json'
    | 'enrich_summary'
    | 'reindex_summary'
    | 'report_md';
  artifact_name: string;
  relative_path: string; // relative to RAG_PIPELINE_ARTIFACTS_DIR
}

export interface PipelineRunSummary {
  step_failed?: string;
  gammes_processed?: number;
  errors?: string[];
  artifacts?: PipelineArtifact[];
  log_lines?: number;
  // Audit specific
  gammes_total?: number;
  gammes_ok?: number;
  gammes_blocked?: number;
  gammes_without_sources?: number;
  content_gap_confirmed?: boolean;
  docs_indexed_weaviate?: number;
  corpus_by_truth_level?: { L1: number; L2: number; L3: number; L4: number };
  weaviate_low_coverage_suspected?: boolean;
  index_gap_confirmed?: boolean | null;
  index_gap_root_cause?:
    | 'unknown'
    | 'missing_indexation'
    | 'preflight_exclusion'
    | 'mixed';
  // Reindex specific
  docs_indexed?: number;
  blocked_docs?: number;
  blocked_chunks?: number;
  duration_seconds?: number;
}

export type PipelineRunStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'done_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'abandoned';

export interface PipelineRun {
  run_id: string;
  step: 'audit' | 'enrich' | 'reindex';
  status: PipelineRunStatus;
  has_warnings: boolean;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
  duration_ms?: number;
  exit_code?: number;
  pid?: number;
  cancel_requested_at?: string;
  cancelled_at?: string;
  triggered_by: string;
  origin: string;
  scope: string;
  dry_run: boolean;
  summary?: PipelineRunSummary;
  error?: string;
}
