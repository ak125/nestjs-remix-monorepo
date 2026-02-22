import { Link, useLocation } from "@remix-run/react";
import {
  Home,
  Users,
  ShoppingCart,
  CreditCard,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  Shield,
  Package,
  Truck,
  Store,
  Send,
  Search,
  TrendingUp,
  Globe,
  FileText,
  Monitor,
  BookOpen,
  Edit,
  Eye,
  Tag,
  Megaphone,
  Link2,
  Map,
  Share2,
  MessageSquare,
  RefreshCw,
  Activity,
  ShieldCheck,
  FilePen,
} from "lucide-react";
import * as React from "react";
import { memo } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

// Fonction utilitaire pour combiner les classes CSS
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  stats?: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    activeUsers: number;
    pendingOrders: number;
    completedOrders: number;
    totalSuppliers: number;
    totalStock?: number;
    seoStats?: {
      totalPages: number;
      pagesWithSeo: number;
      sitemapEntries: number;
      completionRate: number;
    };
  };
}

export const AdminSidebar = memo(function AdminSidebar({
  className,
  stats,
  ...props
}: SidebarProps) {
  const location = useLocation();

  // Créer les éléments de navigation avec les statistiques dynamiques
  const getNavigationItems = () => [
    {
      name: "Dashboard",
      href: "/admin",
      icon: Home,
      description: "Vue d'ensemble",
      badge: null,
      notification: false,
    },
    {
      name: "Utilisateurs",
      href: "/admin/users",
      icon: Users,
      description: "Gestion des utilisateurs",
      badge: stats
        ? { count: stats.totalUsers, color: "bg-primary" }
        : { count: 0, color: "bg-gray-400" },
      notification: false,
    },
    {
      name: "Commandes",
      href: "/admin/orders",
      icon: ShoppingCart,
      description: "Gestion des commandes",
      badge: stats
        ? { count: stats.totalOrders, color: "bg-success" }
        : { count: 0, color: "bg-gray-400" },
      notification: stats ? stats.pendingOrders > 0 : false,
    },
    {
      name: "Stock",
      href: "/commercial/stock",
      icon: Package,
      description: "Gestion des stocks",
      badge: stats
        ? { count: stats.totalStock || 409687, color: "bg-emerald-500" }
        : { count: 409687, color: "bg-emerald-500" },
      notification: false,
    },
    {
      name: "Produits",
      href: "/products/admin",
      icon: Store,
      description: "Gestion catalogue produits",
      badge: { count: "4.0M+", color: "bg-primary" },
      notification: false,
      subItems: [
        {
          name: "Dashboard Produits",
          href: "/products/admin",
          icon: BarChart3,
          description: "4M+ produits automobile",
        },
        {
          name: "Catalogue",
          href: "/products/catalog",
          icon: Search,
          description: "4,036,045 produits",
        },
        {
          name: "Marques",
          href: "/products/brands",
          icon: Tag,
          description: "Gestion constructeurs",
        },
        {
          name: "Gammes",
          href: "/products/ranges",
          icon: FileText,
          description: "9,266 catégories",
        },
      ],
    },
    {
      name: "Blog",
      href: "/admin/blog",
      icon: BookOpen,
      description: "Gestion du blog",
      badge: { count: 86, color: "bg-primary" },
      notification: false,
      subItems: [
        {
          name: "Dashboard Blog",
          href: "/admin/blog",
          icon: Eye,
          description: "Vue d'ensemble du blog",
        },
        {
          name: "Gestion Articles",
          href: "/admin/articles",
          icon: Edit,
          description: "Créer et modifier les articles",
        },
        {
          name: "Performances",
          href: "/admin/performances",
          icon: BarChart3,
          description: "Analytics et optimisations",
        },
      ],
    },
    {
      name: "Marketing",
      href: "/admin/marketing",
      icon: Megaphone,
      description: "Backlinks & SEO Marketing",
      badge: { count: "NEW", color: "bg-purple-600" },
      notification: false,
      subItems: [
        {
          name: "Dashboard",
          href: "/admin/marketing",
          icon: BarChart3,
          description: "KPIs marketing",
        },
        {
          name: "Backlinks",
          href: "/admin/marketing/backlinks",
          icon: Link2,
          description: "Tracker backlinks",
        },
        {
          name: "Content Roadmap",
          href: "/admin/marketing/content-roadmap",
          icon: Map,
          description: "Planification contenu",
        },
        {
          name: "Social Hub",
          href: "/admin/marketing/social-hub/posts",
          icon: Share2,
          description: "Posts réseaux sociaux",
        },
      ],
    },
    {
      name: "Dashboard Commercial",
      href: "/dashboard",
      icon: Store,
      description: "Interface commerciale",
      badge: { count: "PRO", color: "bg-primary" },
      notification: false,
    },
    {
      name: "Expéditions",
      href: "/commercial/shipping",
      icon: Send,
      description: "Gestion des expéditions",
      badge: { count: 10, color: "bg-purple-600" },
      notification: true,
    },
    {
      name: "Fournisseurs",
      href: "/admin/suppliers",
      icon: Truck,
      description: "Gestion des fournisseurs",
      badge: stats
        ? { count: stats.totalSuppliers, color: "bg-indigo-500" }
        : { count: 70, color: "bg-indigo-500" },
      notification: false,
    },
    {
      name: "Paiements",
      href: "/admin/payments",
      icon: CreditCard,
      description: "Gestion des paiements",
      badge: { count: 50, color: "bg-warning" },
      notification: true,
    },
    {
      name: "Staff",
      href: "/admin/staff",
      icon: Shield,
      description: "Gestion du personnel",
      badge: { count: 4, color: "bg-purple-500" },
      notification: false,
    },
    {
      name: "SEO Enterprise",
      href: "/admin/seo",
      icon: Search,
      description: "Optimisation référencement",
      badge: stats?.seoStats
        ? {
            count: `${(stats.seoStats.completionRate || 95.2).toFixed(1)}%`,
            color: "bg-success",
          }
        : {
            count: "95.2%",
            color: "bg-success",
          },
      notification: false,
      subItems: [
        {
          name: "Analytics SEO",
          href: "/admin/seo",
          icon: TrendingUp,
          description: `${stats?.seoStats?.sitemapEntries?.toLocaleString() || "714K+"} pages indexées`,
        },
        {
          name: "Maillage Interne",
          href: "/admin/seo-dashboard",
          icon: Globe,
          description: "Tracking liens internes",
        },
        {
          name: "Gammes SEO",
          href: "/admin/gammes-seo",
          icon: Tag,
          description: "230 gammes G-Level",
        },
        {
          name: "V-Level Status",
          href: "/admin/v-level-status",
          icon: BarChart3,
          description: "Dashboard V-Level global",
        },
        {
          name: "Sitemaps",
          href: "/admin/seo?tab=tools",
          icon: FileText,
          description: "Génération automatique",
        },
        {
          name: "Métadonnées",
          href: "/admin/seo?tab=batch-update",
          icon: Tag,
          description: `${stats?.seoStats?.pagesWithSeo?.toLocaleString() || "680K+"} optimisées`,
        },
        {
          name: "Content Refresh",
          href: "/admin/content-refresh",
          icon: RefreshCw,
          description: "Pipeline rafraîchissement contenu",
        },
      ],
    },
    {
      name: "RAG / Chat IA",
      href: "/admin/rag",
      icon: MessageSquare,
      description: "Knowledge base & chat",
      badge: { count: "IA", color: "bg-amber-600" },
      notification: false,
      subItems: [
        {
          name: "Dashboard RAG",
          href: "/admin/rag",
          icon: BarChart3,
          description: "Stats corpus & intents",
        },
        {
          name: "Documents",
          href: "/admin/rag/documents",
          icon: FileText,
          description: "Knowledge base",
        },
        {
          name: "Ingestion",
          href: "/admin/rag/ingest",
          icon: Send,
          description: "PDF & URL ingest",
        },
        {
          name: "Pipeline",
          href: "/admin/rag/pipeline",
          icon: Activity,
          description: "Content refresh & gates",
        },
        {
          name: "QA Gate",
          href: "/admin/rag/qa-gate",
          icon: ShieldCheck,
          description: "Champs SEO protégés",
        },
        {
          name: "Drafts SEO",
          href: "/admin/rag/seo-drafts",
          icon: FilePen,
          description: "Review & publish drafts",
        },
      ],
    },
    {
      name: "Rapports",
      href: "/admin/reports",
      icon: BarChart3,
      description: "Analyses et rapports",
      badge: { count: 2, color: "bg-orange-500" },
      notification: false,
    },
    {
      name: "Système",
      href: "/admin/system",
      icon: Monitor,
      description: "Monitoring serveur",
      badge: { count: "OK", color: "bg-success" },
      notification: false,
    },
  ];

  const navigationItems = getNavigationItems();
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedMenus, setExpandedMenus] = React.useState<
    Record<string, boolean>
  >({
    "SEO Enterprise":
      location.pathname.startsWith("/admin/seo") ||
      location.pathname.startsWith("/admin/gammes-seo") ||
      location.pathname.startsWith("/admin/content-refresh"),
    Blog:
      location.pathname.startsWith("/admin/blog") ||
      location.pathname.startsWith("/admin/articles") ||
      location.pathname.startsWith("/admin/performances"),
    Marketing: location.pathname.startsWith("/admin/marketing"),
    "RAG / Chat IA": location.pathname.startsWith("/admin/rag"),
  });

  // Fermer le menu mobile lors du changement de route
  React.useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Rendu direct en SSR pour éviter l'absence temporaire de la sidebar

  return (
    <>
      {/* Bouton menu mobile moderne */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden h-10 w-10 bg-slate-800 border-slate-600 text-white hover:bg-slate-700 shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar avec gradient moderne */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white border-r border-slate-700/50",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className,
        )}
        {...props}
      >
        <div className="flex h-full flex-col">
          {/* Header avec notification globale */}
          <div className="flex h-16 items-center border-b border-slate-700/50 px-6 bg-slate-800/50">
            <div className="flex items-center space-x-2 flex-1">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center relative shadow-lg">
                <Shield className="h-4 w-4 text-white" />
                {/* Indicateur de notifications actives */}
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse shadow-sm" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Admin Panel
                </h2>
                <p className="text-xs text-slate-400">🚗 Automobile</p>
              </div>
            </div>
            {/* Badge de notifications totales */}
            <div className="h-6 w-6 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center shadow-lg">
              6
            </div>
          </div>

          {/* Navigation avec indicateurs et sous-menus SEO */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              const isExpanded = expandedMenus[item.name] || false;

              return (
                <div key={item.name} className="space-y-1">
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center space-x-3 rounded-xl px-3 py-3 text-sm transition-all duration-200 relative group",
                      "hover:bg-slate-700/50 hover:shadow-md hover:scale-[1.02]",
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-[1.02] border border-blue-500/30"
                        : "text-slate-300 hover:text-white",
                    )}
                    onClick={() => {
                      if ((item as any).subItems) {
                        // Permettre la navigation vers la page principale ET l'expansion du menu
                        setExpandedMenus((prev) => ({
                          ...prev,
                          [item.name]: !prev[item.name],
                        }));
                        // Ne pas empêcher la navigation - laisser le lien fonctionner
                      }
                    }}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center justify-between">
                        <span>{item.name}</span>
                        {/* Badge avec compteur amélioré */}
                        {item.badge && (
                          <span
                            className={cn(
                              "text-xs text-white px-2 py-1 rounded-full min-w-[1.5rem] h-5 flex items-center justify-center font-semibold shadow-sm",
                              item.badge.color,
                              "group-hover:scale-110 transition-transform",
                            )}
                          >
                            {item.badge.count}
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-75 truncate">
                        {item.description}
                      </div>
                    </div>
                    {/* Indicateur de notification amélioré */}
                    {item.notification && (
                      <div className="absolute top-2 right-2 h-2.5 w-2.5 bg-gradient-to-r from-red-400 to-pink-500 rounded-full animate-pulse shadow-sm" />
                    )}
                    {/* Indicateur d'expansion pour menus avec sous-items */}
                    {(item as any).subItems && (
                      <div className="ml-2 flex-shrink-0">
                        <div
                          className={cn(
                            "transition-transform duration-200",
                            isExpanded ? "rotate-90" : "rotate-0",
                          )}
                        >
                          ▶
                        </div>
                      </div>
                    )}
                  </Link>

                  {/* Sous-menu */}
                  {(item as any).subItems && isExpanded && (
                    <div className="ml-6 space-y-1 mt-1 border-l-2 border-slate-600 pl-3">
                      {(item as any).subItems.map((subItem: any) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = location.pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.href}
                            className={cn(
                              "flex items-center space-x-2 rounded-lg px-3 py-2 text-xs transition-all duration-200",
                              "hover:bg-slate-700/30 hover:text-green-300",
                              isSubActive
                                ? "bg-success/20 text-green-300 border-l-2 border-green-400"
                                : "text-slate-400 hover:text-slate-200",
                            )}
                          >
                            <SubIcon className="h-3 w-3 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{subItem.name}</div>
                              <div className="text-xs opacity-75 truncate">
                                {subItem.description}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer avec notifications et déconnexion */}
          <div className="border-t border-slate-700/50 p-4 space-y-3 bg-slate-800/30">
            {/* Zone de notifications récentes */}
            <Card className="p-3 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-600/30">
              <div className="flex items-center gap-2 text-yellow-300">
                <div className="h-2 w-2 bg-warning/60 rounded-full animate-pulse" />
                <p className="text-xs font-medium">
                  {stats
                    ? `${stats.totalOrders} commandes totales`
                    : "0 commandes totales"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-orange-300 mt-1">
                <div className="h-2 w-2 bg-orange-400 rounded-full" />
                <p className="text-xs">Données réelles connectées</p>
              </div>
            </Card>

            {/* Profil admin */}
            <Card className="p-3 bg-slate-700/30 border-slate-600/50">
              <div className="flex items-center space-x-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center shadow-md">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">
                    Administrateur
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    admin@automobile.com
                  </p>
                </div>
                <div
                  className="h-2.5 w-2.5 bg-success/60 rounded-full shadow-sm animate-pulse"
                  title="En ligne"
                />
              </div>

              <form method="POST" action="/auth/logout" className="w-full">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-slate-600/50 border-slate-500 text-slate-200 hover:bg-slate-500/50 hover:text-white transition-all"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>

      {/* Spacer pour le contenu principal sur desktop */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  );
});

export default AdminSidebar;
