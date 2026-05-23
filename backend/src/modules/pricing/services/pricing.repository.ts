/**
 * Pricing repository — all Supabase I/O behind one injectable boundary, so the
 * orchestration (dry-run/commit) stays pure and testable. Untyped SupabaseClient
 * (SupabaseBaseService) → new control-plane tables addressed by string name.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { eurToCents } from './pricing-formula.service';
import { normalizeSupplierReference } from '../utils/normalize-supplier-reference';
import type { CatalogPiece, ExistingPriceRow } from './price-import.dry-run';
import type { SupplierPriceProfile } from './supplier-profile.service';
import type { PricingRule } from './pricing-strategy.service';
import type { CostBucketAggregate } from './pricing-simulation.core';

const PAGE = 1000; // supabase-js caps a single select at 1000 rows → paginate

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

  /** Atomic per-chunk commit via the server-side function. */
  async commitChunk(input: {
    batchId: string;
    chunkId: string;
    supplier: string;
    operator: string | null;
    rows: CommitRowPayload[];
  }): Promise<{ committed: number; skipped: number; missing: number }> {
    const { data, error } = await this.callRpc('pricing_commit_chunk', {
      p_batch_id: input.batchId,
      p_chunk_id: input.chunkId,
      p_supplier: input.supplier,
      p_operator: input.operator,
      p_rows: input.rows,
    });
    if (error) throw error;
    return data as { committed: number; skipped: number; missing: number };
  }

  async rollbackBatch(
    batchId: string,
    supplier: string,
  ): Promise<{ restored: number; superseded: number }> {
    const { data, error } = await this.callRpc('pricing_rollback_batch', {
      p_batch_id: batchId,
      p_supplier: supplier,
    });
    if (error) throw error;
    return data as { restored: number; superseded: number };
  }

  async fetchProfiles(supplierId: string): Promise<SupplierPriceProfile[]> {
    const { data, error } = await this.supabase
      .from('supplier_price_profiles')
      .select('*')
      .eq('supplier_id', supplierId)
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
    const { data, error } = await this.callRpc(
      'pricing_cost_bucket_aggregates',
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
