// 🚀 ENHANCED ROOT.TSX - Version Optimisée
// Combine le meilleur du code existant + services backend réels

import { type RemixService } from "@fafa/backend";
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
import { getOptionalUser } from "./auth/unified.server";
import { Error404, Error410, Error412, ErrorGeneric } from "./components/errors";
import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
import { NotificationContainer, NotificationProvider } from "./components/notifications/NotificationContainer";
// @ts-ignore
import stylesheet from "./global.css?url";
import logo from "./routes/_assets/logo-automecanik-dark.png";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  // Preconnect optimisations
  { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
  { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
  // Fonts preload
  { rel: "preload", as: "font", href: "/fonts/rubik-v14-latin-regular.woff2", type: "font/woff2", crossOrigin: "anonymous" },
  // Favicon
  { rel: "shortcut icon", href: "/favicon.ico", type: "image/x-icon" },
];

export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { name: "viewport", content: "width=device-width, initial-scale=1, shrink-to-fit=no" },
];

// 🔥 ENHANCED LOADER - Utilise les services backend réels
export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // 🚀 Utilisation des services backend optimisés disponibles
    const [metadata, analytics, breadcrumbs] = await Promise.allSettled([
      // OptimizedMetadataService - Service réel ✅
      fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/metadata${pathname}`).then(res => 
        res.ok ? res.json() : null
      ).catch(() => null),
      
      // AnalyticsConfigurationService - Service réel ✅  
      fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/analytics/config`).then(res => 
        res.ok ? res.json() : null
      ).catch(() => null),
      
      // OptimizedBreadcrumbService - Service réel ✅
      fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/breadcrumb${pathname}`).then(res => 
        res.ok ? res.json() : null  
      ).catch(() => null),
    ]);

    // Fallback métadonnées par défaut si service indisponible
    const defaultMetadata = {
      title: "AutoMecanik - Pièces Auto & Services",
      description: "Trouvez vos pièces auto et services mécaniques. Diagnostic, réparation, entretien automobile.",
      keywords: ["pièces auto", "garage", "réparation automobile", "diagnostic"],
      canonicalUrl: `${url.origin}${pathname}`,
    };

    const resolvedMetadata = metadata.status === 'fulfilled' && metadata.value?.data 
      ? metadata.value.data 
      : defaultMetadata;

    const resolvedAnalytics = analytics.status === 'fulfilled' && analytics.value?.data
      ? analytics.value.data
      : { isActive: false, script: '', trackingId: '' };

    const resolvedBreadcrumbs = breadcrumbs.status === 'fulfilled' && breadcrumbs.value?.data
      ? breadcrumbs.value.data
      : [];

    return json({ 
      user,
      metadata: resolvedMetadata,
      analytics: resolvedAnalytics,
      breadcrumbs: resolvedBreadcrumbs,
      pathname,
    });
  } catch (error) {
    console.error('❌ Erreur loader root:', error);
    
    // Fallback en cas d'erreur totale
    return json({ 
      user,
      metadata: {
        title: "AutoMecanik",
        description: "Pièces Auto & Services",
        keywords: [],
      },
      analytics: { isActive: false, script: '', trackingId: '' },
      breadcrumbs: [],
      pathname,
    });
  }
};

export const useOptionalUser = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  if (!data) {
    console.warn('Root loader was not run - returning null user');
    return null;
  }
  return data.user;
};

// 🔧 Enhanced hook pour métadonnées
export const usePageMetadata = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.metadata || null;
};

// 🔧 Enhanced hook pour analytics  
export const useAnalyticsConfig = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.analytics || null;
};

// 🔧 Enhanced hook pour breadcrumbs
export const useBreadcrumbs = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.breadcrumbs || [];
};

declare module "@remix-run/node" {
  interface AppLoadContext {
    remixService: RemixService;
    remixIntegration?: any;
    parsedBody?: any;
    user: unknown;
  }
}

// 🎨 ENHANCED LAYOUT - Métadonnées dynamiques intégrées
export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as any;
  const user = data?.user;
  const metadata = data?.metadata;
  const analytics = data?.analytics;
  
  return (
    <html lang="fr" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* 🔥 MÉTADONNÉES DYNAMIQUES - OptimizedMetadataService */}
        <title>{metadata?.title || "AutoMecanik"}</title>
        <meta name="description" content={metadata?.description || "Pièces Auto & Services"} />
        {metadata?.keywords && Array.isArray(metadata.keywords) && (
          <meta name="keywords" content={metadata.keywords.join(', ')} />
        )}
        
        {/* Open Graph optimisé */}
        <meta property="og:title" content={metadata?.ogTitle || metadata?.title || "AutoMecanik"} />
        <meta property="og:description" content={metadata?.ogDescription || metadata?.description || "Pièces Auto & Services"} />
        <meta property="og:type" content="website" />
        {metadata?.ogImage && <meta property="og:image" content={metadata.ogImage} />}
        <meta property="og:url" content={metadata?.canonicalUrl || ""} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metadata?.title || "AutoMecanik"} />
        <meta name="twitter:description" content={metadata?.description || "Pièces Auto & Services"} />
        
        {/* Canonical URL */}
        {metadata?.canonicalUrl && <link rel="canonical" href={metadata.canonicalUrl} />}
        
        {/* Robots */}
        <meta name="robots" content={metadata?.robots || "index,follow"} />
        
        <Meta />
        <Links />
        
        {/* 🚀 ANALYTICS DYNAMIQUE - AnalyticsConfigurationService */}
        {analytics?.isActive && analytics?.script && (
          <script dangerouslySetInnerHTML={{ __html: analytics.script }} />
        )}
        
        {/* Schema.org - Breadcrumbs intégrés */}
        {data?.breadcrumbs && data.breadcrumbs.length > 0 && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ 
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": data.breadcrumbs.map((item: any, index: number) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.label,
                "item": item.href ? `${data.pathname.includes('://') ? '' : 'https://automecanik.com'}${item.href}` : undefined
              }))
            })
          }} />
        )}
        
        {/* Schema.org - Organisation */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ 
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "AutoMecanik",
            "url": "https://automecanik.com",
            "logo": "https://automecanik.com/logo-automecanik-dark.png",
            "description": "Spécialiste pièces auto et services mécaniques"
          })
        }} />
      </head>
      <body className="h-full bg-gray-100">
        <NotificationProvider>
          <div className="min-h-screen flex flex-col">
            {/* Header avec informations utilisateur */}
            {user && (
              <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center h-12">
                    <div className="text-sm text-gray-700">
                      Bonjour {user.firstName || user.name} {user.lastName || ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.email}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
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
        
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// 🛡️ ENHANCED ERROR BOUNDARY - Conservé du code existant
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