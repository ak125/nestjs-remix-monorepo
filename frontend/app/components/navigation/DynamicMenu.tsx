/**
 * DynamicMenu - Composant de navigation dynamique avancé
 * Compatible avec les services NavigationService optimisés (Commercial, SEO, Expedition)
 * Intégration complète avec backend NestJS + Supabase
 */
import { Link, useLocation } from "@remix-run/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Alert } from "~/components/ui/alert";
import {
  type MenuItem,
  type NavigationResponse,
  type UserPreferences,
} from "../../types/navigation";

interface DynamicMenuProps {
  module: "commercial" | "expedition" | "seo";
  userId?: string;
  userRole?: string;
  className?: string;
}

export function DynamicMenu({
  module,
  userId,
  userRole = "public",
  className = "",
}: DynamicMenuProps) {
  const [menuSections, setMenuSections] = useState<any[]>([]);
  // Use array instead of Set to avoid React hydration issues
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  const loadMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les données du menu depuis notre backend optimisé
      const response = await fetch(
        `http://localhost:3000/navigation/${module}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-User-Role": userRole,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to load menu: ${response.statusText}`);
      }

      const navigationData: NavigationResponse = await response.json();

      setMenuSections(navigationData.data.sections || []);

      // Charger les préférences utilisateur si disponible
      if (userId) {
        try {
          const prefsResponse = await fetch(
            `/api/navigation/preferences/${userId}/${module}`,
          );
          if (prefsResponse.ok) {
            const prefs: UserPreferences = await prefsResponse.json();
            setCollapsed(prefs.collapsed_items || []);
          }
        } catch (prefsError) {
          console.warn("Failed to load user preferences:", prefsError);
        }
      }
    } catch (error) {
      console.error(`Error loading ${module} menu:`, error);
      setError(`Erreur de chargement du menu ${module}`);

      // Fallback menu pour ne pas avoir d'écran blanc
      setMenuSections([
        {
          name: `${module.charAt(0).toUpperCase() + module.slice(1)} (Fallback)`,
          path: `/${module}`,
          icon: "🔧",
          description: "Menu de secours",
          children: [
            {
              id: 999,
              title: "Accueil",
              path: `/${module}`,
              description: "Page d'accueil du module",
            },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [module, userRole, userId]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const toggleCollapse = async (itemId: number) => {
    const newCollapsed = collapsed.includes(itemId)
      ? collapsed.filter((id) => id !== itemId)
      : [...collapsed, itemId];
    setCollapsed(newCollapsed);

    // Sauvegarder les préférences utilisateur
    if (userId) {
      try {
        await fetch(`/api/navigation/preferences/${userId}/${module}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collapsed_items: newCollapsed,
          }),
        });
      } catch (error) {
        console.warn("Failed to save preferences:", error);
      }
    }
  };

  const renderMenuItem = (item: MenuItem, level = 0, parentPath = "") => {
    const hasChildren = item.children && item.children.length > 0;
    const isCollapsed = collapsed.includes(item.id);
    const itemPath =
      item.path || item.url || `${parentPath}/${item.title.toLowerCase()}`;
    const isActive = location.pathname === itemPath;

    return (
      <div
        key={item.id}
        className={`menu-item-wrapper ${level > 0 ? "ml-4" : ""}`}
      >
        <div
          className={`
            menu-item flex items-center justify-between p-3 rounded-lg
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
            ${isActive ? "bg-primary/10 dark:bg-primary/98/20 text-primary border-l-4 border-blue-500" : ""}
          `}
        >
          <div className="flex items-center flex-1">
            {hasChildren && (
              <button
                onClick={() => toggleCollapse(item.id)}
                className="mr-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label={isCollapsed ? "Développer" : "Réduire"}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
            )}

            {item.icon && (
              <span className="mr-3 text-gray-500">
                {item.icon.startsWith("fa-") ? (
                  <i className={`fas fa-${item.icon}`} />
                ) : (
                  <span>{item.icon}</span>
                )}
              </span>
            )}

            {itemPath && !hasChildren ? (
              <Link
                to={itemPath}
                className="flex-1 flex items-center justify-between hover:text-blue-600 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  {item.description && (
                    <span className="text-sm text-gray-500">
                      {item.description}
                    </span>
                  )}
                </div>
                {item.badge && (
                  <span
                    className={`
                      ml-2 px-2 py-1 text-xs rounded-full font-semibold
                      ${getBadgeClass(typeof item.badge === "string" ? "blue" : item.badge.color)}
                    `}
                  >
                    {typeof item.badge === "string"
                      ? item.badge
                      : item.badge.text}
                  </span>
                )}
              </Link>
            ) : (
              <div className="flex-1 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  {item.description && (
                    <span className="text-sm text-gray-500">
                      {item.description}
                    </span>
                  )}
                </div>
                {item.badge && (
                  <span
                    className={`
                      ml-2 px-2 py-1 text-xs rounded-full font-semibold
                      ${getBadgeClass(typeof item.badge === "string" ? "blue" : item.badge.color)}
                    `}
                  >
                    {typeof item.badge === "string"
                      ? item.badge
                      : item.badge.text}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="menu-children mt-1 border-l-2 border-gray-100 ml-6 pl-4">
            {item.children!.map((child) =>
              renderMenuItem(child, level + 1, itemPath),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (section: any) => {
    return (
      <div key={section.name} className="menu-section mb-6">
        <div className="section-header mb-3">
          <h3 className="flex items-center text-lg font-semibold text-gray-800 dark:text-gray-200">
            <span className="mr-2">{section.icon}</span>
            {section.name}
          </h3>
          {section.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {section.description}
            </p>
          )}
        </div>
        <div className="section-items space-y-1">
          {section.children?.map((item: MenuItem) => renderMenuItem(item))}
        </div>
      </div>
    );
  };

  const getBadgeClass = (color: string) => {
    const colors: Record<string, string> = {
      red: "error",
      orange: "orange",
      yellow: "warning",
      blue: "info",
      green: "success",
      purple: "purple",
    };
    return (
      colors[color] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
    );
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-8 bg-gray-100 rounded ml-4" />
              <div className="h-8 bg-gray-100 rounded ml-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <Alert className="rounded-lg p-4" variant="error">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">⚠️</span>
            <p className="text-red-800 font-medium">Erreur de chargement</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadMenu}
            className="mt-2 px-3 py-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded text-sm transition-colors"
          >
            Réessayer
          </button>
        </Alert>
      </div>
    );
  }

  return (
    <nav className={`dynamic-menu p-4 space-y-4 ${className}`}>
      {/* En-tête du module */}
      <div className="module-header border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
          {module === "commercial" && "🏪 Commercial"}
          {module === "seo" && "🔍 SEO & Marketing"}
          {module === "expedition" && "📦 Expédition"}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {menuSections.length} section{menuSections.length > 1 ? "s" : ""}{" "}
          disponible{menuSections.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Sections du menu */}
      {menuSections.map((section) => renderSection(section))}

      {/* État vide */}
      {menuSections.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Aucun élément de menu disponible</p>
          <button
            onClick={loadMenu}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm transition-colors"
          >
            Recharger
          </button>
        </div>
      )}
    </nav>
  );
}
