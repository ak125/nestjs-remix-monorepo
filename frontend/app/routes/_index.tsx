import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link } from "@remix-run/react";
import { CheckCircle2, ChevronRight, Shield, Truck, Users } from "lucide-react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)

import { formatCatalogCount } from "~/utils/format-catalog-count";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { EquipementiersCarousel } from "../components/home/EquipementiersCarousel";
import HomeBlogSection from "../components/home/HomeBlogSection";
import HomeBottomSections from "../components/home/HomeBottomSections";
import HomeCertifications from "../components/home/HomeCertifications";
import HomeFAQSection from "../components/home/HomeFAQSection";
import HomeSearchCards from "../components/home/HomeSearchCards";
import ReferenceSearchModal from "../components/home/ReferenceSearchModal";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import VehicleSelector from "../components/vehicle/VehicleSelector";
import { useHomeData } from "../hooks/useHomeData";
import { useNewsletterState } from "../hooks/useNewsletterState";
import { useScrollBehavior } from "../hooks/useScrollBehavior";
import { useSearchState } from "../hooks/useSearchState";
// hierarchyApi: helpers UI (getFamilyImage, getFamilyColor) - pas d'appel réseau
import { hierarchyApi } from "../services/api/hierarchy.api";

/**
 * Handle export pour propager le rôle SEO au root Layout
 * Homepage = R1 ROUTER (point d'entrée sélection véhicule)
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "homepage",
    canonicalEntity: "automecanik",
  }),
};

export const meta: MetaFunction = () => {
  return [
    {
      title:
        "Catalogue de pièces détachées auto – Toutes marques & modèles | Automecanik",
    },
    {
      name: "description",
      content:
        "Pièces détachées auto pas cher pour toutes marques. Catalogue 400 000+ références, livraison 24-48h, qualité garantie. Filtrez par véhicule.",
    },
    {
      name: "keywords",
      content:
        "catalogue pièces auto, catalogue de pièces détachées auto, pièces auto en ligne, catalogue pièces détachées, pièces auto toutes marques, catalogue professionnel pièces auto",
    },
    // Canonical
    { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/" },
    // Open Graph / Facebook
    { property: "og:type", content: "website" },
    {
      property: "og:title",
      content: "Catalogue de pièces détachées auto | Automecanik",
    },
    {
      property: "og:description",
      content:
        "400 000+ pièces auto en stock pour toutes marques. Livraison 24-48h. Qualité garantie.",
    },
    {
      property: "og:image",
      content: "https://www.automecanik.com/logo-og.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    {
      property: "og:image:alt",
      content: "Automecanik - Pièces auto à prix pas cher",
    },
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Catalogue pièces auto | Automecanik" },
    {
      name: "twitter:description",
      content:
        "400 000+ pièces auto en stock pour toutes marques. Livraison 24-48h.",
    },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/logo-og.webp",
    },
    // Robots
    { name: "robots", content: "index, follow" },
    { name: "googlebot", content: "index, follow" },
  ];
};

// ✅ Migration /img/* : Preload via proxy Caddy
const IMG_PROXY_LOGOS = "/img/uploads/constructeurs-automobiles/marques-logos";

export function links() {
  return [
    // 🚀 LCP Optimization: Preload top 6 brand logos (above-fold, sorted alphabetically)
    {
      rel: "preload",
      as: "image",
      href: `${IMG_PROXY_LOGOS}/alfa-romeo.webp`,
      type: "image/webp",
    },
    {
      rel: "preload",
      as: "image",
      href: `${IMG_PROXY_LOGOS}/audi.webp`,
      type: "image/webp",
    },
    {
      rel: "preload",
      as: "image",
      href: `${IMG_PROXY_LOGOS}/bmw.webp`,
      type: "image/webp",
    },
    {
      rel: "preload",
      as: "image",
      href: `${IMG_PROXY_LOGOS}/chevrolet.webp`,
      type: "image/webp",
    },
    {
      rel: "preload",
      as: "image",
      href: `${IMG_PROXY_LOGOS}/citroen.webp`,
      type: "image/webp",
    },
    {
      rel: "preload",
      as: "image",
      href: `${IMG_PROXY_LOGOS}/dacia.webp`,
      type: "image/webp",
    },

    // 🚀 Homepage-only: Preload critical fonts (Inter + Montserrat)
    {
      rel: "preload",
      as: "font",
      type: "font/woff2",
      href: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
      crossOrigin: "anonymous" as const,
    },
    {
      rel: "preload",
      as: "font",
      type: "font/woff2",
      href: "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2",
      crossOrigin: "anonymous" as const,
    },
  ];
}

/**
 * Loader - Charge les données nécessaires côté serveur
 * ⚡ Utilise RPC optimisée: 1 appel PostgreSQL au lieu de 4 API calls
 * Performance: <150ms au lieu de 400-800ms
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    // ⚡ Single RPC call - replaces 4 API calls
    // Note: Use request origin to avoid localhost outbound connections (EADDRNOTAVAIL)
    const response = await fetch(
      getInternalApiUrlFromRequest("/api/catalog/homepage-rpc", request),
    );

    if (!response.ok) {
      throw new Error(`RPC failed: ${response.status} ${response.statusText}`);
    }

    const rpcData = await response.json();

    if (!rpcData?.success) {
      throw new Error("RPC returned invalid data");
    }

    const loadTime = Date.now() - startTime;
    logger.log(`⚡ Homepage RPC loader: ${loadTime}ms`);

    // ✅ Migration /img/* : Proxy Caddy au lieu d'URL Supabase directe
    const generateLogoUrl = (filename?: string): string | undefined => {
      if (!filename) return undefined;
      return `/img/uploads/constructeurs-automobiles/marques-logos/${filename}`;
    };

    // Transform RPC response to match expected loader data structure
    return json({
      equipementiersData: rpcData.equipementiers || [],
      blogArticlesData: rpcData.blog_articles || [],
      catalogData: rpcData.catalog || { families: [] },
      // 🔧 FIX: Transformer brands du format RPC (marque_*) vers format frontend (id, name, slug, logo)
      brandsData: (rpcData.brands || []).map((brand: any) => ({
        id: brand.marque_id,
        name: brand.marque_name,
        slug: brand.marque_alias,
        logo: generateLogoUrl(brand.marque_logo),
      })),
      statsData: rpcData.stats || {},
      success: true,
      timestamp: new Date().toISOString(),
      _performance: {
        loaderTime: loadTime,
        rpcTime: rpcData._performance?.rpcTime,
        cacheHit: rpcData._cache?.hit || false,
      },
    });
  } catch (error) {
    logger.error("Loader error:", error);
    // NO fallback - throw error to show ErrorBoundary
    throw new Response("Homepage data unavailable", { status: 500 });
  }
}

export default function TestHomepageModern() {
  // Hooks personnalisés pour gérer l'état de la page
  const homeData = useHomeData();
  const { showScrollTop, scrollToSection, scrollToTop } = useScrollBehavior();
  const searchState = useSearchState();
  const newsletter = useNewsletterState();

  return (
    <div className="min-h-screen bg-white">
      {/* Schema.org JSON-LD pour SEO - @graph avec WebSite + SearchAction + AutoPartsStore */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              // 1️⃣ WebSite - Active les sitelinks searchbox Google
              {
                "@type": "WebSite",
                "@id": "https://www.automecanik.com/#website",
                url: "https://www.automecanik.com",
                name: "Automecanik",
                description:
                  "Pièces détachées auto pour toutes marques et modèles",
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate:
                      "https://www.automecanik.com/recherche?q={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
              // 2️⃣ AutoPartsStore - Magasin de pièces auto
              {
                "@type": "AutoPartsStore",
                "@id": "https://www.automecanik.com/#store",
                name: "Automecanik",
                description:
                  "Catalogue de pièces détachées auto pour toutes marques et modèles",
                url: "https://www.automecanik.com",
                logo: "https://www.automecanik.com/logo-navbar.webp",
                image: "https://www.automecanik.com/logo-og.webp",
                telephone: "+33-1-23-45-67-89",
                priceRange: "€€",
                address: {
                  "@type": "PostalAddress",
                  addressCountry: "FR",
                },
                // Note: offers retiré - AutoPartsStore n'exige pas d'offers selon Schema.org
                // Les pages produit (pieces) ont les vrais prix dynamiques
              },
            ],
          }),
        }}
      />

      {/* 📊 Skip to main content - Accessibilité */}
      {/* Lien d'accessibilité - Sauter au contenu principal */}
      <a
        href="#catalogue"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-semantic-action focus:text-semantic-action-contrast focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      {/* 🎯 HERO SECTION - Version radicale focalisée conversion */}
      <section
        id="main-content"
        className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 text-white py-16 md:py-24"
        aria-label="Section principale"
        role="banner"
      >
        {/* Effet mesh gradient animé en arrière-plan - simplifié */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"
          aria-hidden="true"
        ></div>
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e510_1px,transparent_1px),linear-gradient(to_bottom,#4f46e510_1px,transparent_1px)] bg-[size:4rem_4rem]"
          aria-hidden="true"
        ></div>

        {/* Formes décoratives - réduites */}
        {/* 🚀 LCP OPTIMIZATION: Removed animate-pulse for better LCP score */}
        <div
          className="absolute top-10 right-10 w-64 h-64 bg-semantic-info/10 rounded-full blur-3xl"
          aria-hidden="true"
        ></div>
        <div
          className="absolute bottom-10 left-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"
          aria-hidden="true"
        ></div>

        <div className="relative container mx-auto px-4 max-w-5xl">
          {/* Titre ultra-simple et direct */}
          <div className="text-center mb-10 animate-in fade-in duration-700">
            <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
                Pièces auto{" "}
              </span>
              <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                pas cher
              </span>
            </h1>
          </div>

          {/* 🚗 SÉLECTEUR DE VÉHICULE GÉANT - FOCUS ABSOLU */}
          <div className="max-w-3xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            <VehicleSelector enableTypeMineSearch={true} />
          </div>

          {/* ✨ Trust badges - Micro-format inline */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs md:text-sm text-white/80 animate-in fade-in duration-1000 delay-500">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <CheckCircle2 className="w-4 h-4 text-semantic-success" />
              <span>
                {formatCatalogCount(homeData.stats?.total_pieces)} pièces
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Truck className="w-4 h-4 text-semantic-info" />
              <span>Livraison 24-48h</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Shield className="w-4 h-4 text-secondary-400" />
              <span>Paiement sécurisé</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Users className="w-4 h-4 text-orange-400" />
              <span>Experts gratuits</span>
            </div>
          </div>
        </div>
      </section>

      {/* 🔍 RECHERCHE ALTERNATIVE - Version compacte */}
      <section className="relative py-12 md:py-14 overflow-hidden">
        {/* Fond dégradé sophistiqué */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>

        {/* Motif décoratif */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.02]">
          <div className="absolute top-20 left-20 w-72 h-72 bg-semantic-info rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-secondary-600 rounded-full blur-3xl"></div>
        </div>

        <div className="relative container mx-auto px-4 max-w-7xl">
          {/* En-tête */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Trouvez la pièce{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                qu'il vous faut
              </span>
            </h2>
          </div>

          {/* Grille de cartes - Composant extrait */}
          <HomeSearchCards
            scrollToSection={scrollToSection}
            onReferenceSearchClick={() => searchState.setShowSearchBar(true)}
          />
        </div>
      </section>

      {/* Modal de recherche par référence - Composant extrait */}
      <ReferenceSearchModal
        isOpen={searchState.showSearchBar}
        searchReference={searchState.searchReference}
        onSearchReferenceChange={searchState.setSearchReference}
        onSubmit={(e) => {
          e.preventDefault();
          searchState.handleReferenceSearch();
        }}
        onClose={searchState.closeSearchBar}
      />

      {/* 📂 CATALOGUE COMPLET - Version optimisée */}
      <section
        id="catalogue"
        className="py-12 bg-gradient-to-br from-slate-50 to-blue-50 scroll-mt-24"
      >
        <div className="container mx-auto px-4">
          {/* En-tête simplifié */}
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Catalogue pièces auto
            </h2>
            <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-3"></div>
            <p className="text-base text-gray-700">
              Pièces neuves pour toutes marques
            </p>
          </div>

          {/* Titre gammes */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Par gamme de pièces
            </h2>
            <p className="text-center text-gray-600 text-sm max-w-2xl mx-auto mb-8">
              Explorez notre catalogue organisé par familles techniques
            </p>
          </div>

          {/* Loading state */}
          {homeData.loadingCatalog && (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement du catalogue...</p>
            </div>
          )}

          {/* Grid des familles */}
          {!homeData.loadingCatalog && homeData.families.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {homeData.families.map((family, index) => {
                  const familyImage = hierarchyApi.getFamilyImage(family);
                  const familyColor = hierarchyApi.getFamilyColor(family);
                  const isExpanded = homeData.expandedFamilies.includes(
                    family.mf_id,
                  );
                  const displayedGammes = isExpanded
                    ? family.gammes
                    : family.gammes.slice(0, 4);
                  // Générer un ID basé sur le nom de la famille pour le scroll navigation
                  const familySlug = (
                    family.mf_name_system ||
                    family.mf_name ||
                    ""
                  )
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "");

                  return (
                    <Card
                      key={family.mf_id}
                      id={`famille-${familySlug}`}
                      className="group hover:shadow-xl hover:-translate-y-2 transition-all duration-slower overflow-hidden scroll-mt-24"
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      {/* Image header avec couleur en fond */}
                      <div
                        className={`relative h-48 overflow-hidden bg-gradient-to-br ${familyColor}`}
                      >
                        <img
                          src={familyImage}
                          alt={family.mf_name_system || family.mf_name}
                          className="w-full h-full object-contain transition-transform duration-slower group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          width="400"
                          height="300"
                          onError={(e) => {
                            e.currentTarget.src =
                              "/images/categories/default.svg";
                          }}
                        />

                        {/* Titre - overlay qui s'intensifie au hover */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent group-hover:from-black/80 transition-colors duration-slower">
                          <h3 className="text-white font-bold text-lg line-clamp-2">
                            {family.mf_name_system || family.mf_name}
                          </h3>
                        </div>
                      </div>

                      {/* Contenu avec sous-catégories */}
                      <CardContent className="pt-4">
                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {family.mf_description ||
                            "Découvrez notre sélection complète"}
                        </p>

                        {/* Liste des sous-catégories (4 ou toutes selon isExpanded) */}
                        <div className="space-y-2.5 mb-4 max-h-96 overflow-y-auto">
                          {displayedGammes.map((gamme, idx) => {
                            // Générer l'URL avec fallback si pg_alias manquant
                            const categoryUrl =
                              gamme.pg_id && gamme.pg_alias
                                ? `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`
                                : `/products/catalog?search=${encodeURIComponent(gamme.pg_name || "")}&gamme=${gamme.pg_id}`;

                            return (
                              <Link
                                key={idx}
                                to={categoryUrl}
                                className="text-sm text-neutral-600 hover:text-semantic-info hover:pl-2 transition-all duration-200 flex items-center gap-2.5 group/item py-1"
                              >
                                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full group-hover/item:bg-semantic-info group-hover/item:scale-125 transition-all" />
                                <span className="line-clamp-1 font-medium">
                                  {gamme.pg_name}
                                </span>
                              </Link>
                            );
                          })}
                        </div>

                        {/* Bouton voir tout/moins */}
                        {family.gammes_count > 4 && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              homeData.toggleFamilyExpansion(family.mf_id)
                            }
                            className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-semantic-info hover:text-semantic-info-contrast hover:border-semantic-info transition-colors flex items-center justify-center gap-2"
                          >
                            {isExpanded ? (
                              <>
                                Voir moins
                                <ChevronRight className="h-4 w-4 rotate-90" />
                              </>
                            ) : (
                              <>
                                Pièces de{" "}
                                {(
                                  family.mf_name_system ||
                                  family.mf_name ||
                                  ""
                                ).toLowerCase()}
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Message si pas de données */}
          {!homeData.loadingCatalog && homeData.families.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-600">
                Aucune famille de produits disponible pour le moment.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 🎨 MARQUES & CONSTRUCTEURS - Version optimisée */}
      <section
        id="toutes-les-marques"
        className="py-12 bg-white scroll-mt-24"
        aria-labelledby="marques-title"
      >
        <div className="container mx-auto px-4">
          {/* En-tête simplifié */}
          <div className="max-w-5xl mx-auto mb-10">
            <h2
              id="marques-title"
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center"
            >
              Toutes les marques auto
            </h2>
            <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-4"></div>
          </div>

          {/* Titre H2 */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              Cliquez sur un logo pour voir les modèles
            </p>
          </div>

          {/* Loading state */}
          {homeData.loadingBrands ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des marques...</p>
            </div>
          ) : (
            <>
              {/* Grid simple sans groupement alphabétique - Plus lisible */}
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-8 gap-4 max-w-7xl mx-auto mb-16">
                {homeData.brands
                  .sort((a, b) => a.name.localeCompare(b.name, "fr"))
                  .map((brand, index) => (
                    <Link
                      key={brand.id}
                      to={`/constructeurs/${brand.slug}-${brand.id}.html`}
                      className="group animate-in fade-in duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 rounded-lg"
                      style={{
                        animationDelay: `${index * 20}ms`,
                        animationFillMode: "both",
                      }}
                      aria-label={`Voir les pièces ${brand.name}`}
                    >
                      {/* Card optimale - Équilibre parfait */}
                      <div className="relative overflow-hidden bg-white rounded-lg border border-neutral-100 hover:border-semantic-info hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 aspect-square">
                        {/* Logo avec fallback simple */}
                        <div className="w-full h-full p-3 flex items-center justify-center bg-gray-50">
                          {brand.logo ? (
                            <img
                              src={brand.logo}
                              alt={`Logo ${brand.name}`}
                              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                              // 🚀 LCP: First 6 images are eager-loaded (above-fold)
                              loading={index < 6 ? "eager" : "lazy"}
                              // @ts-expect-error - fetchpriority is a valid HTML attribute but React types it as fetchPriority
                              fetchpriority={index < 6 ? "high" : "auto"}
                              decoding={index < 6 ? "sync" : "async"}
                              width="200"
                              height="200"
                              onError={(e) => {
                                logger.error(
                                  "❌ Erreur chargement logo:",
                                  brand.name,
                                  brand.logo,
                                );
                                e.currentTarget.style.display = "none";
                                const fallback =
                                  e.currentTarget.parentElement?.querySelector(
                                    ".fallback-text",
                                  );
                                if (fallback)
                                  fallback.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div
                            className={`fallback-text text-gray-400 text-sm font-bold text-center ${brand.logo ? "hidden" : ""}`}
                          >
                            {brand.name.substring(0, 3).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            </>
          )}

          {/* FAQ MODERNE - Composant extrait */}
          <HomeFAQSection />
        </div>
      </section>

      {/* 🏭 ÉQUIPEMENTIERS - Composant réel intégré */}
      <EquipementiersCarousel equipementiersData={homeData.equipementiers} />

      {/* 🤝 CERTIFICATIONS - Composant extrait */}
      <HomeCertifications />

      {/* 📰 BLOG - Composant extrait */}
      <HomeBlogSection blogArticles={homeData.blogArticles} />

      {/* 🌟 SECTIONS FINALES - Composant extrait : Advantages + Newsletter + Contact CTA */}
      <HomeBottomSections newsletter={newsletter} />

      {/*  SCROLL TO TOP BUTTON */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 animate-in fade-in slide-in-from-bottom-4"
          aria-label="Retour en haut de page"
        >
          <ChevronRight className="w-6 h-6 -rotate-90" />
        </button>
      )}

      {/* ====================================
       * 🔧 MODAL COMPARATEUR - COMMENTÉ
       * Code complet conservé pour développement futur
       * Décommenter et réactiver les états + handlers ci-dessus
       * ==================================== 
      {showComparator && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={closeComparator}
        >
          ... Modal content ...
        </div>
      )}
      */}
    </div>
  );
}
