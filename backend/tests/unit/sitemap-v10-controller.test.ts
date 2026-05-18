/**
 * Regression test : SitemapV10Controller.generateAll
 *
 * Pin the async-202 contract that fixes the Cloudflare 524 timeout on the
 * daily sitemap regen cron (issue #586). The endpoint MUST enqueue a BullMQ
 * job and return immediately — it MUST NOT call `sitemapService.generateAll()`
 * synchronously (root cause of the >100s response time that tripped CF).
 *
 * Covers :
 *   - `queue.add` invoked with the canonical job name + `triggeredBy: 'api'`
 *   - Deterministic jobId `sitemap-v10-api-YYYY-MM-DD` for same-day dedup
 *   - 202 Accepted shape (handled by `@HttpCode(HttpStatus.ACCEPTED)` decorator;
 *     here we verify the response body shape only — HTTP status is enforced
 *     by Nest at runtime, not in unit tests of the controller method)
 *   - `sitemapService.generateAll()` is NEVER called from this endpoint
 *   - Redis/BullMQ failure surfaces as `ServiceUnavailableException` (HTTP 503)
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bull';
import { SitemapV10Controller } from '../../src/modules/seo/controllers/sitemap-v10.controller';
import { SITEMAP_REGENERATE_JOB_NAME } from '../../src/modules/seo/services/sitemap-v10-scheduler.service';
import { SitemapV10Service } from '../../src/modules/seo/services/sitemap-v10.service';
import { SitemapV10ScoringService } from '../../src/modules/seo/services/sitemap-v10-scoring.service';
import { SitemapV10HubsService } from '../../src/modules/seo/services/sitemap-v10-hubs.service';

type AddedJob = { id: number | string };

function makeQueueMock(addedJobId: number | string = 1234): jest.Mocked<Queue> {
  return {
    add: jest.fn().mockResolvedValue({ id: addedJobId } as AddedJob),
  } as unknown as jest.Mocked<Queue>;
}

function makeSitemapServiceMock(): jest.Mocked<SitemapV10Service> {
  return {
    generateAll: jest.fn(),
  } as unknown as jest.Mocked<SitemapV10Service>;
}

function buildController(overrides?: {
  queue?: jest.Mocked<Queue>;
  sitemapService?: jest.Mocked<SitemapV10Service>;
}): {
  controller: SitemapV10Controller;
  queue: jest.Mocked<Queue>;
  sitemapService: jest.Mocked<SitemapV10Service>;
} {
  const queue = overrides?.queue ?? makeQueueMock();
  const sitemapService = overrides?.sitemapService ?? makeSitemapServiceMock();
  const scoringService = {} as SitemapV10ScoringService;
  const hubsService = {} as SitemapV10HubsService;

  const controller = new SitemapV10Controller(
    sitemapService,
    scoringService,
    hubsService,
    queue,
  );

  return { controller, queue, sitemapService };
}

describe('SitemapV10Controller.generateAll (async-202 contract — fix CF 524)', () => {
  it('enqueues a BullMQ job with triggeredBy="api" and SITEMAP_REGENERATE_JOB_NAME', async () => {
    const { controller, queue } = buildController();

    const response = await controller.generateAll();

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData] = queue.add.mock.calls[0];
    expect(jobName).toBe(SITEMAP_REGENERATE_JOB_NAME);
    expect(jobData).toEqual({ triggeredBy: 'api' });
    expect(response.success).toBe(true);
    expect(response.accepted).toBe(true);
    expect(response.data.triggeredBy).toBe('api');
    expect(response.data.jobName).toBe(SITEMAP_REGENERATE_JOB_NAME);
  });

  it('uses a deterministic jobId scoped to the current UTC date for same-day dedup', async () => {
    const { controller, queue } = buildController();
    const expectedDate = new Date().toISOString().slice(0, 10);

    await controller.generateAll();

    const opts = queue.add.mock.calls[0][2] as { jobId?: string };
    expect(opts.jobId).toBe(`sitemap-v10-api-${expectedDate}`);
  });

  it('configures retry policy (2 attempts, exponential 60s backoff, retention 14d/30f)', async () => {
    const { controller, queue } = buildController();

    await controller.generateAll();

    const opts = queue.add.mock.calls[0][2] as {
      attempts?: number;
      backoff?: { type?: string; delay?: number };
      removeOnComplete?: number;
      removeOnFail?: number;
    };
    expect(opts.attempts).toBe(2);
    expect(opts.backoff?.type).toBe('exponential');
    expect(opts.backoff?.delay).toBe(60_000);
    expect(opts.removeOnComplete).toBe(14);
    expect(opts.removeOnFail).toBe(30);
  });

  it('NEVER calls sitemapService.generateAll() (root cause of CF 524)', async () => {
    const { controller, sitemapService } = buildController();

    await controller.generateAll();

    expect(sitemapService.generateAll).not.toHaveBeenCalled();
  });

  it('returns the BullMQ job id in response data', async () => {
    const { controller } = buildController({ queue: makeQueueMock(987654) });

    const response = await controller.generateAll();

    expect(response.data.jobId).toBe('987654');
  });

  it('falls back to the deterministic jobId when queue returns no id', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({ id: undefined }),
    } as unknown as jest.Mocked<Queue>;
    const { controller } = buildController({ queue });
    const expectedDate = new Date().toISOString().slice(0, 10);

    const response = await controller.generateAll();

    expect(response.data.jobId).toBe(`sitemap-v10-api-${expectedDate}`);
  });

  it('throws ServiceUnavailableException (HTTP 503) when Redis/BullMQ is unavailable', async () => {
    const queue = {
      add: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379')),
    } as unknown as jest.Mocked<Queue>;
    const { controller } = buildController({ queue });

    await expect(controller.generateAll()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
