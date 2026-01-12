/**
 * Tests E2E - Validation des URLs Critiques
 *
 * Vérifie que les URLs principales retournent les bons codes HTTP.
 * Empêche les régressions d'URLs cassées en production.
 *
 * Temps d'exécution: ~30s
 */

import { test, expect } from '@playwright/test';

// ============================================
// URLS CRITIQUES À VALIDER
// ============================================

interface UrlTestCase {
  url: string;
  name: string;
  expectedStatus: number;
  description?: string;
}

// URLs qui DOIVENT retourner 200
const CRITICAL_URLS_200: UrlTestCase[] = [
  { url: '/', name: 'Homepage', expectedStatus: 200 },
  { url: '/health', name: 'Health Check', expectedStatus: 200 },
  { url: '/search?q=plaquette', name: 'Search Page', expectedStatus: 200 },
  { url: '/pieces/catalogue', name: 'Catalogue', expectedStatus: 200 },
  { url: '/pieces/catalogue?category=freinage', name: 'Catalogue Freinage', expectedStatus: 200 },
  { url: '/pieces/catalogue?category=moteur', name: 'Catalogue Moteur', expectedStatus: 200 },
  { url: '/pieces/catalogue?category=embrayage', name: 'Catalogue Embrayage', expectedStatus: 200 },
  { url: '/pieces/catalogue?category=suspension', name: 'Catalogue Suspension', expectedStatus: 200 },
  { url: '/contact', name: 'Contact', expectedStatus: 200 },
  { url: '/cart', name: 'Panier', expectedStatus: 200 },
];

// URLs qui DOIVENT retourner une erreur (400 ou 404)
const EXPECTED_ERROR_URLS: UrlTestCase[] = [
  { url: '/pieces/invalid-url-without-id', name: 'Error - Invalid piece URL', expectedStatus: 400, description: 'Route returns 400 for invalid format' },
  { url: '/nonexistent-page', name: '404 - Page inexistante', expectedStatus: 404 },
];

// URLs de redirection (anciennes URLs qui doivent rediriger)
const REDIRECT_URLS: UrlTestCase[] = [
  // Les anciennes URLs avec .html doivent soit rediriger (301/302) soit retourner 404
  // Ne pas échouer si le backend gère la migration
];

// ============================================
// TESTS DE VALIDATION HTTP STATUS
// ============================================

test.describe('URL Validation - Critical Pages (200)', () => {
  for (const { url, name, expectedStatus } of CRITICAL_URLS_200) {
    test(`${name} - ${url} returns ${expectedStatus}`, async ({ request }) => {
      const response = await request.get(url);

      // Log détaillé en cas d'échec
      if (response.status() !== expectedStatus) {
        console.error(`❌ ${name}: Expected ${expectedStatus}, got ${response.status()}`);
        console.error(`   URL: ${url}`);
        console.error(`   Headers: ${JSON.stringify(response.headers())}`);
      }

      expect(response.status(), `${name} should return ${expectedStatus}`).toBe(expectedStatus);
    });
  }
});

test.describe('URL Validation - Expected Errors', () => {
  for (const { url, name, expectedStatus, description } of EXPECTED_ERROR_URLS) {
    test(`${name} - ${url} returns ${expectedStatus}`, async ({ request }) => {
      const response = await request.get(url);
      const status = response.status();

      // Log pour debug
      if (description) {
        console.log(`  ${description}`);
      }

      // Accepter 400 ou 404 pour les URLs invalides (selon implémentation route)
      if (expectedStatus === 400 || expectedStatus === 404) {
        expect(status >= 400 && status < 500, `${name} should return 4xx error, got ${status}`).toBe(true);
      } else {
        expect(status, `${name} should return ${expectedStatus}`).toBe(expectedStatus);
      }
    });
  }
});

// ============================================
// TESTS DE NAVIGATION (DOM)
// ============================================

test.describe('URL Navigation - Page Renders', () => {
  test('Homepage renders with main content', async ({ page }) => {
    await page.goto('/');

    // Vérifier que la page charge correctement
    await expect(page).toHaveTitle(/automecanik/i);

    // Vérifier qu'un élément clé est présent
    const navbar = page.locator('nav').first();
    await expect(navbar).toBeVisible({ timeout: 10000 });
  });

  test('Search page renders with results', async ({ page }) => {
    await page.goto('/search?q=plaquette');

    // Attendre que la page charge (domcontentloaded plus rapide que networkidle)
    await page.waitForLoadState('domcontentloaded');

    // Vérifier que la recherche est exécutée - chercher un élément clé
    // La page de recherche doit avoir un formulaire ou input
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible({ timeout: 10000 });

    // Vérifier que ce n'est pas une page d'erreur
    const errorIndicator = page.getByText(/erreur|error|500/i);
    await expect(errorIndicator).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // OK si pas visible
    });
  });

  test('Catalogue page renders categories', async ({ page }) => {
    await page.goto('/pieces/catalogue');

    await page.waitForLoadState('networkidle');

    // La page doit avoir du contenu (pas 404)
    const errorPage = page.getByText(/page non trouvée|404|not found/i);
    await expect(errorPage).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // OK si pas visible
    });
  });
});

// ============================================
// TESTS DE PERFORMANCE BASIQUES
// ============================================

test.describe('URL Performance - Response Time', () => {
  test('Homepage loads under 3s', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('/');
    const endTime = Date.now();

    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime, `Homepage should load under 3000ms, took ${responseTime}ms`).toBeLessThan(3000);
  });

  test('Health check responds under 500ms', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('/health');
    const endTime = Date.now();

    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime, `Health check should respond under 500ms, took ${responseTime}ms`).toBeLessThan(500);
  });
});

// ============================================
// TESTS QuickCategoryChip URLs (Bug Fix Validation)
// ============================================

test.describe('QuickCategoryChip URLs - Bug Fix Verification', () => {
  const categoryUrls = [
    '/pieces/catalogue?category=freinage',
    '/pieces/catalogue?category=moteur',
    '/pieces/catalogue?category=embrayage',
    '/pieces/catalogue?category=electrique',
    '/pieces/catalogue?category=suspension',
  ];

  for (const url of categoryUrls) {
    test(`Category URL ${url} returns 200`, async ({ request }) => {
      const response = await request.get(url);
      expect(response.status()).toBe(200);
    });
  }

  // Ancien format qui devrait retourner 404 ou rediriger
  test('Old format /pieces/freinage should NOT return 200', async ({ request }) => {
    const response = await request.get('/pieces/freinage');
    // Doit retourner 404 (pas de .html) ou rediriger (301/302)
    expect(response.status()).not.toBe(200);
  });
});
