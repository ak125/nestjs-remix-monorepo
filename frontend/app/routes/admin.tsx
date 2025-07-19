/**
 * Layout Admin - Layout principal pour toutes les pages d'administration
 * Intègre la navigation et la structure basée sur l'analyse legacy
 */

import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import Navigation from "~/components/Navigation";

export const meta: MetaFunction = () => {
  return [
    { title: "Administration - AutoParts Legacy System" },
    { name: "description", content: "Interface d'administration complète basée sur le système PHP legacy migré" },
  ];
};

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Main content */}
      <div className="lg:pl-64">
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
