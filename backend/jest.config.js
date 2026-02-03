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
  },
  // Ignore dist and node_modules
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Setup files - load .env.test for Supabase credentials
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Timeout for slower tests
  testTimeout: 30000,
};
