import {
  Search,
  ArrowRight,
  Car,
  Package,
  GitBranch,
  MessageSquare,
} from "lucide-react";
import { memo } from "react";
import { Link } from "react-router";
import { ErrorSearchBar } from "~/components/errors/ErrorSearchBar";
import { PopularCategories } from "~/components/errors/PopularCategories";

export interface VehicleContext {
  marqueName: string;
  modeleName: string;
  typeName: string;
  typeFuel: string;
  typePowerPs: string;
  yearFrom: string;
  yearTo: string;
}

export interface RelatedModel {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  representative_type_id: string;
  representative_type_alias: string;
}

export interface AlternativeGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic: string | null;
  piece_count: number;
  tier: 1 | 2 | 3;
}

export interface AlternativeVehicle {
  type_id: string;
  type_name: string;
  type_alias: string | null;
  type_fuel: string;
  type_power_ps: string;
  type_year_from: string;
  type_year_to: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  tier: 1 | 2 | 3;
}

export interface NoProductsData {
  noProducts: true;
  gammeId: number;
  gammeAlias: string;
  gammeName: string;
  vehicleLabel: string;
  vehicleContext: VehicleContext;
  alternativeGammes: AlternativeGamme[];
  alternativeVehicles: AlternativeVehicle[];
  relatedModels: RelatedModel[];
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

function buildRelatedModelUrl(
  gamme: { pg_alias: string; pg_id: number },
  m: RelatedModel,
): string {
  return buildGammeVehicleUrl(gamme, {
    type_id: m.representative_type_id,
    type_alias: m.representative_type_alias,
    type_name: m.modele_name,
    modele_id: m.modele_id,
    modele_alias: m.modele_alias,
    marque_id: m.marque_id,
    marque_alias: m.marque_alias,
  } as AlternativeVehicle);
}

export const NoProductsAlternatives = memo(function NoProductsAlternatives({
  data,
}: {
  data: NoProductsData;
}) {
  const gammeUrl = `/pieces/${data.gammeAlias}-${data.gammeId}.html`;
  const contactUrl = `/contact?ref=soft-404&gamme=${data.gammeId}&type=${
    data.alternativeVehicles[0]?.type_id ?? ""
  }`;
  const ctx = data.vehicleContext;
  const vehicleH1 = `${data.gammeName} — non référencé pour votre ${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName}`;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {vehicleH1}
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Cette pièce n&apos;est pas référencée pour votre véhicule.
              Découvrez les alternatives compatibles ci-dessous.
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

          {/* Bloc 1 — Véhicules frères (même modèle, même génération) */}
          {data.alternativeVehicles.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="w-5 h-5 mr-2 text-blue-500" />
                D&apos;autres motorisations de la {ctx.marqueName}{" "}
                {ctx.modeleName} ont ce {data.gammeName.toLowerCase()}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.alternativeVehicles.map((v) => (
                  <Link
                    key={v.type_id}
                    to={buildGammeVehicleUrl(
                      { pg_alias: data.gammeAlias, pg_id: data.gammeId },
                      v,
                    )}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-blue-50 hover:shadow-sm transition-all group"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                        {v.marque_name} {v.modele_name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {v.type_name} · {v.type_power_ps}ch · {v.type_fuel}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bloc 2 — Gammes compatibles pour ce véhicule */}
          {data.alternativeGammes.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-green-500" />
                D&apos;autres pièces compatibles avec votre {
                  ctx.marqueName
                }{" "}
                {ctx.modeleName} {ctx.typeName}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.alternativeGammes.map((g) => (
                  <Link
                    key={g.pg_id}
                    to={`/pieces/${g.pg_alias}-${g.pg_id}.html`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-green-50 hover:shadow-sm transition-all group"
                  >
                    {g.pg_pic && (
                      <img
                        src={`https://img.automecanik.com/gamme/${g.pg_pic}`}
                        alt={g.pg_name}
                        className="w-10 h-10 object-contain flex-shrink-0"
                        loading="lazy"
                        width={40}
                        height={40}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 line-clamp-2">
                      {g.pg_name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bloc 3 — Autres générations qui proposent cette gamme */}
          {data.relatedModels.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <GitBranch className="w-5 h-5 mr-2 text-foreground" />
                Autres générations qui proposent ce{" "}
                {data.gammeName.toLowerCase()}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.relatedModels.map((m) => (
                  <Link
                    key={m.modele_id}
                    to={buildRelatedModelUrl(
                      { pg_alias: data.gammeAlias, pg_id: data.gammeId },
                      m,
                    )}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-muted hover:shadow-sm transition-all group"
                  >
                    <span className="text-sm font-medium text-gray-800 group-hover:text-foreground">
                      {m.marque_name} {m.modele_name}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-foreground flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Lead capture */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-gray-700 mb-3">
              Vous cherchez précisément un {data.gammeName.toLowerCase()} pour
              votre {ctx.marqueName} {ctx.modeleName} {ctx.typeName} ?
            </p>
            <Link
              to={contactUrl}
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Décrivez votre besoin <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {/* Popular categories */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <PopularCategories title="Catégories populaires" columns={4} />
          </div>
        </div>
      </div>
    </div>
  );
});
