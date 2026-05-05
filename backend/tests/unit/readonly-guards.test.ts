/**
 * ADR-028 Option D — 8e classe : READ_ONLY guards (PR-A)
 *
 * Tests minimum vital pour le helper `guardReadOnly()` sur SupabaseBaseService
 * et son usage dans 5 services bloqués par RLS service_role-only en preprod
 * read-only.
 *
 * Pattern : env `READ_ONLY=true` + mock `this.supabase` via spy throwing →
 * assert pas appelé. Si le spy est touché, la garde n'a pas court-circuité.
 *
 * Couvre :
 *   1. SupabaseBaseService.guardReadOnly()
 *   2. SeoMonitorProcessor.handleMonitoring (skipped)
 *   3. ShippingCalculatorService.loadAllZoneTiers (env fallback distinct)
 *   4. AdminJobHealthService.recordSuccess + recordFailure (skipped)
 *   5. RagWebIngestDbService.upsertJob + failOrphanedRunningJobs (skipped)
 *
 * Différé en PR consolidation : seo-audit-scheduler.processJob, intégration
 * BullMQ E2E, regressions services hérités non-modifiés.
 */

import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../src/database/services/supabase-base.service';
import { ShippingCalculatorService } from '../../src/modules/cart/services/shipping-calculator.service';
import { AdminJobHealthService } from '../../src/modules/admin/services/admin-job-health.service';
import { RagWebIngestDbService } from '../../src/modules/rag-proxy/services/rag-web-ingest-db.service';

const ORIGINAL_ENV = process.env;

const setReadOnlyEnv = (readOnly: boolean) => {
  process.env = {
    ...ORIGINAL_ENV,
    SUPABASE_URL: 'https://mock.supabase.co',
    SUPABASE_ANON_KEY: 'mock-anon-key',
    READ_ONLY: readOnly ? 'true' : 'false',
  };
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Reset cached app config singleton between tests
  jest.resetModules();
};

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const mockConfigService = (readOnly: boolean): ConfigService =>
  ({
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        SUPABASE_URL: 'https://mock.supabase.co',
        SUPABASE_ANON_KEY: 'mock-anon-key',
        READ_ONLY: readOnly ? 'true' : 'false',
      };
      return config[key];
    }),
  }) as unknown as ConfigService;

const failingSupabase = () => ({
  from: jest.fn(() => {
    throw new Error('this.supabase.from called — guard failed');
  }),
  rpc: jest.fn(() => {
    throw new Error('this.supabase.rpc called — guard failed');
  }),
});

describe('ADR-028 Option D — READ_ONLY guards (PR-A)', () => {
  describe('1. SupabaseBaseService.guardReadOnly()', () => {
    class TestService extends SupabaseBaseService {
      public callGuard(op: string, ctx?: string): boolean {
        return this.guardReadOnly(op, ctx);
      }
    }

    it('returns true and logs [READ_ONLY] warn when READ_ONLY=true', () => {
      setReadOnlyEnv(true);
      const svc = new TestService(mockConfigService(true));
      const warnSpy = jest
        .spyOn((svc as any).logger, 'warn')
        .mockImplementation();

      const result = svc.callGuard('testOp', 'queue-1');
      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const call = warnSpy.mock.calls[0] as [Record<string, unknown>, string];
      expect(call[0]).toEqual(
        expect.objectContaining({
          metric: 'readonly.skipped',
          operation: 'testOp',
          context: 'queue-1',
        }),
      );
      expect(call[1]).toContain('[READ_ONLY] Skip testOp (queue-1)');
    });

    it('returns false (no log) when READ_ONLY!=true', () => {
      setReadOnlyEnv(true);
      const svc = new TestService(mockConfigService(true));
      // Override post-construct (le singleton appConfig est cache entre tests)
      // — cohérent avec runtime : isReadOnlyMode est lu une fois au constructor.
      (svc as any).isReadOnlyMode = false;
      const warnSpy = jest
        .spyOn((svc as any).logger, 'warn')
        .mockImplementation();

      const result = svc.callGuard('testOp');
      expect(result).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('handles missing context (only operation)', () => {
      setReadOnlyEnv(true);
      const svc = new TestService(mockConfigService(true));
      const warnSpy = jest
        .spyOn((svc as any).logger, 'warn')
        .mockImplementation();

      const result = svc.callGuard('opOnly');
      expect(result).toBe(true);
      const call = warnSpy.mock.calls[0] as [Record<string, unknown>, string];
      expect(call[0].context).toBeNull();
      expect(call[1]).toContain('[READ_ONLY] Skip opOnly');
      expect(call[1]).not.toContain('()');
    });
  });

  describe('2. SeoMonitorProcessor.handleMonitoring — skipped', () => {
    // Import dynamique pour éviter les conflits decorator @nestjs/bull au module load
    let SeoMonitorProcessor: any;

    beforeAll(async () => {
      const mod = await import(
        '../../src/workers/processors/seo-monitor.processor'
      );
      SeoMonitorProcessor = mod.SeoMonitorProcessor;
    });

    it('returns zero-counter MonitoringResult without RPC/DB calls when READ_ONLY=true', async () => {
      setReadOnlyEnv(true);
      const mockRpcGate = {
        evaluate: jest.fn(() => ({ decision: 'ALLOW', reason: 'TEST' })),
        log: jest.fn(),
      };
      const mockJobHealth = {
        recordSuccess: jest.fn(),
        recordFailure: jest.fn(),
      };
      const proc = new SeoMonitorProcessor(
        mockConfigService(true),
        mockRpcGate as any,
        mockJobHealth as any,
      );
      (proc as any).supabase = failingSupabase();
      jest.spyOn((proc as any).logger, 'warn').mockImplementation();

      const fakeJob = {
        id: 'job-42',
        data: { taskType: 'check-critical-urls', triggeredBy: 'scheduler' },
        progress: jest.fn(),
      };
      const result = await proc.handleMonitoring(fakeJob);

      expect(result.totalChecked).toBe(0);
      expect(result.okCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.alerts).toEqual([]);
      expect((proc as any).supabase.from).not.toHaveBeenCalled();
      expect((proc as any).supabase.rpc).not.toHaveBeenCalled();
      expect(fakeJob.progress).not.toHaveBeenCalled();
      expect(mockJobHealth.recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe('3. ShippingCalculatorService.loadAllZoneTiers — env fallback distinct', () => {
    it('uses hardcoded fallback WITHOUT DB call when READ_ONLY=true, logs [READ_ONLY]', async () => {
      setReadOnlyEnv(true);
      const svc = new ShippingCalculatorService();
      (svc as any).supabase = failingSupabase();
      const warnSpy = jest
        .spyOn((svc as any).logger, 'warn')
        .mockImplementation();

      await (svc as any).loadAllZoneTiers();

      expect((svc as any).supabase.from).not.toHaveBeenCalled();
      const messages = warnSpy.mock.calls.map((c) => c[1] ?? c[0]);
      const readOnlyLog = messages.find(
        (m) => typeof m === 'string' && m.includes('[READ_ONLY]'),
      );
      expect(readOnlyLog).toBeDefined();
      expect(readOnlyLog).toContain(
        'Shipping tiers forced to hardcoded fallback',
      );
      // Aucun log [RLS BLOCKED] ne doit fire en mode env fallback
      const rlsLog = messages.find(
        (m) => typeof m === 'string' && m.includes('[RLS BLOCKED]'),
      );
      expect(rlsLog).toBeUndefined();
      // 4 zones doivent avoir le fallback
      expect((svc as any).zoneTiers.size).toBe(4);
    });
  });

  describe('4. AdminJobHealthService — recordSuccess + recordFailure skipped', () => {
    it('recordSuccess does not call supabase when READ_ONLY=true', async () => {
      setReadOnlyEnv(true);
      const svc = new AdminJobHealthService(mockConfigService(true));
      (svc as any).supabase = failingSupabase();
      jest.spyOn((svc as any).logger, 'warn').mockImplementation();

      await expect(
        svc.recordSuccess('test-queue', 100),
      ).resolves.toBeUndefined();
      expect((svc as any).supabase.rpc).not.toHaveBeenCalled();
      expect((svc as any).supabase.from).not.toHaveBeenCalled();
    });

    it('recordFailure does not call supabase when READ_ONLY=true', async () => {
      setReadOnlyEnv(true);
      const svc = new AdminJobHealthService(mockConfigService(true));
      (svc as any).supabase = failingSupabase();
      jest.spyOn((svc as any).logger, 'warn').mockImplementation();

      await expect(
        svc.recordFailure('test-queue', 'err'),
      ).resolves.toBeUndefined();
      expect((svc as any).supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('5. RagWebIngestDbService — upsertJob + failOrphanedRunningJobs skipped', () => {
    const fakeJob = {
      jobId: 'job-1',
      url: 'https://example.com',
      truthLevel: 'verified',
      status: 'done',
      returnCode: 0,
      logLines: [],
      startedAt: 1700000000,
      finishedAt: 1700000100,
    };

    it('upsertJob does not call supabase when READ_ONLY=true', async () => {
      setReadOnlyEnv(true);
      const svc = new RagWebIngestDbService(mockConfigService(true));
      (svc as any).supabase = failingSupabase();
      jest.spyOn((svc as any).logger, 'warn').mockImplementation();

      await expect(svc.upsertJob(fakeJob as any)).resolves.toBeUndefined();
      expect((svc as any).supabase.from).not.toHaveBeenCalled();
    });

    it('failOrphanedRunningJobs returns 0 without DB call when READ_ONLY=true', async () => {
      setReadOnlyEnv(true);
      const svc = new RagWebIngestDbService(mockConfigService(true));
      (svc as any).supabase = failingSupabase();
      jest.spyOn((svc as any).logger, 'warn').mockImplementation();

      const result = await svc.failOrphanedRunningJobs();
      expect(result).toBe(0);
      expect((svc as any).supabase.from).not.toHaveBeenCalled();
    });
  });
});
