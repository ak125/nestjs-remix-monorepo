import {
  type ActionFunctionArgs,
  defer,
  type HeadersFunction,
  type LinksFunction,
  type LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/node";
import {
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
} from "@remix-run/react";

import { ChevronUp } from "lucide-react";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { logger } from "~/utils/logger";
import { getOptionalUser } from "./auth/unified.server";
import {
  Error401,
  Error404,
  Error410,
  Error503,
  ErrorGeneric,
} from "./components/errors";
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

const ChatWidget = lazy(() => import("./components/rag/ChatWidget"));
const GlobalFooter = lazy(() => import("./components/home/Footer"));
const BottomNav = lazy(() => import("./components/layout/BottomNav"));
const LazyToaster = lazy(() =>
  import("sonner").then((m) => ({ default: m.Toaster })),
);

// 🚀 LCP Phase 2: Fonts self-hosted (élimine 2 DNS lookups cross-origin)
// @font-face déclarés dans global.css, preloads ici pour les 2 fonts critiques

export const links: LinksFunction = () => [
  // 🚀 LCP: Preload CSS critique
  { rel: "preload", href: stylesheet, as: "style" },

  // 🚀 V9 fonts: Outfit (headings) + DM Sans (body) — above-fold critical
  // Inter + Montserrat: font-display:swap in @font-face, no preload needed
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

  // CSS principal (inclut design tokens + utilities via @import, bundlé par Vite)
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
  // charset et viewport sont hardcodés dans le Layout JSX — pas de doublon ici
  { title: "Automecanik - Pièces auto à prix pas cher" },
  {
    name: "description",
    content:
      "Catalogue de pièces détachées auto pour toutes marques et modèles. Livraison rapide. Qualité garantie.",
  },
  { name: "theme-color", content: "#0d1b2a" },
  { property: "og:image", content: "https://www.automecanik.com/logo-og.webp" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { name: "twitter:card", content: "summary_large_image" },
  {
    name: "twitter:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
];

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // User synchrone (Redis, rapide) — nécessaire pour Navbar SSR
  const user = await getOptionalUser({ context });

  // Cart deferred — ne bloque PAS le rendu SSR (P0 perf: -1-2s FCP)
  const cartPromise = getCart(request).catch((err) => {
    logger.warn("⚠️ [root.loader] Erreur chargement panier:", err.message);
    return null;
  });

  return defer({
    user,
    cart: cartPromise,
    cspNonce: ((context as Record<string, unknown>)?.cspNonce as string) || "",
  });
};

export const headers: HeadersFunction = () => ({
  "Cache-Control": "private, max-age=60",
});

// Reject POST requests from bots/crawlers — root route has no forms
export const action = async (_args: ActionFunctionArgs) => {
  return json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET" } },
  );
};

// Re-exports depuis module neutre pour éviter la dépendance circulaire root ↔ Navbar
export { useOptionalUser, useRootCart } from "./hooks/useRootData";

declare module "@remix-run/node" {
  interface AppLoadContext {
    remixService: any;
    remixIntegration?: any; // injection côté Nest: RemixApiService
    parsedBody?: any;
    user: unknown;
  }
}

/** Error boundary that silently catches ChatWidget crashes without affecting the app. */
class ChatWidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.warn(
      "[ChatWidget] crash intercepte:",
      error.message,
      info.componentStack?.slice(0, 200),
    );
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/** Lazy-loaded ChatWidget wrapped in error boundary + suspense + hydration guard */
function ChatWidgetSafe() {
  const isHydrated = useHydrated();
  if (!isHydrated) return null;
  return (
    <ChatWidgetErrorBoundary>
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </ChatWidgetErrorBoundary>
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

  // 📊 Google Analytics - Tracking des navigations SPA (optimisé avec requestIdleCallback)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const trackPageView = () => {
      // Exclure les pages admin du tracking GA4 (évite pollution analytics)
      if (location.pathname.startsWith("/admin")) return;

      if (typeof window.gtag === "function") {
        window.gtag("config", "G-ZVG6K5R740", {
          page_path: location.pathname + location.search,
          page_title: document.title,
          page_location: window.location.href,
        });
      }
    };

    // Utiliser requestIdleCallback pour ne pas bloquer l'INP
    if ("requestIdleCallback" in window) {
      (
        window as Window & {
          requestIdleCallback: (
            cb: () => void,
            opts?: { timeout: number },
          ) => number;
        }
      ).requestIdleCallback(trackPageView, { timeout: 1000 });
    } else {
      // Fallback pour Safari
      setTimeout(trackPageView, 0);
    }
  }, [location.pathname, location.search]);

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
      {!hideGlobalNavbar && <Navbar />}
      <main className="flex-grow flex flex-col">
        <div className="flex-grow">{children}</div>
      </main>
      {!hideGlobalFooter && (
        <Suspense fallback={null}>
          <GlobalFooter />
        </Suspense>
      )}
      {!hideBottomNav && (
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      )}
      <NotificationContainer />
      <button
        onClick={scrollToTop}
        type="button"
        className={`fixed bottom-40 right-4 md:bottom-24 md:right-8 z-[9999] w-12 h-12 rounded-full shadow-2xl flex items-center justify-center bg-[#e8590c] hover:bg-[#d9480f] text-white transition-all duration-300 hover:scale-110 ${showScrollTop ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}`}
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

  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <Meta />
        <Links />
        {/* 🚀 LCP Phase 2: Fonts self-hosted — @font-face dans global.css, preloads dans links() */}
        {/* 🚀 LCP: Animations CSS — non-render-blocking (not needed for first paint) */}
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
        {/* Google Analytics 4 - Optimisé avec requestIdleCallback + Consent Mode v2 (RGPD) */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}

              // Consent Mode v2 - Default denied (RGPD compliant)
              gtag('consent', 'default', {
                'analytics_storage': 'denied',
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'wait_for_update': 500
              });

              // Fonction pour accorder le consentement analytics
              window.__grantAnalyticsConsent = function() {
                gtag('consent', 'update', { 'analytics_storage': 'granted' });
              };

              // Fonction pour charger GTM une seule fois (optimisée avec requestIdleCallback)
              window.__loadGTM = function() {
                if (window.__gtmLoaded) return;
                window.__gtmLoaded = true;

                var loadScript = function() {
                  var script = document.createElement('script');
                  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-ZVG6K5R740';
                  script.async = true;
                  script.onload = function() {
                    gtag('js', new Date());
                    gtag('config', 'G-ZVG6K5R740', {
                      page_title: document.title,
                      page_location: window.location.href,
                      send_page_view: true
                    });
                    // Accorder le consentement analytics après chargement
                    window.__grantAnalyticsConsent();
                  };
                  document.head.appendChild(script);
                };

                // Double requestIdleCallback pour minimiser l'impact sur le main thread
                if ('requestIdleCallback' in window) {
                  requestIdleCallback(loadScript, { timeout: 2000 });
                } else {
                  setTimeout(loadScript, 0);
                }
              };

              // Charger sur première interaction (scroll, click, keypress, touch, mousemove)
              var events = ['scroll', 'click', 'keypress', 'touchstart', 'mousemove'];
              var loadOnInteraction = function() {
                window.__loadGTM();
                events.forEach(function(e) {
                  window.removeEventListener(e, loadOnInteraction, { passive: true, capture: true });
                });
              };
              events.forEach(function(e) {
                window.addEventListener(e, loadOnInteraction, { passive: true, capture: true });
              });

              // Fallback: charger quand le browser est idle (plus intelligent que setTimeout fixe)
              if ('requestIdleCallback' in window) {
                requestIdleCallback(window.__loadGTM, { timeout: 5000 });
              } else {
                // Safari/anciens navigateurs: timeout de 3s
                setTimeout(window.__loadGTM, 3000);
              }
            `,
          }}
        />
      </head>
      <body className="h-full bg-gray-100" suppressHydrationWarning>
        <NotificationProvider>
          <AppShell>{children}</AppShell>
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
      switch (error.status) {
        case 401:
          return (
            <Error401
              url={error.data?.url}
              redirectTo={error.data?.redirectTo}
              message={error.data?.message}
            />
          );
        case 404:
          return (
            <Error404
              url={error.data?.url}
              suggestions={error.data?.suggestions}
            />
          );
        case 410:
          return (
            <Error410
              url={error.data?.url}
              isOldLink={error.data?.isOldLink}
              redirectTo={error.data?.redirectTo}
            />
          );
        case 503:
          return (
            <Error503
              url={error.data?.url}
              message={error.data?.message}
              retryAfter={error.data?.retryAfter || 30}
            />
          );
        default:
          return (
            <ErrorGeneric
              status={error.status}
              message={error.statusText || error.data?.message}
              details={error.data?.details}
            />
          );
      }
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
