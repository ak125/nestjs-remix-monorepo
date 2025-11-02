// Route pour afficher les modèles d'un CONSTRUCTEUR automobile
// Format: /constructeurs/{constructeur}-{id}.html
// Exemple: /constructeurs/renault-140.html
// NOTE: Ne pas confondre avec les fabricants de pièces (BOSCH, FEBI, etc.)

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";

interface VehicleModel {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  types_count: number;
}

interface LoaderData {
  manufacturer: {  // CONSTRUCTEUR (RENAULT, PEUGEOT...)
    marque_id: number;
    marque_name: string;
    marque_alias: string;
  };
  models: VehicleModel[];
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [{ title: "Constructeur non trouvé" }];
  }

  // Format: "Pièce RENAULT bas tarif pour tous les modèles de véhicule"
  return [
    { title: `Pièce ${data.manufacturer.marque_name} bas tarif pour tous les modèles de véhicule` },
    { 
      name: "description", 
      content: `Trouvez sur Automecanik tous les modèles du constructeur ${data.manufacturer.marque_name} et profitez des prix pas cher sur toutes les pièces de rechange.` 
    },
    { name: "robots", content: "index, follow" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { brand } = params;

  if (!brand || !brand.includes('-')) {
    throw new Response("URL invalide", { status: 400 });
  }

  // Parser le format "renault-140.html"
  const brandWithoutHtml = brand.replace('.html', '');
  const brandParts = brandWithoutHtml.split('-');
  const marque_id = parseInt(brandParts[brandParts.length - 1]) || 0;
  const marque_alias = brandParts.slice(0, -1).join('-');

  if (!marque_id) {
    throw new Response("ID marque invalide", { status: 400 });
  }

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  // Récupérer les informations de la marque
  const brandResponse = await fetch(
    `${baseUrl}/api/vehicles/brands/${marque_id}`,
    { headers: { 'internal-call': 'true' } }
  );

  if (!brandResponse.ok) {
    throw new Response("Marque non trouvée", { status: 404 });
  }

  const brandData = await brandResponse.json();
  const brandInfo = brandData.data;

  // Récupérer les modèles de cette marque
  const modelsResponse = await fetch(
    `${baseUrl}/api/vehicles/brands/${marque_id}/models`,
    { headers: { 'internal-call': 'true' } }
  );

  if (!modelsResponse.ok) {
    throw new Response("Erreur récupération modèles", { status: 500 });
  }

  const modelsData = await modelsResponse.json();

  return json<LoaderData>({
    manufacturer: {  // Table auto_marque = CONSTRUCTEURS automobiles
      marque_id,
      marque_name: brandInfo.marque_name,
      marque_alias,
    },
    models: modelsData.data || [],
  });
}

export default function BrandModelsPage() {
  const { manufacturer, models } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Section - Style ancien site */}
      <div className="bg-white border-b border-gray-200 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-start gap-6">
            {/* Colonne gauche: Logo + Description */}
            <div className="flex-1 flex items-start gap-6">
              {/* Logo de la marque avec lien blog */}
              <div className="flex-shrink-0 text-center">
                <Link 
                  to={`/blog-pieces-auto/auto/${manufacturer.marque_alias}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-80 transition-opacity"
                  title={`Blog ${manufacturer.marque_name}`}
                >
                  <img 
                    src={`/upload/constructeurs-automobiles/icon/${manufacturer.marque_alias}.webp`}
                    alt={manufacturer.marque_name}
                    width={70}
                    height={70}
                    className="w-[70px] h-[70px] mx-auto"
                    onError={(e) => {
                      e.currentTarget.src = '/images/default-brand.png';
                    }}
                  />
                  <span className="text-xs text-blue-600 hover:underline mt-1 block">
                    Blog {manufacturer.marque_name}
                  </span>
                </Link>
              </div>

              {/* Texte principal */}
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Pièces auto {manufacturer.marque_name}
                </h1>

                {/* Breadcrumb */}
                <nav className="text-sm mb-4">
                  <ol className="flex flex-wrap items-center gap-2">
                    <li>
                      <Link to="/" className="text-blue-600 hover:underline">Automecanik</Link>
                    </li>
                    <li className="text-gray-400">&gt;</li>
                    <li className="text-gray-600">{manufacturer.marque_name}</li>
                  </ol>
                </nav>

                {/* Description de la marque */}
                {getManufacturerDescription(manufacturer.marque_alias) && (
                  <div className="text-gray-700 leading-relaxed text-sm">
                    {getManufacturerDescription(manufacturer.marque_alias)}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne droite: Sélecteur de véhicule */}
            <div className="w-full lg:w-80 flex-shrink-0">
              <VehicleSelectorV2 
                mode="full"
                variant="card"
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

      {/* Section: Choisissez votre modèle */}
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
            Choisissez votre véhicule {manufacturer.marque_name}
          </h2>
          <div className="h-1 w-16 bg-blue-600 mb-8"></div>

          {models.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">Aucun modèle disponible pour cette marque.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {models.map((model) => (
                <Link
                  key={model.modele_id}
                  to={`/constructeurs/${manufacturer.marque_alias}-${manufacturer.marque_id}/${model.modele_alias}-${model.modele_id}.html`}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-all duration-200 p-4 block text-center border border-gray-200 hover:border-blue-500"
                >
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    {model.modele_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Voir les versions
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function pour les descriptions des marques
function getManufacturerDescription(alias: string): string | null {
  const descriptions: Record<string, string> = {
    'renault': 'Renault est une marque automobile Française créée par Louis, Marcel et Fernand Renault en 1899. La marque a reconnus plusieurs succès avec des modèles tels que la Twingo, la Clio, la Mégane et l\'Espace. Renault s\'est orienté à faire des fusions et créer des alliances en investissant avec d\'autre constructeurs automobile comme Samsung Motors, Dacia et Nissan. Renault offre une large gamme de voiture où elle a misé sur l\'innovation par exemple des voitures électriques comme la Zoe ou la Twizy, des citadines comme la nouvelle Twingo et la nouvelle Clio Zen, des berlines comme la nouvelle Mégane.',
    'peugeot': 'Peugeot est un constructeur automobile français fondé en 1810. La marque propose une large gamme de véhicules, des citadines aux SUV, en passant par les berlines et les utilitaires.',
    'citroen': 'Citroën est un constructeur automobile français fondé en 1919 par André Citroën. La marque est connue pour son innovation et son confort avec des modèles emblématiques.',
  };
  
  return descriptions[alias.toLowerCase()] || null;
}
