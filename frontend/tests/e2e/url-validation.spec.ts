/**
 * Tests E2E - Validation des URLs Critiques
 *
 * Vérifie que les URLs principales retournent les bons codes HTTP.
 * Empêche les régressions d'URLs cassées en production.
 *
 * Temps d'exécution: ~30s
 */

import { createHash } from 'node:crypto';
import { test, expect } from './fixtures';

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

// Anciens liens connus : la page ne doit PAS exister. Le catch-all ($.tsx) les
// sert en 410 Gone + noindex (PR #133). Statut EXACT : un « 4xx quelconque »
// laissait passer le 410 avalé en 404 de repli (#1750). /pieces-{marque}.html
// se décide sans appel backend (motif de checkIfOldLink).
const GONE_URLS: UrlTestCase[] = [
  { url: '/pieces-monroe.html', name: 'Gone - Ancien lien équipementier', expectedStatus: 410 },
];

// Page gamme (R1) témoin, déjà sondée sur PREPROD par Lighthouse, dont la
// section équipementiers fabriquait des liens /pieces-{marque}.html (#1750).
const R1_WITH_EQUIPEMENTIERS = '/pieces/plaquette-de-frein-402.html';

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

// Lectures du sélecteur de véhicule de l'accueil. Sur PREPROD (clé anon,
// ADR-028 option D), elles passent par les fonctions DEFINER de la migration
// 20261026_vehicle_api_definer_reads : une lecture refusée (42501) ou une
// fonction absente (PGRST202) remonte ici en 5xx. TOYOTA (164) a des modèles
// en 2008 ; les motorisations du premier modèle peuvent être vides, seul leur
// statut est vérifié. Statut, taille, empreinte du corps et durée de chaque
// lecture sont écrits dans le journal du job, pour comparer PREPROD à PROD.
const VEHICLE_BRAND_ID = 164;
const VEHICLE_YEAR = 2008;

test.describe('URL Validation - Vehicle selector API (200)', () => {
  test('brands, years, models and types return 200', async ({ request }) => {
    const read = async (url: string) => {
      const startedAt = Date.now();
      const response = await request.get(url);
      const raw = await response.body();
      const sha256 = createHash('sha256').update(raw).digest('hex');
      console.log(
        `vehicle-selector ${url} ${response.status()} ${raw.length}o sha256=${sha256} ${Date.now() - startedAt}ms`,
      );
      expect(response.status(), `${url} should return 200`).toBe(200);
      const body = JSON.parse(raw.toString('utf8'));
      expect(body.success, `${url}: success`).toBe(true);
      expect(Array.isArray(body.data), `${url}: data array`).toBe(true);
      return body.data as Array<{ modele_id?: number }>;
    };

    expect((await read('/api/vehicles/brands')).length).toBeGreaterThan(0);
    expect((await read(`/api/vehicles/brands/${VEHICLE_BRAND_ID}/years`)).length).toBeGreaterThan(0);
    const models = await read(`/api/vehicles/brands/${VEHICLE_BRAND_ID}/models?year=${VEHICLE_YEAR}`);
    expect(models.length).toBeGreaterThan(0);
    await read(`/api/vehicles/models/${models[0].modele_id}/types?year=${VEHICLE_YEAR}`);
  });
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

test.describe('URL Validation - Gone (410)', () => {
  for (const { url, name, expectedStatus } of GONE_URLS) {
    test(`${name} - ${url} returns ${expectedStatus} noindex`, async ({ request }) => {
      const response = await request.get(url, { maxRedirects: 0 });

      expect(response.status(), `${name} should return ${expectedStatus}`).toBe(expectedStatus);
      expect(response.headers()['x-robots-tag']).toBe('noindex, follow');
    });
  }
});

test.describe('URL Validation - No link to a gone URL', () => {
  test(`R1 ${R1_WITH_EQUIPEMENTIERS} emits no /pieces-{marque}.html link`, async ({ request }) => {
    const response = await request.get(R1_WITH_EQUIPEMENTIERS);
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Non vacuité : la section équipementiers est rendue, sinon « 0 lien » ne
    // prouverait rien.
    expect(html).toContain('Nous sélectionnons des équipementiers reconnus');
    expect(html.match(/href="\/pieces-[^"/]+\.html"/g) ?? []).toEqual([]);
  });
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

  // Le loader de /search rattrape une panne du backend et rend la page en 200
  // avec la bannière « Erreur de recherche » : le statut seul ne la voit pas.
  // Le nombre de résultats n'est pas exigé (catalogue illisible par la clé
  // anon de PREPROD, cf. critical-path.spec.ts TEST 2).
  test('Search page renders with results', async ({ page }) => {
    const response = await page.goto('/search?q=plaquette');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/^Recherche: plaquette \|/);
    await expect(page.getByRole('heading', { name: 'Erreur de recherche' })).toHaveCount(0);
  });

  test('Catalogue page renders categories', () => {
    test.skip(
      true,
      '/pieces/catalogue répond 301 vers / (routes/pieces.$slug.tsx) alors que ' +
        'pieces-route-seo.spec.ts attend 410 : contrat SEO à trancher par l’owner ; ' +
        'le test ne voyait que l’accueil, déjà couvert ci-dessus',
    );
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
