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
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@repo/database-types$': '<rootDir>/tests/__mocks__/@repo/database-types.ts',
    '^@repo/database-types/(.*)$': '<rootDir>/tests/__mocks__/@repo/database-types.ts',
  },
  // Ignore dist and node_modules
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Transform ESM packages from monorepo workspaces
  transformIgnorePatterns: [
    '/node_modules/(?!(@repo/database-types|@monorepo/shared-types)/)',
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
};
