/**
 * PopularGammesSection - Composant de maillage interne pour gammes populaires
 *
 * Affiche les catégories de pièces les plus populaires pour la marque.
 * Optimisé pour le SEO avec textes d'ancrage variés et données structurées.
 *
 * @author Automecanik SEO Team
 */
import { Link } from "@remix-run/react";

import { type PopularGamme } from "~/types/brand.types";

interface PopularGammesSectionProps {
  gammes: PopularGamme[];
  brandName: string;
  brandAlias: string;
  brandId: number;
  className?: string;
  onLinkClick?: (gamme: PopularGamme, anchorText: string) => void;
}

/**
 * Icônes par type de gamme (fallback si pas d'image)
 */
const GAMME_ICONS: Record<string, string> = {
  freinage: "🔴",
  plaquette: "🔴",
  disque: "💿",
  filtration: "🔧",
  filtre: "🔧",
  huile: "🛢️",
  vidange: "🛢️",
  embrayage: "⚙️",
  suspension: "🔩",
  amortisseur: "🔩",
  eclairage: "💡",
  phare: "💡",
  courroie: "🔗",
  distribution: "🔗",
  batterie: "🔋",
  demarrage: "🔋",
  echappement: "💨",
  default: "🔧",
};

/**
 * Obtient l'icône appropriée pour une gamme
 */
function getGammeIcon(gammeName: string): string {
  const lowerName = gammeName.toLowerCase();
  for (const [key, icon] of Object.entries(GAMME_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return GAMME_ICONS.default;
}

/**
 * Génère des textes d'ancrage variés pour le SEO
 */
function getAnchorText(
  gamme: PopularGamme,
  brandName: string,
  index: number,
): string {
  const variations = [
    `${gamme.pg_name} ${brandName}`,
    `${gamme.pg_name} pour ${brandName}`,
    `Kit ${gamme.pg_name.toLowerCase()} ${brandName}`,
    `${gamme.pg_name}`,
    `Pièces ${gamme.pg_name.toLowerCase()} ${brandName}`,
    `${brandName} ${gamme.pg_name.toLowerCase()}`,
  ];

  return variations[index % variations.length];
}

/**
 * Génère une description courte pour l'accessibilité
 */
function getDescription(gamme: PopularGamme, brandName: string): string {
  // Utilise l'anchor comme description si disponible
  if (gamme.anchor) {
    return gamme.anchor;
  }

  return `${gamme.pg_name} ${brandName} - Pièces de qualité`;
}

/**
 * Génère l'URL de l'image de gamme
 * ✅ Migration /img/* : Proxy Caddy avec cache 1 an
 */
function getGammeImageUrl(imgFilename: string | null): string | undefined {
  if (!imgFilename) return undefined;
  return `/img/uploads/articles/gammes-produits/catalogue/${imgFilename}`;
}

export function PopularGammesSection({
  gammes,
  brandName,
  brandAlias: _brandAlias,
  brandId: _brandId,
  className = "",
  onLinkClick,
}: PopularGammesSectionProps) {
  // Ne pas afficher si aucune gamme
  if (!gammes || gammes.length === 0) {
    return null;
  }

  return (
    <section
      className={`py-8 md:py-12 ${className}`}
      aria-labelledby="popular-gammes-title"
    >
      <div className="container mx-auto px-4">
        {/* En-tête de section */}
        <header className="mb-6 md:mb-8">
          <h2
            id="popular-gammes-title"
            className="text-xl md:text-2xl font-bold text-gray-900"
          >
            Pièces détachées populaires {brandName}
          </h2>
          <p className="mt-2 text-sm md:text-base text-gray-600">
            Les catégories de pièces les plus recherchées pour votre véhicule{" "}
            {brandName}
          </p>
        </header>

        {/* Grille des gammes - Mobile First */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {gammes.map((gamme, index) => {
            const anchorText = getAnchorText(gamme, brandName, index);
            const description = getDescription(gamme, brandName);
            const icon = getGammeIcon(gamme.pg_name);
            const imageUrl = getGammeImageUrl(gamme.pg_img);

            // Construit l'URL vers la page gamme (format: /pieces/{alias}-{id}.html)
            const gammeUrl =
              gamme.link || `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`;

            return (
              <article
                key={gamme.pg_id}
                className="group animate-in fade-in zoom-in-95 duration-300 fill-mode-both"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Link
                  to={gammeUrl}
                  prefetch="intent"
                  onClick={() => onLinkClick?.(gamme, anchorText)}
                  className="flex items-start p-4 md:p-5 bg-white rounded-xl border border-gray-200 
                           hover:border-red-300 hover:shadow-lg transition-all duration-200
                           focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label={description}
                >
                  {/* Image ou icône */}
                  <div
                    className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 mr-3 md:mr-4 
                                rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={gamme.pg_name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        loading="lazy"
                        width={64}
                        height={64}
                      />
                    ) : (
                      <span
                        className="text-2xl md:text-3xl"
                        role="img"
                        aria-hidden="true"
                      >
                        {icon}
                      </span>
                    )}
                  </div>

                  {/* Contenu textuel */}
                  <div className="flex-1 min-w-0">
                    {/* Texte d'ancrage principal */}
                    <h3
                      className="text-sm md:text-base font-semibold text-gray-900 
                                  group-hover:text-red-600 transition-colors line-clamp-2"
                    >
                      {anchorText}
                    </h3>

                    {/* Sous-titre avec texte d'ancre SEO */}
                    {gamme.anchor && (
                      <p className="mt-1 text-xs md:text-sm text-gray-500 line-clamp-2">
                        {gamme.anchor}
                      </p>
                    )}

                    {/* Indicateur visuel de lien */}
                    <span
                      className="inline-flex items-center mt-2 text-xs font-medium text-red-600 
                                    group-hover:translate-x-1 transition-transform"
                    >
                      Voir les pièces
                      <svg
                        className="w-3 h-3 ml-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default PopularGammesSection;
