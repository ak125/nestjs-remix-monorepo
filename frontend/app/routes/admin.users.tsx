/**
 * Route pour la gestion des utilisateurs
 * Utilise le composant UserManagement avec tous les hooks API
 */

import type { MetaFunction } from "@remix-run/node";
import UserManagement from "~/components/UserManagement";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Utilisateurs - Admin" },
    { name: "description", content: "Interface d'administration pour la gestion des utilisateurs" },
  ];
};

export default function UsersAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <UserManagement />
    </div>
  );
}
