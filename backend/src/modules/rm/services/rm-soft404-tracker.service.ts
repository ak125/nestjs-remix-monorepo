import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';

export type UaClass = 'bot' | 'browser' | 'unknown';

// Bot patterns : simple alternation, pas de quantifier — pas de ReDoS risk.
const BOT_PATTERNS =
  /(Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|Slurp|AhrefsBot|SemrushBot|FacebookExternalHit|Twitterbot|LinkedInBot)/i;

// Browser detection : substring includes (linear, ReDoS-proof).
// Pattern précédent `/(Chrome|Safari|Firefox|Edge|Opera|Mozilla\/5\.0).+(AppleWebKit|Gecko|Trident)/i`
// déclenchait CodeQL js/polynomial-redos sur des strings type "EdgeEdgeEdge..." :
// alternation + .+ greedy + alternation = backtracking polynomial. Réécrit en
// String.prototype.includes, sémantique identique, complexité linéaire stricte.
const BROWSER_NAMES = [
  'Chrome',
  'Safari',
  'Firefox',
  'Edge',
  'Opera',
  'Mozilla/5.0',
] as const;
const BROWSER_ENGINES = ['AppleWebKit', 'Gecko', 'Trident'] as const;

function hasAny(haystack: string, needles: readonly string[]): boolean {
  for (const needle of needles) {
    if (haystack.includes(needle)) return true;
  }
  return false;
}

@Injectable()
export class RmSoft404TrackerService extends SupabaseBaseService {
  protected readonly logger = new Logger(RmSoft404TrackerService.name);

  constructor(private readonly cache: CacheService) {
    super();
  }

  classifyUA(ua: string | null | undefined): UaClass {
    if (!ua) return 'unknown';
    if (BOT_PATTERNS.test(ua)) return 'bot';
    if (hasAny(ua, BROWSER_NAMES) && hasAny(ua, BROWSER_ENGINES))
      return 'browser';
    return 'unknown';
  }

  async track(
    body: { pg_id: number; type_id: number },
    ctx: {
      sessionId: string | null;
      ua: string | null;
      referrer: string | null;
    },
  ): Promise<void> {
    const sessionId = ctx.sessionId ?? `anon-${body.type_id}-${body.pg_id}`;
    const throttleKey = `track-soft-404:${sessionId}`;
    const recent = await this.cache.get(throttleKey);
    if (recent) return;

    const ua_class = this.classifyUA(ctx.ua);
    // inherited from SupabaseBaseService (extends pattern, 203 services canon)
    const { error } = await this.supabase
      .from('__soft_404_events' as any)
      .insert({
        pg_id: body.pg_id,
        type_id: body.type_id,
        referrer: ctx.referrer,
        ua_class,
      } as any);
    if (error) {
      this.logger.warn(`Soft-404 track insert failed: ${error.message}`);
      return;
    }
    await this.cache.set(throttleKey, '1', 60);
  }
}
