import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

export interface PricePreviewProduct {
  piece_id: number;
  name: string;
  ref: string;
  price: number;
  brand_id: number;
  brand_name: string;
  brand_logo: string;
  has_img: boolean;
}

export interface GammePricePreview {
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  product_count: number;
  brand_count: number;
  products: PricePreviewProduct[];
}

@Injectable()
export class GammePricePreviewService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammePricePreviewService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  async getPricePreview(
    pgId: number,
    limit: number = 6,
  ): Promise<GammePricePreview | null> {
    const cacheKey = `gamme:price-preview:${pgId}`;

    try {
      // 1. Check Redis cache
      const cached = await this.cacheService.get<GammePricePreview>(cacheKey);
      if (cached) {
        return cached;
      }

      // 2. Call RPC (via governance wrapper)
      const { data, error } = await this.callRpc<GammePricePreview>(
        'get_gamme_price_preview',
        { p_pg_id: pgId, p_limit: limit },
      );

      if (error) {
        this.logger.error(
          `RPC get_gamme_price_preview failed for gamme ${pgId}:`,
          error.message,
        );
        // Fallback to stale cache
        const stale = await this.cacheService.get<GammePricePreview>(
          `${cacheKey}:stale`,
        );
        return stale;
      }

      const result = data as GammePricePreview;

      // 3. Cache fresh + stale
      if (result?.min_price) {
        await this.cacheService.set(cacheKey, result, 3600); // 1h
        await this.cacheService.set(`${cacheKey}:stale`, result, 86400); // 24h
      }

      return result;
    } catch (err) {
      this.logger.error(`getPricePreview error for gamme ${pgId}:`, err);
      return null;
    }
  }
}
