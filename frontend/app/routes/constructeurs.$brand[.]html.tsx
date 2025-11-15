// 🎨 VERSION AMÉLIORÉE — PAGE CATALOGUE CONSTRUCTEUR
// Format: /constructeurs/{constructeur}-{id}.html
// Exemple: /constructeurs/bmw-33.html, /constructeurs/renault-140.html

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Car, Filter, Disc, Wrench, Droplet, Zap, Settings, ChevronRight, TrendingUp, Package } from "lucide-react";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";
import { getPopularVehicles, getPopularParts as getApiPopularParts } from "../services/api/brand.api";
import type { PopularVehicle, PopularPart as ApiPopularPart } from "../types/brand.types";

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

interface LoaderData {
  manufacturer: {
    marque_id: number;
    marque_name: string;
    marque_alias: string;
  };
  popularParts: PopularPart[];
  brandDescription: BrandDescription;
  apiVehicles: PopularVehicle[];
  apiParts: ApiPopularPart[];
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Constructeur non trouvé" }];
  }

  const brand = data.manufacturer.marque_name;
  
  return [
    { 
      title: `Pièces Auto ${brand} pas cher | Catalogue complet ${brand} - Automecanik` 
    },
    { 
      name: "description", 
      content: `Trouvez toutes les pièces ${brand} compatibles : filtration, freinage, suspension, moteur. Prix discount, livraison rapide, compatibilité garantie.` 
    },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: `Catalogue pièces ${brand} - Prix discount` },
    { property: "og:description", content: `Toutes les pièces ${brand} au meilleur prix` },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { brand } = params;

  if (!brand || !brand.includes('-')) {
    throw new Response("URL invalide", { status: 400 });
  }

  const brandWithoutHtml = brand.replace('.html', '');
  const brandParts = brandWithoutHtml.split('-');
  const marque_id = parseInt(brandParts[brandParts.length - 1]) || 0;
  const marque_alias = brandParts.slice(0, -1).join('-');

  if (!marque_id) {
    throw new Response("ID marque invalide", { status: 400 });
  }

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  const brandResponse = await fetch(
    `${baseUrl}/api/vehicles/brands/${marque_id}`,
    { headers: { 'internal-call': 'true' } }
  );

  if (!brandResponse.ok) {
    throw new Response("Marque non trouvée", { status: 404 });
  }

  const brandData = await brandResponse.json();
  const brandInfo = brandData.data;

  // Pièces populaires et description
  const popularParts = getPopularParts(marque_alias);
  const brandDescription = getBrandDescription(marque_alias);

  // Récupération des bestsellers depuis l'API
  let apiVehicles: PopularVehicle[] = [];
  let apiParts: ApiPopularPart[] = [];
  
  try {
    [apiVehicles, apiParts] = await Promise.all([
      getPopularVehicles(marque_alias, 6),
      getApiPopularParts(marque_alias, 8)
    ]);
  } catch (error) {
    console.error('Error fetching bestsellers:', error);
  }

  return json<LoaderData>({
    manufacturer: {
      marque_id,
      marque_name: brandInfo.marque_name,
      marque_alias,
    },
    popularParts,
    brandDescription,
    apiVehicles,
    apiParts,
  });
}

export default function BrandCatalogPage() {
  const { manufacturer, popularParts, brandDescription, apiVehicles, apiParts } = useLoaderData<typeof loader>();

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
              <Link to="/constructeurs" className="text-blue-600 hover:underline">Constructeurs</Link>
            </li>
            <li><ChevronRight className="w-4 h-4 text-gray-400" /></li>
            <li className="font-semibold text-gray-900">{manufacturer.marque_name}</li>
          </ol>
        </div>
      </nav>

      {/* 🏎️ Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex items-center gap-6">
              <img 
                src={`/upload/constructeurs-automobiles/icon/${manufacturer.marque_alias}.webp`}
                alt={`Logo ${manufacturer.marque_name}`}
                width={100}
                height={100}
                className="w-[100px] h-[100px] bg-white rounded-lg p-3"
                onError={(e) => {
                  e.currentTarget.src = '/images/default-brand.png';
                }}
              />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  Catalogue pièces auto {manufacturer.marque_name}
                </h1>
                <p className="text-blue-100 text-lg">
                  Trouvez rapidement les pièces adaptées : entretien, freinage, suspension, moteur…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔎 Sélecteur de véhicule */}
      <div className="bg-white border-b border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-600" />
            Sélectionnez votre véhicule {manufacturer.marque_name}
          </h2>
          
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

      {/* 🚗 Véhicules les plus recherchés */}
      {apiVehicles.length > 0 && (
        <div className="bg-white py-12 border-b border-gray-200">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-3 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              Véhicules {manufacturer.marque_name} les plus recherchés
            </h2>
            <div className="h-1 w-24 bg-blue-600 mb-8"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.type_id} vehicle={vehicle} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 📦 Pièces populaires depuis l'API */}
      {apiParts.length > 0 && (
        <div className="bg-gray-50 py-12 border-b border-gray-200">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-3 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              Pièces {manufacturer.marque_name} populaires
            </h2>
            <div className="h-1 w-24 bg-blue-600 mb-8"></div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {apiParts.map((part) => (
                <ApiPartCard key={part.pg_id} part={part} brandAlias={manufacturer.marque_alias} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Pièces les plus vendues */}
      <div className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-blue-600" />
            Les pièces {manufacturer.marque_name} les plus vendues
          </h2>
          <div className="h-1 w-24 bg-blue-600 mb-8"></div>

          <div className="space-y-8">
            {groupByCategory(popularParts).map(([category, parts]) => (
              <div key={category}>
                <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  {getCategoryIcon(category)}
                  {category}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {parts.map((part, idx) => (
                    <PartCard key={idx} part={part} brandAlias={manufacturer.marque_alias} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 📘 Présentation Constructeur */}
      <div className="bg-white py-12 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            À propos de {manufacturer.marque_name}
          </h2>
          <div className="prose max-w-none">
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              {brandDescription.history}
            </p>
            
            {brandDescription.strengths.length > 0 && (
              <div className="mb-6">
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
            
            {brandDescription.models.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Gammes disponibles</h3>
                <div className="flex flex-wrap gap-2">
                  {brandDescription.models.map((model, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 🚗 Composant Carte de véhicule API
function VehicleCard({ vehicle }: { vehicle: PopularVehicle }) {
  const yearRange = vehicle.type_year_to 
    ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
    : `depuis ${vehicle.type_year_from}`;

  const vehicleUrl = vehicle.vehicle_url || `/voiture/${vehicle.modele_alias}/${vehicle.type_alias}`;
  const imageUrl = vehicle.image_url || `/upload/constructeurs-automobiles/modeles/${vehicle.modele_pic || 'default.webp'}`;

  return (
    <Link
      to={vehicleUrl}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden group border border-gray-200"
    >
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        <img 
          src={imageUrl}
          alt={`${vehicle.marque_name} ${vehicle.modele_name}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = '/images/default-vehicle.png';
          }}
        />
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">
          {vehicle.type_power_ps} ch
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
          {vehicle.modele_name}
        </h3>
        <p className="text-blue-600 font-semibold text-base mb-2">
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
          <span className="text-blue-600 text-sm font-medium group-hover:underline">
            Voir les pièces →
          </span>
        </div>
      </div>
    </Link>
  );
}

// 📦 Composant Carte de pièce API
function ApiPartCard({ part, brandAlias }: { part: ApiPopularPart; brandAlias: string }) {
  const partUrl = part.part_url || `/pieces/${brandAlias}/${part.pg_alias}`;
  const imageUrl = part.image_url || `/upload/pieces-auto/${part.pg_pic || 'default.webp'}`;

  return (
    <Link
      to={partUrl}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 border border-gray-200 group"
    >
      <div className="flex items-center justify-center h-24 mb-3 bg-gray-50 rounded-lg overflow-hidden">
        <img 
          src={imageUrl}
          alt={part.pg_name}
          className="h-full w-auto object-contain group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = '/images/default-part.png';
          }}
        />
      </div>
      
      <h4 className="font-semibold text-sm text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
        {part.pg_name}
      </h4>
      
      <p className="text-xs text-gray-500 mb-2">
        {part.modele_name} • {part.type_name}
      </p>
      
      <span className="text-blue-600 text-xs font-medium group-hover:underline">
        Voir →
      </span>
    </Link>
  );
}

// 🎨 Composant Carte de pièce
function PartCard({ part, brandAlias }: { part: PopularPart; brandAlias: string }) {
  const iconMap: Record<string, any> = {
    'filter': Filter,
    'disc': Disc,
    'wrench': Wrench,
    'droplet': Droplet,
    'zap': Zap,
    'settings': Settings,
  };
  
  const Icon = iconMap[part.icon] || Wrench;
  
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200 p-6 border border-gray-200">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-lg font-bold text-gray-900 mb-2">{part.name}</h4>
          <p className="text-gray-600 text-sm mb-3">{part.description}</p>
        </div>
      </div>

      {/* Symptômes */}
      {part.symptoms.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">À remplacer si :</p>
          <ul className="space-y-1">
            {part.symptoms.map((symptom, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{symptom}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Compatibilité */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 mb-1">Exemple de compatibilité</p>
        <p className="text-sm font-medium text-gray-800">{part.compatibility}</p>
      </div>

      {/* Bénéfice */}
      <div className="mb-4">
        <p className="text-sm text-blue-700 font-medium">👉 {part.benefit}</p>
      </div>

      {/* Maintenance */}
      {part.maintenance && (
        <p className="text-xs text-gray-500 italic mb-4">{part.maintenance}</p>
      )}

      {/* CTA */}
      <Link
        to={`/pieces/${brandAlias}`}
        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
      >
        {part.ctaText}
      </Link>
    </div>
  );
}

// 📊 Helpers
function groupByCategory(parts: PopularPart[]): [string, PopularPart[]][] {
  const grouped = parts.reduce((acc, part) => {
    if (!acc[part.category]) {
      acc[part.category] = [];
    }
    acc[part.category].push(part);
    return acc;
  }, {} as Record<string, PopularPart[]>);
  
  return Object.entries(grouped);
}

function getCategoryIcon(category: string) {
  const icons: Record<string, any> = {
    'Filtration': <Filter className="w-6 h-6 text-blue-600" />,
    'Freinage': <Disc className="w-6 h-6 text-red-600" />,
    'Direction & Suspension': <Settings className="w-6 h-6 text-purple-600" />,
    'Moteur & Distribution': <Zap className="w-6 h-6 text-yellow-600" />,
    'Refroidissement & Climatisation': <Droplet className="w-6 h-6 text-cyan-600" />,
  };
  
  return icons[category] || <Wrench className="w-6 h-6 text-gray-600" />;
}

// 🗃️ Data providers
function getPopularParts(brandAlias: string): PopularPart[] {
  return [
    {
      category: 'Filtration',
      icon: 'filter',
      name: 'Filtre à huile',
      description: 'Assure la propreté du lubrifiant moteur.',
      symptoms: ['Témoin huile allumé', 'Fumée blanche', 'Huile très noire'],
      maintenance: 'Vérifier tous les 15 000 km',
      benefit: 'Évitez l\'usure turbo et les dépôts',
      compatibility: 'Compatible avec la majorité des modèles diesel et essence',
      ctaText: 'Voir les filtres à huile'
    },
    {
      category: 'Filtration',
      icon: 'filter',
      name: 'Filtre à air',
      description: 'Garantit une bonne combustion.',
      symptoms: ['Encrassement', 'Perte de puissance', 'Surconsommation'],
      maintenance: 'Changer tous les 20 000 km',
      benefit: 'Moteur plus réactif et consommation réduite',
      compatibility: 'Tous modèles essence et diesel',
      ctaText: 'Voir les filtres à air'
    },
    {
      category: 'Freinage',
      icon: 'disc',
      name: 'Plaquettes de frein',
      description: 'Élément essentiel pour un freinage efficace.',
      symptoms: ['Bruit métallique', 'Distance de freinage augmentée', 'Témoin allumé'],
      maintenance: 'Remplacement par essieu',
      benefit: 'Sécurité optimale',
      compatibility: 'Disponible pour tous modèles',
      ctaText: 'Voir les plaquettes'
    },
    {
      category: 'Freinage',
      icon: 'disc',
      name: 'Disques de frein',
      description: 'Surface de freinage des plaquettes.',
      symptoms: ['Disques voilés', 'Vibrations', 'Rouille excessive'],
      maintenance: 'Changer par paire',
      benefit: 'Freinage précis et stable',
      compatibility: 'Gamme complète disponible',
      ctaText: 'Voir les disques'
    },
  ];
}

function getBrandDescription(brandAlias: string): BrandDescription {
  const descriptions: Record<string, BrandDescription> = {
    'bmw': {
      history: 'BMW est un constructeur premium allemand fondé en 1917, reconnu pour ses moteurs performants, sa précision et ses technologies innovantes.',
      strengths: [
        'Moteurs performants et efficients',
        'Qualité de fabrication premium',
        'Technologies de pointe (iDrive)',
        'Dynamique de conduite sportive',
      ],
      models: ['Série 1', 'Série 3', 'Série 5', 'X1', 'X3', 'X5', 'Gamme M'],
    },
    'renault': {
      history: 'Renault est une marque française créée en 1899, leader européen proposant des véhicules innovants et accessibles.',
      strengths: [
        'Pionnier du véhicule électrique',
        'Excellente sécurité (5 étoiles)',
        'Design audacieux',
        'Réseau SAV dense',
      ],
      models: ['Twingo', 'Clio', 'Captur', 'Mégane', 'Arkana', 'Zoé'],
    },
  };

  return descriptions[brandAlias.toLowerCase()] || {
    history: `Constructeur automobile proposant une large gamme de véhicules alliant performance et innovation.`,
    strengths: ['Qualité reconnue', 'Technologies modernes', 'Large réseau'],
    models: [],
  };
}
