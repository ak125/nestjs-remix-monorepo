import { type RemixService } from "@fafa/backend";
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from "@remix-run/react";
import { Footer } from "./components/Footer";
import { Navbar } from "./components/Navbar";
// @ts-ignore
import stylesheet from "./global.css?url";
import logo from "./routes/_assets/logo-automecanik-dark.png";
import { getOptionalUser } from "./server/auth.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  return json({ 
    user
  });
};

export const useOptionalUser = () => {
  const data = useRouteLoaderData<typeof loader>("root");

  if (!data) {
    throw new Error('Root loader was not run');
  }
  return data.user;
}

declare module "@remix-run/node" {
  interface AppLoadContext {
    remixService: RemixService; // Changed from 'any' to 'RemixService'
    user: unknown
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
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
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}