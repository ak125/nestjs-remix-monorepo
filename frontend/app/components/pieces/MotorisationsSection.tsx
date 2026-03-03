import { Link } from "@remix-run/react";
import {
  Car,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState, memo } from "react";
import { Input } from "~/components/ui/input";
import { pluralizePieceName } from "~/lib/seo-utils";
import { getOptimizedLogoUrl } from "~/utils/image-optimizer";
import { sanitizeAdvice } from "~/utils/sanitize-advice";

interface MotorisationItem {
  title: string;
  marque_name: string;
  modele_name: string;
  type_name: string;
  puissance: string;
  periode: string;
  image: string;
  link: string;
  description: string;
  advice: string;
}

interface MotorisationsSectionProps {
  motorisations?: {
    title: string;
    items: MotorisationItem[];
  };
  familleColor?: string;
  familleName?: string;
  totalCount?: number;
  compatibilitiesIntro?: string;
  /** R1 = routing only (pas de diagnostic/entretien dans les cartes) */
  variant?: "default" | "R1";
}

// Limite d'affichage par défaut (SEO: éviter dilution)
const VISIBLE_LIMIT = 12;

const MotorisationsSection = memo(function MotorisationsSection({
  motorisations,
  familleColor = "from-blue-950 via-indigo-900 to-purple-900",
  familleName = "pièces",
  totalCount,
  compatibilitiesIntro,
  variant = "default",
}: MotorisationsSectionProps) {
  const isR1 = variant === "R1";
  const [showAllVehicles, setShowAllVehicles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reset pagination quand la recherche change
  useEffect(() => {
    setShowAllVehicles(false);
  }, [searchQuery]);

  if (!motorisations?.items || motorisations.items.length === 0) {
    return null;
  }

  // Filtrage client-side par marque/modèle/type
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? motorisations.items.filter((m) =>
        `${m.marque_name} ${m.modele_name} ${m.type_name}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : motorisations.items;

  // Limiter l'affichage pour éviter la dilution SEO
  const vehiclesToDisplay = showAllVehicles
    ? filteredItems
    : filteredItems.slice(0, VISIBLE_LIMIT);
  const hasMore = filteredItems.length > VISIBLE_LIMIT;
  const hiddenCount = filteredItems.length - VISIBLE_LIMIT;

  return (
    <section className="bg-white rounded-2xl shadow-xl mb-8 overflow-hidden border border-gray-100">
      {/* Header avec gradient de la famille + décoration */}
      <div
        className={`relative bg-gradient-to-br ${familleColor} p-6 md:p-8 overflow-hidden`}
      >
        {/* Effet de brillance */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"></div>

        {/* Décoration géométrique */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Icône animée */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
              <Car className="w-7 h-7 text-white" />
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                {isR1 ? "Choisissez votre motorisation" : motorisations.title}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {compatibilitiesIntro ||
                  `Trouvez les ${pluralizePieceName(familleName.toLowerCase())} adaptées à votre véhicule`}
              </p>
            </div>
          </div>

          {/* Badge avec tendance */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg border border-white/20 w-fit">
            <TrendingUp className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">
              {totalCount || motorisations.items.length}
            </span>
            <span className="text-white/90 text-sm font-medium">
              motorisations
            </span>
          </div>
        </div>
      </div>

      {/* Grid de cartes - responsive et optimisé */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-gray-50/50 to-white">
        {/* Recherche motorisation */}
        {motorisations.items.length > 6 && (
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Rechercher marque ou modèle…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-200"
            />
          </div>
        )}

        {/* Aucun résultat */}
        {normalizedQuery && filteredItems.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Aucune motorisation trouvée pour &laquo;&nbsp;{searchQuery.trim()}
            &nbsp;&raquo;
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {vehiclesToDisplay.map((motorisation, index) => (
            <Link
              key={index}
              to={motorisation.link}
              className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Bordure gradient au hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${familleColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-xl`}
              ></div>
              <div className="absolute inset-0 bg-white m-0.5 rounded-lg group-hover:m-[3px] transition-all duration-300"></div>

              {/* Contenu */}
              <div className="relative p-5 md:p-6">
                <div className="flex items-start gap-4">
                  {/* Image agrandie avec effet hover */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${familleColor} rounded-xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-300`}
                      ></div>
                      <img
                        src={motorisation.image}
                        alt={`${motorisation.marque_name} ${motorisation.modele_name}`}
                        width={96}
                        height={96}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border-2 border-gray-100 group-hover:border-gray-200 group-hover:scale-110 transition-all duration-300 shadow-md"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const img = e.currentTarget;
                          // Fallback: image modèle → logo marque → placeholder
                          if (!img.dataset.fallbackUsed) {
                            img.dataset.fallbackUsed = "true";
                            // Extraire marque_alias depuis l'URL
                            const brandAlias = motorisation.image.match(
                              /marques-modeles\/([^/]+)\//,
                            )?.[1];
                            if (brandAlias) {
                              img.src = getOptimizedLogoUrl(
                                `${brandAlias}.webp`,
                              );
                            } else {
                              img.src = "/images/categories/default.svg";
                            }
                          } else {
                            img.src = "/images/categories/default.svg";
                            img.onerror = null;
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Informations */}
                  <div className="flex-1 min-w-0">
                    {/* Titre avec meilleure hiérarchie */}
                    <h3 className="font-bold text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-all duration-300 mb-2.5 text-base sm:text-lg leading-tight">
                      {isR1
                        ? `${motorisation.marque_name} ${motorisation.modele_name}`
                        : motorisation.title ||
                          `${motorisation.marque_name} ${motorisation.modele_name}`}
                    </h3>

                    {/* Badges avec meilleur spacing */}
                    <div className="flex items-center gap-2 flex-wrap mb-2.5">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${familleColor} text-white shadow-sm`}
                      >
                        {motorisation.type_name}
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm">
                        {motorisation.puissance}
                      </div>
                    </div>

                    {/* Période plus visible */}
                    <p className="text-sm text-gray-600 mb-3 font-medium">
                      📅 {motorisation.periode}
                    </p>

                    {/* Conseil SEO (fragment2 du backend, sanitized) — masqué en R1 */}
                    {!isR1 &&
                      (() => {
                        const cleanAdvice = motorisation.advice
                          ? sanitizeAdvice(motorisation.advice)
                          : null;
                        return cleanAdvice ? (
                          <p className="text-xs text-indigo-700 bg-indigo-50 rounded px-2 py-1 mb-2 line-clamp-1">
                            Conseil : {cleanAdvice}
                          </p>
                        ) : null;
                      })()}

                    {/* Description — neutre en R1, enrichie en default */}
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">
                      {isR1
                        ? "Sélectionnez cette motorisation pour afficher les références compatibles."
                        : motorisation.description ||
                          `${pluralizePieceName(familleName.toLowerCase()).replace(/^./, (c) => c.toUpperCase())} compatibles avec votre ${motorisation.marque_name} ${motorisation.modele_name} ${motorisation.type_name}. Sélectionnez l'essieu (avant/arrière) pour afficher les références disponibles.`}
                    </p>

                    {/* CTA amélioré */}
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r ${familleColor} text-white font-bold text-sm shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:scale-105`}
                    >
                      <span>Voir les pièces</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bouton "Voir plus" pour éviter scroll infini SEO */}
        {hasMore && (
          <div className="mt-8 text-center border-t border-gray-200 pt-6">
            <button
              onClick={() => setShowAllVehicles(!showAllVehicles)}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${familleColor} text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}
            >
              {showAllVehicles ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  <span>Masquer les véhicules</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5" />
                  <span>Voir les {hiddenCount} autres compatibilités</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

export default MotorisationsSection;
