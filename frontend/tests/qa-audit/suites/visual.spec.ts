/**
 * QA Audit H24 — Visual / Responsive Suite
 *
 * 7 test groups covering visual integrity and responsive design.
 * Runs against production URL every 6 hours.
 */

import { test, expect } from '@playwright/test';
import { PUBLIC_NAVIGABLE_PAGES } from '../config/pages';
import { checkAccessibility } from '../helpers/checks';

const KEY_PAGES = PUBLIC_NAVIGABLE_PAGES.filter((p) =>
  ['core', 'product', 'legal', 'blog'].includes(p.category),
).slice(0, 12);

// ─── 1. Header / Footer Consistency ────────────────────────────────────────

test.describe('Header / Footer Consistency', () => {
  for (const pageInfo of KEY_PAGES) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });

      const hasHeader = await page.evaluate(() => !!document.querySelector('header'));
      const hasFooter = await page.evaluate(() => !!document.querySelector('footer'));

      expect(hasHeader, 'Page should have <header>').toBe(true);
      expect(hasFooter, 'Page should have <footer>').toBe(true);
    });
  }
});

// ─── 2. Horizontal Overflow ────────────────────────────────────────────────

test.describe('Horizontal Overflow', () => {
  for (const pageInfo of KEY_PAGES) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      const overflow = await page.evaluate(() => {
        const vw = window.innerWidth;
        const sw = document.documentElement.scrollWidth;
        return { viewportWidth: vw, scrollWidth: sw, overflows: sw > vw + 2 };
      });

      expect(overflow.overflows, `scrollWidth ${overflow.scrollWidth} > viewport ${overflow.viewportWidth}`).toBe(false);
    });
  }
});

// ─── 3. Touch Targets (44px min) ───────────────────────────────────────────

test.describe('Touch Targets', () => {
  for (const pageInfo of KEY_PAGES.slice(0, 8)) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });

      const smallTargets = await page.evaluate(() => {
        const interactives = document.querySelectorAll('a[href], button, [role="button"], input, select, textarea');
        let count = 0;
        let checked = 0;
        for (const el of interactives) {
          if (checked++ > 60) break;
          const rect = el.getBoundingClientRect();
          // Skip hidden/tiny elements
          if (rect.width <= 0 || rect.height <= 5) continue;
          if (rect.height < 44 || rect.width < 44) count++;
        }
        return count;
      });

      // Allow some small targets (nav items, inline links) but flag excessive ones
      expect(smallTargets, `${smallTargets} touch targets < 44px`).toBeLessThan(15);
    });
  }
});

// ─── 4. Basic Accessibility ────────────────────────────────────────────────

test.describe('Basic Accessibility', () => {
  for (const pageInfo of KEY_PAGES.slice(0, 10)) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });

      const result = await checkAccessibility(page);
      // Don't fail on minor a11y issues, just report
      if (!result.passed) {
        test.info().annotations.push({
          type: 'a11y-issues',
          description: result.message,
        });
      }
      // Only fail if critical a11y issues (no h1 on product pages)
      if (pageInfo.category === 'product') {
        const hasH1 = await page.evaluate(() => document.querySelectorAll('h1').length > 0);
        expect(hasH1, 'Product page must have <h1>').toBe(true);
      }
    });
  }
});

// ─── 5. CTA Visibility ────────────────────────────────────────────────────

test.describe('CTA Visibility', () => {
  test('Homepage has primary CTA above fold', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const ctaAboveFold = await page.evaluate(() => {
      const vh = window.innerHeight;
      const buttons = document.querySelectorAll('a, button');
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        const text = (btn.textContent || '').toLowerCase();
        // Look for action-oriented CTAs
        if (
          rect.top < vh &&
          rect.height > 30 &&
          (text.includes('recherch') || text.includes('voir') || text.includes('trouv') || text.includes('commander'))
        ) {
          return true;
        }
      }
      return false;
    });

    expect(ctaAboveFold, 'Homepage should have a CTA above fold').toBe(true);
  });

  test('Product page has add-to-cart or action CTA', async ({ page }) => {
    await page.goto('/pieces/plaquette-de-frein-402.html', { waitUntil: 'domcontentloaded' });

    const hasAction = await page.evaluate(() => {
      const body = (document.body.textContent || '').toLowerCase();
      return body.includes('panier') || body.includes('ajouter') || body.includes('commander') || body.includes('voir');
    });

    expect(hasAction, 'Product page should have action text').toBe(true);
  });
});

// ─── 6. Font Loading ──────────────────────────────────────────────────────

test.describe('Font Loading', () => {
  test('Web fonts load without FOUT', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    const fontsLoaded = await page.evaluate(async () => {
      // Check if document.fonts API is available
      if (!document.fonts || !document.fonts.ready) return true;
      await document.fonts.ready;
      return document.fonts.status === 'loaded';
    });

    expect(fontsLoaded, 'Fonts should be loaded').toBe(true);
  });
});

// ─── 7. Responsive Images ─────────────────────────────────────────────────

test.describe('Responsive Images', () => {
  for (const pageInfo of KEY_PAGES.filter((p) => p.category === 'product').slice(0, 3)) {
    test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });

      const oversizedImages = await page.evaluate(() => {
        const vw = window.innerWidth;
        const imgs = document.querySelectorAll('img');
        let count = 0;
        imgs.forEach((img) => {
          const rect = img.getBoundingClientRect();
          if (rect.width > vw + 10) count++;
        });
        return count;
      });

      expect(oversizedImages, `${oversizedImages} images wider than viewport`).toBe(0);
    });
  }
});
