import { Link, useLocation, useParams } from "@remix-run/react";
import { Wrench, BookOpen, Car, Home } from "lucide-react";
import { cn } from "~/lib/utils";

// Fonction pour formater un slug en nom lisible
function formatSlugToName(slug: string): string {
  if (!slug) return "";
  // Cas spéciaux pour les marques connues (uppercase)
  const upperCaseBrands = ["bmw", "kia", "mg", "ds", "tvr", "audi", "vw"];
  if (upperCaseBrands.includes(slug.toLowerCase())) {
    return slug.toUpperCase();
  }
  // Convertir slug en nom lisible: "serie-1-e87" => "Série 1 E87"
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(/\b(E\d+|F\d+|G\d+)\b/gi, (match) => match.toUpperCase()); // E87, F20, etc.
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Conseils par Gamme",
    href: "/blog-pieces-auto/conseils",
    icon: BookOpen,
    description: "Guides et conseils par type de pièce",
    color: "text-blue-600",
    bgColor: "bg-primary/10",
    borderColor: "border-blue-200",
  },
  {
    label: "Guide d'Achat",
    href: "/blog-pieces-auto/guide",
    icon: Wrench,
    description: "Comparatifs et conseils d'achat",
    color: "text-green-600",
    bgColor: "bg-success/5",
    borderColor: "border-green-200",
  },
  {
    label: "Pièces par Constructeur",
    href: "/blog-pieces-auto/auto",
    icon: Car,
    description: "Recherche par marque et modèle",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    label: "Glossaire",
    href: "/reference-auto",
    icon: BookOpen,
    description: "Définitions techniques des pièces",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
];

export function BlogPiecesAutoNavigation() {
  const location = useLocation();
  const params = useParams();

  // Extraire marque et modèle des params
  const marque = params.marque;
  const modele = params.modele;

  const isActive = (href: string) => {
    return location.pathname.startsWith(href);
  };

  // Détecter quelle section est active
  const isConseilsActive = location.pathname.includes("/conseils");
  const isAutoActive = location.pathname.includes("/auto");

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo/Home */}
          <Link
            to="/blog-pieces-auto/conseils"
            className="flex items-center gap-3 group hover:scale-105 transition-transform"
          >
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-xl p-2.5 shadow-lg">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Pièces Auto
              </h1>
              <p className="text-xs text-gray-500">
                Conseils et guides pratiques
              </p>
            </div>
          </Link>

          {/* Navigation principale */}
          <div className="hidden md:flex items-center gap-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "group relative px-6 py-3 rounded-xl font-semibold transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5",
                    active
                      ? `${item.bgColor} ${item.color} border-2 ${item.borderColor} shadow-sm`
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        active ? item.color : "text-gray-500",
                      )}
                    />
                    <span>{item.label}</span>
                  </div>

                  {/* Tooltip au survol */}
                  <div
                    className={cn(
                      "absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg shadow-lg",
                      "text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100",
                      "transition-opacity duration-200 pointer-events-none z-10 bg-gray-900",
                    )}
                  >
                    {item.description}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Boutons secondaires */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/blog-pieces-auto"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium text-sm"
            >
              <BookOpen className="w-4 h-4" />
              Blog
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium text-sm"
            >
              <Home className="w-4 h-4" />
              Accueil
            </Link>
          </div>
        </div>

        {/* Navigation mobile */}
        <div className="md:hidden pb-4">
          <div className="grid grid-cols-2 gap-3">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                    active
                      ? `${item.bgColor} ${item.color} border-2 ${item.borderColor}`
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent",
                  )}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-semibold text-center leading-tight">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Breadcrumb contextuel */}
        {(isConseilsActive || isAutoActive) && (
          <div className="pb-3 pt-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Link to="/" className="hover:text-blue-600 transition-colors">
                Accueil
              </Link>
              <span>›</span>
              <Link
                to="/blog-pieces-auto"
                className="hover:text-blue-600 transition-colors"
              >
                Blog automobile
              </Link>
              {isConseilsActive && (
                <>
                  <span>›</span>
                  <span className="text-gray-900 font-medium">Conseils</span>
                </>
              )}
              {isAutoActive && (
                <>
                  <span>›</span>
                  {marque ? (
                    <Link
                      to="/blog-pieces-auto/auto"
                      className="hover:text-blue-600 transition-colors"
                    >
                      Constructeurs automobile
                    </Link>
                  ) : (
                    <span className="text-gray-900 font-medium">
                      Constructeurs automobile
                    </span>
                  )}
                </>
              )}
              {isAutoActive && marque && (
                <>
                  <span>›</span>
                  {modele ? (
                    <Link
                      to={`/blog-pieces-auto/auto/${marque}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {formatSlugToName(marque)}
                    </Link>
                  ) : (
                    <span className="text-gray-900 font-medium">
                      {formatSlugToName(marque)}
                    </span>
                  )}
                </>
              )}
              {isAutoActive && modele && (
                <>
                  <span>›</span>
                  <span className="text-gray-900 font-medium">
                    {formatSlugToName(modele)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
