/**
 * BlogInternalLinks — Mini sitemap thématique en bas de page (SEO)
 * Grille de liens internes vers les sous-sections du blog
 */
import { Link } from "@remix-run/react";

const PRODUCT_FAMILIES = [
  { name: "Freinage", href: "/blog-pieces-auto/conseils/plaquette-de-frein" },
  { name: "Embrayage", href: "/blog-pieces-auto/conseils/kit-embrayage" },
  { name: "Alternateur", href: "/blog-pieces-auto/conseils/alternateur" },
  { name: "Amortisseurs", href: "/blog-pieces-auto/conseils/amortisseur" },
  {
    name: "Courroie distribution",
    href: "/blog-pieces-auto/conseils/kit-de-distribution",
  },
  { name: "Démarreur", href: "/blog-pieces-auto/conseils/demarreur" },
  { name: "Turbo", href: "/blog-pieces-auto/conseils/turbo" },
  { name: "Pompe à eau", href: "/blog-pieces-auto/conseils/pompe-a-eau" },
  {
    name: "Filtre à particules",
    href: "/blog-pieces-auto/conseils/filtre-a-particules",
  },
  { name: "Vanne EGR", href: "/blog-pieces-auto/conseils/vanne-egr" },
  { name: "Injecteur", href: "/blog-pieces-auto/conseils/injecteur" },
  { name: "Volant moteur", href: "/blog-pieces-auto/conseils/volant-moteur" },
];

const TOP_BRANDS = [
  { name: "Renault", href: "/blog-pieces-auto/auto/renault" },
  { name: "Peugeot", href: "/blog-pieces-auto/auto/peugeot" },
  { name: "Citroën", href: "/blog-pieces-auto/auto/citroen" },
  { name: "Volkswagen", href: "/blog-pieces-auto/auto/volkswagen" },
  { name: "BMW", href: "/blog-pieces-auto/auto/bmw" },
  { name: "Mercedes", href: "/blog-pieces-auto/auto/mercedes-benz" },
  { name: "Audi", href: "/blog-pieces-auto/auto/audi" },
  { name: "Ford", href: "/blog-pieces-auto/auto/ford" },
  { name: "Opel", href: "/blog-pieces-auto/auto/opel" },
  { name: "Toyota", href: "/blog-pieces-auto/auto/toyota" },
  { name: "Fiat", href: "/blog-pieces-auto/auto/fiat" },
  { name: "Hyundai", href: "/blog-pieces-auto/auto/hyundai" },
];

const SECTIONS = [
  { name: "Conseils montage", href: "/blog-pieces-auto/conseils" },
  { name: "Guides d'achat", href: "/blog-pieces-auto/guide-achat" },
  { name: "Constructeurs", href: "/blog-pieces-auto/auto" },
  { name: "Glossaire auto", href: "/reference-auto" },
];

export function BlogInternalLinks() {
  return (
    <section className="py-12 bg-gray-50 border-t">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Explorer le blog
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Guides par pièce */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Guides par pièce
              </h3>
              <ul className="space-y-1.5">
                {PRODUCT_FAMILIES.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      prefetch="intent"
                      className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Par constructeur */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Par constructeur
              </h3>
              <ul className="space-y-1.5">
                {TOP_BRANDS.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      prefetch="intent"
                      className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Sections
              </h3>
              <ul className="space-y-1.5">
                {SECTIONS.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      prefetch="intent"
                      className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>

              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6">
                Catalogue
              </h3>
              <ul className="space-y-1.5">
                <li>
                  <Link
                    to="/pieces"
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    Toutes les pièces auto
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pieces/freinage"
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    Pièces de freinage
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pieces/embrayage"
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    Kits embrayage
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
