import { createClient } from '@supabase/supabase-js';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MarketingBriefsController } from '../../src/modules/marketing/controllers/marketing-briefs.controller';
import { MarketingBriefsService } from '../../src/modules/marketing/services/marketing-briefs.service';
import { BrandComplianceGateService } from '../../src/modules/marketing/services/brand-compliance-gate.service';
import { MarketingHubDataService } from '../../src/modules/marketing/services/marketing-hub-data.service';
import { RpcGateService } from '../../src/security/rpc-gate/rpc-gate.service';

jest.mock('@database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {},
}));

describe('Marketing brief PostgREST query contract', () => {
  const brief = {
    id: 'brief-1',
    status: 'draft',
    updated_at: '2026-10-01T12:00:00.123456+00:00',
    agent_id: 'customer-retention-agent',
    business_unit: 'ECOMMERCE',
    channel: 'email',
    conversion_goal: 'ORDER',
    cta: 'Commander',
    target_segment: 'test',
    payload: {},
    coverage_manifest: {
      scope_requested: 'test',
      final_status: 'REVIEW_REQUIRED',
    },
    brand_gate_level: 'PASS',
    compliance_gate_level: 'PASS',
    gate_summary: null,
  };

  it.each([false, true])(
    'uses the actual client and CAS filters (conflict=%s)',
    async (conflict) => {
      const calls: Array<{ url: URL; method: string; body: unknown }> = [];
      // No real network: inspect the request produced by the installed supabase-js.
      const client = createClient('https://supabase.invalid', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input, init) => {
            const method = init?.method ?? 'GET';
            const body = init?.body ? JSON.parse(String(init.body)) : null;
            calls.push({ url: new URL(String(input)), method, body });
            return new Response(
              JSON.stringify(
                method === 'GET'
                  ? [brief]
                  : conflict
                    ? []
                    : [{ ...brief, ...body }],
              ),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            );
          },
        },
      });
      const service = new MarketingBriefsService(
        {} as RpcGateService,
        new BrandComplianceGateService({} as MarketingHubDataService),
      );
      Object.defineProperty(service, 'supabase', { value: client });
      const result = service.updateBriefStatus(
        'brief-1',
        'reviewed',
        'admin@example.test',
      );
      if (conflict) await expect(result).rejects.toMatchObject({ status: 409 });
      else
        await expect(result).resolves.toMatchObject({
          status: 'reviewed',
          reviewed_by: 'admin@example.test',
        });
      expect(calls).toHaveLength(2);
      const write = calls[1];
      expect(write.method).toBe('PATCH');
      expect(write.url.pathname).toBe('/rest/v1/__marketing_brief');
      expect(Object.fromEntries(write.url.searchParams)).toEqual({
        id: 'eq.brief-1',
        status: 'eq.draft',
        updated_at: 'eq.2026-10-01T12:00:00.123456+00:00',
        select: '*',
      });
      expect(write.body).toEqual({
        status: 'reviewed',
        reviewed_by: 'admin@example.test',
        reviewed_at: expect.any(String),
      });
    },
  );
});

describe('Marketing brief read HTTP contract with real PostgREST client', () => {
  let app: INestApplication;
  let calls: URL[];
  let responseStatus: number;
  let rows: Array<Record<string, unknown>>;
  let isAdmin: boolean;
  const url = '/api/admin/marketing/briefs';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketingBriefsController],
      providers: [
        MarketingBriefsService,
        { provide: RpcGateService, useValue: {} },
        { provide: BrandComplianceGateService, useValue: {} },
      ],
    }).compile();
    const client = createClient('https://supabase.invalid', 'test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          calls.push(new URL(String(input)));
          return new Response(
            JSON.stringify(
              responseStatus === 200
                ? rows
                : {
                    code: '08006',
                    message: 'simulated storage unavailable',
                    details: null,
                    hint: null,
                  },
            ),
            {
              status: responseStatus,
              headers: {
                'content-type': 'application/json',
                'content-range': rows.length
                  ? `0-${rows.length - 1}/${rows.length}`
                  : '*/0',
              },
            },
          );
        },
      },
    });
    Object.defineProperty(module.get(MarketingBriefsService), 'supabase', {
      value: client,
    });
    app = module.createNestApplication({ logger: false });
    app.use((req, _res, next) => {
      req.user = { isAdmin, email: 'admin@example.test' };
      next();
    });
    await app.init();
  });
  beforeEach(() => {
    calls = [];
    responseStatus = 200;
    rows = [];
    isAdmin = true;
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([
    'page=2junk',
    'page=abc',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=',
    'limit=-1',
    'limit=0',
    'limit=1e2',
    'limit=',
    'limit=NaN',
    'page=9007199254740992',
    'page=9007199254740991&limit=100',
    'page=1&page=2',
    'limit=10&limit=20',
    'business_unit=UNKNOWN',
    'business_unit=LOCAL&business_unit=HYBRID',
    'status=unknown',
    'status=draft&status=approved',
    'agent_id=',
    `agent_id=${'x'.repeat(101)}`,
  ])('rejects invalid query %s without contacting storage', async (query) => {
    await request(app.getHttpServer()).get(`${url}?${query}`).expect(400);
    expect(calls).toHaveLength(0);
  });

  it('keeps default pagination and a genuinely empty successful result', async () => {
    const result = await request(app.getHttpServer()).get(url).expect(200);
    expect(result.body).toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 20 },
    });
    expect(Object.fromEntries(calls[0].searchParams)).toEqual({
      select: '*',
      order: 'created_at.desc',
      offset: '0',
      limit: '20',
    });
  });
  it('preserves valid filters, requested page and the existing 100-row cap', async () => {
    const result = await request(app.getHttpServer())
      .get(url)
      .query({
        business_unit: 'LOCAL',
        status: 'draft',
        agent_id: 'local-business-agent',
        page: '2',
        limit: '150',
      })
      .expect(200);
    expect(result.body.data).toMatchObject({ page: 2, limit: 100 });
    expect(Object.fromEntries(calls[0].searchParams)).toEqual({
      select: '*',
      business_unit: 'eq.LOCAL',
      status: 'eq.draft',
      agent_id: 'eq.local-business-agent',
      order: 'created_at.desc',
      offset: '100',
      limit: '100',
    });
  });
  it('returns the list rows and exact count supplied by storage', async () => {
    rows = [{ id: 'brief-fixture', status: 'draft', business_unit: 'LOCAL' }];
    const result = await request(app.getHttpServer()).get(url).expect(200);
    expect(result.body.data).toMatchObject({ items: rows, total: 1 });
  });
  it('keeps empty statistics valid when storage is available', async () => {
    const result = await request(app.getHttpServer())
      .get(`${url}/stats`)
      .expect(200);
    expect(result.body).toEqual({
      success: true,
      data: { by_status: {}, by_business_unit: {}, total: 0 },
    });
  });
  it('aggregates available statistics instead of returning default zeros', async () => {
    rows = [
      { status: 'draft', business_unit: 'LOCAL' },
      { status: 'reviewed', business_unit: 'ECOMMERCE' },
      { status: 'draft', business_unit: 'LOCAL' },
    ];
    const result = await request(app.getHttpServer())
      .get(`${url}/stats`)
      .expect(200);
    expect(result.body.data).toEqual({
      by_status: { draft: 2, reviewed: 1 },
      by_business_unit: { LOCAL: 2, ECOMMERCE: 1 },
      total: 3,
    });
  });
  it.each(['', '/stats'])(
    'reports storage failure as 503 for GET %s',
    async (suffix) => {
      // A non-retryable simulated storage error keeps this test fast; it is not a client input error.
      responseStatus = 500;
      const result = await request(app.getHttpServer())
        .get(`${url}${suffix}`)
        .expect(503);
      expect(result.body.message).toBe('Brief storage unavailable');
      expect(result.body).not.toHaveProperty('data');
    },
  );
  it.each(['', '/stats'])(
    'retains admin authorization for GET %s',
    async (suffix) => {
      isAdmin = false;
      await request(app.getHttpServer()).get(`${url}${suffix}`).expect(403);
      expect(calls).toHaveLength(0);
    },
  );
});
