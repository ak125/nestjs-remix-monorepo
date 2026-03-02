import {
  type LoaderFunctionArgs,
  redirect,
  json,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { Alert } from "~/components/ui/alert";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { getOptionalUser } from "../auth/unified.server";
import { AdminSidebar } from "../components/AdminSidebar";

export const meta: MetaFunction = () => createNoIndexMeta("Administration");

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (!user) throw redirect("/login");
  if (!user.level || user.level < 5) throw redirect("/unauthorized");

  // Récupérer les statistiques du dashboard pour le sidebar
  let stats = null;
  try {
    const statsResponse = await fetch(
      `${getInternalApiUrl("")}/api/dashboard/stats`,
    );
    if (statsResponse.ok) {
      stats = await statsResponse.json();
    }
  } catch (error) {
    logger.log("Erreur récupération stats sidebar:", error);
  }

  return json({ user, stats });
}

export default function AdminLayout() {
  const { user, stats } = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar stats={stats || undefined} />
      <div className="lg:pl-64">
        <main className="min-h-screen p-6">
          <div className="mb-4 text-sm text-gray-600 flex items-center justify-between">
            <span>
              Connecté en tant que: {user.firstName} {user.lastName} (
              {user.email})
            </span>
            {stats &&
              typeof stats === "object" &&
              "seoStats" in stats &&
              (stats as any).seoStats && (
                <Alert intent="success">
                  🔍 SEO:{" "}
                  {((stats as any).seoStats?.completionRate ?? 0).toFixed(1)}%
                  optimisé
                </Alert>
              )}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
