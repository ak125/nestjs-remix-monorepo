/**
 * ⭐ Composant d'affichage d'étoiles de notation
 * Utilisé pour noter la qualité des pièces/marques
 */

import React from 'react';

interface StarRatingProps {
  /** Note sur 5 (peut être décimale ex: 4.5) */
  rating: number;
  /** Taille des étoiles */
  size?: 'sm' | 'md' | 'lg';
  /** Afficher le nombre après les étoiles */
  showNumber?: boolean;
  /** Couleur personnalisée */
  color?: string;
  /** Classe CSS supplémentaire */
  className?: string;
}

export function StarRating({
  rating,
  size = 'md',
  showNumber = false,
  color = '#fbbf24',
  className = '',
}: StarRatingProps) {
  // Normaliser entre 0 et 5
  const normalizedRating = Math.max(0, Math.min(5, rating));
  
  // Calcul des étoiles pleines, demi-étoiles, vides
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  // Tailles selon prop
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const sizeClass = sizeClasses[size];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center">
        {/* Étoiles pleines */}
        {[...Array(fullStars)].map((_, i) => (
          <svg
            key={`full-${i}`}
            className={sizeClass}
            fill={color}
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}

        {/* Demi-étoile */}
        {hasHalfStar && (
          <svg
            className={sizeClass}
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="half">
                <stop offset="50%" stopColor={color} />
                <stop offset="50%" stopColor="#d1d5db" stopOpacity="1" />
              </linearGradient>
            </defs>
            <path
              fill="url(#half)"
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
        )}

        {/* Étoiles vides */}
        {[...Array(emptyStars)].map((_, i) => (
          <svg
            key={`empty-${i}`}
            className={sizeClass}
            fill="#d1d5db"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>

      {/* Affichage du nombre */}
      {showNumber && (
        <span className="text-sm text-gray-600 font-medium">
          {normalizedRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

/** Composant compact pour afficher juste les étoiles avec le nombre */
export function CompactStarRating({ rating }: { rating: number }) {
  return (
    <StarRating
      rating={rating}
      size="sm"
      showNumber
      className="inline-flex"
    />
  );
}
