// Redirection pour les anciennes URLs sans .html vers les nouvelles avec .html
// Format ancien: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}
// Format nouveau: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
import { redirect, type LoaderFunctionArgs } from "react-router";
import { useRouteError, isRouteErrorResponse } from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { buildCacheHeaders } from "~/utils/cache-control";
import { detectMalformedSegment } from "~/utils/pieces-route.utils";

// 🔒 Shim 301 (→ .html) qui throw aussi 400 (nu) et 404 (inline noindex). Sans ce
// `headers` export, Remix v2 DROP ces directives. `defaultErrorRobots` couvre le 400
// nu ; le 404 inline est propagé tel quel. Voir gotcha Remix headers-export (#798/#800).
export const headers = buildCacheHeaders("no-cache", {
  defaultErrorRobots: "noindex, follow",
});

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
