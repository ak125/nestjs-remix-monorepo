/**
 * Layout Admin - Layout principal pour toutes les pages d'administration
 * Intègre la navigation et la structure basée sur l'analyse legacy
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
import { getOptionalUser, getAuthUser } from "../auth/unified.server";
import { AdminSidebar } from "../components/AdminSidebar";
import { Error404 } from "~/components/errors/Error404";

export const meta: MetaFunction = () => {
  return [
    { title: "Administration - AutoParts Legacy System" },
    {
      name: "description",
      content:
        "Interface d'administration complète basée sur le système PHP legacy migré",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Essayer d'abord avec context, puis avec request si context vide
  let user = context?.user ? await getOptionalUser({ context }) : null;
  if (!user) {
    user = await getAuthUser(request);
  }

  if (!user) throw redirect("/login");
  if (!user.level || user.level < 5) throw redirect("/unauthorized");

  // Charger les statistiques pour la sidebar
  let stats = {
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSuppliers: 0,
    totalStock: 409687, // Valeur par défaut du stock
    totalProducts: 0,
    totalCategories: 0,
    totalBrands: 0,
  };

  try {
    // Récupérer les données depuis la nouvelle API Dashboard
    const dashboardResponse = await fetch(
      `${process.env.API_URL || "http://localhost:3000"}/api/dashboard/stats`,
    );

    // Récupérer les statistiques produits admin
    const productsStatsResponse = await fetch(
      `${process.env.API_URL || "http://localhost:3000"}/api/admin/products/stats/detailed`,
    );

    if (dashboardResponse.ok) {
      const dashboardData = await dashboardResponse.json();
      stats = {
        totalUsers: dashboardData.totalUsers || 0,
        totalOrders: dashboardData.totalOrders || 0,
        totalRevenue: dashboardData.totalRevenue || 0,
        activeUsers: dashboardData.activeUsers || 0,
        pendingOrders: dashboardData.pendingOrders || 0,
        completedOrders: dashboardData.completedOrders || 0,
        totalSuppliers: dashboardData.totalSuppliers || 0,
        totalStock: 409687, // Valeur par défaut du stock
        totalProducts: 0,
        totalCategories: 0,
        totalBrands: 0,
      };
    }

    // Intégrer les stats produits si disponibles
    if (productsStatsResponse.ok) {
      const productsData = await productsStatsResponse.json();
      if (productsData.success) {
        stats.totalProducts = productsData.stats.totalProducts || 0;
        stats.totalCategories = productsData.stats.totalCategories || 0;
        stats.totalBrands = productsData.stats.totalBrands || 0;
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors du chargement des stats sidebar:", error);
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
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
