/**
 * ADR-059 Phase B PR-6b — DTOs Zod-validated pour jobs BullMQ.
 *
 * `WriteJobData` arrive via PR-5b cron (sync_exports_seo) OU manuellement
 * (replay PR-6c). `RefreshJobData` est enqueue par le write worker
 * **APRÈS COMMIT** (jamais dans la transaction).
 */
import { z } from 'zod';

const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, {
  message: 'expected semver MAJOR.MINOR.PATCH',
});

const Sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/, {
  message: 'expected sha256:<64 hex>',
});

const EntityIdSchema = z
  .string()
  .regex(
    /^(gamme|vehicle|constructeur|diagnostic):[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    {
      message: 'entity_id must be <entity_type>:<slug-singular>',
    },
  );

export const WriteJobDataSchema = z
  .object({
    // Contract enforcement (assertCompatibleProjectionContract au démarrage)
    projection_contract_version: SemverSchema,

    // Replay SoT (PR-5b tar.zst object-store)
    exports_snapshot_hash: Sha256Schema,
    exports_snapshot_uri: z.string().min(1),

    // Versions complètes (replay determinism)
    builder_version: SemverSchema,
    pipeline_version: SemverSchema,
    extractor_version: SemverSchema,

    // Audit-only (NOT replay-authoritative)
    wiki_commit_sha: z.string().min(1),

    // Trigger provenance
    trigger_kind: z.enum(['cron', 'manual', 'replay']),
    replayed_from_run_id: z.string().uuid().nullable().default(null),

    // Payload : list of entity_ids à projeter (le worker fetch depuis snapshot)
    entity_ids: z.array(EntityIdSchema).min(1),
  })
  .strict();

export type WriteJobData = z.infer<typeof WriteJobDataSchema>;

export const RefreshJobDataSchema = z
  .object({
    run_id: z.string().uuid(),
    triggered_at: z.string().datetime(),
    triggered_by: z.literal('seo-projection-write-worker'),
  })
  .strict();

export type RefreshJobData = z.infer<typeof RefreshJobDataSchema>;

export const WriteJobResultSchema = z
  .object({
    status: z.enum([
      'success',
      'failed',
      'skipped_read_only',
      'aborted_contract_mismatch',
    ]),
    run_id: z.string().uuid().nullable(),
    entities_processed: z.number().int().nonnegative(),
    conflicts_count: z.number().int().nonnegative(),
    refresh_job_enqueued: z.boolean(),
  })
  .strict();

export type WriteJobResult = z.infer<typeof WriteJobResultSchema>;

export const RefreshJobResultSchema = z
  .object({
    status: z.enum(['success', 'failed', 'skipped_read_only']),
    refreshed_views: z.array(z.string()),
    duration_ms: z.number().int().nonnegative(),
  })
  .strict();

export type RefreshJobResult = z.infer<typeof RefreshJobResultSchema>;
