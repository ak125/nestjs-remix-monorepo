import {
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
} from "@remix-run/react";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { getOptionalUser } from "./auth/unified.server";
import {
  Error401,
  Error404,
  Error410,
  Error503,
  ErrorGeneric,
} from "./components/errors";
import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
import {
  NotificationContainer,
  NotificationProvider,
} from "./components/notifications/NotificationContainer";
// @ts-ignore
import stylesheet from "./global.css?url";
import { usePageRoleDataAttrs } from "./hooks/usePageRole";
import { VehicleProvider } from "./hooks/useVehiclePersistence";
// @ts-ignore
import logo from "./routes/_assets/logo-automecanik-dark.png"; // TODO: utiliser dans l'interface
import { getCart } from "./services/cart.server";
import animationsStylesheet from "./styles/animations.css?url";
import { type CartData } from "./types/cart";
// @ts-ignore

// URL Google Fonts (non-bloquant via preload)
const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=Montserrat:wght@500;600;700;800;900&family=Roboto+Mono:wght@400;500;600;700&display=swap";

export const links: LinksFunction = () => [
  // 🚀 LCP Optimization: Preload CSS critique
  { rel: "preload", href: stylesheet, as: "style" },

  // 🚀 LCP Optimization: Preload logo navbar (présent sur toutes les pages)
  {
    rel: "preload",
    href: "/logo-navbar.webp",
    as: "image",
    type: "image/webp",
  },

  // Stylesheets - CSS critique (bloquant)
  { rel: "stylesheet", href: stylesheet },

  // CSS animations - Chargé de façon synchrone pour éviter hydration mismatch
  { rel: "stylesheet", href: animationsStylesheet },

  // DNS Prefetch & Preconnect (Performance SEO Phase 1)
  { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
  { rel: "dns-prefetch", href: "https://fonts.gstatic.com" },
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
  { rel: "preconnect", href: "https://www.automecanik.com" }, // imgproxy
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },

  // Google Fonts - Chargement non-bloquant (stylesheet only, preload moved to homepage)
  { rel: "stylesheet", href: GOOGLE_FONTS_URL },

  // Note: Font preloads + brand image preloads déplacés vers _index.tsx (homepage)
  // pour améliorer le LCP sur les pages produit (slow 4G)

  // Manifest & Icons
  { rel: "manifest", href: "/manifest.json" },
  { rel: "icon", type: "image/webp", sizes: "192x192", href: "/icon-192.webp" },
  { rel: "icon", type: "image/webp", sizes: "512x512", href: "/icon-512.webp" },
  { rel: "apple-touch-icon", sizes: "192x192", href: "/icon-192.webp" },
];

export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { title: "Automecanik - Pièces auto à prix pas cher" },
  {
    name: "description",
    content:
      "Catalogue de pièces détachées auto pour toutes marques et modèles. Livraison rapide. Qualité garantie.",
  },
  { viewport: "width=device-width,initial-scale=1" },
  { name: "theme-color", content: "#2563eb" },
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
  // Charger user et cart en parallèle pour la performance
  const [user, cart] = await Promise.all([
    getOptionalUser({ context }),
    getCart(request).catch((err) => {
      console.warn("⚠️ [root.loader] Erreur chargement panier:", err.message);
      return null;
    }),
  ]);

  return json({
    user,
    cart,
  });
};

export const useOptionalUser = () => {
  const data = useRouteLoaderData<typeof loader>("root");

  if (!data) {
    // Retourner null au lieu de lancer une erreur
    console.warn("Root loader was not run - returning null user");
    return null;
  }
  return data.user;
};

/**
 * Hook pour accéder aux données du panier depuis le root loader
 * Utilisé par CartSidebarSimple pour avoir les données SSR
 */
export const useRootCart = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.cart || null;
};

declare module "@remix-run/node" {
  interface AppLoadContext {
    remixService: any;
    remixIntegration?: any; // injection côté Nest: RemixApiService
    parsedBody?: any;
    user: unknown;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as
    | { user: any; cart: CartData | null }
    | undefined;
  const _user = data?.user;
  const _cart = data?.cart;
  const revalidator = useRevalidator();
  const location = useLocation();

  // 🎯 Phase 5 SEO: Récupérer les data-attributes du rôle de page
  const pageRoleAttrs = usePageRoleDataAttrs();

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
  useEffect(() => {
    if (typeof window === "undefined" || !pageRoleAttrs) return;

    // Exclure les pages admin
    if (location.pathname.startsWith("/admin")) return;

    // Initialiser dataLayer si nécessaire
    window.dataLayer = window.dataLayer || [];

    // Push les attributs de rôle pour GTM
    window.dataLayer.push({
      event: "page_role_loaded",
      pageRole: pageRoleAttrs["data-page-role"],
      pageIntent: pageRoleAttrs["data-page-intent"],
      contentType: pageRoleAttrs["data-content-type"],
      clusterId: pageRoleAttrs["data-cluster-id"],
      funnelStage: pageRoleAttrs["data-funnel-stage"],
      conversionGoal: pageRoleAttrs["data-conversion-goal"],
      vehicleContext: pageRoleAttrs["data-vehicle-context"],
    });
  }, [location.pathname, pageRoleAttrs]);

  // 🔄 Synchronisation panier globale via événement
  useEffect(() => {
    const handleCartUpdated = () => {
      console.log("🔄 [root] cart:updated → revalidate");
      revalidator.revalidate();
    };

    window.addEventListener("cart:updated", handleCartUpdated);
    return () => window.removeEventListener("cart:updated", handleCartUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Revalidator est stable - pas besoin de dépendance

  return (
    <html lang="fr" className="h-full">
      <head>
        <Meta />
        <Links />
        {/* Google Analytics 4 - Optimisé avec requestIdleCallback + Consent Mode v2 (RGPD) */}
        <script
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
      <body className="h-full bg-gray-100" {...pageRoleAttrs}>
        <VehicleProvider>
          <NotificationProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar logo={logo} />
              <main className="flex-grow flex flex-col">
                <div className="flex-grow">{children}</div>
              </main>
            </div>
            <Footer />
            <NotificationContainer />
          </NotificationProvider>
        </VehicleProvider>
        {/* 🎉 Sonner Toaster - Notifications modernes */}
        <Toaster position="top-right" expand={true} richColors closeButton />
        <ScrollRestoration />
        <Scripts />
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
