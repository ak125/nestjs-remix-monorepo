import {
  isOneshotConfirmed,
  ONESHOT_CONFIRM_ENV,
  ONESHOT_REFUSAL,
} from './run-supplier-sync-once.guard';
import { WorkerModule } from './worker.module';
import { SupplierSyncRunner } from '../modules/supplier-truth/supplier-sync.runner';

describe('one-shot guard — real supplier sync is owner-gated (fail-safe)', () => {
  it('refuses by default; only an explicit "true" confirms a real run', () => {
    expect(isOneshotConfirmed({})).toBe(false);
    expect(isOneshotConfirmed({ [ONESHOT_CONFIRM_ENV]: 'false' })).toBe(false);
    expect(isOneshotConfirmed({ [ONESHOT_CONFIRM_ENV]: '1' })).toBe(false);
    expect(isOneshotConfirmed({ [ONESHOT_CONFIRM_ENV]: 'TRUE' })).toBe(false);
    expect(isOneshotConfirmed({ [ONESHOT_CONFIRM_ENV]: 'yes' })).toBe(false);
    expect(isOneshotConfirmed({ [ONESHOT_CONFIRM_ENV]: 'true' })).toBe(true);
  });

  it('the refusal message names the blocked real actions', () => {
    expect(ONESHOT_REFUSAL).toContain('NO portal login');
    expect(ONESHOT_REFUSAL).toContain('NO DB write');
    expect(ONESHOT_REFUSAL).toContain(ONESHOT_CONFIRM_ENV);
  });
});

describe('WorkerModule wires SupplierSyncRunner (the ops entrypoint app.get resolves)', () => {
  it('declares SupplierSyncRunner as a provider', () => {
    const providers = Reflect.getMetadata('providers', WorkerModule) ?? [];
    const tokens = providers.map((p: unknown) =>
      typeof p === 'object' && p !== null && 'provide' in p
        ? (p as { provide: unknown }).provide
        : p,
    );
    expect(tokens).toContain(SupplierSyncRunner);
  });
});
