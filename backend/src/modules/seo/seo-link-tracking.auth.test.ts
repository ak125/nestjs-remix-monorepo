import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SeoLinkTrackingController } from './seo-link-tracking.controller';
import { SeoLinkTrackingService } from './infrastructure/seo-link-tracking.service';

// Exercise the actual HTTP controller and guard, with no Supabase instance.
// Any invocation of a maintenance method is observed before a database boundary.
describe('SEO link maintenance HTTP authorization', () => {
  const key = 'seo-maintenance-fixture-key-not-for-deployment';
  let app: INestApplication;
  const maintenance = {
    aggregateDailyMetrics: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Aggregated' }),
    cleanupOldData: jest.fn().mockResolvedValue({
      success: true,
      deletedClicks: 0,
      deletedImpressions: 0,
    }),
    trackClick: jest.fn().mockResolvedValue(true),
    trackImpression: jest.fn().mockResolvedValue(true),
  };

  async function createApp(internalKey: string) {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [() => ({ INTERNAL_API_KEY: internalKey })],
        }),
      ],
      controllers: [SeoLinkTrackingController],
      providers: [{ provide: SeoLinkTrackingService, useValue: maintenance }],
    }).compile();
    const instance = module.createNestApplication({ logger: false });
    await instance.init();
    return instance;
  }

  beforeAll(async () => {
    app = await createApp(key);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  it.each(['aggregate', 'cleanup'])(
    'rejects an anonymous POST to %s before invoking maintenance',
    async (action) => {
      await request(app.getHttpServer()).post(`/api/seo/${action}`).expect(403);
      expect(maintenance.aggregateDailyMetrics).not.toHaveBeenCalled();
      expect(maintenance.cleanupOldData).not.toHaveBeenCalled();
    },
  );

  it.each(['aggregate', 'cleanup'])(
    'does not trust forged cookies or proxy headers on %s',
    async (action) => {
      await request(app.getHttpServer())
        .post(`/api/seo/${action}`)
        .set('Cookie', 'connect.sid=forged-admin')
        .set('X-Forwarded-For', '127.0.0.1')
        .set('X-Internal-Key', 'invalid')
        .expect(403);
      expect(maintenance.aggregateDailyMetrics).not.toHaveBeenCalled();
      expect(maintenance.cleanupOldData).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the server has no configured key', async () => {
    const unconfigured = await createApp('');
    try {
      await request(unconfigured.getHttpServer())
        .post('/api/seo/cleanup')
        .set('X-Internal-Key', key)
        .expect(403);
      expect(maintenance.cleanupOldData).not.toHaveBeenCalled();
    } finally {
      await unconfigured.close();
    }
  });

  it('accepts the authenticated internal aggregation job', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/seo/aggregate')
      .set('X-Internal-Key', key)
      .expect(201);
    expect(result.body.success).toBe(true);
    expect(maintenance.aggregateDailyMetrics).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['', 90],
    ['?daysToKeep=90', 90],
    ['?daysToKeep=1', 1],
    ['?daysToKeep=365', 365],
  ])('preserves authorized cleanup %s', async (query, days) => {
    await request(app.getHttpServer())
      .post(`/api/seo/cleanup${query}`)
      .set('X-Internal-Key', key)
      .expect(201);
    expect(maintenance.cleanupOldData).toHaveBeenCalledWith(days);
  });

  it.each([
    '0',
    '-1',
    '1.5',
    '90junk',
    '',
    '1e2',
    'Infinity',
    '9007199254740992',
    '999999999',
    '90&daysToKeep=1',
  ])('rejects unsafe retention %s before invoking cleanup', async (days) => {
    await request(app.getHttpServer())
      .post(`/api/seo/cleanup?daysToKeep=${days}`)
      .set('X-Internal-Key', key)
      .expect(400);
    expect(maintenance.cleanupOldData).not.toHaveBeenCalled();
  });

  it('keeps well-formed click and impression beacons public', async () => {
    await request(app.getHttpServer())
      .post('/api/seo/track-click')
      .send({ linkType: 'CrossSelling', sourceUrl: '/a', destinationUrl: '/b' })
      .expect(201, { success: true });
    await request(app.getHttpServer())
      .post('/api/seo/track-impression')
      .send({ linkType: 'CrossSelling', pageUrl: '/a', linkCount: 2 })
      .expect(201, { success: true });
    expect(maintenance.trackClick).toHaveBeenCalledTimes(1);
    expect(maintenance.trackImpression).toHaveBeenCalledTimes(1);
  });
});
