import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright DÉDIÉE à la régression visuelle, CO-LOCALISÉE avec sa suite (`tests/visual/`).
 *
 * Séparée de `../../playwright.config.ts` (dont `testDir: './tests/e2e'` exclut `tests/visual`) :
 * suite isolée, déterministe (1 worker, pas de retry), à exécuter dans l'image Docker pinnée
 * `mcr.microsoft.com/playwright:v1.61.0-noble` via `scripts/visual/run-visual-docker.sh`.
 * Tous les chemins relatifs ci-dessous sont résolus depuis CE dossier (`frontend/tests/visual/`).
 * Voir `README.md` (même dossier).
 */
export default defineConfig({
  testDir: ".",
  timeout: 60 * 1000,
  fullyParallel: false, // déterminisme : captures séquentielles
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Artefacts (diffs, rapport) isolés SOUS `test-results/` — déjà gitignoré (`**/test-results/`).
  // Évite de salir le `playwright-report/index.html` TRACKÉ de la suite e2e : le gate ne mute
  // jamais un fichier suivi par git.
  outputDir: "./test-results/visual",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "./test-results/visual-report" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
  // Serveur fourni hors config (DEV:3000 ou PREPROD) — cf. README.
  webServer: undefined,
});
