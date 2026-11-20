/**
 * Pricing repository — all Supabase I/O behind one injectable boundary, so the
 * orchestration (dry-run/commit) stays pure and testable. Untyped SupabaseClient
 * (SupabaseBaseService) → new control-plane tables addressed by string name.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DISPOS_VENDABLES, ETAT_TARIF_GELE } from '@database/services/vendable';
import { eurToCents } from './pricing-formula.service';
import { normalizeSupplierReference } from '../utils/normalize-supplier-reference';
import type { CatalogPiece, ExistingPriceRow } from './price-import.dry-run';
import type { SupplierPriceProfile } from './supplier-profile.service';
import type { PricingRule } from './pricing-strategy.service';
import type { CostBucketAggregate } from './pricing-simulation.core';
import type { GuardBatchRow, SellAtLossScan } from './price-guard-signal.core';

const PAGE = 1000; // supabase-js caps a single select at 1000 rows → paginate
const SCOPE_CHUNK = 200; // ids per `.in()` so a multi-row scope stays under PAGE

/**
 * Valeur de clé de pagination insérée dans un filtre `or` PostgREST. Les clés de
 * pieces_price sont des chiffres (0 valeur atypique au 2026-11-20) : toute autre
 * forme est refusée plutôt qu'échappée, pour qu'aucune valeur ne modifie le filtre.
 */
function keysetValue(v: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) {
    throw new Error(
      'clé de pagination pieces_price inattendue : parcours arrêté',
    );
  }
  return `"${v}"`;
}

/** `price_import_batches.operation` marker of a dispo-withdrawal batch. */
export const DISPO_DEACTIVATION_OPERATION = 'DISPO_DEACTIVATION';

/** One pieces_price row in a withdrawal scope (see resolveDeactivationRows). */
export interface DeactivationScopeRow {
  pieceId: number | null;
  priType: string;
  dispo: string | null;
  state: string;
  stateReason: string | null;
  /** `pri_frs` — supplier label of the row (freshness rule, decision 51). */
  supplierLabel: string | null;
}

/** The sellability inputs of one pieces_price row (decision 51 + quarantine). */
export interface SellabilityRow {
  priType: string;
  dispo: string | null;
  venteTtc: number | null;
  /** `pricing_state` (a FROZEN row is never sellable). */
  state: string | null;
}

/** Summary of one price_import_batches row (guard-fou acknowledgement check). */
export interface BatchSummary {
  batchId: string;
  status: string;
  supplierId: string | null;
  operation: string | null;
  failedRows: number | null;
}

export interface CommitRowPayload {
  piece_id_i: number;
  pri_type: string;
  operation: 'INSERT' | 'UPDATE';
  pm_id: string;
  gros_ht: number;
  remise: number;
  achat_ht: number;
  marge: number;
  vente_ht: number;
  vente_ttc: number;
  /**
   * Real supplier of the tariff (`___xtr_supplier.spl_name`, e.g. 'DCA'), written
   * to `pieces_price.pri_frs` on the committed row only.
   */
  frs: string;
  /**
   * Tariff effective date, ISO `YYYY-MM-DDT00:00:00.000Z` (format of the
   * historical `pieces_price.pri_date_from` text values), written on the
   * committed row only.
   */
  date_from: string;
}

@Injectable()
export class PricingRepository extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Idempotency: an identical file (same hash) already imported? */
  async findRawByHash(sourceHash: string): Promise<number | null> {
    const { data } = await this.supabase
      .from('supplier_import_raw')
      .select('id')
      .eq('source_hash', sourceHash)
      .maybeSingle();
    return (data?.id as number) ?? null;
  }

  async insertRaw(input: {
    supplierId: string;
    sourceFile: string | null;
    sourceHash: string;
    rawPayload: string | null;
    rowCount: number;
  }): Promise<number> {
    const { data, error } = await this.supabase
      .from('supplier_import_raw')
      .insert({
        supplier_id: input.supplierId,
        source_file: input.sourceFile,
        source_hash: input.sourceHash,
        raw_payload: input.rawPayload,
        row_count: input.rowCount,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as number;
  }

  async createBatch(input: {
    supplierId: string;
    rawId: number;
    sourceFile: string | null;
    sourceFileHash: string;
    operator: string | null;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('price_import_batches')
      .insert({
        status: 'UPLOADED',
        supplier_id: input.supplierId,
        raw_id: input.rawId,
        source_file: input.sourceFile,
        source_file_hash: input.sourceFileHash,
        operator: input.operator,
      })
      .select('batch_id')
      .single();
    if (error) throw error;
    return data.batch_id as string;
  }

  async setBatchStatus(
    batchId: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.supabase
      .from('price_import_batches')
      .update({ status, ...extra })
      .eq('batch_id', batchId);
    if (error) throw error;
  }

  /**
   * Garde-fou des prix (mandat EI) : toutes les lignes de price_import_batches,
   * par pages sous le plafond de 1000 lignes. Une page en erreur rejette.
   */
  async listBatchesForGuardSignal(): Promise<GuardBatchRow[]> {
    const out: GuardBatchRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from('price_import_batches')
        .select(
          'batch_id, supplier_id, operation, status, failed_rows, started_at, completed_at',
        )
        .order('started_at', { ascending: true })
        .order('batch_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as GuardBatchRow[];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  /**
   * Garde-fou des prix (mandat EI) : lignes vendables dont la vente HT est
   * inférieure à l'achat HT (ou absente), comptées par marque. Vendable = les
   * colonnes de pieces_price de `estVendable` (DISPOS_VENDABLES, non gelée, vente
   * TTC > 0) ; `pieces.piece_display` n'est pas lu, le compte est donc un
   * sur-ensemble (jamais un vert de trop). PostgREST ne compare pas deux colonnes :
   * parcours complet par pages, clé de pagination = clé primaire
   * (pri_piece_id, pri_type), comparaison faite ici. Environ 426 pages au
   * 2026-11-20 : à lancer une fois par jour, jamais à chaque requête.
   */
  async scanSellableAtLoss(): Promise<SellAtLossScan> {
    const byBrand = new Map<string, number>();
    let scanned = 0;
    let cursor: { id: string; type: string } | null = null;
    for (;;) {
      let q = this.supabase
        .from('pieces_price')
        .select(
          'pri_piece_id, pri_type, pri_pm_id, pri_achat_ht_n, pri_vente_ht_n, pri_vente_ttc_n, pricing_state',
        )
        .in('pri_dispo', [...DISPOS_VENDABLES])
        .gt('pri_achat_ht_n', 0);
      if (cursor) {
        const id = keysetValue(cursor.id);
        const type = keysetValue(cursor.type);
        q = q.or(
          `pri_piece_id.gt.${id},and(pri_piece_id.eq.${id},pri_type.gt.${type})`,
        );
      }
      const { data, error } = await q
        .order('pri_piece_id', { ascending: true })
        .order('pri_type', { ascending: true })
        .limit(PAGE);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        pri_piece_id: string;
        pri_type: string;
        pri_pm_id: string | null;
        pri_achat_ht_n: number | string | null;
        pri_vente_ht_n: number | string | null;
        pri_vente_ttc_n: number | string | null;
        pricing_state: string | null;
      }>;
      for (const r of rows) {
        if (r.pricing_state === ETAT_TARIF_GELE) continue;
        if (!(Number(r.pri_vente_ttc_n) > 0)) continue;
        scanned++;
        const achat = Number(r.pri_achat_ht_n);
        const vente = r.pri_vente_ht_n == null ? NaN : Number(r.pri_vente_ht_n);
        if (!(achat > 0)) continue;
        if (Number.isFinite(vente) && vente >= achat) continue;
        const pm = r.pri_pm_id ? String(r.pri_pm_id) : 'inconnue';
        byBrand.set(pm, (byBrand.get(pm) ?? 0) + 1);
      }
      if (rows.length < PAGE) return { scanned, byBrand };
      const last = rows[rows.length - 1];
      cursor = { id: String(last.pri_piece_id), type: String(last.pri_type) };
    }
  }

  async createChunk(
    batchId: string,
    seq: number,
    rowFrom: number,
    rowTo: number,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('price_import_batch_chunks')
      .insert({
        batch_id: batchId,
        seq,
        row_from: rowFrom,
        row_to: rowTo,
        status: 'PENDING',
      })
      .select('chunk_id')
      .single();
    if (error) throw error;
    return data.chunk_id as string;
  }

  /**
   * Open a batch for a no-file ACTIVATION run (dispo / display / gamme-display). The
   * optional `operation` marker (e.g. 'GAMME_DISPLAY_ACTIVATION') is a self-describing
   * audit tag on the shared price_import_batches table; null = legacy/unspecified.
   */
  async createActivationBatch(input: {
    supplierId: string;
    operator: string | null;
    operation?: string | null;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('price_import_batches')
      .insert({
        status: 'UPLOADED',
        supplier_id: input.supplierId,
        operator: input.operator,
        ...(input.operation ? { operation: input.operation } : {}),
      })
      .select('batch_id')
      .single();
    if (error) throw error;
    return data.batch_id as string;
  }

  /**
   * Read pieces_price (brand-locked) for a set of supplier refs — the activation
   * scope resolver. Chunked (<=500 refs/query, under the 1000-row cap).
   */
  async resolveActivationRows(
    supplier: string,
    refs: string[],
  ): Promise<
    Map<
      string,
      {
        pieceId: number | null;
        priType: string;
        dispo: string | null;
        state: string;
      }
    >
  > {
    const out = new Map<
      string,
      {
        pieceId: number | null;
        priType: string;
        dispo: string | null;
        state: string;
      }
    >();
    for (let i = 0; i < refs.length; i += 500) {
      const chunk = refs.slice(i, i + 500);
      const { data, error } = await this.supabase
        .from('pieces_price')
        .select('pri_ref, pri_piece_id_i, pri_type, pri_dispo, pricing_state')
        .eq('pri_pm_id', supplier)
        .in('pri_ref', chunk);
      if (error) throw error;
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        out.set(String(r.pri_ref), {
          pieceId: (r.pri_piece_id_i as number | null) ?? null,
          priType: String(r.pri_type ?? '0'),
          dispo: (r.pri_dispo as string | null) ?? null,
          state: String(r.pricing_state ?? ''),
        });
      }
    }
    return out;
  }

  /** Atomic per-chunk commit via the server-side function. */
  async commitChunk(input: {
    batchId: string;
    chunkId: string;
    supplier: string;
    operator: string | null;
    rows: CommitRowPayload[];
    /** false (default) = PENDING (cost only, not sellable); true = activate (pri_dispo='1'). */
    activate?: boolean;
  }): Promise<{ committed: number; skipped: number; missing: number }> {
    const { data, error } = await this.callRpc('pricing_commit_chunk', {
      p_batch_id: input.batchId,
      p_chunk_id: input.chunkId,
      p_supplier: input.supplier,
      p_operator: input.operator,
      p_rows: input.rows,
      p_activate: input.activate ?? false,
    });
    if (error) throw error;
    return data as { committed: number; skipped: number; missing: number };
  }

  /**
   * Dispo-only ACTIVATION via the governed server-side function. Flips pri_dispo
   * null/'0' -> '1' (agence) | '2' (groupe) PER ROW, brand-locked, skipping
   * FROZEN/MANUAL/already-sellable. Reversible via {@link rollbackBatch}
   * (pieces_price_history). Prices are never mutated. See migration
   * 20260606_pricing_activate_chunk.sql.
   */
  async activateChunk(input: {
    batchId: string;
    chunkId: string;
    supplier: string; // pri_pm_id (brand-lock)
    operator: string | null;
    rows: { piece_id_i: number; pri_type: string; dispo: '1' | '2' }[];
  }): Promise<{
    activated: number;
    skipped: number;
    missing: number;
    rejected: number;
  }> {
    const { data, error } = await this.callRpc('pricing_activate_chunk', {
      p_batch_id: input.batchId,
      p_chunk_id: input.chunkId,
      p_supplier: input.supplier,
      p_operator: input.operator,
      p_rows: input.rows,
    });
    if (error) throw error;
    return data as {
      activated: number;
      skipped: number;
      missing: number;
      rejected: number;
    };
  }

  async rollbackBatch(
    batchId: string,
    supplier: string,
  ): Promise<{ restored: number; superseded: number }> {
    // A dispo-withdrawal batch must never go through the generic rollback: it
    // rewrites the text price columns from the numeric ones, which erases the
    // displayed price wherever a numeric column is empty. It has its own
    // dispo-only rollback — see rollbackDeactivationBatch.
    if (
      (await this.getBatchOperation(batchId)) === DISPO_DEACTIVATION_OPERATION
    ) {
      throw new BadRequestException(
        `batch ${batchId} is a ${DISPO_DEACTIVATION_OPERATION} batch — use POST /api/admin/pricing/deactivate/rollback`,
      );
    }
    const { data, error } = await this.callRpc('pricing_rollback_batch', {
      p_batch_id: batchId,
      p_supplier: supplier,
    });
    if (error) throw error;
    return data as { restored: number; superseded: number };
  }

  /** The batch's self-describing `operation` marker (null = legacy/unspecified or unknown batch). */
  async getBatchOperation(batchId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('price_import_batches')
      .select('operation')
      .eq('batch_id', batchId)
      .maybeSingle();
    if (error) throw error;
    return (data?.operation as string | null) ?? null;
  }

  /**
   * Read EVERY pieces_price row (brand-locked) of a set of supplier refs — the
   * withdrawal scope resolver. Unlike {@link resolveActivationRows} (one row per
   * ref), a withdrawal must reach all rows of a ref (pri_type 0/1, or several
   * pieces), or the piece stays sellable through the row left behind. Fails loud
   * on the 1000-row cap instead of truncating.
   */
  async resolveDeactivationRows(
    supplier: string,
    refs: string[],
  ): Promise<Map<string, DeactivationScopeRow[]>> {
    const out = new Map<string, DeactivationScopeRow[]>();
    for (let i = 0; i < refs.length; i += SCOPE_CHUNK) {
      const chunk = refs.slice(i, i + SCOPE_CHUNK);
      const { data, error } = await this.supabase
        .from('pieces_price')
        .select(
          'pri_ref, pri_piece_id_i, pri_type, pri_dispo, pricing_state, pricing_state_reason, pri_frs',
        )
        .eq('pri_pm_id', supplier)
        .in('pri_ref', chunk)
        .limit(PAGE);
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      if (rows.length >= PAGE) {
        throw new Error(
          `resolveDeactivationRows: ${rows.length} rows for ${chunk.length} refs hit the ${PAGE}-row cap`,
        );
      }
      for (const r of rows) {
        const ref = String(r.pri_ref);
        const list = out.get(ref) ?? [];
        list.push({
          pieceId: (r.pri_piece_id_i as number | null) ?? null,
          priType: String(r.pri_type ?? '0'),
          dispo: (r.pri_dispo as string | null) ?? null,
          state: String(r.pricing_state ?? ''),
          stateReason: (r.pricing_state_reason as string | null) ?? null,
          supplierLabel: (r.pri_frs as string | null) ?? null,
        });
        out.set(ref, list);
      }
    }
    return out;
  }

  /**
   * Current sellability + visibility of a set of pieces (brand-locked) — input of
   * the withdrawal dry-run's projection of what catalog_display_quarantine would
   * then hide. Reads only; same predicates as that function (pri_pm_id rows,
   * pieces.piece_pm_id brand-lock, piece_display).
   */
  async fetchSellabilityScope(
    supplier: string,
    pieceIds: number[],
  ): Promise<{
    rows: Map<number, SellabilityRow[]>;
    visibleBrand: Map<number, boolean>;
    /** piece_display, any brand — the decision-51 « not masked » input. */
    displayed: Map<number, boolean>;
  }> {
    const rows = new Map<number, SellabilityRow[]>();
    const visibleBrand = new Map<number, boolean>();
    const displayed = new Map<number, boolean>();
    for (let i = 0; i < pieceIds.length; i += SCOPE_CHUNK) {
      const chunk = pieceIds.slice(i, i + SCOPE_CHUNK);
      const { data, error } = await this.supabase
        .from('pieces_price')
        .select(
          'pri_piece_id_i, pri_type, pri_dispo, pri_vente_ttc_n, pricing_state',
        )
        .eq('pri_pm_id', supplier)
        .in('pri_piece_id_i', chunk)
        .limit(PAGE);
      if (error) throw error;
      const priceRows = (data ?? []) as Array<Record<string, unknown>>;
      if (priceRows.length >= PAGE) {
        throw new Error(
          `fetchSellabilityScope: ${priceRows.length} rows for ${chunk.length} pieces hit the ${PAGE}-row cap`,
        );
      }
      for (const r of priceRows) {
        const pieceId = Number(r.pri_piece_id_i);
        const list = rows.get(pieceId) ?? [];
        list.push({
          priType: String(r.pri_type ?? '0'),
          dispo: (r.pri_dispo as string | null) ?? null,
          venteTtc:
            r.pri_vente_ttc_n == null ? null : Number(r.pri_vente_ttc_n),
          state: (r.pricing_state as string | null) ?? null,
        });
        rows.set(pieceId, list);
      }
      const { data: pieces, error: piecesError } = await this.supabase
        .from('pieces')
        .select('piece_id, piece_display, piece_pm_id')
        .in('piece_id', chunk)
        .limit(PAGE);
      if (piecesError) throw piecesError;
      for (const p of (pieces ?? []) as Array<Record<string, unknown>>) {
        displayed.set(Number(p.piece_id), p.piece_display === true);
        visibleBrand.set(
          Number(p.piece_id),
          p.piece_display === true && String(p.piece_pm_id) === supplier,
        );
      }
    }
    return { rows, visibleBrand, displayed };
  }

  /**
   * Denominator of the 5 % guard (decision 51): sellable rows of a brand —
   * pri_dispo '1', '2' or '3' (decision 118, same set as estVendable), not
   * FROZEN, priced, piece displayed. Head count (no rows transferred). Counts
   * ROWS: on 2026-11-17, 417 470 sellable pieces and 68 pieces with more than
   * one sellable row, so the ratio is read as a share of pieces.
   */
  async countSellablePieces(supplier: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('pieces_price')
      .select(
        'pri_piece_id_i, pieces!fk_pieces_price_piece_i!inner(piece_display)',
        {
          count: 'exact',
          head: true,
        },
      )
      .eq('pri_pm_id', supplier)
      .in('pri_dispo', [...DISPOS_VENDABLES])
      .or('pricing_state.is.null,pricing_state.neq.FROZEN')
      .gt('pri_vente_ttc_n', 0)
      .eq('pieces.piece_display', true)
      // head request: no row is transferred; PostgREST's exact count ignores
      // the limit, which only states the bounded intent (1000-row cap rule).
      .limit(1);
    if (error) throw error;
    if (count == null) {
      throw new Error(`countSellablePieces: no count returned for ${supplier}`);
    }
    return count;
  }

  /** One batch, for checking an owner acknowledgement of a guard halt. */
  async getBatchSummary(batchId: string): Promise<BatchSummary | null> {
    const { data, error } = await this.supabase
      .from('price_import_batches')
      .select('batch_id, status, supplier_id, operation, failed_rows')
      .eq('batch_id', batchId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return {
      batchId: String(r.batch_id),
      status: String(r.status),
      supplierId: (r.supplier_id as string | null) ?? null,
      operation: (r.operation as string | null) ?? null,
      failedRows: r.failed_rows == null ? null : Number(r.failed_rows),
    };
  }

  /**
   * Dispo-only WITHDRAWAL via the governed server-side function: flips pri_dispo
   * '1'/'2'/'3' -> '0' PER ROW, brand-locked, skipping FROZEN/MANUAL, rows already
   * unsellable and rows carrying a state reason; stamps the reason and journals to
   * pieces_price_history. Prices are never mutated. Reversible via
   * {@link rollbackDeactivationBatch} only.
   */
  async deactivateChunk(input: {
    batchId: string;
    chunkId: string;
    supplier: string; // pri_pm_id (brand-lock)
    operator: string | null;
    rows: { piece_id_i: number; pri_type: string; reason: string }[];
  }): Promise<{
    deactivated: number;
    skipped: number;
    missing: number;
    rejected: number;
  }> {
    const { data, error } = await this.callRpc('pricing_deactivate_chunk', {
      p_batch_id: input.batchId,
      p_chunk_id: input.chunkId,
      p_supplier: input.supplier,
      p_operator: input.operator,
      p_rows: input.rows,
    });
    if (error) throw error;
    return data as {
      deactivated: number;
      skipped: number;
      missing: number;
      rejected: number;
    };
  }

  /** LIFO, dispo-only rollback of a withdrawal batch (restores pri_dispo + clears the reason; never touches prices). */
  async rollbackDeactivationBatch(
    batchId: string,
    supplier: string,
  ): Promise<{ restored: number; superseded: number }> {
    const { data, error } = await this.callRpc('pricing_deactivate_rollback', {
      p_batch_id: batchId,
      p_supplier: supplier,
    });
    if (error) throw error;
    return data as { restored: number; superseded: number };
  }

  /**
   * Set-based CATALOG VISIBILITY activation via the governed server-side
   * function. Flips pieces.piece_display false -> true for brand-locked pieces
   * that are ALREADY sellable (pieces_price.pri_dispo IN '1','2') and currently
   * hidden. Idempotent; `dryRun` projects without writing. Reversible via
   * {@link displayRollback}. Never touches gamme/vehicle/price/dispo. See
   * migration 20260607_pricing_catalog_display_activate.sql.
   */
  async displayActivate(input: {
    batchId: string | null; // required by the fn only for a commit
    supplier: string; // pieces.piece_pm_id (brand-lock)
    operator: string | null;
    dryRun: boolean;
  }): Promise<{
    dry_run: boolean;
    supplier: string;
    eligible: number;
    displayed?: number;
    batch_id?: string;
  }> {
    const { data, error } = await this.callRpc('catalog_display_activate', {
      p_batch_id: input.batchId,
      p_supplier: input.supplier,
      p_operator: input.operator,
      p_dry_run: input.dryRun,
    });
    if (error) throw error;
    return data as {
      dry_run: boolean;
      supplier: string;
      eligible: number;
      displayed?: number;
      batch_id?: string;
    };
  }

  /**
   * Set-based CATALOG VISIBILITY quarantine via the governed server-side function —
   * the inverse of {@link displayActivate}. Flips pieces.piece_display true -> false
   * for brand-locked refs that are currently visible AND non-vendable per the
   * storefront isSellable gate (no pieces_price row with pri_dispo IN '1','2','3'
   * AND pri_vente_ttc_n > 0). Structurally disjoint from the activate domain.
   * Idempotent; `dryRun` projects without writing. Reversible via the SAME generic
   * {@link displayRollback} (restores old_display). Never touches gamme/vehicle/
   * price/dispo. See migration 20260607_pricing_catalog_display_quarantine.sql.
   */
  async displayQuarantine(input: {
    batchId: string | null; // required by the fn only for a commit
    supplier: string; // pieces.piece_pm_id (brand-lock)
    operator: string | null;
    dryRun: boolean;
    /** optional cohort scope (pieces.piece_ga_id); null/undefined = whole brand */
    gammeIds?: number[] | null;
  }): Promise<{
    dry_run: boolean;
    supplier: string;
    eligible: number;
    hidden?: number;
    batch_id?: string;
    gamme_ids?: number[] | null;
  }> {
    const { data, error } = await this.callRpc('catalog_display_quarantine', {
      p_batch_id: input.batchId,
      p_supplier: input.supplier,
      p_operator: input.operator,
      p_dry_run: input.dryRun,
      p_gamme_ids: input.gammeIds ?? null,
    });
    if (error) throw error;
    return data as {
      dry_run: boolean;
      supplier: string;
      eligible: number;
      hidden?: number;
      batch_id?: string;
      gamme_ids?: number[] | null;
    };
  }

  /**
   * Reverse a display batch (restores prior piece_display). Generic: reverses BOTH a
   * {@link displayActivate} batch (restores false) and a {@link displayQuarantine}
   * batch (restores true), since the journal records old_display per piece.
   */
  async displayRollback(
    batchId: string,
    supplier: string,
  ): Promise<{ restored: number; batch_id: string }> {
    const { data, error } = await this.callRpc(
      'catalog_display_rollback_batch',
      {
        p_batch_id: batchId,
        p_supplier: supplier,
      },
    );
    if (error) throw error;
    return data as { restored: number; batch_id: string };
  }

  /**
   * Set-based GAMME visibility activation (étape B1) via the governed server-side
   * function. Flips pieces_gamme.pg_display -> '1' for masked LEVEL-4 hub gammes that
   * already contain >=1 brand ref visible & sellable. Idempotent; `dryRun` projects
   * without writing and returns eligible(gammes)/refs(pieces)/gamme_ids for the owner
   * gate. Never touches pg_relfollow/pg_sitemap (gamme stays out of sitemap). Reversible
   * via {@link gammeDisplayRollback}. See migration
   * 20260607_pricing_catalog_gamme_display_activate.sql.
   */
  async gammeDisplayActivate(input: {
    batchId: string | null; // required by the fn only for a commit
    supplier: string; // pieces.piece_pm_id (brand-lock)
    operator: string | null;
    dryRun: boolean;
  }): Promise<{
    dry_run: boolean;
    supplier: string;
    eligible: number;
    refs: number;
    displayed?: number;
    gamme_ids: number[];
    batch_id?: string;
  }> {
    const { data, error } = await this.callRpc(
      'catalog_gamme_display_activate',
      {
        p_batch_id: input.batchId,
        p_supplier: input.supplier,
        p_operator: input.operator,
        p_dry_run: input.dryRun,
      },
    );
    if (error) throw error;
    return data as {
      dry_run: boolean;
      supplier: string;
      eligible: number;
      refs: number;
      displayed?: number;
      gamme_ids: number[];
      batch_id?: string;
    };
  }

  /**
   * Reverse a gamme-display batch (restores prior pg_display) with the server-side
   * anti-conflict guard (only restores gammes whose current pg_display still equals
   * what the batch wrote). Returns rolled_back + skipped_value_changed (a later writer
   * changed it) + skipped_missing_gamme (gamme deleted upstream), classified explicitly.
   */
  async gammeDisplayRollback(
    batchId: string,
    supplier: string,
  ): Promise<{
    rolled_back: number;
    skipped_value_changed: number;
    skipped_missing_gamme: number;
    batch_id: string;
  }> {
    const { data, error } = await this.callRpc(
      'catalog_gamme_display_rollback_batch',
      {
        p_batch_id: batchId,
        p_supplier: supplier,
      },
    );
    if (error) throw error;
    return data as {
      rolled_back: number;
      skipped_value_changed: number;
      skipped_missing_gamme: number;
      batch_id: string;
    };
  }

  /**
   * Governed accessory->main commercial link (data layer, étape PR-1) via the
   * server-side function. Writes pieces_gamme.pg_parent_gamme_id for HIDDEN level-4/5
   * accessories under a valid visible strategic main hub. Hard guards (parent must be
   * level-1/2 + pg_display=1 + pg_relfollow=1; accessory must be level-4/5 + fully
   * hidden) live in the SQL function. `dryRun` projects eligible/rejected without
   * writing. Reversible via {@link accessoryLinkRollback}. Never touches
   * display/sitemap/URL/product. See migration 20260607_pricing_catalog_accessory_link.sql.
   */
  async accessoryLinkActivate(input: {
    batchId: string | null; // required by the fn only for a commit
    mainPgId: number;
    accessoryPgIds: number[];
    operator: string | null;
    dryRun: boolean;
  }): Promise<{
    dry_run: boolean;
    main_pg_id: number;
    eligible_count: number;
    eligible?: { pg_id: number; pg_name: string }[];
    rejected_count: number;
    rejected: { pg_id: number; reason: string }[];
    linked?: number;
    batch_id?: string;
  }> {
    const { data, error } = await this.callRpc(
      'catalog_accessory_link_activate',
      {
        p_batch_id: input.batchId,
        p_main_pg_id: input.mainPgId,
        p_accessory_pg_ids: input.accessoryPgIds,
        p_operator: input.operator,
        p_dry_run: input.dryRun,
      },
    );
    if (error) throw error;
    return data as {
      dry_run: boolean;
      main_pg_id: number;
      eligible_count: number;
      eligible?: { pg_id: number; pg_name: string }[];
      rejected_count: number;
      rejected: { pg_id: number; reason: string }[];
      linked?: number;
      batch_id?: string;
    };
  }

  /**
   * Reverse an accessory-link batch (restores prior pg_parent_gamme_id) with the
   * server-side anti-conflict guard. Returns rolled_back + skipped_value_changed +
   * skipped_missing_gamme.
   */
  async accessoryLinkRollback(batchId: string): Promise<{
    rolled_back: number;
    skipped_value_changed: number;
    skipped_missing_gamme: number;
    batch_id: string;
  }> {
    const { data, error } = await this.callRpc(
      'catalog_accessory_link_rollback_batch',
      { p_batch_id: batchId },
    );
    if (error) throw error;
    return data as {
      rolled_back: number;
      skipped_value_changed: number;
      skipped_missing_gamme: number;
      batch_id: string;
    };
  }

  async fetchProfiles(supplierId: string): Promise<SupplierPriceProfile[]> {
    // Profils d'import seulement : une condition de remise de la fiche
    // fournisseur (profile_kind 'condition', complément CH-3) n'est jamais
    // un profil d'import.
    const { data, error } = await this.supabase
      .from('supplier_price_profiles')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('profile_kind', 'import')
      .eq('active', true);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      scopeLevel: r.scope_level,
      scopeCode: r.scope_code,
      priceBasis: r.price_basis,
      derivation: r.derivation,
      columnMapping: r.column_mapping,
      keyField: r.key_field,
      version: r.version,
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to,
      active: r.active,
    }));
  }

  async fetchRules(): Promise<PricingRule[]> {
    const { data, error } = await this.supabase
      .from('pricing_rules')
      .select('*')
      .eq('active', true);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      minCostCents: Number(r.min_cost_cents),
      maxCostCents: r.max_cost_cents == null ? null : Number(r.max_cost_cents),
      marginRate: Number(r.margin_rate),
      minMarginAmountCents: Number(r.min_margin_amount_cents),
      maxMarginRate:
        r.max_margin_rate == null ? null : Number(r.max_margin_rate),
      customerType: r.customer_type,
      supplierPmId: r.supplier_pm_id,
      categoryGammeId: r.category_gamme_id,
      priority: r.priority,
      active: r.active,
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to,
    }));
  }

  /**
   * Existing price rows for a brand (pri_pm_id), keyed by BOTH normalized ref and
   * EAN → single lookup map for the dry-run matcher.
   */
  async fetchExistingByBrand(
    brandPmId: string,
  ): Promise<Map<string, ExistingPriceRow>> {
    const map = new Map<string, ExistingPriceRow>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from('pieces_price')
        .select(
          'pri_piece_id_i, pri_type, pri_ref, pri_ean, pri_dispo, pri_achat_ht_n, pri_marge_n, pri_vente_ht_n, pri_vente_ttc_n, pri_frais_port_ht_n, pri_frais_supp_ht_n, pri_tva_n, pricing_state',
        )
        .eq('pri_pm_id', brandPmId)
        .eq('pri_type', '0')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = data ?? [];
      for (const r of batch) {
        const row: ExistingPriceRow = {
          priPieceIdI: r.pri_piece_id_i,
          priType: r.pri_type ?? '0',
          achatHtCents: eurToCents(Number(r.pri_achat_ht_n) || 0),
          margePct: Number(r.pri_marge_n) || 0,
          venteHtCents: eurToCents(Number(r.pri_vente_ht_n) || 0),
          venteTtcCents: eurToCents(Number(r.pri_vente_ttc_n) || 0),
          fraisPortHtCents: eurToCents(Number(r.pri_frais_port_ht_n) || 0),
          fraisSuppHtCents: eurToCents(Number(r.pri_frais_supp_ht_n) || 0),
          tvaRate: Number(r.pri_tva_n) || 0.2,
          pricingState: r.pricing_state ?? 'ACTIVE',
          qtySold12m: 0, // populated from catalog_pricing_baseline once built
          dispo: (r.pri_dispo ?? '0').toString(),
        };
        const ref = normalizeSupplierReference(r.pri_ref);
        if (ref) map.set(ref, row);
        const ean = (r.pri_ean ?? '').trim();
        if (ean) map.set(ean, row);
      }
      if (batch.length < PAGE) break;
    }
    return map;
  }

  /**
   * Catalog pieces of a brand that may need a price (INSERT/recovery target),
   * keyed by normalized piece_ref. Paginated (a brand can have 70K+ pieces).
   */
  async fetchCatalogByBrand(
    brandPmId: string,
  ): Promise<Map<string, CatalogPiece>> {
    const map = new Map<string, CatalogPiece>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from('pieces')
        .select('piece_id, piece_ref')
        .eq('piece_pm_id', Number(brandPmId))
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = data ?? [];
      for (const r of batch) {
        const ref = normalizeSupplierReference(r.piece_ref);
        if (ref) map.set(ref, { priPieceIdI: r.piece_id });
      }
      if (batch.length < PAGE) break;
    }
    return map;
  }

  /** Read-only cost-bucket aggregates for the simulation (one server-side GROUP BY). */
  async fetchCostBucketAggregates(): Promise<CostBucketAggregate[]> {
    const { data, error } = await this.callRpc<Array<Record<string, unknown>>>(
      'pricing_cost_bucket_aggregates',
      {},
    );
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      representativeCostCents: Number(r.representative_cost_cents),
      pieceCount: Number(r.piece_count),
      sumAchatXQtyCents: Number(r.sum_achat_x_qty_cents),
      sumVenteTtcXQtyCents: Number(r.sum_vente_ttc_x_qty_cents),
    }));
  }
}
