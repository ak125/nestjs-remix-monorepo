/**
 * 🚗 MODÈLES DE MARQUE COMMERCIALE
 *
 * Page des modèles d'une marque automobile pour l'équipe commerciale
 * Route: /commercial/vehicles/brands/$brandId/models
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import { useLoaderData, Link, useParams } from "@remix-run/react";
import { ArrowLeft, Car, Settings, Search } from "lucide-react";
import { Alert } from "~/components/ui/alert";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Modeles par Marque - Commercial");

interface Model {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_year_from: number;
  modele_year_to: number | null;
  modele_body: string;
}

interface LoaderData {
  models: Model[];
  brand: {
    marque_id: number;
    marque_name: string;
  } | null;
  error?: string;
}

export async function loader({ context, params }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });

  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect("/unauthorized");
  }

  const { brandId } = params;
  if (!brandId) {
    throw new Response("Brand ID manquant", { status: 400 });
  }

  const baseUrl = getInternalApiUrl("");

  try {
    // Récupérer les modèles de la marque
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
    const brandsResponse = await fetch(`${baseUrl}/api/vehicles/brands`, {
      headers: { "internal-call": "true" },
    });

    let brand = null;
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      brand =
        brandsData.data?.find((b: any) => b.marque_id.toString() === brandId) ||
        null;
    }

    return json({ models, brand } as LoaderData);
  } catch (error) {
    logger.error("Erreur chargement modèles:", error);
    return json({
      models: [],
      brand: null,
      error: "Impossible de charger les modèles",
    } as LoaderData);
  }
}

export default function CommercialVehiclesBrandModels() {
  const { models, brand, error } = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <PublicBreadcrumb
                items={[
                  { label: "Commercial", href: "/commercial" },
                  { label: "Véhicules", href: "/commercial/vehicles" },
                  { label: "Marques", href: "/commercial/vehicles/brands" },
                  { label: brand?.marque_name || `Marque #${params.brandId}` },
                ]}
              />
              <h1 className="text-2xl font-bold text-gray-900">
                Modèles {brand?.marque_name || `#${params.brandId}`}
              </h1>
              <p className="text-gray-600 mt-1">
                {models.length} modèles disponibles
              </p>
            </div>

            <Link to="/commercial/products/brands">
              <Button variant="outline" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Retour aux marques</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total modèles
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {models.length}
                  </p>
                </div>
                <Car className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Actifs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {models.filter((m) => !m.modele_year_to).length}
                  </p>
                </div>
                <Settings className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Anciens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {models.filter((m) => m.modele_year_to).length}
                  </p>
                </div>
                <Search className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Période</p>
                  <p className="text-lg font-bold text-gray-900">
                    {models.length > 0
                      ? `${Math.min(...models.map((m) => m.modele_year_from))} - ${new Date().getFullYear()}`
                      : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des modèles */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des modèles</CardTitle>
          </CardHeader>
          {error ? (
            <CardContent>
              <Alert intent="error">
                <p>{error}</p>
              </Alert>
            </CardContent>
          ) : models.length > 0 ? (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {models.map((model) => (
                  <div
                    key={model.modele_id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Car className="h-6 w-6 text-purple-600" />
                      </div>
                      <span className="text-xs text-gray-500">
                        #{model.modele_id}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 text-lg mb-2">
                      {model.modele_name}
                    </h3>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Période:</span>{" "}
                        {model.modele_year_from}
                        {model.modele_year_to
                          ? ` - ${model.modele_year_to}`
                          : " - Actuel"}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Type:</span>{" "}
                        {model.modele_body}
                      </p>
                      {model.modele_alias && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Alias:</span>{" "}
                          {model.modele_alias}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          model.modele_year_to
                            ? "bg-gray-100 text-gray-700"
                            : "bg-success/15 text-green-700"
                        }`}
                      >
                        {model.modele_year_to ? "Ancien" : "Actuel"}
                      </span>
                      <Link
                        to={`/commercial/vehicles/models/${model.modele_id}/types`}
                      >
                        <Button variant="outline" size="sm">
                          Voir types
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="text-center py-8">
                <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  Aucun modèle trouvé pour cette marque
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
