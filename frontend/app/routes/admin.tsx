/**
 * Layout Admin - Layout principal pour toutes les pages d'administration
 * Intègre la navigation et la structure basée sur l'analyse legacy
 */

import { type LoaderFunctionArgs, type MetaFunction, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AdminSidebar } from "~/components/AdminSidebar";
import { getOptionalUser } from "../auth/unified.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Administration - AutoParts Legacy System" },
    { name: "description", content: "Interface d'administration complète basée sur le système PHP legacy migré" },
  ];
};

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (!user) throw redirect('/login');
  if (!user.level || user.level < 5) throw redirect('/unauthorized');
  return { user };
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      {/* Main content */}
      <div className="lg:pl-64">
        <main className="min-h-screen p-6">
          <div className="mb-4 text-sm text-gray-600">
            Connecté en tant que: {user.firstName} {user.lastName} ({user.email})
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
