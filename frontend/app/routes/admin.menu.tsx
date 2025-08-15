/**
 * Route Admin Menu - Navigation principale
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { requireAdmin } from "../auth/unified.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context });

  return json({
    user,
    menu: {
      title: 'Administration',
      sections: [
        {
          name: 'Dashboard',
          path: '/admin',
          description: 'Statistiques et métriques générales',
          icon: '📊',
        },
        {
          name: 'Commandes',
          path: '/admin/orders',
          description: 'Gestion des commandes clients',
          icon: '📦',
        },
        {
          name: 'Staff',
          path: '/admin/staff',
          description: 'Administration du personnel',
          icon: '👥',
        },
        {
          name: 'Fournisseurs',
          path: '/admin/suppliers',
          description: 'Gestion des fournisseurs',
          icon: '🏭',
        },
        {
          name: 'Messages',
          path: '/admin/messages',
          description: 'Communication client/staff',
          icon: '💬',
        },
        {
          name: 'Rapports',
          path: '/admin/reports',
          description: 'Analyses et rapports',
          icon: '📈',
        },
      ],
    },
  });
}

export default function AdminMenu() {
  const { user, menu } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{menu.title}</h1>
          <p className="text-gray-600 mt-2">
            Connecté en tant que {user.firstName} {user.lastName || ''} ({user.email})
          </p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menu.sections.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 border border-gray-200"
            >
              <div className="flex items-center mb-4">
                <span className="text-3xl mr-3">{section.icon}</span>
                <h2 className="text-xl font-semibold text-gray-900">
                  {section.name}
                </h2>
              </div>
              <p className="text-gray-600">{section.description}</p>
              <div className="mt-4">
                <span className="inline-flex items-center text-blue-600 hover:text-blue-800">
                  Accéder
                  <svg
                    className="ml-2 w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Actions rapides
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              to="/admin/orders/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-center"
            >
              Nouvelle commande
            </Link>
            <Link
              to="/admin/staff"
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-center"
            >
              Gérer le staff
            </Link>
            <Link
              to="/admin/suppliers/new"
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-center"
            >
              Nouveau fournisseur
            </Link>
            <Link
              to="/admin/reports"
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors text-center"
            >
              Voir rapports
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Link
            to="/admin"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Retour au dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
