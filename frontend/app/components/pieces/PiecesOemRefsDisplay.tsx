/**
 * 🔧 Affichage des références OEM constructeur
 * Composant SEO pour afficher les refs OEM filtrées par plateforme véhicule
 *
 * NOTE: La déduplication avec normalisation est maintenant faite côté backend
 * (OemPlatformMappingService.deduplicateOemRefs). Ce composant ne fait plus
 * que le groupage par préfixe pour l'affichage.
 */

import React, { useState, memo } from "react";
import { type OemRefsData } from "../../types/pieces-route.types";

interface PiecesOemRefsDisplayProps {
  oemRefs?: OemRefsData;
  oemRefsSeo?: string[];
  gammeName: string;
}

/**
 * Affiche les références OEM constructeur pour le SEO
 * Utilise les refs filtrées (oemRefsSeo) par défaut pour un affichage optimisé
 */
export const PiecesOemRefsDisplay = memo(function PiecesOemRefsDisplay({
  oemRefs,
  oemRefsSeo,
  gammeName,
}: PiecesOemRefsDisplayProps) {
  const [showAll, setShowAll] = useState(false);

  // Pas de données OEM à afficher
  if (!oemRefs?.oemRefs?.length && !oemRefsSeo?.length) {
    return null;
  }

  const marque = oemRefs?.vehicleMarque || "Constructeur";

  // Les refs sont déjà dédupliquées côté backend
  const allRefs = oemRefs?.oemRefs || [];

  const refsToDisplay = showAll ? allRefs : oemRefsSeo || allRefs.slice(0, 20);

  const totalRefs = allRefs.length;
  const displayedCount = refsToDisplay.length;
  const hasMore = !showAll && totalRefs > displayedCount;

  // Grouper les refs par préfixe pour un affichage organisé
  const groupedRefs = groupRefsByPrefix(refsToDisplay);

  return (
    <div className="bg-gradient-to-r from-blue-50 rounded-xl border border-blue-100 overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Références OEM {marque}
              </h3>
              <p className="text-sm text-blue-100">
                {displayedCount} référence{displayedCount > 1 ? "s" : ""}{" "}
                origine pour {gammeName.toLowerCase()}
              </p>
            </div>
          </div>

          {/* Badge marque */}
          <span className="bg-white/20 text-white text-sm font-medium px-3 py-1 rounded-full">
            {marque}
          </span>
        </div>
      </div>

      {/* Contenu - Refs groupées par préfixe */}
      <div className="p-6">
        <div className="space-y-4">
          {Object.entries(groupedRefs).map(([prefix, refs]) => (
            <div key={prefix} className="space-y-2">
              {/* Label préfixe si plusieurs groupes */}
              {Object.keys(groupedRefs).length > 1 && (
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  Série {prefix}
                </span>
              )}

              {/* Tags des références */}
              <div className="flex flex-wrap gap-2">
                {refs.map((ref, index) => (
                  <span
                    key={`${ref}-${index}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-mono bg-white border border-blue-200 text-blue-900 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    title={`Référence OEM ${marque}`}
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bouton "Voir plus" */}
        {hasMore && (
          <div className="mt-4 pt-4 border-t border-blue-100">
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              {showAll ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                  Afficher moins
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  Voir les {totalRefs - displayedCount} autres références
                </>
              )}
            </button>
          </div>
        )}

        {/* Note SEO */}
        <p className="mt-4 text-xs text-gray-500">
          Ces références d'origine {marque} sont compatibles avec les{" "}
          {gammeName.toLowerCase()} proposées sur cette page. Vérifiez la
          correspondance avec la référence de votre pièce d'origine.
        </p>
      </div>
    </div>
  );
});

/**
 * Groupe les références par préfixe (3 premiers caractères)
 */
function groupRefsByPrefix(refs: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const ref of refs) {
    // Extraire préfixe (3 premiers chars alphanumériques)
    const cleanRef = ref.trim().toUpperCase().replace(/[\s-]/g, "");
    const prefix = cleanRef.length >= 3 ? cleanRef.substring(0, 3) : "AUTRES";

    if (!groups[prefix]) {
      groups[prefix] = [];
    }
    groups[prefix].push(ref);
  }

  // Trier par nombre de refs décroissant
  const sortedEntries = Object.entries(groups).sort(
    (a, b) => b[1].length - a[1].length,
  );

  return Object.fromEntries(sortedEntries);
}

export default PiecesOemRefsDisplay;
