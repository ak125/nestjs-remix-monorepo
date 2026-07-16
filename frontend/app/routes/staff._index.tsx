/**
 * 👥 STAFF INDEX — administrative staff listing.
 *
 * Reads the actor-bound `RemixApplicationPort` (in-process NestJS DI, no HTTP
 * loopback). Admin-gated: `requireAdmin` at the loader edge + server-side
 * re-authorization inside the port. Read-only. `private, no-store`. Fail-loud
 * (503) on backend failure — NEVER silent zeros / test data.
 */

import { Edit, Eye, Users, Crown, Shield, Settings } from "lucide-react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { requireAdmin } from "~/auth/unified.server";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { getRemixApplicationPort } from "~/server/remix-api.server";
import { buildCacheHeaders } from "~/utils/cache-control";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import {
  type AdminStaffMember,
  type AdminStaffStatistics,
} from "~/utils/remix-application-port";
import { Button } from "../components/ui/button";

export const meta: MetaFunction = () => createNoIndexMeta("Staff");

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

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  await requireAdmin({ context });

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "active" || statusParam === "inactive"
      ? statusParam
      : undefined;
  const department = url.searchParams.get("department") || undefined;
  const search = url.searchParams.get("search") || undefined;

  try {
    const port = getRemixApplicationPort(context);
    const [result, statistics] = await Promise.all([
      port.listAdminStaff({ page, limit, status, department, search }),
      port.getAdminStaffStatistics(),
    ]);

    return { staff: result.staff, statistics };
  } catch (error) {
    // Preserve auth redirects (requireAdmin); everything else is an observable
    // 503 — no fake all-zeros stats (governed no-silent-fallback).
    if (error instanceof Response) throw error;
    logger.error("[staff._index] port failure:", error);
    throw unavailable();
  }
};

export default function StaffIndex() {
  const { staff, statistics } = useLoaderData<{
    staff: AdminStaffMember[];
    statistics: AdminStaffStatistics;
  }>();

  const statusVariant = (isActive: boolean) => (isActive ? "success" : "error");

  const roleColor = (role?: string) => {
    const r = role ?? "";
    if (r.includes("Super"))
      return "bg-warning/20 text-warning border-yellow-200";
    if (r.includes("Admin")) return "bg-info/20 text-info border-blue-200";
    if (r.includes("Manager"))
      return "bg-muted text-foreground border-purple-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion du Personnel
          </h1>
          <p className="text-gray-600 mt-1">
            Administration et supervision du staff
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {statistics.total}
              </p>
              <p className="text-xs text-gray-500">Membres</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actifs</p>
              <p className="text-2xl font-bold text-green-600">
                {statistics.active}
              </p>
              <p className="text-xs text-gray-500">En service</p>
            </div>
            <Shield className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactifs</p>
              <p className="text-2xl font-bold text-gray-600">
                {statistics.inactive}
              </p>
              <p className="text-xs text-gray-500">Hors service</p>
            </div>
            <Settings className="h-8 w-8 text-gray-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Départements</p>
              <p className="text-2xl font-bold text-foreground">
                {statistics.departments}
              </p>
              <p className="text-xs text-gray-500">Services</p>
            </div>
            <Crown className="h-8 w-8 text-foreground" />
          </div>
        </div>
      </div>

      {/* Liste du personnel */}
      <div className="bg-white rounded-lg shadow overflow-hidden border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Personnel Administratif
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {staff.length} membre{staff.length > 1 ? "s" : ""} affiché
            {staff.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fonction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Users className="h-12 w-12 text-gray-300" />
                      <span className="text-lg font-medium">
                        Aucun membre trouvé
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {member.firstName?.[0]}
                              {member.lastName?.[0]}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {member.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${roleColor(member.role)}`}
                      >
                        {member.role || "Non assigné"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${statusVariant(member.isActive)}`}
                      >
                        {member.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link to={`/staff/${member.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="hover:bg-info/20"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                        </Link>
                        <Link to={`/staff/${member.id}/edit`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="hover:bg-warning/5"
                          >
                            <Edit className="h-4 w-4 text-yellow-600" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY — HTTP errors (403 non-admin, 503 backend down, …)
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
