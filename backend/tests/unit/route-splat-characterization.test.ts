/**
 * Route splat CHARACTERIZATION tests (PR-9f safety net).
 *
 * Captures the EXACT value passed to each service for a given request URL,
 * across the three controllers that use a path-to-regexp wildcard parameter:
 *   - OptimizedMetadataController  (api/metadata, `:path(.*)` → `{*path}`)
 *   - OptimizedBreadcrumbController (api/breadcrumb, `:path(.*)` → `{*path}`)
 *   - SeoController                (api/seo, `metadata|redirect/:url(.*)` → `{*url}`)
 *
 * Purpose: this file is written UNDER Nest 10 / Express 4 (path-to-regexp v6,
 * `:path(.*)` syntax) and MUST keep passing UNCHANGED after the Nest 11 /
 * Express 5 bump (path-to-regexp v8, `{*path}` syntax) — proving the URL
 * contract for real-world (single-encoded) URLs is preserved.
 *
 * The legacy handler double-decodes (Express param decode + manual
 * `decodeURIComponent`); the v8 splat single-decodes. For SINGLE-encoded
 * inputs the two are identical (asserted here). Double-encoded inputs
 * (`%252F`) are characterized separately (see the `double-encoded` block):
 * the v8 single-decode is the intended hardening, not a regression.
 *
 * @see backend/src/modules/metadata/controllers/optimized-metadata.controller.ts
 * @see backend/src/modules/metadata/controllers/optimized-breadcrumb.controller.ts
 * @see backend/src/modules/seo/seo.controller.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { OptimizedMetadataController } from '../../src/modules/metadata/controllers/optimized-metadata.controller';
import { OptimizedMetadataService } from '../../src/modules/metadata/services/optimized-metadata.service';
import { OptimizedBreadcrumbController } from '../../src/modules/metadata/controllers/optimized-breadcrumb.controller';
import { OptimizedBreadcrumbService } from '../../src/modules/metadata/services/optimized-breadcrumb.service';
import { SeoController } from '../../src/modules/seo/seo.controller';
import { SeoService } from '../../src/modules/seo/seo.service';
import { UrlCompatibilityService } from '../../src/modules/seo/validation/url-compatibility.service';
import { SeoKpisService } from '../../src/modules/seo/services/seo-kpis.service';
import { AuthenticatedGuard } from '../../src/auth/authenticated.guard';
import { IsAdminGuard } from '../../src/auth/is-admin.guard';

describe('Route splat characterization (PR-9f URL contract)', () => {
  let app: INestApplication;

  const metaSvc = {
    getPageMetadata: jest.fn().mockResolvedValue({ ok: true }),
    updatePageMetadata: jest.fn().mockResolvedValue({ ok: true }),
    deletePageMetadata: jest.fn().mockResolvedValue(undefined),
  };
  const breadcrumbSvc = {
    getBreadcrumbs: jest.fn().mockResolvedValue([]),
    updateBreadcrumb: jest.fn().mockResolvedValue(undefined),
    getBreadcrumbConfig: jest.fn().mockReturnValue({}),
    clearCache: jest.fn().mockResolvedValue(undefined),
    generateBreadcrumbSchema: jest.fn().mockReturnValue({}),
  };
  const seoSvc = {
    getMetadata: jest.fn().mockResolvedValue(null),
    getRedirect: jest.fn().mockResolvedValue(null),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        OptimizedMetadataController,
        OptimizedBreadcrumbController,
        SeoController,
      ],
      providers: [
        { provide: OptimizedMetadataService, useValue: metaSvc },
        { provide: OptimizedBreadcrumbService, useValue: breadcrumbSvc },
        { provide: SeoService, useValue: seoSvc },
        { provide: UrlCompatibilityService, useValue: {} },
        { provide: SeoKpisService, useValue: {} },
      ],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      // Metadata PUT/DELETE + breadcrumb POST are admin-guarded (served-metadata
      // write authz P0). This suite characterizes URL decoding, not authz, so we
      // bypass the admin boundary too — enforcement is covered by
      // tests/unit/seo-metadata-authz.test.ts.
      .overrideGuard(IsAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  // ---- metadata: GET /api/metadata/:path → getPageMetadata('/' + decoded) ----
  describe('GET /api/metadata/* → getPageMetadata(decodedPath)', () => {
    const cases: Array<[string, string, string]> = [
      ['multi-segment', '/api/metadata/pieces/freinage', '/pieces/freinage'],
      ['single-segment', '/api/metadata/sitemap.xml', '/sitemap.xml'],
      ['space %20', '/api/metadata/a%20b', '/a b'],
      ['accent %C3%A9', '/api/metadata/caf%C3%A9', '/café'],
      ['encoded slash %2F (single)', '/api/metadata/a%2Fb', '/a/b'],
      ['root (trailing slash)', '/api/metadata/', '/'],
    ];
    it.each(cases)('%s: %s → %s', async (_label, url, expected) => {
      const res = await request(app.getHttpServer()).get(url);
      expect(res.status).toBe(200);
      expect(metaSvc.getPageMetadata).toHaveBeenCalledWith(expected);
    });
  });

  // ---- metadata: PUT / DELETE (same decode contract) ----
  it('PUT /api/metadata/pieces/freinage → updatePageMetadata("/pieces/freinage", body)', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/metadata/pieces/freinage')
      .send({ meta_title: 'x' });
    expect(res.status).toBe(200);
    expect(metaSvc.updatePageMetadata).toHaveBeenCalledWith(
      '/pieces/freinage',
      expect.objectContaining({ meta_title: 'x' }),
    );
  });
  it('DELETE /api/metadata/pieces/freinage → deletePageMetadata("/pieces/freinage")', async () => {
    const res = await request(app.getHttpServer()).delete(
      '/api/metadata/pieces/freinage',
    );
    expect(res.status).toBe(200);
    expect(metaSvc.deletePageMetadata).toHaveBeenCalledWith('/pieces/freinage');
  });

  // ---- breadcrumb: specific routes must win over the generic `:path(.*)` ----
  describe('GET /api/breadcrumb/* routing precedence + decode', () => {
    it('specific /api/breadcrumb/statistics is NOT captured by the wildcard', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/breadcrumb/statistics',
      );
      expect(res.status).toBe(200);
      expect(res.body?.data?.total).toBe(42);
      expect(breadcrumbSvc.getBreadcrumbs).not.toHaveBeenCalled();
    });
    it('generic /api/breadcrumb/pieces/freinage → getBreadcrumbs("/pieces/freinage","fr")', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/breadcrumb/pieces/freinage',
      );
      expect(res.status).toBe(200);
      expect(breadcrumbSvc.getBreadcrumbs).toHaveBeenCalledWith(
        '/pieces/freinage',
        'fr',
      );
    });
    it('root /api/breadcrumb/ → getBreadcrumbs("/","fr")', async () => {
      const res = await request(app.getHttpServer()).get('/api/breadcrumb/');
      expect(res.status).toBe(200);
      expect(breadcrumbSvc.getBreadcrumbs).toHaveBeenCalledWith('/', 'fr');
    });
  });

  // ---- breadcrumb: schema/:path is DEAD (shadowed by generic :path(.*)) ----
  // The generic `@Get(':path(.*)')` (declared before schema/) captures
  // `schema/...`, so generateBreadcrumbSchema is never reached. Lock this
  // pre-existing behavior — the migration must NOT change it (no reordering).
  it('GET /api/breadcrumb/schema/foo is shadowed → getBreadcrumbs("/schema/foo"), schema NOT generated', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/breadcrumb/schema/foo',
    );
    expect(res.status).toBe(200);
    expect(breadcrumbSvc.getBreadcrumbs).toHaveBeenCalledWith('/schema/foo', 'fr');
    expect(breadcrumbSvc.generateBreadcrumbSchema).not.toHaveBeenCalled();
  });

  // ---- seo: metadata|redirect/:url → decodeURIComponent(url) (NO leading slash) ----
  describe('GET /api/seo/* → service(decodedUrl) without leading slash', () => {
    it('GET /api/seo/metadata/pieces/freinage.html → getMetadata("pieces/freinage.html")', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/seo/metadata/pieces/freinage.html',
      );
      expect(res.status).toBe(200);
      expect(seoSvc.getMetadata).toHaveBeenCalledWith('pieces/freinage.html');
    });
    it('GET /api/seo/metadata/caf%C3%A9 → getMetadata("café")', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/seo/metadata/caf%C3%A9',
      );
      expect(res.status).toBe(200);
      expect(seoSvc.getMetadata).toHaveBeenCalledWith('café');
    });
    it('GET /api/seo/redirect/old/url → getRedirect("old/url")', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/seo/redirect/old/url',
      );
      expect(res.status).toBe(200);
      expect(seoSvc.getRedirect).toHaveBeenCalledWith('old/url');
    });
  });

  // ---- Double-encoded: characterize CURRENT behavior (may change post-bump) ----
  // Documents the legacy double-decode. Post-bump (v8 single-decode) the
  // value becomes the single-decoded form; this is the intended hardening
  // (CWE-174 double-decode). Asserted loosely so the file stays green now and
  // the post-bump value is re-locked in C6 with an explicit diff note.
  it('double-encoded %252F is decoded (current behavior recorded)', async () => {
    await request(app.getHttpServer()).get('/api/metadata/a%252Fb');
    const arg = metaSvc.getPageMetadata.mock.calls[0]?.[0];
    // current (Nest 10) value recorded by the run; assert it is a defined string
    expect(typeof arg).toBe('string');
    // eslint-disable-next-line no-console
    console.log(`[characterization] /api/metadata/a%252Fb → getPageMetadata(${JSON.stringify(arg)})`);
  });
});
