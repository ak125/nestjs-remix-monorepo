import { Link, useLocation } from "@remix-run/react";
import { Wrench, ShoppingCart, Car, Home, BookOpen } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  count?: number;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Montage et Entretien",
    href: "/blog-pieces-auto/conseils",
    icon: Wrench,
    description: "Guides de réparation et montage",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    count: 150,
  },
  {
    label: "Constructeurs Automobile",
    href: "/blog/constructeurs",
    icon: Car,
    description: "Histoire et modèles des marques",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    count: 35,
  },
  {
    label: "Guide d'Achat",
    href: "/blog-pieces-auto/guide",
    icon: ShoppingCart,
    description: "Conseils pour bien choisir",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    count: 120,
  },
];

export function BlogNavigation() {
  const location = useLocation();

  const isActive = (href: string) => {
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo/Home */}
          <Link 
            to="/blog" 
            className="flex items-center gap-3 group hover:scale-105 transition-transform"
          >
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-xl p-2.5 shadow-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Blog Automecanik
              </h1>
              <p className="text-xs text-gray-500">Conseils et guides auto</p>
            </div>
          </Link>

          {/* Navigation principale */}
          <div className="hidden lg:flex items-center gap-4">
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
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-5 h-5", active ? item.color : "text-gray-500")} />
                    <span>{item.label}</span>
                    {item.count && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "ml-1 text-xs",
                          active ? item.bgColor : "bg-gray-200"
                        )}
                      >
                        {item.count}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Tooltip au survol */}
                  <div className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg shadow-lg",
                    "text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-200 pointer-events-none z-10",
                    active ? item.bgColor.replace('bg-', 'bg-gradient-to-r from-') : "bg-gray-900"
                  )}>
                    {item.description}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Bouton retour accueil */}
          <Link 
            to="/"
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            Accueil
          </Link>
        </div>

        {/* Navigation mobile */}
        <div className="lg:hidden pb-4">
          <div className="grid grid-cols-3 gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
                    active
                      ? `${item.bgColor} ${item.color} border-2 ${item.borderColor}`
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-semibold text-center leading-tight">
                    {item.label}
                  </span>
                  {item.count && (
                    <Badge variant="secondary" className="text-xs">
                      {item.count}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
