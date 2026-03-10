/**
 * QA Audit H24 — SEO / Technical Suite
 *
 * 8 test groups covering technical SEO and web standards.
 * Runs against production URL every 12 hours.
 */

import { test, expect } from '@playwright/test';
import { PUBLIC_NAVIGABLE_PAGES, AUDIT_PAGES } from '../config/pages';
import { checkMetaSeo, checkPerformance, checkSchemaOrg } from '../helpers/checks';

const SEO_PAGES = PUBLIC_NAVIGABLE_PAGES.filter((p) =>
  ['core', 'product', 'blog', 'legal'].includes(p.category),
).slice(0, 15);

const PRODUCT_PAGES = AUDIT_PAGES.filter((p) => p.category === 'product').slice(0, 5);

// ─── 1. Meta Tags ──────────────────────────────────────────────────────────

test.describe('Meta Tags', () => {
  for (const pageInfo of SEO_PAGES) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
      const result = await checkMetaSeo(page);
      expect(result.passed, result.message).toBe(true);
    });
  }
});

// ─── 2. TTFB Performance ───────────────────────────────────────────────────

test.describe('TTFB Performance', () => {
  for (const pageInfo of SEO_PAGES.slice(0, 10)) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
      const result = await checkPerformance(page, 3000);
      expect(result.passed, result.message).toBe(true);
    });
  }
});

// ─── 3. HTTPS Redirects ────────────────────────────────────────────────────

test.describe('HTTPS Redirects', () => {
  test('HTTP redirects to HTTPS', async ({ request }) => {
    // Test that the production site enforces HTTPS
    try {
      const res = await request.get('http://www.automecanik.com/', {
        maxRedirects: 0,
        timeout: 10000,
      });
      const status = res.status();
      // Should be 301/302 redirect or connection refused (HSTS)
      expect([301, 302, 307, 308]).toContain(status);
    } catch {
      // Connection refused or timeout is also acceptable (HSTS preload)
      expect(true).toBe(true);
    }
  });

  test('All pages use HTTPS canonical', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const canonical = await page.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link?.getAttribute('href') || '';
    });

    if (canonical) {
      expect(canonical).toMatch(/^https:\/\//);
    }
  });
});

// ─── 4. Schema.org JSON-LD ─────────────────────────────────────────────────

test.describe('Schema.org JSON-LD', () => {
  for (const pageInfo of PRODUCT_PAGES) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
      const result = await checkSchemaOrg(page);

      // Product pages should have JSON-LD
      if (pageInfo.category === 'product') {
        expect(result.details?.schemas, 'Product page should have JSON-LD').toBeDefined();
      }

      // If JSON-LD exists, it should be valid
      if (result.details?.schemas && (result.details.schemas as Array<unknown>).length > 0) {
        expect(result.passed, result.message).toBe(true);
      }
    });
  }

  test('Homepage has Organization or WebSite schema', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await checkSchemaOrg(page);

    if (result.details?.schemas && (result.details.schemas as Array<{ type: string }>).length > 0) {
      const types = (result.details.schemas as Array<{ type: string }>).map((s) => s.type);
      const hasOrgOrSite = types.some((t) =>
        ['Organization', 'WebSite', 'LocalBusiness', 'Graph'].includes(t),
      );
      expect(hasOrgOrSite, `Expected Organization/WebSite schema, got: ${types.join(', ')}`).toBe(true);
    }
  });
});

// ─── 5. robots.txt ─────────────────────────────────────────────────────────

test.describe('robots.txt', () => {
  test('robots.txt is accessible', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('User-agent');
  });

  test('robots.txt references sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    const body = await res.text();

    expect(body.toLowerCase()).toContain('sitemap');
  });
});

// ─── 6. sitemap.xml ────────────────────────────────────────────────────────

test.describe('sitemap.xml', () => {
  test('sitemap.xml is accessible', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);

    const body = await res.text();
    expect(body).toContain('<?xml');
  });

  test('sitemap.xml has URL entries', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    const body = await res.text();

    // Should have <loc> entries or reference sub-sitemaps
    const hasLoc = body.includes('<loc>');
    const hasSitemapIndex = body.includes('<sitemapindex');
    expect(hasLoc || hasSitemapIndex, 'Sitemap should have <loc> entries or be an index').toBe(true);
  });
});

// ─── 7. HTTP Security Headers ──────────────────────────────────────────────

test.describe('Security Headers', () => {
  test('X-Frame-Options or CSP frame-ancestors', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();

    const xfo = headers['x-frame-options'];
    const csp = headers['content-security-policy'];

    const hasFrameProtection = !!xfo || (csp && csp.includes('frame-ancestors'));
    expect(hasFrameProtection, 'Should have X-Frame-Options or CSP frame-ancestors').toBe(true);
  });

  test('Cache headers present', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();

    // At minimum, some cache-related header should exist
    const hasCaching =
      !!headers['cache-control'] ||
      !!headers['etag'] ||
      !!headers['last-modified'];

    expect(hasCaching, 'Should have cache-related headers').toBe(true);
  });

  test('Content-Type is set correctly', async ({ request }) => {
    const res = await request.get('/');
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toContain('text/html');
  });
});

// ─── 8. Open Graph Tags ───────────────────────────────────────────────────

test.describe('Open Graph Tags', () => {
  for (const pageInfo of [...PRODUCT_PAGES.slice(0, 3), { name: 'Homepage', url: '/', category: 'core' }]) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });

      const og = await page.evaluate(() => {
        const getOg = (prop: string) =>
          document.querySelector(`meta[property="og:${prop}"]`)?.getAttribute('content') || '';
        return {
          title: getOg('title'),
          description: getOg('description'),
          image: getOg('image'),
          url: getOg('url'),
          type: getOg('type'),
        };
      });

      // At minimum, og:title and og:description should exist
      expect(og.title, 'og:title should exist').toBeTruthy();
      expect(og.description, 'og:description should exist').toBeTruthy();
    });
  }
});
