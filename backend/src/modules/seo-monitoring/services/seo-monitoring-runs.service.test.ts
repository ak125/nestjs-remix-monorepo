import { runtimeIdentity } from './seo-monitoring-runs.service';

describe('runtimeIdentity — git_sha journalisé', () => {
  const SHA_A = 'a'.repeat(40);
  const SHA_B = 'b'.repeat(40);
  const KEYS = ['GIT_SHA', 'SOURCE_COMMIT'] as const;
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  const identityWith = (gitSha?: string, sourceCommit?: string) => {
    if (gitSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = gitSha;
    if (sourceCommit === undefined) delete process.env.SOURCE_COMMIT;
    else process.env.SOURCE_COMMIT = sourceCommit;
    return runtimeIdentity();
  };

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it.each([
    ['GIT_SHA', SHA_A, undefined],
    ['SOURCE_COMMIT', undefined, SHA_A],
  ])('SHA complet déclaré par %s : journalisé', (_l, gitSha, sourceCommit) => {
    expect(identityWith(gitSha, sourceCommit).git_sha).toBe(SHA_A);
  });

  it.each([
    ['absente', undefined, undefined],
    ['abrégée', 'abc1234', undefined],
    ['nom de branche', 'main', undefined],
    ['divergente', SHA_A, SHA_B],
  ])('déclaration %s : null, valeur reçue non recopiée', (_l, g, s) => {
    const identity = identityWith(g, s);
    expect(identity.git_sha).toBeNull();
    expect(JSON.stringify(identity)).not.toMatch(/abc1234|"main"/);
  });

  it('garde les autres champs de la trace', () => {
    expect(identityWith(SHA_A)).toEqual(
      expect.objectContaining({
        hostname: expect.any(String),
        pid: process.pid,
        git_sha: SHA_A,
      }),
    );
  });
});
