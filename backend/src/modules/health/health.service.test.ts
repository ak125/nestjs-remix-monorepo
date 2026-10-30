import { HealthService } from './health.module';

describe('HealthService.getHealth — revision', () => {
  const original = process.env.GIT_SHA;
  const SHA = '0123456789abcdef0123456789abcdef01234567';

  afterEach(() => {
    if (original === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = original;
  });

  it('returns the full commit SHA baked into the image', () => {
    process.env.GIT_SHA = SHA;
    expect(new HealthService().getHealth()).toMatchObject({
      status: 'ok',
      revision: SHA,
    });
  });

  it('returns null when GIT_SHA is unset (DEV working tree)', () => {
    delete process.env.GIT_SHA;
    expect(new HealthService().getHealth().revision).toBeNull();
  });

  it.each(['', 'abc1234', `${SHA}\n`, SHA.toUpperCase(), `${SHA}0`, 'main'])(
    'returns null for a value that is not a full lowercase SHA: %j',
    (value) => {
      process.env.GIT_SHA = value;
      expect(new HealthService().getHealth().revision).toBeNull();
    },
  );
});
