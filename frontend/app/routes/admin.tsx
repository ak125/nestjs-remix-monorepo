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
  try {
    // Récupérer l'utilisateur depuis la session
    const response = await fetch('http://localhost:3000/auth/me', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    if (!response.ok) {
      // Si pas d'utilisateur connecté, rediriger vers login
      throw redirect('/login');
    }

    const userData = await response.json();
    const user = userData.user;

    // Vérifier si l'utilisateur a les droits admin (level >= 5)
    if (!user || !user.level || user.level < 5) {
      throw redirect('/unauthorized');
    }

    return { user };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur admin:', error);
    throw redirect('/login');
  }
};

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
