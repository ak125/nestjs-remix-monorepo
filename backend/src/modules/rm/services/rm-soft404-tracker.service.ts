import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';

export type UaClass = 'bot' | 'browser' | 'unknown';

// Bot patterns : simple alternation, pas de quantifier — pas de ReDoS risk.
const BOT_PATTERNS =
  /(Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|Slurp|AhrefsBot|SemrushBot|FacebookExternalHit|Twitterbot|LinkedInBot)/i;

// Browser detection : substring includes (linear, ReDoS-proof).
// Pattern précédent (regex avec `.+` greedy entre 2 alternations) déclenchait
// CodeQL js/polynomial-redos. String.prototype.includes = complexité linéaire.
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

const TRACK_RPC = 'track_soft_404_event';

/**
 * Soft-404 R2 telemetry beacon.
 *
 * Canon repo : `extends SupabaseBaseService` + `this.callRpc()` (jamais
 * `.from()` direct). L'insert append-only passe par la fonction Postgres
 * `track_soft_404_event` (SECURITY DEFINER, bypass RLS — ADR-021 + ADR-028
 * Option D anon preprod).
 */
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
    const { error } = await this.callRpc<null>(
      TRACK_RPC,
      {
        p_pg_id: body.pg_id,
        p_type_id: body.type_id,
        p_referrer: ctx.referrer,
        p_ua_class: ua_class,
      },
      { source: 'api' as const },
    );
    if (error) {
      this.logger.warn(`Soft-404 track RPC failed: ${error.message}`);
      return;
    }
    await this.cache.set(throttleKey, '1', 60);
  }
}
