/**
 * QA Audit H24 — Functional Suite
 *
 * 10 test groups covering core site functionality.
 * Runs against production URL every 4 hours.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  AUDIT_PAGES,
  PUBLIC_NAVIGABLE_PAGES,
  type AuditPage,
} from '../config/pages';
import {
  checkHttpStatus,
  checkConsoleErrors,
  checkBrokenImages,
  checkBrokenLinks,
} from '../helpers/checks';

// ─── 1. HTTP Status Codes ───────────────────────────────────────────────────

test.describe('HTTP Status Codes', () => {
  for (const page of AUDIT_PAGES) {
    test(`${page.name} (${page.url})`, async ({ request, page: pwPage }) => {
      if (page.fetchOnly) {
        const res = await request.get(page.url);
        expect(res.status()).toBe(page.expectedStatus || 200);
      } else {
        const res = await pwPage.goto(page.url, { waitUntil: 'domcontentloaded' });
        const result = checkHttpStatus(res, page.expectedStatus || 200);
        expect(result.passed, result.message).toBe(true);
      }
    });
  }
});

// ─── 2. Console Errors ──────────────────────────────────────────────────────

test.describe('Console Errors', () => {
  for (const pageInfo of PUBLIC_NAVIGABLE_PAGES.slice(0, 15)) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const result = checkConsoleErrors(errors);
      expect(result.passed, result.message).toBe(true);
    });
  }
});

// ─── 3. Broken Images ──────────────────────────────────────────────────────

test.describe('Broken Images', () => {
  for (const pageInfo of PUBLIC_NAVIGABLE_PAGES.slice(0, 15)) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1500);

      const result = await checkBrokenImages(page);
      expect(result.passed, result.message).toBe(true);
    });
  }
});

// ─── 4. Broken Links ───────────────────────────────────────────────────────

test.describe('Broken Links', () => {
  const keyPages = PUBLIC_NAVIGABLE_PAGES.filter((p) =>
    ['core', 'product', 'blog'].includes(p.category),
  ).slice(0, 8);

  for (const pageInfo of keyPages) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      const baseUrl = new URL(page.url() || process.env.QA_AUDIT_BASE_URL || 'https://www.automecanik.com').origin;
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });

      const result = await checkBrokenLinks(page, baseUrl);
      expect(result.passed, result.message).toBe(true);
    });
  }
});

// ─── 5. Auth Flows ──────────────────────────────────────────────────────────

test.describe('Auth Flows', () => {
  test('Login page renders form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Register page renders form', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test('Forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });
});

// ─── 6. Search ──────────────────────────────────────────────────────────────

test.describe('Search', () => {
  test('Search returns results for "filtre"', async ({ page }) => {
    await page.goto('/search?q=filtre', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Should have some product cards or results
    const hasResults = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.length > 500; // Page has content
    });
    expect(hasResults).toBe(true);
  });

  test('Empty search handled gracefully', async ({ page }) => {
    const res = await page.goto('/search?q=', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
  });
});

// ─── 7. Cart ────────────────────────────────────────────────────────────────

test.describe('Cart', () => {
  test('Cart page renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const res = await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
    expect(errors).toHaveLength(0);
  });

  test('Checkout page renders', async ({ page }) => {
    const res = await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
  });
});

// ─── 8. Navigation ──────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('Header navigation links exist', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const headerLinks = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return 0;
      return header.querySelectorAll('a[href]').length;
    });

    expect(headerLinks).toBeGreaterThan(0);
  });

  test('Footer exists and has links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const footerLinks = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      if (!footer) return 0;
      return footer.querySelectorAll('a[href]').length;
    });

    expect(footerLinks).toBeGreaterThan(0);
  });
});

// ─── 9. Forms ───────────────────────────────────────────────────────────────

test.describe('Forms', () => {
  test('Contact form renders with inputs', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });

    const inputCount = await page.evaluate(() => {
      return document.querySelectorAll('input, textarea, select').length;
    });

    expect(inputCount).toBeGreaterThan(0);
  });

  test('Search form exists on homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const hasSearch = await page.evaluate(() => {
      return document.querySelectorAll('input[type="search"], input[placeholder*="echerch"], input[name="q"]').length > 0;
    });

    expect(hasSearch).toBe(true);
  });
});

// ─── 10. API Health ─────────────────────────────────────────────────────────

test.describe('API Health', () => {
  test('Health endpoint returns OK', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('Catalog families API returns data', async ({ request }) => {
    const res = await request.get('/api/catalog/families');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
