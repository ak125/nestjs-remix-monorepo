import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import express from 'express';
import request from 'supertest';
import { SitemapStaticMiddleware } from './sitemap-static.middleware';

function mkReq(over: Record<string, unknown> = {}): any {
  return { method: 'GET', path: '/sitemap.xml', ...over };
}

function mkRes(): any {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: undefined as string | undefined,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
  };
}

describe('SitemapStaticMiddleware', () => {
  let dir: string;
  let mw: SitemapStaticMiddleware;
  const prevEnv = process.env.SITEMAP_OUTPUT_DIR;

  const INDEX_XML = '<?xml version="1.0"?><sitemapindex></sitemapindex>';
  const CHILD_XML = '<?xml version="1.0"?><urlset></urlset>';

  beforeAll(async () => {
    dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'sitemap-mw-'));
    await fs.writeFile(nodePath.join(dir, 'sitemap.xml'), INDEX_XML);
    await fs.writeFile(nodePath.join(dir, 'sitemap-categories.xml'), CHILD_XML);
    await fs.writeFile(nodePath.join(dir, 'sitemap-pieces-1.xml'), CHILD_XML);
    // env read at construction time
    process.env.SITEMAP_OUTPUT_DIR = dir;
    mw = new SitemapStaticMiddleware();
  });

  afterAll(async () => {
    process.env.SITEMAP_OUTPUT_DIR = prevEnv;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('serves the index /sitemap.xml with XML headers', async () => {
    const req = mkReq({ path: '/sitemap.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX_XML);
    expect(res.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=3600, s-maxage=86400',
    );
  });

  it('serves a hyphenated child /sitemap-categories.xml', async () => {
    const req = mkReq({ path: '/sitemap-categories.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(CHILD_XML);
  });

  it('serves a dynamic pieces shard /sitemap-pieces-1.xml', async () => {
    const req = mkReq({ path: '/sitemap-pieces-1.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toBe(CHILD_XML);
  });

  it('returns an explicit XML 404 for a missing sitemap (no silent fallback)', async () => {
    const req = mkReq({ path: '/sitemap-does-not-exist.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(res.body).toContain('<error>');
  });

  it('passes through non-sitemap paths', async () => {
    const req = mkReq({ path: '/pieces/plaquettes-de-frein' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
  });

  it('passes through the /sitemaps/* namespace (handled elsewhere)', async () => {
    const req = mkReq({ path: '/sitemaps/stable/sitemap-stable-pieces-1.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
  });

  it('passes through the /sitemap-v2/* controller namespace', async () => {
    const req = mkReq({ path: '/sitemap-v2/delta/latest.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
  });

  it('passes through non-GET/HEAD methods', async () => {
    const req = mkReq({ method: 'POST', path: '/sitemap.xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
  });

  it('does not match a path that lacks the .xml suffix', async () => {
    const req = mkReq({ path: '/sitemap-categories' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// Real-HTTP integration: a minimal Express app wiring the middleware exactly as
// main.ts does (global app.use, before a catch-all standing in for the
// RemixController). Validates real URL decoding, header/status emission, and the
// pass-through ordering — without binding the canonical :3000 port.
describe('SitemapStaticMiddleware (HTTP integration)', () => {
  let dir: string;
  const prevEnv = process.env.SITEMAP_OUTPUT_DIR;
  const CHILD_XML = '<?xml version="1.0"?><urlset></urlset>';
  let app: express.Express;

  beforeAll(async () => {
    dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'sitemap-mw-http-'));
    await fs.writeFile(nodePath.join(dir, 'sitemap.xml'), CHILD_XML);
    await fs.writeFile(nodePath.join(dir, 'sitemap-categories.xml'), CHILD_XML);
    await fs.writeFile(nodePath.join(dir, 'secret.txt'), 'TOP SECRET');
    process.env.SITEMAP_OUTPUT_DIR = dir;

    const mw = new SitemapStaticMiddleware();
    app = express();
    app.use((req, res, next) => mw.use(req, res, next));
    // Stand-in for the RemixController @All(':path*') catch-all.
    app.use((_req, res) => res.status(418).type('text/html').send('CATCHALL'));
  });

  afterAll(async () => {
    process.env.SITEMAP_OUTPUT_DIR = prevEnv;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('serves a child sitemap over real HTTP with XML content-type', async () => {
    const res = await request(app).get('/sitemap-categories.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=3600, s-maxage=86400',
    );
    expect(res.text).toBe(CHILD_XML);
  });

  it('returns XML 404 for a missing sitemap (not the HTML catch-all)', async () => {
    const res = await request(app).get('/sitemap-nope.xml');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).not.toContain('CATCHALL');
  });

  it('passes a normal page through to the catch-all', async () => {
    const res = await request(app).get('/pieces/plaquettes-de-frein');
    expect(res.status).toBe(418);
    expect(res.text).toBe('CATCHALL');
  });

  it('passes /sitemaps/* through to the catch-all', async () => {
    const res = await request(app).get('/sitemaps/stable/x.xml');
    expect(res.status).toBe(418);
  });

  it('does not serve non-sitemap files via path traversal', async () => {
    // Encoded traversal: Express decodes %2e/%2f; any resulting '/' breaks the
    // single-segment regex → pass-through, never leaks secret.txt.
    const res = await request(app).get('/sitemap-%2e%2e%2fsecret.txt');
    expect(res.text).not.toContain('TOP SECRET');
  });
});
