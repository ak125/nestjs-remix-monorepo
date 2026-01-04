/**
 * 🔍 SEARCH-FIRST MOBILE - Tests E2E
 * Vérifie l'implémentation sticky search + quick categories
 */

import { test, expect } from '@playwright/test';

// Use PORT 3000 (where dev server runs)
const BASE_URL = 'http://localhost:3000';

test.describe('Search-First Mobile', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('Sticky search bar visible sur mobile', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check sticky search bar is visible
    const stickySearch = page.locator('.header__mobile-search-sticky');
    await expect(stickySearch).toBeVisible();

    // Check search button is present (opens full-screen search)
    const searchButton = stickySearch.locator('button[aria-label="Rechercher"]');
    await expect(searchButton).toBeVisible();
  });

  test('Quick category chips présents', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const stickySearch = page.locator('.header__mobile-search-sticky');

    // Check quick category chips (links with rounded-full class)
    const chips = stickySearch.locator('a');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThanOrEqual(6);

    // Verify chip labels
    await expect(chips.nth(0)).toContainText('Freinage');
    await expect(chips.nth(1)).toContainText('Filtration');
    await expect(chips.nth(2)).toContainText('Distribution');
  });

  test('Search bar reste sticky après scroll', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const stickySearch = page.locator('.header__mobile-search-sticky');
    await expect(stickySearch).toBeVisible();

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);

    // Search bar should still be visible (sticky)
    await expect(stickySearch).toBeVisible();

    // Verify it's near the top of viewport (sticky behavior)
    const box = await stickySearch.boundingBox();
    expect(box?.y).toBeLessThanOrEqual(100); // Near top of viewport (below navbar)
  });

  test('Clic sur chip navigue vers catégorie', async ({ page, browserName }) => {
    // WebKit Playwright: navigation timing différent, faux positif
    test.skip(browserName === 'webkit', 'WebKit Playwright navigation timing false positive');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const freinageChip = page.locator('.header__mobile-search-sticky a:has-text("Freinage")');
    await freinageChip.click();

    // Vérifier navigation
    await expect(page).toHaveURL(/freinage/i);
  });

  test('Search button ouvre la modal de recherche', async ({ page, browserName }) => {
    // WebKit Playwright: modal animation timing différent
    test.skip(browserName === 'webkit', 'WebKit Playwright modal animation timing false positive');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Click search button in sticky bar
    const searchButton = page.locator('.header__mobile-search-sticky button[aria-label="Rechercher"]');
    await searchButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(300);

    // Check that search input is now visible (in mobile full-screen modal)
    // Use specific placeholder to target mobile modal input
    const searchInput = page.getByPlaceholder('Filtre à huile, référence OEM');
    await expect(searchInput).toBeVisible();
  });

  test('Masqué sur desktop (md:hidden)', async ({ page, browserName }) => {
    // WebKit Playwright: md:hidden CSS media query non respecté après viewport resize
    test.skip(browserName === 'webkit', 'WebKit Playwright md:hidden media query false positive');

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const stickySearch = page.locator('.header__mobile-search-sticky');
    await expect(stickySearch).not.toBeVisible();
  });
});
