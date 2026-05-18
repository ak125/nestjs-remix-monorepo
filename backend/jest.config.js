/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  moduleNameMapper: {
    // Strip `.js` from relative imports so ts-jest can resolve them to `.ts` source.
    // Required because @repo/seo-types and @repo/database-types use NodeNext-style
    // ESM imports (canonical `.js` extension on relative paths) in their src/.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@cache/(.*)$': '<rootDir>/src/cache/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@repo/database-types$': '<rootDir>/tests/__mocks__/@repo/database-types.ts',
    '^@repo/database-types/(.*)$': '<rootDir>/tests/__mocks__/@repo/database-types.ts',
    '^@repo/seo-types$': '<rootDir>/../packages/seo-types/src/index.ts',
    '^@repo/seo-types/(.*)$': '<rootDir>/../packages/seo-types/src/$1.ts',
  },
  // Ignore dist and node_modules
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Transform ESM packages from monorepo workspaces
  transformIgnorePatterns: [
    '/node_modules/(?!(@repo/database-types|@repo/seo-types|@monorepo/shared-types)/)',
  ],
  // Setup files - load .env.test for Supabase credentials
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Coverage thresholds — floor baseline, raise progressively
  coverageThreshold: {
    global: {
      lines: 2,
      branches: 2,
      functions: 2,
      statements: 2,
    },
  },
  // Timeout for slower tests
  testTimeout: 30000,
  // Limit workers to avoid RAM saturation (default = CPU count)
  maxWorkers: 2,
};
