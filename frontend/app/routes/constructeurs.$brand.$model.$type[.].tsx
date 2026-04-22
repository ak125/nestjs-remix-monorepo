// Route 301 pour les URLs véhicule se terminant par un point littéral.
// Convention remix-flat-routes : `$type[.]` + `.tsx` = segment `:type.`
// (trailing dot), pas un segment sans extension.
// Utilité : artefacts legacy / liens cassés (ex. mail client qui ajoute un `.`
// en fin d'URL) → redirige vers la variante canonique `.html`.
// Les URLs sans extension sont servies par ./constructeurs.$brand.$model.$type
// (tolérance 200, pas de 301 — confirmé 2026-04-22 comme intentionnel).
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
