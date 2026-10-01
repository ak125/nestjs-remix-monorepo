import type { Job } from 'bull';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import type { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
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

const job = (data: unknown) => ({ id: 1, data }) as unknown as Job<unknown>;

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
});
