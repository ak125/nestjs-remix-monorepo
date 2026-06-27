import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
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

  it('cannot escape the sitemap dir via a single-segment ".." (basename guard)', async () => {
    // A single-segment path with dots matches the regex but basename() keeps it
    // inside the dir → resolves to a non-existent file under dir → 404, never a
    // parent-directory read.
    const req = mkReq({ path: '/sitemap-..xml' });
    const res = mkRes();
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });
});
