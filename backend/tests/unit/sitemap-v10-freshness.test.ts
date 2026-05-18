/**
 * Regression test : SitemapV10FreshnessService.getFreshness()
 *
 * Pins the contract used by the CI freshness check
 * (scripts/ci/check-sitemap-freshness.sh + .github/workflows/sitemap-freshness-slo.yml).
 *
 * Covers:
 *   - File present, fresh → isHealthy=true
 *   - File present, stale (> threshold) → isHealthy=false, reason set
 *   - File missing → isHealthy=false, reason set
 *   - Scheduler registered detected via BullMQ getRepeatableJobs
 *   - Scheduler not registered when queue absent or job missing
 */

import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SitemapV10FreshnessService } from '../../src/modules/seo/services/sitemap-v10-freshness.service';
import { SITEMAP_REGENERATE_JOB_NAME } from '../../src/modules/seo/services/sitemap-v10-scheduler.service';

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

function makeQueue(jobs: Array<{ name: string; key: string }> | Error): Queue {
  return {
    getRepeatableJobs: jest.fn(
      jobs instanceof Error
        ? () => Promise.reject(jobs)
        : () => Promise.resolve(jobs as Awaited<ReturnType<Queue['getRepeatableJobs']>>),
    ),
  } as unknown as Queue;
}

const FRESH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-pieces-1.xml</loc>
    <lastmod>2026-05-14</lastmod>
  </sitemap>
</sitemapindex>`;

async function writeSitemap(dir: string, content: string, ageHours: number): Promise<void> {
  const filePath = path.join(dir, 'sitemap.xml');
  await fs.writeFile(filePath, content, 'utf8');
  const mtime = new Date(Date.now() - ageHours * 3_600_000);
  await fs.utimes(filePath, mtime, mtime);
}

describe('SitemapV10FreshnessService', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sitemap-freshness-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports isHealthy=true when sitemap is fresh and scheduler registered', async () => {
    await writeSitemap(tmpDir, FRESH_XML, 1); // 1h old
    const service = new SitemapV10FreshnessService(
      makeConfig({ SITEMAP_OUTPUT_DIR: tmpDir }),
      makeQueue([{ name: SITEMAP_REGENERATE_JOB_NAME, key: 'k1' }]),
    );

    const report = await service.getFreshness();

    expect(report.isHealthy).toBe(true);
    expect(report.staleHours).toBeLessThan(2);
    expect(report.fileLastModifiedAt).not.toBeNull();
    expect(report.indexLastmod).toBe('2026-05-14');
    expect(report.schedulerRegistered).toBe(true);
    expect(report.warnThresholdHours).toBe(36);
    expect(report.reason).toBeUndefined();
  });

  it('reports isHealthy=false when sitemap is older than threshold', async () => {
    await writeSitemap(tmpDir, FRESH_XML, 50); // 50h old, default threshold 36h
    const service = new SitemapV10FreshnessService(
      makeConfig({ SITEMAP_OUTPUT_DIR: tmpDir }),
      makeQueue([{ name: SITEMAP_REGENERATE_JOB_NAME, key: 'k1' }]),
    );

    const report = await service.getFreshness();

    expect(report.isHealthy).toBe(false);
    expect(report.staleHours).toBeGreaterThan(36);
    expect(report.reason).toMatch(/staleHours/);
  });

  it('honors SEO_SITEMAP_FRESHNESS_WARN_HOURS env override', async () => {
    await writeSitemap(tmpDir, FRESH_XML, 10); // 10h old
    const service = new SitemapV10FreshnessService(
      makeConfig({
        SITEMAP_OUTPUT_DIR: tmpDir,
        SEO_SITEMAP_FRESHNESS_WARN_HOURS: '6',
      }),
      makeQueue([{ name: SITEMAP_REGENERATE_JOB_NAME, key: 'k1' }]),
    );

    const report = await service.getFreshness();

    expect(report.warnThresholdHours).toBe(6);
    expect(report.isHealthy).toBe(false);
    expect(report.reason).toMatch(/staleHours/);
  });

  it('reports isHealthy=false when sitemap.xml is missing', async () => {
    const service = new SitemapV10FreshnessService(
      makeConfig({ SITEMAP_OUTPUT_DIR: tmpDir }),
      makeQueue([{ name: SITEMAP_REGENERATE_JOB_NAME, key: 'k1' }]),
    );

    const report = await service.getFreshness();

    expect(report.isHealthy).toBe(false);
    expect(report.staleHours).toBeNull();
    expect(report.fileLastModifiedAt).toBeNull();
    expect(report.indexLastmod).toBeNull();
    expect(report.reason).toMatch(/unreadable|missing/);
  });

  it('reports schedulerRegistered=false when job not in repeatable list', async () => {
    await writeSitemap(tmpDir, FRESH_XML, 1);
    const service = new SitemapV10FreshnessService(
      makeConfig({ SITEMAP_OUTPUT_DIR: tmpDir }),
      makeQueue([{ name: 'other-job', key: 'k1' }]),
    );

    const report = await service.getFreshness();

    expect(report.schedulerRegistered).toBe(false);
    // The fs healthiness is independent of the scheduler check
    expect(report.isHealthy).toBe(true);
  });

  it('does not throw when BullMQ getRepeatableJobs fails (defensive)', async () => {
    await writeSitemap(tmpDir, FRESH_XML, 1);
    const service = new SitemapV10FreshnessService(
      makeConfig({ SITEMAP_OUTPUT_DIR: tmpDir }),
      makeQueue(new Error('redis down')),
    );

    const report = await service.getFreshness();

    expect(report.schedulerRegistered).toBe(false);
    expect(report.isHealthy).toBe(true);
  });

  it('reports schedulerRegistered=false when queue is null (optional injection)', async () => {
    await writeSitemap(tmpDir, FRESH_XML, 1);
    const service = new SitemapV10FreshnessService(
      makeConfig({ SITEMAP_OUTPUT_DIR: tmpDir }),
      null,
    );

    const report = await service.getFreshness();

    expect(report.schedulerRegistered).toBe(false);
  });
});
