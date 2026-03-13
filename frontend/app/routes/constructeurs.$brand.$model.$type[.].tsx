// Redirection pour les anciennes URLs sans .html vers les nouvelles avec .html
// Format ancien: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}
// Format nouveau: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { detectMalformedSegment } from "~/utils/pieces-route.utils";

export async function loader({ params }: LoaderFunctionArgs) {
  const { brand, model, type } = params;

  if (!brand || !model || !type) {
    throw new Response("Parameters missing", { status: 400 });
  }

  // Guard: URLs mal formées → 404 direct (pas de redirect inutile)
  const malformedReason = detectMalformedSegment(brand, model, type);
  if (malformedReason) {
    throw new Response(JSON.stringify({ reason: malformedReason }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Redirection permanente (301) vers la version avec .html
  return redirect(`/constructeurs/${brand}/${model}/${type}.html`, 301);
}

export default function RedirectRoute() {
  // Ce composant ne sera jamais rendu car on redirige toujours
  return null;
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
