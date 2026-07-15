/**
 * 📋 GESTION STAFF — Admin.
 *
 * Reads the actor-bound `RemixApplicationPort` (`listAdminStaff` /
 * `getAdminStaffStatistics`) via in-process NestJS DI — replaces the previous
 * `/api/users?...` HTTP loopback (no actor forwarded) that re-mapped USERS into
 * a staff shape. This page now shows the REAL administrative staff
 * (`___config_admin`). Admin-gated + read-only + `private, no-store` + fail-loud
 * 503. (Behaviour change flagged in the PR: users → real staff.)
 */

import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  Link,
  Form,
  useNavigation,
} from "react-router";
import { requireAdmin } from "~/auth/unified.server";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getRemixApplicationPort } from "~/server/remix-api.server";
import { buildCacheHeaders } from "~/utils/cache-control";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import {
  type AdminStaffMember,
  type AdminStaffStatistics,
} from "~/utils/remix-application-port";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Gestion Staff - Admin");

/** Admin surface: per-user + noindex → never shared-cached. */
export const headers = buildCacheHeaders(
  "private, no-store, no-cache, must-revalidate",
);

function unavailable(): Response {
  return new Response("Service staff temporairement indisponible", {
    status: 503,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "Retry-After": "30",
    },
  });
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin({ context });

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const search = url.searchParams.get("search") || undefined;
  const level = url.searchParams.get("level")
    ? parseInt(url.searchParams.get("level")!, 10)
    : undefined;
  const statusParam = url.searchParams.get("isActive");
  const status =
    statusParam === "true"
      ? ("active" as const)
      : statusParam === "false"
        ? ("inactive" as const)
        : undefined;

  try {
    const port = getRemixApplicationPort(context);
    const [result, statistics] = await Promise.all([
      port.listAdminStaff({ page, limit: 10, search, level, status }),
      port.getAdminStaffStatistics(),
    ]);

    return {
      staff: result.staff,
      statistics,
      pagination: {
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        totalItems: result.pagination.total,
      },
    };
  } catch (error) {
    if (error instanceof Response) throw error;
    logger.error("[admin.staff._index] port failure:", error);
    throw unavailable();
  }
}

const LEVELS: Record<number, string> = {
  1: "Niveau 1",
  2: "Niveau 2",
  3: "Service Client",
  4: "Superviseur",
  5: "Manager",
  6: "Manager Senior",
  7: "Admin Commercial",
  8: "Admin Système",
  9: "Super Admin",
};

function levelClass(level: number) {
  if (level >= 9) return "error";
  if (level >= 8) return "orange";
  if (level >= 7) return "warning";
  return "bg-gray-100 text-gray-800";
}

export default function AdminStaff() {
  const { staff, statistics, pagination } = useLoaderData<{
    staff: AdminStaffMember[];
    statistics: AdminStaffStatistics;
    pagination: { page: number; totalPages: number; totalItems: number };
  }>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <div className="container mx-auto px-4 py-8">
      <PublicBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Gestion du Staff" },
        ]}
      />

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestion du Staff
            </h1>
            <p className="text-gray-600 mt-1">
              Personnel administratif (lecture seule)
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="px-4 py-2 rounded-lg" variant="blue" asChild>
              <Link to="/admin/staff/new">Nouveau Staff</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900">
                {statistics.total}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-full">
              <span className="text-blue-600 text-xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Actif</p>
              <p className="text-2xl font-bold text-green-600">
                {statistics.active}
              </p>
            </div>
            <div className="p-3 bg-success/10 rounded-full">
              <span className="text-green-600 text-xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Inactif</p>
              <p className="text-2xl font-bold text-red-600">
                {statistics.inactive}
              </p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-full">
              <span className="text-red-600 text-xl">⏸️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Départements</p>
              <p className="text-2xl font-bold text-foreground">
                {statistics.departments}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-full">
              <span className="text-foreground text-xl">🏢</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <Form method="get" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recherche
              </label>
              <input
                type="text"
                name="search"
                placeholder="Nom, email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Niveau
              </label>
              <select
                name="level"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les niveaux</option>
                <option value="9">Super Admin (9)</option>
                <option value="8">Admin Système (8)</option>
                <option value="7">Admin Commercial (7)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                name="isActive"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full px-4 py-2 rounded-md disabled:opacity-50"
                variant="blue"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Recherche..." : "Filtrer"}
              </Button>
            </div>
          </div>
        </Form>
      </div>

      {/* Tableau du staff */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Niveau
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fonction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">👥</span>
                      <span>Aucun membre du staff trouvé</span>
                    </div>
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-sm">
                              {member.firstName?.charAt(0).toUpperCase()}
                              {member.lastName?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {member.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${levelClass(member.level)}`}
                      >
                        {LEVELS[member.level] || `Niveau ${member.level}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.role || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                        variant={member.isActive ? "success" : "error"}
                      >
                        {member.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/staff/${member.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Voir
                        </Link>
                        <Link
                          to={`/admin/staff/${member.id}/edit`}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Éditer
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - pagination.page) <= 2,
                )
                .map((p) => (
                  <Link
                    key={p}
                    to={`?page=${p}`}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      p === pagination.page
                        ? "z-10 bg-primary/5 border-blue-500 text-blue-600"
                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </Link>
                ))}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY — 403 non-admin / 503 backend down / …
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }
  return <ErrorGeneric />;
}
