import type { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';

const KEY = 'DIAGNOSTIC_PROJECTION_ENABLED';

function makeService(value?: string) {
  const config = {
    get: jest.fn((key: string) => (key === KEY ? value : undefined)),
  };
  return new FeatureFlagsService(config as unknown as ConfigService);
}

describe('FeatureFlagsService.diagnosticProjectionEnabled', () => {
  it('defaults to false when the variable is unset', () => {
    expect(makeService().diagnosticProjectionEnabled).toBe(false);
  });

  it('is true only for the exact string "true"', () => {
    expect(makeService('true').diagnosticProjectionEnabled).toBe(true);
  });

  it.each(['1', 'TRUE', 'yes'])(
    'reads %p as false (bool() compares to the literal "true")',
    (value) => {
      expect(makeService(value).diagnosticProjectionEnabled).toBe(false);
    },
  );

  it('is an allowed admin override key, and an override wins over the env', () => {
    const service = makeService('false');
    expect(() => service.setOverride(KEY, 'true')).not.toThrow();
    expect(service.diagnosticProjectionEnabled).toBe(true);
    service.clearOverride(KEY);
    expect(service.diagnosticProjectionEnabled).toBe(false);
  });
});
