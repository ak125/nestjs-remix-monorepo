import { Link } from "@remix-run/react";
import {
  Disc,
  Filter,
  Settings,
  Cog,
  Zap,
  Droplets,
  Car,
  Wrench,
} from "lucide-react";
import { memo } from "react";

interface Category {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const popularCategories: Category[] = [
  {
    name: "Freinage",
    href: "/search?q=plaquettes+frein",
    icon: Disc,
    description: "Plaquettes, disques, tambours",
  },
  {
    name: "Filtration",
    href: "/search?q=filtre+huile",
    icon: Filter,
    description: "Filtres huile, air, habitacle",
  },
  {
    name: "Distribution",
    href: "/search?q=kit+distribution",
    icon: Settings,
    description: "Kits, courroies, tendeurs",
  },
  {
    name: "Embrayage",
    href: "/search?q=kit+embrayage",
    icon: Cog,
    description: "Kits, volants moteur",
  },
  {
    name: "Allumage",
    href: "/search?q=bougie+allumage",
    icon: Zap,
    description: "Bougies, bobines, fils",
  },
  {
    name: "Refroidissement",
    href: "/search?q=radiateur",
    icon: Droplets,
    description: "Radiateurs, pompes eau",
  },
  {
    name: "Suspension",
    href: "/search?q=amortisseur",
    icon: Car,
    description: "Amortisseurs, ressorts",
  },
  {
    name: "Catalogue",
    href: "/#catalogue",
    icon: Wrench,
    description: "Toutes les pièces auto",
  },
];

interface PopularCategoriesProps {
  className?: string;
  title?: string;
  columns?: 2 | 3 | 4;
}

/**
 * Grille de catégories populaires pour les pages d'erreur
 * Aide les utilisateurs à trouver rapidement ce qu'ils cherchent
 */
export const PopularCategories = memo(function PopularCategories({
  className = "",
  title = "Catégories populaires",
  columns = 4,
}: PopularCategoriesProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div className={`w-full ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
          {title}
        </h3>
      )}
      <div className={`grid ${gridCols[columns]} gap-3`}>
        {popularCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              key={category.href}
              to={category.href}
              className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                  {category.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {category.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

export default PopularCategories;
