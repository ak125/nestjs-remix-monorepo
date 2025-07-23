/**
 * Layout Admin - Layout principal pour toutes les pages d'administration
 * Intègre la navigation et la structure basée sur l'analyse legacy
 */

import { type LoaderFunctionArgs, type MetaFunction, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import AdminSidebar from "~/components/AdminSidebar";

export const meta: MetaFunction = () => {
  return [
    { title: "Administration - AutoParts Legacy System" },
    { name: "description", content: "Interface d'administration complète basée sur le système PHP legacy migré" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Pour maintenant, on simule un utilisateur admin connecté
  // TODO: Implémenter l'authentification réelle quand le système d'auth sera complet
  const mockAdminUser = {
    id: 'autoparts-admin-001',
    email: 'admin.autoparts@example.com',
    firstName: 'Admin',
    lastName: 'AutoParts',
    level: 8, // Niveau admin
    isPro: true,
    isActive: true
  };

  // Vérifier si l'utilisateur a les droits admin (level >= 5)
  if (!mockAdminUser || mockAdminUser.level < 5) {
    throw redirect('/unauthorized');
  }

  return { user: mockAdminUser };
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
