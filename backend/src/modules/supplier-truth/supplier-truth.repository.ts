import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/**
 * Supplier Availability Truth — data access (Layers 2 & 3 persistence).
 *
 * Snapshots are APPEND-ONLY: this repository exposes `insertSnapshot` only — no
 * update/delete path exists, by design (immutable observation log). The projection
 * is upserted (1 row per piece_id). The funnel reads ONLY the projection.
 */

const T_SNAPSHOTS = 'supplier_inventory_snapshots';
const T_PROJECTION = 'supplier_truth_projection';
const T_PROFILE = 'supplier_runtime_profile';

export interface SnapshotInsert {
  supplier_id: string;
  piece_id: number | null;
  raw_ref: string;
  normalized_ref: string;
  available: boolean;
  delay_days: number | null;
  parse_error: boolean;
  latency_ms?: number | null;
  source_verified_at?: string | null;
  freshness_provenance: string;
  price_buy_ht?: number | null;
  raw?: unknown;
}
export interface SnapshotRow extends SnapshotInsert {
  id: number;
  fetched_at: string;
}

export interface ProjectionRow {
  piece_id: number;
  state: string;
  confidence: number;
  delay_days: number | null;
  source_supplier: string | null;
  conflict_kind: string;
  state_since?: string;
  state_counter: number;
  projected_at?: string;
  projection_reason_code: string | null;
  projection_metadata?: unknown;
  projection_inputs_hash: string | null;
  projection_version: number;
}

export interface SupplierProfileRow {
  supplier_id: string;
  reliability_score: number | null;
  mismatch_rate: number;
  parse_error_rate: number;
  timeout_rate: number;
  unresolved_rate: number;
  default_ttl_minutes: number | null;
  connector_state: string;
  quarantined_since: string | null;
  recovery_after: string | null;
}

/** A working-set reference + its brand (pm_id), for supplier-carries filtering. */
export interface WorkingSetRef {
  ref: string;
  pmId: number | null;
}

@Injectable()
export class SupplierTruthRepository extends SupabaseBaseService {
  constructor(configService?: ConfigService) {
    super(configService);
  }

  /** APPEND-ONLY. The only write into the snapshot log. */
  async insertSnapshot(snapshot: SnapshotInsert): Promise<void> {
    const { error } = await this.supabase.from(T_SNAPSHOTS).insert(snapshot);
    if (error) {
      throw new Error(`insertSnapshot failed: ${error.message}`);
    }
  }

  /** Latest snapshots for a piece, newest first. */
  async readRecentSnapshots(
    pieceId: number,
    limit = 20,
  ): Promise<SnapshotRow[]> {
    const { data, error } = await this.supabase
      .from(T_SNAPSHOTS)
      .select('*')
      .eq('piece_id', pieceId)
      .order('fetched_at', { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(`readRecentSnapshots failed: ${error.message}`);
    }
    return (data as SnapshotRow[]) ?? [];
  }

  /** Upsert the canonical projection (1 row per piece_id). */
  async upsertProjection(row: ProjectionRow): Promise<void> {
    const { error } = await this.supabase
      .from(T_PROJECTION)
      .upsert(row, { onConflict: 'piece_id' });
    if (error) {
      throw new Error(`upsertProjection failed: ${error.message}`);
    }
  }

  /** Read the canonical projection; null when absent (caller treats as UNKNOWN). */
  async getProjection(pieceId: number): Promise<ProjectionRow | null> {
    const { data, error } = await this.supabase
      .from(T_PROJECTION)
      .select('*')
      .eq('piece_id', pieceId)
      .maybeSingle();
    if (error) {
      throw new Error(`getProjection failed: ${error.message}`);
    }
    return (data as ProjectionRow) ?? null;
  }

  /**
   * Resolve a normalized reference to candidate piece_ids via the EXISTING ref
   * indexes (`pieces_ref_search.prs_search` → `prs_piece_id_i`,
   * `pieces_ref_oem.pro_oem_serach` → `pro_piece_id`). Returns distinct ids;
   * the pure `resolvePieceId` decides OK / AMBIGUOUS / UNRESOLVED.
   */
  async getWorkingSet(limit = 1000): Promise<WorkingSetRef[]> {
    const { data, error } = await this.supabase
      .from('___xtr_order_line')
      .select('orl_art_ref, orl_pm_id')
      .not('orl_art_ref', 'is', null)
      .limit(limit);
    if (error) {
      throw new Error(`getWorkingSet failed: ${error.message}`);
    }
    const seen = new Map<string, WorkingSetRef>();
    for (const r of (data as {
      orl_art_ref: string | null;
      orl_pm_id: unknown;
    }[]) ?? []) {
      const ref = (r.orl_art_ref ?? '').trim();
      if (!ref) continue;
      const pmId = Number(r.orl_pm_id);
      seen.set(ref, { ref, pmId: Number.isInteger(pmId) ? pmId : null });
    }
    return [...seen.values()];
  }

  /**
   * Brands (pm_id) a supplier actually carries, via `___xtr_supplier_link_pm`.
   * The connector is queried ONLY for working-set pieces whose brand is carried —
   * DistriCash does not sell every brand/family/piece (sourcing fallback, no PRI_FRS).
   */
  async getSupplierLinkedBrands(supplierId: string): Promise<number[]> {
    const { data, error } = await this.supabase
      .from('___xtr_supplier_link_pm')
      .select('slpm_pm_id')
      .eq('slpm_spl_id', supplierId);
    if (error) {
      throw new Error(`getSupplierLinkedBrands failed: ${error.message}`);
    }
    const brands = new Set<number>();
    for (const r of (data as { slpm_pm_id: unknown }[]) ?? []) {
      const id = Number(r.slpm_pm_id);
      if (Number.isInteger(id) && id > 0) brands.add(id);
    }
    return [...brands];
  }

  async resolveRefToPieceIds(normalizedRef: string): Promise<number[]> {
    const ids = new Set<number>();

    const { data: bySearch, error: e1 } = await this.supabase
      .from('pieces_ref_search')
      .select('prs_piece_id_i')
      .eq('prs_search', normalizedRef)
      .limit(50);
    if (e1)
      throw new Error(`resolveRefToPieceIds (search) failed: ${e1.message}`);
    for (const r of (bySearch as { prs_piece_id_i: unknown }[]) ?? []) {
      const id = Number(r.prs_piece_id_i);
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }

    const { data: byOem, error: e2 } = await this.supabase
      .from('pieces_ref_oem')
      .select('pro_piece_id')
      .eq('pro_oem_serach', normalizedRef)
      .limit(50);
    if (e2) throw new Error(`resolveRefToPieceIds (oem) failed: ${e2.message}`);
    for (const r of (byOem as { pro_piece_id: unknown }[]) ?? []) {
      const id = Number(r.pro_piece_id);
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }

    return [...ids];
  }

  /** Per-supplier operational profile; null when none yet (cold start). */
  async getSupplierProfile(
    supplierId: string,
  ): Promise<SupplierProfileRow | null> {
    const { data, error } = await this.supabase
      .from(T_PROFILE)
      .select('*')
      .eq('supplier_id', supplierId)
      .maybeSingle();
    if (error) {
      throw new Error(`getSupplierProfile failed: ${error.message}`);
    }
    return (data as SupplierProfileRow) ?? null;
  }
}
