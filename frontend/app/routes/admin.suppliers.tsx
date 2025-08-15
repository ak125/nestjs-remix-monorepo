/**
 * 🏢 LAYOUT FOURNISSEURS - Admin Interface
 * 
 * Layout pour toutes les pages liées aux fournisseurs
 * Inclut la navigation et le contexte commun
 */

import { Outlet } from "@remix-run/react";

export default function SuppliersLayout() {
  return (
    <div className="suppliers-layout">
      {/* Le contenu des pages fournisseurs sera rendu ici */}
      <Outlet />
    </div>
  );
}
