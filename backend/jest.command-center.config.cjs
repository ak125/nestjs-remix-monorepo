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
        // Mêmes module/moduleResolution que jest.config.js : sous le NodeNext de
        // tsconfig.json, isolatedModules émettrait de l'ESM pour les paquets
        // "type": "module" (@repo/seo-types) et la suite ne se chargerait pas.
        tsconfig: {
          isolatedModules: true,
          incremental: false,
          module: 'commonjs',
          moduleResolution: 'bundler',
        },
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@repo/registry$': '<rootDir>/../packages/registry/src/index.ts',
  },
};
