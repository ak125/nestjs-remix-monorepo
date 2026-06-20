// 🔄 Route catch-all centralisée pour /constructeurs/*
// Rôle SEO : R1 - ROUTER
//
// Le niveau-modèle 2-segments (/constructeurs/{marque}-{id}/{modele}-{id}.html)
// a été SUPPRIMÉ (décision owner 2026-06-14, ADR-084) : page intermédiaire mince
// sans trafic organique (1 clic / 973 URLs / 71j GSC). Seuls R7 (marque) et R8
// (véhicule, 3-seg) sont des URLs constructeur légitimes. Tout chemin 2-segments
// renvoie désormais 410 Gone + noindex (désindexation propre).

import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { buildCacheHeaders } from "~/utils/cache-control";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "constructeurs",
  }),
};

// 🔒 Route R1 catch-all : ne sert plus que des erreurs (404/410). Ses throws sont
// des `new Response(..., {status})` ; ce `headers` export + `defaultErrorRobots`
// garantissent le noindex car l'interceptor backend supprime le X-Robots-Tag défaut
// pour /constructeurs/ et Remix v2 retomberait sinon sur root.tsx `headers()` SANS
// noindex (vérifié live PROD 2026-05-30 — gotcha Remix headers-export, PR #798/#800).
export const headers = buildCacheHeaders("private, max-age=60", {
  defaultErrorRobots: "noindex, follow",
});

export async function loader({ params }: LoaderFunctionArgs) {
  const catchAll = params["*"];

  logger.log("[ConstructeursCatchAll] CatchAll:", catchAll);

  if (!catchAll) {
    throw new Response("Not Found", { status: 404 });
  }

  const cleanPath = catchAll.replace(/\.html$/, "");
  const segments = cleanPath.split("/").filter(Boolean);

  // ============================================
  // Niveau-modèle 2-segments → 410 Gone (page supprimée — ADR-084)
  // Ex: /constructeurs/{marque}-{id}/{modele}-{id}.html
  // Cache-Control long TTL (Gone permanent) aligné sur le pattern R8 seoError().
  // Le noindex est porté par le `headers` export (defaultErrorRobots) ; on le pose
  // aussi explicitement pour cohérence avec seoError() (route R8 sœur).
  // ============================================
  if (segments.length === 2) {
    logger.log(
      `[ConstructeursCatchAll] 410 Gone (niveau-modèle supprimé): ${cleanPath}`,
    );
    throw new Response(
      JSON.stringify({
        error: "Model Level Removed",
        message:
          "Cette page niveau-modèle n'existe plus. Choisissez votre véhicule depuis la page de la marque.",
        code: "MODEL_LEVEL_GONE",
      }),
      {
        status: 410,
        statusText: "Gone",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
          "X-Robots-Tag": "noindex, follow",
        },
      },
    );
  }

  // Le 1-segment marque (/constructeurs/{brand}-{id}.html) est servi par la route plus
  // spécifique constructeurs.$brand[.]html.tsx (précédence flat-routes) ; il n'atteint
  // jamais ce catch-all. L'ancienne branche 301 legacy était donc morte (cible sans id
  // qui 404 de toute façon) — retirée, ADR-084 suivi. Tout chemin restant → 404.
  logger.log("[ConstructeursCatchAll] Unknown pattern, returning 404");
  logger.log("[ConstructeursCatchAll] Unknown pattern, returning 404");
  throw new Response("Not Found", { status: 404 });
}

// Meta : la route ne sert plus que des erreurs → toujours noindex.
export const meta: MetaFunction<typeof loader> = () => [
  { title: "Page non trouvée" },
  { name: "robots", content: "noindex, nofollow" },
];

// La route ne rend plus de page 200 ; l'affichage des erreurs passe par ErrorBoundary.
export default function ConstructeursCatchAll() {
  return null;
}

// Gestion des erreurs
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 410) {
      return <ErrorGeneric status={410} message="Contenu supprimé" />;
    }
  }

  // Autres erreurs → 404
  return <ErrorGeneric />;
}
