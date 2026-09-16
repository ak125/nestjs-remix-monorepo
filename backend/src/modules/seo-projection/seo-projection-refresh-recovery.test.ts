import type { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { SeoProjectionRefreshProcessor } from './seo-projection-refresh.processor';
import { SeoProjectionWriteProcessor } from './seo-projection-write.processor';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import {
  PROJECTION_REFRESH_JOB,
  REFRESH_DEBOUNCE_MS,
  type ProjectionRunResult,
  type ProjectionRefreshJobData,
  type ProjectionWriteJobData,
} from './seo-projection.types';

function pendingLookup(
  data: unknown,
  error: { message: string } | null = null,
  readOnly = false,
) {
  const limit = jest.fn().mockResolvedValue({ data, error });
  const is = jest.fn().mockReturnValue({ limit });
  const inFilter = jest.fn().mockReturnValue({ is });
  const select = jest.fn().mockReturnValue({ in: inFilter });
  const from = jest.fn().mockReturnValue({ select });
  const writer = Object.assign(
    Object.create(SeoProjectionWriterService.prototype),
    {
      supabase: { from },
      readOnly,
    },
  ) as SeoProjectionWriterService;
  return { writer, from, select, inFilter, is, limit };
}

const job = {
  data: { exportPaths: [], triggeredBy: 'test' },
} as Job<ProjectionWriteJobData>;
function recovery(
  pending: boolean,
  changes: Partial<ProjectionRunResult> = {},
) {
  const result: ProjectionRunResult = {
    runId: null,
    triggeredBy: 'test',
    entitiesWritten: 0,
    rolesWritten: 0,
    rolesNoop: 0,
    rolesBlocked: 0,
    rolesRegressed: 0,
    outcomes: [],
    refreshEnqueued: false,
    readOnlySkipped: false,
    ...changes,
  };
  const hasPendingProjectionRefresh = jest.fn().mockResolvedValue(pending);
  const projectExports = jest.fn().mockResolvedValue(result);
  const add = jest
    .fn()
    .mockResolvedValue({ id: 'projection-refresh-singleton' });
  const processor = new SeoProjectionWriteProcessor(
    {
      projectExports,
      hasPendingProjectionRefresh,
    } as unknown as SeoProjectionWriterService,
    { add } as unknown as Queue,
  );
  return { processor, result, add, hasPendingProjectionRefresh };
}

describe('projection refresh recovery through the existing writer', () => {
  it.each([
    [[], false],
    [[{ rce_id: 42 }], true],
  ])('detects pending transitions (%j)', async (rows, expected) => {
    const f = pendingLookup(rows);
    await expect(f.writer.hasPendingProjectionRefresh()).resolves.toBe(
      expected,
    );
    expect(f.from).toHaveBeenCalledWith('__rag_change_events');
    expect(f.select).toHaveBeenCalledWith('rce_id');
    expect(f.inFilter).toHaveBeenCalledWith('rce_operation', [
      'replace',
      'withdraw',
    ]);
    expect(f.is).toHaveBeenCalledWith('rce_projection_refreshed_at', null);
    expect(f.limit).toHaveBeenCalledWith(1);
  });

  it('propagates database errors and refuses an absent result', async () => {
    await expect(
      pendingLookup(null, {
        message: 'database unavailable',
      }).writer.hasPendingProjectionRefresh(),
    ).rejects.toThrow('database unavailable');
    await expect(
      pendingLookup(null).writer.hasPendingProjectionRefresh(),
    ).rejects.toThrow('no row set');
  });

  it('READ_ONLY never queries pending work', async () => {
    const f = pendingLookup(null, null, true);
    await expect(f.writer.hasPendingProjectionRefresh()).resolves.toBe(false);
    expect(f.from).not.toHaveBeenCalled();
  });

  it('a no-op writer run requests the native singleton for pending work', async () => {
    const f = recovery(true);
    await expect(f.processor.handle(job)).resolves.toMatchObject({
      refreshEnqueued: true,
    });
    expect(f.add).toHaveBeenCalledWith(
      PROJECTION_REFRESH_JOB,
      { triggeredBy: 'test', runId: null },
      {
        jobId: 'projection-refresh-singleton',
        delay: REFRESH_DEBOUNCE_MS,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  });

  it('an acknowledged backlog causes no enqueue', async () => {
    const f = recovery(false);
    await expect(f.processor.handle(job)).resolves.toMatchObject({
      refreshEnqueued: false,
    });
    expect(f.add).not.toHaveBeenCalled();
  });

  it('a confirmed active write enqueues without relying on backlog lookup', async () => {
    const f = recovery(false, { entitiesWritten: 1 });
    await expect(f.processor.handle(job)).resolves.toMatchObject({
      refreshEnqueued: true,
    });
    expect(f.hasPendingProjectionRefresh).not.toHaveBeenCalled();
  });

  it('READ_ONLY skips both recovery lookup and enqueue', async () => {
    const f = recovery(true, { readOnlySkipped: true });
    await expect(f.processor.handle(job)).resolves.toMatchObject({
      refreshEnqueued: false,
    });
    expect(f.hasPendingProjectionRefresh).not.toHaveBeenCalled();
    expect(f.add).not.toHaveBeenCalled();
  });

  it('failed lookup and failed enqueue fail the worker instead of reporting success', async () => {
    const lookup = recovery(false);
    lookup.hasPendingProjectionRefresh.mockRejectedValue(
      new Error('lookup unavailable'),
    );
    await expect(lookup.processor.handle(job)).rejects.toThrow(
      'lookup unavailable',
    );
    expect(lookup.add).not.toHaveBeenCalled();
    const enqueue = recovery(true);
    enqueue.add.mockRejectedValue(new Error('queue unavailable'));
    await expect(enqueue.processor.handle(job)).rejects.toThrow(
      'queue unavailable',
    );
    expect(enqueue.result.refreshEnqueued).toBe(false);
  });
});

describe('refresh lifecycle recovery', () => {
  const completedJob = {
    name: PROJECTION_REFRESH_JOB,
    data: { triggeredBy: 'test', runId: 'origin-run' },
  } as Job<ProjectionRefreshJobData>;

  function lifecycle(pending: boolean) {
    const hasPendingProjectionRefresh = jest.fn().mockResolvedValue(pending);
    const add = jest
      .fn()
      .mockResolvedValue({ id: 'projection-refresh-singleton' });
    const processor = new SeoProjectionRefreshProcessor(
      { hasPendingProjectionRefresh } as unknown as SeoProjectionWriterService,
      { add } as unknown as Queue,
    );
    return { processor, add, hasPendingProjectionRefresh };
  }

  it('checks pending work after successful completion and preserves trace metadata', async () => {
    const f = lifecycle(true);
    await f.processor.onCompleted(completedJob, { refreshed: true });
    expect(f.add).toHaveBeenCalledWith(
      PROJECTION_REFRESH_JOB,
      completedJob.data,
      {
        jobId: 'projection-refresh-singleton',
        delay: REFRESH_DEBOUNCE_MS,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  });

  it('does not restart a readonly skip, failed refresh or unrelated job', async () => {
    const f = lifecycle(true);
    await f.processor.onCompleted(completedJob, {
      refreshed: false,
      error: 'READ_ONLY',
    });
    await f.processor.onCompleted(completedJob, {
      refreshed: false,
      error: 'RPC unavailable',
    });
    await f.processor.onCompleted(
      { ...completedJob, name: 'other' } as Job<ProjectionRefreshJobData>,
      { refreshed: true },
    );
    expect(f.hasPendingProjectionRefresh).not.toHaveBeenCalled();
    expect(f.add).not.toHaveBeenCalled();
  });

  it('does not schedule an acknowledged backlog', async () => {
    const f = lifecycle(false);
    await f.processor.onCompleted(completedJob, { refreshed: true });
    expect(f.add).not.toHaveBeenCalled();
  });

  it('startup is non-blocking and reuses the native replay trigger', async () => {
    const f = lifecycle(true);
    let resolvePending!: (value: boolean) => void;
    f.hasPendingProjectionRefresh.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolvePending = resolve;
      }),
    );
    expect(f.processor.onModuleInit()).toBeUndefined();
    expect(f.add).not.toHaveBeenCalled();
    resolvePending(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.add).toHaveBeenCalledWith(
      PROJECTION_REFRESH_JOB,
      { triggeredBy: 'replay', runId: undefined },
      expect.objectContaining({ jobId: 'projection-refresh-singleton' }),
    );
  });

  it('hook lookup and enqueue errors are observable, without an unhandled rejection', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      const lookup = lifecycle(false);
      lookup.hasPendingProjectionRefresh.mockRejectedValue(
        new Error('DB unavailable'),
      );
      await expect(
        lookup.processor.onCompleted(completedJob, { refreshed: true }),
      ).resolves.toBeUndefined();
      expect(lookup.add).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('outbox remains pending: DB unavailable'),
      );
      const enqueue = lifecycle(true);
      enqueue.add.mockRejectedValue(new Error('Redis unavailable'));
      enqueue.processor.onModuleInit();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          'projection recovery (startup) failed; outbox remains pending: Redis unavailable',
        ),
      );
    } finally {
      error.mockRestore();
    }
  });
  it('startup respects the real writer READ_ONLY guard without DB or queue access', async () => {
    const f = pendingLookup(null, null, true);
    const add = jest.fn();
    const processor = new SeoProjectionRefreshProcessor(f.writer, {
      add,
    } as unknown as Queue);
    processor.onModuleInit();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.from).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
