/**
 * Regression test for SeoControlRefreshProcessor READ_ONLY guard.
 *
 * Guards a PREPROD crash-loop: without the guard, the scheduled SWR refresh job
 * calls SeoControlService.refreshBlock() → rpc_seo_alerts_v1, which reads
 * RLS-protected tables (e.g. __seo_audit_findings) the anon role cannot access
 * in READ_ONLY mode (ADR-028 Option D). The job failed, retried in a storm, and
 * the rejection crashed the process (exit 1) ~5 min after every boot — a
 * restart-loop that intermittently broke the E2E Smoke gate (container
 * unreachable on :3200). The fix skips the job in READ_ONLY, like the sibling
 * collectors (cf-analytics / cf-rum / runtime-logs / synthetic-crawler).
 */
import { getAppConfig } from '../../../config/app.config';
import { SeoControlRefreshProcessor } from './seo-control-refresh.processor';
import type { SeoControlService } from '../services/seo-control.service';
import type { SeoControlRefreshJobData } from '../services/seo-control-refresher.service';
import type { Job } from 'bull';

jest.mock('../../../config/app.config');

const mockedGetAppConfig = getAppConfig as jest.MockedFunction<
  typeof getAppConfig
>;

function makeJob(): Job<SeoControlRefreshJobData> {
  return {
    id: 'job-1',
    data: { block: 'alerts', range: '7d' },
  } as unknown as Job<SeoControlRefreshJobData>;
}

function makeService(): { refreshBlock: jest.Mock } {
  return { refreshBlock: jest.fn().mockResolvedValue(undefined) };
}

describe('SeoControlRefreshProcessor — READ_ONLY guard', () => {
  afterEach(() => jest.clearAllMocks());

  it('skips refreshBlock in READ_ONLY (PREPROD anon) — prevents the RLS crash-loop', async () => {
    mockedGetAppConfig.mockReturnValue({
      supabase: { readOnly: true },
    } as ReturnType<typeof getAppConfig>);
    const svc = makeService();
    const proc = new SeoControlRefreshProcessor(
      svc as unknown as SeoControlService,
    );

    await expect(proc.handleRefresh(makeJob())).resolves.toBeUndefined();
    expect(svc.refreshBlock).not.toHaveBeenCalled();
  });

  it('runs refreshBlock when not READ_ONLY (PROD / service_role)', async () => {
    mockedGetAppConfig.mockReturnValue({
      supabase: { readOnly: false },
    } as ReturnType<typeof getAppConfig>);
    const svc = makeService();
    const proc = new SeoControlRefreshProcessor(
      svc as unknown as SeoControlService,
    );

    await proc.handleRefresh(makeJob());
    expect(svc.refreshBlock).toHaveBeenCalledWith('alerts', '7d');
  });
});
