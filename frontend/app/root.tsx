import { ChevronUp } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";
import {
  type ActionFunctionArgs,
  type HeadersFunction,
  type LinksFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  useRouteError,
  isRouteErrorResponse,
  useRevalidator,
  useLocation,
  useMatches,
  useNavigation,
} from "react-router";

import { AnalyticsConsent } from "~/components/AnalyticsConsent";
import { LazyFooter } from "~/components/home/LazyFooter";
import { LazyBoundary } from "~/components/LazyBoundary";
import { cspNonceContext } from "~/utils/load-context";
import { logger } from "~/utils/logger";
import { safeLazy } from "~/utils/resilient-lazy";
import { getOptionalUser } from "./auth/unified.server";
import { ErrorGeneric } from "./components/errors";
import { Navbar } from "./components/Navbar";
import {
  NotificationContainer,
  NotificationProvider,
} from "./components/notifications/NotificationContainer";
// @ts-ignore
import stylesheet from "./global.css?url";
import { useHydrated } from "./hooks/useHydrated";
import { usePageRoleDataAttrs } from "./hooks/usePageRole";
import { useScrollBehavior } from "./hooks/useScrollBehavior";
import { getCart } from "./services/cart.server";
import animationsStylesheet from "./styles/animations.css?url";

// GlobalFooter n'est plus déclaré ici : rendu via <LazyFooter/> (composant partagé,
// specifier canonique unique `~/components/home/Footer`) — voir components/home/LazyFooter.
// ChatWidget/BottomNav passent par safeLazy (durcissement fulfill-with-undefined).
const ChatWidget = safeLazy(() => import("./components/rag/ChatWidget"), {
  name: "ChatWidget",
});
const BottomNav = safeLazy(() => import("./components/layout/BottomNav"), {
  name: "BottomNav",
});
const LazyToaster = lazy(() =>
  import("sonner").then((m) => ({ default: m.Toaster })),
);

// 🚀 LCP Phase 2: Fonts self-hosted (élimine 2 DNS lookups cross-origin)
// @font-face déclarés dans global.css, preloads ici pour les 2 fonts critiques

export const links: LinksFunction = () => [
  // 🚀 LCP: Preload CSS critique
  { rel: "preload", href: stylesheet, as: "style" },

  // Fonts: Outfit (headings) + DM Sans (body) - above-fold critical
  {
    rel: "preload",
    href: "/fonts/outfit-latin.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous" as const,
  },
  {
    rel: "preload",
    href: "/fonts/dm-sans-latin.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous" as const,
  },

  // CSS principal (inclut design tokens via @import, bundlé par Vite)
  { rel: "stylesheet", href: stylesheet },

  // DNS Prefetch & Preconnect
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
  { rel: "preconnect", href: "https://www.automecanik.com" }, // imgproxy

  // Manifest & Icons
  { rel: "manifest", href: "/manifest.json" },
  { rel: "icon", type: "image/webp", sizes: "192x192", href: "/icon-192.webp" },
  { rel: "icon", type: "image/webp", sizes: "512x512", href: "/icon-512.webp" },
  { rel: "apple-touch-icon", sizes: "192x192", href: "/icon-192.webp" },
];

export const meta: MetaFunction = () => [
  // charset et viewport sont hardcodés dans le Layout JSX - pas de doublon ici
  { title: "Automecanik - Pièces auto à prix pas cher" },
  {
    name: "description",
    content:
      "Catalogue de pièces détachées auto pour toutes marques et modèles. Livraison rapide. Qualité garantie.",
  },
  { name: "theme-color", content: "#0F1E38" },
  { property: "og:image", content: "https://www.automecanik.com/logo-og.webp" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { name: "twitter:card", content: "summary_large_image" },
  {
    name: "twitter:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
];

// Bot UA regex - aligned with BotGuard patterns (server-side only)
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduck|semrush|ahrefs|mj12|dotbot|blexbot|gptbot|chatgpt|claude|perplexity|bytespider|python|curl|wget|scrapy|phantom|headless|selenium|puppeteer/i;

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // User synchrone (Redis, rapide) - nécessaire pour Navbar SSR
  const user = await getOptionalUser({ context });

  // Bot detection - empêche le chargement de gtag.js pour les bots
  const userAgent = request.headers.get("user-agent") || "";
  const isBot = BOT_UA_PATTERN.test(userAgent);

  // Cart deferred - ne bloque PAS le rendu SSR (P0 perf: -1-2s FCP)
  const cartPromise = getCart(request).catch((err) => {
    logger.warn("⚠️ [root.loader] Erreur chargement panier:", err.message);
    return null;
  });

  return {
    user,
    cart: cartPromise,
    isBot,
    cspNonce: context.get(cspNonceContext) || "",
    // Public runtime env exposed to the browser via `window.ENV` (see <script>
    // injection below). Same image runs in DEV/PROD with different values, so
    // these MUST be read at request time, not inlined at build time.
    ENV: {
      VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN || "",
      SENTRY_ENVIRONMENT:
        process.env.SENTRY_ENVIRONMENT ||
        process.env.APP_ENV ||
        process.env.NODE_ENV ||
        "development",
      // GA4 measurement ID — provisionné par environnement (docker-compose.prod.yml
      // uniquement). Vide en DEV (`npm run dev`) et PREPROD (CI) → le tag gtag n'est
      // PAS injecté, ce qui évite que les navigateurs headless E2E/Lighthouse polluent
      // la propriété GA4 de PROD (hostname=localhost, géo datacenter). Config-driven,
      // pas de measurement ID en dur dans le bundle client.
      VITE_GA_MEASUREMENT_ID: process.env.VITE_GA_MEASUREMENT_ID || "",
    },
  };
};

export const headers: HeadersFunction = () => ({
  "Cache-Control": "private, max-age=60",
});

// Reject POST requests from bots/crawlers - root route has no forms
export const action = async (_args: ActionFunctionArgs) => {
  return data(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET" } },
  );
};

// Re-exports depuis module neutre pour éviter la dépendance circulaire root ↔ Navbar
export { useOptionalUser, useRootCart } from "./hooks/useRootData";

/** Lazy-loaded ChatWidget wrapped in error boundary + suspense + hydration guard */
function ChatWidgetSafe() {
  const isHydrated = useHydrated();
  if (!isHydrated) return null;
  return (
    <LazyBoundary name="ChatWidget">
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </LazyBoundary>
  );
}

/**
 * AppShell - Inner component that safely uses hooks
 * Rendered inside providers where React/Remix context is available
 * (Fixes Remix 2.15 hook context timing issue)
 */
function AppShell({ children }: { children: React.ReactNode }) {
  const revalidator = useRevalidator();
  const location = useLocation();
  const matches = useMatches();
  const hideGlobalFooter = matches.some(
    (m) => (m.handle as any)?.hideGlobalFooter,
  );
  const hideGlobalNavbar = matches.some(
    (m) => (m.handle as any)?.hideGlobalNavbar,
  );
  const hideBottomNav = matches.some((m) => (m.handle as any)?.hideBottomNav);

  // 🎯 Phase 5 SEO: Récupérer les data-attributes du rôle de page
  const pageRoleAttrs = usePageRoleDataAttrs();
  const { showScrollTop, scrollToTop } = useScrollBehavior();

  // Extraire les valeurs primitives pour éviter les re-renders en boucle
  // (les dépendances d'objets causent des boucles infinies)
  const gtmPageRole = pageRoleAttrs?.["data-page-role"];
  const gtmPageIntent = pageRoleAttrs?.["data-page-intent"];
  const gtmContentType = pageRoleAttrs?.["data-content-type"];
  const gtmClusterId = pageRoleAttrs?.["data-cluster-id"];
  const gtmFunnelStage = pageRoleAttrs?.["data-funnel-stage"];
  const gtmConversionGoal = pageRoleAttrs?.["data-conversion-goal"];
  const gtmVehicleContext = pageRoleAttrs?.["data-vehicle-context"];

  // 📊 Google Analytics - Tracking SPA (dedup + navigation.state idle)
  const prevUrlRef = useRef("");
  const navigation = useNavigation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Attendre que la navigation soit stabilisée (pas de redirect en cours)
    if (navigation.state !== "idle") return;

    const currentUrl = location.pathname + location.search;
    const pageView = {
      page_path: currentUrl,
      page_title: document.title,
      page_location: new URL(currentUrl, window.location.origin).href,
      page_referrer: prevUrlRef.current
        ? new URL(prevUrlRef.current, window.location.origin).href
        : document.referrer,
    };
    const trackPageView = () => {
      if (window.__analyticsConsent?.getChoice() !== "granted") {
        prevUrlRef.current = "";
        return;
      }
      if (location.pathname.startsWith("/admin")) return;
      if (currentUrl === prevUrlRef.current || !window.gtag) return;
      // Only the current committed view; never replay pre-consent navigation.
      window.gtag("event", "page_view", pageView);
      prevUrlRef.current = currentUrl;
    };
    trackPageView();
    window.addEventListener("automecanik:analytics-consent", trackPageView);
    return () =>
      window.removeEventListener(
        "automecanik:analytics-consent",
        trackPageView,
      );
  }, [location.pathname, location.search, navigation.state]);

  // 📊 Phase 9: DataLayer GTM - Push pageRole attributes
  // IMPORTANT: Dépendre de primitives (gtm*) au lieu de l'objet pageRoleAttrs
  // pour éviter une boucle infinie de re-renders
  useEffect(() => {
    if (typeof window === "undefined" || !gtmPageRole) return;

    // Exclure les pages admin
    if (location.pathname.startsWith("/admin")) return;

    // Initialiser dataLayer si nécessaire
    window.dataLayer = window.dataLayer || [];

    // Push les attributs de rôle pour GTM
    window.dataLayer.push({
      event: "page_role_loaded",
      pageRole: gtmPageRole,
      pageIntent: gtmPageIntent,
      contentType: gtmContentType,
      clusterId: gtmClusterId,
      funnelStage: gtmFunnelStage,
      conversionGoal: gtmConversionGoal,
      vehicleContext: gtmVehicleContext,
    });
  }, [
    location.pathname,
    gtmPageRole,
    gtmPageIntent,
    gtmContentType,
    gtmClusterId,
    gtmFunnelStage,
    gtmConversionGoal,
    gtmVehicleContext,
  ]);

  // 🔄 Synchronisation panier globale via événement
  // ⚠️ FIX BOUCLE: Ajout d'un flag anti-boucle pour éviter les revalidations en cascade
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isRevalidating = false;

    const handleCartUpdated = () => {
      // Ignorer si une revalidation est déjà en cours
      if (isRevalidating) {
        logger.log("🛑 [root] cart:updated ignoré (revalidation en cours)");
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        logger.log("🔄 [root] cart:updated → revalidate");
        isRevalidating = true;
        revalidator.revalidate();
        // Reset le flag après 2 secondes
        setTimeout(() => {
          isRevalidating = false;
        }, 2000);
      }, 300);
    };

    window.addEventListener("cart:updated", handleCartUpdated);
    return () => {
      window.removeEventListener("cart:updated", handleCartUpdated);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col max-w-[100vw]"
      {...pageRoleAttrs}
    >
      {/* ⏳ Indicateur de navigation global (INP fix) — sans lui, un clic sur un
          <Link> ne peint RIEN avant la fin du chargement de la page cible, donc
          toute cette fenêtre (réseau + rendu) est comptée dans l'INP du clic.
          Même pattern déjà utilisé localement dans pieces.$slug.tsx, généralisé
          ici à toutes les routes (ex: reference-auto/*, qui n'en avait aucun). */}
      {navigation.state !== "idle" && (
        <div
          role="status"
          aria-label="Chargement en cours"
          className="fixed top-0 left-0 right-0 z-[60] h-1 bg-blue-500 animate-pulse"
        />
      )}
      {!hideGlobalNavbar && <Navbar />}
      <main className="grow flex flex-col">
        <div className="grow">{children}</div>
      </main>
      {!hideGlobalFooter && <LazyFooter />}
      {!hideBottomNav && (
        <LazyBoundary name="BottomNav">
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </LazyBoundary>
      )}
      <NotificationContainer />
      <button
        onClick={scrollToTop}
        type="button"
        className={`fixed bottom-40 right-4 md:bottom-24 md:right-8 z-[9999] w-12 h-12 rounded-full shadow-2xl flex items-center justify-center bg-cta hover:bg-cta-hover text-black transition-all duration-300 hover:scale-110 ${showScrollTop ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}`}
        aria-label="Retour en haut"
      >
        <ChevronUp className="w-6 h-6" />
      </button>
      {!location.pathname.startsWith("/admin") && <ChatWidgetSafe />}
    </div>
  );
}

/**
 * Layout - Hook-free wrapper component
 * Provides HTML structure and context providers only
 * All hook logic is delegated to AppShell (rendered inside providers)
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const nonce = data?.cspNonce || "";
  const isBot = data?.isBot ?? false;
  // GA4 mesure uniquement quand l'ID est provisionné (PROD). Vide en DEV/PREPROD
  // → pas de tag → pas de pollution CI/headless. Cf. loader ENV ci-dessus.
  const gaMeasurementId = data?.ENV?.VITE_GA_MEASUREMENT_ID ?? "";

  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* LCP: <Links/> (CSS render-blocking + font/module preloads) AVANT <Meta/>.
            Invariant : aucun bloc JSON-LD volumineux (script:ld+json émis par meta()
            — Product/FAQPage, ~18 Ko sur R2) ne doit précéder la découverte du CSS
            bloquant. charSet/viewport restent en tête (parse encoding). Ne pas
            revenir à l'ordre RR par défaut Meta→Links.
            Ref: audit/lcp-cwv-mobile-3-groups-root-cause-2026-07-14.md §3A */}
        <Links />
        <Meta />
        {/* Runtime ENV exposed to the browser. Must run BEFORE entry.client.tsx
            so Sentry can pick up the DSN at hydration. JSON.stringify is safe
            for this minimal set (no user-controlled keys). */}
        {data?.ENV ? (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `window.ENV = ${JSON.stringify(data.ENV)};`,
            }}
          />
        ) : null}
        {/* 🚀 LCP Phase 2: Fonts self-hosted - @font-face dans global.css, preloads dans links() */}
        {/* 🚀 LCP: Animations CSS - non-render-blocking (not needed for first paint) */}
        <link
          rel="stylesheet"
          href={animationsStylesheet}
          media="print"
          onLoad={(e) => {
            (e.currentTarget as HTMLLinkElement).media = "all";
          }}
        />
        <noscript>
          <link rel="stylesheet" href={animationsStylesheet} />
        </noscript>
        {/* Google Analytics 4 - chargement apres acceptation explicite */}
        {/* Double garde anti-pollution GA4 :
            1. !isBot         → exclut les crawlers (UA serveur)
            2. gaMeasurementId → l'ID n'est provisionné qu'en PROD (docker-compose.prod.yml),
               donc pas de tag en DEV/PREPROD (stoppe la pollution headless E2E/Lighthouse). */}
        {!isBot && gaMeasurementId !== "" && (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `
              (function () {
                window.dataLayer = window.dataLayer || [];
                var key = 'automecanik.analytics-consent.v1';
                // Same retention for acceptance and refusal: 180 days.
                var maxAge = 180 * 24 * 60 * 60 * 1000;
                var measurementId = '${gaMeasurementId}';
                var choice = null;
                var configured = false;
                window['ga-disable-' + measurementId] = true;
                window.gtag = function () {
                  if (arguments[0] === 'event' && choice !== 'granted') return;
                  window.dataLayer.push(arguments);
                };
                window.gtag('consent', 'default', {
                  analytics_storage: 'denied', ad_storage: 'denied',
                  ad_user_data: 'denied', ad_personalization: 'denied'
                });
                function readChoice() {
                  try {
                    var saved = JSON.parse(window.localStorage.getItem(key));
                    if (!saved || (saved.choice !== 'granted' && saved.choice !== 'denied') ||
                        typeof saved.updatedAt !== 'number' || !Number.isFinite(saved.updatedAt) ||
                        Date.now() < saved.updatedAt || Date.now() - saved.updatedAt >= maxAge) return null;
                    return saved.choice;
                  } catch (_) { return null; }
                }
                function clearAnalyticsCookies() {
                  // GA's default path is /. Preserve cart/auth/preference cookies.
                  var domains = window.location.hostname.split('.');
                  document.cookie.split(';').forEach(function (entry) {
                    var name = entry.trim().split('=')[0];
                    if (name !== '_ga' && name.indexOf('_ga_') !== 0) return;
                    var expired = name + '=; Max-Age=0; path=/; SameSite=Lax';
                    document.cookie = expired;
                    for (var i = 0; i < domains.length - 1; i++) {
                      document.cookie = expired + '; domain=' + domains.slice(i).join('.');
                    }
                  });
                }
                window.__loadGTM = function () {
                  if (choice !== 'granted' || window.__gtmLoaded) return;
                  var script = document.createElement('script');
                  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
                  script.async = true;
                  window.__gtmLoaded = true;
                  // Loading a script never grants consent.
                  document.head.appendChild(script);
                };
                function applyChoice(next) {
                  var changed = next !== choice;
                  choice = next;
                  window['ga-disable-' + measurementId] = choice !== 'granted';
                  if (choice === 'granted') {
                    window.gtag('consent', 'update', { analytics_storage: 'granted' });
                    if (!configured) {
                      window.gtag('js', new Date());
                      window.gtag('config', measurementId, { send_page_view: false });
                      configured = true;
                    }
                    if ('requestIdleCallback' in window) {
                      window.requestIdleCallback(window.__loadGTM, { timeout: 2000 });
                    } else { window.setTimeout(window.__loadGTM, 0); }
                  } else {
                    // Remove events queued before withdrawal, including during tag download.
                    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
                      if (window.dataLayer[i][0] === 'event') window.dataLayer.splice(i, 1);
                    }
                    window.gtag('consent', 'update', { analytics_storage: 'denied' });
                    clearAnalyticsCookies();
                  }
                  if (changed) window.dispatchEvent(new Event('automecanik:analytics-consent'));
                }
                window.__analyticsConsent = {
                  getChoice: function () { return choice; },
                  setChoice: function (next) {
                    if (next !== 'granted' && next !== 'denied') return false;
                    var persisted = true;
                    try { window.localStorage.setItem(key, JSON.stringify({ choice: next, updatedAt: Date.now() })); }
                    catch (_) {
                      persisted = false;
                      // Do not retain an earlier acceptance if replacing it fails.
                      try { window.localStorage.removeItem(key); } catch (_) { /* Browser storage unavailable; UI reports failure. */ }
                    }
                    applyChoice(next);
                    return persisted;
                  }
                };
                applyChoice(readChoice());
                window.addEventListener('storage', function (event) {
                  if (event.key === key || event.key === null) applyChoice(readChoice());
                });
                // Recheck expiry when a long-lived tab is revisited.
                window.addEventListener('focus', function () { applyChoice(readChoice()); });
              })();
            `,
            }}
          />
        )}
      </head>
      <body className="h-full bg-gray-100" suppressHydrationWarning>
        <NotificationProvider>
          <AppShell>
            {children}
            <AnalyticsConsent />
          </AppShell>
        </NotificationProvider>
        {/* 🎉 Sonner Toaster - Lazy-loaded (non-critique pour first paint) */}
        <Suspense fallback={null}>
          <LazyToaster
            position="bottom-right"
            richColors
            closeButton
            duration={3000}
          />
        </Suspense>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// ErrorBoundary globale pour gérer les erreurs de routes
// Wrappé avec meta noindex pour éviter l'indexation des pages d'erreur
export function ErrorBoundary() {
  const error = useRouteError();

  // Déterminer le contenu d'erreur à afficher
  const getErrorContent = () => {
    if (isRouteErrorResponse(error)) {
      return (
        <ErrorGeneric
          status={error.status}
          message={error.statusText || error.data?.message}
          details={error.data?.details}
        />
      );
    }

    // Erreur non-HTTP (erreur JavaScript, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack =
      error instanceof Error ? error.stack : JSON.stringify(error, null, 2);

    return (
      <ErrorGeneric
        status={500}
        message={errorMessage}
        details={errorStack || "Une erreur technique s'est produite."}
        showStackTrace={process.env.NODE_ENV === "development"}
        stack={errorStack}
      />
    );
  };

  // Wrapper avec meta noindex pour SEO
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="robots" content="noindex, nofollow" />
        <title>Erreur | Automecanik</title>
        <Links />
      </head>
      <body>
        {getErrorContent()}
        <Scripts />
      </body>
    </html>
  );
}
