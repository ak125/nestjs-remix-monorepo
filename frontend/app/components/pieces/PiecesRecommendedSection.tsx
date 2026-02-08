/**
 * PiecesRecommendedSection - Section recommandations avec SEO switches
 *
 * Affiche les pièces recommandées (OES, 4+ étoiles) avec:
 * - Titre dynamique utilisant les verbes SEO switches
 * - Anchor text varié pour chaque pièce
 * - Grille responsive 3 colonnes
 */

import { Star } from "lucide-react";
import { useMemo, memo } from "react";

import {
  type GammeData,
  type PieceData,
  type VehicleData,
} from "../../types/pieces-route.types";

interface SeoSwitches {
  verbs?: Array<{ id: number; content: string }>;
  verbCount?: number;
}

interface PiecesRecommendedSectionProps {
  pieces: PieceData[];
  visible: boolean;
  seoSwitches?: SeoSwitches;
  gamme: GammeData;
  vehicle: VehicleData;
}

// Verbes par défaut si pas de SEO switches
const DEFAULT_VERBS = ["Découvrir", "Explorer", "Voir", "Consulter"];

// Suffixes pour les anchor texts des pièces
const PIECE_SUFFIXES = ["cette pièce", "les détails", "l'offre", "le produit"];

/**
 * Génère un verbe dynamique depuis les SEO switches ou fallback
 */
function getVerb(seoSwitches: SeoSwitches | undefined, index: number): string {
  if (seoSwitches?.verbs?.length) {
    const verb = seoSwitches.verbs[index % seoSwitches.verbs.length]?.content;
    if (verb) {
      return verb.charAt(0).toUpperCase() + verb.slice(1);
    }
  }
  return DEFAULT_VERBS[index % DEFAULT_VERBS.length];
}

/**
 * Génère un anchor text dynamique pour une pièce
 */
function getPieceAnchorText(
  seoSwitches: SeoSwitches | undefined,
  index: number,
): string {
  const verb = getVerb(seoSwitches, index + 1); // Offset pour varier
  const suffix = PIECE_SUFFIXES[index % PIECE_SUFFIXES.length];
  return `${verb} ${suffix}`;
}

export const PiecesRecommendedSection = memo(function PiecesRecommendedSection({
  pieces,
  visible,
  seoSwitches,
  gamme,
  vehicle,
}: PiecesRecommendedSectionProps) {
  // Titre dynamique avec verbe SEO
  const title = useMemo(() => {
    const verb = getVerb(seoSwitches, 0);
    return `${verb} nos ${gamme.name} ${vehicle.marque}`;
  }, [seoSwitches, gamme.name, vehicle.marque]);

  // Ne pas afficher si pas visible ou pas de pièces
  if (!visible || pieces.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
      <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 fill-current" />
        {title}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pieces.map((piece, index) => (
          <div
            key={piece.id}
            className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="font-medium text-gray-900 mb-1 line-clamp-2">
              {piece.name}
            </div>
            <div className="text-sm text-gray-600 mb-2">{piece.brand}</div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-blue-600">
                {piece.priceFormatted}€
              </div>
              <span className="text-xs text-orange-600 font-medium">
                {getPieceAnchorText(seoSwitches, index)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
