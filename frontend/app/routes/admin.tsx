/**
 * Layout Admin - Layout principal pour toutes les pages d'administration
 * Masque le header/footer public via handle exports (root.tsx AppShell)
 * Auth unifiée : context → fallback request
 */

import {
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import {
  Outlet,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { ErrorGeneric } from "~/components/errors";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { getOptionalUser, getAuthUser } from "../auth/unified.server";
import { AdminSidebar } from "../components/AdminSidebar";

// Masquer le header, footer et bottom nav publics pour toutes les pages admin
export const handle = {
  hideGlobalNavbar: true,
  hideGlobalFooter: true,
  hideBottomNav: true,
};

export const meta: MetaFunction = () => {
  return [
    { title: "Administration - AutoMecanik" },
    {
      name: "description",
      content: "Interface d'administration AutoMecanik",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Auth unifiée : context d'abord, puis fallback request (JWT)
  let user = context?.user ? await getOptionalUser({ context }) : null;
  if (!user) {
    user = await getAuthUser(request);
  }

  if (!user) throw redirect("/login");
  if (!user.level || user.level < 5) throw redirect("/unauthorized");

  // Charger toutes les stats admin en parallele (sidebar + dashboard index)
  const cookieHeader = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookieHeader };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stats: Record<string, any> = {
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSuppliers: 0,
    totalStock: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalCategories: 0,
    totalBrands: 0,
    conversionRate: 0,
    avgOrderValue: 0,
    seoStats: null,
    systemHealth: null,
    performance: null,
    security: null,
  };

  let apiErrors: string[] = [];

  try {
    const [dashboardRes, productsRes, healthRes] = await Promise.all([
      fetch(`${getInternalApiUrl("")}/api/dashboard/stats`, { headers }).catch(
        () => null,
      ),
      fetch(`${getInternalApiUrl("")}/api/admin/products/dashboard`, {
        headers,
      }).catch(() => null),
      fetch(`${getInternalApiUrl("")}/api/admin/health/overview`, {
        headers,
      }).catch(() => null),
    ]);

    // 1. Dashboard unifie
    if (dashboardRes?.ok) {
      const d = await dashboardRes.json();
      if (d.success || d.totalUsers !== undefined) {
        stats = {
          ...stats,
          totalUsers: d.totalUsers ?? 0,
          totalOrders: d.totalOrders ?? 0,
          totalRevenue: d.totalRevenue ?? 0,
          activeUsers: d.activeUsers ?? 0,
          pendingOrders: d.pendingOrders ?? 0,
          completedOrders: d.completedOrders ?? 0,
          totalSuppliers: d.totalSuppliers ?? 0,
          totalStock: d.totalStock ?? 0,
          totalProducts: d.totalProducts ?? 0,
          conversionRate: d.conversionRate ?? 0,
          avgOrderValue: d.avgOrderValue ?? 0,
          seoStats: d.seoStats ?? null,
        };
      }
    } else {
      apiErrors.push("Dashboard unifie non disponible");
    }

    // 2. Produits
    if (productsRes?.ok) {
      const p = await productsRes.json();
      if (p.success) {
        stats.totalProducts = p.stats.totalProducts ?? stats.totalProducts;
        stats.activeProducts = p.stats.activeProducts ?? 0;
        stats.totalCategories = p.stats.totalCategories ?? 0;
        stats.totalBrands = p.stats.totalBrands ?? 0;
      }
    } else {
      apiErrors.push("API Produits");
    }

    // 3. System health
    if (healthRes?.ok) {
      const h = await healthRes.json();
      const overview = h.data ?? h;
      if (overview.overall) {
        stats.systemHealth = {
          status: overview.overall,
          uptime: overview.uptime ?? null,
          responseTime: overview.components?.database?.responseMs ?? null,
          memoryUsage: overview.components?.memory?.percentage ?? null,
          cpuUsage: null,
          diskUsage: null,
          activeConnections: null,
        };
      }
    }

    // Conversion rate
    if ((stats.totalOrders as number) > 0) {
      stats.conversionRate = Number(
        (
          (((stats.completedOrders as number) || 0) /
            (stats.totalOrders as number)) *
          100
        ).toFixed(1),
      );
    }
  } catch (error) {
    logger.error("Erreur lors du chargement des stats admin:", error);
  }

  return { user, stats, apiErrors: apiErrors.length > 0 ? apiErrors : null };
}

export default function AdminLayout() {
  const { user, stats } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar stats={stats as any} />

      {/* Main content */}
      <div className="flex-1 lg:ml-0">
        <main className="min-h-screen p-6">
          <div className="mb-4 text-sm text-gray-600">
            Connecté en tant que: {user.firstName} {user.lastName} ({user.email}
            )
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 401 || error.status === 403)
      return (
        <ErrorGeneric
          status={error.status}
          message={error.data?.message || error.statusText}
        />
      );
    if (error.status === 404)
      return (
        <ErrorGeneric status={error.status} message={error.data?.message} />
      );
    return <ErrorGeneric status={error.status} message={error.statusText} />;
  }

  return <ErrorGeneric />;
}
