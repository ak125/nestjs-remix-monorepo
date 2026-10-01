import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';
import {
  DIAGNOSTIC_PROJECTION_JOB,
  DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
} from './diagnostic-projection.types';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const RESIDUAL = {
  name: DIAGNOSTIC_PROJECTION_JOB,
  key: `repeat:${DIAGNOSTIC_PROJECTION_JOB}:x`,
};

function makeScheduler(options: {
  enabled: boolean;
  repeatables?: Array<{ name: string; key: string }>;
  cron?: string;
}) {
  const queue = {
    add: jest.fn().mockResolvedValue({ id: 42 }),
    getRepeatableJobs: jest.fn().mockResolvedValue(options.repeatables ?? []),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'DIAGNOSTIC_PROJECTION_CRON' && options.cron
        ? options.cron
        : fallback,
    ),
  };
  const featureFlags = { diagnosticProjectionEnabled: options.enabled };
  const scheduler = new DiagnosticProjectionSchedulerService(
    queue as unknown as Queue,
    config as unknown as ConfigService,
    featureFlags as unknown as FeatureFlagsService,
  );
  return { scheduler, queue };
}

describe('DiagnosticProjectionSchedulerService', () => {
  it('OFF: returns synchronously, removes a residual repeatable, never registers one', async () => {
    const { scheduler, queue } = makeScheduler({
      enabled: false,
      repeatables: [RESIDUAL, { name: 'un-autre-job', key: 'repeat:autre' }],
    });
    expect(scheduler.onModuleInit()).toBeUndefined();
    await flush();
    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(RESIDUAL.key);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('ON: purges stale repeatables, then registers one with a stable jobId', async () => {
    const { scheduler, queue } = makeScheduler({
      enabled: true,
      repeatables: [RESIDUAL],
    });
    scheduler.onModuleInit();
    await flush();
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(RESIDUAL.key);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      DIAGNOSTIC_PROJECTION_JOB,
      { triggeredBy: 'repeatable' },
      {
        repeat: { cron: '0 2 * * *', tz: 'UTC' },
        jobId: DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
        removeOnComplete: 14,
        removeOnFail: 30,
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
    expect(
      queue.removeRepeatableByKey.mock.invocationCallOrder[0],
    ).toBeLessThan(queue.add.mock.invocationCallOrder[0]);
  });

  it('ON: honours DIAGNOSTIC_PROJECTION_CRON', async () => {
    const { scheduler, queue } = makeScheduler({
      enabled: true,
      cron: '30 4 * * *',
    });
    scheduler.onModuleInit();
    await flush();
    expect(queue.add.mock.calls[0][2].repeat).toEqual({
      cron: '30 4 * * *',
      tz: 'UTC',
    });
  });

  it('triggerNow enqueues a single-attempt admin job and returns its id', async () => {
    const { scheduler, queue } = makeScheduler({ enabled: false });
    await expect(scheduler.triggerNow()).resolves.toBe('42');
    expect(queue.add).toHaveBeenCalledWith(
      DIAGNOSTIC_PROJECTION_JOB,
      { triggeredBy: 'admin' },
      { removeOnComplete: 14, removeOnFail: 30, attempts: 1 },
    );
  });
});
