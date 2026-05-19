/**
 * MerchantCenterFeedService — Google Shopping XML feed source.
 *
 * Calls `get_merchant_center_feed_v1` RPC (STABLE, GRANT EXECUTE service_role
 * only — cf governance/rpc/rpc_allowlist.json). Pagination via p_limit/p_offset.
 *
 * Canon : `extends SupabaseBaseService` + `this.callRpc()` (203 services
 * monorepo pattern). Rejects raw `.from()` SELECTs.
 *
 * Refs :
 *   - migration 20260519_merchant_center_feed_v1.sql
 *   - PR commerce-loop V1 step 5B (plan superpower-1-d-abord-proud-cookie.md)
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface MerchantCenterFeedRow {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  availability: 'in_stock' | 'preorder' | 'out_of_stock';
  price: string;
  brand: string;
  gtin: string | null;
  mpn: string;
  product_type: string;
  condition: 'new';
}

@Injectable()
export class MerchantCenterFeedService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    MerchantCenterFeedService.name,
  );

  static readonly PAGE_SIZE = 1000;

  async fetchPage(
    offset: number,
    limit: number = MerchantCenterFeedService.PAGE_SIZE,
  ): Promise<MerchantCenterFeedRow[]> {
    const { data, error } = await this.callRpc<MerchantCenterFeedRow[]>(
      'get_merchant_center_feed_v1',
      { p_limit: limit, p_offset: offset },
    );
    if (error) {
      this.logger.error(
        `get_merchant_center_feed_v1 failed at offset=${offset}: ${error.message}`,
      );
      throw error;
    }
    return data ?? [];
  }
}
