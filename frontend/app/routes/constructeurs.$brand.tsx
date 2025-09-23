// 📁 frontend/app/routes/constructeurs.$brand.tsx
// 🏭 Page marque constructeur - Version modernisée reproduisant la structure originale

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useEffect } from "react";

// 🎨 Composants modernisés
import VehicleCard from "../components/constructeurs/VehicleCard";
import MultiCarousel from "../components/ui/MultiCarousel";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";

// 📊 Types de données avec noms Supabase (minuscules)
interface BrandData {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  marque_logo: string;
  marque_wall?: string;
  marque_relfollow: number;
  marque_sitemap: number;
  marque_display: number;
  marque_sort: number;
  marque_top: number;
  marque_country?: string;
}

interface SeoData {
  h1?: string;
  title?: string;
  descrip?: string;
  keywords?: string;
  canonical?: string;
  robots?: string;
}

interface PopularVehicle {
  cgc_type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power_ps: number;
  type_month_from: number;
  type_year_from: number;
  type_month_to?: number;
  type_year_to?: number;
  type_fuel?: string;
  type_liter?: string;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta?: string;
  modele_pic?: string;
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta?: string;
  marque_name_meta_title?: string;
}

interface PopularPart {
  pg_alias: string;
  pg_name: string;
  pf_alias: string;
  pf_name: string;
  count?: number;
}

interface BlogContent {
  h1: string;
  title: string;
  content: string;
  keywords?: string;
}

interface LoaderData {
  brand: BrandData;
  seo: SeoData;
  popularVehicles: PopularVehicle[];
  popularParts: PopularPart[];
  blogContent: BlogContent;
}

// 🔄 Loader pour récupérer les données
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { brand } = params;
  const url = new URL(request.url);
  
  console.log('🔍 Brand loader called for:', url.pathname);
  console.log('🔍 Params received:', params);
  
  if (!brand) {
    throw new Response("Marque non spécifiée", { status: 400 });
  }
  
  // Cette route gère les pages de marque : /constructeurs/bmw
  // Les pages de détail véhicule avec plus de segments sont gérées par les routes enfant
  // On ne doit PAS rejeter les URLs avec plus de segments ici car elles sont pour les routes enfant

  try {
    // Pour l'instant, utilisons des données mockées pour éviter les problèmes d'API
    // TODO: Réintégrer l'API une fois le problème résolu
    const mockBrandData: BrandData = {
      marque_id: brand === 'audi' ? 22 : 140,
      marque_alias: brand,
      marque_name: brand.toUpperCase(),
      marque_name_meta: brand.toUpperCase(),
      marque_name_meta_title: brand.toUpperCase(),
      marque_logo: `${brand}.webp`,
      marque_wall: `${brand}.jpg`,
      marque_relfollow: 1,
      marque_sitemap: 1,
      marque_display: 1,
      marque_sort: 50,
      marque_top: 1
    };

    const brandData = mockBrandData;

    // Données SEO mockées
    const seoData: SeoData = {
      h1: `Pièces auto ${brandData.marque_name} à mini prix`,
      title: `Pièce ${brandData.marque_name} mini prix pour tous les modèles de véhicule`,
      descrip: `Trouvez sur Automecanik toutes les pièces détachées ${brandData.marque_name} à prix pas cher. Livraison rapide et garantie constructeur.`,
      keywords: `pieces ${brandData.marque_name}, pieces detachees ${brandData.marque_name}, ${brandData.marque_name} pas cher`,
      canonical: `/constructeurs/${brand}`
    };

    // Véhicules populaires mockés
    const popularVehicles: PopularVehicle[] = [
      {
        cgc_type_id: 1,
        type_alias: `${brand}-serie-3-320d`,
        type_name: "320 d",
        type_name_meta: "320 d",
        type_power_ps: 150,
        type_month_from: 1,
        type_year_from: 2005,
        type_month_to: 12,
        type_year_to: 2012,
        type_fuel: "Diesel",
        type_liter: "2.0",
        modele_id: 1,
        modele_alias: "serie-3",
        modele_name: "Série 3",
        modele_name_meta: "Série 3",
        modele_pic: `${brand}-serie-3.jpg`,
        marque_id: brandData.marque_id,
        marque_alias: brandData.marque_alias,
        marque_name: brandData.marque_name,
        marque_name_meta: brandData.marque_name_meta,
        marque_name_meta_title: brandData.marque_name_meta_title
      }
    ];

    return json<LoaderData>({
      brand: brandData,
      seo: seoData,
      popularVehicles: popularVehicles,
      popularParts: [],
      blogContent: {
        h1: seoData.h1 || "",
        title: seoData.title || "",
        content: seoData.descrip || ""
      }
    });
    
  } catch (error) {
    console.error('Erreur loader marque:', error);
    throw new Response("Erreur de chargement", { status: 500 });
  }
}

// 🏷️ Métadonnées SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Marque non trouvée" },
      { name: "description", content: "La marque demandée n'a pas été trouvée." }
    ];
  }

  const { seo } = data;

  return [
    { title: seo.title },
    { name: "description", content: seo.descrip },
    { name: "keywords", content: seo.keywords },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.descrip },
    { property: "og:type", content: "website" },
    { name: "robots", content: "index,follow" },
    { link: { rel: "canonical", href: seo.canonical } }
  ];
};

// 🎨 Composant principal
export default function BrandPage() {
  const data = useLoaderData<typeof loader>();

  // 📊 Analytics et suivi de performance
  useEffect(() => {
    const { brand } = data;
    
    // Analytics page view
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: `${brand.marque_name} - Constructeur`,
        page_location: window.location.pathname,
        brand_name: brand.marque_name,
        brand_id: brand.marque_id,
        event_category: 'brand_page'
      });
    }

    // Configuration lazy loading pour les images
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));

    return () => {
      lazyImages.forEach(img => imageObserver.unobserve(img));
    };
  }, [data]);

  const { brand, popularVehicles } = data;

  return (
    <div className="min-h-screen">
      
      {/* 🎯 Banner Section - reproduit containerBanner */}
      <div className="container-fluid containerBanner bg-gradient-to-r from-blue-50 to-blue-100 py-8">
        <div className="container-fluid mymaxwidth max-w-7xl mx-auto px-4">
          <div className="row flex flex-col-reverse md:flex-row gap-8">
            
            {/* Section titre et fil d'Ariane */}
            <div className="col-12 col-sm flex-1 align-self-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                Pièces auto {brand.marque_name}
              </h1>
              
              {/* Fil d'Ariane - reproduit containerariane */}
              <div className="containerariane mb-4">
                <ol className="breadcrumb flex items-center space-x-2 text-sm text-gray-600">
                  <li>
                    <Link to="/" className="hover:text-blue-600">Automecanik</Link>
                  </li>
                  <li className="before:content-['>'] before:mx-2">
                    <span>{brand.marque_name}</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Section sélecteur véhicule - utilise VehicleSelectorV2 fonctionnel */}
            <div className="col-12 col-sm containerSeekCarBox md:w-80">
              <VehicleSelectorV2 
                mode="full"
                variant="card"
                context="detail"
                currentVehicle={{
                  brand: { id: brand.marque_id, name: brand.marque_name }
                }}
                className="max-w-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 📦 Section Catalogue - reproduit containergrayPage */}
      <div className="container-fluid containergrayPage bg-gray-100 py-12">
        <div className="container-fluid mymaxwidth max-w-7xl mx-auto px-4">
          <div className="row">
            <div className="col-12 text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                CATALOGUE PIÈCES AUTO {brand.marque_name.toUpperCase()} LES PLUS VENDUS
              </h2>
              <div className="divh2 w-16 h-1 bg-blue-600 mx-auto"></div>
            </div>
            
            <div className="col-12">
              {/* 🎠 MultiCarousel reproduisant exactement la structure originale */}
              {popularVehicles.length > 0 ? (
                <div className="MultiCarousel" data-items="1,2,3,4" data-slide="1" id="McCgcGamme" data-interval="1000">
                  <MultiCarousel 
                    id="popular-vehicles" 
                    itemsConfig="1,2,3,4"
                    autoPlay={true}
                    autoPlayInterval={4000}
                    className="mb-8"
                  >
                    {popularVehicles.map((vehicle, index) => (
                      <div key={index} className="item">
                        <div className="pad15 p-4">
                          <VehicleCard 
                            vehicle={vehicle}
                            className="multicarouselwhiteBloc bg-white rounded-lg shadow-md p-6 h-full"
                          />
                        </div>
                      </div>
                    ))}
                  </MultiCarousel>
                </div>
              ) : (
                /* Fallback avec véhicules d'exemple si pas de données */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      type_name: "320 d",
                      type_power_ps: 150,
                      type_fuel: "Diesel",
                      type_year_from: 2005,
                      type_year_to: 2012,
                      modele_name: "Série 3",
                      modele_alias: "serie-3",
                      modele_pic: `${brand.marque_alias}-serie-3.jpg`
                    },
                    {
                      type_name: "118 d",
                      type_power_ps: 143,
                      type_fuel: "Diesel", 
                      type_year_from: 2011,
                      type_year_to: 2019,
                      modele_name: "Série 1",
                      modele_alias: "serie-1",
                      modele_pic: `${brand.marque_alias}-serie-1.jpg`
                    },
                    {
                      type_name: "520 d",
                      type_power_ps: 190,
                      type_fuel: "Diesel",
                      type_year_from: 2010,
                      type_year_to: 2017,
                      modele_name: "Série 5",
                      modele_alias: "serie-5", 
                      modele_pic: `${brand.marque_alias}-serie-5.jpg`
                    },
                    {
                      type_name: "X3 20 d",
                      type_power_ps: 184,
                      type_fuel: "Diesel",
                      type_year_from: 2010,
                      type_year_to: 2017,
                      modele_name: "X3",
                      modele_alias: "x3",
                      modele_pic: `${brand.marque_alias}-x3.jpg`
                    }
                  ].map((vehicle, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                      <div className="text-center">
                        <img 
                          src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/modeles/${vehicle.modele_pic}`}
                          alt={`${brand.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`}
                          className="w-full h-32 object-cover rounded-lg mb-4"
                          loading="lazy"
                        />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {brand.marque_name} {vehicle.modele_name} {vehicle.type_name}
                        </h3>
                        <div className="text-sm text-gray-600 mb-3">
                          <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                            {vehicle.type_fuel}
                          </span>
                          <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded mr-2">
                            {vehicle.type_power_ps} ch
                          </span>
                          <span className="inline-block bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {vehicle.type_year_from}-{vehicle.type_year_to}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-4">
                          Achetez pièces détachées {brand.marque_name} {vehicle.modele_name} {vehicle.type_name} {vehicle.type_power_ps} ch de {vehicle.type_year_from} à {vehicle.type_year_to}, d'origine à prix bas.
                        </p>
                        <Link
                          to={`/constructeurs/${brand.marque_alias}/${vehicle.modele_alias}/${vehicle.type_name.toLowerCase().replace(/\s+/g, '-')}`}
                          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                          Voir les pièces
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📋 Section Description - reproduit containerwhitePage */}
      <div className="container-fluid containerwhitePage bg-white py-12">
        <div className="container-fluid mymaxwidth max-w-7xl mx-auto px-4">
          <div className="row flex flex-col sm:flex-row items-center gap-6">
            <div className="col-sm-3 col-md-2 col-lg-1 text-center text-sm-left align-self-center flex-shrink-0">
              <Link 
                to={`/blog-pieces-auto/auto/${brand.marque_alias}`}
                target="_blank"
                className="blog-z-read-more inline-block"
              >
                <img 
                  data-src={`/upload/constructeurs-automobiles/icon/${brand.marque_logo}`}
                  src="/upload/loading-min.gif"
                  alt={brand.marque_name}
                  width="70" 
                  height="70"
                  className="lazy w-16 h-16 object-contain mx-auto sm:mx-0"
                />
              </Link>
            </div>
            
            <div className="col-sm-9 col-md-10 col-lg-11 align-self-center flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Choisissez votre véhicule {brand.marque_name}
              </h2>
              <div className="divh2 w-16 h-1 bg-blue-600 mb-4"></div>
              
              <p className="text-gray-600 leading-relaxed">
                <strong>{brand.marque_name}</strong>&nbsp;est un constructeur automobile 
                {brand.marque_country ? ` ${brand.marque_country.toLowerCase()}` : ''} 
                reconnu pour la qualité et la performance de ses véhicules. 
                <strong>{brand.marque_name}</strong>&nbsp;propose aux automobilistes une gamme 
                très variée et prestigieuse de véhicules. 
                Découvrez notre large sélection de pièces détachées 
                <strong> {brand.marque_name}</strong> à prix compétitifs pour maintenir 
                votre véhicule en parfait état de fonctionnement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}