import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MarketingSocialPostsController } from './marketing-social-posts.controller';
import { MarketingHubDataService } from '../services/marketing-hub-data.service';
import { PublishQueueService } from '../services/publish-queue.service';
import { UTMBuilderService } from '../services/utm-builder.service';
import { BrandComplianceGateService } from '../services/brand-compliance-gate.service';

describe('preparation HTTP boundary with isolated session fixture', () => {
  let app: INestApplication;
  const hub = {
    preparePublication: jest.fn().mockResolvedValue({ request_id: 'fixture' }),
    getPublicationPreparations: jest.fn().mockResolvedValue([]),
    getPublicationPreparation: jest.fn(),
    getPostById: jest.fn(),
  };
  const body = {
    request_id: 'a2856df0-3baa-4a65-a87d-c6f83af9de21',
    channel: 'facebook',
    content_revision: 2,
    review_version: 3,
    account: { external_id: 'test', label: 'Test' },
    media: [],
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketingSocialPostsController],
      providers: [
        PublishQueueService,
        { provide: MarketingHubDataService, useValue: hub },
        { provide: UTMBuilderService, useValue: {} },
        { provide: BrandComplianceGateService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      if (req.headers['x-test-session'] === 'admin')
        req.user = { id: 'admin-42', isAdmin: true };
      if (req.headers['x-test-session'] === 'customer')
        req.user = { id: 'customer', level: 1 };
      next();
    });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it('exports an explicitly selected preparation through the protected existing controller', async () => {
    const post = {
      id: 7,
      content_revision: 2,
      review_version: 3,
      status: 'approved',
      week_iso: '2026-W42',
      day_of_week: 1,
      source_url: null,
      utm_campaign: 'freinage',
      utm_content: null,
      channels_list: ['facebook'],
      channels: {
        facebook: {
          caption: 'Texte approuvé',
          hashtags: [],
          format: 'post',
          link_preview: true,
        },
      },
      channel_reviews: {
        facebook: {
          state: 'approved',
          content_revision: 2,
          actor: 'reviewer',
          decided_at: '2026-10-14T10:00:00Z',
        },
      },
    };
    hub.getPostById.mockResolvedValue(post);
    hub.getPublicationPreparation.mockResolvedValue({
      ...body,
      post_id: 7,
      actor: 'admin-42',
      created_at: '2026-10-14T10:01:00Z',
      editorial_snapshot: {
        week_iso: post.week_iso,
        day_of_week: post.day_of_week,
        source_url: post.source_url,
        utm_campaign: post.utm_campaign,
        utm_content: post.utm_content,
        channels_list: post.channels_list,
        channels: post.channels,
      },
      approval_snapshot: post.channel_reviews.facebook,
    });
    const response = await request(app.getHttpServer())
      .get(
        `/api/admin/marketing/social/posts/7/preparations/${body.request_id}/export`,
      )
      .set('x-test-session', 'admin')
      .expect(200);
    expect(response.body.purpose).toBe('bound_publication_preparation');
    expect(response.body.preparation.account).toEqual(body.account);
    expect(response.body.publication.ready).toBe(false);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-disposition']).toContain(body.request_id);
  });
  it.each(['anonymous', 'customer'])(
    'blocks %s for writes and history',
    async (identity) => {
      await request(app.getHttpServer())
        .post('/api/admin/marketing/social/posts/7/preparations')
        .set('x-test-session', identity)
        .send(body)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/admin/marketing/social/posts/7/preparations')
        .set('x-test-session', identity)
        .expect(403);
      expect(hub.preparePublication).not.toHaveBeenCalled();
      expect(hub.getPublicationPreparations).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .get(
          `/api/admin/marketing/social/posts/7/preparations/${body.request_id}/export`,
        )
        .set('x-test-session', identity)
        .expect(403);
      expect(hub.getPublicationPreparation).not.toHaveBeenCalled();
    },
  );
  it('binds server identity and reports publication blocked', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/marketing/social/posts/7/preparations')
      .set('x-test-session', 'admin')
      .send(body)
      .expect(201);
    expect(hub.preparePublication).toHaveBeenCalledWith(7, body, 'admin-42');
    expect(response.body.publication.ready).toBe(false);
  });
  it('rejects forged approval before storage', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/marketing/social/posts/7/preparations')
      .set('x-test-session', 'admin')
      .send({ ...body, approved_by: 'forged' })
      .expect(400);
    expect(hub.preparePublication).not.toHaveBeenCalled();
  });
  it('rejects malformed export selection before storage', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/marketing/social/posts/7/preparations/not-a-uuid/export')
      .set('x-test-session', 'admin')
      .expect(400);
    expect(hub.getPublicationPreparation).not.toHaveBeenCalled();
  });
  it('rejects unsafe post IDs before storage', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/marketing/social/posts/9007199254740992/preparations')
      .set('x-test-session', 'admin')
      .send(body)
      .expect(400);
    expect(hub.preparePublication).not.toHaveBeenCalled();
  });
  it('labels history as non-publishable', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/marketing/social/posts/7/preparations')
      .set('x-test-session', 'admin')
      .expect(200, {
        purpose: 'preparation_history',
        publication_ready: false,
        data: [],
      });
  });
});
