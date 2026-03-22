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

  // Charger les stats sidebar en parallèle
  const cookieHeader = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookieHeader };

  let stats = {
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSuppliers: 0,
    totalStock: 0,
    totalProducts: 0,
    totalCategories: 0,
    totalBrands: 0,
  };

  try {
    const [dashboardResponse, productsStatsResponse] = await Promise.all([
      fetch(`${getInternalApiUrl("")}/api/dashboard/stats`, { headers }),
      fetch(`${getInternalApiUrl("")}/api/admin/products/stats/detailed`, {
        headers: { ...headers, "Content-Type": "application/json" },
      }),
    ]);

    if (dashboardResponse.ok) {
      const dashboardData = await dashboardResponse.json();
      stats = {
        ...stats,
        totalUsers: dashboardData.totalUsers ?? 0,
        totalOrders: dashboardData.totalOrders ?? 0,
        totalRevenue: dashboardData.totalRevenue ?? 0,
        activeUsers: dashboardData.activeUsers ?? 0,
        pendingOrders: dashboardData.pendingOrders ?? 0,
        completedOrders: dashboardData.completedOrders ?? 0,
        totalSuppliers: dashboardData.totalSuppliers ?? 0,
        totalStock: dashboardData.totalStock ?? 0,
      };
    }

    if (productsStatsResponse.ok) {
      const productsData = await productsStatsResponse.json();
      if (productsData.success) {
        stats.totalProducts = productsData.stats.totalProducts ?? 0;
        stats.totalCategories = productsData.stats.totalCategories ?? 0;
        stats.totalBrands = productsData.stats.totalBrands ?? 0;
      }
    }
  } catch (error) {
    logger.error("Erreur lors du chargement des stats sidebar:", error);
  }

  return { user, stats };
}

export default function AdminLayout() {
  const { user, stats } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar stats={stats} />

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
