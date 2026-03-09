import { Link } from "@remix-run/react";
import { Search, ArrowRight, Car, Package } from "lucide-react";
import { memo } from "react";
import { ErrorSearchBar } from "~/components/errors/ErrorSearchBar";
import { PopularCategories } from "~/components/errors/PopularCategories";

interface AlternativeGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic: string | null;
}

interface AlternativeVehicle {
  type_id: string;
  type_name: string;
  type_alias: string | null;
  modele_name: string;
  modele_alias: string;
  modele_id: number;
  marque_name: string;
  marque_alias: string;
  marque_id: number;
}

export interface NoProductsData {
  noProducts: true;
  gammeId: number;
  gammeAlias: string;
  gammeName: string;
  vehicleLabel: string;
  alternativeGammes: AlternativeGamme[];
  alternativeVehicles: AlternativeVehicle[];
}

function buildGammeVehicleUrl(
  gamme: { pg_alias: string; pg_id: number },
  vehicle: AlternativeVehicle,
): string {
  const gammeSlug = `${gamme.pg_alias}-${gamme.pg_id}`;
  const marqueSlug = `${vehicle.marque_alias}-${vehicle.marque_id}`;
  const modeleSlug = `${vehicle.modele_alias}-${vehicle.modele_id}`;
  const typeSlug = `${vehicle.type_alias || vehicle.type_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${vehicle.type_id}`;
  return `/pieces/${gammeSlug}/${marqueSlug}/${modeleSlug}/${typeSlug}.html`;
}

export const NoProductsAlternatives = memo(function NoProductsAlternatives({
  data,
}: {
  data: NoProductsData;
}) {
  const gammeUrl = `/pieces/${data.gammeAlias}-${data.gammeId}.html`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {data.gammeName}
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Aucun produit disponible pour{" "}
              <span className="font-medium text-gray-800">
                {data.vehicleLabel}
              </span>
            </p>
            <Link
              to={gammeUrl}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              Voir tous les {data.gammeName.toLowerCase()}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {/* Search */}
          <div className="mb-8 max-w-2xl mx-auto">
            <ErrorSearchBar placeholder="Rechercher une pièce, un véhicule..." />
          </div>

          {/* Alternative gammes for this vehicle */}
          {data.alternativeGammes.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="w-5 h-5 mr-2 text-blue-500" />
                Pièces disponibles pour votre véhicule
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.alternativeGammes.map((gamme) => (
                  <Link
                    key={gamme.pg_id}
                    to={`/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 hover:shadow-sm transition-all group"
                  >
                    {gamme.pg_pic && (
                      <img
                        src={`https://img.automecanik.com/gamme/${gamme.pg_pic}`}
                        alt={gamme.pg_name}
                        className="w-10 h-10 object-contain flex-shrink-0"
                        loading="lazy"
                        width={40}
                        height={40}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 line-clamp-2">
                      {gamme.pg_name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Alternative vehicles for this gamme */}
          {data.alternativeVehicles.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-green-500" />
                {data.gammeName} pour d&apos;autres véhicules
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.alternativeVehicles.map((vehicle) => (
                  <Link
                    key={vehicle.type_id}
                    to={buildGammeVehicleUrl(
                      { pg_alias: data.gammeAlias, pg_id: data.gammeId },
                      vehicle,
                    )}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-green-50 hover:shadow-sm transition-all group"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-green-700">
                        {vehicle.marque_name} {vehicle.modele_name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {vehicle.type_name}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Popular categories */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <PopularCategories title="Catégories populaires" columns={4} />
          </div>
        </div>
      </div>
    </div>
  );
});
