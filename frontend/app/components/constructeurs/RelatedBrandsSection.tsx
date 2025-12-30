/**
 * RelatedBrandsSection - Composant de maillage interne pour marques associées
 *
 * Affiche les marques du même pays ou continent pour renforcer le maillage SEO.
 * Les textes d'ancrage sont variés pour un SEO naturel.
 *
 * @author Automecanik SEO Team
 */
import { Link } from "@remix-run/react";

import { type RelatedBrand } from "~/types/brand.types";

interface RelatedBrandsSectionProps {
  brands: RelatedBrand[];
  currentBrandName: string;
  currentBrandCountry?: string;
  className?: string;
  onLinkClick?: (brand: RelatedBrand, anchorText: string) => void;
}

/**
 * Génère un texte d'ancrage varié pour éviter la sur-optimisation SEO
 */
function getAnchorText(brand: RelatedBrand, index: number): string {
  const variations = [
    `Pièces ${brand.marque_name}`,
    `Pièces auto ${brand.marque_name}`,
    `${brand.marque_name}`,
    `Catalogue ${brand.marque_name}`,
    `Pièces détachées ${brand.marque_name}`,
    `Accessoires ${brand.marque_name}`,
  ];

  // Rotation basée sur l'index pour varier naturellement
  return variations[index % variations.length];
}

/**
 * Titre de section contextuel basé sur le pays/origine
 */
function getSectionTitle(currentBrandName: string, country?: string): string {
  if (!country) {
    return "Autres marques automobiles";
  }

  const countryTitles: Record<string, string> = {
    France: "Autres marques françaises",
    Allemagne: "Autres marques allemandes",
    Italie: "Autres marques italiennes",
    Japon: "Autres marques japonaises",
    "Corée du Sud": "Autres marques coréennes",
    "États-Unis": "Autres marques américaines",
    "Royaume-Uni": "Autres marques britanniques",
    Espagne: "Autres marques espagnoles",
    Suède: "Autres marques suédoises",
    "République tchèque": "Autres marques européennes",
    Roumanie: "Autres marques européennes",
  };

  return countryTitles[country] || "Marques associées";
}

/**
 * Génère l'URL du logo depuis le nom de fichier avec cache 1 an
 */
function getLogoUrl(logoFilename: string | null): string | undefined {
  if (!logoFilename) return undefined;
  return `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/constructeurs-automobiles/marques-logos/${logoFilename}?width=64&quality=90&t=31536000`;
}

export function RelatedBrandsSection({
  brands,
  currentBrandName,
  currentBrandCountry,
  className = "",
  onLinkClick,
}: RelatedBrandsSectionProps) {
  // Ne pas afficher si aucune marque
  if (!brands || brands.length === 0) {
    return null;
  }

  const sectionTitle = getSectionTitle(currentBrandName, currentBrandCountry);

  return (
    <section
      className={`py-8 md:py-12 bg-gray-50 ${className}`}
      aria-labelledby="related-brands-title"
    >
      <div className="container mx-auto px-4">
        {/* En-tête de section */}
        <header className="mb-6 md:mb-8">
          <h2
            id="related-brands-title"
            className="text-xl md:text-2xl font-bold text-gray-900"
          >
            {sectionTitle}
          </h2>
          <p className="mt-2 text-sm md:text-base text-gray-600">
            Découvrez également nos pièces détachées pour les autres
            constructeurs automobiles
          </p>
        </header>

        {/* Grille de marques - Mobile First */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {brands.map((brand, index) => {
            const anchorText = getAnchorText(brand, index);
            const logoUrl = getLogoUrl(brand.marque_logo);

            return (
              <article
                key={brand.marque_id}
                className="group animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Link
                  to={brand.link || `/constructeurs/${brand.marque_alias}.html`}
                  prefetch="intent"
                  onClick={() => onLinkClick?.(brand, anchorText)}
                  className="flex flex-col items-center p-3 md:p-4 bg-white rounded-lg border border-gray-200 
                           hover:border-red-300 hover:shadow-md transition-all duration-200
                           focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label={`Voir les pièces détachées ${brand.marque_name}`}
                >
                  {/* Logo de la marque */}
                  <div className="w-12 h-12 md:w-16 md:h-16 mb-2 md:mb-3 flex items-center justify-center">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`Logo ${brand.marque_name}`}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                        loading="lazy"
                        width={64}
                        height={64}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-lg md:text-xl font-bold text-gray-400">
                          {brand.marque_name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Texte d'ancrage varié */}
                  <span
                    className="text-xs md:text-sm font-medium text-gray-700 text-center 
                                  group-hover:text-red-600 transition-colors line-clamp-2"
                  >
                    {anchorText}
                  </span>

                  {/* Indicateur de pays (optionnel) */}
                  {brand.marque_country && (
                    <span className="mt-1 text-[10px] md:text-xs text-gray-400">
                      {brand.marque_country}
                    </span>
                  )}
                </Link>
              </article>
            );
          })}
        </div>

        {/* Données structurées Schema.org pour le maillage */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: sectionTitle,
              numberOfItems: brands.length,
              itemListElement: brands.map((brand, index) => ({
                "@type": "ListItem",
                position: index + 1,
                item: {
                  "@type": "Brand",
                  name: brand.marque_name,
                  url: `https://www.automecanik.com${brand.link}`,
                  ...(brand.marque_logo && {
                    logo: getLogoUrl(brand.marque_logo),
                  }),
                },
              })),
            }),
          }}
        />
      </div>
    </section>
  );
}

export default RelatedBrandsSection;
