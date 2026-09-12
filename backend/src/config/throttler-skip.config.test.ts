import {
  Controller,
  type ExecutionContext,
  Get,
  type INestApplication,
  Post,
  Req,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { type Request } from 'express';
import request from 'supertest';
import { CloudflareThrottlerGuard } from '../common/guards/cloudflare-throttler.guard';
import { shouldSkipThrottling } from './throttler-skip.config';
import { THROTTLER_TIERS } from './throttler-tiers.config';

function skipFor(overrides: Record<string, unknown>): boolean {
  const req = {
    headers: {},
    socket: { remoteAddress: '172.18.0.2' },
    method: 'GET',
    path: '/api/example',
    ...overrides,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as ExecutionContext;
  return shouldSkipThrottling(context);
}

describe('shouldSkipThrottling — transport boundary', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])(
    'preserves direct SSR calls from %s',
    (remoteAddress) => {
      expect(skipFor({ socket: { remoteAddress } })).toBe(true);
    },
  );

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '172.17.0.1', '172.31.1.2'])(
    'does not exempt a proxy request whose Express IP is %s',
    (ip) => {
      expect(skipFor({ ip, headers: { 'x-forwarded-for': ip } })).toBe(false);
    },
  );

  it.each([
    '172.17.0.1',
    '172.18.0.2',
    '172.31.1.2',
    '::ffff:172.17.0.1',
    '203.0.113.1',
  ])(
    'does not exempt TCP peer %s even without forwarding headers',
    (remoteAddress) => {
      expect(skipFor({ socket: { remoteAddress } })).toBe(false);
    },
  );

  it.each(['forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'])(
    'does not exempt loopback carrying %s, including an empty value',
    (header) => {
      for (const value of ['127.0.0.1', '', ['127.0.0.1']]) {
        expect(
          skipFor({
            socket: { remoteAddress: '127.0.0.1' },
            headers: { [header]: value },
          }),
        ).toBe(false);
      }
    },
  );

  it('does not infer a peer from Express IP or legacy connection fallback', () => {
    expect(
      skipFor({
        socket: undefined,
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
      }),
    ).toBe(false);
  });

  it('preserves verified bots and authenticated administrators', () => {
    expect(skipFor({ isVerifiedBot: true })).toBe(true);
    expect(skipFor({ user: { isAdmin: true } })).toBe(true);
    expect(skipFor({ user: { level: '7' } })).toBe(true);
    expect(skipFor({ user: { level: 8 } })).toBe(true);
    expect(skipFor({ user: { level: '6' } })).toBe(false);
    expect(
      skipFor({
        headers: { 'x-is-admin': 'true', 'x-is-verified-bot': 'true' },
      }),
    ).toBe(false);
  });

  it('preserves the synthetic probe exemption only on public catalogue GETs', () => {
    expect(
      skipFor({
        isVerifiedSyntheticProbe: true,
        path: '/pieces/filtre-a-air-8.html',
      }),
    ).toBe(true);
    for (const path of [
      '/api/payments/paybox/callback',
      '/auth/login',
      '/cart',
      '/checkout',
      '/admin',
    ]) {
      expect(skipFor({ isVerifiedSyntheticProbe: true, path })).toBe(false);
    }
    expect(
      skipFor({
        isVerifiedSyntheticProbe: true,
        method: 'POST',
        path: '/pieces/filtre-a-air-8.html',
      }),
    ).toBe(false);
  });
});

/** Inert handlers: exercise the real guard without any gateway or database. */
@Controller()
class ProbeController {
  @Get('probe')
  probe(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }

  // Keep the actual payment tier (30/min). Lift only the independent 15/s burst
  // tier in this fixture so 31 local requests can test that minute budget quickly.
  @Throttle({
    short: { limit: 1000, ttl: 1000 },
    payment_callback: { limit: 30, ttl: 60000 },
  })
  @Post('callback-probe')
  callback(): { ok: true } {
    return { ok: true };
  }
}

describe('throttler exemptions — real Nest HTTP requests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: THROTTLER_TIERS,
          skipIf: shouldSkipThrottling,
        }),
      ],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: CloudflareThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps genuine loopback SSR exempt', async () => {
    const res = await request(app.getHttpServer()).get('/probe').expect(200);
    expect(res.headers['x-ratelimit-limit-medium']).toBeUndefined();
  });

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '172.17.0.1', '172.31.1.2'])(
    'applies the limiter even when trust proxy resolves req.ip to %s',
    async (ip) => {
      const res = await request(app.getHttpServer())
        .get('/probe')
        .set('X-Forwarded-For', ip)
        .set('CF-Connecting-IP', '203.0.113.50')
        .expect(200);
      expect(res.body.ip).toBe(ip); // Counter-proof of the old exemption input.
      expect(res.headers['x-ratelimit-limit-medium']).toBe('100');
    },
  );

  it('returns 429 on callback request 31 despite changing forged private IPs', async () => {
    for (let i = 1; i <= 31; i++) {
      const res = await request(app.getHttpServer())
        .post('/callback-probe')
        .set('CF-Connecting-IP', '203.0.113.60')
        .set('X-Forwarded-For', `172.17.0.${i}`)
        .expect(i <= 30 ? 201 : 429);
      if (i <= 30) {
        expect(res.headers['x-ratelimit-limit-payment_callback']).toBe('30');
        expect(
          Number(res.headers['x-ratelimit-remaining-payment_callback']),
        ).toBe(30 - i);
      }
    }
  });
});
