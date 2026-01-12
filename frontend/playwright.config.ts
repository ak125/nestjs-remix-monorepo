import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour les tests E2E
 * Phase 10 : Tests E2E Automatisés
 * 
 * Tests couverts :
 * - NavbarMobile (Phase 2) : Burger menu, navigation responsive
 * - CartSidebar (Phase 1 + 8) : Panier avec gestion consignes
 * - ProductSearch (Phase 9) : Recherche unifiée hero/compact
 * - Role-Based Navigation (Phase 7) : Accès admin par rôle
 */

export default defineConfig({
  // Répertoire des tests E2E
  testDir: './tests/e2e',
  
  // Timeout global pour chaque test
  timeout: 30 * 1000,
  
  // Exécution parallèle
  fullyParallel: true,
  
  // Pas de retry sur échec en local (retry en CI)
  retries: process.env.CI ? 2 : 0,
  
  // Nombre de workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter : liste en local, html + github en CI
  reporter: process.env.CI 
    ? [['html'], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  
  // Configuration partagée pour tous les tests
  use: {
    // URL de base du serveur Remix
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    
    // Trace : uniquement sur échec
    trace: 'on-first-retry',
    
    // Screenshots : uniquement sur échec
    screenshot: 'only-on-failure',
    
    // Vidéos : uniquement sur échec avec retry
    video: 'retain-on-failure',
    
    // Timeout pour les actions
    actionTimeout: 10 * 1000,
    
    // Timeout pour la navigation
    navigationTimeout: 15 * 1000,
  },

  // Projets : browsers à tester
  // CI: Chromium uniquement (rapide ~5x)
  // Local: tous les navigateurs (5 browsers)
  projects: process.env.CI
    ? [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
            viewport: { width: 1920, height: 1080 },
          },
        },
      ]
    : [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
            viewport: { width: 1920, height: 1080 },
          },
        },
        {
          name: 'firefox',
          use: {
            ...devices['Desktop Firefox'],
            viewport: { width: 1920, height: 1080 },
          },
        },
        {
          name: 'webkit',
          use: {
            ...devices['Desktop Safari'],
            viewport: { width: 1920, height: 1080 },
          },
        },
        // Tests mobile pour NavbarMobile (Phase 2)
        {
          name: 'mobile-chrome',
          use: {
            ...devices['Pixel 5'],
          },
        },
        {
          name: 'mobile-safari',
          use: {
            ...devices['iPhone 12'],
          },
        },
      ],

  // Serveur web pour les tests (optionnel, si besoin de démarrer le serveur auto)
  webServer: process.env.CI ? {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  } : undefined,
});
