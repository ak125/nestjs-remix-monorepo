import { Link } from "@remix-run/react";
import { ChevronRight, Star } from "lucide-react";
import { useMemo } from "react";

import { type TopGamme } from "../../types/catalog.types";

interface TopGammesProps {
  topGammesData: {
    data?: TopGamme[];
    stats?: { total_top_gammes: number };
    success?: boolean;
  } | null;
  className?: string;
  title?: string;
}

/**
 * Composant TopGammes - Reproduit la section 4 PHP
 * Affiche les gammes avec PG_TOP=1 en carousel
 * Basé sur: SELECT DISTINCT pg_name, pg_alias, pg_id FROM pieces_gamme WHERE pg_top = 1
 */
export function TopGammes({
  topGammesData,
  className = "",
  title: _title = "Nos gammes les plus populaires",
}: TopGammesProps) {
  // Extraire les gammes TOP
  const topGammes = useMemo(() => {
    if (!topGammesData?.data) return [];
    return topGammesData.data;
  }, [topGammesData]);

  // Si pas de gammes TOP, ne rien afficher
  if (topGammes.length === 0) {
    return null;
  }

  return (
    <section
      className={`py-12 bg-gradient-to-br from-slate-50 via-white to-orange-50 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête de section - Plus compact */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Nos gammes les plus{" "}
            <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              populaires
            </span>
          </h2>
          <div className="h-0.5 w-16 bg-gradient-to-r from-orange-500 to-red-600 mx-auto rounded mb-3"></div>
        </div>

        {/* Grid compacte des gammes TOP - Toutes les 26 gammes pour SEO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
          {topGammes.map((gamme, index) => {
            // URL vers la page gamme
            const gammeUrl = `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`;

            // Image de gamme depuis Supabase Storage avec cache 1 an
            const imageFileName = gamme.pg_img || "default.webp";
            const gammeImageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/articles/gammes-produits/catalogue/${imageFileName}?width=200&quality=85&t=31536000`;

            return (
              <Link
                key={gamme.pg_id}
                to={gammeUrl}
                className="group relative bg-white rounded-xl border-2 border-gray-100 hover:border-orange-400 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                {/* Badge top position */}
                {index < 3 && (
                  <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Top {index + 1}
                  </div>
                )}

                {/* Image avec fond dégradé élégant */}
                <div className="relative aspect-square bg-gradient-to-br from-slate-50 via-white to-orange-50 overflow-hidden">
                  <img
                    src={gammeImageUrl}
                    alt={gamme.pg_name}
                    width={200}
                    height={200}
                    className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23f8fafc" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" font-size="48" fill="%23cbd5e1"%3E📦%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  {/* Overlay subtil au survol */}
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Titre avec fond léger */}
                <div className="p-3 bg-gradient-to-b from-white to-slate-50">
                  <h3 className="text-xs font-semibold text-gray-800 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug text-center">
                    {gamme.pg_name}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA vers catalogue complet - avec scroll */}
        <div className="text-center mt-6">
          <a
            href="#catalogue"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("catalogue")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
          >
            Voir tout le catalogue
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

export default TopGammes;
