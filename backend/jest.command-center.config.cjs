/** Isolated Command Center units: no .env setup or application bootstrap. */
const base = require('./jest.config.js');
module.exports = {
  ...base,
  rootDir: __dirname,
  setupFiles: [],
  setupFilesAfterEnv: [],
  maxWorkers: 1,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: { isolatedModules: true, incremental: false },
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@repo/registry$': '<rootDir>/../packages/registry/src/index.ts',
  },
};
