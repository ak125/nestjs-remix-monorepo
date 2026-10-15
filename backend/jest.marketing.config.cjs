/** Native marketing unit/contract tests: no dotenv or application bootstrap. */
const base = require('./jest.config.js');
module.exports = {
  ...base,
  rootDir: __dirname,
  setupFiles: [],
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@repo/database-types$':
      '<rootDir>/../packages/database-types/src/index.ts',
    '^@repo/database-types/(.*)$':
      '<rootDir>/../packages/database-types/src/$1.ts',
  },
  maxWorkers: 1,
  // Same bounded transform as jest.command-center.config.cjs; typecheck separately.
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: { isolatedModules: true, incremental: false },
        diagnostics: false,
      },
    ],
  },
  testRegex: '[/\\\\]modules[/\\\\]marketing[/\\\\].*\\.test\\.ts$',
};
