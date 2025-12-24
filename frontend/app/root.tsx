import { type LinksFunction, type LoaderFunctionArgs, json, type MetaFunction } from "@remix-run/node";
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
  useLocation
} from "@remix-run/react";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { getOptionalUser } from "./auth/unified.server";
import { Error401, Error404, Error410, Error412, Error503, ErrorGeneric } from "./components/errors";
import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
import { NotificationContainer, NotificationProvider } from "./components/notifications/NotificationContainer";
// @ts-ignore
import stylesheet from "./global.css?url";
import { VehicleProvider } from "./hooks/useVehiclePersistence";
// @ts-ignore
import logo from "./routes/_assets/logo-automecanik-dark.png"; // TODO: utiliser dans l'interface
import { getCart } from "./services/cart.server";
import animationsStylesheet from "./styles/animations.css?url";
import { type CartData } from "./types/cart";
// @ts-ignore

// URL Google Fonts (non-bloquant via preload)
const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=Montserrat:wght@500;600;700;800;900&family=Roboto+Mono:wght@400;500;600;700&display=swap";

export const links: LinksFunction = () => [
  // 🚀 LCP Optimization: Preload CSS critique
  { rel: "preload", href: stylesheet, as: "style" },

  // Stylesheets - CSS critique (bloquant)
  { rel: "stylesheet", href: stylesheet },

  // 🚀 CSS animations - Prefetch (non-bloquant, chargé en arrière-plan)
  // Sera appliqué après le CSS critique via le composant DeferredStyles
  { rel: "prefetch", href: animationsStylesheet, as: "style" },

  // DNS Prefetch & Preconnect (Performance SEO Phase 1)
  { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
  { rel: "dns-prefetch", href: "https://fonts.gstatic.com" },
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
  { rel: "preconnect", href: "https://cxpojprgwgubzjyqzmoq.supabase.co" },
  { rel: "preconnect", href: "https://fonts.googleapis.com", crossOrigin: "anonymous" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },

  // Google Fonts - Chargement non-bloquant (preload + stylesheet)
  { rel: "preload", href: GOOGLE_FONTS_URL, as: "style" },
  { rel: "stylesheet", href: GOOGLE_FONTS_URL },

  // Font Preload (Performance SEO Phase 1) - Inter + Montserrat fichiers woff2
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    href: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
    crossOrigin: "anonymous"
  },
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    href: "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2",
    crossOrigin: "anonymous"
  },

  // Image Preload critiques (Logos constructeurs top 10)
  { rel: "preload", as: "image", href: "/assets/brands/renault.webp" },
  { rel: "preload", as: "image", href: "/assets/brands/peugeot.webp" },
  { rel: "preload", as: "image", href: "/assets/brands/citroen.webp" },

  // Manifest & Icons
  { rel: "manifest", href: "/manifest.json" },
  { rel: "icon", type: "image/webp", sizes: "192x192", href: "/icon-192.webp" },
  { rel: "icon", type: "image/webp", sizes: "512x512", href: "/icon-512.webp" },
  { rel: "apple-touch-icon", sizes: "192x192", href: "/icon-192.webp" },
];

export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { title: "Automecanik - Pièces auto à prix pas cher" },
  { name: "description", content: "Catalogue de pièces détachées auto pour toutes marques et modèles. Livraison rapide. Qualité garantie." },
  { viewport: "width=device-width,initial-scale=1" },
  { name: "theme-color", content: "#2563eb" },
  { property: "og:image", content: "https://www.automecanik.com/logo-og.webp" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: "https://www.automecanik.com/logo-og.webp" },
];

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // Charger user et cart en parallèle pour la performance
  const [user, cart] = await Promise.all([
    getOptionalUser({ context }),
    getCart(request).catch((err) => {
      console.warn('⚠️ [root.loader] Erreur chargement panier:', err.message);
      return null;
    })
  ]);
  
  return json({ 
    user,
    cart
  });
};

export const useOptionalUser = () => {
  const data = useRouteLoaderData<typeof loader>("root");

  if (!data) {
    // Retourner null au lieu de lancer une erreur
    console.warn('Root loader was not run - returning null user');
    return null;
  }
  return data.user;
}

/**
 * Hook pour accéder aux données du panier depuis le root loader
 * Utilisé par CartSidebarSimple pour avoir les données SSR
 */
export const useRootCart = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.cart || null;
}

declare module "@remix-run/node" {
  interface AppLoadContext {
    remixService: any;
    remixIntegration?: any; // injection côté Nest: RemixApiService
    parsedBody?: any;
    user: unknown;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as { user: any; cart: CartData | null } | undefined;
  const _user = data?.user;
  const cart = data?.cart;
  const revalidator = useRevalidator();
  const location = useLocation();
  
  // 📊 Google Analytics - Tracking des navigations SPA
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('config', 'G-ZVG6K5R740', {
        page_path: location.pathname + location.search,
        page_title: document.title,
        page_location: window.location.href
      });
    }
  }, [location.pathname, location.search]);
  
  // 🔄 Synchronisation panier globale via événement
  useEffect(() => {
    const handleCartUpdated = () => {
      console.log('🔄 [root] cart:updated → revalidate');
      revalidator.revalidate();
    };

    window.addEventListener('cart:updated', handleCartUpdated);
    return () => window.removeEventListener('cart:updated', handleCartUpdated);
  }, [revalidator]);

  // 🚀 LCP Optimization: Charger animations.css après le rendu initial (non-bloquant)
  useEffect(() => {
    // Attendre que le LCP soit rendu avant de charger les animations
    const loadDeferredStyles = () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = animationsStylesheet;
      document.head.appendChild(link);
    };

    // Utiliser requestIdleCallback si disponible, sinon setTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadDeferredStyles, { timeout: 2000 });
    } else {
      setTimeout(loadDeferredStyles, 100);
    }
  }, []);

  // DEBUG: Log pour voir si les données arrivent
  if (typeof window !== 'undefined') {
    console.log('🏠 [root.Layout] cart data:', cart ? `${cart.items?.length || 0} items` : 'null');
  }
  
  return (
    <html lang="fr" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Google Analytics 4 - Chargement différé sur interaction/idle pour optimiser LCP */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}

              // Fonction pour charger GTM une seule fois
              window.__loadGTM = function() {
                if (window.__gtmLoaded) return;
                window.__gtmLoaded = true;

                var script = document.createElement('script');
                script.src = 'https://www.googletagmanager.com/gtag/js?id=G-ZVG6K5R740';
                script.async = true;
                script.onload = function() {
                  gtag('js', new Date());
                  gtag('config', 'G-ZVG6K5R740', {
                    page_title: document.title,
                    page_location: window.location.href
                  });
                };
                document.head.appendChild(script);
              };

              // Charger sur première interaction (scroll, click, keypress, touch)
              var events = ['scroll', 'click', 'keypress', 'touchstart'];
              var loadOnInteraction = function() {
                window.__loadGTM();
                events.forEach(function(e) {
                  window.removeEventListener(e, loadOnInteraction, { passive: true });
                });
              };
              events.forEach(function(e) {
                window.addEventListener(e, loadOnInteraction, { passive: true });
              });

              // Fallback: charger après 4s si pas d'interaction (pour le SEO/analytics)
              setTimeout(window.__loadGTM, 4000);
            `,
          }}
        />
      </head>
      <body className="h-full bg-gray-100">
        <VehicleProvider>
          <NotificationProvider>
            <div className="min-h-screen flex flex-col">
                <Navbar logo={logo} />
                <main className="flex-grow flex flex-col">
                  <div className="flex-grow">
                    {children}
                  </div>
                 </main>
            </div>
            <Footer />
            <NotificationContainer />
          </NotificationProvider>
        </VehicleProvider>
        {/* 🎉 Sonner Toaster - Notifications modernes */}
        <Toaster 
          position="top-right"
          expand={true}
          richColors
          closeButton
        />
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
        case 412:
          return (
            <Error412
              condition={error.data?.condition}
              requirement={error.data?.requirement}
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