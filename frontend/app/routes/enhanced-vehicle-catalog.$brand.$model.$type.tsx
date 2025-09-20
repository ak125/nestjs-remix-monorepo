import { 
  json, 
  type LoaderFunctionArgs, 
  type MetaFunction,
} from "@remix-run/node";
import { 
  useLoaderData, 
  useRouteError, 
  isRouteErrorResponse,
} from "@remix-run/react";
import { z } from "zod";

// Composants vehicle
import { VehicleHeader } from "~/components/vehicle/VehicleHeader";
import { VehicleInfo } from "~/components/vehicle/VehicleInfo";
import { VehicleGallery } from "~/components/vehicle/VehicleGallery";
import { VehiclePartsGrid } from "~/components/vehicle/VehiclePartsGrid";
import { VehicleAnalytics } from "~/components/vehicle/VehicleAnalytics";

// Composants UI
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";

// Types
import type { VehicleData } from "~/types/vehicle.types";

// ========================================
// 🔍 VALIDATION SCHEMA
// ========================================
const ParamsSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  type: z.string().min(1),
});

// Types de données mockes pour le développement
interface MockVehiclePart {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  brand: string;
  partNumber: string;
  category: string;
}

// ========================================
// 🔧 LOADER FUNCTION
// ========================================
export async function loader({ params }: LoaderFunctionArgs) {
  try {
    // Validation des paramètres
    const validatedParams = ParamsSchema.parse(params);
    const { brand, model, type } = validatedParams;

    // Mock data pour le développement
    const vehicleData: VehicleData = {
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      model: model.charAt(0).toUpperCase() + model.slice(1),
      type: type.replace(/-/g, ' ').toUpperCase(),
      year: 2020,
      engine: "1.6 HDi",
      fuel: "Diesel",
      power: "110 CV",
      description: `Découvrez notre gamme complète de pièces détachées pour votre ${brand} ${model} ${type}. Qualité garantie et livraison rapide.`,
      partsCount: 1247,
      brandId: 1,
      modelId: 1,
      typeId: 1,
    };

    // Mock parts data
    const mockParts: MockVehiclePart[] = [
      {
        id: 1,
        name: "Plaquettes de frein avant",
        description: "Plaquettes de frein haute qualité",
        price: 45.99,
        currency: "EUR",
        availability: 'in-stock',
        brand: "Bosch",
        partNumber: "BP1234",
        category: "Freinage"
      },
      {
        id: 2,
        name: "Filtre à air",
        description: "Filtre à air haute performance",
        price: 12.50,
        currency: "EUR",
        availability: 'in-stock',
        brand: "Mann",
        partNumber: "FA5678",
        category: "Moteur"
      },
      {
        id: 3,
        name: "Amortisseur arrière",
        description: "Amortisseur de suspension",
        price: 89.99,
        currency: "EUR",
        availability: 'low-stock',
        brand: "Monroe",
        partNumber: "AM9012",
        category: "Suspension"
      }
    ];

    return json({
      vehicle: vehicleData,
      parts: mockParts,
      success: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erreur dans le loader:', error);
    throw json({ error: 'Véhicule non trouvé' }, { status: 404 });
  }
}

// ========================================
// 🎯 META FUNCTION
// ========================================
export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
  if (!data || !data.vehicle) {
    return [
      { title: "Véhicule non trouvé" },
      { name: "description", content: "Le véhicule demandé n'a pas été trouvé." },
    ];
  }

  const { vehicle } = data;
  const title = `Pièces ${vehicle.brand} ${vehicle.model} ${vehicle.type} | Pièces Auto`;
  const description = `Découvrez ${vehicle.partsCount || 0} pièces détachées pour ${vehicle.brand} ${vehicle.model} ${vehicle.type}. Livraison rapide et garantie qualité.`;

  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: `${vehicle.brand}, ${vehicle.model}, ${vehicle.type}, pièces détachées, pièces auto` },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================
export default function EnhancedVehicleCatalog() {
  const { vehicle, parts } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Analytics tracking */}
      <VehicleAnalytics vehicle={vehicle} />
      
      {/* En-tête du véhicule */}
      <VehicleHeader vehicle={vehicle} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-8">
            {/* Galerie d'images */}
            <VehicleGallery vehicle={vehicle} />
            
            {/* Grille des pièces */}
            <VehiclePartsGrid vehicle={vehicle} parts={parts} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <VehicleInfo vehicle={vehicle} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// 🚨 ERROR BOUNDARY
// ========================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {error.status} {error.statusText}
          </h1>
          <p className="text-gray-600 mb-8">
            {error.status === 404 
              ? "Le véhicule que vous recherchez n'existe pas."
              : "Une erreur est survenue lors du chargement de la page."
            }
          </p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Retourner à l'accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Erreur inattendue
        </h1>
        <p className="text-gray-600 mb-8">
          Une erreur inattendue s'est produite. Veuillez réessayer.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Recharger la page
        </button>
      </div>
    </div>
  );
}