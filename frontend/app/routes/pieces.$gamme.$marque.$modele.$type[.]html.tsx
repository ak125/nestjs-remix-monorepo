// 🔧 Route pièces avec véhicule - Format: /pieces/{gamme}/{marque}/{modele}/{type}.html

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { catalogFamiliesApi } from "../services/api/catalog-families.api";

// 📝 Types
interface VehicleData {
  marque: string;
  modele: string;
  type: string;
  typeId: number;
}

interface GammeData {
  id: number;
  name: string;
  alias: string;
  description: string;
}

interface PieceData {
  id: number;
  name: string;
  price: string;
  brand: string;
  stock: string;
  reference: string;
}

interface LoaderData {
  vehicle: VehicleData;
  gamme: GammeData;
  pieces: PieceData[];
  seo: {
    title: string;
    h1: string;
    description: string;
  };
  performance: {
    loadTime: string;
    source: string;
  };
}

// 🔄 Loader
export async function loader({ params }: LoaderFunctionArgs) {
  console.log('🔧 [PIECES-VEHICULE HTML] Loader appelé avec params:', params);
  
  const { gamme: gammeParam, marque: marqueParam, modele: modeleParam, type: typeParam } = params;
  
  if (!gammeParam || !marqueParam || !modeleParam || !typeParam) {
    console.error('❌ [PIECES-VEHICULE HTML] Paramètres manquants:', { gammeParam, marqueParam, modeleParam, typeParam });
    throw new Response("Paramètres manquants", { status: 400 });
  }
  
  console.log('✅ [PIECES-VEHICULE HTML] Paramètres:', { gammeParam, marqueParam, modeleParam, typeParam });
  
  const startTime = Date.now();
  
  // Extraction des IDs (format attendu: "nom-id")
  const gammeId = parseInt(gammeParam.split('-').pop() || '0');
  const typeId = parseInt(typeParam.split('-').pop() || '0');
  
  // Parsing des noms
  const gammeAlias = gammeParam.split('-').slice(0, -1).join('-');
  const marqueAlias = marqueParam.split('-').slice(0, -1).join('-');
  const modeleAlias = modeleParam.split('-').slice(0, -1).join('-');
  const typeAlias = typeParam.split('-').slice(0, -1).join('-');
  
  // === DONNÉES VÉHICULE ===
  const vehicle: VehicleData = {
    marque: marqueAlias.toUpperCase(),
    modele: modeleAlias.replace(/-/g, ' ').toUpperCase(),
    type: typeAlias.replace(/-/g, ' ').toUpperCase(),
    typeId
  };
  
  // === DONNÉES GAMME ===
  const gamme: GammeData = {
    id: gammeId,
    name: gammeAlias.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    alias: gammeAlias,
    description: `Pièces ${gammeAlias.replace(/-/g, ' ')} de qualité pour ${vehicle.marque} ${vehicle.modele}`
  };
  
  // === RÉCUPÉRATION V4 ===
  let catalogV4Data = null;
  let v4Source = 'SIMULATION';
  
  try {
    console.log(`🚀 [PIECES-VEHICULE V4] Récupération pour type_id: ${typeId}`);
    catalogV4Data = await catalogFamiliesApi.getCatalogFamiliesForVehicleV4(typeId);
    v4Source = catalogV4Data.performance?.source || 'DATABASE';
    console.log(`✅ [PIECES-VEHICULE V4] ${catalogV4Data.catalog.length} familles - Source: ${v4Source}`);
  } catch (error) {
    console.error('⚠️ [PIECES-VEHICULE V4] Erreur:', error);
  }
  
  // === GÉNÉRATION PIÈCES ===
  const pieces: PieceData[] = [
    {
      id: 1,
      name: `${gamme.name} ${vehicle.marque} ${vehicle.modele}`,
      price: '24.90€',
      brand: 'BOSCH',
      stock: 'En stock',
      reference: `REF-${gammeId}-${typeId}-001`
    },
    {
      id: 2,
      name: `${gamme.name} Premium ${vehicle.marque}`,
      price: '34.90€',
      brand: 'MANN-FILTER', 
      stock: '2-3 jours',
      reference: `REF-${gammeId}-${typeId}-002`
    },
    {
      id: 3,
      name: `Kit ${gamme.name} ${vehicle.marque}`,
      price: '49.90€',
      brand: 'FEBI BILSTEIN',
      stock: 'En stock',
      reference: `REF-${gammeId}-${typeId}-003`
    },
    {
      id: 4,
      name: `${gamme.name} Économique ${vehicle.marque}`,
      price: '19.90€',
      brand: 'VALEO',
      stock: 'En stock',
      reference: `REF-${gammeId}-${typeId}-004`
    }
  ];
  
  const loadTime = `${Date.now() - startTime}ms`;
  
  const loaderData: LoaderData = {
    vehicle,
    gamme,
    pieces,
    seo: {
      title: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`,
      h1: `${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`,
      description: `${gamme.name} compatibles ${vehicle.marque} ${vehicle.modele} ${vehicle.type}. ${pieces.length} pièces en stock, livraison rapide.`
    },
    performance: {
      loadTime,
      source: v4Source
    }
  };
  
  console.log('✅ [PIECES-VEHICULE HTML] Généré en', loadTime, '- V4 Source:', v4Source);
  
  return json(loaderData);
}

// 🎯 Meta
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Pièces non trouvées" }];
  }

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "robots", content: "index, follow" }
  ];
};

// 🎨 Composant
export default function PiecesVehiculePage() {
  const data = useLoaderData<LoaderData>();
  const { vehicle, gamme, pieces, seo, performance } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          
          {/* Breadcrumb */}
          <nav className="text-blue-200 text-sm mb-4">
            <span>Constructeurs</span> → 
            <span className="mx-1">{vehicle.marque}</span> → 
            <span className="mx-1">{vehicle.modele}</span> → 
            <span className="mx-1">{vehicle.type}</span> → 
            <span className="text-white">{gamme.name}</span>
          </nav>
          
          <h1 className="text-3xl font-bold mb-4">{seo.h1}</h1>
          
          <div className="flex flex-wrap gap-4 text-blue-100 mb-4">
            <span>🏭 {vehicle.marque}</span>
            <span>🚗 {vehicle.modele}</span>
            <span>⚡ {vehicle.type}</span>
            <span>🔧 {gamme.name}</span>
          </div>
          
          {/* Performance V4 */}
          <div className="bg-white/10 rounded-lg p-3 inline-block">
            <div className="text-sm flex gap-4">
              <span>⚡ {performance.loadTime}</span>
              <span>📊 V4 {performance.source}</span>
              <span>🔢 {pieces.length} pièces</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Description */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{gamme.name}</h2>
          <p className="text-gray-600 mb-4">{gamme.description}</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <span>Gamme ID: {gamme.id}</span>
            <span>Type ID: {vehicle.typeId}</span>
            <span>Pièces disponibles: {pieces.length}</span>
          </div>
        </div>

        {/* Grid pièces */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {pieces.map((piece) => (
            <div key={piece.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              
              {/* Image placeholder */}
              <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
                <span className="text-4xl">🔧</span>
              </div>
              
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-600">{piece.brand}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    piece.stock === 'En stock' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {piece.stock}
                  </span>
                </div>
                
                {/* Nom */}
                <h3 className="font-semibold text-gray-900 mb-2 text-sm leading-tight">
                  {piece.name}
                </h3>
                
                {/* Référence */}
                <div className="text-xs text-gray-500 mb-3">
                  Réf: {piece.reference}
                </div>
                
                {/* Prix et action */}
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">
                    {piece.price}
                  </div>
                  <button className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors">
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info complémentaires */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3">🚚 Livraison</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Gratuite dès 50€</li>
              <li>• Express 24h disponible</li>
              <li>• Retour gratuit 30 jours</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3">🔧 Installation</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Compatible {vehicle.marque} {vehicle.modele}</li>
              <li>• Notice incluse</li>
              <li>• Support technique 6j/7</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}