/**
 * Catalog activation plan (T1 — READ-ONLY scaffold of the governed activation pipeline).
 *
 * For a tariff batch (= a brand, `pieces.piece_pm_id`), classifies the sellable-priced
 * pieces and emits a DRY-RUN plan — the same dry-run-first pattern as the price import.
 * It NEVER writes (no price/dispo/display/relation mutation): the actual activation
 * (universal section, display flip, accessory parent, OEM fitment) are SEPARATE
 * owner-gated steps (T2-T4 of the design).
 *
 * Drives the read-only RPC `catalog_activation_plan` (STABLE). The plan also proposes
 * `universal_candidates` (orphan + no-OEM gammes) so the universal list is curated
 * incrementally at each tariff update — "au fur et à mesure".
 *
 * Design: audit/orphan-price-and-universal-section-design-2026-06-08.md §5/§5bis.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';

/** Per-category counts of the brand's sellable-priced pieces. */
export interface ActivationPlanCategories {
  /** has gamme×vehicle link + piece_display=true + gamme active → already on a page. */
  already_visible: number;
  /** has link but piece_display=false → safe to activate (correct fitment, display-gated). */
  display_gated: number;
  /** piece_pg_pid ≠ piece_pg_id → accessory attached to a parent gamme. */
  accessory: number;
  /** has link but its gamme is inactive (pg_display≠'1') → activate the gamme. */
  gamme_inactive: number;
  /** orphan (no link) but carries OEM refs → vehicle fitment re-derivable (validated sub-project). */
  orphan_with_oem: number;
  /** orphan (no link) + no OEM → no authoritative fitment source (universal candidate or blocked; never fabricate). */
  orphan_no_source: number;
}

/**
 * A gamme grouping the brand's orphan + no-OEM pieces (no fitment source).
 * NOT auto-universal: a genuinely universal gamme is a CATALOG-level property
 * (curated registry: ~0 vehicle fitment + consumable nature), detected separately —
 * not inferred per-brand from "orphan + no OEM". This list is a follow-up hint only.
 */
export interface OrphanGammeGroup {
  pg_id: number;
  pg_name: string | null;
  pieces: number;
}

export interface ActivationPlan {
  brand_pm_id: number;
  sellable_priced: number;
  categories: ActivationPlanCategories;
  orphan_no_source_by_gamme: OrphanGammeGroup[];
}

@Injectable()
export class CatalogActivationPlanService {
  private readonly logger = new Logger(CatalogActivationPlanService.name);

  constructor(private readonly repo: PricingRepository) {}

  /**
   * Read-only activation plan for a brand batch. No writes.
   * @param brandPmId pieces_marque.pm_id (the tariff brand).
   */
  async plan(brandPmId: number): Promise<ActivationPlan> {
    if (!Number.isInteger(brandPmId) || brandPmId <= 0) {
      throw new BadRequestException(
        'brandPmId must be a positive integer (pieces_marque.pm_id)',
      );
    }

    const data = await this.repo.catalogActivationPlan(brandPmId);

    const c = data.categories;
    this.logger.log(
      `[ACTIVATION_PLAN] brand=${brandPmId} sellable=${data.sellable_priced} ` +
        `visible=${c.already_visible} display_gated=${c.display_gated} accessory=${c.accessory} ` +
        `gamme_inactive=${c.gamme_inactive} orphan_oem=${c.orphan_with_oem} orphan_no_source=${c.orphan_no_source} ` +
        `orphan_no_source_gammes=${data.orphan_no_source_by_gamme.length}`,
    );
    return data;
  }
}
