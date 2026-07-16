/**
 * Rapports — Admin (lecture seule).
 *
 * Reads the actor-bound `RemixApplicationPort` (`listAdminOrders`) via in-process
 * NestJS DI. Surfaces ONLY real data (total orders). The previous version was
 * ~90% hardcoded synthetic reports (fake sizes/dates/counts) whose "Mode
 * Fallback" badge was always on due to a shape mismatch — all removed, along with
 * the decorative "Nouveau Rapport" / "Télécharger" buttons (no real use case).
 * Admin-gated + `private, no-store` + fail-loud 503.
 */

import { BarChart3, ShoppingCart } from "lucide-react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { requireAdmin } from "~/auth/unified.server";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getRemixApplicationPort } from "~/server/remix-api.server";
import { buildCacheHeaders } from "~/utils/cache-control";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Rapports - Admin");

/** Admin surface: per-user + noindex → never shared-cached. */
export const headers = buildCacheHeaders(
  "private, no-store, no-cache, must-revalidate",
);

function unavailable(): Response {
  return new Response("Service rapports temporairement indisponible", {
    status: 503,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "Retry-After": "30",
    },
  });
}

export const loader = async ({ context }: LoaderFunctionArgs) => {
  await requireAdmin({ context });

  try {
    const port = getRemixApplicationPort(context);
    // Only the paginated total is needed here (a single row keeps it cheap).
    const orders = await port.listAdminOrders({ page: 1, limit: 1 });
    return { totalOrders: orders.pagination.total };
  } catch (error) {
    if (error instanceof Response) throw error;
    logger.error("[admin.reports] port failure:", error);
    throw unavailable();
  }
};

export default function AdminReports() {
  const { totalOrders } = useLoaderData<{ totalOrders: number }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Analyses &amp; Rapports
        </h1>
        <p className="text-muted-foreground mt-1">
          Vue lecture seule — données réelles uniquement.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total commandes
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Toutes commandes confondues
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Génération de rapports</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            La génération et l&apos;export de rapports détaillés ne sont pas
            encore disponibles. Cette page n&apos;affiche que des indicateurs
            réels issus des services.
          </p>
        </CardContent>
      </Card>
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
