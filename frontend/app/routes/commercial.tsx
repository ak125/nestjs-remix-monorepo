import { type LoaderFunctionArgs, redirect, json } from "@remix-run/node";
import { Outlet, useLoaderData } from '@remix-run/react';
import { getOptionalUser } from "../auth/unified.server";
import { CommercialSidebar } from "../components/CommercialSidebar";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (!user) throw redirect("/login");
  if (!user.level || user.level < 3) throw redirect("/unauthorized");
  
  // Récupérer les statistiques du dashboard pour le sidebar
  let stats = null;
  try {
    const API_BASE = process.env.NODE_ENV === 'production' 
      ? process.env.API_URL 
      : 'http://127.0.0.1:3000';
    const statsResponse = await fetch(`${API_BASE}/api/dashboard/stats`, {
      headers: { 'internal-call': 'true' }
    });
    if (statsResponse.ok) {
      stats = await statsResponse.json();
    }
  } catch (error) {
    console.log('Erreur récupération stats sidebar commercial:', error);
  }
  
  return json({ user, stats });
}

export default function CommercialLayout() {
  const { user, stats } = useLoaderData<typeof loader>();
  
  return (
    <div className="min-h-screen bg-background">
      <CommercialSidebar stats={stats || undefined} />
      <div className="lg:pl-64">
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
