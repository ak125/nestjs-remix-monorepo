// 🎨 VERSION AMÉLIORÉE — PAGE CATALOGUE CONSTRUCTEUR
// Format: /constructeurs/{constructeur}-{id}.html
// Exemple: /constructeurs/bmw-33.html, /constructeurs/renault-140.html

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Car, Filter, Disc, Wrench, Droplet, Zap, Settings, ChevronRight, TrendingUp, Package } from "lucide-react";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";
import { brandApi } from "../services/api/brand.api";
import { brandColorsService } from "../services/brand-colors.service";
import type { PopularVehicle, PopularPart as ApiPopularPart } from "../types/brand.types";

// ==========================================
// 🛠️ INTERFACES
// ==========================================

interface PopularPart {
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
// 📄 META
// ==========================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.seo) {
    return [{ title: "Pièces Auto" }];
  }
  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "robots", content: data.seo.robots },
    { property: "og:title", content: data.seo.og_title },
    { property: "og:description", content: data.seo.og_description },
    { tagName: "link", rel: "canonical", href: data.seo.canonical }
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

    return json(bestsellersResponse.data);

  } catch (error) {
    console.error('Erreur récupération bestsellers:', error);
    throw new Response("Error loading brand page", { status: 500 });
  }
}

// ==========================================
// 🎨 COMPONENT
// ==========================================

export default function BrandCatalogPage() {
  const { brand, popular_parts, popular_vehicles, blog_content } = useLoaderData<typeof loader>();

  // Adapter les noms pour le code existant
  const manufacturer = brand;
  const apiParts = popular_parts;
  const apiVehicles = popular_vehicles;
  
  // Reconstruction de la description à partir des données disponibles ou fallback
  const brandDescription: BrandDescription = {
    history: blog_content?.content ? blog_content.content.replace(/<[^>]*>?/gm, '').substring(0, 300) + '...' : `Constructeur automobile proposant une large gamme de véhicules alliant performance et innovation.`,
    strengths: ['Qualité reconnue', 'Technologies modernes', 'Large réseau'],
    models: [], // On pourrait extraire ça des véhicules populaires si besoin
  };

  // 🎨 Récupérer la couleur thématique du constructeur
  const brandColor = brandColorsService.getBrandGradient(manufacturer.marque_alias);
  const brandPrimary = brandColorsService.getBrandPrimaryColor(manufacturer.marque_alias);

  // 🖼️ Mapping pour les logos qui ont un nom différent de l'alias DB
  const getLogoAlias = (dbAlias: string): string => {
    const logoMapping: Record<string, string> = {
      'mercedes-benz': 'mercedes',
      'alfa-romeo': 'alfa-romeo',
      // Ajouter d'autres mappings si nécessaire
    };
    return logoMapping[dbAlias] || dbAlias;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🧭 Fil d'Ariane */}
      <nav className="bg-white border-b border-gray-200 py-3" aria-label="Breadcrumb">
        <div className="container mx-auto px-4">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link to="/" className="text-blue-600 hover:underline">Accueil</Link>
            </li>
            <li><ChevronRight className="w-4 h-4 text-gray-400" /></li>
            <li>
              <Link to="/#toutes-les-marques" className="text-blue-600 hover:underline">Constructeurs</Link>
            </li>
            <li><ChevronRight className="w-4 h-4 text-gray-400" /></li>
            <li className="font-semibold text-gray-900">{manufacturer.marque_name}</li>
          </ol>
        </div>
      </nav>

      {/* 🏎️ Hero Section - Couleur thématique du constructeur */}
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
          
          {/* Titre H1 dynamique optimisé SEO */}
          <div className="text-center mb-6 md:mb-8 animate-in fade-in duration-700 delay-100">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-2xl">
                Catalogue pièces auto {manufacturer.marque_name}
              </span>
            </h1>
            <p className="text-white/90 text-base md:text-lg mt-3 drop-shadow-lg">
              Trouvez rapidement les pièces adaptées : entretien, freinage, suspension, moteur…
            </p>
          </div>
          
          {/* Cadre glassmorphism contenant Logo + VehicleSelector */}
          <div className="max-w-5xl mx-auto mb-8 md:mb-10 animate-in fade-in duration-1000 delay-200">
            <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] backdrop-blur-xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-6 md:p-8 border border-white/30 hover:border-white/50 transition-all duration-500">
              {/* Sous-titre dynamique en haut du cadre */}
              <div className="text-center mb-6">
                <p className="text-white/95 text-base md:text-lg font-semibold drop-shadow-lg">
                  Sélectionnez votre véhicule {manufacturer.marque_name} pour voir les pièces compatibles
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
                          src={manufacturer.marque_logo || `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${getLogoAlias(manufacturer.marque_alias)}.webp`}
                          alt={`Logo ${manufacturer.marque_name}`}
                          className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-all duration-700"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.src = '/images/default-brand.png';
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
                  <VehicleSelectorV2 
                    mode="full"
                    variant="card"
                    context="pieces"
                    currentVehicle={{
                      brand: { id: manufacturer.marque_id, name: manufacturer.marque_name }
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
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">50 000+ pièces</span>
            </div>
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Settings className="w-4 h-4 text-blue-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">Livraison 24-48h</span>
            </div>
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Wrench className="w-4 h-4 text-purple-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">Paiement sécurisé</span>
            </div>
            <div className="group flex items-center gap-2 px-3 md:px-4 py-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Zap className="w-4 h-4 text-orange-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white text-sm md:text-base font-semibold whitespace-nowrap">Experts gratuits</span>
            </div>
          </div>
          
        </div>
      </section>

      {/* 📦 Pièces populaires depuis l'API */}
      {apiParts.length > 0 && (
        <div className="bg-gradient-to-b from-gray-50 to-white py-16 border-b border-gray-100">
          <div className="container mx-auto px-4">
            {/* En-tête avec gradient de marque */}
            <div className="relative mb-12">
              <div className="relative rounded-2xl p-8 shadow-xl overflow-hidden" style={brandColor}>
                {/* Effet shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]"></div>
                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
                      <Package className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-1">
                        Pièces {manufacturer.marque_name} populaires
                      </h2>
                      <p className="text-white/80 text-sm">Les pièces les plus recherchées par nos clients</p>
                    </div>
                  </div>
                  
                  {/* Badge avec backdrop-blur */}
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                    <span className="text-white font-bold text-lg">{apiParts.length}</span>
                    <span className="text-white/80 text-sm ml-2">pièces</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {apiParts.map((part) => (
                <ApiPartCard key={part.pg_id} part={part} brandAlias={manufacturer.marque_alias} brandPrimary={brandPrimary} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🚗 Véhicules les plus recherchés */}
      {apiVehicles.length > 0 && (
        <div className="bg-gradient-to-b from-white to-gray-50 py-16 border-b border-gray-100">
          <div className="container mx-auto px-4">
            {/* En-tête avec gradient de marque atténué */}
            <div className="relative mb-12">
              <div className="relative rounded-2xl p-8 shadow-xl overflow-hidden" style={{
                backgroundImage: brandColor.backgroundImage.replace('to bottom right', 'to bottom right').replace(/\)/g, ', rgba(0,0,0,0.15))')
              }}>
                {/* Effet shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]"></div>
                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-1">
                        Véhicules {manufacturer.marque_name} les plus recherchés
                      </h2>
                      <p className="text-white/80 text-sm">Découvrez les modèles préférés de nos clients</p>
                    </div>
                  </div>
                  
                  {/* Badge avec backdrop-blur */}
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                    <span className="text-white font-bold text-lg">{apiVehicles.length}</span>
                    <span className="text-white/80 text-sm ml-2">véhicules</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.type_id} vehicle={vehicle} brandPrimary={brandPrimary} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 📘 Présentation Constructeur */}
      <div className="bg-white py-12 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            À propos de {manufacturer.marque_name}
          </h2>
          <div className="prose max-w-none">
            {blog_content?.content ? (
              <div dangerouslySetInnerHTML={{ __html: blog_content.content }} />
            ) : (
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {brandDescription.history}
              </p>
            )}
            
            {brandDescription.strengths.length > 0 && (
              <div className="mb-6 mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Points forts</h3>
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
    </div>
  );
}

// 🚗 Composant Carte de véhicule API
function VehicleCard({ vehicle, brandPrimary }: { vehicle: PopularVehicle; brandPrimary: string }) {
  const yearRange = vehicle.type_year_to 
    ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
    : `depuis ${vehicle.type_year_from}`;

  return (
    <Link
      to={vehicle.vehicle_url || '#'}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden group border border-gray-200"
    >
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        <img 
          src={vehicle.image_url || '/images/default-vehicle.png'}
          alt={`${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = '/images/default-vehicle.png';
          }}
        />
        <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white" style={{ backgroundColor: brandPrimary }}>
          {vehicle.type_power_ps} ch
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
          {vehicle.modele_name}
        </h3>
        <p className="font-semibold text-base mb-2" style={{ color: brandPrimary }}>
          {vehicle.type_name}
        </p>
        
        <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            {vehicle.type_power_ps} ch
          </span>
          <span>{yearRange}</span>
        </div>
        
        <div className="pt-3 border-t border-gray-200">
          <span className="text-sm font-medium group-hover:underline" style={{ color: brandPrimary }}>
            Voir les pièces →
          </span>
        </div>
      </div>
    </Link>
  );
}

// 📦 Composant Carte de pièce API - Style moderne inspiré de MotorisationsSection
function ApiPartCard({ part, brandAlias, brandPrimary }: { part: ApiPopularPart; brandAlias: string; brandPrimary: string }) {
  return (
    <Link
      to={part.part_url || '#'}
      className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Bordure gradient au hover - couleur de marque */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-xl" style={{
        background: `linear-gradient(135deg, ${brandPrimary}, ${brandPrimary}dd, ${brandPrimary}aa)`
      }}></div>
      <div className="absolute inset-0 bg-white m-0.5 rounded-lg group-hover:m-[3px] transition-all duration-300"></div>
      
      {/* Contenu */}
      <div className="relative p-4">
        <div className="flex items-center justify-center h-24 mb-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden relative">
          {/* Effet glow sur l'image - couleur de marque */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-10 blur-xl transition-all duration-300" style={{
            background: `linear-gradient(135deg, ${brandPrimary}, ${brandPrimary}dd, ${brandPrimary}aa)`
          }}></div>
          <img 
            src={part.image_url || '/images/default-part.png'}
            alt={part.pg_name}
            className="relative h-full w-auto object-contain group-hover:scale-110 transition-transform duration-300 z-10"
            onError={(e) => {
              e.currentTarget.src = '/images/default-part.png';
            }}
          />
        </div>
        
        <h4 className="font-semibold text-sm text-gray-900 mb-1 group-hover:text-gray-700 transition-colors line-clamp-2">
          {part.pg_name}
        </h4>
        
        {/* 🎯 Description SEO dynamique depuis __seo_gamme_car_switch */}
        {part.seo_switch_content ? (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed">
            {part.seo_switch_content}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-2 line-clamp-1">
            {part.modele_name} • {part.type_name}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-medium group-hover:underline" style={{ color: brandPrimary }}>
            Voir →
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-all" style={{ color: `${brandPrimary}80` }} />
        </div>
      </div>
    </Link>
  );
}
