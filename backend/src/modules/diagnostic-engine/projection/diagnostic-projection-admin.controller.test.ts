import { ConflictException } from '@nestjs/common';
import { getAppConfig } from '../../../config/app.config';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import { DiagnosticProjectionAdminController } from './diagnostic-projection-admin.controller';
import type { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';

jest.mock('../../../config/app.config', () => ({ getAppConfig: jest.fn() }));

function makeController(options: { enabled: boolean; readOnly: boolean }) {
  (getAppConfig as jest.Mock).mockReturnValue({
    supabase: { readOnly: options.readOnly },
  });
  const scheduler = { triggerNow: jest.fn().mockResolvedValue('42') };
  const controller = new DiagnosticProjectionAdminController(
    scheduler as unknown as DiagnosticProjectionSchedulerService,
    {
      diagnosticProjectionEnabled: options.enabled,
    } as unknown as FeatureFlagsService,
  );
  return { controller, scheduler };
}

describe('DiagnosticProjectionAdminController', () => {
  it('flag ON, not READ_ONLY: enqueues and reports the job', async () => {
    const { controller, scheduler } = makeController({
      enabled: true,
      readOnly: false,
    });
    await expect(controller.trigger()).resolves.toMatchObject({
      ok: true,
      jobId: '42',
    });
    expect(scheduler.triggerNow).toHaveBeenCalledTimes(1);
  });

  it('flag OFF: 409 FLAG_OFF, nothing enqueued', async () => {
    const { controller, scheduler } = makeController({
      enabled: false,
      readOnly: false,
    });
    const failure = await controller.trigger().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConflictException);
    expect((failure as ConflictException).getStatus()).toBe(409);
    expect((failure as ConflictException).getResponse()).toMatchObject({
      ok: false,
      reason: 'FLAG_OFF',
      message: expect.any(String),
    });
    expect(scheduler.triggerNow).not.toHaveBeenCalled();
  });

  it('READ_ONLY: 409 READ_ONLY, nothing enqueued', async () => {
    const { controller, scheduler } = makeController({
      enabled: true,
      readOnly: true,
    });
    const failure = await controller.trigger().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConflictException);
    expect((failure as ConflictException).getResponse()).toMatchObject({
      ok: false,
      reason: 'READ_ONLY',
    });
    expect(scheduler.triggerNow).not.toHaveBeenCalled();
  });
});
