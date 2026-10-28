/**
 * Tests E2E Parcours Critique - QA Automatisé Pré-Déploiement
 *
 * Valide le parcours utilisateur critique sur 6 viewports:
 * 1. Menu → Catégorie
 * 2. Recherche → Fiche produit
 * 3. Ajout panier → Vérification
 * 4. Filtres → Résultats
 * 5. Navigation retour
 * 6. Changement orientation
 * 7. Checklist qualité visuelle
 *
 * Temps d'exécution: ~2min par viewport
 */

import { type Page } from '@playwright/test';
import { test, expect } from './fixtures';

// 6 Viewports couvrant 98%+ du trafic réel
const viewports = {
  iphoneSE: { width: 320, height: 568 },   // Crash test - overflow detection
  android: { width: 360, height: 800 },     // Android courant (~40%)
  iphone: { width: 390, height: 844 },      // iPhone 12-14 (~25%)
  ipad: { width: 768, height: 1024 },       // iPad portrait (~10%)
  laptop: { width: 1280, height: 720 },     // Petit laptop (~10%)
  desktop: { width: 1440, height: 900 },    // Desktop standard (~15%)
};

// Viewports prioritaires pour tests rapides
const priorityViewports = ['android', 'iphone', 'desktop'] as const;

// Helper: vérifier si mobile
function isMobile(width: number): boolean {
  return width < 768;
}

// R1 de gamme servie en 200 (aussi vérifiée par url-validation.spec.ts).
const R1_GAMME = '/pieces/plaquette-de-frein-402.html';
// R2 de la fixture « plaquettes-402-x-57414 » (scripts/ci/r2-golden.json) : ses pièces
// et ses côtés Avant/Arrière sont vérifiés sur PREPROD par l'étape bloquante « R2 golden »
// du job Deploy PREPROD, avant ce job.
const R2_GOLDEN = '/pieces/plaquette-de-frein-402/chevrolet-44/cruze-iii-j305-44088/1-6-57414.html';
const PIECE_CARD = /^Voir .+ —/;

// Helper: page servie telle quelle (200, sans redirection). L'ancienne URL
// /pieces/plaquettes-de-frein-1.html redirigeait vers une autre gamme, et le
// test vérifiait la mauvaise page sans le voir.
async function gotoServed(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(path);
}

// ============================================
// TEST 1: Menu → Catégorie
// ============================================
test.describe('1. Menu → Catégorie', () => {
  for (const [name, size] of Object.entries(viewports)) {
    test(`[${name}] Navigation menu vers catégorie`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.waitForLoadState('load');

      // Jusqu'à 768 px, le lien est dans le dialogue « Menu » ; au-delà, dans
      // la barre. Avant l'hydratation, le clic sur « Menu » est perdu : on le
      // rejoue tant que le dialogue n'est pas ouvert.
      const menuButton = page.getByRole('button', { name: 'Menu', exact: true });
      if (await menuButton.isVisible()) {
        const menu = page.getByRole('dialog', { name: 'Menu de navigation' });
        await expect(async () => {
          if (!(await menu.isVisible())) await menuButton.click({ timeout: 2000 });
          await expect(menu).toBeVisible({ timeout: 1000 });
        }).toPass();
        await menu.getByRole('link', { name: 'Catalogue pièces auto' }).click();
        await expect(menu).toBeHidden();
      } else {
        await page
          .getByRole('navigation', { name: 'Navigation principale' })
          .getByRole('link', { name: 'Catalogue pièces auto' })
          .click();
      }

      await page.locator('#catalogue').getByRole('link', { name: 'Plaquette de frein', exact: true }).click();
      await expect(page).toHaveURL(/\/pieces\/plaquette-de-frein-402\.html$/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/plaquette/i);
    });
  }
});

// ============================================
// TEST 2: Recherche de l'en-tête → /search?q=
// ============================================
// Le formulaire mène à /search?q= avec ou sans JS : avant l'hydratation, la
// soumission est native. Le nombre de résultats est seulement journalisé :
// PREPROD tourne en READ_ONLY avec la clé anon (ADR-028 option D), qui n'a
// pas SELECT sur les tables du catalogue. Le parcours strict recherche →
// panier est dans commerce-journey.spec.ts, sur DEV.
const SEARCH_TERM = 'plaquette';

async function submitHeaderSearch(page: Page) {
  const searchbox = page
    .getByRole('searchbox', { name: 'Rechercher une pièce auto' })
    .filter({ visible: true });
  await expect(searchbox).toHaveCount(1);
  await searchbox.fill(SEARCH_TERM);
  await searchbox.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${SEARCH_TERM}$`));
}

test.describe('2. Recherche en-tête → /search?q=', () => {
  for (const name of priorityViewports) {
    const size = viewports[name];

    test(`[${name}] Recherche soumise vers /search?q=`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.waitForLoadState('load');

      await submitHeaderSearch(page);

      const results = await page.getByRole('button', { name: /^Ajouter .+ au panier$/ }).count();
      console.log(`[${name}] ${results} résultat(s) pour "${SEARCH_TERM}"`);
    });
  }

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    for (const name of priorityViewports) {
      const size = viewports[name];

      test(`[${name}] Soumission native vers /search?q=`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto('/');

        await submitHeaderSearch(page);
      });
    }
  });
});

// ============================================
// TEST 3: Ajout panier → Vérification
// ============================================
// Non prouvable sur PREPROD : la recherche et l'ajout lisent le catalogue,
// illisible par la clé anon (cf. TEST 2). L'ancien test passait sans rien
// vérifier. Preuve stricte : commerce-journey.spec.ts, sur DEV.
test.describe('3. Ajout panier', () => {
  test('Ajouter au panier et vérifier', () => {
    test.skip(true, 'catalogue illisible en READ_ONLY anon — preuve : commerce-journey.spec.ts sur DEV');
  });
});

// ============================================
// TEST 4: Filtres → Résultats
// ============================================
test.describe('4. Filtres', () => {
  for (const name of priorityViewports) {
    const size = viewports[name];

    test(`[${name}] Appliquer filtre`, async ({ page }) => {
      await page.setViewportSize(size);
      await gotoServed(page, R2_GOLDEN);

      const counter = page.getByText(/^\d+\s*résultats?$/).filter({ visible: true });
      const resultCount = async () => Number((await counter.innerText()).match(/\d+/)?.[0]);

      // Mobile : les filtres s'ouvrent par « Filtrer » (le bouton devient
      // « Masquer filtres »), clic rejoué tant que l'hydratation n'est pas faite.
      if (isMobile(size.width)) {
        await expect(async () => {
          if (!(await counter.isVisible())) {
            await page.getByRole('button', { name: 'Filtrer', exact: true }).click({ timeout: 2000 });
          }
          await expect(counter).toBeVisible({ timeout: 1000 });
        }).toPass();
      }

      const before = await resultCount();
      expect(before).toBeGreaterThan(0);

      // « Avant » fixe le côté : rejouer le clic ne change rien une fois appliqué.
      const beforeText = await counter.innerText();
      await expect(async () => {
        await page.getByRole('button', { name: 'Avant', exact: true }).filter({ visible: true }).click({ timeout: 2000 });
        await expect(counter).not.toHaveText(beforeText, { timeout: 1000 });
      }).toPass();

      const after = await resultCount();
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThan(before);
      await expect(page.getByRole('button', { name: PIECE_CARD }).filter({ visible: true }).first()).toBeVisible();
    });
  }

  // Avant l'hydratation, BottomNav n'a pas encore mesuré --bottom-nav-height :
  // la barre d'actions doit déjà être au-dessus de lui, sinon l'appui sur
  // « Filtrer » tombe sur le lien « Compte ».
  for (const name of priorityViewports.filter((n) => isMobile(viewports[n].width))) {
    test(`[${name}] « Filtrer » reçoit l'appui avant l'hydratation`, async ({ page }) => {
      await page.setViewportSize(viewports[name]);
      // Scripts externes bloqués : la page reste dans l'état d'avant hydratation.
      await page.route(/\.m?js(\?|$)/, (route) => route.abort());
      await gotoServed(page, R2_GOLDEN);
      await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toBeVisible();

      // trial : vérifications d'action seulement (dont l'élément qui reçoit
      // l'appui), sans cliquer.
      await page.getByRole('button', { name: 'Filtrer', exact: true }).click({ trial: true, timeout: 5000 });
    });
  }
});

// ============================================
// TEST 5: Navigation retour
// ============================================
test.describe('5. Navigation retour', () => {
  test('Navigation retour préserve contexte', async ({ page }) => {
    await page.setViewportSize(viewports.iphone);
    await gotoServed(page, R2_GOLDEN);

    // Ouvrir la fiche d'une pièce (dialogue), clic rejoué avant l'hydratation
    const productCard = page.getByRole('button', { name: PIECE_CARD }).filter({ visible: true }).first();
    const detail = page.getByRole('dialog');
    await expect(async () => {
      if (!(await detail.isVisible())) await productCard.click({ timeout: 2000 });
      await expect(detail).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Fermer la fiche (Escape) : retour au listing
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(productCard).toBeVisible();

    // Naviguer ailleurs puis revenir : même R2, listing restauré
    await page.goto('/');
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === R2_GOLDEN);
    await expect(productCard).toBeVisible();
  });
});

// ============================================
// TEST 6: Changement orientation
// ============================================
test.describe('6. Orientation', () => {
  test('Changement orientation portrait/landscape', async ({ page }) => {
    // Portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoServed(page, R1_GAMME);
    await page.waitForLoadState('load');

    // En portrait, la page doit charger correctement
    const bodyPortrait = await page.locator('body').isVisible();
    expect(bodyPortrait).toBe(true);

    // Landscape (height réduit = h1 peut être hors viewport, c'est OK)
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(500);

    // Vérifier que la page ne plante pas (body visible)
    const bodyLandscape = await page.locator('body').isVisible();
    expect(bodyLandscape).toBe(true);

    // Vérifier pas de scroll horizontal massif visible à l'utilisateur
    const hasVisibleHorizontalScroll = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const htmlOverflow = getComputedStyle(html).overflowX;
      const bodyOverflow = getComputedStyle(body).overflowX;
      // Si overflow hidden, pas de problème
      if (htmlOverflow === 'hidden' || bodyOverflow === 'hidden') return false;
      // Tolérer 50px de différence (scrollbar, etc.)
      return html.scrollWidth > html.clientWidth + 50;
    });
    expect(hasVisibleHorizontalScroll).toBe(false);

    // Retour portrait - vérifier que ça ne casse pas
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const bodyBack = await page.locator('body').isVisible();
    expect(bodyBack).toBe(true);
  });
});

// ============================================
// TEST 7: Checklist qualité visuelle
// ============================================
test.describe('7. Checklist qualité', () => {
  for (const name of ['iphoneSE', 'android', 'desktop'] as const) {
    const size = viewports[name];

    test(`[${name}] Pas de scroll horizontal visible`, async ({ page, browserName }) => {
      // WebKit Playwright: scrollWidth/clientWidth calcul différent sur mobile viewports
      test.skip(browserName === 'webkit', 'WebKit Playwright scroll detection false positive');

      await page.setViewportSize(size);
      await gotoServed(page, R1_GAMME);
      await page.waitForLoadState('load');

      // Vérifier que la scrollbar horizontale n'est pas visible à l'utilisateur
      // (overflow: hidden est OK, seul le scroll visible compte)
      const hasVisibleHorizontalScroll = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;

        // Vérifier si la page peut réellement scroller horizontalement
        const canScrollX = html.scrollWidth > html.clientWidth ||
                          body.scrollWidth > body.clientWidth;

        // Vérifier si le scroll est bloqué par overflow: hidden
        const htmlOverflow = getComputedStyle(html).overflowX;
        const bodyOverflow = getComputedStyle(body).overflowX;

        // Si overflow est hidden, pas de problème même si le contenu dépasse
        if (htmlOverflow === 'hidden' || bodyOverflow === 'hidden') {
          return false;
        }

        return canScrollX;
      });

      // On tolère un petit scroll (scrollbars, etc.)
      // L'important est qu'il n'y ait pas de scroll massif visible
      expect(hasVisibleHorizontalScroll).toBe(false);
    });

    test(`[${name}] Texte lisible (font >= 14px)`, async ({ page }) => {
      await page.setViewportSize(size);
      await gotoServed(page, R1_GAMME);
      await page.waitForLoadState('load');

      const bodyFontSize = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.body).fontSize)
      );

      expect(bodyFontSize).toBeGreaterThanOrEqual(14);
    });

    test(`[${name}] Images chargées correctement`, async ({ page }) => {
      await page.setViewportSize(size);
      await gotoServed(page, R1_GAMME);
      await page.waitForLoadState('load');

      // Attendre que les images lazy-load
      await page.waitForTimeout(1000);

      const brokenImages = await page.evaluate(() => {
        const images = Array.from(document.images);
        return images.filter(img => {
          // Ignorer images avec data: ou blob:
          if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return false;
          // Ignorer images très petites (icônes SVG inline)
          if (img.naturalWidth < 10 && img.naturalHeight < 10) return false;
          return !img.complete || img.naturalWidth === 0;
        }).length;
      });

      expect(brokenImages).toBe(0);
    });
  }
});

// ============================================
// TEST 8: Homepage critique
// ============================================
test.describe('8. Homepage', () => {
  for (const name of priorityViewports) {
    const size = viewports[name];

    test(`[${name}] Homepage charge correctement`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.waitForLoadState('load');

      // Vérifier éléments critiques
      await expect(page.locator('body')).toBeVisible();

      // Logo ou header présent
      const hasHeader = await page.locator('header, nav, [role="banner"]').first().isVisible().catch(() => false);
      expect(hasHeader).toBe(true);

      // Pas d'erreur JavaScript visible
      const jsError = await page.locator('text=/error|exception|undefined/i').first().isVisible({ timeout: 1000 }).catch(() => false);
      expect(jsError).toBe(false);
    });
  }
});
