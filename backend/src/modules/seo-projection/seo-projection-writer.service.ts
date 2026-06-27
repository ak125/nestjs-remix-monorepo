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
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { getAppConfig } from '../../config/app.config';
import { SeoProjectionGateService } from './seo-projection-gate.service';
import {
  type EntityWriteOutcome,
  type ProjectedBlockRow,
  type ProjectionRunMeta,
  type ProjectionRunResult,
  type ProjectionTriggeredBy,
  type SeoProjectionBlock,
  type SeoProjectionExport,
  WRITER_CONTRACT_VERSION,
} from './seo-projection.types';

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

  const contentHash =
    b.content_hash ??
    createHash('md5').update(JSON.stringify(content)).digest('hex');

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

  /** Projette une liste d'exports. Retourne un résultat observable (jamais d'exception non tracée). */
  async projectExports(
    exportPaths: string[],
    triggeredBy: ProjectionTriggeredBy = 'manual',
    runMeta: Partial<ProjectionRunMeta> = {},
  ): Promise<ProjectionRunResult> {
    if (this.readOnly) {
      this.log.log(
        `[READ_ONLY] projection write skipped (${exportPaths.length} exports, ${triggeredBy})`,
      );
      return {
        runId: null,
        triggeredBy,
        entitiesWritten: 0,
        outcomes: [],
        refreshEnqueued: false,
        readOnlySkipped: true,
      };
    }

    const runId = await this.openRun(triggeredBy, runMeta);
    const outcomes: EntityWriteOutcome[] = [];
    let written = 0;

    for (const path of exportPaths) {
      const outcome = await this.projectOne(path, runId);
      outcomes.push(outcome);
      if (outcome.status === 'written') written += 1;
    }

    await this.closeRun(
      runId,
      written,
      outcomes.some((o) => o.status === 'blocked'),
    );
    return {
      runId,
      triggeredBy,
      entitiesWritten: written,
      outcomes,
      refreshEnqueued: false,
    };
  }

  /** Projette un export. Fail-closed : erreur → conflit + outcome blocked, jamais de throw. */
  private async projectOne(
    path: string,
    runId: string | null,
  ): Promise<EntityWriteOutcome> {
    let exp: SeoProjectionExport;
    try {
      exp = JSON.parse(await fs.readFile(path, 'utf-8')) as SeoProjectionExport;
    } catch (e) {
      await this.recordConflict(
        '?',
        null,
        'export_unreadable',
        { path, error: String(e) },
        runId,
      );
      return {
        entity_id: path,
        status: 'blocked',
        reasons: [`export illisible: ${String(e)}`],
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
      return { entity_id: exp.entity_id, status: 'blocked', reasons };
    }

    try {
      return await this.writeEntity(exp, runId);
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
        status: 'blocked',
        reasons: [`écriture: ${String(e)}`],
      };
    }
  }

  /** INSERT-new-version (facts) + flip active_version_id ; no-op si content_hash identique. */
  private async writeEntity(
    exp: SeoProjectionExport,
    runId: string | null,
  ): Promise<EntityWriteOutcome> {
    // Upsert la ligne entity (idempotent ; ne touche pas active_version_id ici).
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

    // no-op detection : la version active a-t-elle déjà ce content_hash ?
    const { data: active } = await this.supabase
      .from('__seo_entity_fact_versions')
      .select('content_hash')
      .eq('entity_id', exp.entity_id)
      .eq('status', 'active')
      .maybeSingle();

    if (active?.content_hash === exp.content_hash) {
      return { entity_id: exp.entity_id, status: 'noop' };
    }

    // INSERT new version (active) — JAMAIS d'UPDATE d'une version existante.
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

    // Déprécier l'ancienne active + flip le pointeur (audit trail préservé, jamais DELETE).
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

    const blocksWritten = await this.writeBlocks(exp, runId);
    return {
      entity_id: exp.entity_id,
      status: 'written',
      factsVersionId: ins.version_id,
      blocksWritten: blocksWritten.written,
      conflicts: blocksWritten.regressed,
    };
  }

  /** Écrit les blocks rôle-aware ; no-rétro-régression PAR BLOC (version "pire" → draft, pas active). */
  private async writeBlocks(
    exp: SeoProjectionExport,
    runId: string | null,
  ): Promise<{ written: number; regressed: number }> {
    let written = 0;
    let regressed = 0;
    const blocks = exp.blocks ?? [];
    for (let index = 0; index < blocks.length; index += 1) {
      const b = blocks[index];
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

      if (active?.content_hash === row.contentHash) continue; // no-op

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
    return { written, regressed };
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

  private async openRun(
    triggeredBy: ProjectionTriggeredBy,
    meta: Partial<ProjectionRunMeta>,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('__seo_projection_runs')
      .insert({
        trigger_kind: triggeredBy === 'test' ? 'manual' : triggeredBy,
        status: 'running',
        writer_contract_version: WRITER_CONTRACT_VERSION,
        ...meta,
      })
      .select('run_id')
      .single();
    if (error) {
      this.log.error(`openRun failed: ${error.message}`);
      return null;
    }
    return data?.run_id ?? null;
  }

  private async closeRun(
    runId: string | null,
    written: number,
    hadBlocked: boolean,
  ): Promise<void> {
    if (!runId) return;
    await this.supabase
      .from('__seo_projection_runs')
      .update({
        status: hadBlocked ? 'failed' : 'succeeded',
        entities_written: written,
        finished_at: new Date().toISOString(),
      })
      .eq('run_id', runId);
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
