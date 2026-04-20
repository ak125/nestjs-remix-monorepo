/**
 * ErrorLogService hardening tests
 *
 * Guards the runtime contract that stops the ___xtr_msg insert firehose:
 *   1. Batch flush — many logError() calls produce a single insert(rows[])
 *   2. Dedup — identical signature within DEDUP_TTL_MS is dropped
 *   3. Bot filter — 4xx from bot UA is never buffered
 *   4. Circuit breaker — 3 consecutive flush failures → silent drop window
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabaseMock: { from: jest.Mock; insertMock: jest.Mock } = {
  from: jest.fn(),
  insertMock: jest.fn(),
};

jest.mock('../../src/database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected readonly supabase: any = {
      from: (...args: unknown[]) => supabaseMock.from(...args),
    };
    protected readonly client: any = this.supabase;
    protected readonly logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    constructor(..._args: unknown[]) {}
  },
}));

jest.mock('@repo/database-types', () => ({
  TABLES: { xtr_msg: '___xtr_msg' },
}));

import { ErrorLogService } from '../../src/modules/errors/services/error-log.service';

function freshService(): ErrorLogService {
  supabaseMock.insertMock = jest.fn().mockResolvedValue({ error: null });
  supabaseMock.from = jest
    .fn()
    .mockReturnValue({ insert: supabaseMock.insertMock });
  return new ErrorLogService({} as any);
}

describe('ErrorLogService — batch flush', () => {
  it('collapses many logError() calls into a single insert with array of rows', async () => {
    const svc = freshService();
    for (let i = 0; i < 25; i++) {
      await svc.logError({ code: 500, url: `/api/resource/${i}` });
    }
    await (svc as any).flush();
    expect(supabaseMock.insertMock).toHaveBeenCalledTimes(1);
    const rows = supabaseMock.insertMock.mock.calls[0][0];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(25);
    expect(rows[0].msg_subject).toBe('ERROR_500');
  });
});

describe('ErrorLogService — dedup', () => {
  it('drops duplicate signatures within the dedup window', async () => {
    const svc = freshService();
    for (let i = 0; i < 100; i++) {
      await svc.logError({
        code: 500,
        url: '/api/same-route',
        ipAddress: '1.2.3.4',
      });
    }
    await (svc as any).flush();
    expect(supabaseMock.insertMock).toHaveBeenCalledTimes(1);
    const rows = supabaseMock.insertMock.mock.calls[0][0];
    expect(rows).toHaveLength(1);
  });

  it('does not dedup when URL or ip differs', async () => {
    const svc = freshService();
    await svc.logError({ code: 500, url: '/a', ipAddress: '1.1.1.1' });
    await svc.logError({ code: 500, url: '/b', ipAddress: '1.1.1.1' });
    await svc.logError({ code: 500, url: '/a', ipAddress: '2.2.2.2' });
    await (svc as any).flush();
    const rows = supabaseMock.insertMock.mock.calls[0][0];
    expect(rows).toHaveLength(3);
  });
});

describe('ErrorLogService — bot filter', () => {
  const bots = [
    'Googlebot-Image/1.0',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
    'imgproxy/3.30.1',
  ];

  it.each(bots)('skips 4xx from bot UA: %s', async (ua) => {
    const svc = freshService();
    await svc.logError({ code: 404, url: '/any', userAgent: ua });
    await (svc as any).flush();
    expect(supabaseMock.insertMock).not.toHaveBeenCalled();
  });

  it('keeps 5xx from bot UA (real server fault)', async () => {
    const svc = freshService();
    await svc.logError({
      code: 500,
      url: '/api/fail',
      userAgent: 'Googlebot/2.1',
    });
    await (svc as any).flush();
    expect(supabaseMock.insertMock).toHaveBeenCalledTimes(1);
  });

  it('keeps 4xx from human UA', async () => {
    const svc = freshService();
    await svc.logError({
      code: 404,
      url: '/page',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
    });
    await (svc as any).flush();
    expect(supabaseMock.insertMock).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorLogService — circuit breaker', () => {
  it('opens the breaker after 3 consecutive flush failures', async () => {
    const svc = freshService();
    supabaseMock.insertMock.mockResolvedValue({
      error: { message: 'timeout' },
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      await svc.logError({
        code: 500,
        url: `/fail/${attempt}`,
      });
      await (svc as any).flush();
    }

    expect((svc as any).silentUntilMs).toBeGreaterThan(Date.now());

    const insertCallsBefore = supabaseMock.insertMock.mock.calls.length;
    await svc.logError({ code: 500, url: '/while-silent' });
    await (svc as any).flush();
    expect(supabaseMock.insertMock.mock.calls.length).toBe(insertCallsBefore);
  });
});
