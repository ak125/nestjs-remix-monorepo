// 🔄 Route catch-all centralisée pour /constructeurs/*
// Gère : URLs 2-segments (funnel motorisation), URLs legacy, redirections
//
// Rôle SEO : R1 - ROUTER
// Intention : Sélection de motorisation

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "@remix-run/react";
import { Car, ChevronRight, Fuel, Gauge, Calendar } from "lucide-react";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { normalizeTypeAlias } from "~/utils/url-builder.utils";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "constructeurs",
  }),
};

interface MotorOption {
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
}

interface LoaderData {
  type: "motorization_selector";
  brand: { id: number; name: string; alias: string };
  model: { id: number; name: string; alias: string };
  motorizations: MotorOption[];
  seo: {
    title: string;
    description: string;
    h1: string;
    canonical: string;
  };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const catchAll = params["*"];

  logger.log(
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
  // Pattern 2 segments: /constructeurs/{marque}/{modele}.html → 200 avec sélection
  // Exemple: /constructeurs/renault-140/clio-5-140002.html
  // SEO: Page indexable avec contenu réel (liste des motorisations)
  // ============================================
  if (segments.length === 2) {
    const [brand, model] = segments;

    // Parser les slugs (format: alias-ID)
    const brandMatch = brand.match(/^(.+)-(\d+)$/);
    const modelMatch = model.match(/^(.+)-(\d+)$/);

    const rawMarqueAlias = brandMatch ? brandMatch[1] : brand;
    const marqueId = brandMatch ? parseInt(brandMatch[2], 10) : 0;
    const rawModeleAlias = modelMatch ? modelMatch[1] : model;
    const modeleId = modelMatch ? parseInt(modelMatch[2], 10) : 0;

    // Normalize aliases: remove leading/trailing dashes and collapse multiple dashes
    const marqueAlias = rawMarqueAlias
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const modeleAlias = rawModeleAlias
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for non-canonical URL (double dashes, etc.) and redirect to canonical
    const expectedBrand = `${marqueAlias}-${marqueId}`;
    const expectedModel = `${modeleAlias}-${modeleId}`;
    if (brand !== expectedBrand || model !== expectedModel) {
      logger.log(
        `[ConstructeursCatchAll] 301 redirect: ${brand}/${model} → ${expectedBrand}/${expectedModel}`,
      );
      return redirect(
        `/constructeurs/${expectedBrand}/${expectedModel}.html`,
        301,
      );
    }

    // Fetch motorisations disponibles
    const apiUrl = new URL(request.url);
    const baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
    let motorOptions: MotorOption[] = [];

    try {
      if (modeleId) {
        const response = await fetch(
          `${baseUrl}/api/hierarchy/types?modele_id=${modeleId}`,
          { headers: { "User-Agent": "RemixSSR", Accept: "application/json" } },
        );
        if (response.ok) {
          const data = await response.json();
          // Filter out types with null type_name (invalid motorizations)
          motorOptions = (data.data || [])
            .filter((type: any) => type.type_name !== null)
            .slice(0, 30)
            .map((type: any) => ({
              id: type.type_id,
              label: type.type_name,
              url: `/constructeurs/${expectedBrand}/${expectedModel}/${normalizeTypeAlias(type.type_alias, type.type_name)}-${type.type_id}.html`,
              description: type.type_alias || type.type_name,
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
      logger.warn("[ConstructeursCatchAll] Erreur fetch types:", error);
    }

    // Si aucune motorisation valide → 410 Gone (modèle sans motorisations disponibles)
    if (motorOptions.length === 0) {
      logger.log(
        `[ConstructeursCatchAll] 410 Gone: modele_id=${modeleId} has no valid motorizations`,
      );
      throw new Response(
        JSON.stringify({
          error: "Model No Longer Available",
          message: "Ce modèle n'a pas de motorisations disponibles",
          modele_id: modeleId,
          code: "MODEL_NO_MOTORS",
        }),
        {
          status: 410,
          statusText: "Gone",
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Formater les noms pour l'affichage
    const capitalizeFirst = (str: string) =>
      str
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    const marqueDisplay = capitalizeFirst(marqueAlias);
    const modeleDisplay = capitalizeFirst(modeleAlias);

    // Retourner 200 avec contenu réel (page indexable avec sélecteur de motorisation)
    const loaderData: LoaderData = {
      type: "motorization_selector",
      brand: { id: marqueId, name: marqueDisplay, alias: marqueAlias },
      model: { id: modeleId, name: modeleDisplay, alias: modeleAlias },
      motorizations: motorOptions,
      seo: {
        title: `Pièces ${marqueDisplay} ${modeleDisplay} - ${motorOptions.length} motorisations | AutoMecanik`,
        description: `Catalogue pièces auto ${marqueDisplay} ${modeleDisplay}. Sélectionnez votre motorisation parmi ${motorOptions.length} versions disponibles pour trouver les pièces compatibles.`,
        h1: `Pièces auto ${marqueDisplay} ${modeleDisplay}`,
        canonical: `https://www.automecanik.com/constructeurs/${marqueAlias}-${marqueId}/${modeleAlias}-${modeleId}.html`,
      },
    };

    return json(loaderData, {
      status: 200, // SEO: Page indexable avec contenu réel
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
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

    logger.log("[LegacyCatchAll] Legacy URL detected:", {
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

        logger.log("[LegacyCatchAll] Vehicle found:", data);

        // Construire la nouvelle URL avec les alias
        const newUrl = `/constructeurs/${data.marque_alias}/${data.modele_alias}/${data.type_alias}`;

        logger.log("[LegacyCatchAll] Redirecting to:", newUrl);

        // Redirection 301 permanente
        return redirect(newUrl, { status: 301 });
      }

      // Véhicule supprimé/introuvable → 410 Gone
      if (response.status === 404 || response.status === 410) {
        logger.log("[LegacyCatchAll] Vehicle gone, type_id:", typeId);

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

      logger.error(
        "[LegacyCatchAll] Unexpected API response:",
        response.status,
      );
    } catch (error) {
      logger.error("[LegacyCatchAll] Error:", error);

      // En cas d'erreur, retourner 404 plutôt que crash
      throw new Response("Vehicle data unavailable", { status: 404 });
    }
  }

  // Autres patterns legacy possibles
  // Pattern : brand-ID.html (page marque)
  const brandLegacyMatch = catchAll.match(/^([a-z0-9-]+)-(\d+)\.html$/i);
  if (brandLegacyMatch) {
    const [, brandSlug, brandId] = brandLegacyMatch;
    logger.log("[LegacyCatchAll] Legacy brand URL:", brandSlug, brandId);

    // Rediriger vers la page marque sans ID
    return redirect(`/constructeurs/${brandSlug}`, { status: 301 });
  }

  // URLs inconnues → 404
  logger.log("[LegacyCatchAll] Unknown pattern, returning 404");
  throw new Response("Not Found", { status: 404 });
}

// Meta function pour SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || data.type !== "motorization_selector") {
    return [
      { title: "Page non trouvée" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: data.seo.canonical },
    { property: "og:title", content: data.seo.title },
    { property: "og:description", content: data.seo.description },
    { property: "og:url", content: data.seo.canonical },
    { property: "og:type", content: "website" },
    // Schema.org BreadcrumbList
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: "https://www.automecanik.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Constructeurs",
            item: "https://www.automecanik.com/constructeurs",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: data.brand.name,
            item: `https://www.automecanik.com/constructeurs/${data.brand.alias}.html`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: data.model.name,
            item: data.seo.canonical,
          },
        ],
      },
    },
  ];
};

// Composant pour la page de sélection de motorisation (200)
export default function ConstructeursCatchAll() {
  const data = useLoaderData<typeof loader>();

  // Page de sélection de motorisation
  if (data?.type === "motorization_selector") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <nav className="bg-white border-b border-gray-200 py-3">
          <div className="container mx-auto px-4">
            <ol className="flex items-center gap-2 text-sm">
              <li>
                <Link to="/" className="text-blue-600 hover:underline">
                  Accueil
                </Link>
              </li>
              <li className="text-gray-400">→</li>
              <li>
                <Link
                  to="/constructeurs"
                  className="text-blue-600 hover:underline"
                >
                  Constructeurs
                </Link>
              </li>
              <li className="text-gray-400">→</li>
              <li>
                <Link
                  to={`/constructeurs/${data.brand.alias}.html`}
                  className="text-blue-600 hover:underline"
                >
                  {data.brand.name}
                </Link>
              </li>
              <li className="text-gray-400">→</li>
              <li className="font-semibold text-gray-900">{data.model.name}</li>
            </ol>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Car className="w-10 h-10" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {data.seo.h1}
              </h1>
              <p className="text-lg text-blue-100 max-w-2xl mx-auto">
                Sélectionnez votre motorisation pour accéder aux pièces
                compatibles avec votre {data.brand.name} {data.model.name}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-blue-200">
                  {data.motorizations.length} motorisations disponibles
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Liste des motorisations */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Choisissez votre motorisation
              </h2>

              <div className="grid gap-4">
                {data.motorizations.map((motor) => (
                  <Link
                    key={motor.id}
                    to={motor.url}
                    className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {motor.label}
                        </h3>

                        {motor.metadata && (
                          <div className="flex flex-wrap gap-3 mt-2">
                            {motor.metadata.fuel && (
                              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                                <Fuel className="w-4 h-4" />
                                {motor.metadata.fuel}
                              </span>
                            )}
                            {motor.metadata.power && (
                              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                                <Gauge className="w-4 h-4" />
                                {motor.metadata.power} ch
                              </span>
                            )}
                            {motor.metadata.years && (
                              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                                <Calendar className="w-4 h-4" />
                                {motor.metadata.years}
                              </span>
                            )}
                            {motor.metadata.body && (
                              <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                                {motor.metadata.body}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                          <ChevronRight className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* CTA retour */}
              <div className="mt-8 text-center">
                <Link
                  to={`/constructeurs/${data.brand.alias}.html`}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Voir tous les modèles {data.brand.name}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer SEO content */}
        <section className="py-8 bg-white border-t border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto prose prose-sm text-gray-600">
              <p>
                Découvrez notre catalogue de pièces auto pour{" "}
                <strong>
                  {data.brand.name} {data.model.name}
                </strong>
                . Nous proposons des pièces de qualité pour toutes les
                motorisations de ce modèle. Sélectionnez votre version ci-dessus
                pour accéder aux pièces 100% compatibles avec votre véhicule.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Sinon, ne rien afficher (redirection gérée par le loader)
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
