import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";

/**
 * Route catch-all pour /gammes/*
 * Redirige automatiquement vers /pieces/*
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params["*"] || "";

  // Redirection permanente vers pieces
  return redirect(`/pieces/${slug}`, { status: 301 });
}

// Cette route ne rend jamais de composant car elle redirige toujours
export default function GammesRedirect() {
  return null;
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
