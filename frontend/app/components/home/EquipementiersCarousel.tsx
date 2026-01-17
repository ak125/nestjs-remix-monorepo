import { useMemo } from "react";

import { type Equipementier } from "../../types/catalog.types";

interface EquipementiersCarouselProps {
  equipementiersData: {
    data?: Equipementier[];
    stats?: { total_equipementiers: number };
    success?: boolean;
  } | null;
  className?: string;
  title?: string;
}

/**
 * Composant EquipementiersCarousel - Reproduit la section 6 PHP
 * Affiche les fournisseurs équipementiers de la table PIECES_MARQUE
 * Basé sur: SELECT DISTINCT pm_name, pm_id FROM pieces_marque
 */
export function EquipementiersCarousel({
  equipementiersData,
  className = "",
  title: _title = "Nos partenaires équipementiers",
}: EquipementiersCarouselProps) {
  // Extraire les équipementiers
  const equipementiers = useMemo(() => {
    if (!equipementiersData?.data) return [];
    return equipementiersData.data;
  }, [equipementiersData]);

  // Si pas d'équipementiers, ne rien afficher
  if (equipementiers.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête de section - Compact */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Nos partenaires{" "}
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              équipementiers
            </span>
          </h2>
          <div className="h-0.5 w-16 bg-gradient-to-r from-purple-500 to-pink-600 mx-auto rounded mb-3"></div>
        </div>

        {/* Carousel des équipementiers */}
        <div className="relative">
          {/* Container avec scroll horizontal pour mobile */}
          <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide lg:grid lg:grid-cols-8 lg:gap-4 lg:overflow-visible lg:pb-0">
            {equipementiers.slice(0, 24).map((equipementier) => {
              // Construire le nom du fichier logo depuis pm_name
              // Ex: "BOSCH" → "bosch.webp", "MANN FILTER" → "mann-filter.webp"
              const logoFileName =
                equipementier.pm_name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "") + ".webp";

              // URL du logo depuis Supabase Storage (sans transformation, $0)
              const logoUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${logoFileName}`;

              return (
                <div
                  key={equipementier.pm_id}
                  className="flex-shrink-0 w-24 lg:w-auto bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 group border border-gray-200 hover:border-purple-300"
                >
                  {/* Logo équipementier */}
                  <div className="p-3">
                    <div className="aspect-square bg-gradient-to-br from-gray-50 to-slate-100 rounded-md flex items-center justify-center overflow-hidden">
                      <img
                        src={logoUrl}
                        alt={`Logo ${equipementier.pm_name}`}
                        width={100}
                        height={100}
                        className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          // Fallback SVG avec le nom de la marque
                          target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' font-size='10' font-weight='bold' fill='%2364748b'%3E${encodeURIComponent(equipementier.pm_name)}%3C/text%3E%3C/svg%3E`;
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EquipementiersCarousel;
