import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { classifyLandingSource } from './landing-source.classifier';

/**
 * Captures first-party landing attribution into express-session on the first
 * hit of a session. Registered after the session middleware in main.ts.
 *
 * Skips: non-GET, static assets, obvious crawlers, and sessions that already
 * carry a `landing` value (first-touch attribution, never overwritten).
 */
const ASSET_RE = /^\/(assets|build|favicon|robots\.txt|sitemap|@|_static)/i;
const CRAWLER_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome/i;

@Injectable()
export class LandingAttributionMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    try {
      if (req.method !== 'GET') return;
      if (!req.session) return;
      if (req.session.landing) return; // first-touch only
      if (ASSET_RE.test(req.path)) return;

      const ua = req.get('user-agent') ?? '';
      if (!ua || CRAWLER_RE.test(ua)) return;

      const source = classifyLandingSource({
        referer: req.get('referer') ?? undefined,
        query: req.query as Record<string, unknown>,
        selfHost: req.get('host') ?? '',
      });

      req.session.landing = {
        source,
        path: req.path, // pathname only — no query string (PII-safe)
        firstSeenAt: new Date().toISOString(),
      };
    } catch {
      // Attribution must never break a page request.
    } finally {
      next();
    }
  }
}
