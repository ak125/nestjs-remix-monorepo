import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { PageRoleValidatorService } from '../../seo/validation/page-role-validator.service';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { InternalSeoAuditController } from './internal-seo-audit.controller';
import { ConseilQualityScorerService } from '../services/conseil-quality-scorer.service';
import { KeywordPlanGatesService } from '../services/keyword-plan-gates.service';
import { PACK_DEFINITIONS } from '../../../config/conseil-pack.constants';

jest.mock('@common/utils', () => ({
  ...jest.requireActual('@common/utils'),
  getEffectiveSupabaseKey: () => 'fixture-only-key',
}));

const nativeFetch = globalThis.fetch;
const KEY = 'fixture-internal-key';
const rows = () =>
  PACK_DEFINITIONS.standard.requiredSections.map((section, i) => ({
    sgc_id: String(i + 1),
    sgc_section_type: section as string,
    sgc_title: `Titre ${section}`,
    sgc_content: 'banane '.repeat(60).trim(),
    sgc_sources: '["reference non verifiee"]',
    sgc_quality_score: 100,
  }));

describe('Internal R3 audit — HTTP to real scorer/gates with memory Supabase transport', () => {
  let app: INestApplication;
  let stored = rows();
  let missing = false;
  let failRead = false;
  let truncated = false;
  let requests: URL[];
  let pageFetch: jest.SpyInstance;
  let baseUrl: string | undefined;
  let gammeAlias: string;
  const pageUrl =
    'https://pages.example.invalid/blog-pieces-auto/conseils/fixture';
  const pageHtml = `<html><head><link rel="canonical" href="${pageUrl}"></head><body><article><p>Les outils necessaires au demontage.</p></article></body></html>`;
  const pageResponse = (html = pageHtml) =>
    new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

  beforeEach(async () => {
    stored = rows();
    baseUrl = 'https://pages.example.invalid';
    gammeAlias = 'fixture';
    pageFetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => pageResponse());
    missing = false;
    failRead = false;
    truncated = false;
    requests = [];
    const transport = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        requests.push(url);
        // Any write is a test failure; use the installed query builder, not a chain mock.
        expect(init?.method ?? 'GET').toBe('GET');
        if (url.pathname.endsWith('/pieces_gamme')) {
          expect(url.searchParams.get('pg_id')).toBe('eq.1');
          return new Response(
            JSON.stringify(missing ? [] : [{ pg_id: 1, pg_alias: gammeAlias }]),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        expect(url.pathname).toBe('/rest/v1/__seo_gamme_conseil');
        expect(url.searchParams.get('sgc_pg_id')).toBe('eq.1');
        expect(url.searchParams.has('sgc_quality_score')).toBe(false);
        if (failRead)
          return new Response(
            JSON.stringify({ message: 'fixture read failed' }),
            { status: 503 },
          );
        const returned = truncated ? stored.slice(0, 1) : stored;
        return new Response(JSON.stringify(returned), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Range': `0-${Math.max(0, returned.length - 1)}/${stored.length}`,
          },
        });
      },
    );
    const client = createClient('https://example.invalid', 'fixture-only-key', {
      global: { fetch: transport },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const module = await Test.createTestingModule({
      controllers: [InternalSeoAuditController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (name: string) =>
              name === 'BASE_URL'
                ? baseUrl
                : name === 'INTERNAL_API_KEY'
                  ? KEY
                  : name === 'SUPABASE_URL'
                    ? 'https://example.invalid'
                    : 'fixture-only-key',
          },
        },
        ConseilQualityScorerService,
        KeywordPlanGatesService,
        PageRoleValidatorService,
      ],
    }).compile();
    Object.defineProperty(module.get(ConseilQualityScorerService), 'client', {
      value: client,
    });
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    pageFetch.mockRestore();
  });
  const audit = (suffix = '1') =>
    request(app.getHttpServer())
      .get(`/api/internal/seo/audit/r3/${suffix}`)
      .set('X-Internal-Key', KEY);

  it('recomputes existing 100 scores, returns actionable defects and never writes', async () => {
    const before = JSON.stringify(stored);
    const response = await audit().expect(200);
    expect(response.body.data.scoreBasis).toBe('recomputed_heuristic');
    expect(response.body.data.sections[0]).toMatchObject({
      storedScore: 100,
      score: 65,
    });
    expect(response.body.data.audit.sections_to_improve).toEqual(
      expect.arrayContaining(PACK_DEFINITIONS.standard.requiredSections),
    );
    expect(response.body.data.canSkip).toBe(false);
    expect(JSON.stringify(stored)).toBe(before);
    expect(requests).toHaveLength(2);
  });
  it('retains both affected sections for exact cross-section duplicates', async () => {
    const response = await audit().expect(200);
    expect(
      response.body.data.audit.priority_fixes.filter(
        (f: { issue: string }) => f.issue === 'duplicate_content',
      ).length,
    ).toBe(stored.length);
  });
  it('reads real section titles and routes normalized title duplicates to both sections', async () => {
    stored.forEach((row) => {
      row.sgc_content = `Texte distinct ${row.sgc_section_type}`;
    });
    stored[0].sgc_title = 'Symptômes';
    stored[1].sgc_title = 'symptomes';
    const response = await audit().expect(200);
    const sectionRead = requests.find((url) =>
      url.pathname.endsWith('/__seo_gamme_conseil'),
    );
    expect(sectionRead?.searchParams.get('select')?.split(',')).toContain(
      'sgc_title',
    );
    const fixes = response.body.data.audit.priority_fixes.filter(
      (f: { issue: string }) => f.issue === 'duplicate_content',
    );
    expect(fixes.map((f: { section: string }) => f.section).sort()).toEqual([
      'S1',
      'S2',
    ]);
    expect(response.body.data.sections[0].title).toBe('Symptômes');
    expect(response.body.data.canSkip).toBe(false);
  });
  it('does not certify an audit when the selected title column is absent', async () => {
    Reflect.deleteProperty(stored[0], 'sgc_title');
    await audit().expect(503);
  });
  it('validates the integrated diagnostic without classifying the entire page as R5', async () => {
    stored.push({
      ...stored[0],
      sgc_id: '90',
      sgc_section_type: 'S2_DIAG',
      sgc_title: 'Diagnostic rapide',
      sgc_content: 'Symptômes et code DTC : verifier le signal.',
    });
    const response = await audit().expect(200);
    expect(response.body.data.roleValidation).toMatchObject({
      scope: 'stored_sections',
      detectedRole: 'R3',
      isValid: true,
    });
  });
  it('keeps role violations visible and prevents skipping the page', async () => {
    stored.push({
      ...stored[0],
      sgc_id: '90',
      sgc_section_type: 'S2_DIAG',
      sgc_title: 'Diagnostic rapide',
      sgc_content: 'Symptômes : ajouter au panier au meilleur prix.',
    });
    const response = await audit().expect(200);
    expect(response.body.data.roleValidation.isValid).toBe(false);
    expect(response.body.data.audit.sections_to_improve).toContain('S2_DIAG');
    expect(response.body.data.audit.priority_fixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'S2_DIAG',
          issue: 'role_violation',
          fix_type: 'improve',
        }),
      ]),
    );
    expect(response.body.data.roleValidation.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          details: expect.objectContaining({ sectionType: 'S2_DIAG' }),
        }),
      ]),
    );
    expect(response.body.data.canSkip).toBe(false);
  });
  it('does not pass unknown identities or duplicate section rows silently', async () => {
    stored.push(
      { ...stored[0], sgc_id: '80' },
      { ...stored[0], sgc_id: '81', sgc_section_type: 'symptomes' },
    );
    const response = await audit().expect(200);
    expect(response.body.data.duplicateSections).toEqual(['S1']);
    expect(response.body.data.unmappedSectionIds).toEqual(['81']);
    expect(response.body.data.canSkip).toBe(false);
  });
  it('returns missing sections for an existing gamme with no content', async () => {
    stored = [];
    const response = await audit().expect(200);
    expect(response.body.data.audit.sections_to_create).toEqual(
      PACK_DEFINITIONS.standard.requiredSections,
    );
    expect(response.body.data.canSkip).toBe(false);
  });
  it('distinguishes an unknown gamme from an empty pack', async () => {
    missing = true;
    await audit().expect(404);
    expect(requests).toHaveLength(1);
  });

  it('audits served HTML with attribution and never forwards internal credentials', async () => {
    const response = await audit().expect(200);
    expect(pageFetch).toHaveBeenCalledTimes(1);
    const [target, init] = pageFetch.mock.calls[0];
    expect(String(target)).toBe(pageUrl);
    expect(init).toEqual(
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    );
    const headers = new Headers(init.headers);
    expect(headers.get('x-internal-key')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
    expect(response.body.data.renderedPage).toEqual(
      expect.objectContaining({
        scope: 'served_html',
        status: 'evaluated',
        requestedUrl: pageUrl,
        requiredAction: 'none',
        sourceVersionMatch: 'not_evaluated',
        htmlSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        roleValidation: expect.objectContaining({ isValid: true }),
      }),
    );
    expect(response.body.data.renderedPage).not.toHaveProperty('html');
  });
  it('keeps a broken rendered article in the work queue without rewriting stored sections', async () => {
    const before = (await audit().expect(200)).body.data;
    pageFetch.mockImplementation(async () =>
      pageResponse(
        pageHtml.replace(
          '</article>',
          '<div id="diagnostic-rapide">Diagnostic</div></article>',
        ),
      ),
    );
    const data = (await audit().expect(200)).body.data;
    expect(data.canSkip).toBe(false);
    expect(data.pageReviewRequired).toBe(true);
    expect(data.renderedPage.requiredAction).toBe('review_rendered_page');
    expect(data.renderedPage.roleValidation.isValid).toBe(false);
    expect(data.audit.sections_to_improve).toEqual(
      before.audit.sections_to_improve,
    );
  });
  it('detects a stored diagnostic that disappeared from the rendered article', async () => {
    stored.push({
      ...stored[0],
      sgc_id: '90',
      sgc_section_type: 'S2_DIAG',
      sgc_title: 'Diagnostic rapide',
      sgc_content: 'Symptomes et code DTC : verifier le signal.',
    });
    jest
      .spyOn(app.get(KeywordPlanGatesService), 'shouldSkipGamme')
      .mockReturnValue(true);
    const data = (await audit().expect(200)).body.data;
    expect(data.storedCanSkip).toBe(true);
    expect(data.canSkip).toBe(false);
    expect(data.renderedPage.requiredAction).toBe('review_rendered_page');
    expect(data.renderedPage.roleValidation.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          details: expect.objectContaining({ flag: 'R3_DIAGNOSTIC_MISSING' }),
        }),
      ]),
    );
  });

  it('requires a clean served page even when the stored checks permit skipping', async () => {
    jest
      .spyOn(app.get(KeywordPlanGatesService), 'shouldSkipGamme')
      .mockReturnValue(true);
    expect((await audit().expect(200)).body.data.canSkip).toBe(true);
    pageFetch.mockRejectedValue(new TypeError('fetch failed'));
    const data = (await audit().expect(200)).body.data;
    expect(data.storedCanSkip).toBe(true);
    expect(data.canSkip).toBe(false);
    expect(data.renderedPage).toMatchObject({
      status: 'unavailable',
      requiredAction: 'retry_rendered_audit',
    });
  });
  it.each([301, 302, 307, 308])(
    'surfaces redirect %s without following it or recreating a retired page',
    async (status) => {
      pageFetch.mockImplementation(
        async () =>
          new Response(null, {
            status,
            headers: { location: '/destination#section' },
          }),
      );
      const data = (await audit().expect(200)).body.data;
      expect(data.canSkip).toBe(false);
      expect(data.renderedPage).toMatchObject({
        status: 'redirected',
        httpStatus: status,
        location: '/destination#section',
        requiredAction: 'review_redirect',
      });
      expect(pageFetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each([404, 429, 500])(
    'does not validate an HTTP %s error body as content',
    async (status) => {
      pageFetch.mockImplementation(
        async () =>
          new Response(pageHtml, {
            status,
            headers: { 'content-type': 'text/html' },
          }),
      );
      const data = (await audit().expect(200)).body.data;
      expect(data.canSkip).toBe(false);
      expect(data.renderedPage.status).toBe('unavailable');
      expect(data.renderedPage.httpStatus).toBe(status);
      expect(data.renderedPage.roleValidation).toBeUndefined();
    },
  );
  it('rejects a non-HTML response', async () => {
    pageFetch.mockImplementation(
      async () =>
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
    );
    const data = (await audit().expect(200)).body.data;
    expect(data.renderedPage.reason).toBe('non_html_response');
    expect(data.canSkip).toBe(false);
  });
  it('rejects oversized HTML without scoring a truncated document', async () => {
    pageFetch.mockImplementation(async () =>
      pageResponse('x'.repeat(2 * 1024 * 1024 + 1)),
    );
    const data = (await audit().expect(200)).body.data;
    expect(data.renderedPage.reason).toBe('html_size_limit');
    expect(data.renderedPage.roleValidation).toBeUndefined();
    expect(data.canSkip).toBe(false);
  });
  it.each([
    undefined,
    '',
    'not-a-url',
    'https://user:secret@example.invalid',
    'https://example.invalid/path',
  ])(
    'requires an explicit, unambiguous environment origin (%#)',
    async (value) => {
      baseUrl = value;
      const data = (await audit().expect(200)).body.data;
      expect(data.renderedPage).toMatchObject({
        status: 'unavailable',
        reason: 'invalid_base_url',
        requiredAction: 'configure_audit_target',
      });
      expect(data.canSkip).toBe(false);
      expect(pageFetch).not.toHaveBeenCalled();
    },
  );

  it('reaches a real HTTP fixture through the audit endpoint without leaking its key', async () => {
    const hits: Array<{
      path: string | undefined;
      method: string | undefined;
      key: string | string[] | undefined;
    }> = [];
    let status = 200;
    const server = createServer((req, res) => {
      hits.push({
        path: req.url,
        method: req.method,
        key: req.headers['x-internal-key'],
      });
      res.writeHead(
        status,
        status === 200
          ? { 'content-type': 'text/html' }
          : { location: '/do-not-follow' },
      );
      res.end(status === 200 ? pageHtml : '');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    pageFetch.mockImplementation(nativeFetch);
    try {
      const data = (await audit().expect(200)).body.data;
      expect(data.renderedPage).toMatchObject({
        status: 'evaluated',
        roleValidation: { isValid: true },
      });
      expect(hits).toEqual([
        {
          path: '/blog-pieces-auto/conseils/fixture',
          method: 'GET',
          key: undefined,
        },
      ]);
      status = 301;
      const redirected = (await audit().expect(200)).body.data;
      expect(redirected.renderedPage.requiredAction).toBe('review_redirect');
      expect(hits).toHaveLength(2);
      expect(hits.some((hit) => hit.path === '/do-not-follow')).toBe(false);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  it('does not return a validated result after an interrupted body read', async () => {
    pageFetch.mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('truncated transport'));
            },
          }),
          { headers: { 'content-type': 'text/html' } },
        ),
    );
    const data = (await audit().expect(200)).body.data;
    expect(data.renderedPage.reason).toBe('fetch_failed');
    expect(data.renderedPage.roleValidation).toBeUndefined();
    expect(data.canSkip).toBe(false);
  });
  it('surfaces a timed-out request and keeps the stored diagnosis', async () => {
    pageFetch.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    const data = (await audit().expect(200)).body.data;
    expect(data.renderedPage.reason).toBe('request_timeout');
    expect(data.sections).toHaveLength(stored.length);
    expect(data.canSkip).toBe(false);
  });
  it('refuses path traversal or foreign URLs in a stored gamme alias', async () => {
    gammeAlias = '../../api/private';
    const data = (await audit().expect(200)).body.data;
    expect(data.renderedPage.reason).toBe('invalid_gamme_alias');
    expect(data.canSkip).toBe(false);
    expect(pageFetch).not.toHaveBeenCalled();
  });

  it('fails visibly on a read failure or a truncated result', async () => {
    failRead = true;
    await audit().expect(503);
    failRead = false;
    truncated = true;
    await audit().expect(503);
  });
  it.each(['0', '-1', '1junk', '1?pack=unknown'])(
    'rejects invalid target or pack before any query: %s',
    async (suffix) => {
      await audit(suffix).expect(400);
      expect(requests).toHaveLength(0);
    },
  );
  it('applies the requested pack without pretending that standard is sufficient', async () => {
    stored = [];
    const response = await audit('1?pack=pro').expect(200);
    expect(response.body.data.pack).toBe('pro');
    expect(response.body.data.audit.sections_to_create).toEqual(
      PACK_DEFINITIONS.pro.requiredSections,
    );
  });
  it('rejects malformed stored content instead of silently dropping a row', async () => {
    Object.assign(stored[0], { sgc_content: { invalid: true } });
    await audit().expect(503);
  });
  it('uses the existing internal key guard before reading content', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/seo/audit/r3/1')
      .expect(403);
    expect(requests).toHaveLength(0);
  });
});
