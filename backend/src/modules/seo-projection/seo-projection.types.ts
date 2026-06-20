/**
 * SEO Projection forward-writer — types & constants (ADR-059 PR-6b / ADR-090 §C1-C4).
 *
 * Le writer CONSOMME des exports/seo/*.json DÉJÀ vérifiés côté wiki (promotion TIER A,
 * gates ADR-088/089) et les projette dans la DB versionnée (__seo_entity_facts/_versions,
 * __seo_content_blocks/_versions) créée par la migration PR-6.
 *
 * Invariants (ADR-059 §Interdictions + ADR-090 §C4) :
 *   - INSERT-new-version-NEVER-UPDATE : on n'écrase jamais une version, on insère + flippe active_version_id.
 *   - no-rétro-régression par section : une version "pire" est insérée en status='draft' (jamais active).
 *   - fail-closed : toute erreur de gate/écriture → conflit observable, jamais de fallback silencieux.
 *   - flag seo_projection_read_v1 OFF par défaut → read-path dark ; le WRITE est découplé du READ.
 *
 * @see governance-vault ADR-059 (SEO Runtime Projection) + ADR-090 (Forward Writer Canon)
 */

/** Queues BullMQ (ADR-059 §Découplage write↔refresh). Réutilise @nestjs/bull (Bull), pas de nouvelle infra. */
export const PROJECTION_WRITE_QUEUE = 'projection-write-queue';
export const PROJECTION_REFRESH_QUEUE = 'projection-refresh-queue';

export const PROJECTION_WRITE_JOB = 'seo-projection-write';
export const PROJECTION_REFRESH_JOB = 'seo-projection-refresh';

/** Version du contrat WRITER (ADR-090 Q1 : découplé du projection_contract_version du runner). */
export const WRITER_CONTRACT_VERSION = '1.0.0';

/** Debounce du refresh (ADR-059 : coalescing 5s, concurrency=1, single-flight). */
export const REFRESH_DEBOUNCE_MS = 5_000;

export type ProjectionTriggeredBy = 'cron' | 'manual' | 'replay' | 'test';
export type ProjectionEntityType =
  | 'gamme'
  | 'vehicle'
  | 'constructeur'
  | 'diagnostic';

/** Données du job write : la liste des chemins d'exports à projeter pour ce run. */
export interface ProjectionWriteJobData {
  triggeredBy: ProjectionTriggeredBy;
  /** Chemins absolus des exports/seo/<type>/<slug>.json à projeter. */
  exportPaths: string[];
  /** Métadonnées run (versions semver) pour l'audit trail __seo_projection_runs. */
  runMeta?: Partial<ProjectionRunMeta>;
}

export interface ProjectionRefreshJobData {
  triggeredBy: ProjectionTriggeredBy;
  /** run_id à l'origine du refresh (traçabilité). */
  runId?: string;
}

export interface ProjectionRunMeta {
  projection_contract_version: string | null;
  exports_snapshot_hash: string | null;
  exports_snapshot_uri: string | null;
  wiki_commit_sha: string | null;
  builder_version: string | null;
  pipeline_version: string | null;
  extractor_version: string | null;
  runner_version: string | null;
}

/** Forme minimale d'un export/seo/*.json (mirroir de _meta/schema/exports-seo.schema.json côté wiki). */
export interface SeoProjectionExport {
  entity_id: string;
  entity_type: ProjectionEntityType;
  schema_version: string;
  projection_contract_version: string;
  source_wiki_commit: string;
  wiki_path: string;
  content_hash: string;
  generated_at: string;
  builder_version?: string;
  facts: unknown[];
  sources: unknown[];
  blocks: SeoProjectionBlock[];
  roles_allowed: string[];
  consumers_allowed: string[];
}

/** Niveau de vérité d'un bloc (ADR-086). Porte la provenance lue par D1/D2 (sépare DB-owned de sourced). */
export type BlockTruthLevel = 'db_owned' | 'sourced' | 'inferred' | 'editorial';

/**
 * Bloc tel qu'émis par le builder wiki — forme **FLAT**, miroir de `exports-seo.schema.json`
 * (`role`, `content_md`, `source_ids`, `truth_level` requis ; `section`/`usefulness_target` optionnels ;
 * provenance citable D3 optionnelle). Le writer l'**adapte** vers la forme DB (`block_kind` + `content`
 * jsonb, tous deux NOT NULL) via `mapExportBlockToDbBlock` — voir writer. Aucun enrichissement.
 */
export interface SeoProjectionBlock {
  role: string;
  content_md: string;
  source_ids: string[];
  truth_level: BlockTruthLevel;
  section?: string | null;
  usefulness_target?: string | null;
  // Provenance citable optionnelle (D3 ADR-086) — copiée verbatim dans content si présente, jamais fabriquée.
  evidence_type?: string;
  applies_to?: { scope: string; key: string } | null;
  last_verified_at?: string | null;
  consumer_pages?: string[];
  // Optionnels hérités : si le builder les fournit on les respecte, sinon le writer les dérive.
  block_id?: string;
  block_kind?: string;
  content_hash?: string;
  confidence_base?: number | null;
}

/** Forme DB d'un bloc projeté (cible de l'adaptation `mapExportBlockToDbBlock`). */
export interface ProjectedBlockRow {
  blockId: string;
  blockKind: string;
  content: Record<string, unknown>;
  contentHash: string;
  sourceType: string | null;
  confidenceBase: number | null;
  /** true si block_kind a dû retomber sur un index positionnel (section absente) — à loguer (observable). */
  kindFallback: boolean;
}

/** Verdict d'une porte (CanonGate / QualityGate). Fail-closed : `ok=false` → conflit observable, pas d'écriture. */
export interface GateVerdict {
  gate: 'canon' | 'quality';
  ok: boolean;
  reasons: string[];
}

/** Résultat d'écriture d'une entité (observable, jamais silencieux). */
export interface EntityWriteOutcome {
  entity_id: string;
  status: 'written' | 'noop' | 'blocked' | 'regressed_draft';
  factsVersionId?: string;
  blocksWritten?: number;
  conflicts?: number;
  reasons?: string[];
}

export interface ProjectionRunResult {
  runId: string | null;
  triggeredBy: ProjectionTriggeredBy;
  entitiesWritten: number;
  outcomes: EntityWriteOutcome[];
  refreshEnqueued: boolean;
  readOnlySkipped?: boolean;
}
