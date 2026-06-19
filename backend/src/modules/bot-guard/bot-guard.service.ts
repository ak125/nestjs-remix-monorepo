import { promises as dns } from 'node:dns';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@cache/cache.service';

interface RequestFingerprint {
  ip: string;
  country?: string;
  userAgent: string;
  path: string;
  acceptLanguage?: string;
  hasSession: boolean;
}

export interface BlockedEntry {
  ip: string;
  country?: string;
  reason: string;
  path: string;
  timestamp: string;
}

@Injectable()
export class BotGuardService implements OnModuleInit {
  private readonly logger = new Logger(BotGuardService.name);

  // In-memory cache (refreshed every 60s from Redis)
  private blockedCountries: Set<string> = new Set();
  private blockedIps: Set<string> = new Set();
  private enabled = true;
  private suspicionThreshold = 80;
  // When true, forward-confirmed search-engine crawlers bypass geo/behavioral
  // blocking (feature-flag for instant rollback). See isVerifiedSearchEngine().
  private verifiedBotBypass = true;
  private lastConfigRefresh = 0;
  private readonly CONFIG_REFRESH_MS = 60_000;

  // Target countries that should NEVER be blocked
  private readonly TARGET_COUNTRIES = new Set([
    'FR',
    'DZ',
    'TN',
    'MA',
    'BE',
    'CH', // Main markets
    'GP',
    'MQ',
    'RE',
    'GF',
    'YT',
    'PM', // DOM-TOM
    'NC',
    'PF',
    'WF',
    'BL',
    'MF', // DOM-TOM extended
    'LU',
    'MC',
    'AD',
    'SN',
    'CI',
    'CM', // Francophone
  ]);

  // Known-good crawler UA tokens — only used to *waive the UA-suspicion sub-score*.
  // NOTE: a UA match alone NEVER exempts from geo/ip/behavioral blocking. Real
  // "never block" for search engines is enforced by isVerifiedSearchEngine()
  // below, which proves identity by IP (FCrDNS), not by the spoofable UA string.
  private readonly GOOD_BOTS = [
    'googlebot',
    'bingbot',
    'yandexbot',
    'slurp',
    'duckduckbot',
    'facebot',
    'twitterbot',
    'linkedinbot',
    'whatsapp',
    'telegrambot',
    'applebot',
    'pinterest',
    'semrushbot',
    'ahrefsbot',
  ];

  // IP-verifiable search engines. A crawler is trusted ONLY when its UA matches
  // one of these families AND its reverse-DNS resolves to an allowed suffix AND
  // that hostname forward-resolves back to the same IP (FCrDNS — Google's
  // canonical verification method). Engines without stable reverse-DNS
  // (e.g. SEMrush/Ahrefs) are intentionally absent: they fall through to scoring.
  private readonly VERIFIED_BOT_RDNS: ReadonlyArray<{
    name: string;
    ua: string[];
    suffixes: string[];
  }> = [
    {
      name: 'Googlebot',
      ua: [
        'googlebot',
        'google-inspectiontool',
        'storebot-google',
        'adsbot-google',
        'mediapartners-google',
        'apis-google',
        'feedfetcher-google',
        'googleother',
        'google-extended',
      ],
      suffixes: ['.googlebot.com', '.google.com'],
    },
    {
      name: 'Bingbot',
      ua: ['bingbot', 'adidxbot', 'msnbot'],
      suffixes: ['.search.msn.com'],
    },
    {
      name: 'Applebot',
      ua: ['applebot'],
      suffixes: ['.applebot.apple.com'],
    },
    {
      name: 'DuckDuckBot',
      ua: ['duckduckbot', 'duckduckgo'],
      suffixes: ['.duckduckgo.com'],
    },
    {
      name: 'YandexBot',
      ua: ['yandexbot', 'yandeximages', 'yandex.com/bots'],
      suffixes: ['.yandex.com', '.yandex.net', '.yandex.ru'],
    },
    {
      name: 'Yahoo',
      ua: ['slurp'],
      suffixes: ['.crawl.yahoo.net'],
    },
  ];

  // Suspicious user-agent patterns
  private readonly SUSPICIOUS_UA = [
    'python-requests',
    'python-urllib',
    'python/',
    'go-http-client',
    'java/',
    'curl/',
    'wget/',
    'httpclient',
    'libwww',
    'lwp-trivial',
    'scrapy',
    'phantomjs',
    'headlesschrome',
    'selenium',
    'puppeteer',
    'node-fetch',
    'axios/',
    'got/',
    'undici',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // Load initial config from env
    this.enabled =
      this.configService.get('BOT_GUARD_ENABLED', 'true') === 'true';
    this.verifiedBotBypass =
      this.configService.get('BOT_GUARD_VERIFIED_BOT_BYPASS', 'true') ===
      'true';
    this.suspicionThreshold = parseInt(
      this.configService.get('BOT_GUARD_SUSPICION_THRESHOLD', '80'),
      10,
    );
    const countries = this.configService.get(
      'BOT_GUARD_BLOCKED_COUNTRIES',
      'CN',
    );
    this.blockedCountries = new Set(
      countries.split(',').map((c: string) => c.trim().toUpperCase()),
    );

    // Try loading from Redis (overrides env if exists)
    await this.refreshConfig();

    this.logger.log(
      `BotGuard initialized: enabled=${this.enabled}, blocked_countries=[${[...this.blockedCountries]}], threshold=${this.suspicionThreshold}`,
    );
  }

  private async refreshConfig(): Promise<void> {
    try {
      const config = await this.cacheService.get<{
        enabled?: boolean;
        blockedCountries?: string[];
        blockedIps?: string[];
        suspicionThreshold?: number;
        verifiedBotBypass?: boolean;
      }>('bot-guard:config');

      if (config) {
        if (config.enabled !== undefined) this.enabled = config.enabled;
        if (config.blockedCountries) {
          this.blockedCountries = new Set(config.blockedCountries);
        }
        if (config.blockedIps) {
          this.blockedIps = new Set(config.blockedIps);
        }
        if (config.suspicionThreshold) {
          this.suspicionThreshold = config.suspicionThreshold;
        }
        if (config.verifiedBotBypass !== undefined) {
          this.verifiedBotBypass = config.verifiedBotBypass;
        }
      }
      this.lastConfigRefresh = Date.now();
    } catch {
      // Fail-open: keep in-memory config
    }
  }

  private async maybeRefreshConfig(): Promise<void> {
    if (Date.now() - this.lastConfigRefresh > this.CONFIG_REFRESH_MS) {
      await this.refreshConfig();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Forward-confirmed reverse DNS (FCrDNS) check for legitimate search-engine
   * crawlers. Returns true only when ALL hold:
   *   1. the UA matches a known crawler family (cheap prefilter — no UA = no DNS),
   *   2. the IP's reverse-DNS hostname ends with an allowed suffix for that family,
   *   3. that hostname forward-resolves back to the same IP.
   *
   * UA is never trusted on its own (trivially spoofable). The verdict is cached
   * per-IP in Redis so a crawler costs at most one reverse + one forward lookup
   * per IP per TTL; human traffic costs zero DNS (step 1 short-circuits).
   *
   * Failsafe: any DNS/cache error yields `false` (the request then falls through
   * to the normal scoring path, which already lets default-config crawlers pass)
   * — a verification failure must never *block* a crawler.
   */
  async isVerifiedSearchEngine(
    ip: string,
    userAgent: string,
  ): Promise<boolean> {
    if (!this.verifiedBotBypass) return false;

    const ua = (userAgent || '').toLowerCase();
    const family = this.VERIFIED_BOT_RDNS.find((f) =>
      f.ua.some((token) => ua.includes(token)),
    );
    if (!family) return false;

    const normIp = this.normalizeIp(ip);
    if (!normIp) return false;

    const cacheKey = `bot-guard:vbot:${normIp}`;
    try {
      const cached = await this.cacheService.get<boolean>(cacheKey);
      if (cached !== null && cached !== undefined) return cached;
    } catch {
      // cache unavailable → verify live
    }

    let verified = false;
    try {
      const hosts = await this.reverseDnsLookup(normIp);
      const match = hosts
        .map((h) => h.toLowerCase().replace(/\.$/, ''))
        .find((h) =>
          family.suffixes.some(
            (suffix) => h === suffix.slice(1) || h.endsWith(suffix),
          ),
        );
      if (match) {
        const forwardIps = await this.forwardDnsLookup(match);
        verified = forwardIps.some((fip) => this.normalizeIp(fip) === normIp);
      }
    } catch (err) {
      this.logger.debug(
        `FCrDNS verification failed ip=${normIp} family=${family.name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      verified = false;
    }

    try {
      // Cache positives longer; recheck negatives sooner (an IP could be reassigned).
      await this.cacheService.set(cacheKey, verified, verified ? 21600 : 3600);
    } catch {
      // non-blocking
    }

    if (verified) {
      this.logger.debug(
        `Verified search bot allowed: ip=${normIp} family=${family.name}`,
      );
    }
    return verified;
  }

  /** Strip an IPv4-mapped IPv6 prefix so reverse/forward IPs compare equal. */
  private normalizeIp(ip: string): string {
    if (!ip) return '';
    return ip
      .replace(/^::ffff:/i, '')
      .trim()
      .toLowerCase();
  }

  /** Reverse-DNS lookup (overridable for tests). */
  protected async reverseDnsLookup(ip: string): Promise<string[]> {
    return dns.reverse(ip);
  }

  /** Forward A/AAAA lookup (overridable for tests). */
  protected async forwardDnsLookup(host: string): Promise<string[]> {
    const [v4, v6] = await Promise.allSettled([
      dns.resolve4(host),
      dns.resolve6(host),
    ]);
    const out: string[] = [];
    if (v4.status === 'fulfilled') out.push(...v4.value);
    if (v6.status === 'fulfilled') out.push(...v6.value);
    return out;
  }

  async isCountryBlocked(country: string): Promise<boolean> {
    if (!this.enabled) return false;
    await this.maybeRefreshConfig();
    return this.blockedCountries.has(country.toUpperCase());
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    if (!this.enabled) return false;
    await this.maybeRefreshConfig();
    return this.blockedIps.has(ip);
  }

  calculateSuspicionScore(data: RequestFingerprint): number {
    if (!this.enabled) return 0;

    let score = 0;

    // Missing Accept-Language (real browsers always send it)
    if (!data.acceptLanguage) score += 30;

    // Suspicious user-agent
    if (this.isSuspiciousUserAgent(data.userAgent)) score += 20;

    // No session on deep page (not homepage)
    if (
      !data.hasSession &&
      data.path !== '/' &&
      !data.path.startsWith('/build/')
    ) {
      score += 15;
    }

    // Non-target country
    if (
      data.country &&
      !this.TARGET_COUNTRIES.has(data.country.toUpperCase())
    ) {
      score += 10;
    }

    // API/catalog scraping patterns
    if (
      data.path.startsWith('/api/catalog/') ||
      data.path.startsWith('/api/products/') ||
      data.path.startsWith('/api/search/')
    ) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private isSuspiciousUserAgent(ua: string): boolean {
    if (!ua || ua.length < 10) return true;

    const lowerUa = ua.toLowerCase();

    // Allow known good bots
    if (this.GOOD_BOTS.some((bot) => lowerUa.includes(bot))) return false;

    return this.SUSPICIOUS_UA.some((pattern) => lowerUa.includes(pattern));
  }

  // --- Stats & Logging ---

  async logBlocked(
    ip: string,
    country: string | undefined,
    reason: string,
    path: string,
  ): Promise<void> {
    try {
      // Increment counters
      await this.cacheService.set(
        `bot-guard:stats:blocked:total`,
        ((await this.cacheService.get<number>(
          'bot-guard:stats:blocked:total',
        )) || 0) + 1,
        86400,
      );

      if (country) {
        const countryKey = `bot-guard:stats:blocked:geo:${country}`;
        await this.cacheService.set(
          countryKey,
          ((await this.cacheService.get<number>(countryKey)) || 0) + 1,
          86400,
        );
      }

      // Keep last 100 blocked entries
      const recent =
        (await this.cacheService.get<BlockedEntry[]>(
          'bot-guard:recent-blocks',
        )) || [];
      recent.unshift({
        ip,
        country,
        reason,
        path,
        timestamp: new Date().toISOString(),
      });
      if (recent.length > 100) recent.length = 100;
      await this.cacheService.set('bot-guard:recent-blocks', recent, 86400);
    } catch {
      // Non-blocking - stats failure should not affect request
    }
  }

  async trackAllowed(country?: string): Promise<void> {
    try {
      await this.cacheService.set(
        'bot-guard:stats:allowed:total',
        ((await this.cacheService.get<number>(
          'bot-guard:stats:allowed:total',
        )) || 0) + 1,
        86400,
      );

      if (country) {
        const key = `bot-guard:stats:allowed:country:${country}`;
        await this.cacheService.set(
          key,
          ((await this.cacheService.get<number>(key)) || 0) + 1,
          86400,
        );
      }
    } catch {
      // Non-blocking
    }
  }

  // --- Admin API ---

  async getStats(): Promise<Record<string, unknown>> {
    const totalBlocked =
      (await this.cacheService.get<number>('bot-guard:stats:blocked:total')) ||
      0;
    const totalAllowed =
      (await this.cacheService.get<number>('bot-guard:stats:allowed:total')) ||
      0;
    const total = totalBlocked + totalAllowed;

    return {
      enabled: this.enabled,
      blockedCountries: [...this.blockedCountries],
      blockedIpsCount: this.blockedIps.size,
      suspicionThreshold: this.suspicionThreshold,
      stats24h: {
        totalBlocked,
        totalAllowed,
        total,
        blockRate:
          total > 0 ? `${((totalBlocked / total) * 100).toFixed(1)}%` : '0%',
      },
    };
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return {
      enabled: this.enabled,
      blockedCountries: [...this.blockedCountries],
      blockedIps: [...this.blockedIps],
      suspicionThreshold: this.suspicionThreshold,
      verifiedBotBypass: this.verifiedBotBypass,
      targetCountries: [...this.TARGET_COUNTRIES],
    };
  }

  async updateConfig(config: {
    enabled?: boolean;
    blockedCountries?: string[];
    blockedIps?: string[];
    suspicionThreshold?: number;
    verifiedBotBypass?: boolean;
  }): Promise<void> {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.blockedCountries) {
      this.blockedCountries = new Set(config.blockedCountries);
    }
    if (config.blockedIps) {
      this.blockedIps = new Set(config.blockedIps);
    }
    if (config.suspicionThreshold) {
      this.suspicionThreshold = config.suspicionThreshold;
    }
    if (config.verifiedBotBypass !== undefined) {
      this.verifiedBotBypass = config.verifiedBotBypass;
    }

    // Persist to Redis
    await this.cacheService.set(
      'bot-guard:config',
      {
        enabled: this.enabled,
        blockedCountries: [...this.blockedCountries],
        blockedIps: [...this.blockedIps],
        suspicionThreshold: this.suspicionThreshold,
        verifiedBotBypass: this.verifiedBotBypass,
      },
      86400 * 30, // 30 days
    );

    this.logger.log(
      `BotGuard config updated: enabled=${this.enabled}, countries=[${[...this.blockedCountries]}]`,
    );
  }

  async blockIp(ip: string, reason: string): Promise<void> {
    this.blockedIps.add(ip);
    await this.updateConfig({ blockedIps: [...this.blockedIps] });
    this.logger.warn(`IP blocked: ${ip} - Reason: ${reason}`);
  }

  async unblockIp(ip: string): Promise<void> {
    this.blockedIps.delete(ip);
    await this.updateConfig({ blockedIps: [...this.blockedIps] });
    this.logger.log(`IP unblocked: ${ip}`);
  }

  async toggle(enabled: boolean): Promise<void> {
    await this.updateConfig({ enabled });
    this.logger.warn(`BotGuard ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  async getRecentBlocks(): Promise<BlockedEntry[]> {
    return (
      (await this.cacheService.get<BlockedEntry[]>(
        'bot-guard:recent-blocks',
      )) || []
    );
  }
}
