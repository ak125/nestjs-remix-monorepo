import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { Button } from "~/components/ui/button";
import { logger } from "~/utils/logger";

interface MenuItemData {
  id: string | number;
  title: string;
  url?: string;
  icon?: string;
  children?: MenuItemData[];
  badge?:
    | {
        text: string;
        color: string;
        type?: "success" | "warning" | "error" | "info";
      }
    | string;
  isActive?: boolean;
}

interface DynamicMenuProps {
  module: "commercial" | "seo" | "expedition";
  className?: string;
}

export function DynamicMenu({ module, className = "" }: DynamicMenuProps) {
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use array instead of Set to avoid React hydration issues
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const loadMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3000/navigation/${module}`,
      );
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Transformer les données de l'API en format compatible avec MenuItemData
      if (result.success && result.data?.sections) {
        const transformedItems: MenuItemData[] = result.data.sections.map(
          (section: any, index: number) => ({
            id: `${section.name}-${index}`,
            title: section.name,
            url: section.path,
            icon: section.icon,
            children: section.children
              ? section.children.map((child: any, childIndex: number) => ({
                  id: `${child.name}-${index}-${childIndex}`,
                  title: child.name,
                  url: child.path,
                  badge: child.badge || child.description,
                }))
              : undefined,
          }),
        );
        setMenuItems(transformedItems);
      } else {
        setMenuItems([]);
      }
    } catch (err) {
      logger.error(`Erreur chargement menu ${module}:`, err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const toggleCollapse = useCallback((itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }, []);

  const renderMenuItem = useCallback(
    (item: MenuItemData, depth: number = 0): ReactNode => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems.includes(String(item.id));
      const paddingLeft = depth * 16 + 8;

      // CSS custom property pour le padding dynamique
      const menuItemStyle = {
        "--menu-pl": `${paddingLeft}px`,
      } as CSSProperties;

      return (
        <div key={item.id} className="w-full">
          <Button
            variant="ghost"
            onClick={() =>
              hasChildren ? toggleCollapse(String(item.id)) : undefined
            }
            className={`
              w-full justify-between pr-3 py-2 h-auto text-sm
              pl-[var(--menu-pl)]
              ${
                item.isActive
                  ? "bg-primary/15 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }
              ${hasChildren ? "cursor-pointer" : item.url ? "cursor-pointer" : "cursor-default"}
            `}
            style={menuItemStyle}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {item.icon && (
                <span className="flex-shrink-0 w-4 h-4 text-current">
                  {item.icon}
                </span>
              )}
              <span className="font-medium truncate">{item.title}</span>
              {item.badge && (
                <span
                  className={`
                inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                ${
                  typeof item.badge === "string"
                    ? "bg-gray-100 text-gray-800"
                    : item.badge.type === "success"
                      ? "success"
                      : item.badge.type === "warning"
                        ? "orange"
                        : item.badge.type === "error"
                          ? "error"
                          : "bg-gray-100 text-gray-800"
                }
              `}
                >
                  {typeof item.badge === "string"
                    ? item.badge
                    : item.badge.text}
                </span>
              )}
            </div>

            {hasChildren && (
              <div className="flex-shrink-0 ml-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            )}
          </Button>

          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">
              {item.children!.map((child) => renderMenuItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [expandedItems, toggleCollapse],
  );

  if (loading) {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-destructive/5 border border-red-200 rounded-lg ${className}`}
      >
        <p className="text-red-800 text-sm font-medium">Erreur de chargement</p>
        <p className="text-red-600 text-xs mt-1">{error}</p>
        <Button
          variant="destructive"
          size="sm"
          onClick={loadMenu}
          className="mt-2"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  if (menuItems.length === 0) {
    return (
      <div
        className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${className}`}
      >
        <p className="text-gray-600 text-sm text-center">
          Aucun élément de navigation disponible
        </p>
      </div>
    );
  }

  return (
    <nav className={`space-y-1 ${className}`}>
      {menuItems.map((item) => renderMenuItem(item))}
    </nav>
  );
}
