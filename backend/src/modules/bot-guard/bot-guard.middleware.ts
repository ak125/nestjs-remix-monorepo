import { HttpStatus, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { BotGuardService } from './bot-guard.service';

@Injectable()
export class BotGuardMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BotGuardMiddleware.name);

  constructor(private readonly botGuardService: BotGuardService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Skip health checks and static assets
    if (
      req.path === '/health' ||
      req.path.startsWith('/build/') ||
      req.path.startsWith('/assets/') ||
      req.path === '/favicon.ico'
    ) {
      return next();
    }

    // 2. Skip if BotGuard disabled
    if (!this.botGuardService.isEnabled()) {
      return next();
    }

    // 3. Skip internal Docker network IPs
    const ip = this.getClientIp(req);
    if (this.isInternalIp(ip)) {
      return next();
    }

    // 4. Country (Cloudflare CF-IPCountry header) + UA, read once for all checks.
    const country = (req.headers['cf-ipcountry'] as string)?.toUpperCase();
    const userAgent = (req.headers['user-agent'] as string) || '';

    try {
      // 5. Explicit operator IP blocklist applies to EVERYONE — including
      // verified crawlers. An admin IP block is a deliberate, observable action
      // and must win; checked first so a blocked IP short-circuits before DNS.
      if (await this.botGuardService.isIpBlocked(ip)) {
        await this.botGuardService.logBlocked(
          ip,
          country,
          'ip_block',
          req.path,
        );
        this.logger.warn(
          `Blocked: ip=${ip} country=${country} path=${req.path} reason=ip_block`,
        );
        res
          .status(HttpStatus.FORBIDDEN)
          .json({ error: 'Access denied', code: 'IP_BLOCKED' });
        return;
      }

      // 6. Verified search-engine crawlers (FCrDNS) bypass the AUTOMATIC blocks
      // (geo + behavioral) and the rate limiter (req.isVerifiedBot is read by
      // ThrottlerGuard.skipIf in app.module.ts). UA is not trusted on its own —
      // identity is proven by forward-confirmed reverse DNS.
      if (await this.botGuardService.isVerifiedSearchEngine(ip, userAgent)) {
        (req as Request & { isVerifiedBot?: boolean }).isVerifiedBot = true;
        this.botGuardService.trackAllowed(country).catch(() => {});
        return next();
      }

      // 7. Geo block (Cloudflare CF-IPCountry header).
      if (country && (await this.botGuardService.isCountryBlocked(country))) {
        await this.botGuardService.logBlocked(
          ip,
          country,
          'geo_block',
          req.path,
        );
        this.logger.warn(
          `Blocked: ip=${ip} country=${country} path=${req.path} reason=geo_block`,
        );
        res
          .status(HttpStatus.FORBIDDEN)
          .json({ error: 'Access denied', code: 'GEO_BLOCKED' });
        return;
      }

      // 8. Behavioral scoring
      const suspicionScore = this.botGuardService.calculateSuspicionScore({
        ip,
        country,
        userAgent,
        path: req.path,
        acceptLanguage: req.headers['accept-language'] as string,
        hasSession: !!req.headers.cookie?.includes('connect.sid'),
      });

      if (suspicionScore >= 80) {
        await this.botGuardService.logBlocked(
          ip,
          country,
          'behavioral',
          req.path,
        );
        this.logger.warn(
          `Blocked: ip=${ip} country=${country} score=${suspicionScore} path=${req.path} ua="${userAgent.substring(0, 80)}" reason=behavioral`,
        );
        res
          .status(HttpStatus.FORBIDDEN)
          .json({ error: 'Access denied', code: 'SUSPICIOUS' });
        return;
      }

      // 7. Track allowed (async, non-blocking)
      this.botGuardService.trackAllowed(country).catch(() => {});
    } catch (err) {
      // Fail-open: if anything fails, let the request through
      this.logger.error(`BotGuard error (fail-open): ${err}`);
    }

    next();
  }

  private getClientIp(req: Request): string {
    const peer = req.socket?.remoteAddress || '';

    // SECURITY: forwarding headers (cf-connecting-ip / x-forwarded-for /
    // x-real-ip) are client-spoofable, so they are trusted ONLY when the
    // immediate TCP peer is our own co-located reverse proxy (Caddy →
    // loopback/Docker-internal). Caddy sits behind Cloudflare, which sets
    // cf-connecting-ip and strips any inbound value, so that chain is authentic.
    // A connection whose peer is a public IP reached the app directly (bypassing
    // the edge): its headers are attacker-controlled and MUST be ignored — we
    // use the socket address. Otherwise an attacker could set
    // `cf-connecting-ip: <a real Googlebot IP>` and pass FCrDNS to bypass
    // geo/behavioral blocking and the rate limiter.
    if (this.isInternalIp(peer)) {
      const forwarded =
        (req.headers['cf-connecting-ip'] as string)?.trim() ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string)?.trim();
      if (forwarded) return forwarded;
    }

    return peer || 'unknown';
  }

  private isInternalIp(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      /^(?:::ffff:)?172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      /^(?:::ffff:)?10\./.test(ip) ||
      /^(?:::ffff:)?192\.168\./.test(ip)
    );
  }
}
