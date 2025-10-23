// app/routes/blog-pieces-auto.auto._index.tsx
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Alert } from '~/components/ui/alert';
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowRight, Car, Factory, Search, Sparkles, TrendingUp } from "lucide-react";
import * as React from "react";

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

/* ===========================
   Types
=========================== */
interface BrandLogo {
  id: number;
  name: string;
  alias: string;
  logo: string | null;
  slug: string;
}

interface PopularModel {
  id: number;
  name: string;
  brandName: string;
  modelName: string;
  typeName: string;
  dateRange: string;
  imageUrl: string | null;
  slug: string;
}

interface PageMetadata {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  ariane: string;
  content: string | null;
  relfollow: string;
}

interface LoaderData {
  brands: BrandLogo[];
  popularModels: PopularModel[];
  metadata?: PageMetadata | null;
  stats: {
    totalBrands: number;
    totalModels: number;
  };
}

/* ===========================
   Loader
=========================== */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

    // Fetch brands, popular models and metadata in parallel
    const [brandsRes, modelsRes, metadataRes] = await Promise.all([
      fetch(`${backendUrl}/api/manufacturers/brands-logos?limit=50`, {
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`${backendUrl}/api/manufacturers/popular-models?limit=12`, {
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`${backendUrl}/api/manufacturers/page-metadata/constructeurs`, {
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    const brandsData = await brandsRes.json();
    const modelsData = await modelsRes.json();
    const metadataData = await metadataRes.json();

    if (!brandsData?.success || !modelsData?.success) {
      console.error("Format de réponse inattendu:", { brandsData, modelsData });
      return json<LoaderData>({
        brands: [],
        popularModels: [],
        stats: { totalBrands: 0, totalModels: 0 },
      });
    }

    return json<LoaderData>({
      brands: brandsData.data || [],
      popularModels: modelsData.data || [],
      metadata: metadataData?.success ? metadataData.data : null,
      stats: {
        totalBrands: brandsData.data?.length || 0,
        totalModels: modelsData.data?.length || 0,
      },
    });
  } catch (e) {
    console.error("Erreur loader auto:", e);
    return json<LoaderData>({
      brands: [],
      popularModels: [],
      stats: { totalBrands: 0, totalModels: 0 },
    });
  }
};

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const metadata = data?.metadata;
  const count = data?.stats?.totalBrands ?? 0;
  
  // Utiliser les métadonnées de la base de données si disponibles
  const title = metadata?.title || "Catalogue Technique Auto - Toutes les marques | Automecanik";
  const description = metadata?.description || `Découvrez notre catalogue technique de ${count} marques automobiles. Pièces détachées et accessoires pour tous les véhicules. Qualité OEM garantie.`;
  const keywords = metadata?.keywords || "catalogue auto, pièces détachées, marques automobiles, pièces OEM, accessoires auto";
  const robots = metadata?.relfollow || "index, follow";
  
  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "robots", content: robots },
  ];
};

/* ===========================
   Page
=========================== */
export default function BlogPiecesAutoIndex() {
  const { brands, popularModels, metadata, stats } = useLoaderData<typeof loader>();
  const [visibleBrands, setVisibleBrands] = React.useState(50);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filtrer les marques selon la recherche
  const filteredBrands = React.useMemo(() => {
    if (!searchQuery.trim()) return brands;
    return brands.filter(b => 
      b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [brands, searchQuery]);

  // Carousel state for popular models
  const [currentModelIndex, setCurrentModelIndex] = React.useState(0);
  const modelsPerPage = 4;

  const nextModels = () => {
    setCurrentModelIndex((prev) => 
      prev + modelsPerPage >= popularModels.length ? 0 : prev + modelsPerPage
    );
  };

  const prevModels = () => {
    setCurrentModelIndex((prev) => 
      prev === 0 ? Math.max(0, popularModels.length - modelsPerPage) : prev - modelsPerPage
    );
  };

  const visibleModels = popularModels.slice(currentModelIndex, currentModelIndex + modelsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />
      
      {/* Header Compact Réutilisable */}
      <CompactBlogHeader
        title={metadata?.h1 || "Catalogue des Constructeurs"}
        description={`${stats.totalBrands} marques • 5000+ versions disponibles`}
        breadcrumb={metadata?.ariane || "Accueil > Blog > Constructeurs"}
        stats={[
          { icon: Factory, value: stats.totalBrands, label: "Marques" },
          { icon: Car, value: "5K+", label: "Versions" },
        ]}
      />

      {/* Brands Grid Section */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {/* Search Bar - Compact */}
            <div className="mb-8">
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Rechercher une marque (Peugeot, BMW, Renault...)"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-base shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Brands Grid - Ultra Modern Design */}
            {filteredBrands.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mb-16">
                  {filteredBrands.slice(0, visibleBrands).map((brand) => (
                    <Link
                      key={brand.id}
                      to={`/blog-pieces-auto/auto/${brand.alias.toLowerCase()}`}
                      className="group relative"
                    >
                      <Card className="h-full hover:shadow-2xl transition-all duration-500 border border-gray-200 hover:border-blue-400 bg-white overflow-hidden group-hover:-translate-y-2 group-hover:scale-105">
                        <CardContent className="p-8 flex flex-col items-center justify-center h-full min-h-[160px] relative">
                          {/* Gradient background on hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-indigo-50/0 group-hover:from-blue-50 group-hover:to-indigo-50 transition-all duration-500" />
                          
                          {/* Logo */}
                          {brand.logo ? (
                            <div className="relative w-full h-24 flex items-center justify-center mb-4">
                              <img
                                src={brand.logo}
                                alt={brand.name}
                                className="max-w-full max-h-full object-contain filter grayscale-0 group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500 drop-shadow-sm"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement?.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            </div>
                          ) : (
                            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-4 group-hover:from-blue-600 group-hover:to-blue-800 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                              <span className="text-3xl font-bold text-white">
                                {brand.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          
                          {/* Brand Name */}
                          <p className="relative text-sm font-bold text-gray-700 text-center group-hover:text-blue-600 transition-colors duration-300 uppercase tracking-wide">
                            {brand.name}
                          </p>
                          
                          {/* Arrow Icon */}
                          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                              <ArrowRight className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Show More Button - Enhanced */}
                {visibleBrands < filteredBrands.length && (
                  <div className="text-center">
                    <Button
                      onClick={() => setVisibleBrands((prev) => prev + 12)}
                      size="lg"
                      className="group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-7 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
                    >
                      <span>Voir plus de marques</span>
                      <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                      <span className="ml-2 text-sm opacity-80">({filteredBrands.length - visibleBrands} restantes)</span>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-xl">Aucune marque disponible pour le moment</p>
              </div>
            )
}
          </div>
        </div>
      </section>

      {/* Section Chiffres Cles */}
      <section className="py-8 md:py-12 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-y border-blue-100">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                Pourquoi Choisir Notre Catalogue ?
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                Des milliers de pièces détachées certifiées pour votre véhicule
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Badge 1: Marques */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-blue-100 hover:border-blue-300 hover:-translate-y-2">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Factory className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-3xl font-bold text-gray-900">{stats.totalBrands}+</div>
                      <div className="text-sm text-gray-600 font-medium">Marques couvertes</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-semibold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Vérifiées
                  </div>
                </div>
              </div>

              {/* Badge 2: Modèles */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-green-100 hover:border-green-300 hover:-translate-y-2">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                      <Car className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-3xl font-bold text-gray-900">5000+</div>
                      <div className="text-sm text-gray-600 font-medium">Modèles référencés</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-semibold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    À jour
                  </div>
                </div>
              </div>

              {/* Badge 3: Compatibilité */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-purple-100 hover:border-purple-300 hover:-translate-y-2">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-3xl font-bold text-gray-900">100%</div>
                      <div className="text-sm text-gray-600 font-medium">Compatibilité garantie</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-semibold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Par véhicule
                  </div>
                </div>
              </div>

              {/* Badge 4: Qualité */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-orange-100 hover:border-orange-300 hover:-translate-y-2">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-3xl font-bold text-gray-900">✓</div>
                      <div className="text-sm text-gray-600 font-medium">Pièces certifiées</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-semibold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Testées
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Models Carousel Section */}
      <section className="py-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {/* Header Compact */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Véhicules les Plus Recherchés
                </h2>
                <p className="text-sm text-gray-600">
                  Nos gammes automobiles populaires
                </p>
              </div>
              <Badge className="bg-success/20 text-success px-3 py-1.5">
                <TrendingUp className="w-4 h-4 mr-1.5" />
                Top 12
              </Badge>
            </div>

            {/* Models Carousel */}
            {popularModels.length > 0 ? (
              <div className="relative">
                {/* Navigation Buttons */}
                {popularModels.length > modelsPerPage && (
                  <>
                    <button
                      onClick={prevModels}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 rounded-full bg-white shadow-lg border-2 border-gray-200 flex items-center justify-center hover:bg-info/20 hover:border-blue-300 transition-all"
                      aria-label="Modèles précédents"
                    >
                      <ArrowRight className="w-6 h-6 rotate-180 text-gray-700" />
                    </button>
                    <button
                      onClick={nextModels}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 rounded-full bg-white shadow-lg border-2 border-gray-200 flex items-center justify-center hover:bg-info/20 hover:border-blue-300 transition-all"
                      aria-label="Modèles suivants"
                    >
                      <ArrowRight className="w-6 h-6 text-gray-700" />
                    </button>
                  </>
                )}

                {/* Models Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {visibleModels.map((model) => (
                    <Link
                      key={model.id}
                      to={`/manufacturers/${model.slug}`}
                      className="group"
                    >
                      <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 border-gray-100 hover:border-green-300 bg-white overflow-hidden group-hover:-translate-y-1">
                        {/* Image */}
                        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
                          {model.imageUrl ? (
                            <img
                              src={model.imageUrl}
                              alt={`${model.brandName} ${model.modelName}`}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                              <Car className="w-16 h-16 text-gray-400" />
                            </div>
                          )}
                          
                          {/* Brand Badge */}
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-white/95 backdrop-blur-sm text-gray-900 font-bold px-3 py-1 shadow-lg">
                              {model.brandName}
                            </Badge>
                          </div>
                        </div>

                        {/* Content */}
                        <CardContent className="p-5">
                          <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                            {model.modelName}
                          </h3>
                          
                          <p className="text-sm text-gray-600 mb-3">
                            {model.typeName}
                          </p>

                          {/* Specs */}
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                            <span>
                              {model.dateRange || "N/A"}
                            </span>
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-3 border-t-2 border-gray-100">
                            <span className="text-sm font-medium text-gray-600">
                              Voir les pièces
                            </span>
                            <div className="p-1 bg-success/5 rounded-md group-hover:bg-success/20 transition-colors">
                              <ArrowRight className="w-4 h-4 text-green-600 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Carousel Indicators */}
                {popularModels.length > modelsPerPage && (
                  <div className="flex justify-center gap-2 mt-8">
                    {Array.from({ length: Math.ceil(popularModels.length / modelsPerPage) }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentModelIndex(index * modelsPerPage)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          Math.floor(currentModelIndex / modelsPerPage) === index
                            ? "bg-success w-8"
                            : "bg-muted/50 hover:bg-gray-400"
                        }`}
                        aria-label={`Page ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-xl">Aucun modèle populaire disponible pour le moment</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Constructeurs Section - Content */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-info/20 text-info px-4 py-2">
                <Factory className="w-4 h-4 mr-2" />
                Catalogue Complet
              </Badge>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Tous les Constructeurs Automobiles
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Chez Automecanik, vous trouverez toutes les pièces détachées pour les plus grandes marques automobiles : 
                <strong> Peugeot, Renault, Citroën, Volkswagen, Audi, BMW, Mercedes, Ford, Toyota, Nissan, Hyundai, Kia…</strong>
              </p>
            </div>

            {/* Content Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-1 shadow-2xl">
              <div className="relative bg-white rounded-3xl p-10 md:p-12">
                <div className="grid md:grid-cols-2 gap-10">
                  {/* Left Column */}
                  <div>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 mb-6 shadow-lg">
                      <Car className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      Toutes vos Pièces Détachées
                    </h3>
                    
                    <p className="text-gray-700 leading-relaxed mb-6 text-lg">
                      Que ce soit pour un <strong className="text-blue-600">entretien courant</strong> (plaquettes de frein, filtres, amortisseurs) 
                      ou des <strong className="text-blue-600">réparations spécifiques</strong>, notre catalogue technique vous guide rapidement 
                      vers les pièces compatibles avec votre véhicule.
                    </p>

                    <div className="space-y-4">
<Alert className="flex items-start gap-3 p-4 rounded-xl" variant="success">
                        <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Par Marque</p>
                          <p className="text-sm text-gray-600">Accédez facilement aux pièces par constructeur</p>
                        </div>
                      </Alert>

<Alert className="flex items-start gap-3 p-4 rounded-xl" variant="info">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Par Modèle</p>
                          <p className="text-sm text-gray-600">Trouvez les pièces pour votre modèle exact</p>
                        </div>
                      </Alert>

<Alert className="flex items-start gap-3 p-4 rounded-xl" variant="default">
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Par Motorisation & Année</p>
                          <p className="text-sm text-gray-600">Pièces spécifiques à votre configuration</p>
                        </div>
                      </Alert>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="flex flex-col justify-center">
                    <div className="relative rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 p-8 border-2 border-blue-200 shadow-inner">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/30/30 rounded-full blur-3xl" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-200/30 rounded-full blur-3xl" />
                      
                      <div className="relative">
                        <h4 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                          <Factory className="w-7 h-7 text-blue-600" />
                          Accès Simplifié
                        </h4>
                        
                        <p className="text-gray-700 leading-relaxed mb-6 text-lg">
                          Accédez facilement aux <strong className="text-blue-600">pièces de rechange 
                          spécifiques à votre véhicule</strong> grâce à une navigation intuitive :
                        </p>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-gray-700 font-medium">Navigation par marque</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span className="text-gray-700 font-medium">Sélection par modèle</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-purple-600" />
                            <span className="text-gray-700 font-medium">Filtrage par motorisation</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-gray-700 font-medium">Recherche par année</span>
                          </div>
                        </div>

                        <div className="mt-8 p-5 rounded-xl bg-white/80 backdrop-blur-sm border border-blue-200 shadow-lg">
                          <p className="text-sm text-gray-600 italic">
                            💡 <strong>Astuce :</strong> Utilisez notre moteur de recherche pour trouver rapidement 
                            toutes les pièces compatibles avec votre véhicule en quelques clics.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/60/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 mb-8">
              <Sparkles className="w-10 h-10" />
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Besoin d'aide pour trouver vos pièces ?
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
              Notre équipe d'experts vous accompagne dans le choix de vos pièces détachées
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/contact" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100 transition-all px-8 py-6 text-lg font-semibold rounded-xl">
                  <span>Contacter nos experts</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>

              <Link to="/blog-pieces-auto/conseils" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-all px-8 py-6 text-lg font-semibold rounded-xl">
                  Voir nos conseils
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success/60 animate-pulse" />
                <span>Pièces OEM garanties</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success/60 animate-pulse" />
                <span>Livraison rapide 24-48h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success/60 animate-pulse" />
                <span>Support technique gratuit</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
