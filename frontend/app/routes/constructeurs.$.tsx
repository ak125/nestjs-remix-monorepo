// 🔄 Route catch-all centralisée pour /constructeurs/*
// Gère : URLs legacy, patterns incomplets (412 funnel), redirections

import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";
import { Error412 } from "~/components/errors/Error412";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const catchAll = params["*"];

  console.log(
    "[ConstructeursCatchAll] URL:",
    request.url,
    "CatchAll:",
    catchAll,
  );

  if (!catchAll) {
    throw new Response("Not Found", { status: 404 });
  }

  // Analyser les segments de l'URL
  const cleanPath = catchAll.replace(/\.html$/, "");
  const segments = cleanPath.split("/").filter(Boolean);

  // ============================================
  // Pattern 2 segments: /constructeurs/{marque}/{modele}.html → 412
  // Exemple: /constructeurs/renault-140/clio-5.html
  // ============================================
  if (segments.length === 2) {
    const [brand, model] = segments;

    // Parser les slugs (format: alias-ID)
    const brandMatch = brand.match(/^(.+)-(\d+)$/);
    const modelMatch = model.match(/^(.+)-(\d+)$/);

    const marqueAlias = brandMatch ? brandMatch[1] : brand;
    const marqueId = brandMatch ? parseInt(brandMatch[2], 10) : 0;
    const modeleAlias = modelMatch ? modelMatch[1] : model;
    const modeleId = modelMatch ? parseInt(modelMatch[2], 10) : 0;

    // Fetch motorisations disponibles
    const apiUrl = new URL(request.url);
    const baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
    let motorOptions: Array<{
      id: number;
      label: string;
      url: string;
      description?: string;
      metadata?: {
        fuel?: string;
        power?: string;
        years?: string;
        body?: string;
      };
    }> = [];

    try {
      if (modeleId) {
        const response = await fetch(
          `${baseUrl}/api/hierarchy/types?modele_id=${modeleId}`,
          { headers: { "User-Agent": "RemixSSR", Accept: "application/json" } },
        );
        if (response.ok) {
          const data = await response.json();
          motorOptions = (data.data || []).slice(0, 20).map((type: any) => ({
            id: type.type_id,
            label: type.type_name,
            url: `/constructeurs/${brand}/${model}/${type.type_alias}-${type.type_id}.html`,
            description: type.type_alias,
            metadata: {
              fuel: type.type_fuel,
              power: type.type_power_ps?.toString(),
              years: type.type_year_to
                ? `${type.type_year_from}-${type.type_year_to}`
                : `${type.type_year_from}+`,
              body: type.type_body,
            },
          }));
        }
      }
    } catch (error) {
      console.warn("[ConstructeursCatchAll] Erreur fetch types:", error);
    }

    // Formater les noms pour l'affichage
    const capitalizeFirst = (str: string) =>
      str
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    const marqueDisplay = capitalizeFirst(marqueAlias);
    const modeleDisplay = capitalizeFirst(modeleAlias);

    // Retourner 412 avec sélection de motorisation
    return json(
      {
        url: request.url,
        condition: "Motorisation requise",
        requirement:
          "Sélectionnez votre motorisation pour voir les pièces compatibles",
        substitution: {
          lock: {
            type: "motor" as const,
            missing: "motorisation",
            known: {
              marque: { id: marqueId, name: marqueDisplay, alias: marqueAlias },
              modele: { id: modeleId, name: modeleDisplay, alias: modeleAlias },
            },
            options: motorOptions,
          },
          seo: {
            title: `${marqueDisplay} ${modeleDisplay} - Choisissez votre motorisation | AutoMecanik`,
            description: `Trouvez les pièces auto pour votre ${marqueDisplay} ${modeleDisplay}. Sélectionnez votre motorisation parmi ${motorOptions.length} versions disponibles.`,
            h1: `Pièces auto ${marqueDisplay} ${modeleDisplay}`,
            canonical: `https://www.automecanik.com/constructeurs/${brand}/${model}.html`,
          },
        },
      },
      {
        status: 412,
        headers: {
          "X-Robots-Tag": "index, follow", // SEO: page funnel indexable
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  }

  // ============================================
  // Pattern legacy : brand-ID/model-ID.html (2 segments avec IDs = type manquant)
  // Exemple: audi-22/80-break-22016.html
  // ============================================
  const legacyMatch = catchAll.match(
    /^([a-z0-9-]+)-(\d+)\/([a-z0-9-]+)-(\d+)\.html$/i,
  );

  if (legacyMatch) {
    const [, brandSlug, brandId, modelSlug, typeId] = legacyMatch;

    console.log("[LegacyCatchAll] Legacy URL detected:", {
      brandSlug,
      brandId,
      modelSlug,
      typeId,
    });

    // Appeler l'API backend pour résoudre les alias
    try {
      const apiUrl = new URL(request.url);
      const baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;

      const response = await fetch(`${baseUrl}/api/vehicles/${typeId}`, {
        headers: {
          "User-Agent": "RemixSSR",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();

        console.log("[LegacyCatchAll] Vehicle found:", data);

        // Construire la nouvelle URL avec les alias
        const newUrl = `/constructeurs/${data.marque_alias}/${data.modele_alias}/${data.type_alias}`;

        console.log("[LegacyCatchAll] Redirecting to:", newUrl);

        // Redirection 301 permanente
        return redirect(newUrl, { status: 301 });
      }

      // Véhicule supprimé/introuvable → 410 Gone
      if (response.status === 404 || response.status === 410) {
        console.log("[LegacyCatchAll] Vehicle gone, type_id:", typeId);

        throw new Response(
          JSON.stringify({
            error: "Vehicle No Longer Available",
            message: "Ce véhicule n'est plus disponible dans notre catalogue",
            type_id: typeId,
            code: "VEHICLE_GONE",
          }),
          {
            status: 410,
            statusText: "Gone",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      console.error(
        "[LegacyCatchAll] Unexpected API response:",
        response.status,
      );
    } catch (error) {
      console.error("[LegacyCatchAll] Error:", error);

      // En cas d'erreur, retourner 404 plutôt que crash
      throw new Response("Vehicle data unavailable", { status: 404 });
    }
  }

  // Autres patterns legacy possibles
  // Pattern : brand-ID.html (page marque)
  const brandLegacyMatch = catchAll.match(/^([a-z0-9-]+)-(\d+)\.html$/i);
  if (brandLegacyMatch) {
    const [, brandSlug, brandId] = brandLegacyMatch;
    console.log("[LegacyCatchAll] Legacy brand URL:", brandSlug, brandId);

    // Rediriger vers la page marque sans ID
    return redirect(`/constructeurs/${brandSlug}`, { status: 301 });
  }

  // URLs inconnues → 404
  console.log("[LegacyCatchAll] Unknown pattern, returning 404");
  throw new Response("Not Found", { status: 404 });
}

// Composant pour les pages 412 (funnel de sélection)
export default function ConstructeursCatchAll() {
  const data = useLoaderData<typeof loader>();

  // Si on a des données de substitution, afficher le funnel 412
  if (data?.substitution) {
    return (
      <Error412
        url={data.url}
        condition={data.condition}
        requirement={data.requirement}
        substitution={data.substitution}
      />
    );
  }

  // Sinon, ne rien afficher (redirection gérée par le loader)
  return null;
}

// Gestion des erreurs
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    // 412 = afficher le funnel
    if (error.status === 412) {
      const errorData = typeof error.data === "object" ? error.data : {};
      return (
        <Error412
          url={errorData.url}
          condition={errorData.condition}
          requirement={errorData.requirement}
          substitution={errorData.substitution}
        />
      );
    }

    // 410 = Gone
    if (error.status === 410) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full text-center p-6">
            <div className="text-6xl mb-4">🚗</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Véhicule retiré du catalogue
            </h1>
            <p className="text-gray-600 mb-6">
              Ce véhicule n'est plus disponible dans notre catalogue.
            </p>
            <a
              href="/constructeurs"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Voir tous les constructeurs
            </a>
          </div>
        </div>
      );
    }
  }

  // Autres erreurs → 404
  return <Error404 />;
}
