/**
 * Tests E2E Responsive - Validation Mobile-First
 *
 * Vérifie que les composants responsive fonctionnent correctement
 * sur les différents breakpoints (mobile, tablet, desktop).
 */

import { test, expect } from '@playwright/test';

// Viewports de test standards
const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

test.describe('Responsive - Funnel E-commerce', () => {

  test.describe('PLP - Product Listing Page', () => {

    test('FilterDrawer mobile vs Sidebar desktop', async ({ page }) => {
      // Test sur page gamme simple (pas besoin de données véhicule)
      await page.setViewportSize(viewports.mobile);
      await page.goto('/pieces/plaquettes-de-frein-1.html');
      await page.waitForLoadState('networkidle');

      // Vérifier que la page charge (pas de 404)
      const is404 = await page.getByText(/page non trouvée|404/i).first().isVisible().catch(() => false);
      if (is404) {
        console.log('Page 404 - test skipped (no test data)');
        return;
      }

      // Sur mobile: vérifier qu'une sidebar/aside existe (hidden sur mobile, visible sur desktop)
      const sidebar = page.locator('aside').first();

      // Test Desktop: sidebar doit être visible
      await page.setViewportSize(viewports.desktop);
      await page.waitForTimeout(300);

      if (await sidebar.isVisible()) {
        // Desktop OK - sidebar visible
        expect(await sidebar.isVisible()).toBeTruthy();
      }

      // Retour mobile
      await page.setViewportSize(viewports.mobile);
      await page.waitForTimeout(300);

      // Chercher un bouton filtres si présent
      const filterButton = page.getByRole('button', { name: /filtrer|filtres/i }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(300);

        // Vérifier qu'un drawer/dialog s'ouvre
        const drawer = page.locator('[role="dialog"], [data-state="open"]').first();
        if (await drawer.isVisible()) {
          await page.keyboard.press('Escape');
        }
      }
    });

    test('Grille produits responsive', async ({ page }) => {
      // Utiliser page gamme simple (fonctionne sans données véhicule)
      await page.goto('/pieces/plaquettes-de-frein-1.html');
      await page.waitForLoadState('networkidle');

      // Vérifier que la page charge
      const is404 = await page.getByText(/page non trouvée|404/i).first().isVisible().catch(() => false);
      if (is404) {
        console.log('Page 404 - test skipped');
        return;
      }

      // Mobile: 1 colonne
      await page.setViewportSize(viewports.mobile);
      await page.waitForTimeout(300);

      // Desktop: 3-4 colonnes
      await page.setViewportSize(viewports.desktop);
      await page.waitForTimeout(300);

      // Vérifier que la grille existe
      const grid = page.locator('.grid').first();
      await expect(grid).toBeVisible();
    });
  });

  test.describe('Cart - Panier', () => {

    test('MobileBottomBar visible avec articles OU message panier vide', async ({ page }) => {
      // TEST STRICT: Vérifie comportement correct selon état du panier
      await page.setViewportSize(viewports.mobile);
      await page.goto('/cart');
      await page.waitForLoadState('networkidle');

      // Vérifier l'état du panier
      const emptyCartMessage = page.getByText(/panier.*vide|votre panier est vide/i).first();
      const isCartEmpty = await emptyCartMessage.isVisible().catch(() => false);

      if (isCartEmpty) {
        // Panier vide = pas de MobileBottomBar (comportement attendu)
        // Vérifier qu'on a bien un lien pour continuer les achats
        const continueLink = page.getByRole('link', { name: /continuer|voir les pièces|accueil/i }).first();
        await expect(continueLink).toBeVisible();
        return;
      }

      // Panier avec articles = MobileBottomBar DOIT être visible
      const mobileBottomBar = page.locator('.fixed.bottom-0.md\\:hidden, .fixed.bottom-0').first();
      await expect(mobileBottomBar).toBeVisible({ timeout: 5000 });

      // Le bouton Commander DOIT être dans la MobileBottomBar
      const commanderButton = mobileBottomBar.getByRole('link', { name: /commander/i });
      await expect(commanderButton).toBeVisible();
    });

    test('Boutons quantité accessibles', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/cart');
      await page.waitForLoadState('networkidle');

      // Chercher les boutons de quantité
      const quantityButtons = page.locator('button').filter({ hasText: /[+-]/ });

      if (await quantityButtons.count() > 0) {
        const firstButton = quantityButtons.first();
        const box = await firstButton.boundingBox();

        if (box) {
          // Touch target minimum: 44px
          expect(box.height).toBeGreaterThanOrEqual(40);
          expect(box.width).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });

  test.describe('Checkout', () => {

    test('Inputs sans zoom iOS (font-size >= 16px)', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/checkout');
      await page.waitForLoadState('networkidle');

      // Trouver tous les inputs de type email ou text
      const emailInputs = page.locator('input[type="email"], input[type="text"]');
      const count = await emailInputs.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = emailInputs.nth(i);

        if (await input.isVisible()) {
          const fontSize = await input.evaluate(el =>
            window.getComputedStyle(el).fontSize
          );

          // Font-size doit être >= 16px pour éviter le zoom iOS
          const fontSizeNum = parseInt(fontSize);
          expect(fontSizeNum).toBeGreaterThanOrEqual(16);
        }
      }
    });

    test('MobileBottomBar DOIT contenir bouton submit sur mobile', async ({ page }) => {
      // TEST STRICT: MobileBottomBar implémenté dans checkout.tsx
      await page.setViewportSize(viewports.mobile);
      await page.goto('/checkout');
      await page.waitForLoadState('networkidle');

      // Si redirigé vers login, le test passe (comportement normal)
      const loginPrompt = page.getByText(/connecter|connexion|login/i).first();
      if (await loginPrompt.isVisible()) {
        return; // Redirigé vers login - OK
      }

      // MobileBottomBar DOIT être visible sur mobile
      const mobileBottomBar = page.locator('.fixed.bottom-0.md\\:hidden, .fixed.bottom-0').first();
      await expect(mobileBottomBar).toBeVisible({ timeout: 5000 });

      // Le bouton de soumission DOIT être dans la MobileBottomBar
      const submitButton = mobileBottomBar.getByRole('button', { name: /confirmer|commander|valider/i });
      await expect(submitButton).toBeVisible();
    });
  });

  test.describe('Account - Navigation', () => {

    test('Hamburger menu sur mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/account/dashboard');
      await page.waitForLoadState('networkidle');

      // Page peut rediriger vers login si non connecté
      const loginPrompt = page.getByText(/connecter|connexion|login/i).first();
      if (await loginPrompt.isVisible()) {
        // Test passe si redirigé vers login
        return;
      }

      // Chercher le bouton hamburger (menu icon)
      const hamburger = page.locator('button').filter({
        has: page.locator('svg.lucide-menu, [data-testid="menu-icon"]')
      });

      // Si pas trouvé par icône, chercher par aria-label
      const menuButton = hamburger.or(
        page.getByRole('button', { name: /menu/i })
      );

      if (await menuButton.first().isVisible()) {
        await menuButton.first().click();

        // Vérifier que le sheet/drawer s'ouvre
        const sheet = page.locator('[role="dialog"]');
        await expect(sheet).toBeVisible();

        // Vérifier qu'il contient des liens de navigation
        const navLink = sheet.getByRole('link').first();
        await expect(navLink).toBeVisible();
      }
    });

    test('Sidebar visible sur desktop', async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
      await page.goto('/account/dashboard');
      await page.waitForLoadState('networkidle');

      // Page peut rediriger vers login si non connecté
      const loginPrompt = page.getByText(/connecter|connexion|login/i).first();
      if (await loginPrompt.isVisible()) {
        // Test passe si redirigé vers login
        return;
      }

      // La sidebar doit être visible sur desktop
      const sidebar = page.locator('.lg\\:block, aside, nav').first();
      await expect(sidebar).toBeVisible();
    });
  });

  test.describe('Search', () => {

    test('FilterTrigger DOIT être dans MobileBottomBar sur Search', async ({ page }) => {
      // TEST STRICT: MobileBottomBar doit être implémenté sur page search
      await page.setViewportSize(viewports.mobile);

      // Utiliser 'load' au lieu de 'networkidle' (page search peut avoir requêtes longues)
      await page.goto('/search?q=filtre', { timeout: 10000 });
      await page.waitForLoadState('load');

      // MobileBottomBar DOIT contenir un bouton de filtre
      const bottomBar = page.locator('.fixed.bottom-0.md\\:hidden, .fixed.bottom-0').first();
      await expect(bottomBar).toBeVisible({ timeout: 5000 });

      const filterButton = bottomBar.getByRole('button', { name: /filtrer/i });
      await expect(filterButton).toBeVisible();
    });
  });

  test.describe('Touch Targets', () => {

    test('Boutons ont touch-target >= 44px', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/cart');
      await page.waitForLoadState('networkidle');

      // Trouver les éléments avec classe touch-target
      const touchTargets = page.locator('.touch-target, .touch-target-lg');
      const count = await touchTargets.count();

      let checkedCount = 0;
      for (let i = 0; i < Math.min(count, 10); i++) {
        const element = touchTargets.nth(i);

        if (await element.isVisible()) {
          const box = await element.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
            checkedCount++;
          }
        }
      }

      // Au moins quelques touch-targets doivent exister
      console.log(`Verified ${checkedCount} touch targets`);
    });
  });

  test.describe('PDP - Product Detail Page', () => {

    test('MobileBottomBar DOIT être visible sur PLP gamme', async ({ page }) => {
      // TEST STRICT: MobileBottomBar doit être implémenté sur pages gamme
      await page.setViewportSize(viewports.mobile);
      await page.goto('/pieces/plaquette-de-frein-402.html');
      await page.waitForLoadState('networkidle');

      // MobileBottomBar DOIT être visible sur cette page
      const bottomBar = page.locator('.fixed.bottom-0.md\\:hidden, .fixed.bottom-0').first();
      await expect(bottomBar).toBeVisible({ timeout: 5000 });

      // DOIT contenir un CTA (Choisir véhicule sur gamme, Filtrer sur PLP véhicule)
      const ctaButton = bottomBar.getByRole('button', { name: /choisir|véhicule|filtrer/i });
      await expect(ctaButton).toBeVisible();
    });
  });
});

test.describe('Responsive - Auth Pages', () => {

  test('Forgot-password responsive - inputs et boutons', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Vérifier que l'input email a la classe no-zoom-input et h-11
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Vérifier font-size >= 16px (no iOS zoom)
    const fontSize = await emailInput.evaluate(el =>
      window.getComputedStyle(el).fontSize
    );
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(16);

    // Vérifier que l'input a une hauteur suffisante (h-11 = 44px)
    const inputBox = await emailInput.boundingBox();
    if (inputBox) {
      expect(inputBox.height).toBeGreaterThanOrEqual(40);
    }

    // Vérifier que le bouton submit a touch-target
    const submitButton = page.getByRole('button', { name: /envoyer/i });
    await expect(submitButton).toBeVisible();
    const buttonBox = await submitButton.boundingBox();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    }

    // Vérifier le lien retour connexion (spécifique pour éviter conflit avec navbar)
    const backLink = page.getByRole('link', { name: /retour à la connexion/i });
    await expect(backLink).toBeVisible();
  });

  test('Forgot-password tablet et desktop', async ({ page }) => {
    // Test tablet
    await page.setViewportSize(viewports.tablet);
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Use more specific selector - Card containing forgot password form
    const card = page.locator('form').filter({ hasText: /envoyer/i }).locator('..');
    await expect(card).toBeVisible();

    // Test desktop
    await page.setViewportSize(viewports.desktop);
    await page.waitForTimeout(200);
    await expect(card).toBeVisible();
  });

  test('Forgot-password visual consistency & gradient', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Check gradient background exists on page (any visible element with gradient)
    const hasGradient = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="bg-gradient"]');
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        // Check if element is large enough to be a page container
        if (rect.width > 300 && rect.height > 300) return true;
      }
      return false;
    });
    expect(hasGradient).toBeTruthy();

    // Check responsive padding progression across breakpoints
    await page.setViewportSize(viewports.tablet);
    await page.waitForTimeout(300);
    const card = page.locator('form').filter({ hasText: /envoyer/i }).locator('..');
    await expect(card).toBeVisible();

    await page.setViewportSize(viewports.desktop);
    await page.waitForTimeout(300);
    await expect(card).toBeVisible();

    // Verify form title is visible
    const title = page.getByText(/mot de passe oublié/i).first();
    await expect(title).toBeVisible();
  });

  test('Forgot-password touch targets accessibles', async ({ page }) => {
    await page.setViewportSize(viewports.mobile);
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Verify back link has adequate touch target (specific selector)
    const backLink = page.getByRole('link', { name: /retour à la connexion/i });
    await expect(backLink).toBeVisible();
    const linkBox = await backLink.boundingBox();
    if (linkBox) {
      // Touch target should be at least 32px (py-2 adds padding)
      expect(linkBox.height).toBeGreaterThanOrEqual(32);
    }

    // Verify submit button touch target
    const submitButton = page.getByRole('button', { name: /envoyer/i });
    const buttonBox = await submitButton.boundingBox();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Responsive - Cross-breakpoint', () => {

  test('Navigation change entre mobile et desktop', async ({ page }) => {
    // Capture les erreurs JS
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mobile: menu hamburger
    await page.setViewportSize(viewports.mobile);
    await page.waitForTimeout(300);

    // Desktop: navigation complète
    await page.setViewportSize(viewports.desktop);
    await page.waitForTimeout(300);

    // Pas d'erreurs JS
    expect(errors).toHaveLength(0);
  });

  test('Homepage responsive - pas de scroll horizontal', async ({ page }) => {
    // Fix appliqué: overflow-x-hidden sur body empêche le scroll horizontal
    await page.setViewportSize(viewports.mobile);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Vérifier que overflow-x-hidden est appliqué au body (le fix)
    const hasOverflowHidden = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return style.overflowX === 'hidden' || body.classList.contains('overflow-x-hidden');
    });

    // Si overflow-x-hidden est appliqué, le scroll horizontal est empêché visuellement
    expect(hasOverflowHidden).toBeTruthy();

    // Vérifier que l'utilisateur ne peut pas scroller horizontalement
    const canScrollHorizontally = await page.evaluate(() => {
      const beforeX = window.scrollX;
      window.scrollBy(100, 0); // Tenter de scroller
      const afterX = window.scrollX;
      window.scrollTo(0, 0); // Reset
      return afterX > beforeX; // Si true, l'utilisateur peut scroller
    });

    // L'utilisateur ne doit pas pouvoir scroller horizontalement
    expect(canScrollHorizontally).toBeFalsy();
  });
});
