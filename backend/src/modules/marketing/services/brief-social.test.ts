import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { MarketingBriefsService } from './marketing-briefs.service';
import { MarketingBriefsController } from '../controllers/marketing-briefs.controller';

const id = '56a0c18a-3b41-48fb-9879-6ae4bd5e349a';
const stamp = '2026-10-14T10:00:00.123456+00:00';
const body = {
  post_id: 7,
  expected_updated_at: stamp,
  content_revision: 2,
  review_version: 4,
};
const receipt = {
  id: 7,
  week_iso: '2026-W42',
  content_revision: 3,
  review_version: 5,
  source_brief: {
    brief: { id, updated_at: stamp },
    linked_by: 'admin-42',
    linked_content_revision: 3,
    input_content_revision: 2,
    input_review_version: 4,
  },
};
describe('brief to social HTTP boundary', () => {
  let app: INestApplication;
  const rpc = jest.fn();
  beforeEach(async () => {
    rpc.mockReset().mockResolvedValue({ data: receipt, error: null });
    const service = Object.create(MarketingBriefsService.prototype);
    service.supabase = { rpc };
    const module = await Test.createTestingModule({
      controllers: [MarketingBriefsController],
      providers: [{ provide: MarketingBriefsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const identity = { id_utilisateur: 42, email: 'fixture@example.invalid' };
      if (req.headers['x-session'] === 'admin')
        req.user = { ...identity, id: 'admin-42', isAdmin: true };
      if (req.headers['x-session'] === 'missing-id')
        req.user = { ...identity, isAdmin: true };
      if (req.headers['x-session'] === 'member')
        req.user = { ...identity, id: 'member', level: 1 };
      next();
    });
    await app.init();
  });
  afterEach(async () => app.close());
  const call = (
    session = 'admin',
    payload: Record<string, unknown> = body,
    target = id,
  ) =>
    request(app.getHttpServer())
      .post(`/api/admin/marketing/briefs/${target}/social-content`)
      .set('x-session', session)
      .send(payload);
  it('uses the existing atomic RPC with the session actor and both versions', async () => {
    const response = await call().expect(201);
    expect(rpc).toHaveBeenCalledWith('link_marketing_brief_social', {
      p_brief_id: id,
      p_post_id: 7,
      p_expected_updated_at: stamp,
      p_content_revision: 2,
      p_review_version: 4,
      p_actor: 'admin-42',
    });
    expect(response.body).toEqual({ success: true, data: receipt });
  });
  it.each(['anonymous', 'member'])(
    'rejects %s before any write',
    async (session) => {
      await call(session).expect(403);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it('rejects missing identity and invalid UUID', async () => {
    await call('missing-id').expect(401);
    await call('admin', body, 'wrong').expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { ...body, actor: 'forged' },
    { ...body, post_id: 0 },
    { ...body, review_version: -1 },
    { ...body, content_revision: 1.5 },
    { ...body, expected_updated_at: 'bad' },
    { ...body, post_id: '7' },
  ])('rejects malformed or forged input %#', async (payload) => {
    await call('admin', payload).expect(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['40001', 409],
    ['23514', 400],
    ['P0002', 404],
    ['42501', 500],
  ])('propagates failure %s without claiming success', async (code, status) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'private database detail' },
    });
    const response = await call().expect(Number(status));
    expect(JSON.stringify(response.body)).not.toContain(
      'private database detail',
    );
  });
  it.each([
    null,
    { ...receipt, id: 8 },
    { ...receipt, source_brief: null },
    {
      ...receipt,
      source_brief: { ...receipt.source_brief, linked_by: 'forged' },
    },
  ])('rejects unconfirmed persistence %#', async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    await call().expect(500);
  });
});
