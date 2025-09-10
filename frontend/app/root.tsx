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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import logo from "./routes/_assets/logo-automecanik-dark.png"; // TODO: utiliser dans l'interface

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { title: "E-Commerce Platform" },
  { viewport: "width=device-width,initial-scale=1" },
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
    remixService: RemixService;
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