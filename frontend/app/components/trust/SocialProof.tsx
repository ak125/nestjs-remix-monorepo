/**
 * 📊 SocialProof - Compteurs sociaux pour persuasion
 *
 * Affiche:
 * - Nombre de ventes
 * - Nombre d'avis
 * - Note moyenne avec étoiles
 * - Pourcentage de recommandation
 */

import { Star, ShoppingCart, MessageSquare, ThumbsUp } from "lucide-react";
import { memo } from "react";
import { cn } from "~/lib/utils";

interface SocialProofProps {
  soldCount?: number;
  reviewCount?: number;
  rating?: number;
  recommendationRate?: number;
  variant?: "full" | "compact" | "inline";
  className?: string;
}

export const SocialProof = memo(function SocialProof({
  soldCount,
  reviewCount,
  rating,
  recommendationRate,
  variant = "full",
  className,
}: SocialProofProps) {
  if (variant === "inline") {
    return (
      <div className={cn("inline-flex items-center gap-3 text-sm", className)}>
        {rating && (
          <div className="flex items-center gap-1">
            <StarRating rating={rating} size="sm" />
            <span className="font-medium">{rating.toFixed(1)}</span>
          </div>
        )}
        {reviewCount && (
          <span className="text-gray-600">({reviewCount} avis)</span>
        )}
        {soldCount && <span className="text-gray-600">{soldCount} vendus</span>}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-4 text-sm", className)}>
        {rating && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={rating} size="sm" />
            <span className="font-semibold">{rating.toFixed(1)}</span>
            {reviewCount && (
              <span className="text-gray-500">({reviewCount})</span>
            )}
          </div>
        )}
        {soldCount && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <ShoppingCart className="w-4 h-4" />
            <span>{soldCount} vendus</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn("space-y-3", className)}>
      {/* Rating avec étoiles */}
      {rating && (
        <div className="flex items-center gap-2">
          <StarRating rating={rating} />
          <span className="text-lg font-bold">{rating.toFixed(1)}/5</span>
          {reviewCount && (
            <span className="text-sm text-gray-500">({reviewCount} avis)</span>
          )}
        </div>
      )}

      {/* Compteurs */}
      <div className="flex gap-4">
        {soldCount && (
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 bg-blue-50 rounded">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold">{formatNumber(soldCount)}</div>
              <div className="text-xs text-gray-500">vendus</div>
            </div>
          </div>
        )}

        {reviewCount && (
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 bg-green-50 rounded">
              <MessageSquare className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <div className="font-semibold">{formatNumber(reviewCount)}</div>
              <div className="text-xs text-gray-500">avis</div>
            </div>
          </div>
        )}

        {recommendationRate && (
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 bg-purple-50 rounded">
              <ThumbsUp className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold">{recommendationRate}%</div>
              <div className="text-xs text-gray-500">recommandent</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * StarRating - Affichage étoiles
 */
interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const StarRating = memo(function StarRating({
  rating,
  size = "md",
  className,
}: StarRatingProps) {
  const stars = 5;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: stars }).map((_, i) => {
        const isFull = i < fullStars;
        const isHalf = i === fullStars && hasHalfStar;

        return (
          <div key={i} className="relative">
            {/* Empty star */}
            <Star className={cn(sizeClasses[size], "text-gray-300")} />

            {/* Filled star */}
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: isHalf ? "50%" : "100%" }}
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    "text-yellow-400 fill-yellow-400",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

/**
 * Formater les nombres (1234 → 1,2k)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}
