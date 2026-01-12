// app/routes/blog-pieces-auto.auto.$marque.$modele.tsx
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
import { ArrowLeft, Calendar, Car, Gauge, Wrench } from "lucide-react";
import * as React from "react";

import { CompactBlogHeader } from "../components/blog/CompactBlogHeader";
import { HtmlContent } from "../components/seo/HtmlContent";
import { Card, CardContent } from "../components/ui/card";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { Error404 } from "~/components/errors/Error404";

/* ===========================
   Types
=========================== */
interface VehicleType {
  id: string | number;
  designation: string;
  kw: string | number;
  ch: string | number;
  carburant: string;
  engineCode?: string | null;
  monthFrom?: string;
  yearFrom?: string;
  monthTo?: string;
  yearTo?: string;
  carosserie?: string;
  cylindre?: string;
  slug?: string;
}

interface ModelGroup {
  id: number;
  name: string;
  alias: string;
  types: VehicleType[];
}

interface LoaderData {
  brand: {
    id: number;
    name: string;
    alias: string;
    logo: string | null;
  };
  modelGroup: {
    id: number;
    name: string;
    alias: string;
    yearFrom: number;
    yearTo: number | null;
    imageUrl: string | null;
    body: string | null;
  };
  models: ModelGroup[];
  metadata: {
    title: string;
    description: string;
    keywords: string;
    h1: string;
    content: string;
  } | null;
}

/* ===========================
   Loader
=========================== */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { marque, modele } = params;

  if (!marque || !modele) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

    // Récupérer les informations du modèle et ses motorisations
    const modelRes = await fetch(
      `${backendUrl}/api/brands/brand/${marque}/model/${modele}`,
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!modelRes.ok) {
      throw new Response("Modèle non trouvé", { status: 404 });
    }

    const response = await modelRes.json();

    if (!response?.success || !response?.data) {
      throw new Response("Modèle non trouvé", { status: 404 });
    }

    // Transformer la réponse : le backend retourne un modèle avec ses types
    // On le transforme en tableau de ModelGroup pour correspondre à l'interface
    const models = response.data.model
      ? [
          {
            id: response.data.model.id,
            name: response.data.model.name,
            alias: response.data.model.alias,
            types: response.data.types || [],
          },
        ]
      : [];

    return json<LoaderData>({
      brand: response.data.brand,
      modelGroup: response.data.model,
      models: models,
      metadata: response.data.metadata || null,
    });
  } catch (e) {
    console.error("Erreur loader modèle:", e);
    throw new Response("Erreur lors du chargement du modèle", { status: 500 });
  }
};

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  const metadata = data?.metadata;
  const brand = data?.brand;
  const modelGroup = data?.modelGroup;
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  const title =
    metadata?.title ||
    `Pièces auto ${brand?.name} ${modelGroup?.name} à prix pas cher`;
  const description =
    metadata?.description ||
    `Automecanik vous offre toutes les pièces et accessoires autos à prix pas cher pour ${brand?.name} ${modelGroup?.name}`;
  const keywords = metadata?.keywords || `${brand?.name}, ${modelGroup?.name}`;

  const result: any[] = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
  ];

  // 🚀 LCP OPTIMIZATION: Preload hero image
  if (modelGroup?.imageUrl) {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: modelGroup.imageUrl,
    });
  }

  return result;
};

/* ===========================
   Page
=========================== */
export default function BlogPiecesAutoMarqueModele() {
  const { brand, modelGroup, models, metadata } =
    useLoaderData<typeof loader>();
  const [selectedFuel, setSelectedFuel] = React.useState<string | null>(null);
  const [selectedPowerRange, setSelectedPowerRange] = React.useState<
    string | null
  >(null);

  // Compter le nombre total de motorisations
  const totalTypes = React.useMemo(() => {
    return models.reduce((sum, model) => sum + model.types.length, 0);
  }, [models]);

  // Extraire les types de carburant disponibles
  const fuelTypes = React.useMemo(() => {
    const fuels = new Set<string>();
    models.forEach((model) => {
      model.types.forEach((type) => {
        if (type.carburant) fuels.add(type.carburant);
      });
    });
    return Array.from(fuels).sort();
  }, [models]);

  // Gammes de puissance
  const powerRanges = React.useMemo(
    () => [
      { id: "0-100", label: "0-100 ch", min: 0, max: 100 },
      { id: "100-150", label: "100-150 ch", min: 100, max: 150 },
      { id: "150-200", label: "150-200 ch", min: 150, max: 200 },
      { id: "200+", label: "200+ ch", min: 200, max: Infinity },
    ],
    [],
  );

  // Filtrer les motorisations
  const filteredModels = React.useMemo(() => {
    return models
      .map((model) => ({
        ...model,
        types: model.types.filter((type) => {
          const fuelMatch = !selectedFuel || type.carburant === selectedFuel;

          let powerMatch = true;
          if (selectedPowerRange) {
            const range = powerRanges.find((r) => r.id === selectedPowerRange);
            if (range) {
              const ch = parseInt(String(type.ch));
              powerMatch = ch >= range.min && ch < range.max;
            }
          }

          return fuelMatch && powerMatch;
        }),
      }))
      .filter((model) => model.types.length > 0);
  }, [models, selectedFuel, selectedPowerRange, powerRanges]);

  const filteredCount = React.useMemo(() => {
    return filteredModels.reduce((sum, model) => sum + model.types.length, 0);
  }, [filteredModels]);

  // Grouper les motorisations par carburant
  const typesByFuel = React.useMemo(() => {
    const grouped: Record<string, (typeof filteredModels)[0]["types"]> = {};

    filteredModels.forEach((model) => {
      model.types.forEach((type) => {
        const fuel = type.carburant || "Autre";
        if (!grouped[fuel]) {
          grouped[fuel] = [];
        }
        grouped[fuel].push(type);
      });
    });

    // Trier les carburants : Diesel d'abord, puis Essence, puis le reste
    const sortedFuels = Object.keys(grouped).sort((a, b) => {
      const order: Record<string, number> = {
        Diesel: 1,
        diesel: 1,
        Essence: 2,
        essence: 2,
        Hybride: 3,
        hybride: 3,
        Électrique: 4,
        électrique: 4,
      };
      return (order[a] || 99) - (order[b] || 99);
    });

    const result: Record<string, (typeof filteredModels)[0]["types"]> = {};
    sortedFuels.forEach((fuel) => {
      result[fuel] = grouped[fuel];
    });

    return result;
  }, [filteredModels]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* Hero avec logo constructeur */}
      <CompactBlogHeader
        title={
          metadata?.h1 || `Choisissez votre ${brand.name} ${modelGroup.name}`
        }
        description={`${models.length} version${models.length > 1 ? "s" : ""} • ${totalTypes} motorisation${totalTypes > 1 ? "s" : ""} disponible${totalTypes > 1 ? "s" : ""}`}
        logo={brand.logo || undefined}
        logoAlt={`Logo ${brand.name}`}
        stats={[
          { label: "Versions", value: models.length.toString(), icon: Wrench },
          { label: "Motorisations", value: totalTypes.toString(), icon: Gauge },
        ]}
        gradientFrom="from-indigo-600"
        gradientTo="to-purple-600"
      />

      {/* SEO Content Section - Juste après le header */}
      {metadata?.content && (
        <section className="py-8 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
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

      {/* Model Image & Info Section - Version compacte */}
      <section className="py-4 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Image ou Image générique */}
              <div className="lg:col-span-4">
                <div className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 p-1 shadow-md">
                  <img
                    src={
                      modelGroup.imageUrl || "/images/categories/default.svg"
                    }
                    alt={`${brand.name} ${modelGroup.name}`}
                    width={400}
                    height={224}
                    className="w-full h-auto max-h-56 object-contain mx-auto"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    onError={(e) => {
                      // Fallback si l'image ne charge pas
                      e.currentTarget.src = "/images/categories/default.svg";
                    }}
                  />
                </div>
              </div>

              {/* Info principale */}
              <div className="lg:col-span-8">
                <div className="space-y-4">
                  {/* Titre et info principale */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                        {brand.name} {modelGroup.name}
                      </h1>
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        ✓ Qualité OEM
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      Retrouvez toutes les motorisations disponibles pour votre{" "}
                      {brand.name} {modelGroup.name}. Pièces d'origine et
                      compatibles avec garantie 100%.
                    </p>
                  </div>

                  {/* Informations claires - Structure améliorée */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {/* Années de production */}
                      <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-3 border border-blue-200">
                        <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-blue-600 font-semibold mb-0.5">
                            Années de production
                          </div>
                          <div className="font-bold text-gray-900">
                            {modelGroup.yearFrom} –{" "}
                            {modelGroup.yearTo || "aujourd'hui"}
                          </div>
                        </div>
                      </div>

                      {/* Motorisations */}
                      <div className="flex items-start gap-2 bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <Gauge className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-purple-600 font-semibold mb-0.5">
                            Motorisations
                          </div>
                          <div className="font-bold text-gray-900 text-xs leading-relaxed">
                            {(() => {
                              const powers = models
                                .flatMap((m) =>
                                  m.types.map(
                                    (t) => parseInt(String(t.ch)) || 0,
                                  ),
                                )
                                .filter((p) => p > 0);
                              const minPower = Math.min(...powers);
                              const maxPower = Math.max(...powers);
                              const fuelsList = fuelTypes
                                .map((fuel) => {
                                  const fuelLower = fuel.toLowerCase();
                                  const icon = fuelLower.includes("diesel")
                                    ? "⛽"
                                    : fuelLower.includes("essence")
                                      ? "⚡"
                                      : fuelLower.includes("électrique")
                                        ? "🔋"
                                        : "🔌";
                                  return `${icon} ${fuel}`;
                                })
                                .join(", ");
                              return `${minPower}-${maxPower} ch • ${fuelsList}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Carrosseries */}
                    {modelGroup.body && (
                      <div className="flex items-start gap-2 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                        <Car className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-indigo-600 font-semibold mb-0.5">
                            Carrosseries
                          </div>
                          <div className="font-bold text-gray-900">
                            {modelGroup.body}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section - Ultra compact */}
      {totalTypes > 3 && (
        <section className="sticky top-0 z-40 bg-white/98 backdrop-blur-lg shadow-sm border-b border-gray-200 py-2">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-indigo-600"
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
                  <span className="text-sm font-semibold text-gray-900">
                    <span className="text-indigo-600">{filteredCount}</span>/
                    {totalTypes} motorisation{totalTypes > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Filtre Carburant - Coloré par type */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedFuel(null)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        selectedFuel === null
                          ? "bg-indigo-600 text-white shadow-md scale-105 border-indigo-700"
                          : "bg-white text-gray-700 hover:bg-gray-50 hover:scale-105 border-gray-300"
                      }`}
                    >
                      <span>🔍</span>
                      <span>Tous</span>
                    </button>
                    {fuelTypes.map((fuel) => {
                      const fuelLower = fuel.toLowerCase();
                      const isDiesel = fuelLower.includes("diesel");
                      const isEssence = fuelLower.includes("essence");
                      const isElectrique = fuelLower.includes("électrique");
                      const isHybride = fuelLower.includes("hybride");

                      const getIcon = () => {
                        if (isDiesel) return "⛽";
                        if (isEssence) return "⚡";
                        if (isElectrique) return "🔋";
                        if (isHybride) return "🔌";
                        return "🛢️";
                      };

                      const getActiveColors = () => {
                        if (isDiesel)
                          return "bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-200";
                        if (isEssence)
                          return "bg-success text-white border-green-600 shadow-md shadow-green-200";
                        if (isElectrique)
                          return "bg-primary text-white border-blue-600 shadow-md shadow-blue-200";
                        if (isHybride)
                          return "bg-purple-500 text-white border-purple-600 shadow-md shadow-purple-200";
                        return "bg-gray-600 text-white border-gray-700 shadow-md";
                      };

                      const getInactiveColors = () => {
                        if (isDiesel)
                          return "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100";
                        if (isEssence)
                          return "bg-success/5 text-green-700 border-green-300 hover:bg-success/20";
                        if (isElectrique)
                          return "bg-primary/5 text-blue-700 border-blue-300 hover:bg-info/20";
                        if (isHybride)
                          return "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100";
                        return "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100";
                      };

                      return (
                        <button
                          key={fuel}
                          onClick={() => setSelectedFuel(fuel)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                            selectedFuel === fuel
                              ? getActiveColors() + " scale-105"
                              : getInactiveColors() + " hover:scale-105"
                          }`}
                        >
                          <span>{getIcon()}</span>
                          <span>{fuel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-px h-8 bg-muted/50"></div>

                  {/* Filtre Puissance - Design amélioré */}
                  <div className="flex flex-wrap gap-1.5">
                    {powerRanges.map((range) => (
                      <button
                        key={range.id}
                        onClick={() =>
                          setSelectedPowerRange(
                            selectedPowerRange === range.id ? null : range.id,
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          selectedPowerRange === range.id
                            ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-200 scale-105 border-purple-600"
                            : "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100 hover:scale-105"
                        }`}
                      >
                        <Gauge className="w-3 h-3" />
                        <span>{range.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Reset Button - Amélioré */}
                  {(selectedFuel || selectedPowerRange) && (
                    <button
                      onClick={() => {
                        setSelectedFuel(null);
                        setSelectedPowerRange(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-600 hover:from-red-600 hover:to-rose-700 shadow-md hover:shadow-lg hover:scale-105"
                    >
                      <span>✕</span>
                      <span>Réinitialiser</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Motorisations List - Groupées par carburant */}
      <section className="py-6 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {Object.keys(typesByFuel).length > 0 ? (
              <div className="space-y-8">
                {Object.entries(typesByFuel).map(([fuelType, types]) => {
                  // Déterminer la couleur du badge selon le carburant
                  const getBadgeClass = (fuel: string) => {
                    const fuelLower = fuel.toLowerCase();
                    if (fuelLower.includes("diesel")) {
                      return "bg-orange-100 text-orange-800 border-orange-300";
                    } else if (fuelLower.includes("essence")) {
                      return "bg-success/20 text-success border-green-300";
                    } else if (fuelLower.includes("électrique")) {
                      return "bg-info/20 text-info border-blue-300";
                    } else if (fuelLower.includes("hybride")) {
                      return "bg-purple-100 text-purple-800 border-purple-300";
                    }
                    return "bg-gray-100 text-gray-800 border-gray-300";
                  };

                  const getIcon = (fuel: string) => {
                    const fuelLower = fuel.toLowerCase();
                    if (fuelLower.includes("diesel")) return "⛽";
                    if (fuelLower.includes("essence")) return "⚡";
                    if (fuelLower.includes("électrique")) return "🔋";
                    if (fuelLower.includes("hybride")) return "🔌";
                    return "🛢️";
                  };

                  return (
                    <div key={fuelType} className="space-y-3">
                      {/* Badge du carburant - En-tête de groupe */}
                      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-3 border-b-2 border-gray-200">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-base font-bold ${getBadgeClass(fuelType)}`}
                          >
                            <span className="text-lg">{getIcon(fuelType)}</span>
                            <span>Motorisations {fuelType}</span>
                            <span className="ml-1 text-xs opacity-75">
                              ({types.length})
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Liste des motorisations pour ce carburant */}
                      <div className="space-y-3 animate-fadeIn">
                        {types.map((type) => {
                          // Formater la date comme dans le PHP
                          let dateRange = "";
                          if (type.yearTo) {
                            dateRange = `de ${type.yearFrom} à ${type.yearTo}`;
                          } else if (type.monthFrom && type.yearFrom) {
                            dateRange = `du ${type.monthFrom}/${type.yearFrom}`;
                          } else if (type.yearFrom) {
                            dateRange = `de ${type.yearFrom}`;
                          }

                          return (
                            <Link
                              key={type.id}
                              to={`/constructeurs/${brand.alias}-${brand.id}/${modelGroup.alias}-${modelGroup.id}/${type.id}.html`}
                              target="_blank"
                              className="block group"
                            >
                              <Card className="hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-indigo-400 bg-white">
                                <CardContent className="p-4">
                                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    {/* Titre principal */}
                                    <div className="flex-1">
                                      <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                                        {type.designation}
                                        {/* Code moteur : DÉSACTIVÉ - pas de liaison fiable entre auto_type et cars_engine */}
                                      </h3>
                                      <p className="text-xs text-gray-500">
                                        {dateRange}
                                      </p>
                                    </div>

                                    {/* Infos techniques - Inline */}
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                      {/* Puissance */}
                                      <div className="flex items-center gap-1.5">
                                        <Gauge className="w-4 h-4 text-indigo-600" />
                                        <span className="font-semibold text-gray-900">
                                          {type.ch} ch
                                        </span>
                                        <span className="text-gray-500">
                                          ({type.kw} kW)
                                        </span>
                                      </div>

                                      {/* Carosserie */}
                                      {type.carosserie && (
                                        <div className="flex items-center gap-1.5 text-gray-600">
                                          <Car className="w-4 h-4" />
                                          <span className="text-xs">
                                            {type.carosserie}
                                          </span>
                                        </div>
                                      )}

                                      {/* Arrow icon */}
                                      <div className="ml-auto">
                                        <svg
                                          className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                          />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="mb-6 relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wrench className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {selectedFuel || selectedPowerRange
                    ? "Aucune motorisation trouvée"
                    : "Motorisations bientôt disponibles"}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {selectedFuel || selectedPowerRange
                    ? "Essayez de modifier vos critères de recherche pour voir plus de résultats."
                    : `Les motorisations pour le ${brand.name} ${modelGroup.name} seront bientôt disponibles.`}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {(selectedFuel || selectedPowerRange) && (
                    <button
                      onClick={() => {
                        setSelectedFuel(null);
                        setSelectedPowerRange(null);
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-lg"
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                  <Link
                    to={`/blog-pieces-auto/auto/${brand.alias}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-indigo-600 hover:text-indigo-600 transition-colors font-semibold"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Voir les autres modèles {brand.name}
                  </Link>
                </div>
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

      {/* Model Info Section */}
      <section className="py-12 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">
              À propos du {brand.name} {modelGroup.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-indigo-100 hover:border-indigo-300 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Années de production
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {modelGroup.yearFrom} - {modelGroup.yearTo || "aujourd'hui"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-100 hover:border-purple-300 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wrench className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Motorisations
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {models.reduce((total, m) => total + m.types.length, 0)}{" "}
                    version
                    {models.reduce((total, m) => total + m.types.length, 0) > 1
                      ? "s"
                      : ""}{" "}
                    disponible
                    {models.reduce((total, m) => total + m.types.length, 0) > 1
                      ? "s"
                      : ""}
                  </p>
                </CardContent>
              </Card>

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
                    Pièces garanties
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Compatibilité 100% garantie
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
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 justify-between">
            <Link
              to={`/blog-pieces-auto/auto/${brand.alias}`}
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Voir tous les modèles {brand.name}</span>
            </Link>

            <Link
              to="/blog-pieces-auto/auto"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-700 font-semibold transition-colors"
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
// ERROR BOUNDARY (Requis pour HTML rendering au lieu de JSON)
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
