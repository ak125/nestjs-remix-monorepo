/**
 * ⚙️ TYPES/MOTORISATIONS D'UN MODÈLE
 *
 * Page des types/motorisations d'un modèle spécifique
 * Route: /brands/$brandId/models/$modelId/types
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link, useParams } from "@remix-run/react";
import {
  ArrowLeft,
  Car,
  Fuel,
  Zap,
  Calendar,
  Settings,
  Info,
} from "lucide-react";
import { BrandLogoClient } from "../components/BrandLogoClient";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { Alert } from "~/components/ui/alert";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "brands",
    canonicalEntity: "vehicle-types",
  }),
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.brand || !data?.model) {
    return [
      { title: "Motorisations | Automecanik" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  const title = `${data.brand.marque_name} ${data.model.modele_name} - Motorisations | Automecanik`;
  const description = `Découvrez les ${data.stats?.totalTypes || ""} motorisations ${data.brand.marque_name} ${data.model.modele_name}. Trouvez vos pièces détachées par type de moteur.`;

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

interface VehicleType {
  type_id: number;
  type_name: string;
  type_year_from: number;
  type_year_to: number | null;
  type_engine_code: string;
  type_fuel_type: string;
  type_power_hp: number;
  type_power_kw: number;
  type_engine_displacement: number | null;
  type_body_type: string;
  type_drive_type: string;
  type_transmission_type: string;
}

interface Model {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
}

interface Brand {
  marque_id: number;
  marque_name: string;
}

interface LoaderData {
  types: VehicleType[];
  model: Model | null;
  brand: Brand | null;
  stats: {
    totalTypes: number;
    activePeriod: string;
    fuelTypes: string[];
    powerRange: { min: number; max: number };
  };
  error?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { brandId, modelId } = params;

  if (!brandId || !modelId) {
    throw new Response("Brand ID et Model ID requis", { status: 400 });
  }

  const baseUrl = getInternalApiUrl("");

  try {
    // Récupérer les types du modèle
    const typesResponse = await fetch(
      `${baseUrl}/api/vehicles/models/${modelId}/types`,
      {
        headers: { "internal-call": "true" },
      },
    );

    if (!typesResponse.ok) {
      throw new Error(`API Error: ${typesResponse.status}`);
    }

    const typesData = await typesResponse.json();
    const types: VehicleType[] =
      typesData.data?.map((type: any) => ({
        type_id: type.type_id,
        type_name: type.type_name,
        type_year_from: type.type_year_from,
        type_year_to: type.type_year_to,
        type_engine_code: type.type_engine_code || "N/A",
        type_fuel_type: type.type_fuel_type || "Essence",
        type_power_hp: type.type_power_hp || 0,
        type_power_kw: type.type_power_kw || 0,
        type_engine_displacement: type.type_engine_displacement,
        type_body_type: type.type_body_type || "Berline",
        type_drive_type: type.type_drive_type || "FWD",
        type_transmission_type: type.type_transmission_type || "Manuelle",
      })) || [];

    // Récupérer les infos du modèle
    const modelResponse = await fetch(
      `${baseUrl}/api/vehicles/models/${modelId}`,
      {
        headers: { "internal-call": "true" },
      },
    );

    let model: Model | null = null;
    if (modelResponse.ok) {
      const modelData = await modelResponse.json();
      if (modelData.data) {
        model = {
          modele_id: modelData.data.modele_id,
          modele_name: modelData.data.modele_name,
          modele_alias: modelData.data.modele_alias,
        };
      }
    }

    // Récupérer les infos de la marque
    const brandsResponse = await fetch(`${baseUrl}/api/vehicles/brands`);
    let brand = null;
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      brand =
        brandsData.data?.find((b: any) => b.marque_id.toString() === brandId) ||
        null;
    }

    // Calculer les statistiques
    const fuelTypes = [...new Set(types.map((t) => t.type_fuel_type))];
    const powers = types.map((t) => t.type_power_hp).filter((p) => p > 0);
    const years = types.map((t) => t.type_year_from);

    const stats = {
      totalTypes: types.length,
      activePeriod:
        types.length > 0
          ? `${Math.min(...years)} - ${new Date().getFullYear()}`
          : "N/A",
      fuelTypes,
      powerRange:
        powers.length > 0
          ? { min: Math.min(...powers), max: Math.max(...powers) }
          : { min: 0, max: 0 },
    };

    return json({ types, model, brand, stats } as LoaderData);
  } catch (error) {
    logger.error("Erreur chargement types:", error);
    return json({
      types: [],
      model: null,
      brand: null,
      stats: {
        totalTypes: 0,
        activePeriod: "N/A",
        fuelTypes: [],
        powerRange: { min: 0, max: 0 },
      },
      error: "Impossible de charger les types",
    } as LoaderData);
  }
}

export default function BrandModelTypes() {
  const { types, model, brand, stats, error } = useLoaderData<typeof loader>();
  const params = useParams();

  // Fonction pour obtenir l'icône de carburant
  const getFuelIcon = (fuelType: string) => {
    const fuel = fuelType.toLowerCase();
    if (fuel.includes("diesel")) return <Fuel className="h-4 w-4 text-black" />;
    if (fuel.includes("electr") || fuel.includes("hybrid"))
      return <Zap className="h-4 w-4 text-green-500" />;
    return <Fuel className="h-4 w-4 text-blue-500" />;
  };

  // Fonction pour obtenir la couleur du badge carburant
  const getFuelBadgeVariant = (fuelType: string) => {
    const fuel = fuelType.toLowerCase();
    if (fuel.includes("diesel")) return "secondary";
    if (fuel.includes("electr") || fuel.includes("hybrid")) return "default";
    return "outline";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <PublicBreadcrumb
        items={[
          { label: "Marques", href: "/brands" },
          {
            label: brand?.marque_name || `Marque #${params.brandId}`,
            href: `/brands/${params.brandId}`,
          },
          {
            label: model?.modele_name || "Modèle",
            href: `/brands/${params.brandId}`,
          },
          { label: "Motorisations" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          {brand && (
            <div className="w-16 h-16">
              <BrandLogoClient logoPath={null} brandName={brand.marque_name} />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {model?.modele_name || `Modèle #${params.modelId}`}
            </h1>
            <p className="text-xl text-gray-600 mt-1">
              Motorisations {brand?.marque_name}
            </p>
            <p className="text-gray-500">
              {stats.totalTypes} configurations disponibles
            </p>
          </div>
        </div>

        <Link to={`/brands/${params.brandId}`}>
          <Button variant="outline" className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour au modèle</span>
          </Button>
        </Link>
      </div>

      {error && (
        <Alert intent="error">
          <strong>Erreur :</strong> {error}
        </Alert>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Configurations
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalTypes}
                </p>
              </div>
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Période</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.activePeriod}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Puissance</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.powerRange.min}-{stats.powerRange.max} cv
                </p>
              </div>
              <Zap className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Carburants</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.fuelTypes.length}
                </p>
              </div>
              <Fuel className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des types/motorisations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Car className="h-5 w-5 mr-2" />
            Motorisations disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {types.length > 0 ? (
            <div className="space-y-4">
              {types.map((type) => (
                <div
                  key={type.type_id}
                  className="p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    {/* Infos principales */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {type.type_name}
                        </h3>
                        <Badge
                          variant={getFuelBadgeVariant(type.type_fuel_type)}
                        >
                          {getFuelIcon(type.type_fuel_type)}
                          <span className="ml-1">{type.type_fuel_type}</span>
                        </Badge>
                        <Badge variant="outline">
                          {type.type_year_from}
                          {type.type_year_to
                            ? ` - ${type.type_year_to}`
                            : " - Actuel"}
                        </Badge>
                      </div>

                      {/* Grille des spécifications */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">
                            Code moteur
                          </p>
                          <p className="text-sm font-mono bg-gray-50 px-2 py-1 rounded">
                            {type.type_engine_code}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">
                            Puissance
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">
                              {type.type_power_hp} cv
                            </span>
                            <span className="text-gray-500">
                              {" "}
                              ({type.type_power_kw} kW)
                            </span>
                          </p>
                        </div>

                        {type.type_engine_displacement && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-600">
                              Cylindrée
                            </p>
                            <p className="text-sm font-semibold">
                              {(type.type_engine_displacement / 1000).toFixed(
                                1,
                              )}
                              L
                            </p>
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">
                            Transmission
                          </p>
                          <p className="text-sm">
                            {type.type_transmission_type}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="ml-4">
                      <Button size="sm" variant="outline">
                        <Info className="h-4 w-4 mr-1" />
                        Détails
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Aucune motorisation trouvée
              </h3>
              <p className="text-gray-500">
                Aucune configuration disponible pour ce modèle.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
