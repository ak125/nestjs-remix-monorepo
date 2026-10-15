import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { MarketingSocialPostsController } from './marketing-social-posts.controller';
import { MarketingHubDataService } from '../services/marketing-hub-data.service';
import { PublishQueueService } from '../services/publish-queue.service';
import { BrandComplianceGateService } from '../services/brand-compliance-gate.service';

describe('social approval HTTP boundary (isolated session fixture)', () => {
  let app: INestApplication;
  const queue = { approvePost: jest.fn().mockResolvedValue(true) };
  const hub = {
    getPostById: jest.fn().mockResolvedValue({ id: 7, week_iso: '2026-W42' }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketingSocialPostsController],
      providers: [
        { provide: MarketingHubDataService, useValue: hub },
        { provide: PublishQueueService, useValue: queue },
        { provide: BrandComplianceGateService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    // Test-only identity injection. Real session deserialization is not exercised.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const identity = { id_utilisateur: 42, email: 'fixture@example.invalid' };
      if (req.headers['x-test-session'] === 'admin')
        req.user = { ...identity, id: 'admin-42', isAdmin: true };
      if (req.headers['x-test-session'] === 'customer')
        req.user = { ...identity, id: 'customer-42', level: 1 };
      next();
    });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  const body = { channel: 'facebook', content_revision: 2, review_version: 3 };
  it.each(['anonymous', 'customer'])(
    'refuses %s access to a linked content',
    async (identity) => {
      hub.getPostById.mockClear();
      await request(app.getHttpServer())
        .get('/api/admin/marketing/social/posts/7')
        .set('x-test-session', identity)
        .expect(403);
      expect(hub.getPostById).not.toHaveBeenCalled();
    },
  );
  it('resolves exact content and distinguishes missing and malformed identifiers', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/marketing/social/posts/7')
      .set('x-test-session', 'admin')
      .expect(200, { data: { id: 7, week_iso: '2026-W42' } });
    await request(app.getHttpServer())
      .get('/api/admin/marketing/social/posts/7junk')
      .set('x-test-session', 'admin')
      .expect(400);
    hub.getPostById.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get('/api/admin/marketing/social/posts/8')
      .set('x-test-session', 'admin')
      .expect(404);
  });
  it.each(['anonymous', 'customer'])(
    'refuses %s before mutation',
    async (identity) => {
      queue.approvePost.mockClear();
      await request(app.getHttpServer())
        .put('/api/admin/marketing/social/posts/7/approve')
        .set('x-test-session', identity)
        .send(body)
        .expect(403);
      expect(queue.approvePost).not.toHaveBeenCalled();
    },
  );
  it('passes exact target and server session actor to approval', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/marketing/social/posts/7/approve')
      .set('x-test-session', 'admin')
      .send(body)
      .expect(200, { success: true });
    expect(queue.approvePost).toHaveBeenCalledWith(7, body, 'admin-42');
  });
  it('rejects a forged body actor', async () => {
    queue.approvePost.mockClear();
    await request(app.getHttpServer())
      .put('/api/admin/marketing/social/posts/7/approve')
      .set('x-test-session', 'admin')
      .send({ ...body, approved_by: 'someone-else' })
      .expect(400);
    expect(queue.approvePost).not.toHaveBeenCalled();
  });
});
