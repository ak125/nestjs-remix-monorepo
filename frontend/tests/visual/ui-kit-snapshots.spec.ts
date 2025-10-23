import { test, expect } from '@playwright/test';

/**
 * Tests de régression visuelle pour l'UI-Kit
 * 
 * Compare les screenshots entre builds pour détecter les régressions visuelles.
 * Coverage: thèmes (vitrine/admin) × modes (light/dark) × densités (comfy/compact)
 * 
 * En cas de changement intentionnel, mettre à jour les baselines avec:
 * npm run test:visual -- --update-snapshots
 */

test.describe('UI-Kit Visual Regression Tests', () => {
  const themes = ['vitrine', 'admin'] as const;
  const modes = ['light', 'dark'] as const;
  const densities = ['comfy', 'compact'] as const;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/ui-kit/components', {
      waitUntil: 'networkidle',
    });
  });

  // Test combinaisons thème × mode × densité
  for (const theme of themes) {
    for (const mode of modes) {
      for (const density of densities) {
        test(`should match snapshot: ${theme}-${mode}-${density}`, async ({ page }) => {
          // Configurer le thème
          const currentTheme = await page.getAttribute('[data-testid="theme-switcher"]', 'data-theme');
          if (currentTheme !== theme) {
            await page.click('[data-testid="theme-switcher"]');
            await page.waitForTimeout(300);
          }

          // Configurer le mode
          const currentMode = await page.getAttribute('[data-testid="mode-switcher"]', 'data-mode');
          if (currentMode !== mode) {
            await page.click('[data-testid="mode-switcher"]');
            await page.waitForTimeout(300);
          }

          // Configurer la densité
          const currentDensity = await page.getAttribute('[data-testid="density-switcher"]', 'data-density');
          if (currentDensity !== density) {
            await page.click('[data-testid="density-switcher"]');
            await page.waitForTimeout(300);
          }

          // Prendre le screenshot
          await expect(page).toHaveScreenshot(`ui-kit-${theme}-${mode}-${density}.png`, {
            fullPage: true,
            animations: 'disabled',
          });
        });
      }
    }
  }

  // Tests de composants individuels
  test('Button variants snapshot', async ({ page }) => {
    const buttonSection = page.locator('section').filter({ hasText: 'Intent variants' });
    await expect(buttonSection).toHaveScreenshot('buttons-variants.png');
  });

  test('Input variants snapshot', async ({ page }) => {
    const inputSection = page.locator('section').filter({ hasText: 'State variants' });
    await expect(inputSection).toHaveScreenshot('inputs-variants.png');
  });

  test('ProductCard variants snapshot', async ({ page }) => {
    const productSection = page.locator('section').filter({ hasText: 'ProductCard' });
    await expect(productSection).toHaveScreenshot('productcards-variants.png');
  });

  test('Dialog snapshot', async ({ page }) => {
    // Ouvrir le dialog
    await page.click('button:has-text("Ouvrir Dialog")');
    await page.waitForTimeout(500);

    // Screenshot du dialog ouvert
    await expect(page).toHaveScreenshot('dialog-open.png', {
      animations: 'disabled',
    });

    // Fermer le dialog
    await page.keyboard.press('Escape');
  });

  test('Focus states snapshot', async ({ page }) => {
    // Tester les états focus sur différents composants
    const firstButton = page.locator('button').first();
    await firstButton.focus();
    await expect(firstButton).toHaveScreenshot('button-focus-state.png');
  });

  test('Hover states snapshot', async ({ page }) => {
    // Tester les états hover
    const firstButton = page.locator('button').first();
    await firstButton.hover();
    await expect(firstButton).toHaveScreenshot('button-hover-state.png');
  });

  test('Disabled states snapshot', async ({ page }) => {
    const disabledSection = page.locator('section').filter({ hasText: 'Disabled state' });
    await expect(disabledSection).toHaveScreenshot('disabled-states.png');
  });

  // Test responsive breakpoints
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`should match snapshot on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`ui-kit-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
