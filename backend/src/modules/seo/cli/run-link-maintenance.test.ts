import { runLinkMaintenance } from './run-link-maintenance';

describe('SEO link maintenance cron client', () => {
  const key = 'cron-fixture-key-not-for-deployment';
  let fetcher: jest.MockedFunction<typeof fetch>;
  beforeEach(() => {
    fetcher = jest.fn();
  });

  it.each([
    ['aggregate', 'http://backend:3000/api/seo/aggregate'],
    ['cleanup', 'http://backend:3000/api/seo/cleanup?daysToKeep=90'],
  ])(
    'authenticates the %s job against the backend service',
    async (action, url) => {
      fetcher.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 201 }),
      );
      await runLinkMaintenance(action, key, fetcher, 'http://backend:3000');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          method: 'POST',
          headers: { 'X-Internal-Key': key },
          redirect: 'error',
          signal: expect.any(AbortSignal),
        }),
      );
    },
  );

  it.each(['', '   '])(
    'does not send an unauthenticated job when the key is absent (%j)',
    async (missing) => {
      await expect(
        runLinkMaintenance('cleanup', missing, fetcher, 'http://backend:3000'),
      ).rejects.toThrow('INTERNAL_API_KEY');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 'unknown', 'cleanup?daysToKeep=-1'])(
    'rejects unrecognized action %s before sending a request',
    async (action) => {
      await expect(
        runLinkMaintenance(action, key, fetcher, 'http://backend:3000'),
      ).rejects.toThrow('aggregate|cleanup');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([403, 429, 503])(
    'reports HTTP %s as a failed job without retrying a mutation',
    async (status) => {
      fetcher.mockResolvedValue(new Response('', { status }));
      await expect(
        runLinkMaintenance('aggregate', key, fetcher, 'http://backend:3000'),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each([{ success: false }, { success: 'true' }, {}, null])(
    'rejects a misleading HTTP 200 result %j',
    async (body) => {
      fetcher.mockResolvedValue(new Response(JSON.stringify(body)));
      await expect(
        runLinkMaintenance('cleanup', key, fetcher, 'http://backend:3000'),
      ).rejects.toThrow('unsuccessful');
    },
  );

  it('propagates a transport failure without retrying a mutation', async () => {
    fetcher.mockRejectedValue(new Error('connection refused'));
    await expect(
      runLinkMaintenance('aggregate', key, fetcher, 'http://backend:3000'),
    ).rejects.toThrow('connection refused');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    '',
    'file:///tmp/api',
    'https://example.test/path',
    'https://example.test?token=secret',
  ])(
    'rejects invalid API origin %j before exposing the key',
    async (origin) => {
      await expect(
        runLinkMaintenance('aggregate', key, fetcher, origin),
      ).rejects.toThrow('SEO_MAINTENANCE_API_URL');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each(['username', 'password'] as const)(
    'rejects an API origin with a %s before exposing the key',
    async (field) => {
      const origin = new URL('https://example.test');
      origin[field] = 'fixture';
      await expect(
        runLinkMaintenance('aggregate', key, fetcher, origin.href),
      ).rejects.toThrow('SEO_MAINTENANCE_API_URL');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('uses the configured internal origin for another deployment topology', async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await runLinkMaintenance(
      'aggregate',
      key,
      fetcher,
      'http://monorepo_prod:3000',
    );
    expect(fetcher).toHaveBeenCalledWith(
      'http://monorepo_prod:3000/api/seo/aggregate',
      expect.any(Object),
    );
  });
});
