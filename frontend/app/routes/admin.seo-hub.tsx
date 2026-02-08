/**
 * 🚀 ADMIN SEO HUB - Layout unifié pour toutes les pages SEO
 *
 * Point d'entrée unique pour:
 * - Dashboard SEO Cockpit (KPIs unifiés)
 * - Gammes SEO (230 gammes, G-Level)
 * - Contenu (R4 References, R5 Diagnostics, Blog)
 * - Monitoring (Crawl, Index, Alerts)
 * - Audit (Historique unifié)
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, Link, useLocation, useLoaderData } from "@remix-run/react";
import {
  LayoutDashboard,
  Package,
  FileText,
  Activity,
  History,
  Settings,
  ChevronRight,
  AlertTriangle,
  Search,
} from "lucide-react";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

// Navigation items
const navItems = [
  {
    label: "Dashboard",
    href: "/admin/seo-hub",
    icon: LayoutDashboard,
    description: "KPIs unifiés, santé SEO",
  },
  {
    label: "Gammes SEO",
    href: "/admin/seo-hub/gammes",
    icon: Package,
    description: "230 gammes, G-Level",
    badge: "230",
  },
  {
    label: "Contenu",
    href: "/admin/seo-hub/content",
    icon: FileText,
    description: "R4, R5, Blog",
    children: [
      { label: "References (R4)", href: "/admin/seo-hub/content/references" },
      { label: "Diagnostics (R5)", href: "/admin/seo-hub/content/diagnostics" },
      { label: "Blog", href: "/admin/seo-hub/content/blog" },
    ],
  },
  {
    label: "Monitoring",
    href: "/admin/seo-hub/monitoring",
    icon: Activity,
    description: "Crawl, Index, Alertes",
  },
  {
    label: "Audit",
    href: "/admin/seo-hub/audit",
    icon: History,
    description: "Historique actions",
  },
];

export const meta: MetaFunction = () => createNoIndexMeta("SEO Hub - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    // Quick summary for sidebar badges
    const summaryRes = await fetch(
      `${backendUrl}/api/admin/seo-cockpit/summary`,
      {
        headers: { Cookie: cookieHeader },
      },
    );

    const summary = summaryRes.ok ? await summaryRes.json() : null;

    return json({
      summary: summary?.data || null,
      error: null,
    });
  } catch (error) {
    logger.error("[SEO Hub] Loader error:", error);
    return json({
      summary: null,
      error: "Erreur chargement summary",
    });
  }
}

export default function AdminSeoHubLayout() {
  const { summary } = useLoaderData<typeof loader>();
  const location = useLocation();

  // Check if current path matches nav item
  const isActive = (href: string) => {
    if (href === "/admin/seo-hub") {
      return location.pathname === "/admin/seo-hub";
    }
    return location.pathname.startsWith(href);
  };

  // Get status color
  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "HEALTHY":
        return "bg-green-500";
      case "WARNING":
        return "bg-amber-500";
      case "CRITICAL":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <Link to="/admin/seo-hub" className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">SEO Cockpit</h1>
              <p className="text-xs text-gray-500">Dashboard unifié</p>
            </div>
          </Link>

          {/* Quick Status */}
          {summary && (
            <div className="mt-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Santé SEO</span>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      getStatusColor(summary.status),
                    )}
                  />
                  <span className="font-medium">
                    {summary.healthScore || 0}%
                  </span>
                </div>
              </div>
              {summary.urlsAtRisk > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {summary.urlsAtRisk} URLs à risque
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <div key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    active
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-indigo-600" : "text-gray-400",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                  {active && (
                    <ChevronRight className="h-4 w-4 text-indigo-400" />
                  )}
                </Link>

                {/* Children (sub-nav) */}
                {item.children && active && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={cn(
                          "block px-3 py-1.5 text-sm rounded-md transition-colors",
                          location.pathname === child.href
                            ? "bg-indigo-100 text-indigo-700"
                            : "text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <Settings className="h-4 w-4" />
            Retour Admin
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Breadcrumb */}
          <div className="mb-4">
            <AdminBreadcrumb currentPage="SEO Cockpit" />
          </div>

          {/* Outlet for child routes */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
