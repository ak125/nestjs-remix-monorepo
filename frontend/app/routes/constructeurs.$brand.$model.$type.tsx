// 📁 frontend/app/routes/constructeurs.$brand.$model.$type.tsx
// 🚗 Page de détail du véhicule - Version modernisée avec VehicleSelector Enterprise

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { ArrowLeft, Car, Calendar, Fuel, Settings, Wrench, ShoppingCart } from "lucide-react";
import { useEffect } from "react";
import { VehicleSelector } from "../components/vehicle/VehicleSelector";

// 📊 Types de données
interface VehicleDetail {
  brand: {
    marque_id: number;
    marque_name: string;
    marque_logo?: string;
  };
  model: {
    modele_id: number;
    modele_name: string;
    year_from?: number;
    year_to?: number;
  };
  type: {
    type_id: number;
    type_name: string;
    type_fuel?: string;
    type_power?: string;
    type_engine?: string;
    year_from?: number;
    year_to?: number;
  };
}

// 🔄 Extraction des IDs depuis les paramètres URL
const extractIdsFromParams = (brand: string, model: string, type: string) => {
  // Format: bmw-33 → ID: 33
  const brandId = parseInt(brand.split('-').pop() || '0');
  // Format: serie-3-e90-33028 → ID: 33028  
  const modelId = parseInt(model.split('-').pop() || '0');
  // Format: 325-i-117778 → ID: 117778
  const typeId = parseInt(type.replace('.html', '').split('-').pop() || '0');
  
  return { brandId, modelId, typeId };
};

// 📡 Loader pour récupérer les données du véhicule
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { brand, model, type } = params;
  
  if (!brand || !model || !type) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  try {
    const { brandId, modelId, typeId } = extractIdsFromParams(brand, model, type);
    console.log('🔍 IDs extraits:', { brandId, modelId, typeId });
    
    // 🔍 Récupération des données depuis l'API backend directement
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    console.log('🌐 Base URL:', baseUrl);
    
    // 📅 D'abord récupérer les types pour obtenir l'année de référence
    const typesResponse = await fetch(`${baseUrl}/api/vehicles/models/${modelId}/types`).then(r => {
      console.log('📊 Types API status:', r.status);
      return r;
    });

    if (!typesResponse.ok) {
      console.error('❌ Erreur API types:', typesResponse.status);
      throw new Response("Erreur API", { status: 500 });
    }

    const typesResult = await typesResponse.json();
    const typesData = typesResult.data || typesResult;
    const selectedType = typesData.find(t => parseInt(t.type_id) === typeId);
    
    if (!selectedType) {
      throw new Response("Type de véhicule non trouvé", { status: 404 });
    }

    // 📅 Utiliser l'année de début du type pour filtrer les modèles
    const referenceYear = parseInt(selectedType.type_year_from) || 2011;
    console.log('📅 Année de référence pour les modèles:', referenceYear);
    
    const [brandsResponse, modelsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/vehicles/brands`).then(r => {
        console.log('📊 Brands API status:', r.status);
        return r;
      }),
      fetch(`${baseUrl}/api/vehicles/brands/${brandId}/models?year=${referenceYear}`).then(r => {
        console.log('📊 Models API status:', r.status);
        return r;
      })
    ]);

    if (!brandsResponse.ok || !modelsResponse.ok) {
      console.error('❌ Erreur API:', {
        brands: brandsResponse.status,
        models: modelsResponse.status,
      });
      throw new Response("Erreur API", { status: 500 });
    }

    const [brandsResult, modelsResult] = await Promise.all([
      brandsResponse.json(),
      modelsResponse.json()
    ]);

    const brandsData = brandsResult.data || brandsResult;
    const modelsData = modelsResult.data || modelsResult;

    const vehicleBrand = brandsData.find(b => parseInt(b.marque_id) === brandId);
    const vehicleModel = modelsData.find(m => parseInt(m.modele_id) === modelId);
    const vehicleType = selectedType; // Déjà récupéré plus haut

    console.log('🔍 Recherche données:', {
      brandId,
      modelId, 
      typeId,
      brandFound: !!vehicleBrand,
      modelFound: !!vehicleModel,
      typeFound: !!vehicleType,
      brandData: vehicleBrand,
      modelData: vehicleModel,
      typeData: vehicleType
    });

    if (!vehicleBrand || !vehicleModel || !vehicleType) {
      console.error('❌ Données manquantes:', {
        vehicleBrand: !!vehicleBrand,
        vehicleModel: !!vehicleModel,
        vehicleType: !!vehicleType
      });
      throw new Response("Véhicule non trouvé", { status: 404 });
    }

    const vehicleDetail: VehicleDetail = {
      brand: vehicleBrand,
      model: vehicleModel,
      type: vehicleType
    };

    return json({ 
      vehicle: vehicleDetail,
      breadcrumb: {
        brand: brand,
        model: model,
        type: type.replace('.html', '')
      }
    });

  } catch (error) {
    console.error('Erreur loader véhicule:', error);
    console.error('Paramètres reçus:', { brand, model, type });
    
    // Si c'est une erreur de fetch, retournons une page d'erreur plus conviviale
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return json({ 
        error: 'Service temporairement indisponible',
        params: { brand, model, type }
      }, { status: 503 });
    }
    
    throw new Response("Erreur de chargement", { status: 500 });
  }
};

// 🏷️ Métadonnées SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || 'error' in data) {
    return [
      { title: "Véhicule non trouvé" },
      { name: "description", content: "Le véhicule demandé n'a pas été trouvé." }
    ];
  }

  const { brand, model, type } = data.vehicle;
  const title = `${brand.marque_name} ${model.modele_name} ${type.type_name} - Pièces auto`;
  const description = `Trouvez toutes les pièces détachées pour votre ${brand.marque_name} ${model.modele_name} ${type.type_name}. Catalogue complet de pièces automobiles.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" }
  ];
};

// 🎨 Composant principal
export default function VehicleDetailPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // 📊 Analytics et suivi de performance (seulement si pas d'erreur)
  useEffect(() => {
    if ('error' in data) return; // Sortie précoce si erreur

    const { vehicle } = data;
    
    // Analytics page view
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: `${vehicle.brand.marque_name} ${vehicle.model.modele_name} ${vehicle.type.type_name}`,
        page_location: window.location.pathname,
        vehicle_brand: vehicle.brand.marque_name,
        vehicle_model: vehicle.model.modele_name,
        vehicle_type: vehicle.type.type_name,
        event_category: 'vehicle_detail'
      });
      
      // Performance tracking
      if (window.performance) {
        const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        window.gtag('event', 'timing_complete', {
          name: 'vehicle_page_load',
          value: loadTime,
          event_category: 'performance'
        });
      }
    }

    // SEO et meta données dynamiques
    const updateMetaTags = () => {
      // Open Graph dynamique
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', `${vehicle.brand.marque_name} ${vehicle.model.modele_name} ${vehicle.type.type_name} - Pièces auto`);
      }

      // Schema.org pour véhicule
      const vehicleSchema = {
        "@context": "https://schema.org",
        "@type": "Vehicle",
        "brand": vehicle.brand.marque_name,
        "model": vehicle.model.modele_name,
        "name": `${vehicle.brand.marque_name} ${vehicle.model.modele_name} ${vehicle.type.type_name}`,
        "fuelType": vehicle.type.type_fuel,
        "vehicleEngine": vehicle.type.type_engine
      };

      // Injecter le schema JSON-LD
      let existingSchema = document.querySelector('#vehicle-schema');
      if (!existingSchema) {
        const script = document.createElement('script');
        script.id = 'vehicle-schema';
        script.type = 'application/ld+json';
        script.text = JSON.stringify(vehicleSchema);
        document.head.appendChild(script);
      }
    };

    updateMetaTags();
  }, [data]);

  // 🎯 Préchargement des ressources critiques
  useEffect(() => {
    if ('error' in data) return; // Sortie précoce si erreur

    const { vehicle, breadcrumb } = data;
    
    // Précharger les liens de navigation populaires
    const preloadLinks = [
      `/pieces/${breadcrumb.brand}/${breadcrumb.model}/${breadcrumb.type}`,
      `/catalogue?brand=${vehicle.brand.marque_id}&model=${vehicle.model.modele_id}&type=${vehicle.type.type_id}`
    ];

    preloadLinks.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    });
  }, [data]);

  // Guard clause pour erreur
  if ('error' in data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Erreur</h1>
          <p className="text-gray-600">{data.error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const { vehicle, breadcrumb } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 🍞 Fil d'Ariane amélioré */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm" aria-label="Fil d'Ariane">
            <Link 
              to="/" 
              className="text-gray-600 hover:text-blue-600 transition-colors duration-200 flex items-center"
            >
              🏠 Accueil
            </Link>
            <span className="text-gray-400">/</span>
            <Link 
              to="/constructeurs" 
              className="text-gray-600 hover:text-blue-600 transition-colors duration-200"
            >
              Constructeurs
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-blue-600 font-semibold">
              {vehicle.brand.marque_name}
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-blue-600 font-semibold">
              {vehicle.model.modele_name}
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 font-semibold bg-blue-50 px-2 py-1 rounded">
              {vehicle.type.type_name}
            </span>
          </nav>
        </div>
      </div>

      {/* 🎯 En-tête véhicule modernisé */}
      <div className="bg-white shadow-lg border-b-2 border-blue-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 flex-1">
              {/* 🏭 Logo marque avec design moderne */}
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-inner flex items-center justify-center ring-2 ring-white">
                {vehicle.brand.marque_logo ? (
                  <img 
                    src={vehicle.brand.marque_logo} 
                    alt={`Logo ${vehicle.brand.marque_name}`}
                    className="w-14 h-14 object-contain filter drop-shadow-sm"
                  />
                ) : (
                  <Car className="w-10 h-10 text-gray-500" />
                )}
              </div>
              
              {/* 📝 Informations véhicule avec hiérarchie claire */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                    {vehicle.brand.marque_name}
                  </h1>
                  <span className="text-2xl lg:text-3xl text-gray-600 font-light">
                    {vehicle.model.modele_name}
                  </span>
                </div>
                <h2 className="text-xl lg:text-2xl text-blue-600 font-semibold mb-4">
                  {vehicle.type.type_name}
                </h2>
                
                {/* 🏷️ Badges avec design moderne */}
                <div className="flex flex-wrap items-center gap-3"
                     role="list" 
                     aria-label="Caractéristiques du véhicule">
                  {vehicle.type.type_fuel && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-shadow duration-200"
                          role="listitem">
                      <Fuel className="w-4 h-4 mr-2" />
                      {vehicle.type.type_fuel}
                    </span>
                  )}
                  {vehicle.type.type_power && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:shadow-lg transition-shadow duration-200"
                          role="listitem">
                      <Settings className="w-4 h-4 mr-2" />
                      {vehicle.type.type_power}
                    </span>
                  )}
                  {(vehicle.type.year_from || vehicle.model.year_from) && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md hover:shadow-lg transition-shadow duration-200"
                          role="listitem">
                      <Calendar className="w-4 h-4 mr-2" />
                      {vehicle.type.year_from || vehicle.model.year_from}
                      {(vehicle.type.year_to || vehicle.model.year_to) && 
                        ` - ${vehicle.type.year_to || vehicle.model.year_to}`
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* 🔙 Bouton retour avec design moderne */}
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
              aria-label="Retour à la page précédente"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour
            </button>
          </div>
        </div>
      </div>

      {/* 📋 Contenu principal modernisé */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 📊 Informations détaillées avec design moderne */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center mb-6">
                <Settings className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="text-2xl font-bold text-gray-900">
                  Caractéristiques techniques
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 text-lg flex items-center">
                    <Car className="w-5 h-5 mr-2 text-blue-600" />
                    Véhicule
                  </h4>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-gray-600 font-medium">Marque:</dt>
                      <dd className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                        {vehicle.brand.marque_name}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-gray-600 font-medium">Modèle:</dt>
                      <dd className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                        {vehicle.model.modele_name}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-gray-600 font-medium">Version:</dt>
                      <dd className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg shadow-sm">
                        {vehicle.type.type_name}
                      </dd>
                    </div>
                  </div>
                </div>
                
                {(vehicle.type.type_engine || vehicle.type.type_fuel || vehicle.type.type_power) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 text-lg flex items-center">
                      <Fuel className="w-5 h-5 mr-2 text-green-600" />
                      Motorisation
                    </h4>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      {vehicle.type.type_fuel && (
                        <div className="flex justify-between items-center py-2">
                          <dt className="text-gray-600 font-medium">Carburant:</dt>
                          <dd className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                            {vehicle.type.type_fuel}
                          </dd>
                        </div>
                      )}
                      {vehicle.type.type_power && (
                        <div className="flex justify-between items-center py-2">
                          <dt className="text-gray-600 font-medium">Puissance:</dt>
                          <dd className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                            {vehicle.type.type_power}
                          </dd>
                        </div>
                      )}
                      {vehicle.type.type_engine && (
                        <div className="flex justify-between items-center py-2">
                          <dt className="text-gray-600 font-medium">Moteur:</dt>
                          <dd className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                            {vehicle.type.type_engine}
                          </dd>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 🛠️ Section pièces populaires modernisée */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center mb-6">
                <Wrench className="w-6 h-6 text-orange-600 mr-3" />
                <h3 className="text-2xl font-bold text-gray-900">
                  Pièces les plus recherchées
                </h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { name: "Filtres", icon: "🔧", color: "blue", slug: "filtres" },
                  { name: "Freinage", icon: "🛞", color: "red", slug: "freinage" },
                  { name: "Échappement", icon: "💨", color: "gray", slug: "échappement" },
                  { name: "Suspension", icon: "🏗️", color: "yellow", slug: "suspension" },
                  { name: "Éclairage", icon: "💡", color: "amber", slug: "éclairage" },
                  { name: "Carrosserie", icon: "🚗", color: "green", slug: "carrosserie" }
                ].map((category) => (
                  <Link
                    key={category.name}
                    to={`/pieces/${breadcrumb.brand}/${breadcrumb.model}/${breadcrumb.type}/${category.slug}`}
                    className={`group p-6 border-2 border-gray-200 rounded-2xl hover:border-${category.color}-300 hover:bg-${category.color}-50 transition-all duration-300 hover:scale-105 hover:shadow-lg`}
                    aria-label={`Voir les pièces ${category.name} pour ${vehicle.brand.marque_name} ${vehicle.model.modele_name} ${vehicle.type.type_name}`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
                        {category.icon}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-gray-800">
                        {category.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Voir le catalogue
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* 📱 Sidebar actions modernisée */}
          <div className="lg:col-span-1 space-y-6">
            {/* Actions rapides avec design moderne */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300 sticky top-4">
              <div className="flex items-center mb-6">
                <Wrench className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900">
                  Actions rapides
                </h3>
              </div>
              
              <div className="space-y-4">
                <Link
                  to={`/enhanced-vehicle-catalog/${breadcrumb.brand}/${breadcrumb.model}/${breadcrumb.type}`}
                  className="w-full group inline-flex items-center justify-center px-6 py-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  aria-label="Voir le catalogue complet de pièces pour ce véhicule"
                >
                  <Wrench className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform duration-200" />
                  Catalogue complet
                </Link>
                
                <Link
                  to={`/pieces/${breadcrumb.brand}/${breadcrumb.model}/${breadcrumb.type}/filtres`}
                  className="w-full group inline-flex items-center justify-center px-6 py-4 border-2 border-gray-300 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                  aria-label="Voir les pièces de maintenance courante"
                >
                  <ShoppingCart className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-200" />
                  Pièces courantes
                </Link>
              </div>
            </div>

            {/* 🚗 Sélecteur de véhicule moderne avec design amélioré */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 sticky top-4">
              <div className="flex items-center mb-6">
                <Car className="w-6 h-6 text-green-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900">
                  Changer de véhicule
                </h3>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-center text-blue-800 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="font-medium">Véhicule actuel sélectionné</span>
                </div>
                <div className="mt-2 text-xs text-blue-700">
                  <strong>{vehicle.brand.marque_name}</strong> → 
                  <strong> {vehicle.model.modele_name}</strong> → 
                  <strong> {vehicle.type.type_name}</strong>
                </div>
              </div>
              
              <VehicleSelector 
                currentVehicle={{
                  brand: {
                    id: vehicle.brand.marque_id,
                    name: vehicle.brand.marque_name,
                    slug: vehicle.brand.marque_name.toLowerCase().replace(/\s+/g, '-')
                  },
                  model: {
                    id: vehicle.model.modele_id,
                    name: vehicle.model.modele_name,
                    slug: vehicle.model.modele_name.toLowerCase().replace(/\s+/g, '-')
                  },
                  type: {
                    id: vehicle.type.type_id,
                    name: vehicle.type.type_name,
                    slug: vehicle.type.type_name.toLowerCase().replace(/\s+/g, '-')
                  }
                }}
                onSelectionChange={(selection) => {
                  if (selection.brandId && selection.modelId && selection.typeData) {
                    // Analytics pour tracking changement de véhicule
                    if (typeof window !== 'undefined' && window.gtag) {
                      window.gtag('event', 'vehicle_change', {
                        from_vehicle: `${vehicle.brand.marque_name} ${vehicle.model.modele_name} ${vehicle.type.type_name}`,
                        to_vehicle: `Brand ${selection.brandId} Model ${selection.modelId}`,
                        event_category: 'vehicle_selector',
                        event_label: 'detail_page',
                        page_location: window.location.pathname
                      });
                    }
                    
                    // Animation de feedback pour l'utilisateur
                    const selectorElement = document.querySelector('[data-vehicle-selector]');
                    if (selectorElement) {
                      selectorElement.classList.add('animate-pulse');
                      setTimeout(() => {
                        selectorElement.classList.remove('animate-pulse');
                      }, 1000);
                    }
                    
                    // Navigation vers le nouveau véhicule (format simplifié pour l'instant)
                    console.log('🚗 Navigation vers nouveau véhicule:', selection);
                    // TODO: Implémenter la navigation avec les nouvelles données
                  }
                }}
                compact={true}
                className="w-full"
              />
              
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center text-green-800 text-xs">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                  <span>Sélection automatique • Navigation intelligente</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}