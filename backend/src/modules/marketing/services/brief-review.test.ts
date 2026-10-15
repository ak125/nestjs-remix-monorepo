import { createClient } from '@supabase/supabase-js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { MarketingBriefsService } from './marketing-briefs.service';
import { MarketingBriefsController } from '../controllers/marketing-briefs.controller';

const id = '56a0c18a-3b41-48fb-9879-6ae4bd5e349a';
const stamp = '2026-10-14T10:00:00.123456+00:00';
function fixture() {
  return {
    id,
    agent_id: 'lead',
    business_unit: 'ECOMMERCE',
    channel: 'social_facebook',
    conversion_goal: 'ORDER',
    cta: 'Consulter les plaquettes compatibles',
    target_segment: 'automobilistes',
    payload: { caption: 'Vérifiez la compatibilité.' },
    coverage_manifest: {
      scope_requested: 'plaquettes',
      final_status: 'REVIEW_REQUIRED',
    },
    brand_gate_level: 'PASS',
    compliance_gate_level: 'WARN',
    gate_summary: { can_approve: true, blocking_issues: [] },
    status: 'draft',
    reviewed_by: null as string | null,
    reviewed_at: null as string | null,
    approved_by: null as string | null,
    approved_at: null as string | null,
    created_at: stamp,
    updated_at: stamp,
  };
}
function setup() {
  let row = fixture();
  const patches: { url: URL; body: Record<string, unknown> }[] = [];
  let collision = false;
  let failure = false;
  const client = createClient('http://127.0.0.1:54321', 'test-placeholder', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body));
          patches.push({ url, body });
          if (failure)
            return new Response(
              JSON.stringify({ code: '42501', message: 'private detail' }),
              { status: 403 },
            );
          if (collision)
            row = {
              ...row,
              updated_at: '2026-10-14T11:00:00Z',
              cta: 'Contenu modifié',
            };
          const matches = ['id', 'status', 'updated_at'].every((key) => {
            const filter = url.searchParams.get(key);
            return !filter || filter === `eq.${row[key as keyof typeof row]}`;
          });
          if (!matches)
            return new Response('[]', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          row = { ...row, ...body, updated_at: '2026-10-14T12:00:00Z' };
        }
        const singular = new Headers(init?.headers)
          .get('Accept')
          ?.includes('object');
        return new Response(JSON.stringify(singular ? row : [row]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  const service: MarketingBriefsService = Object.create(
    MarketingBriefsService.prototype,
  );
  Object.defineProperties(service, {
    supabase: { value: client },
    logger: { value: { error: jest.fn() } },
  });
  return {
    service,
    patches,
    get row() {
      return row;
    },
    collide() {
      collision = true;
    },
    fail() {
      failure = true;
    },
  };
}

describe('brief review transitions with native Supabase transport', () => {
  it('records a review with the server actor and exact version predicates', async () => {
    const state = setup();
    const result = await state.service.updateBriefStatus(
      id,
      'reviewed',
      'admin-42',
      stamp,
    );
    expect(result).toMatchObject({
      status: 'reviewed',
      reviewed_by: 'admin-42',
      approved_by: null,
    });
    expect(result.reviewed_at).toEqual(expect.any(String));
    expect(state.patches[0].url.searchParams.get('updated_at')).toBe(
      `eq.${stamp}`,
    );
    expect(state.patches[0].url.searchParams.get('status')).toBe('eq.draft');
  });
  it('approves a reviewed brief with nonblocking gates and preserves its review', async () => {
    const state = setup();
    Object.assign(state.row, {
      status: 'reviewed',
      reviewed_by: 'reviewer',
      reviewed_at: stamp,
    });
    expect(
      await state.service.updateBriefStatus(id, 'approved', 'admin-42', stamp),
    ).toMatchObject({
      status: 'approved',
      approved_by: 'admin-42',
      reviewed_by: 'reviewer',
      reviewed_at: stamp,
    });
  });
  it.each([
    ['draft', 'approved'],
    ['draft', 'published'],
    ['reviewed', 'published'],
    ['approved', 'published'],
    ['approved', 'reviewed'],
    ['archived', 'reviewed'],
    ['published', 'archived'],
    ['reviewed', 'reviewed'],
    ['approved', 'approved'],
  ] as const)('rejects %s -> %s without writing', async (from, to) => {
    const state = setup();
    state.row.status = from;
    await expect(
      state.service.updateBriefStatus(id, to, 'admin-42', stamp),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.patches).toHaveLength(0);
  });
  it.each(['draft', 'reviewed', 'approved'])(
    'archives an unpublished %s brief',
    async (from) => {
      const state = setup();
      state.row.status = from;
      expect(
        await state.service.updateBriefStatus(
          id,
          'archived',
          'admin-42',
          stamp,
        ),
      ).toMatchObject({ status: 'archived' });
    },
  );
  it.each([
    { brand_gate_level: null },
    { compliance_gate_level: 'FAIL' },
    { gate_summary: null },
    { gate_summary: { can_approve: false, blocking_issues: [] } },
    {
      gate_summary: {
        can_approve: true,
        blocking_issues: ['Vérification requise'],
      },
    },
    { reviewed_by: null },
    { reviewed_at: null },
    { cta: '' },
  ])(
    'refuses approval without complete valid review and gates %#',
    async (patch) => {
      const state = setup();
      Object.assign(
        state.row,
        { status: 'reviewed', reviewed_by: 'reviewer', reviewed_at: stamp },
        patch,
      );
      await expect(
        state.service.updateBriefStatus(id, 'approved', 'admin-42', stamp),
      ).rejects.toMatchObject({ status: 400 });
      expect(state.patches).toHaveLength(0);
    },
  );
  it('refuses the version of an older displayed page', async () => {
    const state = setup();
    await expect(
      state.service.updateBriefStatus(
        id,
        'reviewed',
        'admin-42',
        '2026-10-13T10:00:00Z',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.patches).toHaveLength(0);
  });
  it('does not approve a row changed between reading and writing', async () => {
    const state = setup();
    state.collide();
    await expect(
      state.service.updateBriefStatus(id, 'reviewed', 'admin-42', stamp),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.row.status).toBe('draft');
    expect(state.row.cta).toBe('Contenu modifié');
  });
  it('does not turn a failed persistence into success', async () => {
    const state = setup();
    state.fail();
    await expect(
      state.service.updateBriefStatus(id, 'reviewed', 'admin-42', stamp),
    ).rejects.toMatchObject({ status: 500 });
    expect(state.row.status).toBe('draft');
  });
});

describe('brief review HTTP boundary with real controller/service and synthetic sessions', () => {
  let app: INestApplication;
  let state: ReturnType<typeof setup>;
  beforeEach(async () => {
    state = setup();
    const module = await Test.createTestingModule({
      controllers: [MarketingBriefsController],
      providers: [{ provide: MarketingBriefsService, useValue: state.service }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const identity = { id_utilisateur: 42, email: 'fixture@example.invalid' };
      if (req.headers['x-test-session'] === 'admin')
        req.user = { ...identity, id: 'admin-42', isAdmin: true };
      if (req.headers['x-test-session'] === 'missing-id')
        req.user = { ...identity, isAdmin: true };
      if (req.headers['x-test-session'] === 'member')
        req.user = { ...identity, id: 'member', level: 1 };
      next();
    });
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  const body = { status: 'reviewed', expected_updated_at: stamp };
  it('exposes the same authoritative actions as the write policy', async () => {
    const read = () =>
      request(app.getHttpServer())
        .get(`/api/admin/marketing/briefs/${id}`)
        .set('x-test-session', 'admin')
        .expect(200);
    expect((await read()).body.review).toEqual({
      allowed_actions: ['reviewed', 'archived'],
      blocked_reason: null,
    });
    Object.assign(state.row, {
      status: 'reviewed',
      reviewed_by: 'reviewer',
      reviewed_at: stamp,
      brand_gate_level: 'FAIL',
    });
    expect((await read()).body.review).toEqual({
      allowed_actions: ['archived'],
      blocked_reason: expect.any(String),
    });
    state.row.brand_gate_level = 'PASS';
    expect((await read()).body.review.allowed_actions).toEqual([
      'approved',
      'archived',
    ]);
    state.row.status = 'published';
    expect((await read()).body.review.allowed_actions).toEqual([]);
  });
  it('rejects malformed identifiers and publication through this endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/marketing/briefs/not-a-uuid')
      .set('x-test-session', 'admin')
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/admin/marketing/briefs/${id}/status`)
      .set('x-test-session', 'admin')
      .send({ ...body, status: 'published' })
      .expect(400);
    expect(state.patches).toHaveLength(0);
  });
  it.each(['anonymous', 'member'])(
    'rejects %s read and decision',
    async (identity) => {
      await request(app.getHttpServer())
        .get(`/api/admin/marketing/briefs/${id}`)
        .set('x-test-session', identity)
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/admin/marketing/briefs/${id}/status`)
        .set('x-test-session', identity)
        .send(body)
        .expect(403);
      expect(state.patches).toHaveLength(0);
    },
  );
  it('uses authenticated identity for persisted review', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/admin/marketing/briefs/${id}/status`)
      .set('x-test-session', 'admin')
      .send(body)
      .expect(200);
    expect(response.body.data.reviewed_by).toBe('admin-42');
    expect(state.row.reviewed_by).toBe('admin-42');
  });
  it.each([
    { ...body, reviewed_by: 'forged' },
    { ...body, approved_by: 'forged' },
    { status: 'reviewed' },
    { ...body, expected_updated_at: 'invalid' },
  ])('rejects malformed or forged decisions %#', async (value) => {
    await request(app.getHttpServer())
      .patch(`/api/admin/marketing/briefs/${id}/status`)
      .set('x-test-session', 'admin')
      .send(value)
      .expect(400);
    expect(state.patches).toHaveLength(0);
  });
  it('rejects an unidentified admin instead of inventing an actor', async () => {
    await request(app.getHttpServer())
      .patch(`/api/admin/marketing/briefs/${id}/status`)
      .set('x-test-session', 'missing-id')
      .send(body)
      .expect(401);
    expect(state.patches).toHaveLength(0);
  });
});
