/**
 * Sonde du parcours d'achat (mandat AU, décision 52) — sans jamais payer.
 *
 * accueil → choix du véhicule → page gamme × véhicule → fiche produit →
 * ajout au panier → panier → commande → section paiement, puis nettoyage.
 *
 * Lancement (config dédiée, hors de la suite tests/e2e) :
 *   PURCHASE_PROBE_BASE_URL=http://localhost:3000 PURCHASE_PROBE_BYPASS_TOKEN=<jeton> \
 *     npx playwright test -c frontend/tests/purchase-probe/playwright.config.ts
 *
 * Garanties, vérifiées à chaque passage :
 * - Le robot se déclare robot (décision 36) : agent utilisateur du navigateur
 *   sans tête (« HeadlessChrome », classé bot_other par @repo/cwv-taxonomy) suivi
 *   de « AutoMecanik-PurchaseProbe-bot/1.0 » (motif BOT_UA_PATTERN de root.tsx :
 *   GA4 n'est pas chargé).
 * - Aucune écriture hors liste blanche : toute requête de la page autre que
 *   GET/HEAD/OPTIONS est refusée, sauf l'ajout au panier (Redis) et la
 *   vérification d'e-mail invité (lecture seule). Le formulaire de commande
 *   (POST /checkout → createCheckoutOrder) ne peut donc pas partir, et le bouton
 *   « Payer » n'est jamais cliqué. Les balises de mesure (funnel
 *   /api/seo/funnel/event, RUM, Sentry) sont refusées et comptées.
 * - En-tête de passage Cloudflare (complément n° 2 du mandat EI) : X-AutoMecanik-Probe,
 *   valeur PURCHASE_PROBE_BYPASS_TOKEN, envoyé à la seule origine sondée, jamais
 *   écrit dans le résultat ni le journal (probe-network.ts). Sans la variable, la
 *   sonde ne part pas.
 * - Nettoyage en fin de passage, même après un échec : DELETE /api/cart (supprime
 *   la clé Redis du panier) puis POST /auth/logout (détruit la session).
 *
 * Résultat : un fichier JSON (PURCHASE_PROBE_RESULT) avec la durée et l'issue de
 * chaque étape. Il ne contient que des chemins publics, des durées et des
 * messages d'erreur tronqués ; aucune donnée client (le robot n'en voit aucune).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { apiOptions, guardWrites, readBypassToken, redact, watchRedirectLeaks } from './probe-network';

export const PROBE_UA_TOKEN = 'AutoMecanik-PurchaseProbe-bot/1.0';

/** Étapes, dans l'ordre ; le nom court est celui de l'alerte et du rapport. */
const STEPS = {
  accueil: "Page d'accueil",
  vehicule: 'Choix du véhicule',
  gamme: 'Page gamme × véhicule',
  produit: 'Fiche produit',
  ajout_panier: 'Ajout au panier',
  panier: 'Page panier',
  commande: 'Page commande (livraison)',
  paiement: 'Section paiement (sans payer)',
  nettoyage: 'Nettoyage panier et session',
  fuite_jeton: "Jeton de passage hors de l'origine (redirection)",
} as const;
type StepId = keyof typeof STEPS;

/**
 * Véhicule et gamme du parcours : la référence « golden » de critical-path.spec.ts
 * (Chevrolet Cruze III 1.6, plaquettes de frein). Surchargeables sans toucher au code.
 * Format : marque_id:année:modele_id:type_id.
 */
const VEHICLE = (process.env.PURCHASE_PROBE_VEHICLE ?? '44:2012:44088:57414').split(':');
const GAMME_PREFIX = process.env.PURCHASE_PROBE_GAMME_PREFIX ?? '/pieces/plaquette-de-frein-402/';
const RESULT_PATH = process.env.PURCHASE_PROBE_RESULT ?? 'test-results/purchase-path-probe.json';

/** Jeton de l'en-tête de passage Cloudflare : absent ou mal formé, le chargement échoue ici. */
const BYPASS_TOKEN = readBypassToken();
const API = apiOptions(BYPASS_TOKEN);

const PIECE_CARD = /^Voir .+ —/;
const MAX_CARDS_TRIED = 5;

type StepResult = { step: StepId; label: string; ok: boolean; ms: number };

function shortError(error: unknown): string {
  // Jeton masqué d'abord : un journal d'appel Playwright liste les en-têtes envoyés.
  const raw = redact(error instanceof Error ? error.message : String(error), BYPASS_TOKEN);
  // Codes couleur du terminal retirés, première ligne utile, longueur bornée.
  // eslint-disable-next-line no-control-regex
  const line = raw.replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim()) ?? raw;
  return line.trim().slice(0, 300);
}

/**
 * Choisit une option d'un <select> du sélecteur, en rejouant avant l'hydratation.
 * Le focus d'abord, comme un client : la liste des marques n'est chargée qu'au
 * premier focus (VehicleSelector, onSelectorInteraction).
 */
async function pick(page: Page, label: string, value: string, next: string | null) {
  const select = page.getByRole('combobox', { name: label }).filter({ visible: true }).first();
  try {
    await expect(async () => {
      // blur puis focus : un focus reçu avant l'hydratation n'a rien déclenché, et
      // focus() sur l'élément déjà actif n'émet plus d'événement.
      await select.blur({ timeout: 2_000 });
      await select.focus({ timeout: 2_000 });
      await select.selectOption(value, { timeout: 3_000 });
      if (next) {
        await expect(page.getByRole('combobox', { name: next }).filter({ visible: true }).first()).toBeEnabled({
          timeout: 3_000,
        });
      }
    }).toPass({ timeout: 25_000 });
  } catch (error) {
    throw new Error(`« ${label} » = ${value} : ${shortError(error)}`);
  }
}

test.describe("Sonde du parcours d'achat", () => {
  test('accueil → paiement, sans payer', async ({ browser, baseURL }) => {
    expect(baseURL, 'PURCHASE_PROBE_BASE_URL requis').toBeTruthy();
    const origin = new URL(baseURL!).origin;

    // Agent utilisateur explicite : navigateur sans tête déclaré, suivi du jeton
    // robot. Aucun héritage d'un profil d'appareil qui le maquillerait en Chrome.
    const userAgent =
      `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
      `HeadlessChrome/${browser.version()} Safari/537.36 ${PROBE_UA_TOKEN}`;
    expect(userAgent, 'UA classé bot_other par @repo/cwv-taxonomy').toContain('HeadlessChrome');
    expect(userAgent, 'UA reconnu par BOT_UA_PATTERN (root.tsx)').toMatch(/bot/i);

    const context = await browser.newContext({
      baseURL,
      userAgent,
      locale: 'fr-FR',
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    });
    const blocked = new Map<string, number>();
    const leaks = new Set<string>();
    await guardWrites(context, origin, BYPASS_TOKEN, blocked);
    watchRedirectLeaks(context, origin, leaks);
    const page = await context.newPage();

    const startedAt = new Date();
    const steps: StepResult[] = [];
    let failedStep: StepId | null = null;
    let failure: string | null = null;

    async function run(step: StepId, body: () => Promise<void>) {
      if (failedStep) return;
      const t0 = Date.now();
      try {
        await test.step(`${step} — ${STEPS[step]}`, body);
        steps.push({ step, label: STEPS[step], ok: true, ms: Date.now() - t0 });
      } catch (error) {
        steps.push({ step, label: STEPS[step], ok: false, ms: Date.now() - t0 });
        failedStep = step;
        failure = shortError(error);
      }
    }

    try {
      await run('accueil', async () => {
        const response = await page.goto('/');
        expect(response?.status(), 'GET /').toBe(200);
        await expect(page.getByRole('combobox', { name: 'Sélectionner la marque' }).filter({ visible: true })).toBeVisible();
      });

      await run('vehicule', async () => {
        const [brand, year, model, type] = VEHICLE;
        await pick(page, 'Sélectionner la marque', brand, "Sélectionner l'année");
        await pick(page, "Sélectionner l'année", year, 'Sélectionner le modèle');
        await pick(page, 'Sélectionner le modèle', model, 'Sélectionner la motorisation');
        await page
          .getByRole('combobox', { name: 'Sélectionner la motorisation' })
          .filter({ visible: true })
          .first()
          .selectOption(type);
        await page.waitForURL(new RegExp(`^${origin}/constructeurs/[^/]+-${brand}/[^/]+-${model}/[^/]+-${type}\\.html$`));
        await expect(page.locator('h1')).toBeVisible();
      });

      await run('gamme', async () => {
        const link = page.locator(`a[href^="${GAMME_PREFIX}"]`).filter({ visible: true }).first();
        await expect(link, `lien vers ${GAMME_PREFIX}… sur la page véhicule`).toBeVisible();
        await link.click();
        await page.waitForURL((url) => url.pathname.startsWith(GAMME_PREFIX));
        await expect(page.getByRole('button', { name: PIECE_CARD }).filter({ visible: true }).first()).toBeVisible();
      });

      // Fiche produit : première pièce dont le bouton d'ajout est actif.
      const dialog = page.getByRole('dialog');
      const addButton = dialog.getByRole('button', { name: /Ajouter au panier|Panier/ }).filter({ visible: true }).first();
      await run('produit', async () => {
        const cards = page.getByRole('button', { name: PIECE_CARD }).filter({ visible: true });
        const count = Math.min(await cards.count(), MAX_CARDS_TRIED);
        for (let i = 0; i < count; i++) {
          await expect(async () => {
            if (!(await dialog.isVisible())) await cards.nth(i).click({ timeout: 2_000 });
            await expect(dialog).toBeVisible({ timeout: 2_000 });
          }).toPass({ timeout: 20_000 });
          if (await addButton.isEnabled({ timeout: 10_000 }).catch(() => false)) return;
          await page.keyboard.press('Escape');
          await expect(dialog).toBeHidden();
        }
        throw new Error(`aucune des ${count} premières pièces n'a de bouton « Ajouter au panier » actif`);
      });

      await run('ajout_panier', async () => {
        const [response] = await Promise.all([
          page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/cart/items'),
          addButton.click(),
        ]);
        expect(response.status(), 'POST /api/cart/items').toBeLessThan(300);
      });

      await run('panier', async () => {
        const response = await page.goto('/cart');
        expect(response?.status(), 'GET /cart').toBe(200);
        await expect(page.locator('main')).not.toContainText(/panier est vide/i);
        await expect(page.getByRole('link', { name: /Continuer vers la livraison/ })).toBeVisible();
      });

      await run('commande', async () => {
        await expect(async () => {
          await page.getByRole('link', { name: /Continuer vers la livraison/ }).click({ timeout: 2_000 });
          await page.waitForURL((url) => url.pathname === '/checkout', { timeout: 5_000 });
        }).toPass({ timeout: 25_000 });
        await expect(page.getByLabel('Adresse email *')).toBeVisible();
      });

      await run('paiement', async () => {
        // Invité fictif : ces valeurs restent dans le navigateur (aucun envoi de
        // formulaire possible, cf. guardWrites). Seule la vérification d'e-mail part.
        const email = page.getByLabel('Adresse email *');
        await expect(async () => {
          await email.fill('sonde-parcours@example.invalid');
          await page.getByRole('button', { name: 'Continuer', exact: true }).click({ timeout: 2_000 });
          await expect(page.locator('input[name="firstName"]')).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 25_000 });
        await page.locator('input[name="firstName"]').fill('Sonde');
        await page.locator('input[name="lastName"]').fill('Parcours');
        await page.locator('input[name="address"]').fill('1 rue de la Sonde');
        await page.locator('input[name="phone"]').fill('0600000000');
        await page.locator('input[name="zipCode"]').fill('75001');
        await page.locator('input[name="city"]').fill('Paris');
        await page.getByRole('button', { name: /Continuer vers le paiement/ }).click();
        await expect(page.getByRole('heading', { name: 'Methode de paiement' })).toBeVisible();
        await expect(page.locator('input[type="radio"][name="paymentMethod"]').first()).toBeAttached();
        // Le bouton « Payer » est affiché ; il n'est jamais cliqué.
        await expect(page.getByRole('button', { name: /^Payer / })).toBeVisible();
      });
    } finally {
      // Nettoyage, même après un échec : panier (Redis) puis session. Lancé à
      // chaque passage — une session est créée dès la première page servie.
      {
        const cleanupFailedBefore = failedStep;
        const t0 = Date.now();
        try {
          const cleared = await context.request.delete('/api/cart', API);
          expect(cleared.status(), 'DELETE /api/cart').toBeLessThan(300);
          const cart = await context.request.get('/api/cart', API);
          const items = ((await cart.json()) as { items?: unknown[] }).items ?? [];
          expect(items.length, 'panier vide après nettoyage').toBe(0);
          const logout = await context.request.post('/auth/logout', API);
          expect(logout.status(), 'POST /auth/logout').toBeLessThan(400);
          steps.push({ step: 'nettoyage', label: STEPS.nettoyage, ok: true, ms: Date.now() - t0 });
        } catch (error) {
          steps.push({ step: 'nettoyage', label: STEPS.nettoyage, ok: false, ms: Date.now() - t0 });
          if (!cleanupFailedBefore) {
            failedStep = 'nettoyage';
            failure = shortError(error);
          }
        }
      }
      await context.close();

      // Jeton parti vers une autre origine par une redirection : passage en échec,
      // le jeton est à renouveler (seules les origines sont écrites). Un échec
      // antérieur garde son étape ; la fuite passe en tête du message.
      if (leaks.size > 0) {
        const leak = `jeton parti par redirection vers ${[...leaks].join(', ')} : à renouveler`;
        failure = (failedStep ? `${leak} ; ${failure}` : leak).slice(0, 300);
        failedStep ??= 'fuite_jeton';
      }

      const result = {
        schema: 'purchase-path-probe/v1',
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        origin,
        user_agent_token: PROBE_UA_TOKEN,
        ok: failedStep === null,
        failed_step: failedStep,
        failed_label: failedStep ? STEPS[failedStep as StepId] : null,
        failure,
        steps,
        total_ms: steps.reduce((sum, s) => sum + s.ms, 0),
        blocked_writes: [...blocked.entries()].map(([request, count]) => ({ request, count })),
        bypass_header_leaks: [...leaks],
      };
      mkdirSync(dirname(RESULT_PATH), { recursive: true });
      writeFileSync(RESULT_PATH, `${redact(JSON.stringify(result, null, 2), BYPASS_TOKEN)}\n`);
    }

    expect(failedStep, redact(`étape en échec : ${failedStep} — ${failure}`, BYPASS_TOKEN)).toBeNull();
  });
});
