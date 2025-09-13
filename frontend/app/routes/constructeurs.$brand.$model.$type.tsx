// 📁 frontend/app/routes/constructeurs.$brand.$model.$type.tsx
// 🚗 Page de détail du véhicule - Équivalent à automecanik.com

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { ArrowLeft, Car, Calendar, Fuel, Settings, Wrench, ShoppingCart } from "lucide-react";

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
  if (!data?.vehicle) {
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
  const { vehicle, breadcrumb } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🍞 Fil d'Ariane */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link to="/" className="hover:text-blue-600">
              Accueil
            </Link>
            <span>/</span>
            <Link to="/constructeurs" className="hover:text-blue-600">
              Constructeurs
            </Link>
            <span>/</span>
            <span className="text-blue-600 font-medium">
              {vehicle.brand.marque_name}
            </span>
            <span>/</span>
            <span className="text-blue-600 font-medium">
              {vehicle.model.modele_name}
            </span>
            <span>/</span>
            <span className="text-gray-900 font-medium">
              {vehicle.type.type_name}
            </span>
          </nav>
        </div>
      </div>

      {/* 🎯 En-tête véhicule */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              {/* 🏭 Logo marque */}
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                {vehicle.brand.marque_logo ? (
                  <img 
                    src={vehicle.brand.marque_logo} 
                    alt={vehicle.brand.marque_name}
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <Car className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {/* 📝 Informations véhicule */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {vehicle.brand.marque_name} {vehicle.model.modele_name}
                </h1>
                <h2 className="text-xl text-gray-600 mt-1">
                  {vehicle.type.type_name}
                </h2>
                
                {/* 🏷️ Badges */}
                <div className="flex items-center space-x-4 mt-4">
                  {vehicle.type.type_fuel && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                      <Fuel className="w-4 h-4 mr-1" />
                      {vehicle.type.type_fuel}
                    </span>
                  )}
                  {vehicle.type.type_power && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                      <Settings className="w-4 h-4 mr-1" />
                      {vehicle.type.type_power}
                    </span>
                  )}
                  {(vehicle.type.year_from || vehicle.model.year_from) && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                      <Calendar className="w-4 h-4 mr-1" />
                      {vehicle.type.year_from || vehicle.model.year_from}
                      {(vehicle.type.year_to || vehicle.model.year_to) && 
                        ` - ${vehicle.type.year_to || vehicle.model.year_to}`
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* 🔙 Bouton retour */}
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </button>
          </div>
        </div>
      </div>

      {/* 📋 Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 📊 Informations détaillées */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Caractéristiques techniques
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Véhicule</h4>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Marque:</dt>
                      <dd className="font-medium">{vehicle.brand.marque_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Modèle:</dt>
                      <dd className="font-medium">{vehicle.model.modele_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Version:</dt>
                      <dd className="font-medium">{vehicle.type.type_name}</dd>
                    </div>
                  </dl>
                </div>
                
                {vehicle.type.type_engine && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Motorisation</h4>
                    <dl className="space-y-2">
                      {vehicle.type.type_fuel && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Carburant:</dt>
                          <dd className="font-medium">{vehicle.type.type_fuel}</dd>
                        </div>
                      )}
                      {vehicle.type.type_power && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Puissance:</dt>
                          <dd className="font-medium">{vehicle.type.type_power}</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Moteur:</dt>
                        <dd className="font-medium">{vehicle.type.type_engine}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </div>

            {/* 🛠️ Section pièces populaires */}
            <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Pièces les plus recherchées
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { name: "Filtres", icon: "🔧" },
                  { name: "Freinage", icon: "🛞" },
                  { name: "Échappement", icon: "💨" },
                  { name: "Suspension", icon: "🏗️" },
                  { name: "Éclairage", icon: "💡" },
                  { name: "Carrosserie", icon: "🚗" }
                ].map((category) => (
                  <Link
                    key={category.name}
                    to={`/pieces/${breadcrumb.brand}/${breadcrumb.model}/${breadcrumb.type}/${category.name.toLowerCase()}`}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">{category.icon}</div>
                      <div className="text-sm font-medium text-gray-900">
                        {category.name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* 📱 Sidebar actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Actions rapides
              </h3>
              
              <div className="space-y-3">
                <Link
                  to={`/pieces/${breadcrumb.brand}/${breadcrumb.model}/${breadcrumb.type}`}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Voir toutes les pièces
                </Link>
                
                <Link
                  to={`/catalogue?brand=${vehicle.brand.marque_id}&model=${vehicle.model.modele_id}&type=${vehicle.type.type_id}`}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Parcourir le catalogue
                </Link>
                
                <button
                  onClick={() => navigate('/')}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Car className="w-4 h-4 mr-2" />
                  Changer de véhicule
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}