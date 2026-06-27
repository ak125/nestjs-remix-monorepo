import { test, expect } from "@playwright/test";

/**
 * Régression visuelle — fige la STRUCTURE / cascade CSS du build courant pour la comparer après
 * une mutation à fort blast-radius (Vite 8 / Rolldown ✅ ; GATE-0 du chantier Tailwind 3 → 4 +
 * refonte design-tokens). Ces changements peuvent altérer l'émission/l'ordre des CSS (FOUC,
 * cascade, défauts ring/border/shadow) sans casser typecheck/build/size-limit (qui ne comptent
 * que les octets). Ce gate capture ce que les autres ne voient pas. Tourne pour les projets
 * `desktop` (1920×1080) ET `mobile` (390×844). Topologie snapshots : voir README + config.
 *
 * DÉTERMINISME (obligatoire) : ces tests DOIVENT tourner dans l'image Docker Playwright pinnée
 * `mcr.microsoft.com/playwright:v1.61.0-noble` (= runner CI ubuntu-24.04 / noble). Les générer ou
 * comparer hors de cette image (ex. poste DEV jammy) produit des diffs de rendu de police.
 * Voir `frontend/tests/visual/README.md` + `scripts/visual/run-visual-docker.sh`.
 *
 * Régions data-driven (prix, stock, dispo, dates, images produit) masquées : on fige la mise en
 * page, pas le contenu qui évolue avec la base. URLs réelles vérifiées 200 sur le runtime.
 *
 * ── Couverture périmètre DT-1 (recolor CTA `bg-cta` blanc→noir, 23 fichiers) ───────────────────
 * Ces baselines v3 DOIVENT exister AVANT DT-1 (irrécupérables après mutation). Les pages ci-dessous
 * couvrent les surfaces publiques portant un CTA `bg-cta text-white` :
 *   • home/r1/r2  → chrome global (Navbar/Footer/BottomNav/Section/root) + Hero/Catalogue/Diagnostic
 *                   /GammeHero/PiecesHeroPriceCard/VehicleSelector
 *   • cart-empty  → cart.tsx état VIDE (PAS CartSummaryBlock — voir gaps)
 *   • login/register/forgot-password → CTA d'auth
 *   • diagnostic-auto → diagnostic-auto._index
 *   • not-found-404  → 404.tsx (catch-all)
 * ⇒ 18/23 fichiers CTA nettoyés (capture stateless déterministe).
 * GAPS BORNÉS DÉCLARÉS — 5/23 non nettoyés (pas un cap silencieux) :
 *   • /checkout (CheckoutLivraisonSection/PaiementSection/checkout.tsx, 7 CTA) REDIRIGE (302) sans
 *     panier (loader: getOptionalUser donc PAS d'auth gate, puis redirect("/cart") si items===0).
 *     Capture = cart-drive interactif (dépendant du stock) → rendrait le gate flaky → DÉLIBÉRÉMENT
 *     hors oracle. Couvert en DT-1 par tests WCAG + uniformité du token (même mécanisme que les 18
 *     surfaces nettoyées) + before/after au moment de DT-1.
 *   • CartSummaryBlock.tsx : CTA bg-cta affiché SEULEMENT panier non vide ; /cart vide retourne tôt
 *     <EmptyCart> (cart.tsx:380) → cart-empty ne le nettoie pas. Même couverture DT-1 que /checkout.
 *   • DashboardDesignTab.tsx : route admin (/admin/...) hors périmètre gate public ; couvert par les
 *     tests unitaires design-tokens.
 *   • États interactifs (focus/accordéon/dialog ouverts/erreur form) DIFFÉRÉS : le CTA est un gros
 *     bouton plein-page, déjà visible en capture full-page → un spec composant n'est pas requis
 *     pour filtrer ce diff. À ajouter si une phase ultérieure exige un seuil composant plus strict.
 */

// `dynamic: true` = page à STRUCTURE data-driven (nombre de cartes / blocs éditoriaux variable selon
// la base) → capturée en VIEWPORT seul (fullPage:false), pas en pleine page : la hauteur du screenshot
// = celle du viewport (DÉTERMINISTE). Sinon un simple changement de footprint contenu (redeploy PREPROD,
// drift data) ferait échouer le gate par mismatch de DIMENSIONS — que Playwright traite comme une erreur
// FATALE, insensible à maxDiffPixelRatio. L'above-fold porte le hero + CTA (périmètre DT-1) ; le below-fold
// variable est volontairement hors oracle (couvert par les tests WCAG/computed-style de DT-1). Les pages à
// structure STABLE restent en fullPage (hauteur déterministe, couverture complète).
const PAGES: { name: string; url: string; dynamic?: boolean }[] = [
  // R-surfaces SEO (structure data-driven → viewport-only)
  { name: "home", url: "/", dynamic: true },
  { name: "r1-gamme", url: "/pieces/plaquette-de-frein-402.html", dynamic: true },
  {
    name: "r2-vehicule",
    url: "/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-77310.html",
    dynamic: true,
  },
  // Surfaces publiques portant un CTA `bg-cta text-white` (périmètre DT-1)
  { name: "cart-empty", url: "/cart" },
  { name: "login", url: "/login" },
  { name: "register", url: "/register" },
  { name: "forgot-password", url: "/forgot-password" },
  { name: "diagnostic-auto", url: "/diagnostic-auto", dynamic: true },
  { name: "not-found-404", url: "/__visual-gate-probe-404-inexistant" },
];

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
      // `load` (PAS `networkidle`) : Playwright DÉCONSEILLE networkidle — il peut ne JAMAIS se
      // résoudre sur une page à réseau continu (analytics / polling), ce qui faisait timeout
      // `diagnostic-auto` à 60s (run 28257536920). `load` = tous les sous-resources chargés ;
      // le settle ci-dessous fige le layout SSR final post-hydratation.
      await page.goto(p.url, { waitUntil: "load" });
      // Polices chargées (swap → reflow) AVANT de mesurer la stabilité.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      // Settle DÉTERMINISTE (B2) : attendre une hauteur de document STABLE sur 2 lectures
      // consécutives (hydratation Remix + reflows tardifs) plutôt qu'un sleep aveugle. Borné ;
      // on continue si non atteint (Playwright attend déjà les polices avant le screenshot).
      await page
        .waitForFunction(
          () => {
            const w = window as unknown as { __vgH?: number };
            const h = document.documentElement.scrollHeight;
            if (w.__vgH === h) return true;
            w.__vgH = h;
            return false;
          },
          undefined,
          { timeout: 3000, polling: 250 },
        )
        .catch(() => {});
      await expect(page).toHaveScreenshot(`${p.name}.png`, {
        // Pages dynamiques : viewport seul (hauteur déterministe) ; stables : pleine page.
        fullPage: !p.dynamic,
        animations: "disabled",
        maxDiffPixelRatio: 0.02,
        mask: DYNAMIC_MASK.map((s) => page.locator(s)),
      });
    });
  }
});
