import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';

/**
 * Serves the root-level static sitemap files (`/sitemap.xml`, `/sitemap-*.xml`,
 * including the dynamic `sitemap-pieces-N.xml` shards) from the on-disk sitemap
 * directory.
 *
 * Why this exists: in PROD, Caddy serves `/sitemap*.xml` directly from
 * `/var/www/sitemaps` (`config/caddy/Caddyfile`, `@sitemaps`), short-circuiting
 * the Node app. In DEV (`npm run dev`, no Caddy) there is no edge layer, and a
 * React Router splat cannot match a `sitemap-`-prefixed path (a splat `*` must
 * follow a `/`), so the children fell through to the catch-all and 404'd. This
 * middleware mirrors the canonical Caddy block at the app layer so DEV matches
 * PROD, and acts as defence-in-depth if a request ever reaches the app directly.
 *
 * Registered globally in main.ts (alongside the static-asset handler), so it runs
 * before the RemixController `@All(':path*')` catch-all. Read-only — compatible
 * with PREPROD `READ_ONLY=true` (ADR-028). Honors `SITEMAP_OUTPUT_DIR`.
 *
 * Headers mirror Caddy (Content-Type + Cache-Control) for parity. The path regex
 * matches a single root segment only — any path containing `/` (so `/sitemaps/*`
 * and `/sitemap-v2/*`) is left to its existing handler.
 */
const SITEMAP_PATH_RE = /^\/sitemap[\w.-]*\.xml$/;

@Injectable()
export class SitemapStaticMiddleware implements NestMiddleware {
  private readonly dir = process.env.SITEMAP_OUTPUT_DIR || '/var/www/sitemaps';

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!SITEMAP_PATH_RE.test(req.path)) return next();

    // req.path is URL-decoded and normalized by Express; the regex already
    // forbids '/' so no traversal is possible. The containment assertion below
    // is belt-and-suspenders.
    const filePath = nodePath.join(this.dir, req.path);
    if (
      filePath !== this.dir &&
      !filePath.startsWith(this.dir + nodePath.sep)
    ) {
      return next();
    }

    let xml: string;
    try {
      xml = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        // Explicit XML 404 — no silent fallback to the HTML catch-all.
        res
          .status(404)
          .setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.send(
          `<?xml version="1.0" encoding="UTF-8"?><error>Sitemap ${req.path} not found</error>`,
        );
        return;
      }
      return next(err);
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(xml);
  }
}
