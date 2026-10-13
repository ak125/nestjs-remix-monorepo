/**
 * Types et constantes de la projection WIKI → DB des liens du moteur de
 * diagnostic (ADR-035, mode « rattacher » d'ADR-112 D2).
 *
 * Les schémas Zod ci-dessous sont des LECTEURS TOLÉRANTS : `z.object` retire les
 * clés inconnues et ne contrôle que ce que le writer consomme. Le contrat complet
 * de l'export (`_meta/schema/exports-diagnostic.schema.json` v2) est validé côté
 * WIKI par `wiki-quality-gates` ; il n'est pas dupliqué ici.
 * `cause_slug` et `vehicle_scope` sont lus parce qu'ils changent le verdict
 * (`cause_slug_mismatch`, `vehicle_scope_unsupported`) ; `citations` et
 * `evidence.strength` ne servent pas à rattacher un lien et sont ignorés.
 */
import { z } from 'zod';

export const DIAGNOSTIC_PROJECTION_QUEUE = 'diagnostic-projection-queue';
export const DIAGNOSTIC_PROJECTION_JOB = 'diagnostic-projection-run';
/** jobId stable du repeatable → pas de doublon au redéploiement. */
export const DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID =
  'diagnostic-projection-nightly';

export const DiagnosticProjectionJobDataSchema = z.object({
  triggeredBy: z.enum(['repeatable', 'admin']),
});
export type DiagnosticProjectionJobData = z.infer<
  typeof DiagnosticProjectionJobDataSchema
>;
export type DiagnosticProjectionTrigger =
  DiagnosticProjectionJobData['triggeredBy'];

/**
 * Ordre = ordre d'évaluation (le premier contrôle en échec donne la raison).
 * Même ensemble que le CHECK `__diag_projection_conflicts.reason` dans sa
 * définition la plus récente, la migration
 * 20261012_diag_projection_requires_review.sql (test d'alignement à côté).
 * `not_reviewed` est évalué en dernier (ADR-115 D1).
 */
export const CONFLICT_REASONS = [
  'schema_invalid',
  'not_a_cause_relation',
  'vehicle_scope_unsupported',
  'unknown_symptom',
  'system_mismatch',
  'no_matching_link',
  'ambiguous_cause',
  'cause_slug_mismatch',
  'duplicate_relation',
  'source_not_raw_proven',
  'not_reviewed',
] as const;
export type ConflictReason = (typeof CONFLICT_REASONS)[number];

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
// Motif WIKI : frontmatter.schema.json#/properties/diagnostic_relations/items/properties/{symptom_slug,system_slug}
const DIAG_SLUG_RE = /^[a-z][a-z0-9_-]*[a-z0-9]$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * Major du contrat d'export lu par ce writer. Un autre major échoue la
 * pré-validation : le run entier est refusé, jamais lu à moitié.
 */
const SCHEMA_VERSION_RE = /^2\.\d+\.\d+$/;

/** `_index.json`. */
export const ExportIndexSchema = z.object({
  schema_version: z.string().regex(SCHEMA_VERSION_RE),
  builder_version: z.string().regex(SEMVER_RE),
  export_kind: z.literal('diagnostic_index'),
  source_catalog_commit: z.string().regex(COMMIT_RE),
  files: z.array(
    z.object({
      path: z.string().regex(/^gamme\/[a-z0-9][a-z0-9-]*[a-z0-9]\.json$/),
      sha256: z.string().regex(SHA256_RE),
      source_wiki_commit: z.string().regex(COMMIT_RE),
      relation_count: z.number().int().min(1),
    }),
  ),
});

/** Enveloppe d'un export de gamme ; les relations sont validées une à une. */
export const GammeExportEnvelopeSchema = z.object({
  schema_version: z.string().regex(SCHEMA_VERSION_RE),
  builder_version: z.string().regex(SEMVER_RE),
  export_kind: z.literal('diagnostic_gamme'),
  gamme_slug: z.string().regex(SLUG_RE),
  wiki_path: z.string().regex(/^wiki\/gamme\/[a-z0-9][a-z0-9-]*[a-z0-9]\.md$/),
  source_wiki_commit: z.string().regex(COMMIT_RE),
  source_catalog_commit: z.string().regex(COMMIT_RE),
  content_hash: z.string().regex(SHA256_RE),
  relations: z.array(z.unknown()).min(1),
});
export type GammeExportEnvelope = z.infer<typeof GammeExportEnvelopeSchema>;

const nonEmpty = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);

/** Validate the proof metadata we rely on, without promoting an unproven source.
 * The WIKI export contract requires active + a pinned RAW reference when true.
 * Extra source metadata remains intact for the provenance record.
 */
const ExportSourceSchema = z.discriminatedUnion('raw_proven', [
  z.object({ slug: nonEmpty, raw_proven: z.literal(false) }).passthrough(),
  z
    .object({
      slug: nonEmpty,
      raw_proven: z.literal(true),
      status: z.literal('active'),
      raw_ref: z
        .object({
          repo: z.literal('automecanik-raw'),
          manifest_id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
          expected_sha256: z.string().regex(SHA256_RE),
        })
        .passthrough(),
    })
    .passthrough(),
]);

/** Une relation — ne lit que les champs projetés ; `sources[]` est conservé tel quel. */
export const ExportRelationSchema = z.object({
  relation_index: z.number().int().min(0),
  symptom_slug: z.string().max(80).regex(DIAG_SLUG_RE),
  system_slug: z.string().max(60).regex(DIAG_SLUG_RE),
  /** Vérifie la résolution, ne la fait jamais (mode « rattacher »). */
  cause_slug: z.string().max(80).regex(DIAG_SLUG_RE).optional(),
  /**
   * Présent = relation bornée (carburant, famille) : la provenance n'a pas de
   * colonne de portée (ADR-035 D1), donc conflit `vehicle_scope_unsupported`.
   * Seule la forme est lue ; les clés admises sont le contrat WIKI.
   */
  vehicle_scope: z.record(z.string(), z.unknown()).optional(),
  relation_to_part: z.enum([
    'possible_cause',
    'symptom_amplifier',
    'secondary_effect',
  ]),
  part_role: z.string().min(10).max(280),
  evidence: z.object({
    confidence: z.enum(['low', 'medium', 'high']),
    source_policy: z.enum(['1_high', '2_medium_concordant', 'manual_review']),
    reviewed: z.boolean(),
    diagnostic_safe: z.boolean(),
  }),
  confidence_score_computed: z.number().min(0).max(1),
  sources: z.array(ExportSourceSchema).min(1),
});
export type ExportRelation = z.infer<typeof ExportRelationSchema>;

export interface LoadedGammeExport {
  /** Chemin relatif à la racine des exports (`gamme/<slug>.json`). */
  path: string;
  envelope: GammeExportEnvelope;
}

export interface LoadedDiagnosticExports {
  indexSha256: string;
  builderVersion: string;
  files: LoadedGammeExport[];
}

/** Une ligne de provenance — clés = celles lues par `__diag_projection_apply`. */
export interface ProjectionRow {
  link_id: number;
  wiki_path: string;
  gamme_slug: string;
  wiki_commit: string;
  content_hash: string;
  relation_to_part: 'possible_cause';
  part_role: string;
  confidence: ExportRelation['evidence']['confidence'];
  source_policy: ExportRelation['evidence']['source_policy'];
  confidence_score_computed: number;
  /** Une relation non relue est un conflit `not_reviewed` (ADR-115 D1). */
  reviewed: true;
  diagnostic_safe: boolean;
  sources: Array<Record<string, unknown>>;
}

export interface ConflictRow {
  wiki_path: string;
  gamme_slug: string;
  relation_index: number;
  symptom_slug: string | null;
  system_slug: string | null;
  reason: ConflictReason;
  detail: Record<string, unknown>;
}

export interface DiagnosticProjectionResolution {
  exportedCount: number;
  projections: ProjectionRow[];
  conflicts: ConflictRow[];
}

/** Payload `p_run` de `__diag_projection_apply`. */
export interface DiagnosticProjectionRunPayload {
  /** Clé d'idempotence du run, reprise par `__diag_projection_record_failure`. */
  run_key: string;
  triggered_by: DiagnosticProjectionTrigger;
  runtime_env: string;
  index_sha256: string;
  builder_version: string;
  exported_count: number;
  started_at: string;
  projections: ProjectionRow[];
  conflicts: ConflictRow[];
}

export const ApplyResultSchema = z.object({
  run_id: z.number().int().positive(),
  projected_count: z.number().int().min(0),
  conflict_count: z.number().int().min(0),
  retired_count: z.number().int().min(0),
});
type ApplyResult = z.infer<typeof ApplyResultSchema>;

/** Payload `p_run` de `__diag_projection_record_failure`. */
export interface DiagnosticProjectionFailurePayload {
  run_key: string;
  triggered_by: DiagnosticProjectionTrigger;
  runtime_env: string;
  error: string;
  /** null = inconnu : échec avant la lecture de l'index. */
  index_sha256: string | null;
  builder_version: string | null;
  exported_count: number | null;
  started_at: string;
}

/**
 * Retour de `__diag_projection_record_failure` : `failed` = l'échec vient d'être
 * écrit ; `applied` = l'apply de même `run_key` a été validé, seule sa réponse
 * s'était perdue.
 */
export const RecordFailureResultSchema = z.object({
  run_id: z.number().int().positive(),
  status: z.enum(['failed', 'applied']),
});

export type DiagnosticProjectionRunResult =
  | { status: 'skipped'; reason: 'READ_ONLY' | 'FLAG_OFF' }
  | ({ status: 'applied'; exportedCount: number } & ApplyResult)
  /** Apply validé en base, réponse perdue : les comptes sont en base, pas ici. */
  | { status: 'applied_unconfirmed'; runId: number; error: string }
  | { status: 'failed'; runId: number; error: string };
