import { test, expect } from '@playwright/test';

/**
 * Tests E2E : NavbarMobile (Phase 2)
 * 
 * Fonctionnalités testées :
 * - Burger menu open/close
 * - Animation slide-in (transform translateX)
 * - Scroll lock sur body
 * - Navigation responsive desktop/mobile
 * - Liens accessibles et visibles
 * - Backdrop overlay
 */

test.describe('NavbarMobile - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('devrait afficher la navigation desktop sur grand écran', async ({ page }) => {
    // Vérifier que les liens desktop sont visibles
    await expect(page.locator('nav').first()).toBeVisible();
    
    // Vérifier que le burger menu n'est PAS visible (hidden sur desktop)
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await expect(burgerButton).toHaveCSS('display', 'none');
  });

  test('devrait contenir tous les liens de navigation principaux', async ({ page }) => {
    // Vérifier présence des liens
    await expect(page.getByRole('link', { name: /accueil/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /catalogue/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /recherche vin/i })).toBeVisible();
  });
});

test.describe('NavbarMobile - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('devrait afficher le burger menu sur mobile', async ({ page }) => {
    // Vérifier que le burger menu est visible
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await expect(burgerButton).toBeVisible();
    
    // Vérifier que le burger a 3 barres (icône hamburger)
    const burgerIcon = burgerButton.locator('svg');
    await expect(burgerIcon).toBeVisible();
  });

  test('devrait ouvrir le menu mobile au clic sur burger', async ({ page }) => {
    // Cliquer sur le burger menu
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await burgerButton.click();
    
    // Attendre l'animation (300ms transition)
    await page.waitForTimeout(350);
    
    // Vérifier que le menu est ouvert (translateX(0))
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(
      page.locator('nav').filter({ hasText: /Accueil.*Catalogue/s })
    ).first();
    
    await expect(mobileMenu).toBeVisible();
    
    // Vérifier que les liens sont visibles
    await expect(page.getByRole('link', { name: /accueil/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /catalogue/i })).toBeVisible();
  });

  test('devrait fermer le menu au clic sur backdrop', async ({ page }) => {
    // Ouvrir le menu
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await burgerButton.click();
    await page.waitForTimeout(350);
    
    // Cliquer sur le backdrop (overlay)
    const backdrop = page.locator('[data-testid="mobile-menu-backdrop"]').or(
      page.locator('div[class*="fixed"][class*="inset-0"][class*="bg-black"]').first()
    );
    
    await backdrop.click({ position: { x: 10, y: 10 } }); // Clic dans le coin pour éviter le menu
    
    // Attendre la fermeture
    await page.waitForTimeout(350);
    
    // Vérifier que le menu n'est plus visible
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').first();
    await expect(mobileMenu).not.toBeVisible();
  });

  test('devrait fermer le menu au clic sur bouton fermer (X)', async ({ page }) => {
    // Ouvrir le menu
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await burgerButton.click();
    await page.waitForTimeout(350);
    
    // Cliquer sur le bouton fermer
    const closeButton = page.locator('button[aria-label*="fermer"]').or(
      page.locator('button').filter({ has: page.locator('svg') }).last()
    );
    
    await closeButton.click();
    await page.waitForTimeout(350);
    
    // Vérifier que le menu est fermé
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').first();
    await expect(mobileMenu).not.toBeVisible();
  });

  test('devrait bloquer le scroll du body quand menu ouvert', async ({ page }) => {
    // Scroll initial possible
    await page.evaluate(() => window.scrollTo(0, 100));
    let scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    
    // Ouvrir le menu
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await burgerButton.click();
    await page.waitForTimeout(350);
    
    // Vérifier que body a overflow: hidden ou position: fixed
    const bodyOverflow = await page.locator('body').evaluate((el) => 
      window.getComputedStyle(el).overflow
    );
    
    const bodyPosition = await page.locator('body').evaluate((el) => 
      window.getComputedStyle(el).position
    );
    
    // Au moins l'une de ces conditions doit être vraie
    expect(
      bodyOverflow === 'hidden' || bodyPosition === 'fixed'
    ).toBeTruthy();
  });

  test('devrait permettre navigation et fermer menu après clic lien', async ({ page }) => {
    // Ouvrir le menu
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await burgerButton.click();
    await page.waitForTimeout(350);
    
    // Cliquer sur un lien
    const catalogueLink = page.getByRole('link', { name: /catalogue/i }).first();
    await catalogueLink.click();
    
    // Attendre navigation
    await page.waitForURL(/\/catalogue/, { timeout: 5000 });
    
    // Vérifier que le menu s'est fermé automatiquement
    await page.waitForTimeout(350);
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').first();
    await expect(mobileMenu).not.toBeVisible();
  });
});

test.describe('NavbarMobile - Responsive Breakpoints', () => {
  test('devrait passer de desktop à mobile à 768px', async ({ page }) => {
    await page.goto('/');
    
    // Desktop : 1024px
    await page.setViewportSize({ width: 1024, height: 768 });
    const burgerDesktop = page.locator('button[aria-label*="menu"]').first();
    await expect(burgerDesktop).toHaveCSS('display', 'none');
    
    // Mobile : 767px
    await page.setViewportSize({ width: 767, height: 768 });
    await expect(burgerDesktop).toBeVisible();
  });

  test('devrait gérer le resize pendant que menu est ouvert', async ({ page }) => {
    // Démarrer en mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Ouvrir menu
    const burgerButton = page.locator('button[aria-label*="menu"]').first();
    await burgerButton.click();
    await page.waitForTimeout(350);
    
    // Resize vers desktop
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(350);
    
    // Menu devrait se fermer automatiquement (ou être hidden)
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').first();
    const isVisible = await mobileMenu.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});
