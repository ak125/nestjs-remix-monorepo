import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { hierarchyApi } from "../services/api/hierarchy.api";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Couleurs Familles - Admin");

/**
 * 🎨 PAGE ADMIN - Aperçu des couleurs par famille
 * Permet de visualiser toutes les couleurs assignées aux familles de produits
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Charger toutes les familles
    const catalogData = await hierarchyApi.getHomepageData();

    return json({
      families: catalogData.families || [],
      success: true,
    });
  } catch (error) {
    logger.error("Erreur chargement familles:", error);
    return json({
      families: [],
      success: false,
    });
  }
}

export default function CouleursAdminPage() {
  const { families } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* En-tête */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 Palette de couleurs des familles
          </h1>
          <p className="text-lg text-gray-600">
            Visualisation de toutes les couleurs assignées aux {families.length}{" "}
            familles de produits
          </p>

          {/* Légende */}
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              📋 Organisation des couleurs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">🔧 Mécanique & Moteur:</span>{" "}
                Rouge, Orange, Jaune, Lime
              </div>
              <div>
                <span className="font-medium">🚗 Train roulant:</span> Vert,
                Teal, Violet, Emerald
              </div>
              <div>
                <span className="font-medium">⚡ Électronique:</span> Indigo,
                Amber, Bleu
              </div>
              <div>
                <span className="font-medium">❄️ Confort:</span> Cyan, Sky,
                Fuchsia, Pink
              </div>
              <div>
                <span className="font-medium">🏗️ Structure:</span> Pink, Rose,
                Gray, Neutral
              </div>
            </div>
          </div>
        </div>

        {/* Grille de prévisualisation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {families.map((family) => {
            const familyColor = hierarchyApi.getFamilyColor(family);
            const familyImage = hierarchyApi.getFamilyImage(family);

            return (
              <div
                key={family.mf_id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* Carte couleur avec image */}
                <div
                  className={`relative h-48 bg-gradient-to-br ${familyColor}`}
                >
                  <img
                    src={familyImage}
                    alt={family.mf_name_system || family.mf_name}
                    className="w-full h-full object-contain opacity-90"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  {/* Badge ID */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    ID: {family.mf_id}
                  </div>

                  {/* Overlay titre */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <h3 className="text-white font-bold text-lg line-clamp-2">
                      {family.mf_name_system || family.mf_name}
                    </h3>
                  </div>
                </div>

                {/* Informations */}
                <div className="p-4">
                  {/* Classes Tailwind */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Classes CSS
                    </p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-800 block overflow-x-auto">
                      {familyColor}
                    </code>
                  </div>

                  {/* Statistiques */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">
                        {family.gammes_count || 0}
                      </span>
                      <span className="text-gray-500">gammes</span>
                    </span>
                    {family.mf_sort && (
                      <span className="text-xs text-gray-400">
                        Ordre: {family.mf_sort}
                      </span>
                    )}
                  </div>

                  {/* Aperçu couleur pur */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div
                      className={`h-12 rounded-lg bg-gradient-to-br ${familyColor} shadow-inner`}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section : Palette étendue de référence */}
        <div className="mt-16 p-6 bg-white rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            🎨 Palette complète de référence (50 couleurs)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 50 }, (_, i) => i + 1).map((id) => {
              // Simuler une famille avec cet ID
              const mockFamily = {
                mf_id: id.toString(),
                mf_name: `Famille ${id}`,
              };
              const color = hierarchyApi.getFamilyColor(mockFamily as any);

              return (
                <div key={id} className="text-center">
                  <div
                    className={`h-20 rounded-lg bg-gradient-to-br ${color} shadow-md mb-2`}
                  ></div>
                  <p className="text-xs font-semibold text-gray-700">
                    ID: {id}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-tight break-words">
                    {color.replace("from-", "").replace(" to-", " → ")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            💡 <strong>Note:</strong> Les couleurs sont assignées
            automatiquement par ID ou par recherche de mots-clés dans le nom.
          </p>
          <p className="mt-1">
            Si une famille n'a pas de couleur spécifique, une couleur est
            générée de manière cohérente via un hash.
          </p>
        </div>
      </div>
    </div>
  );
}
