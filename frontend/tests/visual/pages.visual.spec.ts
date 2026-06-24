import { test, expect } from "@playwright/test";

/**
 * Régression visuelle — fige la STRUCTURE / cascade CSS du build courant (Vite 7) pour la
 * comparer après la migration Vite 8 / Rolldown (V8-1). Le changement de bundler peut altérer
 * l'émission et l'ordre des CSS (FOUC, ordre de cascade) sans casser typecheck/build/size-limit
 * (qui ne comptent que les octets). Ce gate capture ce que les autres ne voient pas.
 *
 * DÉTERMINISME (obligatoire) : ces tests DOIVENT tourner dans l'image Docker Playwright pinnée
 * `mcr.microsoft.com/playwright:v1.61.0-noble` (= runner CI ubuntu-24.04 / noble). Les générer ou
 * comparer hors de cette image (ex. poste DEV jammy) produit des diffs de rendu de police.
 * Voir `frontend/tests/visual/README.md` + `scripts/visual/run-visual-docker.sh`.
 *
 * Régions data-driven (prix, stock, dispo, dates, images produit) masquées : on fige la mise en
 * page, pas le contenu qui évolue avec la base. URLs réelles vérifiées 200 sur le runtime.
 */

const PAGES = [
  { name: "home", url: "/" },
  { name: "r1-gamme", url: "/pieces/plaquette-de-frein-402.html" },
  {
    name: "r2-vehicule",
    url: "/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-77310.html",
  },
] as const;

// Régions dynamiques masquées (insensible à la casse). Affiner si une capture reste instable.
const DYNAMIC_MASK = [
  '[class*="price" i]',
  '[class*="prix" i]',
  '[class*="stock" i]',
  '[class*="dispo" i]',
  '[data-testid*="price" i]',
  "time",
  "img",
];

test.describe("Régression visuelle CSS (baseline bundler)", () => {
  for (const p of PAGES) {
    test(p.name, async ({ page }) => {
      await page.goto(p.url, { waitUntil: "networkidle" });
      // Stabiliser : polices chargées + court settle pour layout final.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`${p.name}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.02,
        mask: DYNAMIC_MASK.map((s) => page.locator(s)),
      });
    });
  }
});
