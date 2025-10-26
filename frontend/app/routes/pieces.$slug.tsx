import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import CatalogueSection from "../components/pieces/CatalogueSection";
import ConseilsSection from "../components/pieces/ConseilsSection";
import EquipementiersSection from "../components/pieces/EquipementiersSection";
import GuideSection from "../components/pieces/GuideSection";
import InformationsSection from "../components/pieces/InformationsSection";
import MotorisationsSection from "../components/pieces/MotorisationsSection";
import PerformanceIndicator from "../components/pieces/PerformanceIndicator";
import { LazySection, LazySectionSkeleton } from "../components/seo/LazySection";
import { SEOHelmet, type BreadcrumbItem } from "../components/ui/SEOHelmet";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";
import { buildCanonicalUrl } from "../utils/seo/canonical";
import { generateGammeMeta } from "../utils/seo/meta-generators";

interface LoaderData {
  status: number;
  meta?: {
    title: string;
    description: string;
    keywords: string;
    robots: string;
    canonical: string;
    relfollow: number;
  };
  breadcrumbs?: {
    items: Array<{
      label: string;
      href: string;
    }>;
  };
  performance?: {
    total_time_ms: number;
    parallel_time_ms: number;
    motorisations_count: number;
    catalogue_famille_count: number;
    equipementiers_count: number;
    conseils_count: number;
    informations_count: number;
    guide_available: number;
  };
  content?: {
    h1: string;
    content: string;
    pg_name: string;
    pg_alias: string;
    pg_pic: string;
    pg_wall: string;
  };
  guide?: {
    id: number;
    title: string;
    alias: string;
    preview: string;
    wall: string;
    date: string;
    image: string;
    link: string;
    h2_content?: string;
  };
  motorisations?: {
    title: string;
    items: Array<{
      title: string;
      description: string;
      image: string;
      link: string;
      marque_name: string;
      modele_name: string;
      type_name: string;
      puissance: string;
      periode: string;
      advice: string;
    }>;
  };
  catalogueMameFamille?: {
    title: string;
    items: Array<{
      name: string;
      link: string;
      image: string;
      description: string;
      meta_description: string;
    }>;
  };
  equipementiers?: {
    title: string;
    items: Array<{
      pm_id: number;
      pm_name: string;
      pm_logo: string;
      title: string;
      image: string;
      description: string;
    }>;
  };
  conseils?: {
    title: string;
    content: string;
    items: Array<{
      id: number;
      title: string;
      content: string;
    }>;
  };
  informations?: {
    title: string;
    content: string;
    items: string[];
  };
}

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  // Extraire l'ID de la gamme depuis le slug (format: nom-gamme-ID.html)
  const match = slug.match(/-(\d+)\.html$/);
  if (!match) {
    throw new Response("Invalid slug format", { status: 400 });
  }

  const gammeId = match[1];

  try {
    const response = await fetch(`http://localhost:3000/api/gamme-rest-optimized/${gammeId}/page-data`);
    
    if (!response.ok) {
      throw new Response("API Error", { status: response.status });
    }

    const data: LoaderData = await response.json();
    
    return json(data);
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data || data.status !== 200) {
    return [
      { title: "Page non trouvée" },
      { name: "description", content: "La page demandée n'a pas été trouvée." },
    ];
  }

  // Construire l'URL canonique avec les utilitaires SEO
  // Note: L'URL canonique sera gérée via <link rel="canonical"> dans le component
  const searchParams = new URL(location.pathname + location.search, 'https://automecanik.com').searchParams;
  const paramsObj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    paramsObj[key] = value;
  });

  const _canonicalUrl = buildCanonicalUrl({
    baseUrl: location.pathname,
    params: paramsObj,
    includeHost: true,
  });
  
  // TODO: Ajouter l'URL canonique via <Links> dans le component ou SEOHelmet

  // Générer les meta tags optimisés pour CTR
  const metaTags = generateGammeMeta({
    name: data.content?.pg_name || data.meta?.title || "Pièces Auto",
    count: data.motorisations?.items.length || 0,
    minPrice: undefined, // Calculer depuis les données si disponible
    vehicleBrand: paramsObj.marque,
    vehicleModel: paramsObj.modele,
    onSale: false, // Déterminer depuis les données
  });

  // Construire le tableau de meta tags Remix
  const result: Array<{ title?: string; name?: string; content?: string }> = [];

  // Title
  result.push({ title: metaTags.title });

  // Description
  result.push({ name: "description", content: metaTags.description });

  // Keywords
  if (metaTags.keywords && metaTags.keywords.length > 0) {
    result.push({ name: "keywords", content: metaTags.keywords.join(", ") });
  }

  // Canonical (géré via <link> dans le head via SEOHelmet ou autre méthode)
  // Pour Remix, on peut aussi ajouter via le component <Links />
  
  // Robots
  if (data.meta?.robots) {
    result.push({ name: "robots", content: data.meta.robots });
  } else {
    result.push({ name: "robots", content: "index, follow" });
  }

  return result;
};

export default function PiecesDetailPage() {
  const data = useLoaderData<typeof loader>();

  if (!data || data.status !== 200) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Page non trouvée</h1>
        <p className="text-gray-600">Désolé, cette page n'existe pas.</p>
      </div>
    </div>;
  }

  // Construire les breadcrumbs depuis l'API ou fallback manuel
  const breadcrumbs: BreadcrumbItem[] = data.breadcrumbs?.items || [
    { label: "Accueil", href: "/" },
    { label: "Pièces Auto", href: "/pieces" },
    { label: data.content?.pg_name || "Pièce", href: data.meta?.canonical || "" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      
      {/* SEO avec schemas JSON-LD enrichis */}
      <SEOHelmet
        seo={{
          title: data.meta?.title || "",
          description: data.meta?.description || "",
          canonicalUrl: data.meta?.canonical,
          keywords: data.meta?.keywords ? [data.meta.keywords] : undefined,
          breadcrumbs,
          organization: {
            name: "Automecanik",
            logo: "https://automecanik.com/logo.png",
            url: "https://automecanik.com",
            contactPoint: {
              telephone: "+33-1-XX-XX-XX-XX",
              contactType: "Service Client",
              email: "contact@automecanik.com"
            },
            sameAs: [
              "https://www.facebook.com/automecanik",
              "https://twitter.com/automecanik"
            ]
          }
        }}
      />

      {/* Breadcrumbs visuels */}
      <div className="container mx-auto px-4 pt-4">
        <Breadcrumbs items={breadcrumbs} enableSchema={false} />
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {/* Indicateur de performance */}
        <PerformanceIndicator performance={data.performance} />

        {/* Vehicle Selector pour trouver des pièces compatibles */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Sélectionnez votre véhicule pour cette gamme
          </h2>
          <VehicleSelectorV2
            mode="full"
            variant="card"
            context="homepage"
            redirectOnSelect={false}
            onVehicleSelect={(selection) => {
              // Navigation vers la page pièces avec véhicule
              if (selection.brand && selection.model && selection.type && data?.content) {
                const brandSlug = `${selection.brand.marque_alias}-${selection.brand.marque_id}`;
                const modelSlug = `${selection.model.modele_alias}-${selection.model.modele_id}`;
                
                // Gérer les types sans alias
                let typeAlias = selection.type.type_alias;
                if (!typeAlias && selection.type.type_liter && selection.type.type_fuel) {
                  const liter = (parseInt(selection.type.type_liter) / 100).toFixed(1).replace('.', '-');
                  const fuel = selection.type.type_fuel.toLowerCase();
                  typeAlias = `${liter}-${fuel}`;
                }
                
                const typeSlug = `${typeAlias || 'type'}-${selection.type.type_id}.html`;
                const url = `/pieces/${data.content.pg_alias}/${brandSlug}/${modelSlug}/${typeSlug}`;
                
                console.log('🚀 Navigation vers:', url);
                
                // Navigation avec délai
                setTimeout(() => {
                  window.location.href = url;
                }, 1500);
              }
            }}
            className="bg-gray-50 p-4 rounded-md"
          />
        </div>        {/* Hero Section */}
        <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
          <div className="relative">
            {data.content?.pg_wall && (
              <div className="h-64 bg-gradient-to-r from-blue-600 to-blue-800 relative overflow-hidden">
                <img
                  src={`/upload/articles/gammes-produits/wall/${data.content.pg_wall}`}
                  alt={data.content.h1}
                  className="w-full h-full object-cover opacity-30"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center text-center p-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                  {data.content?.h1}
                </h1>
                <p className="text-xl text-white/90 max-w-2xl mx-auto drop-shadow">
                  Découvrez notre sélection de {data.content?.pg_name} de qualité professionnelle
                </p>
              </div>
            </div>
          </div>
          
          {/* Contenu principal */}
          {data.content?.content && (
            <div className="p-8">
              <div 
                className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: data.content.content }} 
              />
            </div>
          )}
        </section>

        {/* Guide Expert */}
        <GuideSection guide={data.guide} />

        {/* Motorisations - Section critique, chargée immédiatement */}
        <MotorisationsSection motorisations={data.motorisations} />

        {/* Catalogue Même Famille - Lazy load avec skeleton */}
        <LazySection
          id="catalogue-section"
          threshold={0.1}
          rootMargin="200px"
          fallback={<LazySectionSkeleton rows={4} height="h-48" />}
        >
          <CatalogueSection catalogueMameFamille={data.catalogueMameFamille} />
        </LazySection>

        {/* Équipementiers - Lazy load */}
        <LazySection
          id="equipementiers-section"
          threshold={0.1}
          rootMargin="200px"
          fallback={<LazySectionSkeleton rows={3} height="h-32" />}
        >
          <EquipementiersSection equipementiers={data.equipementiers} />
        </LazySection>

        {/* Conseils - Lazy load */}
        <LazySection
          id="conseils-section"
          threshold={0.05}
          rootMargin="300px"
          fallback={
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
          }
        >
          <ConseilsSection conseils={data.conseils} />
        </LazySection>

        {/* Informations - Lazy load (footer-like) */}
        <LazySection
          id="informations-section"
          threshold={0}
          rootMargin="400px"
          fallback={
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded"></div>
                ))}
              </div>
            </div>
          }
        >
          <InformationsSection informations={data.informations} />
        </LazySection>

      </div>
    </div>
  );
}