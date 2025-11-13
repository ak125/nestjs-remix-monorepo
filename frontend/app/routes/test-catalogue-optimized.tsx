import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect } from "react";
import { fetchGammePageData } from "~/services/api/gamme-api.service";

import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import CatalogueSection from "../components/pieces/CatalogueSection";
import ConseilsSection from "../components/pieces/ConseilsSection";
import EquipementiersSection from "../components/pieces/EquipementiersSection";
import GuideSection from "../components/pieces/GuideSection";
import InformationsSection from "../components/pieces/InformationsSection";
import MotorisationsSection from "../components/pieces/MotorisationsSection";
import { LazySection, LazySectionSkeleton } from "../components/seo/LazySection";
import { SEOHelmet, type BreadcrumbItem } from "../components/ui/SEOHelmet";
import { VehicleFilterBadge } from "../components/vehicle/VehicleFilterBadge";
import VehicleSelector from "../components/vehicle/VehicleSelector";
import { buildCanonicalUrl } from "../utils/seo/canonical";
import { CheckCircle2, Truck, Shield, Users } from 'lucide-react';
import { generateGammeMeta } from "../utils/seo/meta-generators";
import { getVehicleFromCookie, buildBreadcrumbWithVehicle, storeVehicleClient, type VehicleCookie } from "../utils/vehicle-cookie";
import { hierarchyApi } from "../services/api/hierarchy.api";
import { TrustBadgeGroup } from "../components/trust/TrustBadge";
import { PurchaseGuide } from "../components/catalog/PurchaseGuide";

interface LoaderData {
  status: number;
  selectedVehicle?: VehicleCookie | null;
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
      current?: boolean;
    }>;
  };
  famille?: {
    mf_id: number;
    mf_name: string;
    mf_pic: string;
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
      sort?: number;
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

export async function loader({ params, request }: LoaderFunctionArgs) {
  // 🧪 Pour la page de test, utiliser un slug par défaut si non fourni
  const slug = params.slug || "plaquette-de-frein-402.html";

  // Extraire l'ID de la gamme depuis le slug (format: nom-gamme-ID.html)
  const match = slug.match(/-(\d+)\.html$/);
  if (!match) {
    throw new Response("Invalid slug format", { status: 400 });
  }

  const gammeId = match[1];

  // 🚗 Récupérer véhicule depuis cookie
  const selectedVehicle = await getVehicleFromCookie(
    request.headers.get("Cookie")
  );

  console.log('🚗 Véhicule depuis cookie:', selectedVehicle ? 
    `${selectedVehicle.marque_name} ${selectedVehicle.modele_name}` : 
    'Aucun véhicule sélectionné'
  );

  try {
    // 🚀 Configuration API depuis variables d'environnement
    const API_URL = typeof window === 'undefined' 
      ? (process.env.VITE_API_URL || 'http://localhost:3000')
      : (import.meta.env.VITE_API_URL || 'http://localhost:3000');
    
    // 🚀 Timeout de 30 secondes pour éviter les 504
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const [pageData, hierarchyResponse] = await Promise.all([
      // 🚀 RPC V2 avec fallback automatique
      fetchGammePageData(gammeId, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId)),
      fetch(
        `${API_URL}/api/catalog/gammes/hierarchy`,
        { 
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        }
      ).finally(() => clearTimeout(timeoutId))
    ]);
    
    // pageData est déjà un objet (pas besoin de .json())
    const data: LoaderData = pageData;
    
    // 🔄 Si on a la hiérarchie et une famille, remplacer catalogueMameFamille par les données de la hiérarchie
    if (hierarchyResponse.ok && data.famille?.mf_id) {
      const hierarchyData = await hierarchyResponse.json();
      const family = hierarchyData.families?.find((f: any) => f.id === data.famille?.mf_id);
      
      if (family && family.gammes) {
        // Exclure la gamme actuelle - Convertir en nombres pour comparaison stricte
        const currentGammeId = parseInt(gammeId);
        const otherGammes = family.gammes.filter((g: any) => {
          const gammeIdNum = typeof g.id === 'string' ? parseInt(g.id) : g.id;
          return gammeIdNum !== currentGammeId;
        });
        
        console.log(`🔍 Gamme actuelle: ${currentGammeId}, Gammes filtrées: ${otherGammes.length}/${family.gammes.length}`);
        
        data.catalogueMameFamille = {
          title: `Catalogue ${data.famille.mf_name}`,
          items: otherGammes.map((g: any) => ({
            name: g.name,
            link: `/pieces/${g.alias}-${g.id}.html`,
            image: g.image 
              ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${g.image}`
              : `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${g.alias}.webp`,
            description: `Automecanik vous conseils de contrôlez l'état du ${g.name.toLowerCase()} de votre véhicule et de le changer en respectant les périodes de remplacement du constructeur`,
            meta_description: `${g.name} pas cher à contrôler régulièrement, changer si encrassé`,
            sort: g.sort_order,
          }))
        };
        
        console.log(`✅ Catalogue remplacé par hiérarchie: ${data.catalogueMameFamille.items.length} gammes dans l'ordre`);
      }
    }
    
    // 🍞 Construire breadcrumb de base
    const baseBreadcrumb = [
      { label: "Accueil", href: "/" },
      { label: "Pièces", href: "/pieces/catalogue" },
      { label: data.content?.pg_name || "Pièce", current: true }
    ];

    // 🍞 Ajouter véhicule au breadcrumb si disponible
    const breadcrumbItems = buildBreadcrumbWithVehicle(
      baseBreadcrumb,
      selectedVehicle
    );

    console.log('🍞 Breadcrumb généré:', breadcrumbItems.map(i => i.label).join(' → '));

    // Retourner data avec breadcrumb mis à jour et véhicule
    return json({
      ...data,
      breadcrumbs: { items: breadcrumbItems },
      selectedVehicle
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      }
    });
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

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  };
}

export default function PiecesDetailPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  
  // Afficher un indicateur de chargement si les données sont en cours de chargement
  const isLoading = navigation.state === "loading";

  useEffect(() => {
    if (isLoading) {
      console.log('⏳ Chargement des données en cours...');
    }
  }, [isLoading]);

  if (!data || data.status !== 200) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 mb-4">Page non trouvée</h1>
        <p className="text-neutral-600">Désolé, cette page n'existe pas.</p>
      </div>
    </div>;
  }

  // Construire les breadcrumbs depuis l'API (déjà avec véhicule si présent)
  const breadcrumbs: BreadcrumbItem[] = data.breadcrumbs?.items.map(item => ({
    label: item.label,
    href: item.href || "",
    current: item.current
  })) || [
    { label: "Accueil", href: "/" },
    { label: "Pièces", href: "/pieces/catalogue" },
    { label: data.content?.pg_name || "Pièce", href: data.meta?.canonical || "" }
  ];

  // 🎨 Récupérer la couleur de la famille pour le hero
  const familleColor = data.famille ? hierarchyApi.getFamilyColor({
    mf_id: data.famille.mf_id,
    mf_name: data.famille.mf_name,
    mf_pic: data.famille.mf_pic,
  } as any) : 'from-primary-950 via-primary-900 to-secondary-900'; // Fallback avec design tokens

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      
      {/* ⏳ Indicateur de chargement global */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-semantic-info animate-pulse">
          <div className="h-full bg-gradient-to-r from-semantic-info via-secondary-500 to-semantic-info bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"></div>
        </div>
      )}
      
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

      {/* 🎯 HERO SECTION - Avec couleur de la famille */}
      <section 
        className={`relative overflow-hidden bg-gradient-to-br ${familleColor} text-white py-12 md:py-16 lg:py-20`}
        aria-label="Sélection véhicule"
      >
        {/* Image wallpaper en arrière-plan (si disponible) */}
        {data.content?.pg_wall && (
          <div className="absolute inset-0 z-0">
            <img
              src={`/upload/articles/gammes-produits/wall/${data.content.pg_wall}`}
              alt={data.content.pg_name || ""}
              className="w-full h-full object-cover opacity-25"
              loading="eager"
              onError={(e) => {
                e.currentTarget.src = '/images/placeholder-hero.webp';
                e.currentTarget.onerror = null;
              }}
            />
            {/* Overlay gradient pour assurer la lisibilité du texte */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-transparent"></div>
          </div>
        )}
        
        {/* Effet mesh gradient adaptatif */}
        <div 
          className="absolute inset-0 z-[1] opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(0,0,0,0.15) 0%, transparent 50%)`
          }}
          aria-hidden="true"
        />
        <div 
          className="absolute inset-0 z-[1] opacity-[0.07]" 
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: '3rem 3rem'
          }}
          aria-hidden="true"
        />
        
        {/* Formes décoratives organiques */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/[0.07] rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite] z-[1]" aria-hidden="true"></div>
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-black/[0.08] rounded-full blur-3xl animate-[pulse_12s_ease-in-out_infinite] z-[1]" aria-hidden="true"></div>
        
        <div className="relative z-10 container mx-auto px-4 max-w-7xl">
          
          {/* Badges contextuels en haut */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-6 md:mb-8 animate-in fade-in duration-700">
            {data.famille && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
                <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${familleColor} animate-pulse shadow-lg`}></div>
                <span className="text-white/95 font-semibold text-sm tracking-wide">{data.famille.mf_name}</span>
              </div>
            )}
            {data.famille?.mf_name.toLowerCase().includes('frein') && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
                <Shield className="w-4 h-4 text-red-300" />
                <span className="text-white/95 text-sm font-semibold">Votre sécurité est notre priorité</span>
              </div>
            )}
          </div>
          
          {/* Titre H1 dynamique optimisé SEO */}
          <div className="text-center mb-6 md:mb-8 animate-in fade-in duration-700 delay-100">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-2xl">
                {data.content?.h1 || `${data.content?.pg_name || "Pièces auto"} pas cher`}
              </span>
            </h1>
          </div>
          
          {/* Cadre glassmorphism contenant Image + VehicleSelector */}
          <div className="max-w-5xl mx-auto mb-8 md:mb-10 animate-in fade-in duration-1000 delay-200">
            <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] backdrop-blur-xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-6 md:p-8 border border-white/30 hover:border-white/50 transition-all duration-500">
              
              {/* Sous-titre dynamique en haut du cadre */}
              <div className="text-center mb-6">
                <p className="text-white/95 text-base md:text-lg font-semibold drop-shadow-lg">
                  {data.content?.pg_name 
                    ? `Trouvez ${data.content.pg_name.toLowerCase().includes('plaquette') || data.content.pg_name.toLowerCase().includes('disque') ? 'vos' : 'votre'} ${data.content.pg_name.toLowerCase()} compatible${data.content.pg_name.toLowerCase().includes('plaquette') || data.content.pg_name.toLowerCase().includes('disque') ? 's' : ''} avec votre voiture`
                    : "Trouvez la référence compatible avec votre véhicule"
                  }
                </p>
              </div>
              
              {/* Layout horizontal : Image + VehicleSelector côte à côte */}
              <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
                
                {/* Image produit à gauche */}
                <div className="flex-shrink-0 w-full lg:w-80">
                  <div className="relative group">
                    {/* Cercle décoratif arrière-plan */}
                    <div className="absolute inset-0 -z-10">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition-all duration-700"></div>
                    </div>
                    
                    {/* Container image */}
                    <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg group-hover:border-white/40 transition-all duration-500">
                      <div className="w-full aspect-square flex items-center justify-center">
                        <img
                          src={data.content?.pg_pic 
                            ? `/upload/articles/gammes-produits/catalogue/${data.content.pg_pic}` 
                            : data.content?.pg_alias
                            ? `/upload/articles/gammes-produits/catalogue/${data.content.pg_alias}.webp`
                            : 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/plaquette-de-frein.webp'
                          }
                          alt={data.content?.pg_name || "Pièce auto"}
                          className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-all duration-700"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.src = '/images/placeholder-product.webp';
                            e.currentTarget.onerror = null;
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Particule décorative */}
                    <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-white/15 rounded-full blur-xl animate-[float_8s_ease-in-out_infinite]" aria-hidden="true"></div>
                  </div>
                </div>
                
                {/* VehicleSelector à droite */}
                <div className="flex-1 w-full animate-in fade-in slide-in-from-right duration-1000 delay-400">
                  <VehicleSelector />
                </div>
              </div>
              
            </div>
          </div>
          
          {/* Trust badges premium - Grid responsive pour mobile - Design Tokens */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-space-3 md:gap-space-4 max-w-3xl mx-auto animate-in fade-in duration-700 delay-400">
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">50 000+ pièces</span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Truck className="w-4 h-4 text-blue-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">Livraison 24-48h</span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Shield className="w-4 h-4 text-purple-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">Paiement sécurisé</span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Users className="w-4 h-4 text-orange-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">Experts gratuits</span>
            </div>
          </div>
          
        </div>
      </section>

      {/* 💡 Guide d'achat personnalisé par famille - Sous le hero */}
      {data.famille && (
        <PurchaseGuide
          familleId={data.famille.mf_id}
          familleName={data.famille.mf_name}
          productName={data.content?.pg_name}
          familleColor={familleColor}
          className="-mt-space-3 mb-space-6"
        />
      )}

      {/* 🛡️ Conseil Automecanik - Card blanche avec Design Tokens */}
      {data.famille?.mf_name.toLowerCase().includes('frein') && (
        <section className="container mx-auto px-space-4 -mt-space-6 mb-space-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-space-6 border border-neutral-200 hover:shadow-2xl transition-shadow duration-300">
              <div className="flex items-start gap-space-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-heading text-neutral-900 font-bold text-base mb-space-2">Conseil Automecanik</p>
                  <p className="font-sans text-neutral-700 text-sm md:text-base leading-relaxed mb-space-3">
                    Contrôlez et changez vos plaquettes de frein régulièrement pour votre sécurité et le bon fonctionnement du système de freinage.
                  </p>
                  <a 
                    href="#guide" 
                    className="inline-flex items-center gap-space-2 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors group"
                  >
                    <span>En savoir plus sur l'entretien</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 📊 Sections lazy-loaded */}

      {/* �🛡️ Conseil Automecanik - Card blanche améliorée */}
            {/* 🚗 Badge véhicule actif (si présent) */}

      {/* 🚗 Badge véhicule actif (si présent) */}
      {data.selectedVehicle && (
        <div className="container mx-auto px-4 mt-4">
          <VehicleFilterBadge 
            vehicle={data.selectedVehicle}
            showDetails={true}
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        
        {/* Contenu principal de la gamme */}
        <section className="bg-white rounded-xl shadow-lg mb-6 md:mb-8 overflow-hidden">
          {/* Contenu SEO */}
          {data.content?.content && (
            <div className="p-4 md:p-6 lg:p-8">
              <div 
                className="prose prose-lg max-w-none text-neutral-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: data.content.content }} 
              />
            </div>
          )}
        </section>

        {/* Guide Expert */}
        <div id="guide-expert" className="scroll-mt-20">
          <GuideSection guide={data.guide} familleColor={familleColor} familleName={data.famille?.mf_name} />
        </div>

        {/* Motorisations - Section critique, chargée immédiatement */}
        <MotorisationsSection 
          motorisations={data.motorisations}
          familleColor={familleColor}
          familleName={data.famille?.mf_name || 'pièces'}
        />

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
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6 md:mb-8 animate-pulse">
              <div className="h-8 bg-neutral-200 rounded w-1/3 mb-6"></div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-neutral-100 rounded"></div>
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
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6 md:mb-8 animate-pulse">
              <div className="h-8 bg-neutral-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-4 bg-neutral-100 rounded"></div>
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