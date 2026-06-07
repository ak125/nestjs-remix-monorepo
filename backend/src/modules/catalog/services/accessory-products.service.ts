import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { UnifiedPageDataService } from './unified-page-data.service';

/** One accessory gamme + its products compatible with the current vehicle. */
export interface AccessoryProductGroup {
  pgId: number;
  pgAlias: string;
  pgName: string;
  count: number;
  minPrice: number;
  products: Record<string, unknown>[];
}

export interface AccessoryProductsResult {
  /** false = flag OFF (no query ran). true = flag ON (accessories may be empty). */
  enabled: boolean;
  mainPgId: number;
  typeId: number;
  accessories: AccessoryProductGroup[];
}

/**
 * AccessoryProductsService (étape PR-2a, data layer for the R2 "Accessoires" block).
 *
 * For a MAIN gamme's R2 product page (a gamme × vehicle), returns the PRODUCTS of the
 * ACCESSORY gammes linked to it via pieces_gamme.pg_parent_gamme_id (the governed
 * accessory→main link from PR-1 #889), compatible with the current vehicle.
 *
 * NO-BRICOLAGE: it REUSES the canonical R2 products primitive
 * (UnifiedPageDataService.getPageData → RPC get_pieces_for_type_gamme_v3) per accessory
 * gamme, so accessory products carry the EXACT same gating + price logic as the main
 * products — zero divergence, no reimplemented price path.
 *
 * SEO-SAFE: read-only; never touches pg_display / URL / sitemap / the accessory gamme.
 * Flag-gated by SHOW_ACCESSORY_BLOCKS_ON_R2 (default OFF) — OFF short-circuits to an empty
 * result (no query, no surface). The accessory gamme stays hidden.
 */
@Injectable()
export class AccessoryProductsService extends SupabaseBaseService {
  protected readonly logger = new Logger(AccessoryProductsService.name);

  constructor(
    configService: ConfigService,
    private readonly unified: UnifiedPageDataService,
    private readonly flags: FeatureFlagsService,
  ) {
    super(configService);
  }

  async getForVehicle(
    mainPgId: number,
    typeId: number,
  ): Promise<AccessoryProductsResult> {
    const empty: AccessoryProductsResult = {
      enabled: false,
      mainPgId,
      typeId,
      accessories: [],
    };

    // Flag OFF → no query, no surface (the accessory stays invisible).
    if (!this.flags.accessoryBlocksOnR2Enabled) {
      return empty;
    }
    if (!mainPgId || !typeId) {
      return { ...empty, enabled: true };
    }

    // 1) Accessory gammes linked to this main hub (the PR-1 pg_parent_gamme_id link).
    const { data: accGammes, error } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_parent_gamme_id', mainPgId)
      .in('pg_level', ['4', '5']);

    if (error) {
      this.logger.warn(
        `[ACCESSORY_R2] gamme lookup failed main=${mainPgId}: ${error.message}`,
      );
      return { ...empty, enabled: true };
    }
    if (!accGammes?.length) {
      return { ...empty, enabled: true };
    }

    // 2) For each accessory gamme, reuse the canonical R2 products primitive (same vehicle).
    const groups: AccessoryProductGroup[] = [];
    for (const g of accGammes) {
      const pgId =
        typeof g.pg_id === 'number' ? g.pg_id : parseInt(String(g.pg_id), 10);
      if (!Number.isFinite(pgId) || pgId <= 0) continue;
      try {
        const page = await this.unified.getPageData(typeId, pgId);
        const products = Array.isArray(page.pieces) ? page.pieces : [];
        if (products.length > 0) {
          groups.push({
            pgId,
            pgAlias: String(g.pg_alias ?? ''),
            pgName: String(g.pg_name ?? ''),
            count: products.length,
            minPrice: page.minPrice ?? 0,
            products,
          });
        }
      } catch (e) {
        this.logger.warn(
          `[ACCESSORY_R2] product fetch failed acc=${pgId}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    this.logger.log(
      `[ACCESSORY_R2] main=${mainPgId} type=${typeId} groups=${groups.length}`,
    );
    return { enabled: true, mainPgId, typeId, accessories: groups };
  }
}
