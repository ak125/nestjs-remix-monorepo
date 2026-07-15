/**
 * SeoProjectionWriterService — cœur du forward-writer (ADR-059 PR-6b / ADR-090 §C4).
 *
 * Projette des exports/seo/*.json (déjà TIER A côté wiki) dans la DB versionnée :
 *   1. ouvre un run (__seo_projection_runs, status=running) ;
 *   2. par entité : 2 portes (CanonGate→QualityGate) → si KO, conflit observable (jamais d'écriture) ;
 *   3. si OK : INSERT-new-version (facts + blocks) puis flip active_version_id (JAMAIS UPDATE en place) ;
 *      no-op si content_hash identique ; no-rétro-régression par bloc (version "pire" insérée en draft) ;
 *   4. ferme le run (succeeded/failed) ; enqueue un refresh (débounce, hors-tx).
 *
 * Fail-closed partout : toute erreur trace un conflit + marque le run failed, jamais de fallback silencieux.
 * READ_ONLY (PREPROD, ADR-028) → aucune écriture (skip observable). service_role uniquement (RLS write).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import stableStringify from 'fast-json-stable-stringify';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { getAppConfig } from '../../config/app.config';
import { getErrorMessage } from '@common/utils/error.utils';
import { SeoProjectionGateService } from './seo-projection-gate.service';
import {
  buildAndPublishSnapshot,
  type SnapshotEntry,
} from './seo-projection-snapshot';
import {
  type EntityWriteOutcome,
  type ProjectionRunMeta,
  type ProjectionRunResult,
  type ProjectionTriggeredBy,
  type ProjectedBlockRow,
  type SeoProjectionBlock,
  type SeoProjectionExport,
  OBJECT_STORE_ROOT_DEFAULT,
  PROJECTION_BUILDER_VERSION,
  PROJECTION_CONTRACT_FALLBACK,
  PROJECTION_EXTRACTOR_VERSION,
  PROJECTION_PIPELINE_VERSION,
  PROJECTION_RUNNER_VERSION,
  WRITER_CONTRACT_VERSION,
} from './seo-projection.types';

/** Semver strict `MAJOR.MINOR.PATCH` (miroir de `replay_projection.py:verify_versions_complete`). */
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** Retourne `candidate` s'il est un semver valide, sinon `fallback`. */
function semverOr(candidate: unknown, fallback: string): string {
  return typeof candidate === 'string' && SEMVER_RE.test(candidate)
    ? candidate
    : fallback;
}

/** Les 5 versions canoniques du run (toutes semver valides — condition NÉCESSAIRE du replay). */
interface RunVersions {
  projection_contract_version: string;
  builder_version: string;
  pipeline_version: string;
  extractor_version: string;
  runner_version: string;
}

/** Métadonnées lues best-effort sur le 1er export (seed des versions + wiki_commit du run). */
interface ExportSeedMeta {
  projectionContractVersion?: string;
  builderVersion?: string;
  wikiCommitSha?: string | null;
}

/** Slug déterministe (kebab, ascii) pour dériver block_kind depuis `section`. */
function slugifyKind(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Adapte un bloc d'export **FLAT** (`role`/`content_md`/`source_ids`/`truth_level` + `section`/
 * `usefulness_target` + provenance D3 optionnelle) vers la forme **DB** versionnée
 * (`block_kind` + `content` jsonb, tous deux NOT NULL). Déterministe, **sans perte, sans enrichissement** :
 * toute la provenance est copiée verbatim dans `content`. `block_kind = slug(section)` ; fallback
 * positionnel `b<index>` si `section` absente (jamais de collision, jamais de silent-fallback — l'appelant
 * logue `kindFallback`). `content_hash` recalculé sur le `content` réel → no-op detection correcte par bloc.
 */
export function mapExportBlockToDbBlock(
  entityId: string,
  b: SeoProjectionBlock,
  index: number,
): ProjectedBlockRow {
  const sectionSlug = slugifyKind((b.section ?? '').trim());
  const kindFallback = sectionSlug === '';
  const blockKind =
    b.block_kind?.trim() || (kindFallback ? `b${index}` : sectionSlug);
  const blockId = b.block_id ?? `${entityId}#${b.role}#${blockKind}`;

  // content jsonb = contenu citable verbatim (zéro enrichissement, ordre de clés déterministe pour le hash).
  const content: Record<string, unknown> = {
    content_md: b.content_md,
    source_ids: b.source_ids ?? [],
    truth_level: b.truth_level,
  };
  if (b.section != null) content.section = b.section;
  if (b.usefulness_target != null)
    content.usefulness_target = b.usefulness_target;
  if (b.evidence_type != null) content.evidence_type = b.evidence_type;
  if (b.applies_to != null) content.applies_to = b.applies_to;
  if (b.last_verified_at != null) content.last_verified_at = b.last_verified_at;
  if (b.consumer_pages != null) content.consumer_pages = b.consumer_pages;

  // Hash déterministe = sha256 sur une sérialisation à ordre de clés STABLE
  // (`fast-json-stable-stringify`, convention repo cf. seo-control.service.ts). Remplace
  // `md5(JSON.stringify(...))` : md5 est faible et `JSON.stringify` dépend de l'ordre d'insertion
  // (deux `content` équivalents pouvaient produire des hash différents → no-op detection cassée).
  const contentHash =
    b.content_hash ??
    createHash('sha256').update(stableStringify(content)).digest('hex');

  return {
    blockId,
    blockKind,
    content,
    contentHash,
    sourceType: b.truth_level ?? null,
    confidenceBase:
      typeof b.confidence_base === 'number' ? b.confidence_base : null,
    kindFallback,
  };
}

@Injectable()
export class SeoProjectionWriterService extends SupabaseBaseService {
  private readonly log = new Logger(SeoProjectionWriterService.name);
  private readonly readOnly = getAppConfig().supabase.readOnly;

  constructor(
    configService: ConfigService,
    private readonly gate: SeoProjectionGateService,
  ) {
    super(configService);
  }

  /**
   * Projette une liste d'exports. Retourne un résultat observable (jamais d'exception non tracée).
   * `projectionRole` (P2-B) : quand présent, N'ÉCRIT QUE les blocs de ce rôle (facts partagés
   * inchangés) → une canary mono-rôle ne réécrit jamais les autres rôles de la même entité.
   */
  async projectExports(
    exportPaths: string[],
    triggeredBy: ProjectionTriggeredBy = 'manual',
    runMeta: Partial<ProjectionRunMeta> = {},
    projectionRole?: string,
  ): Promise<ProjectionRunResult> {
    if (this.readOnly) {
      this.log.log(
        `[READ_ONLY] projection write skipped (${exportPaths.length} exports, ${triggeredBy})`,
      );
      return {
        runId: null,
        triggeredBy,
        entitiesWritten: 0,
        rolesWritten: 0,
        rolesNoop: 0,
        rolesBlocked: 0,
        rolesRegressed: 0,
        outcomes: [],
        refreshEnqueued: false,
        readOnlySkipped: true,
        snapshot: null,
      };
    }

    // Versions semver résolues depuis l'export + composants writer (jamais le `pipeline_version`
    // non-semver historique du feeder). Seed = 1er export lisible (best-effort, fail-open sur meta).
    const seed = await this.readExportMeta(exportPaths[0]);
    const versions = this.resolveRunVersions(seed, runMeta);
    const runId = await this.openRun(
      triggeredBy,
      versions,
      seed.wikiCommitSha ?? runMeta.wiki_commit_sha ?? null,
    );

    const outcomes: EntityWriteOutcome[] = [];
    for (const p of exportPaths) {
      outcomes.push(await this.projectOne(p, runId, projectionRole));
    }

    const entitiesWritten = outcomes.filter(
      (o) => o.factsOutcome === 'written',
    ).length;
    const rolesWritten = outcomes.filter(
      (o) => o.roleOutcome === 'written',
    ).length;
    const rolesNoop = outcomes.filter((o) => o.roleOutcome === 'noop').length;
    const rolesBlocked = outcomes.filter(
      (o) => o.roleOutcome === 'blocked',
    ).length;
    const rolesRegressed = outcomes.filter(
      (o) => o.roleOutcome === 'regressed_draft',
    ).length;

    // Snapshot durable AVANT de marquer `succeeded` : l'archive tar.zst immutable + le hash calculé
    // sur les octets PERSISTÉS sont la seule autorité de replay (ADR-059). Échec publication → failed.
    let snapshot: { hash: string; uri: string } | null = null;
    let snapshotError: string | null = null;
    if (runId) {
      try {
        snapshot = await this.buildSnapshotForRun(
          exportPaths,
          runId,
          seed.wikiCommitSha ?? runMeta.wiki_commit_sha ?? null,
          versions,
        );
      } catch (e) {
        snapshotError = getErrorMessage(e);
        this.log.error(
          `snapshot publish failed (run=${runId}): ${snapshotError}`,
        );
        await this.recordConflict(
          '?',
          null,
          'snapshot_publish_failed',
          { error: snapshotError },
          runId,
        );
      }
    }

    await this.closeRun(runId, {
      entitiesWritten,
      // succeeded UNIQUEMENT si aucun rôle bloqué ET snapshot durable publié.
      failed: rolesBlocked > 0 || snapshotError != null,
      snapshot,
    });

    return {
      runId,
      triggeredBy,
      entitiesWritten,
      rolesWritten,
      rolesNoop,
      rolesBlocked,
      rolesRegressed,
      outcomes,
      refreshEnqueued: false,
      snapshot,
    };
  }

  /** Projette un export. Fail-closed : erreur → conflit + roleOutcome blocked, jamais de throw. */
  private async projectOne(
    exportPath: string,
    runId: string | null,
    role?: string,
  ): Promise<EntityWriteOutcome> {
    let exp: SeoProjectionExport;
    try {
      exp = JSON.parse(
        await fs.readFile(exportPath, 'utf-8'),
      ) as SeoProjectionExport;
    } catch (e) {
      await this.recordConflict(
        '?',
        null,
        'export_unreadable',
        { path: exportPath, error: String(e) },
        runId,
      );
      return {
        entity_id: exportPath,
        role: role ?? null,
        factsOutcome: 'noop',
        roleOutcome: 'blocked',
        reasons: [`export illisible: ${String(e)}`],
      };
    }

    // Rôle demandé (P2 single-role) absent de roles_allowed → bloqué (trigger mal dirigé), rien
    // écrit (ni facts ni blocs). Le gate ne vérifie QUE la pureté des blocs, pas le rôle demandé.
    if (role && !(exp.roles_allowed ?? []).includes(role)) {
      await this.recordConflict(
        exp.entity_id,
        null,
        'role_not_allowed',
        { role, roles_allowed: exp.roles_allowed },
        runId,
      );
      return {
        entity_id: exp.entity_id,
        role,
        factsOutcome: 'noop',
        roleOutcome: 'blocked',
        reasons: [`role '${role}' absent de roles_allowed`],
      };
    }

    const { ok, verdicts } = this.gate.evaluate(exp);
    if (!ok) {
      const reasons = verdicts.flatMap((v) => v.reasons);
      await this.recordConflict(
        exp.entity_id,
        null,
        'gate_blocked',
        { verdicts },
        runId,
      );
      return {
        entity_id: exp.entity_id,
        role: role ?? null,
        factsOutcome: 'noop',
        roleOutcome: 'blocked',
        reasons,
      };
    }

    try {
      return await this.writeEntity(exp, runId, role);
    } catch (e) {
      await this.recordConflict(
        exp.entity_id,
        null,
        'write_error',
        { error: String(e) },
        runId,
      );
      return {
        entity_id: exp.entity_id,
        role: role ?? null,
        factsOutcome: 'noop',
        roleOutcome: 'blocked',
        reasons: [`écriture: ${String(e)}`],
      };
    }
  }

  /**
   * Écrit une entité en découplant **FACTS partagés** et **BLOCS du rôle** (régression non-négociable
   * P2-B) : un facts no-op ne court-circuite JAMAIS l'écriture des blocs du rôle demandé. Trigger R3
   * → facts written + blocs R3 ; re-trigger R4 sur le même export inchangé → facts noop MAIS blocs R4
   * écrits, sans réécrire un bloc R3.
   */
  private async writeEntity(
    exp: SeoProjectionExport,
    runId: string | null,
    role?: string,
  ): Promise<EntityWriteOutcome> {
    // 1. Upsert la ligne entity (idempotent ; ne touche pas active_version_id ici).
    await this.supabase.from('__seo_entity_facts').upsert(
      {
        entity_id: exp.entity_id,
        entity_type: exp.entity_type,
        slug:
          exp.wiki_path.split('/').pop()?.replace(/\.md$/, '') ?? exp.entity_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entity_id' },
    );

    // 2. FACTS partagés — INSERT-new-version + flip, ou no-op. Résultat INDÉPENDANT du rôle.
    const facts = await this.writeFacts(exp, runId);

    // 3. BLOCS du rôle demandé (ou tous si slurp) — TOUJOURS exécuté, même sur un facts no-op.
    const blocks = await this.writeBlocks(exp, runId, role);
    const roleOutcome: EntityWriteOutcome['roleOutcome'] =
      blocks.written > 0
        ? 'written'
        : blocks.regressed > 0
          ? 'regressed_draft'
          : 'noop';

    return {
      entity_id: exp.entity_id,
      role: role ?? null,
      factsOutcome: facts.written ? 'written' : 'noop',
      roleOutcome,
      factsVersionId: facts.versionId,
      blocksWritten: blocks.written,
      conflicts: blocks.regressed,
    };
  }

  /**
   * FACTS partagés de l'entité : no-op si `content_hash` identique à l'active, sinon INSERT-new-version
   * (`status='active'`) + dépréciation de l'ancienne + flip du pointeur (JAMAIS d'UPDATE en place).
   */
  private async writeFacts(
    exp: SeoProjectionExport,
    runId: string | null,
  ): Promise<{ written: boolean; versionId?: string }> {
    const { data: active } = await this.supabase
      .from('__seo_entity_fact_versions')
      .select('content_hash')
      .eq('entity_id', exp.entity_id)
      .eq('status', 'active')
      .maybeSingle();

    if (active?.content_hash === exp.content_hash) {
      return { written: false };
    }

    const { data: ins, error } = await this.supabase
      .from('__seo_entity_fact_versions')
      .insert({
        entity_id: exp.entity_id,
        status: 'active',
        content_hash: exp.content_hash,
        facts: exp.facts,
        run_id: runId,
      })
      .select('version_id')
      .single();
    if (error || !ins)
      throw new Error(`insert fact_version: ${error?.message ?? 'no row'}`);

    await this.supabase
      .from('__seo_entity_fact_versions')
      .update({ status: 'deprecated', valid_to: new Date().toISOString() })
      .eq('entity_id', exp.entity_id)
      .eq('status', 'active')
      .neq('version_id', ins.version_id);
    await this.supabase
      .from('__seo_entity_facts')
      .update({
        active_version_id: ins.version_id,
        updated_at: new Date().toISOString(),
      })
      .eq('entity_id', exp.entity_id);

    return { written: true, versionId: ins.version_id };
  }

  /**
   * Écrit les blocs — **role-scoped** (P2-B) : si `role` fourni, ne projette QUE ses blocs (les autres
   * rôles de l'entité restent intacts) ; sinon tous (slurp legacy). L'INDEX POSITIONNEL est celui du
   * tableau COMPLET (pas du filtré) → `block_kind` fallback `b<index>` STABLE quel que soit le rôle
   * demandé (sinon un même bloc obtiendrait 2 block_id selon slurp vs role-scoped → no-op cassé).
   * No-rétro-régression PAR BLOC (version "pire" → draft, jamais active).
   */
  private async writeBlocks(
    exp: SeoProjectionExport,
    runId: string | null,
    role?: string,
  ): Promise<{ written: number; regressed: number; noop: number }> {
    let written = 0;
    let regressed = 0;
    let noop = 0;
    const blocks = exp.blocks ?? [];
    for (let index = 0; index < blocks.length; index += 1) {
      const b = blocks[index];
      if (role && b?.role !== role) continue; // role-scoped : ignore les autres rôles (index préservé)
      // Adapte le bloc FLAT (builder) → forme DB (block_kind + content jsonb NOT NULL). Sans perte.
      const row = mapExportBlockToDbBlock(exp.entity_id, b, index);
      if (row.kindFallback) {
        this.log.warn(
          `bloc sans 'section' (${exp.entity_id} role=${b.role} #${index}) → block_kind positionnel '${row.blockKind}' (observable, pas de fallback silencieux)`,
        );
      }
      await this.supabase.from('__seo_content_blocks').upsert(
        {
          block_id: row.blockId,
          entity_id: exp.entity_id,
          role: b.role,
          block_kind: row.blockKind,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'block_id' },
      );

      const { data: active } = await this.supabase
        .from('__seo_content_block_versions')
        .select('content_hash, confidence_base')
        .eq('block_id', row.blockId)
        .eq('status', 'active')
        .maybeSingle();

      if (active?.content_hash === row.contentHash) {
        noop += 1;
        continue; // no-op
      }

      // no-rétro-régression : si une version active existe avec une confiance strictement supérieure, on
      // insère la nouvelle en draft (jamais active) + conflit observable.
      const wouldRegress =
        active != null &&
        typeof active.confidence_base === 'number' &&
        row.confidenceBase != null &&
        row.confidenceBase < active.confidence_base;

      const { data: ins, error } = await this.supabase
        .from('__seo_content_block_versions')
        .insert({
          block_id: row.blockId,
          status: wouldRegress ? 'draft' : 'active',
          content_hash: row.contentHash,
          confidence_base: row.confidenceBase,
          source_type: row.sourceType,
          content: row.content,
          run_id: runId,
        })
        .select('version_id')
        .single();
      if (error || !ins)
        throw new Error(
          `insert block_version ${row.blockId}: ${error?.message ?? 'no row'}`,
        );

      if (wouldRegress) {
        await this.recordConflict(
          exp.entity_id,
          row.blockId,
          'would_regress',
          { newHash: row.contentHash, kept_active: true },
          runId,
        );
        regressed += 1;
        continue; // ne flippe PAS l'active : le contenu meilleur est conservé
      }
      await this.supabase
        .from('__seo_content_block_versions')
        .update({ status: 'deprecated', valid_to: new Date().toISOString() })
        .eq('block_id', row.blockId)
        .eq('status', 'active')
        .neq('version_id', ins.version_id);
      await this.supabase
        .from('__seo_content_blocks')
        .update({
          active_version_id: ins.version_id,
          updated_at: new Date().toISOString(),
        })
        .eq('block_id', row.blockId);
      written += 1;
    }
    return { written, regressed, noop };
  }

  /**
   * Refresh des 2 MV de projection via la RPC gouvernée `refresh_seo_projection_mvs`
   * (SECURITY DEFINER, service_role only — migration PR-6c `20260619_adr059_pr6c_*`).
   * Appel via le wrapper gouverné `callRpc()` (RPC Safety Gate : jamais d'appel Supabase RPC
   * direct ; `source='internal'` = déclenché par le worker refresh, pas une requête API publique).
   * Le REFRESH est NON-concurrent côté SQL (CONCURRENTLY impossible dans la transaction PostgREST
   * et sur une MV `WITH NO DATA`) ; lock ACCESS EXCLUSIVE bref, acceptable tant que le read-path
   * est dark (flag seo_projection_read_v1 OFF, RPC read = PR-7).
   * Fail-closed : toute erreur RPC → `{ refreshed:false, error }` loggé, jamais de throw.
   */
  async refreshViews(): Promise<{ refreshed: boolean; error?: string }> {
    if (this.readOnly) return { refreshed: false, error: 'READ_ONLY' };
    const { data, error } = await this.callRpc<
      Array<{ view_name: string; refreshed: boolean }>
    >('refresh_seo_projection_mvs', {}, { source: 'internal' });
    if (error) {
      this.log.error(
        `refreshViews: RPC refresh_seo_projection_mvs KO — ${error.message}`,
      );
      return { refreshed: false, error: error.message };
    }
    const refreshed =
      Array.isArray(data) && data.length > 0 && data.every((r) => r.refreshed);
    this.log.log(
      `refreshViews: ${data?.length ?? 0} MV rafraîchie(s) (refreshed=${refreshed}).`,
    );
    return { refreshed };
  }

  /** Ouvre un run avec les 5 versions canoniques semver déjà résolues (jamais de `...meta` opaque). */
  private async openRun(
    triggeredBy: ProjectionTriggeredBy,
    versions: RunVersions,
    wikiCommitSha: string | null,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('__seo_projection_runs')
      .insert({
        trigger_kind: triggeredBy === 'test' ? 'manual' : triggeredBy,
        status: 'running',
        writer_contract_version: WRITER_CONTRACT_VERSION,
        projection_contract_version: versions.projection_contract_version,
        builder_version: versions.builder_version,
        pipeline_version: versions.pipeline_version,
        extractor_version: versions.extractor_version,
        runner_version: versions.runner_version,
        wiki_commit_sha: wikiCommitSha,
      })
      .select('run_id')
      .single();
    if (error) {
      this.log.error(`openRun failed: ${error.message}`);
      return null;
    }
    return data?.run_id ?? null;
  }

  /**
   * Ferme le run : `succeeded` ⟺ `!failed` ; persiste `exports_snapshot_hash/_uri` (sur les octets
   * PERSISTÉS du tarball) — l'audit trail porte désormais la référence replay authoritative.
   */
  private async closeRun(
    runId: string | null,
    close: {
      entitiesWritten: number;
      failed: boolean;
      snapshot: { hash: string; uri: string } | null;
    },
  ): Promise<void> {
    if (!runId) return;
    await this.supabase
      .from('__seo_projection_runs')
      .update({
        status: close.failed ? 'failed' : 'succeeded',
        entities_written: close.entitiesWritten,
        exports_snapshot_hash: close.snapshot?.hash ?? null,
        exports_snapshot_uri: close.snapshot?.uri ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('run_id', runId);
  }

  /**
   * Résout les 5 versions canoniques (semver garanti) : `projection_contract_version` ← export/runMeta
   * (fallback constant) ; `builder_version` ← export ; `pipeline/extractor/runner` ← composants writer.
   */
  private resolveRunVersions(
    seed: ExportSeedMeta,
    runMeta: Partial<ProjectionRunMeta>,
  ): RunVersions {
    return {
      projection_contract_version: semverOr(
        runMeta.projection_contract_version ?? seed.projectionContractVersion,
        PROJECTION_CONTRACT_FALLBACK,
      ),
      builder_version: semverOr(
        seed.builderVersion,
        PROJECTION_BUILDER_VERSION,
      ),
      pipeline_version: PROJECTION_PIPELINE_VERSION,
      extractor_version: PROJECTION_EXTRACTOR_VERSION,
      runner_version: PROJECTION_RUNNER_VERSION,
    };
  }

  /** Best-effort (fail-open sur la META uniquement) : lit versions + wiki_commit du 1er export. */
  private async readExportMeta(
    firstPath: string | undefined,
  ): Promise<ExportSeedMeta> {
    if (!firstPath) return {};
    try {
      const exp = JSON.parse(
        await fs.readFile(firstPath, 'utf-8'),
      ) as Partial<SeoProjectionExport>;
      return {
        projectionContractVersion: exp.projection_contract_version,
        builderVersion: exp.builder_version,
        wikiCommitSha: exp.source_wiki_commit ?? null,
      };
    } catch {
      return {};
    }
  }

  /** Racine object-store où sont publiés les snapshots (aligné sur `replay_projection.py`). */
  private getObjectStoreRoot(): string {
    return (
      this.configService?.get<string>('SEO_PROJECTION_OBJECT_STORE_ROOT') ??
      OBJECT_STORE_ROOT_DEFAULT
    );
  }

  /**
   * Lit les octets bruts des exports + publie le snapshot tar.zst durable (délègue au builder
   * reproductible). Fail-loud : toute erreur d'I/O remonte → run marqué `failed` par l'appelant.
   */
  private async buildSnapshotForRun(
    exportPaths: string[],
    runId: string,
    wikiCommitSha: string | null,
    versions: RunVersions,
  ): Promise<{ hash: string; uri: string }> {
    const entries: SnapshotEntry[] = [];
    for (const p of exportPaths) {
      entries.push({ name: path.basename(p), data: await fs.readFile(p) });
    }
    const published = await buildAndPublishSnapshot({
      objectStoreRoot: this.getObjectStoreRoot(),
      entries,
      runId,
      wikiCommitSha,
      versions: {
        projection_contract_version: versions.projection_contract_version,
        builder_version: versions.builder_version,
        pipeline_version: versions.pipeline_version,
        extractor_version: versions.extractor_version,
        runner_version: versions.runner_version,
      },
    });
    return { hash: published.hash, uri: published.uri };
  }

  private async recordConflict(
    entityId: string,
    blockId: string | null,
    kind: string,
    detail: Record<string, unknown>,
    runId: string | null,
  ): Promise<void> {
    await this.supabase.from('__seo_projection_conflicts').insert({
      entity_id: entityId,
      block_id: blockId,
      conflict_kind: kind,
      resolution: 'pending',
      detail,
      run_id: runId,
    });
  }
}
