import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * QA Audit H24 — Playwright Configuration
 *
 * 3 viewports, sequential execution, custom Supabase reporter.
 *
 * Usage:
 *   QA_AUDIT_BASE_URL=https://www.automecanik.com npx playwright test \
 *     --config=tests/qa-audit/playwright.qa.config.ts
 */

export default defineConfig({
  testDir: path.join(__dirname, 'suites'),

  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,

  reporter: [
    ['list'],
    [path.join(__dirname, 'helpers', 'reporter.ts')],
  ],

  use: {
    baseURL: process.env.QA_AUDIT_BASE_URL || 'https://www.automecanik.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    extraHTTPHeaders: {
      'X-QA-Audit': 'true',
    },
  },

  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 375, height: 812 } },
    },
  ],
});
