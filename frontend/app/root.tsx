import { type LinksFunction, type LoaderFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import { 
  Links, 
  Meta, 
  Outlet, 
  Scripts, 
  ScrollRestoration, 
  useRouteLoaderData,
  useRouteError,
  isRouteErrorResponse 
} from "@remix-run/react";
import { Toaster } from "sonner";

import { getOptionalUser } from "./auth/unified.server";
import { Error404, Error410, Error412, ErrorGeneric } from "./components/errors";
import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
import { NotificationContainer, NotificationProvider } from "./components/notifications/NotificationContainer";
import { CartProvider } from "./contexts/CartContext";
import { VehicleProvider } from "./hooks/useVehiclePersistence";
// @ts-ignore
import stylesheet from "./global.css?url";
// @ts-ignore
import logo from "./routes/_assets/logo-automecanik-dark.png"; // TODO: utiliser dans l'interface
import animationsStylesheet from "./styles/animations.css?url";
// @ts-ignore

export const links: LinksFunction = () => [
  // Stylesheets
  { rel: "stylesheet", href: stylesheet },
  { rel: "stylesheet", href: animationsStylesheet },
  
  // DNS Prefetch & Preconnect (Performance SEO Phase 1)
  { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
  { rel: "preconnect", href: "https://cxpojprgwgubzjyqzmoq.supabase.co" },
  { rel: "preconnect", href: "https://fonts.googleapis.com", crossOrigin: "anonymous" },
  
  // Font Preload (Performance SEO Phase 1)
  { 
    rel: "preload", 
    as: "font", 
    type: "font/woff2", 
    href: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
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

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  return json({ 
    user
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

declare module "@remix-run/node" {
  interface AppLoadContext {
    remixService: any;
    remixIntegration?: any; // injection côté Nest: RemixApiService
    parsedBody?: any;
    user: unknown;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as { user: any } | undefined;
  const user = data?.user;
  
  return (
    <html lang="fr" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-gray-100">
        <CartProvider>
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
        </CartProvider>
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
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return <Error404 url={error.data?.url} suggestions={error.data?.suggestions} />;
      case 410:
        return <Error410 
          url={error.data?.url} 
          isOldLink={error.data?.isOldLink} 
          redirectTo={error.data?.redirectTo} 
        />;
      case 412:
        return <Error412 
          condition={error.data?.condition} 
          requirement={error.data?.requirement} 
        />;
      default:
        return <ErrorGeneric 
          status={error.status} 
          message={error.statusText || error.data?.message}
          details={error.data?.details}
        />;
    }
  }

  // Erreur non-HTTP (erreur JavaScript, etc.)
  const errorMessage = error instanceof Error ? error.message : "Une erreur inattendue s'est produite";
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  return <ErrorGeneric 
    status={500}
    message={errorMessage}
    details="Une erreur technique s'est produite. Nos équipes ont été notifiées."
    showStackTrace={process.env.NODE_ENV === 'development'}
    stack={errorStack}
  />;
}