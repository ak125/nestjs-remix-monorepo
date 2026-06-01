import { Injectable } from '@nestjs/common';
import { SupplierTruthRepository } from './supplier-truth.repository';
import { AvailabilityState } from './domain/availability-state';

/**
 * Read API for the funnel (Layer 4 entry point).
 *
 * The funnel reads ONLY the canonical projection through this service — never the
 * connector or raw snapshots. A piece with no projection is `UNKNOWN` (shown as
 * "sur commande"), never "en stock". Never throws on a missing row.
 */

export interface AvailabilityView {
  state: AvailabilityState;
  confidence: number;
  delayDays: number | null;
  sourceSupplier: string | null;
}

const UNKNOWN_VIEW: AvailabilityView = {
  state: AvailabilityState.UNKNOWN,
  confidence: 0,
  delayDays: null,
  sourceSupplier: null,
};

@Injectable()
export class SupplierTruthService {
  constructor(private readonly repo: SupplierTruthRepository) {}

  /** Canonical availability for one piece; UNKNOWN when not yet verified. */
  async getProjection(pieceId: number): Promise<AvailabilityView> {
    const row = await this.repo.getProjection(pieceId);
    if (!row) return UNKNOWN_VIEW;
    return {
      state: row.state as AvailabilityState,
      confidence: row.confidence,
      delayDays: row.delay_days,
      sourceSupplier: row.source_supplier,
    };
  }

  /** Batch read for a listing page; missing pieces map to UNKNOWN. */
  async getProjections(
    pieceIds: number[],
  ): Promise<Map<number, AvailabilityView>> {
    const out = new Map<number, AvailabilityView>();
    await Promise.all(
      pieceIds.map(async (id) => out.set(id, await this.getProjection(id))),
    );
    return out;
  }
}
