import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';

export type UaClass = 'bot' | 'browser' | 'unknown';

const BOT_PATTERNS = /(Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|Slurp|AhrefsBot|SemrushBot|FacebookExternalHit|Twitterbot|LinkedInBot)/i;
const BROWSER_PATTERNS = /(Chrome|Safari|Firefox|Edge|Opera|Mozilla\/5\.0).+(AppleWebKit|Gecko|Trident)/i;

@Injectable()
export class RmSoft404TrackerService {
  private readonly logger = new Logger(RmSoft404TrackerService.name);

  constructor(
    private readonly supabase: SupabaseBaseService,
    private readonly cache: CacheService,
  ) {}

  classifyUA(ua: string | null | undefined): UaClass {
    if (!ua) return 'unknown';
    if (BOT_PATTERNS.test(ua)) return 'bot';
    if (BROWSER_PATTERNS.test(ua)) return 'browser';
    return 'unknown';
  }

  private getClient() {
    return (this.supabase as any).client ?? (this.supabase as any).supabase ?? this.supabase;
  }

  async track(
    body: { pg_id: number; type_id: number },
    ctx: { sessionId: string | null; ua: string | null; referrer: string | null },
  ): Promise<void> {
    const sessionId = ctx.sessionId ?? `anon-${body.type_id}-${body.pg_id}`;
    const throttleKey = `track-soft-404:${sessionId}`;
    const recent = await this.cache.get(throttleKey);
    if (recent) return;

    const ua_class = this.classifyUA(ctx.ua);
    const sb = this.getClient();
    const { error } = await sb.from('__soft_404_events').insert({
      pg_id: body.pg_id,
      type_id: body.type_id,
      referrer: ctx.referrer,
      ua_class,
    });
    if (error) {
      this.logger.warn(`Soft-404 track insert failed: ${error.message}`);
      return;
    }
    await this.cache.set(throttleKey, '1', 60);
  }
}
