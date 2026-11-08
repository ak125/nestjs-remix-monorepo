/**
 * Parcours commerce strict : recherche → ajout au panier → ligne au panier.
 *
 * À lancer sur DEV (service role, panier dans le Redis local) :
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/commerce-journey.spec.ts --project=chromium
 *
 * Aucun repli : zéro résultat, ajout refusé ou panier vide font échouer le
 * test. Il ne passe donc pas sur PREPROD (READ_ONLY, clé anon sans SELECT sur
 * le catalogue) et n'est pas branché sur la chaîne PREPROD. Jamais contre la
 * PROD : il écrit un panier, d'où le saut hors localhost ci-dessous.
 */

import { type Page, type Request } from '@playwright/test';
import { test, expect } from './fixtures';

const SEARCH_TERM = 'plaquette';
const ADD_TO_CART = /^Ajouter (.+) au panier$/;

const viewports = {
  iphone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

async function searchFromHeader(page: Page) {
  await page.goto('/');
  const searchbox = page
    .getByRole('searchbox', { name: 'Rechercher une pièce auto' })
    .filter({ visible: true });
  await searchbox.fill(SEARCH_TERM);
  await searchbox.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${SEARCH_TERM}$`));
}

test.describe('Parcours commerce — recherche → panier', () => {
  test.skip(
    ({ baseURL }) => !baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname),
    'Écrit un panier : DEV local uniquement (PLAYWRIGHT_BASE_URL sur localhost)',
  );

  for (const [name, size] of Object.entries(viewports)) {
    test(`[${name}] la pièce ajoutée apparaît au panier`, async ({ page }) => {
      await page.setViewportSize(size);
      await searchFromHeader(page);

      const addButton = page.getByRole('button', { name: ADD_TO_CART }).first();
      await expect(addButton).toBeVisible({ timeout: 20_000 });
      const pieceName = ADD_TO_CART.exec((await addButton.getAttribute('aria-label')) ?? '')?.[1];
      expect(pieceName, 'libellé de la pièce lu sur le bouton').toBeTruthy();

      // Avant l'hydratation, le clic n'émet rien : on le réessaie tant que la
      // requête d'ajout n'est pas partie (une seule requête au final).
      let addRequest: Request | undefined;
      await expect(async () => {
        [addRequest] = await Promise.all([
          page.waitForRequest(
            (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/cart/items',
            { timeout: 3_000 },
          ),
          addButton.click(),
        ]);
      }).toPass({ timeout: 20_000 });
      const added = await addRequest!.response();
      expect(added?.ok(), `POST /api/cart/items → ${added?.status()}`).toBe(true);

      await page.goto('/cart');
      const main = page.locator('main');
      await expect(main).toContainText(pieceName!);
      await expect(main).not.toContainText(/panier est vide/i);
    });
  }
});
