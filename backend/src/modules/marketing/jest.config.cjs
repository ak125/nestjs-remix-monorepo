/** Native marketing unit/contract tests: no dotenv or application bootstrap. */
const path = require('node:path');
const base = require('../../../jest.config.js');
module.exports = {
  ...base,
  rootDir: path.resolve(__dirname, '../../..'),
  roots: [...base.roots, '<rootDir>/../scripts/marketing'],
  setupFiles: ['<rootDir>/../scripts/marketing/simulation-no-network.cjs'],
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
  testRegex:
    '(?:[/\\\\]modules[/\\\\]marketing[/\\\\].*|[/\\\\]scripts[/\\\\]marketing[/\\\\](?:generate-(?:weekly-plan|copy-batch)|export-publish-queue))\\.test\\.ts$',
};
