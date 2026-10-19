import type { Job } from 'bull';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import type { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import { DiagnosticProjectionContractError } from './diagnostic-projection-writer.service';
import { DiagnosticProjectionProcessor } from './diagnostic-projection.processor';

function makeProcessor(enabled: boolean) {
  const writer = {
    run: jest.fn().mockResolvedValue({
      status: 'applied',
      exportedCount: 3,
      run_id: 1,
      projected_count: 0,
      conflict_count: 3,
      retired_count: 0,
    }),
  };
  const processor = new DiagnosticProjectionProcessor(
    writer as unknown as DiagnosticProjectionWriterService,
    { diagnosticProjectionEnabled: enabled } as unknown as FeatureFlagsService,
  );
  return { processor, writer };
}

const job = (data: unknown) =>
  ({ id: 1, data, discard: jest.fn() }) as unknown as Job<unknown>;

describe('DiagnosticProjectionProcessor', () => {
  it('flag ON: delegates to the writer with the job trigger', async () => {
    const { processor, writer } = makeProcessor(true);
    await expect(
      processor.handle(job({ triggeredBy: 'repeatable' })),
    ).resolves.toMatchObject({ status: 'applied', conflict_count: 3 });
    expect(writer.run).toHaveBeenCalledWith('repeatable');
  });

  it('flag OFF at job time: skips, even for an admin trigger', async () => {
    const { processor, writer } = makeProcessor(false);
    await expect(
      processor.handle(job({ triggeredBy: 'admin' })),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'FLAG_OFF',
    });
    expect(writer.run).not.toHaveBeenCalled();
  });

  it.each([[undefined], [{}], [{ triggeredBy: 'scheduler' }]])(
    'rejects job data outside the contract: %p',
    async (data) => {
      const { processor, writer } = makeProcessor(true);
      await expect(processor.handle(job(data))).rejects.toThrow();
      expect(writer.run).not.toHaveBeenCalled();
    },
  );

  it('a recorded failed run fails the job and preserves bounded retries', async () => {
    const { processor, writer } = makeProcessor(true);
    writer.run.mockResolvedValue({
      status: 'failed',
      runId: 9,
      error: 'index_invalid: missing diagnostic export',
    });
    const failing = job({ triggeredBy: 'repeatable' });
    await expect(processor.handle(failing)).rejects.toThrow(
      'index_invalid: missing diagnostic export',
    );
    expect(writer.run).toHaveBeenCalledTimes(1);
    expect(failing.discard).not.toHaveBeenCalled();
  });

  it('apply committed but its answer lost: completes the job, never retries a committed run', async () => {
    const { processor, writer } = makeProcessor(true);
    const unconfirmed = {
      status: 'applied_unconfirmed',
      runId: 7,
      error: 'fetch failed',
    };
    writer.run.mockResolvedValue(unconfirmed);
    const done = job({ triggeredBy: 'repeatable' });
    await expect(processor.handle(done)).resolves.toEqual(unconfirmed);
    expect(done.discard).not.toHaveBeenCalled();
  });

  it('READ_ONLY is still returned as a skip, not as a failure', async () => {
    const { processor, writer } = makeProcessor(true);
    writer.run.mockResolvedValue({ status: 'skipped', reason: 'READ_ONLY' });
    await expect(
      processor.handle(job({ triggeredBy: 'admin' })),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'READ_ONLY',
    });
  });

  it('post-commit contract drift: discards the job (no retry) and rethrows', async () => {
    const { processor, writer } = makeProcessor(true);
    const drift = new DiagnosticProjectionContractError('dérive');
    writer.run.mockRejectedValue(drift);
    const failing = job({ triggeredBy: 'repeatable' });
    await expect(processor.handle(failing)).rejects.toBe(drift);
    expect(failing.discard).toHaveBeenCalledTimes(1);
  });

  it('any other writer error keeps the retry behaviour (no discard)', async () => {
    const { processor, writer } = makeProcessor(true);
    writer.run.mockRejectedValue(new Error('boom'));
    const failing = job({ triggeredBy: 'repeatable' });
    await expect(processor.handle(failing)).rejects.toThrow('boom');
    expect(failing.discard).not.toHaveBeenCalled();
  });
});
