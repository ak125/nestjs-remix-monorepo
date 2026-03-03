/**
 * 🚗 PAGE PUBLIQUE MARQUE
 *
 * Version publique inspirée de l'existant commercial optimisé
 * Route: /brands/$brandId
 *
 * Rôle SEO : R1 - ROUTER
 * Intention : Navigation vers modèles d'une marque
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link, useParams } from "@remix-run/react";
import { ArrowLeft, Car, Calendar, Settings } from "lucide-react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { Alert } from "~/components/ui/alert";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { BrandLogoClient } from "../components/BrandLogoClient";
import { Container, Section, ResponsiveGrid } from "../components/layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "brands",
  }),
};

/**
 * 🔍 SEO Meta Tags
 */
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  const brandName = data?.brand?.marque_name || "Marque";
  const modelsCount = data?.models?.length || 0;
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;
  const title = `Pièces Détachées ${brandName} | ${modelsCount} Modèles Disponibles`;
  const description = `Trouvez toutes les pièces détachées pour votre ${brandName}. ${modelsCount} modèles disponibles avec livraison rapide. Pièces auto ${brandName} de qualité.`;

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

interface Model {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_year_from: number;
  modele_year_to: number | null;
  modele_body: string;
}

interface Brand {
  marque_id: number;
  marque_name: string;
}

interface LoaderData {
  models: Model[];
  brand: Brand | null;
  types: any[];
  error?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { brandId } = params;
  if (!brandId) {
    throw new Response("Brand ID manquant", { status: 400 });
  }

  const baseUrl = getInternalApiUrl("");

  try {
    // Récupérer les modèles de la marque (utilise l'API existante optimisée)
    const modelsResponse = await fetch(
      `${baseUrl}/api/vehicles/brands/${brandId}/models`,
      {
        headers: { "internal-call": "true" },
      },
    );

    if (!modelsResponse.ok) {
      throw new Error(`API Error: ${modelsResponse.status}`);
    }

    const modelsData = await modelsResponse.json();
    const models: Model[] =
      modelsData.data?.map((model: any) => ({
        modele_id: model.modele_id,
        modele_name: model.modele_name,
        modele_alias: model.modele_alias,
        modele_year_from: model.modele_year_from,
        modele_year_to: model.modele_year_to,
        modele_body: model.modele_body || "Non spécifié",
      })) || [];

    // Récupérer les infos de la marque
    const brandsResponse = await fetch(`${baseUrl}/api/vehicles/brands`);
    let brand = null;
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      brand =
        brandsData.data?.find((b: any) => b.marque_id.toString() === brandId) ||
        null;
    }

    // Récupérer quelques types pour affichage (optionnel)
    const types: any[] = [];

    return json({ models, brand, types } as LoaderData);
  } catch (error) {
    logger.error("Erreur chargement marque:", error);
    return json({
      models: [],
      brand: null,
      types: [],
      error: "Impossible de charger les données",
    } as LoaderData);
  }
}

export default function BrandPage() {
  const { models, brand, types, error } = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <div className="py-section">
      {/* Breadcrumb */}
      <Container className="mb-4">
        <PublicBreadcrumb
          items={[
            { label: "Marques", href: "/brands" },
            { label: brand?.marque_name || `Marque #${params.brandId}` },
          ]}
        />
      </Container>

      {/* Header avec logo de marque */}
      <Section variant="white" spacing="sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {brand && (
              <div className="w-16 h-16">
                <BrandLogoClient
                  logoPath={null}
                  brandName={brand.marque_name}
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {brand?.marque_name || `Marque #${params.brandId}`}
              </h1>
              <p className="text-gray-600 mt-1">
                {models.length} modèles disponibles
              </p>
            </div>
          </div>

          <Link to="/brands">
            <Button variant="outline" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Retour aux marques</span>
            </Button>
          </Link>
        </div>
      </Section>

      {error && (
        <Container className="mb-6">
          <Alert intent="error">
            <strong>Erreur :</strong> {error}
          </Alert>
        </Container>
      )}

      {/* Section Modèles */}
      <Section variant="white" spacing="sm">
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <Car className="h-6 w-6 mr-2 text-primary" />
          Modèles {brand?.marque_name}
        </h2>

        {models.length > 0 ? (
          <ResponsiveGrid cols={{ base: 1, md: 2, lg: 3 }} gap="md">
            {models.map((model) => (
              <Card
                key={model.modele_id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-primary/5 rounded-lg">
                      <Car className="h-5 w-5 text-primary" />
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        model.modele_year_to
                          ? "bg-gray-100 text-gray-700"
                          : "bg-success/15 text-emerald-700"
                      }`}
                    >
                      {model.modele_year_to ? "Ancien" : "Actuel"}
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg mb-2">
                    {model.modele_name}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {model.modele_year_from}
                      {model.modele_year_to
                        ? ` - ${model.modele_year_to}`
                        : " - Actuel"}
                    </p>
                    <p className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      {model.modele_body}
                    </p>
                  </div>

                  {model.modele_alias && (
                    <p className="text-sm text-gray-500 mt-2">
                      Alias: {model.modele_alias}
                    </p>
                  )}

                  {/* Navigation vers les motorisations */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Link
                      to={`/brands/${params.brandId}/models/${model.modele_id}/types`}
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        Voir motorisations
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </ResponsiveGrid>
        ) : (
          <div className="text-center py-12">
            <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucun modèle disponible</p>
          </div>
        )}
      </Section>

      {/* Section Motorisations (si disponible) */}
      {types && types.length > 0 && (
        <Section variant="white" spacing="sm">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <Settings className="h-6 w-6 mr-2 text-emerald-600" />
            Motorisations disponibles
          </h2>
          <ResponsiveGrid cols={{ base: 1, md: 2, lg: 3 }} gap="sm">
            {types.map((type) => (
              <Card key={type.id}>
                <CardContent className="p-4">
                  <h3 className="font-medium text-lg">{type.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {type.engine_code} - {type.fuel_type} - {type.power_hp}cv
                  </p>
                </CardContent>
              </Card>
            ))}
          </ResponsiveGrid>
        </Section>
      )}
    </div>
  );
}
