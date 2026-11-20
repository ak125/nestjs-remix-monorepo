import { defineConfig } from '@playwright/test';

/**
 * Configuration dédiée à la sonde du parcours d'achat (mandat AU).
 *
 * Séparée de frontend/playwright.config.ts : aucune relance (une relance
 * masquerait un échec réel que l'alerte doit compter), un seul navigateur, et
 * aucune URL par défaut — la cible est toujours explicite.
 */
const baseURL = process.env.PURCHASE_PROBE_BASE_URL;
if (!baseURL) {
  throw new Error('PURCHASE_PROBE_BASE_URL requis (ex. http://localhost:3000)');
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.probe.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
