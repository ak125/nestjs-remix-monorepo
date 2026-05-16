/**
 * ADR-072 PR 2D-2 — R8 Parent Enrichment Service (write side).
 *
 * Materializes one row of `__seo_r8_snapshot_store` for a given `type_id` and
 * repoints `__seo_r8_pages.current_snapshot_id` to it atomically, then writes
 * the `R8SnapshotUpdated` integration event into `__seo_outbox_event`
 * (transactional outbox canon).
 *
 * Scope strict PR 2D-2 :
 *   - Status `minimal` only — siblings derived from `auto_type` rows sharing
 *     `type_modele_id` + `type_engine`. No WIKI evidence, no LLM enrichment.
 *   - `enriched` / `stale` / `failed` transitions ship in PR 2H (KG + WIKI).
 *
 * Idempotency canon :
 *   - `version_sha = sha256(canonical(disambiguation_signature))` via
 *     `fast-json-stable-stringify` (MEMORY
 *     feedback_deterministic_input_hash_canonical_json).
 *   - INSERT collides on UNIQUE(version_sha) → existing snapshot reused, no
 *     duplicate row. Re-running the seed for a stable `auto_type` row is a
 *     no-op (re-points pages pointer if already correct = same UPDATE).
 *
 * Race-safety :
 *   - The 3 writes (snapshot INSERT, pages UPDATE, outbox INSERT) are done via
 *     RPC `__seo_r8_publish_snapshot` (PR 2D-2 migration) which wraps them in
 *     a single SQL transaction. JS-side fallback below logs and aborts on
 *     partial writes — RPC is the canonical path.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import stringify from 'fast-json-stable-stringify';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import {
  R8DisambiguationSignature,
  R8DisambiguationSignatureSchema,
  R8SiblingEntry,
} from '../schemas/r8-snapshot.schema';
import {
  R8_SNAPSHOT_CACHE_TOKEN,
  R8SnapshotCacheClient,
} from './r8-snapshot-reader.service';

export interface R8EnrichmentOutcome {
  typeId: number;
  versionSha: string;
  snapshotId: number;
  inserted: boolean; // false = idempotent hit (existing snapshot reused)
  pagesPointerUpdated: boolean;
  outboxEventId: number | null; // null only when RPC reuses an event row
}

interface AutoTypeRow {
  type_id: string;
  type_marque_id: string | null;
  type_modele_id: string | null;
  type_power_ps: string | null;
  type_power_kw: string | null;
  type_year_from: string | null;
  type_year_to: string | null;
  type_month_from: string | null;
  type_month_to: string | null;
  type_body: string | null;
  type_fuel: string | null;
  type_engine: string | null;
  type_liter: string | null;
  type_alias: string | null;
}

const PARSE_INT_RE = /^-?\d+$/;

@Injectable()
export class R8ParentEnrichmentService extends SupabaseBaseService {
  protected readonly logger = new Logger(R8ParentEnrichmentService.name);

  constructor(
    @Optional() configService?: ConfigService,
    @Optional()
    @Inject(R8_SNAPSHOT_CACHE_TOKEN)
    private readonly cache?: R8SnapshotCacheClient | null,
  ) {
    super(configService);
  }

  /**
   * Read-side helpers exposed for tests and the seed job.
   * Pure function : deterministic given the auto_type row + siblings.
   */
  buildDisambiguationSignature(
    parent: AutoTypeRow,
    brandSlug: string,
    modelSlug: string,
    siblings: AutoTypeRow[],
    autoTypeUpdatedAt?: string,
  ): R8DisambiguationSignature {
    const signature: R8DisambiguationSignature = {
      typeId: this.parseIntStrict(parent.type_id),
      brandSlug,
      modelSlug,
      powerHp: this.parseIntNullable(parent.type_power_ps),
      yearsFrom: this.parseIntNullable(parent.type_year_from),
      yearsTo: this.parseIntNullable(parent.type_year_to),
      bodyType: this.nullIfBlank(parent.type_body),
      fuelType: this.nullIfBlank(parent.type_fuel),
      engineCode: this.nullIfBlank(parent.type_engine),
      // Euro norm is not present on auto_type — PR 2H joins KG/WIKI.
      euroNorm: null,
      literage: this.nullIfBlank(parent.type_liter),
      siblings: siblings
        .filter((s) => s.type_id !== parent.type_id)
        .map(
          (s): R8SiblingEntry => ({
            typeId: this.parseIntStrict(s.type_id),
            powerHp: this.parseIntNullable(s.type_power_ps),
            yearsFrom: this.parseIntNullable(s.type_year_from),
            yearsTo: this.parseIntNullable(s.type_year_to),
            bodyType: this.nullIfBlank(s.type_body),
            engineCode: this.nullIfBlank(s.type_engine),
          }),
        )
        .sort((a, b) => a.typeId - b.typeId), // deterministic order → stable sha
      sourceLineage: autoTypeUpdatedAt
        ? { autoTypeUpdatedAt, wikiEvidenceIds: [], llmModel: undefined }
        : undefined,
    };

    // Validate before hashing — catches schema drift at the boundary.
    return R8DisambiguationSignatureSchema.parse(signature);
  }

  /**
   * Deterministic content hash. Same signature → same sha → idempotent INSERT.
   * Uses `fast-json-stable-stringify` (sorted keys) per MEMORY canon.
   */
  computeVersionSha(signature: R8DisambiguationSignature): string {
    const canonical = stringify(signature);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Materialize the minimal R8 snapshot for `typeId`. Idempotent and safe to
   * call from the seed loop, the BullMQ processor, or admin tools.
   */
  async enrichTypeId(
    typeId: number,
    reason: string = 'minimal-seed',
  ): Promise<R8EnrichmentOutcome | null> {
    if (!Number.isInteger(typeId) || typeId <= 0) {
      throw new Error(`Invalid typeId: ${typeId}`);
    }

    const parent = await this.fetchAutoTypeRow(typeId);
    if (!parent) {
      this.logger.warn(
        `enrichTypeId(${typeId}) — auto_type row missing, skipping`,
      );
      return null;
    }

    const { brandSlug, modelSlug } = await this.fetchBrandModelSlugs(parent);
    const siblings = await this.fetchSiblings(parent);
    const signature = this.buildDisambiguationSignature(
      parent,
      brandSlug,
      modelSlug,
      siblings,
    );
    const versionSha = this.computeVersionSha(signature);

    // Canonical write path : RPC wraps INSERT snapshot + UPDATE pages pointer
    // + INSERT outbox event in a single SQL transaction.
    const { data, error } = await this.supabase.rpc(
      '__seo_r8_publish_snapshot',
      {
        p_type_id: typeId,
        p_version_sha: versionSha,
        p_disambiguation_signature: signature,
        p_enrichment_status: 'minimal',
        p_source_lineage: null,
        p_event_reason: reason,
      },
    );

    if (error) {
      this.logger.error(
        `enrichTypeId(${typeId}) RPC __seo_r8_publish_snapshot failed: ${error.message}`,
      );
      throw new Error(`r8_publish_snapshot_failed: ${error.message}`);
    }

    // RPC returns a single row : { snapshot_id, inserted, pages_pointer_updated, outbox_event_id }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.snapshot_id !== 'number') {
      this.logger.error(
        `enrichTypeId(${typeId}) RPC returned malformed payload: ${JSON.stringify(data)}`,
      );
      throw new Error('r8_publish_snapshot_invalid_response');
    }

    // Invalidate Redis L1 (best-effort) so the reader picks up the new pointer.
    await this.invalidateCache(typeId);

    return {
      typeId,
      versionSha,
      snapshotId: row.snapshot_id,
      inserted: row.inserted === true,
      pagesPointerUpdated: row.pages_pointer_updated === true,
      outboxEventId:
        typeof row.outbox_event_id === 'number' ? row.outbox_event_id : null,
    };
  }

  private async fetchAutoTypeRow(typeId: number): Promise<AutoTypeRow | null> {
    const { data, error } = await this.supabase
      .from('auto_type')
      .select(
        'type_id, type_marque_id, type_modele_id, type_power_ps, type_power_kw, type_year_from, type_year_to, type_month_from, type_month_to, type_body, type_fuel, type_engine, type_liter, type_alias',
      )
      .eq('type_id', String(typeId))
      .maybeSingle();

    if (error) {
      this.logger.error(`fetchAutoTypeRow(${typeId}) failed: ${error.message}`);
      return null;
    }
    return (data as AutoTypeRow | null) ?? null;
  }

  private async fetchSiblings(parent: AutoTypeRow): Promise<AutoTypeRow[]> {
    if (!parent.type_modele_id) {
      return [];
    }
    let query = this.supabase
      .from('auto_type')
      .select(
        'type_id, type_marque_id, type_modele_id, type_power_ps, type_power_kw, type_year_from, type_year_to, type_month_from, type_month_to, type_body, type_fuel, type_engine, type_liter, type_alias',
      )
      .eq('type_modele_id', parent.type_modele_id)
      .neq('type_id', parent.type_id)
      .limit(50);

    // Engine code grouping is the canonical sibling discriminator (canon
    // ADR-070 §C). When the parent has none we keep all model siblings — the
    // S_SIBLING_TABLE downstream still benefits from the listing.
    if (parent.type_engine && parent.type_engine.trim().length > 0) {
      query = query.eq('type_engine', parent.type_engine);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.warn(
        `fetchSiblings(${parent.type_id}) failed: ${error.message} — empty list`,
      );
      return [];
    }
    return (data as AutoTypeRow[] | null) ?? [];
  }

  private async fetchBrandModelSlugs(
    parent: AutoTypeRow,
  ): Promise<{ brandSlug: string; modelSlug: string }> {
    if (!parent.type_marque_id || !parent.type_modele_id) {
      return { brandSlug: 'unknown', modelSlug: 'unknown' };
    }
    const [brand, model] = await Promise.all([
      this.supabase
        .from('auto_marque')
        .select('marque_alias')
        .eq('marque_id', parent.type_marque_id)
        .maybeSingle(),
      this.supabase
        .from('auto_modele')
        .select('modele_alias')
        .eq('modele_id', parent.type_modele_id)
        .maybeSingle(),
    ]);
    return {
      brandSlug: (brand.data?.marque_alias as string | undefined) ?? 'unknown',
      modelSlug: (model.data?.modele_alias as string | undefined) ?? 'unknown',
    };
  }

  private async invalidateCache(typeId: number): Promise<void> {
    if (!this.cache) {
      return;
    }
    try {
      await this.cache.del(`r8:snapshot:${typeId}`);
    } catch (e) {
      this.logger.warn(
        `invalidateCache(${typeId}) failed: ${(e as Error).message}`,
      );
    }
  }

  private parseIntStrict(value: string): number {
    if (!PARSE_INT_RE.test(value)) {
      throw new Error(`Non-numeric type_id: ${value}`);
    }
    return Number.parseInt(value, 10);
  }

  private parseIntNullable(value: string | null): number | null {
    if (value === null || !PARSE_INT_RE.test(value)) {
      return null;
    }
    return Number.parseInt(value, 10);
  }

  private nullIfBlank(value: string | null): string | null {
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
