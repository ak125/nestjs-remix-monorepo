import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderLineStatus, OrderStatus } from '@repo/domain-commerce';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/** Dernier relevé d'un fournisseur pour une pièce (`supplier_offer_snapshot`). */
export interface OffreReleve {
  supplier_id: string;
  supplier_ref: string;
  public_ht_cents: number | null;
  remise_pct: number | null;
  achat_ht_cents: number | null;
  available: boolean | null;
  delay_days: number | null;
  parse_confidence: OfferSnapshotInsert['parse_confidence'];
  observed_at: string;
}

/** Ligne de commande à relever (complément BK n° 4). */
export interface LigneAReleve {
  lineId: string;
  orderId: string;
  pieceId: number;
  ref: string;
  pmId: number | null;
  marque: string;
}

/**
 * Statuts de ligne exclus du relevé : annulée, non compatible, rupture marquée,
 * équivalence refusée (mêmes interdits que le contrôle 3) et déjà commandée.
 */
const LIGNE_NON_RELEVEE: ReadonlySet<string> = new Set<string>([
  OrderLineStatus.CANCELLED,
  OrderLineStatus.NOT_COMPATIBLE,
  OrderLineStatus.NOT_AVAILABLE,
  OrderLineStatus.EQUIV_REFUSED,
  OrderLineStatus.ORDERED_FROM_SUPPLIER,
]);

/**
 * Supplier Availability Truth — data access (Layers 2 & 3 persistence).
 *
 * WIRED, dormant by default: `insertOffer` → `supplier_offer_snapshot` (canonical,
 * append-only), plus the working-set / brand / ref-resolution reads the sync runner
 * uses. Nothing runs unless `SUPPLIER_TRUTH_SYNC_ENABLED` is exactly `'true'`
 * (`supplier-sync.flag.ts`) or an owner-gated one-shot sets
 * `SUPPLIER_SYNC_ONESHOT_CONFIRM=true` (`run-supplier-sync-once.guard.ts`).
 *
 * DEFERRED (H3, NOT WIRED): the availability-consensus methods target
 * `supplier_inventory_snapshots` (append-only by design — insert, never
 * update/delete), `supplier_truth_projection` (1 row per piece_id) and
 * `supplier_runtime_profile`. None of these tables exists and no migration declares
 * them: `20260520_supplier_truth_v1` was retired unapplied on 2026-09-10 — it would
 * have created a second SoT beside `supplier_offer_snapshot`, with two views lacking
 * `security_invoker`. H3 must bring its own migration before any caller is wired.
 */

const T_SNAPSHOTS = 'supplier_inventory_snapshots';
const T_PROJECTION = 'supplier_truth_projection';
const T_PROFILE = 'supplier_runtime_profile';
/**
 * Canonical per-supplier price+availability observation timeline (pricing H2,
 * 20260523 migration). Append-only (DB anti-mutation trigger), partitioned
 * monthly by observed_at. This is the SoT observation store the live-portal
 * connectors write to — NOT the (unapplied, parallel) supplier_inventory_snapshots.
 */
const T_OFFERS = 'supplier_offer_snapshot';

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

/**
 * One row of `supplier_offer_snapshot` (canonical observation). All prices in
 * integer cents (no float drift); `piece_id_i` is NOT NULL at the DB, so only
 * RESOLVED observations are written. `offer_id` + `observed_at` are DB defaults.
 */
export interface OfferSnapshotInsert {
  piece_id_i: number;
  supplier_id: string;
  supplier_ref: string;
  public_ht_cents: number | null;
  remise_pct: number | null;
  achat_ht_cents: number | null;
  available: boolean;
  delay_days: number | null;
  parse_confidence:
    | 'HIGH_CONFIDENCE'
    | 'AMBIGUOUS_MAPPING'
    | 'FALLBACK_MATCH'
    | 'EAN_FALLBACK'
    | 'UNKNOWN';
  source_verified_at: string | null;
  /** Heure de la lecture ; défaut base = heure d'insertion. */
  observed_at?: string;
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

  /**
   * APPEND-ONLY write into the canonical supplier-offer observation timeline
   * (`supplier_offer_snapshot`). This is the live-portal collection target.
   */
  async insertOffer(offer: OfferSnapshotInsert): Promise<void> {
    const { error } = await this.supabase.from(T_OFFERS).insert(offer);
    if (error) {
      throw new Error(`insertOffer failed: ${error.message}`);
    }
  }

  /**
   * APPEND-ONLY. Write into the (deferred-H3) availability-consensus snapshot log
   * `supplier_inventory_snapshots`. NOT wired into the live collection path — that
   * writes `supplier_offer_snapshot` via `insertOffer`. Kept for the future
   * availability-consensus layer (truth-engine); no migration declares its table.
   */
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
  /**
   * Supplier directory for the order-line supplier proposal (decision 50):
   * every ___xtr_supplier row, keyed by its name AND its alias (trimmed,
   * upper-cased) so a `pieces_price.pri_frs` label resolves to `spl_id`.
   * Read-only; the only allowed reader of ___xtr_supplier is this module.
   */
  async getSupplierDirectory(): Promise<
    Map<string, { splId: string; nom: string }>
  > {
    const { data, error } = await this.supabase
      .from('___xtr_supplier')
      .select('spl_id, spl_name, spl_alias')
      .limit(1000);
    if (error) {
      throw new Error(`getSupplierDirectory failed: ${error.message}`);
    }
    const rows = (data ?? []) as {
      spl_id: unknown;
      spl_name: unknown;
      spl_alias: unknown;
    }[];
    if (rows.length >= 1000) {
      throw new Error('getSupplierDirectory: 1000-row cap reached');
    }
    const out = new Map<string, { splId: string; nom: string }>();
    for (const r of rows) {
      const splId = String(r.spl_id ?? '').trim();
      const nom = String(r.spl_name ?? '').trim();
      if (!splId || !nom) continue;
      for (const key of [r.spl_name, r.spl_alias]) {
        const k = typeof key === 'string' ? key.trim().toUpperCase() : '';
        // first row wins: a label shared by two suppliers stays on the first
        if (k && !out.has(k)) out.set(k, { splId, nom });
      }
    }
    return out;
  }

  /**
   * Lignes à relever (complément BK n° 4) : commande payée (`ord_is_pay='1'`),
   * non annulée (`ord_ords_id <> '2'`), ligne ni annulée, ni incompatible, ni en
   * rupture, ni équivalence refusée, ni déjà commandée (statut 6), et sans
   * commande fournisseur préparée (`__admin_audit_log`, `supplier_order_prepared`).
   * Commandes les plus récentes d'abord ; lecture seule.
   */
  async getReleveWorkingSet(limiteCommandes = 1000): Promise<LigneAReleve[]> {
    const { data: commandes, error: e1 } = await this.supabase
      .from('___xtr_order')
      .select('ord_id, ord_date')
      .eq('ord_is_pay', '1')
      .or(`ord_ords_id.is.null,ord_ords_id.neq.${OrderStatus.CANCELLED}`)
      .order('ord_date', { ascending: false })
      .limit(limiteCommandes);
    if (e1)
      throw new Error(`getReleveWorkingSet (orders) failed: ${e1.message}`);
    const ordre = new Map<string, number>();
    ((commandes ?? []) as { ord_id: unknown }[]).forEach((c, i) =>
      ordre.set(String(c.ord_id), i),
    );
    if (ordre.size === 0) return [];

    const { data: traces, error: e2 } = await this.supabase
      .from('__admin_audit_log')
      .select('aal_entity_id')
      .eq('aal_entity_type', 'order_line')
      .eq('aal_action', 'supplier_order_prepared')
      .limit(1000);
    if (e2)
      throw new Error(`getReleveWorkingSet (traces) failed: ${e2.message}`);
    const preparees = new Set(
      ((traces ?? []) as { aal_entity_id: unknown }[]).map((t) =>
        String(t.aal_entity_id),
      ),
    );

    const lignes: (LigneAReleve & { rang: number })[] = [];
    const ids = [...ordre.keys()];
    // 100 commandes par requête : bien sous le plafond de 1000 lignes de
    // PostgREST ; un lot qui l'atteint est signalé, jamais tronqué en silence.
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await this.supabase
        .from('___xtr_order_line')
        .select(
          'orl_id, orl_ord_id, orl_pg_id, orl_art_ref, orl_pm_id, orl_pm_name, orl_orls_id',
        )
        .in('orl_ord_id', ids.slice(i, i + 100))
        .limit(1000);
      if (error) {
        throw new Error(`getReleveWorkingSet (lines) failed: ${error.message}`);
      }
      if ((data ?? []).length >= 1000) {
        throw new Error(
          'getReleveWorkingSet (lines) : 1000 lignes pour 100 commandes, lot possiblement tronqué',
        );
      }
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const lineId = String(r.orl_id);
        const statut = r.orl_orls_id == null ? null : String(r.orl_orls_id);
        const pieceId = Number(r.orl_pg_id);
        const pmId = Number(r.orl_pm_id);
        const ref = String(r.orl_art_ref ?? '').trim();
        const marque = String(r.orl_pm_name ?? '').trim();
        if (statut && LIGNE_NON_RELEVEE.has(statut)) continue;
        if (preparees.has(lineId)) continue;
        if (!Number.isInteger(pieceId) || pieceId <= 0 || !ref) continue;
        lignes.push({
          lineId,
          orderId: String(r.orl_ord_id),
          pieceId,
          ref,
          pmId: Number.isInteger(pmId) && pmId > 0 ? pmId : null,
          marque,
          rang: ordre.get(String(r.orl_ord_id)) ?? Number.MAX_SAFE_INTEGER,
        });
      }
    }
    await this.completerMarqueParPiece(lignes);
    return lignes
      .sort((a, b) => a.rang - b.rang)
      .map(({ rang: _rang, ...l }) => l);
  }

  /**
   * Complément BK n° 5 : les lignes payées depuis 2026 n'ont pas d'`orl_pm_id`
   * (relevé du 18/11 : 26 sur 26). La marque d'une telle ligne est celle de la
   * pièce vendue (`pieces.piece_pm_id` de `orl_pg_id`). Une ligne qui porte son
   * `orl_pm_id` le garde : sur les lignes anciennes, c'est lui qui correspond au
   * nom de marque de la ligne, pas la pièce. Pièce introuvable : marque nulle,
   * la ligne n'est relevée chez personne. Lecture seule.
   */
  private async completerMarqueParPiece(
    lignes: { pieceId: number; pmId: number | null }[],
  ): Promise<void> {
    const sansMarque = [
      ...new Set(lignes.filter((l) => l.pmId == null).map((l) => l.pieceId)),
    ];
    const marqueDe = new Map<number, number>();
    for (let i = 0; i < sansMarque.length; i += 500) {
      const lot = sansMarque.slice(i, i + 500);
      const { data, error } = await this.supabase
        .from('pieces')
        .select('piece_id, piece_pm_id')
        .in('piece_id', lot)
        .limit(1000);
      if (error) {
        throw new Error(
          `getReleveWorkingSet (pieces) failed: ${error.message}`,
        );
      }
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const pm = Number(r.piece_pm_id);
        if (Number.isInteger(pm) && pm > 0)
          marqueDe.set(Number(r.piece_id), pm);
      }
    }
    for (const l of lignes) {
      if (l.pmId == null) l.pmId = marqueDe.get(l.pieceId) ?? null;
    }
  }

  /**
   * Dernier relevé de chaque fournisseur pour une pièce
   * (`supplier_offer_snapshot`, index `idx_sos_piece_time`). Lecture seule.
   * Les 200 relevés les plus récents suffisent : un fournisseur absent de cette
   * fenêtre n'a, au rythme du relevé, aucun relevé de moins de 30 min ; il est
   * alors traité comme « relevé absent », jamais comme frais.
   */
  async readLatestOffers(pieceId: number): Promise<OffreReleve[]> {
    const { data, error } = await this.supabase
      .from(T_OFFERS)
      .select(
        'supplier_id, supplier_ref, public_ht_cents, remise_pct, achat_ht_cents, available, delay_days, parse_confidence, observed_at',
      )
      .eq('piece_id_i', pieceId)
      .order('observed_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(`readLatestOffers failed: ${error.message}`);
    const parFournisseur = new Map<string, OffreReleve>();
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const splId = String(r.supplier_id);
      if (parFournisseur.has(splId)) continue;
      const n = (v: unknown): number | null =>
        v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
      parFournisseur.set(splId, {
        supplier_id: splId,
        supplier_ref: String(r.supplier_ref ?? ''),
        public_ht_cents: n(r.public_ht_cents),
        remise_pct: n(r.remise_pct),
        achat_ht_cents: n(r.achat_ht_cents),
        available: r.available == null ? null : r.available === true,
        delay_days: n(r.delay_days),
        parse_confidence: r.parse_confidence as OffreReleve['parse_confidence'],
        observed_at: String(r.observed_at),
      });
    }
    return [...parFournisseur.values()];
  }

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
