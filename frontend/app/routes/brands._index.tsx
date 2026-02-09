/**
 * 🏷️ LISTE DES MARQUES AUTOMOBILES
 *
 * Page publique listant toutes les marques automobiles
 * Route: /brands
 *
 * ✨ VERSION avec carousel modèles populaires
 *
 * Rôle SEO : R1 - ROUTER
 * Intention : Sélection de marque
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Search, Car, ArrowRight } from "lucide-react";
import { useState } from "react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { Alert } from "~/components/ui/alert";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { BrandLogoClient } from "../components/BrandLogoClient";
import { BrandLogosCarousel } from "../components/manufacturers/BrandLogosCarousel";
import { FeaturedModelsCarousel } from "../components/manufacturers/FeaturedModelsCarousel";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "brands",
    canonicalEntity: "brands-index",
  }),
};

/**
 * 🔍 SEO Meta Tags
 */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const total = data?.total || 0;
  const title = `Toutes les Marques Automobiles (${total}) | Pièces Détachées Auto`;
  const description = `Découvrez notre catalogue complet de ${total} marques automobiles. Trouvez les pièces détachées pour BMW, Mercedes, Audi, Volkswagen, Renault, Peugeot et toutes les autres marques.`;

  return [
    { title },
    { name: "description", content: description },
    {
      tagName: "link",
      rel: "canonical",
      href: "https://www.automecanik.com/brands",
    },
    { name: "robots", content: "index, follow" },
    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://www.automecanik.com/brands" },
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

interface Brand {
  marque_id: number;
  marque_name: string;
  models_count?: number;
}

interface FeaturedModel {
  type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power: number;
  type_date_range: string;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_image_url: string;
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  url: string;
  seo_title: string;
  seo_description: string;
}

interface BrandLogo {
  id: number;
  alias: string;
  name: string;
  name_meta: string;
  name_title: string;
  logo_url: string | null;
  url: string;
  is_active: boolean;
}

interface LoaderData {
  brands: Brand[];
  total: number;
  popularModels: FeaturedModel[];
  brandLogos: BrandLogo[];
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = getInternalApiUrl("");

  try {
    // Récupérer toutes les marques
    const brandsResponse = await fetch(`${baseUrl}/api/brands`, {
      headers: { "internal-call": "true" },
    });

    if (!brandsResponse.ok) {
      throw new Error(`API Error: ${brandsResponse.status}`);
    }

    const brandsData = await brandsResponse.json();
    const brands: Brand[] =
      brandsData.data?.map((brand: any) => ({
        marque_id: brand.id,
        marque_name: brand.name,
        models_count: brand.models_count || 0,
      })) || [];

    // ✨ Récupérer les modèles populaires
    let popularModels: FeaturedModel[] = [];
    try {
      const modelsResponse = await fetch(
        `${baseUrl}/api/brands/popular-models?limit=8`,
        {
          headers: { "internal-call": "true" },
        },
      );
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        popularModels = modelsData.data || [];
      }
    } catch (error) {
      logger.error("Erreur chargement modèles populaires:", error);
    }

    // ✨ Récupérer les logos de marques
    let brandLogos: BrandLogo[] = [];
    try {
      const logosResponse = await fetch(
        `${baseUrl}/api/brands/brands-logos?limit=18`,
        {
          headers: { "internal-call": "true" },
        },
      );
      if (logosResponse.ok) {
        const logosData = await logosResponse.json();
        brandLogos = logosData.data || [];
      }
    } catch (error) {
      logger.error("Erreur chargement logos:", error);
    }

    return json({
      brands: brands.sort((a, b) => a.marque_name.localeCompare(b.marque_name)),
      total: brands.length,
      popularModels,
      brandLogos,
    } as LoaderData);
  } catch (error) {
    logger.error("Erreur chargement marques:", error);
    return json({
      brands: [],
      total: 0,
      popularModels: [],
      brandLogos: [],
      error: "Impossible de charger les marques",
    } as LoaderData);
  }
}

export default function BrandsIndex() {
  const { brands, total, popularModels, brandLogos, error } =
    useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrage côté client
  const filteredBrands = brands.filter((brand) =>
    brand.marque_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <PublicBreadcrumb items={[{ label: "Marques" }]} />

      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-muted rounded-full">
            <Car className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Marques Automobiles
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Découvrez notre catalogue complet de {total} marques automobiles et
          explorez leurs modèles et spécifications techniques.
        </p>
      </div>

      {/* ✨ Carousel modèles populaires */}
      {popularModels.length > 0 && (
        <div className="mb-16">
          <FeaturedModelsCarousel models={popularModels} />
        </div>
      )}

      {/* ✨ Logos de marques */}
      {brandLogos.length > 0 && (
        <div className="mb-16">
          <BrandLogosCarousel brands={brandLogos} />
        </div>
      )}

      {/* Barre de recherche */}
      <div className="max-w-md mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Rechercher une marque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {error && (
        <Alert intent="error">
          <strong>Erreur :</strong> {error}
        </Alert>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{total}</div>
            <div className="text-gray-600">Marques disponibles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {filteredBrands.length}
            </div>
            <div className="text-gray-600">Résultats affichés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {brands.reduce(
                (sum, brand) => sum + (brand.models_count || 0),
                0,
              )}
            </div>
            <div className="text-gray-600">Modèles au total</div>
          </CardContent>
        </Card>
      </div>

      {/* Grille des marques */}
      {filteredBrands.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredBrands.map((brand) => (
            <Link
              key={brand.marque_id}
              to={`/brands/${brand.marque_id}`}
              className="block"
            >
              <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
                <CardContent className="p-6 text-center">
                  {/* Logo de la marque */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 relative">
                      <BrandLogoClient
                        logoPath={null}
                        brandName={brand.marque_name}
                      />
                    </div>
                  </div>

                  {/* Nom de la marque */}
                  <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {brand.marque_name}
                  </h3>

                  {/* Nombre de modèles */}
                  <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
                    <Car className="h-4 w-4 mr-1" />
                    <span>{brand.models_count || 0} modèles</span>
                  </div>

                  {/* Bouton d'action */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" className="w-full" variant="outline">
                      <span>Explorer</span>
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Aucune marque trouvée
          </h3>
          <p className="text-gray-500">
            {searchTerm
              ? `Aucune marque ne correspond à "${searchTerm}"`
              : "Aucune marque disponible pour le moment"}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center justify-center space-x-2 text-sm text-gray-500">
          <span>Explorez nos marques et découvrez leurs spécifications</span>
        </div>
      </div>
    </div>
  );
}
