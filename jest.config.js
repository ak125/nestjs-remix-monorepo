/**
 * Root Jest config — delegates to backend/jest.config.js
 *
 * Run tests from anywhere in the monorepo:
 *   npx jest                    (uses this config)
 *   cd backend && npx jest      (uses backend/jest.config.js directly)
 */

/** @type {import('jest').Config} */
module.exports = {
  projects: ['<rootDir>/backend/jest.config.js'],
};
