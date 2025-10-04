/**
 * 🎨 CAROUSEL LOGOS DE MARQUES
 * 
 * Composant pour afficher les logos des marques automobiles
 * Réplique la section PHP "Marques les plus consultées"
 */

import { Link } from "@remix-run/react";

interface Brand {
  id: number;
  alias: string;
  name: string;
  name_meta: string;
  name_title: string;
  logo_url: string | null;
  url: string;
  is_active: boolean;
}

interface BrandLogosCarouselProps {
  brands: Brand[];
  title?: string;
  columns?: number;
}

export function BrandLogosCarousel({
  brands,
  title = "🏭 Marques automobiles",
  columns = 6,
}: BrandLogosCarouselProps) {
  if (brands.length === 0) {
    return null;
  }

  const gridColsClass = {
    4: "grid-cols-2 md:grid-cols-4",
    6: "grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    8: "grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  }[columns] || "grid-cols-3 md:grid-cols-4 lg:grid-cols-6";

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-600 mt-1">
          Sélectionnez votre marque pour voir tous les modèles
        </p>
      </div>

      {/* Grid de logos */}
      <div className={`grid ${gridColsClass} gap-4`}>
        {brands.map((brand) => (
          <Link
            key={brand.id}
            to={brand.url}
            className="group block"
            prefetch="intent"
            title={brand.name_title}
          >
            <div className="relative p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all">
              {/* Logo container */}
              <div className="aspect-square flex items-center justify-center">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={`Logo ${brand.name}`}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback si logo manquant
                      e.currentTarget.src =
                        "https://via.placeholder.com/100x100?text=" +
                        encodeURIComponent(brand.name);
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-600">
                      {brand.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Nom (optionnel, visible au hover) */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-b-lg">
                <p className="text-xs text-white text-center font-medium truncate">
                  {brand.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-8 text-center">
        <Link
          to="/manufacturers"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          Voir toutes les marques
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
