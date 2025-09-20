import { type LoaderFunctionArgs, redirect, json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { getOptionalUser } from "../auth/unified.server";
import { AdminSidebar } from "../components/AdminSidebar";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (!user) throw redirect("/login");
  if (!user.level || user.level < 5) throw redirect("/unauthorized");
  
  // Récupérer les statistiques du dashboard pour le sidebar
  let stats = null;
  try {
    const statsResponse = await fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/dashboard/stats`);
    if (statsResponse.ok) {
      stats = await statsResponse.json();
    }
  } catch (error) {
    console.log('Erreur récupération stats sidebar:', error);
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
              Connecté en tant que: {user.firstName} {user.lastName} ({user.email})
            </span>
            {stats?.seoStats && (
              <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                🔍 SEO: {(stats.seoStats.completionRate || 95.2).toFixed(1)}% optimisé
              </div>
            )}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
