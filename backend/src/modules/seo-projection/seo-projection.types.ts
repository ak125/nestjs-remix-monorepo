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

/**
 * Feeder R1 (PR-6c, ADR-090 §C2) : queue/job du déclencheur qui découvre les exports/seo/gamme
 * et enqueue des write-jobs. Repeatable BullMQ (le ScheduleModule @nestjs/schedule est désactivé
 * monorepo → pattern canon = repeatable jobs, cf. SitemapV10SchedulerService). Flag-gated OFF.
 */
export const PROJECTION_FEED_QUEUE = 'projection-feed-queue';
export const PROJECTION_FEED_JOB = 'seo-projection-r1-feed';

/** Version du contrat WRITER (ADR-090 Q1 : découplé du projection_contract_version du runner). */
export const WRITER_CONTRACT_VERSION = '1.0.0';

/**
 * Versions semver des composants du forward-writer (P2-R3-B). Source réelle = **ce code**
 * (chaque composant déclare sa propre version, bumpée quand son comportement change) → les 5
 * versions canoniques du run sont TOUJOURS des semver valides, condition NÉCESSAIRE du replay
 * (`replay_projection.py:verify_versions_complete` refuse tout run dont une version manque ou
 * n'est pas `MAJOR.MINOR.PATCH`). `projection_contract_version` provient de l'export lui-même
 * (le contrat que le builder wiki déclare) ; les 4 autres sont les versions des composants writer.
 * Corrige le bug historique : le feeder posait `pipeline_version="r1-feeder/<trigger>"` (non-semver)
 * → tout run réel échouait `validate_run_for_replay`.
 */
export const PROJECTION_BUILDER_VERSION = '1.0.0'; // adaptateur export→DB (mapExportBlockToDbBlock)
export const PROJECTION_PIPELINE_VERSION = '1.0.0'; // pipeline d'écriture (projectExports)
export const PROJECTION_EXTRACTOR_VERSION = '1.0.0'; // extraction facts/blocks depuis l'export
export const PROJECTION_RUNNER_VERSION = '1.0.0'; // runner (processor → writer)
/** Fallback si l'export ne déclare pas de `projection_contract_version` semver exploitable. */
export const PROJECTION_CONTRACT_FALLBACK = '1.0.0';

/** Sous-répertoire object-store des snapshots (miroir `replay_projection.py:SNAPSHOTS_SUBDIR`). */
export const OBJECT_STORE_SNAPSHOTS_SUBDIR = 'exports-snapshots';
/** Racine object-store par défaut (miroir du défaut CLI `replay_projection.py --object-store`). */
export const OBJECT_STORE_ROOT_DEFAULT = '/opt/automecanik/object-store';

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
  /**
   * Rôle de projection à écrire EXCLUSIVEMENT (P2-B role-scoped, ADR-090 §C2). Présent → le
   * writer ne projette QUE les blocs de ce rôle (facts partagés inchangés) → une canary mono-rôle
   * n'écrit jamais « tous les rôles présents dans l'export ». Absent = mode slurp legacy (tous rôles,
   * cron R1). Un GO R3 n'active JAMAIS R4/R6 de la même gamme.
   */
  projectionRole?: string;
  /** Métadonnées run (versions semver) pour l'audit trail __seo_projection_runs. */
  runMeta?: Partial<ProjectionRunMeta>;
}

export interface ProjectionRefreshJobData {
  triggeredBy: ProjectionTriggeredBy;
  /** run_id à l'origine du refresh (traçabilité). */
  runId?: string;
}

/** Données du job feed R1 (PR-6c) : qui a déclenché la découverte d'exports. */
export interface ProjectionFeedJobData {
  triggeredBy: 'scheduler' | 'manual';
}

/** Résultat observable d'un cycle de feed R1 (découverte + enqueue). Jamais silencieux. */
export interface ProjectionFeedResult {
  discovered: number;
  enqueued: boolean;
  exportsDir: string;
  reason?: 'READ_ONLY' | 'NO_EXPORTS_DIR' | 'EMPTY';
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

/**
 * Résultat d'écriture d'une entité (observable, jamais silencieux). **Régression writer
 * non-négociable (P2-B)** : le résultat des FACTS partagés est séparé du résultat du RÔLE demandé.
 *   - `factsOutcome` = état des facts partagés de l'entité (`written` = nouvelle version active,
 *     `noop` = content_hash inchangé). Un `noop` de facts ne DOIT JAMAIS court-circuiter l'écriture
 *     des blocs du rôle (trigger R3 → facts written + blocs R3 ; re-trigger R4 sur le même export
 *     inchangé → facts noop MAIS blocs R4 écrits, sans réécrire un bloc R3).
 *   - `roleOutcome` = état des blocs du `role` demandé (`written` ≥1 bloc flippé actif · `noop`
 *     aucun changement · `blocked` gate/rôle-non-autorisé/erreur, rien écrit · `regressed_draft`
 *     nouvelle version insérée en draft car pire que l'active — jamais promue).
 */
export interface EntityWriteOutcome {
  entity_id: string;
  /** Rôle demandé (P2 single-role) ; `null` = mode slurp legacy (tous rôles). */
  role: string | null;
  factsOutcome: 'written' | 'noop';
  roleOutcome: 'written' | 'noop' | 'blocked' | 'regressed_draft';
  factsVersionId?: string;
  blocksWritten?: number;
  conflicts?: number;
  reasons?: string[];
}

export interface ProjectionRunResult {
  runId: string | null;
  triggeredBy: ProjectionTriggeredBy;
  /** Nb d'entités dont les FACTS ont reçu une nouvelle version active (facts noop non compté). */
  entitiesWritten: number;
  /** Compteurs rôle (P2-B) : partition des `roleOutcome` sur les entités du run. */
  rolesWritten: number;
  rolesNoop: number;
  rolesBlocked: number;
  /** `regressed_draft` (nouvelle version insérée en draft, active préservée) — observable à part. */
  rolesRegressed: number;
  outcomes: EntityWriteOutcome[];
  refreshEnqueued: boolean;
  readOnlySkipped?: boolean;
  /** Snapshot durable publié pour ce run (replay SoT) ; `null` si aucun / échec de publication. */
  snapshot?: { hash: string; uri: string } | null;
}
