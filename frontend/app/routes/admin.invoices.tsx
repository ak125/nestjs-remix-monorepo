/**
 * 🧾 LAYOUT FACTURES - Admin Interface
 * 
 * Layout parent pour toutes les pages de gestion des factures
 * Fournit navigation et structure commune
 */

import { Outlet, Link, useLocation } from "@remix-run/react";

export default function InvoicesLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: "/admin/invoices", label: "📋 Liste des factures", exact: true },
    { path: "/admin/invoices/new", label: "➕ Nouvelle facture" },
    { path: "/admin/invoices/stats", label: "📊 Statistiques" },
    { path: "/admin/invoices/export", label: "📥 Export" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation secondaire */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive(item.path)
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
