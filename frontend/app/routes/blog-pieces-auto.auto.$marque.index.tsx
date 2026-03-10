// app/routes/blog-pieces-auto.auto.$marque.tsx
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { ArrowLeft, Calendar, Car } from "lucide-react";
import * as React from "react";

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { CompactBlogHeader } from "../components/blog/CompactBlogHeader";
import { HtmlContent } from "../components/seo/HtmlContent";
import { Card, CardContent } from "../components/ui/card";

/* ===========================
   Types
=========================== */
interface VehicleModel {
  id: number;
  name: string;
  alias: string;
  yearFrom: number;
  yearTo: number | null;
  imageUrl: string | null;
  dateRange: string;
  slug?: string;
  // Nouvelles infos enrichies
  motorisationsCount?: number;
  modele_fuel_types?: string[]; // Types de carburant disponibles (Diesel, Essence, etc.)
  monthFrom?: string;
  monthTo?: string;
  parent?: number;
  sort?: number;
  display?: number;
  [key: string]: any; // Pour les autres colonnes dynamiques
}

interface LoaderData {
  brand: {
    id: number;
    name: string;
    alias: string;
    logo: string | null;
  } | null;
  models: VehicleModel[];
  metadata: {
    title: string;
    description: string;
    keywords: string;
    h1: string;
    content: string;
    relfollow: string;
  } | null;
}

/* ===========================
   Loader
=========================== */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { marque } = params;

  if (!marque) {
    throw new Response("Marque non spécifiée", { status: 400 });
  }

  try {
    const backendUrl = getInternalApiUrl("");

    // 1. Récupérer les informations de la marque
    const brandRes = await fetch(`${backendUrl}/api/brands/brand/${marque}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!brandRes.ok) {
      throw new Response("Marque non trouvée", { status: 404 });
    }

    const brandResponse = await brandRes.json();

    if (!brandResponse?.success || !brandResponse?.data) {
      throw new Response("Marque non trouvée", { status: 404 });
    }

    const brandData = brandResponse.data;
    const brandId = brandData.marque_id;

    // ✅ Migration /img/* : Proxy Caddy au lieu d'URL Supabase directe
    const logoBaseUrl = "/img/uploads/constructeurs-automobiles/marques-logos";

    // 2. Récupérer les modèles de cette marque
    const modelsRes = await fetch(
      `${backendUrl}/api/vehicles/brands/${brandId}/models`,
      {
        headers: { "Content-Type": "application/json" },
      },
    ).catch(() => null);

    const modelsResponse = modelsRes?.ok
      ? await modelsRes.json().catch(() => null)
      : null;
    const modelsData = modelsResponse?.data || [];

    // Mapper les modèles vers le format attendu - utiliser image_url du backend (comme /constructeurs/)
    const mappedModels: VehicleModel[] = modelsData
      .filter((model: any) => model.modele_display === 1) // Filtrer uniquement les modèles affichables
      .map((model: any) => ({
        id: model.modele_id,
        name: model.modele_name,
        alias:
          model.modele_alias ||
          model.modele_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        yearFrom: model.modele_year_from,
        yearTo: model.modele_year_to,
        imageUrl: model.image_url, // ✅ Utiliser directement l'URL générée par le backend
        dateRange: `${model.modele_year_from || "?"} - ${model.modele_year_to || "aujourd'hui"}`,
        modele_body: model.modele_body,
        modele_is_new: model.modele_is_new,
        motorisationsCount: model.motorisationsCount || 0,
        modele_fuel_types: model.modele_fuel_types || [],
      }));

    // Mapper la marque
    const brand = {
      id: brandData.marque_id,
      name: brandData.marque_name,
      alias: brandData.marque_alias,
      logo: brandData.marque_logo
        ? `${logoBaseUrl}/${brandData.marque_logo}`
        : null,
    };

    // Mapper les métadonnées SEO
    const metadata = brandData.seo
      ? {
          title: brandData.seo.title || `Pièces détachées ${brand.name}`,
          description:
            brandData.seo.description ||
            `Trouvez toutes les pièces pour ${brand.name}`,
          keywords: brandData.seo.keywords || `${brand.name}, pièces détachées`,
          h1: brandData.seo.h1 || `Modèles ${brand.name}`,
          content: brandData.seo.content || "",
          relfollow: "index, follow",
        }
      : null;

    return json<LoaderData>({
      brand,
      models: mappedModels,
      metadata,
    });
  } catch (e) {
    logger.error("Erreur loader marque:", e);
    if (e instanceof Response) throw e;
    throw new Response("Erreur lors du chargement de la marque", {
      status: 500,
    });
  }
};

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  const metadata = data?.metadata;
  const brand = data?.brand;
  const modelsCount = data?.models?.length ?? 0;
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  const title =
    metadata?.title ||
    `Pièces détachées ${brand?.name?.toUpperCase()} à prix pas cher`;
  const description =
    metadata?.description ||
    `Découvrez tous les modèles ${brand?.name} (${modelsCount} versions disponibles). Pièces détachées et accessoires pour votre véhicule ${brand?.name}.`;
  const keywords =
    metadata?.keywords ||
    `${brand?.name}, pièces détachées ${brand?.name}, accessoires auto`;

  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
  ];
};

/* ===========================
   Helpers
=========================== */

// Détermine l'emoji du véhicule basé sur le type de carrosserie et le nom
function getVehicleEmoji(modelName: string, bodyType?: string): string {
  const name = modelName.toLowerCase();
  const body = bodyType?.toLowerCase() || "";

  // Basé sur le type de carrosserie (modele_body)
  if (body.includes("suv") || body.includes("4x4")) {
    return "🚐";
  }
  if (
    body.includes("coupé") ||
    body.includes("coupe") ||
    body.includes("cabriolet") ||
    body.includes("roadster")
  ) {
    return "🏎️";
  }
  if (
    body.includes("monospace") ||
    body.includes("utilitaire") ||
    body.includes("fourgon")
  ) {
    return "🚌";
  }
  if (body.includes("break") || body.includes("combi")) {
    return "🚙";
  }

  // Fallback sur le nom du modèle
  if (
    name.includes("suv") ||
    name.includes("4x4") ||
    name.includes("x5") ||
    name.includes("q7") ||
    name.includes("cayenne")
  ) {
    return "🚐";
  }
  if (
    name.includes("sport") ||
    name.includes("gt") ||
    name.includes("rs") ||
    name.includes("m3") ||
    name.includes("amg")
  ) {
    return "🏎️";
  }
  if (
    name.includes("partner") ||
    name.includes("berlingo") ||
    name.includes("kangoo") ||
    name.includes("transporter")
  ) {
    return "🚌";
  }

  // Par défaut : berline/citadine
  return "🚗";
}

/* ===========================
   Page
=========================== */
export default function BlogPiecesAutoMarque() {
  const { brand, models, metadata } = useLoaderData<typeof loader>();
  const [selectedDecade, setSelectedDecade] = React.useState<string | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(
    null,
  );

  // Debug: vérifier si les carburants arrivent
  React.useEffect(() => {
    if (models.length > 0) {
      logger.log("🔍 Premier modèle:", {
        name: models[0].name,
        motorisationsCount: models[0].motorisationsCount,
        modele_fuel_types: models[0].modele_fuel_types,
        modele_body: models[0].modele_body,
      });
    }
  }, [models]);

  // Extraire les décennies disponibles
  const decades = React.useMemo(() => {
    const decadeSet = new Set<string>();
    models.forEach((model) => {
      if (model.yearFrom) {
        const decade = Math.floor(model.yearFrom / 10) * 10;
        decadeSet.add(`${decade}s`);
      }
    });
    return Array.from(decadeSet).sort((a, b) => {
      const yearA = parseInt(a);
      const yearB = parseInt(b);
      return yearB - yearA; // Plus récent en premier
    });
  }, [models]);

  // Catégories de véhicules (à enrichir selon vos données)
  const categories = React.useMemo(() => {
    // TODO: Extraire depuis les données réelles si disponibles
    // Pour l'instant, on définit les catégories standard
    return [
      { id: "citadine", label: "Citadine", icon: "🚗" },
      { id: "berline", label: "Berline", icon: "🚙" },
      { id: "coupe", label: "Coupé", icon: "🏎️" },
      { id: "suv", label: "SUV", icon: "🚐" },
      { id: "monospace", label: "Monospace", icon: "🚌" },
      { id: "break", label: "Break", icon: "🚗" },
    ];
  }, []);

  // Filtrer les modèles par décennie ET catégorie
  const filteredModels = React.useMemo(() => {
    let filtered = models;

    // Filtre par décennie
    if (selectedDecade) {
      const decadeStart = parseInt(selectedDecade);
      filtered = filtered.filter((model) => {
        if (!model.yearFrom) return false;
        const yearFrom = model.yearFrom;
        const yearTo = model.yearTo || new Date().getFullYear();
        return yearFrom < decadeStart + 10 && yearTo >= decadeStart;
      });
    }

    // Filtre par catégorie (à implémenter selon vos données)
    // TODO: Ajouter la logique de filtrage par catégorie quand les données seront disponibles
    if (selectedCategory) {
      // Pour l'instant, on retourne tous les modèles filtrés par décennie
      // À adapter selon la structure de vos données
    }

    return filtered;
  }, [models, selectedDecade, selectedCategory]);

  // Compter les résultats par catégorie (pour afficher dans les badges)
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.id] = filteredModels.length; // TODO: Calculer vraiment par catégorie
    });
    return counts;
  }, [filteredModels, categories]);

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Marque non trouvée
          </h1>
          <Link
            to="/blog-pieces-auto/auto"
            className="text-blue-600 hover:underline"
          >
            ← Retour aux constructeurs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* Hero Section */}
      <CompactBlogHeader
        title={metadata?.h1 || `Pièces détachées ${brand.name.toUpperCase()}`}
        description={`Découvrez ${models.length} version${models.length > 1 ? "s" : ""} disponible${models.length > 1 ? "s" : ""} de ${brand.name}. Pièces d'origine et compatibles au meilleur prix.`}
        logo={brand.logo || undefined}
        logoAlt={`Logo ${brand.name}`}
        stats={[
          { label: "Modèles", value: models.length.toString(), icon: Car },
        ]}
        gradientFrom="from-blue-600"
        gradientTo="to-indigo-600"
      />

      {/* Enhanced Filters Section - Shadcn UI Style */}
      {decades.length > 0 && (
        <section className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm py-4">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Title and Stats */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold leading-none tracking-tight">
                      Filtrer les modèles
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-primary">
                        {filteredModels.length}
                      </span>{" "}
                      modèle{filteredModels.length > 1 ? "s" : ""}
                      {(selectedDecade || selectedCategory) &&
                        " · Filtres actifs"}
                    </p>
                  </div>
                </div>

                {/* Reset Filter Button (visible only when filter is active) */}
                {(selectedDecade || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSelectedDecade(null);
                      setSelectedCategory(null);
                    }}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Réinitialiser
                  </button>
                )}
              </div>

              {/* Période Filter Buttons - Shadcn Badge Style */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Filtrer par période
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDecade(null)}
                    className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                      selectedDecade === null
                        ? "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80"
                        : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    Toutes
                  </button>
                  {decades.map((decade) => (
                    <button
                      key={decade}
                      onClick={() => setSelectedDecade(decade)}
                      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        selectedDecade === decade
                          ? "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80"
                          : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {decade}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catégorie Filter Buttons - Shadcn Badge Style */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Filtrer par catégorie
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                      selectedCategory === null
                        ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    Toutes catégories
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 gap-1.5 ${
                        selectedCategory === category.id
                          ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <span>{category.icon}</span>
                      <span>{category.label}</span>
                      {categoryCounts[category.id] > 0 && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            selectedCategory === category.id
                              ? "bg-primary/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {categoryCounts[category.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Models Grid */}
      <section className="py-12 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {filteredModels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredModels.map((model) => (
                  <Link
                    key={model.id}
                    to={`/blog-pieces-auto/auto/${brand.alias.toLowerCase()}/${model.alias}`}
                    className="group"
                  >
                    <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg border group-hover:border-primary">
                      {/* Image */}
                      <div className="relative h-64 overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
                        {model.imageUrl ? (
                          <img
                            src={model.imageUrl}
                            alt={`${brand.name} ${model.name}`}
                            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => {
                              // Fallback si l'image ne charge pas
                              const target = e.currentTarget;
                              target.style.display = "none";
                              const fallback =
                                target.parentElement?.querySelector(
                                  ".image-fallback",
                                ) as HTMLElement;
                              if (fallback) {
                                fallback.classList.remove("hidden");
                                fallback.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        {/* Fallback design attractif avec logo marque */}
                        <div
                          className={`image-fallback absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 ${model.imageUrl ? "hidden" : ""}`}
                        >
                          {brand.logo ? (
                            <img
                              src={brand.logo}
                              alt={brand.name}
                              className="w-16 h-16 object-contain opacity-40 mb-3"
                            />
                          ) : (
                            <Car className="w-16 h-16 text-slate-300 mb-3" />
                          )}
                          <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                            {model.name}
                          </span>
                          <span className="text-xs text-slate-300 mt-1">
                            Image non disponible
                          </span>
                        </div>

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>

                      {/* Content */}
                      <CardContent className="p-5 space-y-3">
                        {/* Titre avec emoji */}
                        <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors flex items-center gap-2">
                          <span className="text-2xl">
                            {getVehicleEmoji(model.name, model.modele_body)}
                          </span>
                          <span className="line-clamp-1">
                            {brand.name.toUpperCase()} {model.name}
                          </span>
                        </h3>

                        {/* Type de carrosserie si disponible */}
                        {model.modele_body && (
                          <div className="inline-flex items-center rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium">
                            {model.modele_body}
                          </div>
                        )}

                        {/* Période + Badge nouveau */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="font-semibold">
                            ({model.yearFrom} - {model.yearTo || "aujourd'hui"})
                          </span>
                          {model.modele_is_new === 1 && (
                            <span className="inline-flex items-center rounded-full border border-transparent bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                              NOUVEAU
                            </span>
                          )}
                        </div>

                        {/* Stats rapides avec badges carburant */}
                        <div className="space-y-2 mb-3 pb-3 border-b">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Car className="w-3.5 h-3.5" />
                              <span className="font-medium">1 modèle</span>
                            </span>
                            {model.motorisationsCount !== undefined &&
                              model.motorisationsCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                  </svg>
                                  <span className="font-medium">
                                    {model.motorisationsCount} motorisation
                                    {model.motorisationsCount > 1 ? "s" : ""}
                                  </span>
                                </span>
                              )}
                          </div>
                          {/* Badges carburant disponibles - DEBUG VERSION */}
                          {model.modele_fuel_types &&
                          model.modele_fuel_types.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {model.modele_fuel_types
                                .sort((a: string, b: string) => {
                                  // Diesel avant Essence
                                  if (a.toLowerCase().includes("diesel"))
                                    return -1;
                                  if (b.toLowerCase().includes("diesel"))
                                    return 1;
                                  return 0;
                                })
                                .map((fuel: string) => {
                                  const fuelLower = fuel.toLowerCase();
                                  const isDiesel = fuelLower.includes("diesel");
                                  const isEssence =
                                    fuelLower.includes("essence");

                                  return (
                                    <span
                                      key={fuel}
                                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                                        isDiesel
                                          ? "bg-orange-100 text-orange-800 border-orange-300"
                                          : isEssence
                                            ? "bg-success/20 text-success border-green-300"
                                            : "bg-gray-100 text-gray-800 border-gray-300"
                                      }`}
                                    >
                                      <span>
                                        {isDiesel
                                          ? "⛽"
                                          : isEssence
                                            ? "⚡"
                                            : "🔋"}
                                      </span>
                                      <span>{fuel}</span>
                                    </span>
                                  );
                                })}
                            </div>
                          ) : (
                            <div className="text-xs text-red-500">
                              DEBUG: Pas de carburants (modele_fuel_types ={" "}
                              {JSON.stringify(model.modele_fuel_types)})
                            </div>
                          )}
                        </div>

                        {/* Sous-titre marketing */}
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          Retrouvez toutes les pièces détachées d'origine et
                          compatibles pour votre{" "}
                          <span className="font-semibold text-foreground">
                            {brand.name} {model.name}
                          </span>
                          .
                        </p>

                        {/* CTA */}
                        <div className="rounded-md bg-primary/10 px-3 py-2 text-center border border-primary/20">
                          <p className="text-xs font-semibold text-primary">
                            ✓ Compatibilité 100% garantie
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Aucun modèle disponible
                </h3>
                <p className="text-gray-600 mb-4">
                  {selectedDecade && selectedCategory
                    ? `Aucun modèle ${categories.find((c) => c.id === selectedCategory)?.label.toLowerCase()} disponible pour les années ${selectedDecade}.`
                    : selectedDecade
                      ? `Aucun modèle disponible pour les années ${selectedDecade}.`
                      : selectedCategory
                        ? `Aucun modèle ${categories.find((c) => c.id === selectedCategory)?.label.toLowerCase()} disponible.`
                        : "Les modèles pour cette marque seront bientôt disponibles."}
                </p>
                {(selectedDecade || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSelectedDecade(null);
                      setSelectedCategory(null);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-semibold"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEO Content Section */}
      {metadata?.content && (
        <section className="py-12 bg-white border-y border-gray-200">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="prose prose-lg max-w-none">
                <HtmlContent
                  html={metadata.content}
                  trackLinks={true}
                  className="text-gray-700 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Key Features Section */}
      <section className="py-12 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">
              Pourquoi choisir Automecanik pour vos pièces {brand.name} ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-blue-100 hover:border-blue-300 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Qualité Garantie
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Pièces d'origine et compatibles certifiées pour votre{" "}
                    {brand.name}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-100 hover:border-green-300 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Prix Compétitifs
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Les meilleurs tarifs du marché avec notre garantie du prix
                    le plus bas
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-100 hover:border-purple-300 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Livraison Rapide
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Expédition sous 24h pour toutes vos pièces {brand.name}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Back Button */}
      <section className="py-8 bg-white border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <Link
              to="/blog-pieces-auto/auto"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Retour aux constructeurs</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP avec composants
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
