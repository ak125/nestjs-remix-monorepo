import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  GammePricePreviewService,
  type GammePricePreview,
} from './gamme-price-preview.service';

/** One universal gamme + a preview of its sellable products (no vehicle). */
export interface UniversalGammeSection {
  pgId: number;
  pgName: string;
  pgAlias: string | null;
  sellablePieces: number;
  preview: GammePricePreview | null;
}

export interface UniversalSectionResult {
  /** false = flag OFF (no query ran). true = flag ON (gammes may be empty). */
  enabled: boolean;
  gammes: UniversalGammeSection[];
}

/**
 * UniversalCatalogService (T2b) — data layer for the "Produits universels" section.
 *
 * Universal gammes = sold WITHOUT a vehicle (fluids / hardware / consumables): no vehicle
 * fitment + sellable pieces + consumable nature. The set comes from the governed read-only
 * function `catalog_universal_gammes()` (auto-classified, owner-overridable). Per gamme, the
 * products are the EXISTING `GammePricePreviewService.getPricePreview` (RPC
 * get_gamme_price_preview, vehicle-agnostic, cached) — zero new product path, no divergence.
 *
 * SEO-SAFE / read-only: never touches pg_display / URL / sitemap / price. Flag-gated by
 * SHOW_UNIVERSAL_SECTION (default OFF → empty result, no query). No fabricated fitment.
 */
@Injectable()
export class UniversalCatalogService extends SupabaseBaseService {
  protected readonly logger = new Logger(UniversalCatalogService.name);

  constructor(
    configService: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly pricePreview: GammePricePreviewService,
  ) {
    super(configService);
  }

  /**
   * The universal section: top universal gammes + a product preview each.
   * @param limit max gammes (bounded; default 24).
   */
  async getSection(limit = 24): Promise<UniversalSectionResult> {
    if (!this.flags.universalSectionEnabled) {
      return { enabled: false, gammes: [] };
    }

    const { data, error } = await this.callRpc('catalog_universal_gammes', {});
    if (error) {
      this.logger.warn(`[UNIVERSAL] gamme set lookup failed: ${error.message}`);
      return { enabled: true, gammes: [] };
    }
    const rows = (Array.isArray(data) ? data : []).slice(0, Math.max(1, limit));

    const gammes: UniversalGammeSection[] = [];
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const pgId =
        typeof row.pg_id === 'number'
          ? row.pg_id
          : parseInt(String(row.pg_id), 10);
      if (!Number.isFinite(pgId) || pgId <= 0) continue;
      let preview: GammePricePreview | null = null;
      try {
        preview = await this.pricePreview.getPricePreview(pgId, 4);
      } catch (e) {
        this.logger.warn(
          `[UNIVERSAL] preview failed pg=${pgId}: ${e instanceof Error ? e.message : e}`,
        );
      }
      gammes.push({
        pgId,
        pgName: String(row.pg_name ?? ''),
        pgAlias: row.pg_alias ? String(row.pg_alias) : null,
        sellablePieces: Number(row.sellable_pieces ?? 0),
        preview,
      });
    }

    this.logger.log(`[UNIVERSAL] section gammes=${gammes.length}`);
    return { enabled: true, gammes };
  }
}
