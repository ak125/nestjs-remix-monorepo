// 🎨 PAGE ADMIN - VISUALISATION DES COULEURS CONSTRUCTEURS
// Affiche tous les gradients de couleurs par marque automobile

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ChevronLeft, Car } from "lucide-react";
import { brandColorsService } from "../services/brand-colors.service";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Couleurs Constructeurs - Admin");

interface Brand {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
}

interface LoaderData {
  brands: Brand[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = getInternalApiUrl("");

  const response = await fetch(`${baseUrl}/api/vehicles/brands`, {
    headers: { "internal-call": "true" },
  });

  if (!response.ok) {
    throw new Response("Erreur chargement marques", { status: 500 });
  }

  const data = await response.json();
  const brands = (data.data || []).sort((a: Brand, b: Brand) =>
    a.marque_name.localeCompare(b.marque_name),
  );

  return json<LoaderData>({ brands });
}

export default function CouleursConstructeursAdminPage() {
  const { brands } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* En-tête */}
        <div className="mb-10">
          <Link
            to="/admin/couleurs-familles"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">
              Retour aux couleurs familles
            </span>
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🏁 Palette de couleurs des constructeurs
          </h1>
          <p className="text-lg text-gray-600">
            Visualisation de toutes les couleurs assignées aux {brands.length}{" "}
            marques automobiles
          </p>

          {/* Légende */}
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              📋 Organisation des couleurs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-600 to-blue-800"></span>
                <span>
                  <strong>Bleu</strong> : BMW, Ford, VW, Hyundai...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-600 to-red-800"></span>
                <span>
                  <strong>Rouge</strong> : Ferrari, Toyota, Audi Sport...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600"></span>
                <span>
                  <strong>Jaune</strong> : Renault, Chevrolet...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-slate-500 to-gray-700"></span>
                <span>
                  <strong>Argent</strong> : Mercedes, Porsche, Lexus...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-green-700 to-emerald-800"></span>
                <span>
                  <strong>Vert</strong> : Jaguar, Land Rover, Lamborghini...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-700 to-violet-800"></span>
                <span>
                  <strong>Violet</strong> : DS, Rolls-Royce...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grille des marques avec leurs couleurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brands.map((brand) => {
            const brandColor = brandColorsService.getBrandGradient(
              brand.marque_alias,
            );

            return (
              <Link
                key={brand.marque_id}
                to={`/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`}
                className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
              >
                {/* Gradient de fond avec couleur de la marque */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${brandColor} transition-all duration-300`}
                ></div>

                {/* Overlay pour améliorer le contraste */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40 group-hover:from-black/20 group-hover:via-black/10 group-hover:to-black/30 transition-all duration-300"></div>

                {/* Contenu */}
                <div className="relative p-6 min-h-[160px] flex flex-col justify-between">
                  {/* Badge ID */}
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-xs font-medium">
                      <Car className="w-3 h-3" />
                      ID {brand.marque_id}
                    </span>
                  </div>

                  {/* Nom de la marque */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                      {brand.marque_name}
                    </h3>
                    <p className="text-white/80 text-sm font-medium drop-shadow-md">
                      {brand.marque_alias}
                    </p>
                  </div>

                  {/* Gradient preview bar */}
                  <div className="flex items-center gap-2 mt-4">
                    <div
                      className={`flex-1 h-2 rounded-full bg-gradient-to-r ${brandColor} shadow-lg`}
                    ></div>
                    <span className="text-white/70 text-xs font-mono whitespace-nowrap">
                      {brandColor.backgroundImage
                        .split(" ")
                        .slice(0, 2)
                        .join(" ")}
                      ...
                    </span>
                  </div>
                </div>

                {/* Hover indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/0 group-hover:bg-white/30 transition-all duration-300"></div>
              </Link>
            );
          })}
        </div>

        {/* Statistiques */}
        <div className="mt-12 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📊 Statistiques
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {brands.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Marques totales</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {
                  brands.filter((b) =>
                    brandColorsService
                      .getBrandGradient(b.marque_alias)
                      .backgroundImage.includes("green"),
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600 mt-1">Couleurs vertes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {
                  brands.filter((b) =>
                    brandColorsService
                      .getBrandGradient(b.marque_alias)
                      .backgroundImage.includes("red"),
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600 mt-1">Couleurs rouges</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {
                  brands.filter((b) =>
                    brandColorsService
                      .getBrandGradient(b.marque_alias)
                      .backgroundImage.includes("blue"),
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600 mt-1">Couleurs bleues</div>
            </div>
          </div>
        </div>

        {/* Notes de développement */}
        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
            💡 Notes de développement
          </h3>
          <ul className="space-y-2 text-sm text-amber-800">
            <li>
              • Les couleurs sont mappées dans{" "}
              <code className="bg-amber-100 px-2 py-0.5 rounded">
                brand-colors.service.ts → getBrandGradient()
              </code>
            </li>
            <li>
              • Chaque marque a un gradient unique basé sur son identité
              visuelle officielle
            </li>
            <li>
              • Les marques inconnues utilisent un fallback neutre gris :{" "}
              <code className="bg-amber-100 px-2 py-0.5 rounded">
                from-slate-600 via-gray-700 to-slate-800
              </code>
            </li>
            <li>
              • Le gradient est appliqué automatiquement dans le hero de{" "}
              <code className="bg-amber-100 px-2 py-0.5 rounded">
                /constructeurs/&#123;brand&#125;.html
              </code>
            </li>
            <li>
              • Contraste WCAG AA respecté (texte blanc sur tous les gradients)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
