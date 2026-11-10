import { isCommitSha, resolveBuildIdentity } from './build-identity.util';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('isCommitSha', () => {
  it('accepte un SHA complet en minuscules', () => {
    expect(isCommitSha(SHA_A)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'abc1234',
    'main',
    SHA_A.toUpperCase(),
    `${SHA_A}0`,
    `${SHA_A}\n`,
    ` ${SHA_A}`,
  ])('refuse %j', (value) => {
    expect(isCommitSha(value)).toBe(false);
  });
});

describe('resolveBuildIdentity', () => {
  it.each([
    ['GIT_SHA seul', { GIT_SHA: SHA_A }],
    ['SOURCE_COMMIT seul', { SOURCE_COMMIT: SHA_A }],
    ['les deux concordants', { GIT_SHA: SHA_A, SOURCE_COMMIT: SHA_A }],
    [
      'GIT_SHA valide, SOURCE_COMMIT vide',
      { GIT_SHA: SHA_A, SOURCE_COMMIT: '' },
    ],
  ])('%s : valeur déclarée servie', (_l, env) => {
    expect(resolveBuildIdentity(env)).toEqual({ sha: SHA_A, problem: null });
  });

  it.each([
    ['aucune variable', {}],
    // Dockerfile : `ARG GIT_SHA=""` quand le build ne passe pas l'argument.
    ['GIT_SHA vide', { GIT_SHA: '' }],
    ['les deux vides', { GIT_SHA: '', SOURCE_COMMIT: '' }],
  ])('%s : absente', (_l, env) => {
    expect(resolveBuildIdentity(env)).toEqual({
      sha: null,
      problem: 'build identity absent',
    });
  });

  it.each([
    ['GIT_SHA abrégé', { GIT_SHA: 'abc1234' }],
    ['GIT_SHA en majuscules', { GIT_SHA: SHA_A.toUpperCase() }],
    ['SOURCE_COMMIT invalide', { GIT_SHA: SHA_A, SOURCE_COMMIT: 'unknown' }],
    // L'invalidité prime : une valeur refusée ne devient pas « divergente ».
    ['invalide et divergente', { GIT_SHA: 'abc1234', SOURCE_COMMIT: SHA_B }],
  ])('%s : invalide, jamais recopiée', (_l, env) => {
    const identity = resolveBuildIdentity(env);
    expect(identity).toEqual({ sha: null, problem: 'build identity invalid' });
    expect(JSON.stringify(identity)).not.toContain('abc1234');
  });

  it('deux SHA valides différents : divergente', () => {
    expect(
      resolveBuildIdentity({ GIT_SHA: SHA_A, SOURCE_COMMIT: SHA_B }),
    ).toEqual({ sha: null, problem: 'build identity divergent' });
  });

  it('lit process.env par défaut', () => {
    const saved = {
      GIT_SHA: process.env.GIT_SHA,
      SOURCE_COMMIT: process.env.SOURCE_COMMIT,
    };
    try {
      process.env.GIT_SHA = SHA_B;
      delete process.env.SOURCE_COMMIT;
      expect(resolveBuildIdentity().sha).toBe(SHA_B);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
