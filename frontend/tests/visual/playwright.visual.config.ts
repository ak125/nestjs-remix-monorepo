import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright DÉDIÉE à la régression visuelle, CO-LOCALISÉE avec sa suite (`tests/visual/`).
 *
 * Séparée de `../../playwright.config.ts` (dont `testDir: './tests/e2e'` exclut `tests/visual`) :
 * suite isolée, déterministe (1 worker, pas de retry), à exécuter dans l'image Docker pinnée
 * `mcr.microsoft.com/playwright:v1.61.0-noble` via `scripts/visual/run-visual-docker.sh`.
 * Tous les chemins relatifs ci-dessous sont résolus depuis CE dossier (`frontend/tests/visual/`).
 * Voir `README.md` (même dossier).
 *
 * ── Topologie snapshots à deux niveaux (GATE-0 du chantier Tailwind 4) ─────────────────────
 *   • `snapshots/<projectName>/<spec>/<arg>.png` = ORACLE COURANT, le SEUL comparé par le gate.
 *     Mis à jour UNIQUEMENT dans une PR déclarée `visual-change` (artefact before/after + manifest
 *     + approbation owner). `--update-snapshots` interdit hors de ce flux.
 *   • `reference-v3/` = ARCHIVE IMMUABLE de l'état pré-migration (PNG libres, référencés par AUCUN
 *     `toHaveScreenshot` — preuve historique, jamais ré-écrits ; hors `testMatch`).
 *   `snapshotPathTemplate` route l'oracle dans `snapshots/` ; `{projectName}` évite la collision
 *   des deux projets (desktop / mobile) sur des noms de capture identiques.
 *   INVARIANT : toute baseline de `snapshots/` DOIT être capturée sous l'état Tailwind v3 (build
 *   courant) AVANT toute mutation DT ou TW — une baseline post-migration masquerait la régression
 *   que le gate existe pour attraper.
 *
 * DÉTERMINISME (obligatoire) : générer ET comparer DOIVENT se faire dans l'image Docker pinnée
 * (= runner CI noble). Hors de cette image (poste DEV jammy) → diffs de rendu de police.
 */
export default defineConfig({
  testDir: ".",
  // Seuls les specs de régression visuelle sont des tests : garde `reference-v3/` (PNG libres) et
  // tout autre fichier hors du graphe de tests.
  testMatch: "**/*.visual.spec.ts",
  // Oracle courant unique : `snapshots/<projet>/<spec>/<capture>.png` (pas de suffixe `-platform`,
  // l'exécution est toujours l'image noble linux pinnée).
  snapshotPathTemplate: "{testDir}/snapshots/{projectName}/{testFileName}/{arg}{ext}",
  timeout: 60 * 1000,
  fullyParallel: false, // déterminisme : captures séquentielles
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Artefacts (diffs, rapport) isolés SOUS `test-results/` — déjà gitignoré (`**/test-results/`).
  // Évite de salir le `playwright-report/index.html` TRACKÉ de la suite e2e : le gate ne mute
  // jamais un fichier suivi par git (hors les baselines de `snapshots/`, en PR `visual-change`).
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
      // Garde-fou anti-faux-positif global. PAS l'autorité unique : les captures composant ciblées
      // posent un seuil plus strict localement (voir `components.visual.spec.ts`).
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
    {
      // Mobile 390×844 (viewport iPhone 12 / Pixel courant) : UA mobile + touch + isMobile.
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  // Serveur fourni hors config (DEV:3000 ou PREPROD:3200) — cf. README + job CI `visual-gate.yml`.
  webServer: undefined,
});
