// 🎨 VERSION AMÉLIORÉE — PAGE CATALOGUE CONSTRUCTEUR
// Format: /constructeurs/{constructeur}-{id}.html
// Exemple: /constructeurs/bmw-33.html, /constructeurs/renault-140.html
//
// Rôle SEO : R1 - ROUTER
// Intention : Sélection de véhicule par marque

import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  Car,
  Wrench,
  Zap,
  Settings,
  ChevronRight,
  TrendingUp,
  Package,
} from "lucide-react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { Error404 } from "~/components/errors/Error404";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { PopularGammesSection } from "../components/constructeurs/PopularGammesSection";
import { RelatedBrandsSection as _RelatedBrandsSection } from "../components/constructeurs/RelatedBrandsSection";
import { HtmlContent } from "../components/seo/HtmlContent";
import { VehicleImage, PartImage } from "../components/ui/ResponsiveImage";
import VehicleSelector from "../components/vehicle/VehicleSelector";
import { brandApi } from "../services/api/brand.api";
import { brandColorsService } from "../services/brand-colors.service";
import {
  type PopularVehicle,
  type PopularPart as ApiPopularPart,
  type RelatedBrand,
  type PopularGamme,
} from "../types/brand.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "constructeurs",
  }),
};
// 🔗 Composants de maillage interne SEO

// ==========================================
// 🛠️ INTERFACES
// ==========================================

interface _PopularPart {
  category: string;
  icon: string;
  name: string;
  description: string;
  symptoms: string[];
  maintenance: string;
  benefit: string;
  compatibility: string;
  ctaText: string;
}

interface BrandDescription {
  history: string;
  strengths: string[];
  models: string[];
}

// ==========================================
// 🔄 META
// ==========================================

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data || !data.seo) {
    return [{ title: "Pièces Auto" }];
  }

  const canonicalUrl =
    data.seo.canonical || `https://www.automecanik.com${location.pathname}`;
  const brand = data.brand;

  // 🏭 Schema @graph UNIFIÉ pour page constructeur - BreadcrumbList + Organization + ItemLists
  const brandSchema = brand
    ? {
        "@context": "https://schema.org",
        "@graph": [
          // 0️⃣ BreadcrumbList - Fil d'ariane
          {
            "@type": "BreadcrumbList",
            "@id": `${canonicalUrl}#breadcrumb`,
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
                item: "https://www.automecanik.com/constructeurs/",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `Pièces ${brand.marque_name}`,
                item: canonicalUrl,
              },
            ],
          },
          // 1️⃣ Organization - Le constructeur automobile
          {
            "@type": "Organization",
            "@id": `${canonicalUrl}#organization`,
            name: brand.marque_name,
            url: canonicalUrl,
            // ✅ Migration /img/* : URL absolue pour JSON-LD
            logo:
              brand.marque_logo ||
              `https://www.automecanik.com/img/uploads/constructeurs-automobiles/marques-logos/${brand.marque_alias}.webp`,
            additionalType: "https://schema.org/AutomotiveBusiness",
          },
          // 2️⃣ CollectionPage - La page catalogue
          {
            "@type": "CollectionPage",
            "@id": canonicalUrl,
            name: data.seo.title,
            description: data.seo.description,
            url: canonicalUrl,
            about: { "@id": `${canonicalUrl}#organization` },
            mainEntity: { "@id": `${canonicalUrl}#vehicles` },
            breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
          },
          // 3️⃣ ItemList - Véhicules populaires de cette marque
          ...(data.popular_vehicles && data.popular_vehicles.length > 0
            ? [
                {
                  "@type": "ItemList",
                  "@id": `${canonicalUrl}#vehicles`,
                  name: `Véhicules ${brand.marque_name} les plus recherchés`,
                  numberOfItems: data.popular_vehicles.length,
                  itemListElement: data.popular_vehicles
                    .slice(0, 10)
                    .map((vehicle: PopularVehicle, index: number) => ({
                      "@type": "ListItem",
                      position: index + 1,
                      item: {
                        "@type": "Car",
                        name: `${brand.marque_name} ${vehicle.modele_name} ${vehicle.type_name || ""}`.trim(),
                        brand: { "@type": "Brand", name: brand.marque_name },
                        model: vehicle.modele_name,
                        ...(vehicle.type_power_ps && {
                          vehicleEngine: {
                            "@type": "EngineSpecification",
                            enginePower: {
                              "@type": "QuantitativeValue",
                              value: vehicle.type_power_ps,
                              unitCode: "HP",
                            },
                          },
                        }),
                        ...(vehicle.vehicle_url && {
                          url: `https://www.automecanik.com${vehicle.vehicle_url}`,
                        }),
                        ...(vehicle.image_url && { image: vehicle.image_url }),
                      },
                    })),
                },
              ]
            : []),
          // 4️⃣ ItemList - Pièces populaires pour cette marque (sans @type:Product pour éviter erreur offers manquant)
          ...(data.popular_parts && data.popular_parts.length > 0
            ? [
                {
                  "@type": "ItemList",
                  "@id": `${canonicalUrl}#parts`,
                  name: `Pièces ${brand.marque_name} populaires`,
                  numberOfItems: data.popular_parts.length,
                  itemListElement: data.popular_parts
                    .slice(0, 8)
                    .map((part: ApiPopularPart, index: number) => ({
                      "@type": "ListItem",
                      position: index + 1,
                      name: `${part.pg_name} ${brand.marque_name}`,
                      ...(part.part_url && {
                        url: `https://www.automecanik.com${part.part_url}`,
                      }),
                    })),
                },
              ]
            : []),
        ],
      }
    : null;

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "robots", content: data.seo.robots },
    { property: "og:title", content: data.seo.og_title },
    { property: "og:description", content: data.seo.og_description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },

    // ✅ Migration /img/* : Preload via proxy Caddy
    {
      tagName: "link",
      rel: "preload",
      as: "image",
      href:
        brand.marque_logo ||
        `/img/uploads/constructeurs-automobiles/marques-logos/${brand.marque_alias}.webp`,
    },

    // 🏭 JSON-LD Schema Organization
    ...(brandSchema ? [{ "script:ld+json": brandSchema }] : []),
  ];
};

// ==========================================
// 🔄 LOADER
// ==========================================

export async function loader({ params }: LoaderFunctionArgs) {
  const brandSlug = params.brand; // ex: "bmw-33" (car extension .html est dans le nom de fichier)

  if (!brandSlug) {
    throw new Response("Brand not found", { status: 404 });
  }

  // Extraction ID depuis le slug (format: alias-ID)
  const match = brandSlug.match(/^(.*)-(\d+)$/);
  if (!match) {
    throw new Response("Invalid brand slug format", { status: 404 });
  }

  const marque_id = parseInt(match[2], 10);

  try {
    // Récupération des données via l'API optimisée
    const bestsellersResponse = await brandApi.getBrandPageData(marque_id);

    if (!bestsellersResponse.success || !bestsellersResponse.data) {
      throw new Error("Failed to fetch brand data");
    }

    // 🔴 FIX GAP 410: Marque désactivée → 410 Gone
    if (bestsellersResponse.data.brand?.marque_display === 0) {
      throw new Response("Cette marque n'est plus disponible", {
        status: 410,
        headers: {
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return defer(bestsellersResponse.data);
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("Erreur récupération bestsellers:", error);
    throw new Response("Error loading brand page", { status: 500 });
  }
}

// ==========================================
// 🎨 COMPONENT
// ==========================================

export default function BrandCatalogPage() {
  const {
    brand,
    popular_parts,
    popular_vehicles,
    blog_content,
    related_brands,
    popular_gammes,
  } = useLoaderData<typeof loader>();

  // Adapter les noms pour le code existant
  const manufacturer = brand;
  const apiParts = popular_parts;
  const apiVehicles = popular_vehicles;

  // Données de maillage interne
  const _relatedBrands: RelatedBrand[] = related_brands || [];
  const popularGammes: PopularGamme[] = popular_gammes || [];

  // Reconstruction de la description à partir des données disponibles ou fallback
  const brandDescription: BrandDescription = {
    history: blog_content?.content
      ? blog_content.content.replace(/<[^>]*>?/gm, "").substring(0, 300) + "..."
      : `Constructeur automobile proposant une large gamme de véhicules alliant performance et innovation.`,
    strengths: ["Qualité reconnue", "Technologies modernes", "Large réseau"],
    models: [], // On pourrait extraire ça des véhicules populaires si besoin
  };

  // 🎨 Récupérer la couleur thématique du constructeur
  const brandColor = brandColorsService.getBrandGradient(
    manufacturer.marque_alias,
  );

  // 🖼️ Mapping pour les logos qui ont un nom différent de l'alias DB
  const getLogoAlias = (dbAlias: string): string => {
    const logoMapping: Record<string, string> = {
      "mercedes-benz": "mercedes",
      "alfa-romeo": "alfa-romeo",
      // Ajouter d'autres mappings si nécessaire
    };
    return logoMapping[dbAlias] || dbAlias;
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      data-brand={manufacturer.marque_alias?.toLowerCase()}
    >
      {/* 🧭 Fil d'Ariane */}
      <nav
        className="bg-white border-b border-gray-200 py-3"
        aria-label="Breadcrumb"
      >
        <div className="container mx-auto px-4">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link to="/" className="text-blue-600 hover:underline">
                Accueil
              </Link>
            </li>
            <li>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </li>
            <li className="font-semibold text-gray-900">
              {manufacturer.marque_name}
            </li>
          </ol>
        </div>
      </nav>

      {/* 🏎️ Hero Section - Couleur thématique du constructeur */}
      <section
        className="relative overflow-hidden text-white py-12 md:py-16 lg:py-20"
        style={brandColor}
        aria-label="Catalogue constructeur"
      >
        {/* Effet mesh gradient adaptatif */}
        <div
          className="absolute inset-0 z-[1] opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(0,0,0,0.15) 0%, transparent 50%)`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 z-[1] opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: "3rem 3rem",
          }}
          aria-hidden="true"
        />

        {/* Formes décoratives organiques - animations infinies retirées pour LCP */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 bg-white/[0.07] rounded-full blur-3xl z-[1]"
          aria-hidden="true"
        ></div>
        <div
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-black/[0.08] rounded-full blur-3xl z-[1]"
          aria-hidden="true"
        ></div>

        <div className="relative z-10 container mx-auto px-4 max-w-7xl">
          {/* Titre H1 dynamique optimisé SEO - animation retirée pour LCP */}
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-2xl">
                Catalogue pièces auto {manufacturer.marque_name}
              </span>
            </h1>
            <p className="text-white/90 text-base md:text-lg mt-3 drop-shadow-lg">
              Trouvez rapidement les pièces adaptées : entretien, freinage,
              suspension, moteur…
            </p>
          </div>

          {/* Cadre glassmorphism contenant Logo + VehicleSelector */}
          <div className="max-w-5xl mx-auto mb-8 md:mb-10">
            <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] backdrop-blur-none md:backdrop-blur-xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-6 md:p-8 border border-white/30 hover:border-white/50 transition-all duration-500">
              {/* Sous-titre dynamique en haut du cadre */}
              <div className="text-center mb-6">
                <p className="text-white/95 text-base md:text-lg font-semibold drop-shadow-lg">
                  Sélectionnez votre véhicule {manufacturer.marque_name} pour
                  voir les pièces compatibles
                </p>
              </div>

              {/* Layout horizontal : Logo + VehicleSelector côte à côte */}
              <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
                {/* Logo constructeur à gauche */}
                <div className="flex-shrink-0 w-full lg:w-64">
                  <div className="relative group">
                    {/* Cercle décoratif arrière-plan */}
                    <div className="absolute inset-0 -z-10">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition-all duration-700"></div>
                    </div>

                    {/* Container logo */}
                    <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-lg group-hover:border-white/50 transition-all duration-500">
                      <div className="w-full aspect-square flex items-center justify-center">
                        <img
                          src={
                            // ✅ Migration /img/* : Proxy Caddy
                            manufacturer.marque_logo ||
                            `/img/uploads/constructeurs-automobiles/marques-logos/${getLogoAlias(manufacturer.marque_alias)}.webp`
                          }
                          alt={`Logo ${manufacturer.marque_name}`}
                          className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-all duration-700"
                          loading="eager"
                          fetchPriority="high"
                          onError={(e) => {
                            e.currentTarget.src = "/images/default-brand.png";
                            e.currentTarget.onerror = null;
                          }}
                        />
                      </div>
                    </div>

                    {/* Particule décorative - animation retirée pour LCP */}
                    <div
                      className="absolute -bottom-4 -right-4 w-10 h-10 bg-white/15 rounded-full blur-xl"
                      aria-hidden="true"
                    ></div>
                  </div>
                </div>

                {/* VehicleSelector à droite - animation retirée pour LCP */}
                <div className="flex-1 w-full">
                  <VehicleSelector
                    mode="full"
                    variant="card"
                    context="pieces"
                    currentVehicle={{
                      brand: {
                        id: manufacturer.marque_id,
                        name: manufacturer.marque_name,
                      },
                    }}
                    redirectOnSelect={true}
                    redirectTo="vehicle-page"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Trust badges premium - Grid responsive pour mobile */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-3 md:gap-4 max-w-3xl mx-auto animate-in fade-in duration-700 delay-400">
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Car className="w-4 h-4 text-green-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">
                400 000+ pièces
              </span>
            </div>
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Settings className="w-4 h-4 text-blue-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">
                Livraison 24-48h
              </span>
            </div>
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Wrench className="w-4 h-4 text-purple-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">
                Paiement sécurisé
              </span>
            </div>
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Zap className="w-4 h-4 text-orange-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">
                Experts gratuits
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 📦 Pièces populaires depuis l'API */}
      {apiParts.length > 0 && (
        <div className="bg-gradient-to-b from-gray-50 to-white py-12 md:py-16 border-b border-gray-100">
          <div className="container mx-auto px-4">
            {/* En-tête avec gradient de marque */}
            <div className="relative mb-8 md:mb-12">
              <div
                className="relative rounded-2xl p-6 md:p-8 shadow-xl overflow-hidden"
                style={brandColor}
              >
                {/* Effet shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]"></div>
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-white/10 backdrop-blur-sm p-2.5 md:p-3 rounded-xl border border-white/20">
                      <Package className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-0.5 md:mb-1">
                        Pièces {manufacturer.marque_name} populaires
                      </h2>
                      <p className="text-white/80 text-xs md:text-sm">
                        Les pièces les plus recherchées par nos clients
                      </p>
                    </div>
                  </div>

                  {/* Badges compteurs */}
                  <div className="flex items-center gap-2">
                    <div className="bg-white/10 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/20">
                      <span className="text-white font-bold text-base md:text-lg">
                        {apiParts.length}
                      </span>
                      <span className="text-white/80 text-xs md:text-sm ml-1.5">
                        pièces
                      </span>
                    </div>
                    {/* Indicateur SEO enrichi */}
                    {apiParts.filter((p) => p.seo_switch_content).length >
                      0 && (
                      <div
                        className="hidden sm:flex items-center gap-1.5 bg-green-500/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-green-400/30"
                        title="Descriptions SEO enrichies"
                      >
                        <Zap className="w-3.5 h-3.5 text-green-300" />
                        <span className="text-green-200 text-xs font-medium">
                          {apiParts.filter((p) => p.seo_switch_content).length}{" "}
                          SEO
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4"
              role="list"
              aria-label={`Pièces populaires ${manufacturer.marque_name}`}
            >
              {apiParts.map((part, index) => (
                <div
                  key={`${part.cgc_pg_id}-${part.cgc_type_id}-${index}`}
                  role="listitem"
                >
                  <ApiPartCard
                    part={part}
                    brandAlias={manufacturer.marque_alias}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🚗 Véhicules les plus recherchés */}
      {apiVehicles.length > 0 && (
        <div className="bg-gradient-to-b from-white to-gray-50 py-10 md:py-16 border-b border-gray-100">
          <div className="container mx-auto px-4">
            {/* En-tête avec gradient de marque atténué */}
            <div className="relative mb-6 md:mb-12">
              <div
                className="relative rounded-2xl p-4 md:p-8 shadow-xl overflow-hidden"
                style={{
                  backgroundImage: brandColor.backgroundImage
                    .replace("to bottom right", "to bottom right")
                    .replace(/\)/g, ", rgba(0,0,0,0.15))"),
                }}
              >
                {/* Effet shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]"></div>
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 backdrop-blur-sm p-2.5 md:p-3 rounded-xl border border-white/20">
                      <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-0.5 md:mb-1">
                        Véhicules {manufacturer.marque_name} les plus recherchés
                      </h2>
                      <p className="text-white/80 text-xs md:text-sm">
                        Découvrez les modèles préférés de nos clients
                      </p>
                    </div>
                  </div>

                  {/* Badge avec backdrop-blur */}
                  <div className="bg-white/10 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/20">
                    <span className="text-white font-bold text-base md:text-lg">
                      {apiVehicles.length}
                    </span>
                    <span className="text-white/80 text-xs md:text-sm ml-1.5 md:ml-2">
                      véhicules
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
              role="list"
              aria-label={`Véhicules ${manufacturer.marque_name} populaires`}
            >
              {apiVehicles.map((vehicle) => (
                <div key={vehicle.cgc_type_id} role="listitem">
                  <VehicleCard vehicle={vehicle} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔗 Maillage interne - Gammes populaires pour cette marque */}
      {popularGammes.length > 0 && (
        <PopularGammesSection
          gammes={popularGammes}
          brandName={manufacturer.marque_name}
          brandAlias={manufacturer.marque_alias}
          brandId={manufacturer.marque_id}
          className="bg-white border-b border-gray-100"
        />
      )}

      {/* 📘 Présentation Constructeur */}
      <div className="bg-white py-8 md:py-12 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">
            À propos de {manufacturer.marque_name}
          </h2>
          <div className="prose max-w-none">
            {blog_content?.content ? (
              <HtmlContent
                html={blog_content.content}
                trackLinks={true}
                className=""
              />
            ) : (
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {brandDescription.history}
              </p>
            )}

            {brandDescription.strengths.length > 0 && (
              <div className="mb-6 mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Points forts
                </h3>
                <ul className="space-y-2">
                  {brandDescription.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">✔</span>
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JSON-LD unifié dans meta function - voir brandSchema */}
    </div>
  );
}

// 🚗 Composant Carte de véhicule API - Version améliorée avec SEO complet
function VehicleCard({ vehicle }: { vehicle: PopularVehicle }) {
  // 🔑 Gestion des valeurs nulles et formatage
  const yearRange =
    vehicle.seo_year_range ||
    (vehicle.type_year_to
      ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
      : `depuis ${vehicle.type_year_from}`);

  // Titre SEO complet : "Pièces auto RENAULT CLIO II 1.9 D"
  const seoTitle = `Pièces auto ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`;

  // Détection du carburant depuis type_fuel ou type_name
  const detectFuel = (): string | null => {
    const fuel = vehicle.type_fuel?.toLowerCase() || "";
    const typeName = vehicle.type_name?.toLowerCase() || "";

    if (
      fuel.includes("diesel") ||
      typeName.includes("dti") ||
      typeName.includes("dci") ||
      typeName.includes(" d ") ||
      typeName.match(/\bd\b/)
    ) {
      return "Diesel";
    }
    if (
      fuel.includes("essence") ||
      fuel.includes("petrol") ||
      typeName.includes("tsi") ||
      typeName.includes("tfsi")
    ) {
      return "Essence";
    }
    if (fuel.includes("hybrid")) return "Hybride";
    if (fuel.includes("electr")) return "Électrique";
    // Par défaut, détecter depuis le nom de motorisation
    if (typeName.match(/^\d+\.\d+$/)) return "Essence"; // Ex: "1.2" sans suffixe = essence
    return null;
  };

  const fuelLabel = detectFuel();

  return (
    <Link
      to={vehicle.vehicle_url || "#"}
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      aria-label={`Voir les pièces pour ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} ${vehicle.type_power_ps} ch - ${yearRange}`}
    >
      {/* 🖼️ Image responsive du véhicule avec srcset */}
      <div className="relative h-40 md:h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        <VehicleImage
          src={vehicle.image_url || "/images/default-vehicle.png"}
          alt={seoTitle}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
        />
        {/* Badges superposés sur l'image */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
          {/* Badge puissance */}
          {vehicle.type_power_ps && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg bg-brand">
              {vehicle.type_power_ps} ch
            </span>
          )}
          {/* Badge carburant */}
          {fuelLabel && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-md ${
                fuelLabel === "Diesel"
                  ? "bg-gray-800 text-white"
                  : fuelLabel === "Essence"
                    ? "bg-green-600 text-white"
                    : fuelLabel === "Hybride"
                      ? "bg-blue-500 text-white"
                      : "bg-purple-600 text-white"
              }`}
            >
              {fuelLabel}
            </span>
          )}
        </div>
        {/* Titre SEO en overlay bas */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-6">
          <h3 className="font-bold text-sm text-white line-clamp-2 leading-tight">
            {seoTitle}
          </h3>
        </div>
      </div>

      <div className="p-4">
        {/* Marque + Modèle */}
        <p className="font-bold text-base md:text-lg text-gray-900 mb-0.5 line-clamp-1">
          {vehicle.marque_name} {vehicle.modele_name}
        </p>

        {/* Motorisation */}
        <p className="font-semibold text-sm md:text-base mb-2 line-clamp-1 text-brand">
          {vehicle.type_name}
        </p>

        {/* Description SEO enrichie - toujours visible */}
        <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2 min-h-[2.25rem] italic">
          {vehicle.seo_benefit
            ? `Pièces ${vehicle.seo_benefit}`
            : `Pièces détachées disponibles pour votre ${vehicle.marque_name}`}
        </p>

        {/* Infos techniques */}
        <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 mb-3 py-2 px-3 bg-gray-50 rounded-lg">
          <span className="flex items-center gap-1.5 font-medium">
            <Zap className="w-3.5 h-3.5 text-brand" />
            {vehicle.type_power_ps || "?"} ch
          </span>
          <span className="font-medium">{yearRange}</span>
        </div>

        {/* CTA */}
        <div className="pt-2">
          <span className="text-xs md:text-sm font-bold group-hover:underline flex items-center justify-center gap-1 py-2 px-4 rounded-lg transition-all bg-brand-light text-brand">
            Voir les pièces
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// 📦 Composant Carte de pièce API - Layout original avec image en haut (h-24)
function ApiPartCard({
  part,
  brandAlias: _brandAlias,
}: {
  part: ApiPopularPart;
  brandAlias: string;
}) {
  return (
    <Link
      to={part.part_url || "#"}
      className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Bordure gradient au hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-xl"></div>
      <div className="absolute inset-0 bg-white m-0.5 rounded-lg group-hover:m-[3px] transition-all duration-300"></div>

      {/* Contenu - Layout original avec image en haut */}
      <div className="relative p-4">
        {/* 🖼️ Image centrée en haut - h-24 (96px) */}
        <div className="flex items-center justify-center h-24 mb-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <PartImage
            src={part.image_url || "/images/default-part.png"}
            alt={`${part.pg_name} ${part.marque_name}`}
            className="relative h-full w-auto object-contain group-hover:scale-110 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        </div>

        {/* Titre */}
        <h4 className="font-semibold text-sm text-gray-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
          {part.pg_name}
        </h4>

        {/* Description SEO dynamique */}
        {part.seo_switch_content ? (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed">
            {part.seo_switch_content}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-2 line-clamp-1">
            {part.modele_name} • {part.type_name}
          </p>
        )}

        {/* Footer avec CTA */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-medium text-blue-600 group-hover:underline">
            Voir les pièces →
          </span>
          {part.type_power_ps ? (
            <span className="text-[10px] font-medium text-white px-2 py-0.5 rounded-full bg-blue-600">
              {part.type_power_ps} ch
            </span>
          ) : (
            <span className="text-[10px] font-medium text-gray-500 px-2 py-0.5 rounded-full bg-gray-100">
              Universel
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
