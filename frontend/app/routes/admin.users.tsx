/**
 * Route pour la gestion des utilisateurs
 * Utilise l'architecture zero-latency avec RemixIntegrationService
 */

import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Utilisateurs - Admin" },
    { name: "description", content: "Interface d'administration pour la gestion des utilisateurs" },
  ];
};

export const loader: LoaderFunction = async ({ context }) => {
  // TODO: Implémenter avec RemixIntegrationService quand les méthodes users seront ajoutées
  return json({ 
    message: "Fonctionnalité en cours de développement avec architecture zero-latency" 
  });
};

export default function UsersAdminPage() {
  const { message } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Gestion des Utilisateurs</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <p className="text-lg text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Cette page sera implémentée avec l'architecture zero-latency via RemixIntegrationService
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
