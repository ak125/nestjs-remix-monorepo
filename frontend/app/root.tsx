import { type RemixService } from "@fafa/backend";
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from "@remix-run/react";
import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
import { NotificationContainer } from "./components/notifications/NotificationContainer";
// @ts-ignore
import stylesheet from "./global.css?url";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import logo from "./routes/_assets/logo-automecanik-dark.png"; // TODO: utiliser dans l'interface
import { getOptionalUser } from "./server/auth.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
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
  const _data = useRouteLoaderData("root") as { user: any } | undefined;
  
  return (
    <html lang="fr" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-gray-100">
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
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}