import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

/**
 * Tests d'accessibilité automatisés pour l'UI-Kit
 * 
 * Ces tests utilisent axe-core pour détecter les violations WCAG 2.1 AA/AAA.
 * Les erreurs critiques font échouer le build CI.
 * 
 * Coverage:
 * - Tous les composants (Button, Input, Dialog, ProductCard)
 * - Toutes les variantes de thème (vitrine/admin)
 * - Tous les modes (light/dark)
 * - Toutes les densités (comfy/compact)
 */

test.describe('UI-Kit Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Attendre que la page soit complètement chargée
    await page.goto('http://localhost:3000/ui-kit/components', {
      waitUntil: 'networkidle',
    });
  });

  test('should not have any automatically detectable accessibility issues (default theme)', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues in dark mode', async ({ page }) => {
    // Basculer en dark mode
    await page.click('[data-testid="mode-switcher"]');
    await page.waitForTimeout(500); // Attendre l'animation

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues with admin theme', async ({ page }) => {
    // Basculer vers thème admin
    await page.click('[data-testid="theme-switcher"]');
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues with compact density', async ({ page }) => {
    // Basculer vers density compact
    await page.click('[data-testid="density-switcher"]');
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues in all dialogs', async ({ page }) => {
    // Ouvrir tous les dialogs et scanner
    const dialogButtons = await page.locator('button:has-text("Ouvrir Dialog")').all();
    
    for (const button of dialogButtons) {
      await button.click();
      await page.waitForTimeout(300);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);

      // Fermer le dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  test('should have proper focus indicators', async ({ page }) => {
    // Tester que tous les boutons ont un focus visible
    const buttons = await page.locator('button').all();
    
    for (const button of buttons.slice(0, 5)) { // Tester les 5 premiers
      await button.focus();
      const focusRing = await button.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          boxShadow: styles.boxShadow,
        };
      });

      // Vérifier qu'il y a soit un outline, soit un box-shadow (focus ring)
      const hasFocusIndicator = 
        focusRing.outline !== 'none' || 
        focusRing.boxShadow !== 'none';

      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    // Vérifier que tous les éléments interactifs sans texte ont aria-label
    const interactiveElements = await page.locator('button[size="icon"], input[type="submit"], a:not(:has-text())').all();
    
    for (const element of interactiveElements) {
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledby = await element.getAttribute('aria-labelledby');
      const textContent = await element.textContent();
      const hasText = (textContent?.trim().length ?? 0) > 0;

      const hasAccessibleName = ariaLabel || ariaLabelledby || hasText;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('should have sufficient color contrast (WCAG AA)', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('[data-testid="color-contrast-check"]')
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tester la navigation au clavier (Tab)
    await page.keyboard.press('Tab');
    const firstFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(firstFocusedElement);

    // Tester plusieurs Tab
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['best-practice'])
      .analyze();

    const headingViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'heading-order'
    );

    expect(headingViolations).toEqual([]);
  });
});
