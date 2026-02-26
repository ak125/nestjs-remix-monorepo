/**
 * 📋 INTERFACE GESTION STAFF - Admin Interface
 *
 * Interface de gestion du staff administratif
 * Module admin moderne avec API REST et nouveau StaffService
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Alert } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireAdmin } from "../auth/unified.server";
import { getRemixApiService } from "../server/remix-api.server";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Gestion Staff - Admin");

// Types supprimés car inutilisés

interface RemixUser {
  id?: number;
  cst_id?: number;
  email: string;
  level?: number;
  job?: string;
  name?: string;
  cst_lastname?: string;
  firstName?: string;
  cst_firstname?: string;
  phone?: string;
  cst_phone?: string;
  isActive?: boolean;
  department?: string;
}

// Type pour compatibility avec les données legacy
interface LegacyAdminStaff {
  cnfa_id: number;
  cnfa_login: string;
  cnfa_mail: string;
  cnfa_level: number;
  cnfa_job: string;
  cnfa_name: string;
  cnfa_fname: string;
  cnfa_tel: string;
  cnfa_activ: string;
  s_id: string;
}

interface StaffStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
  byDepartment: Record<string, number>;
  byLevel: Record<string, number>;
}

interface StaffLoaderData {
  staff: LegacyAdminStaff[];
  stats: StaffStats;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
  fallbackMode: boolean;
  error?: string;
  timestamp?: string;
}

// Fonction loader pour récupérer les données du staff
export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context });

  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  const url = new URL(request.url);

  // Paramètres de requête pour la pagination et les filtres
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || "";
  const level = url.searchParams.get("level")
    ? parseInt(url.searchParams.get("level")!)
    : undefined;

  try {
    const remixService = await getRemixApiService(context);
    const usersResult = await remixService.getUsersForRemix({
      page,
      limit: 10,
      search,
      level,
    });

    if (!usersResult.success) {
      throw new Error(
        usersResult.error || "Erreur API pour les données du staff",
      );
    }

    // Transformer les données utilisateurs en format staff legacy
    const staff: LegacyAdminStaff[] = usersResult.users.map(
      (user: RemixUser) => ({
        cnfa_id: user.id || user.cst_id,
        cnfa_login: user.email,
        cnfa_mail: user.email,
        cnfa_level: user.level || 1,
        cnfa_job: user.job || "Staff",
        cnfa_name: user.name || user.cst_lastname || "",
        cnfa_fname: user.firstName || user.cst_firstname || "",
        cnfa_tel: user.phone || user.cst_phone || "",
        cnfa_activ: user.isActive ? "1" : "0",
        s_id: user.department || "general",
      }),
    );

    // Calculer les statistiques
    const stats: StaffStats = {
      total: usersResult.total,
      active: staff.filter((s) => s.cnfa_activ === "1").length,
      inactive: staff.filter((s) => s.cnfa_activ === "0").length,
      byLevel: staff.reduce(
        (acc, s) => {
          const level = s.cnfa_level.toString();
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byRole: staff.reduce(
        (acc, s) => {
          const role = s.cnfa_job;
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byDepartment: staff.reduce(
        (acc, s) => {
          const dept = s.s_id;
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    return json({
      staff,
      stats,
      pagination: {
        page,
        totalPages:
          usersResult.pagination?.totalPages ?? usersResult.totalPages ?? 1,
        totalItems: usersResult.total,
      },
      fallbackMode: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Erreur loader staff:", error);

    // Fallback en cas d'erreur
    return json({
      staff: [],
      stats: {
        total: 0,
        active: 0,
        inactive: 0,
        byLevel: {},
      },
      pagination: { page: 1, totalPages: 1, totalItems: 0 },
      error: "Erreur lors du chargement du staff",
      fallbackMode: true,
    });
  }
}

// Composant principal de gestion du staff
export default function AdminStaff() {
  const data = useLoaderData<StaffLoaderData>();
  const navigation = useNavigation();
  const [_selectedStaff, _setSelectedStaff] = useState<LegacyAdminStaff | null>(
    null,
  );

  const isLoading = navigation.state === "loading";

  // Fonction pour formater les dates
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fonction pour obtenir la classe CSS du niveau
  const getLevelClass = (level: number) => {
    if (level >= 9) return "error";
    if (level >= 8) return "orange";
    if (level >= 7) return "warning";
    return "bg-gray-100 text-gray-800";
  };

  // Fonction pour obtenir le texte du niveau
  const getLevelText = (level: number) => {
    const levels: Record<number, string> = {
      1: "Niveau 1",
      2: "Niveau 2",
      3: "Service Client",
      4: "Superviseur",
      5: "Manager",
      6: "Manager Senior",
      7: "Admin Commercial",
      8: "Admin Système",
      9: "Super Admin",
    };
    return levels[level] || `Niveau ${level}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation Breadcrumb */}
      <PublicBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Gestion du Staff" },
        ]}
      />

      {/* En-tête avec navigation */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestion du Staff
            </h1>
            <p className="text-gray-600 mt-1">
              Administration des utilisateurs et permissions
            </p>
          </div>

          <div className="flex gap-3">
            <Button className="px-4 py-2 rounded-lg" variant="blue" asChild>
              <Link to="/admin/staff/new">Nouveau Staff</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Indicateur de mode fallback */}
      {data.fallbackMode && (
        <Alert className="rounded-lg p-4 mb-6" variant="warning">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">⚠️</span>
            <span className="text-yellow-800 font-medium">
              Mode Développement
            </span>
            <span className="text-yellow-600 text-sm">
              - Données de test affichées
            </span>
          </div>
        </Alert>
      )}

      {/* Statistiques du staff */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.stats.total}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-full">
              <span className="text-blue-600 text-xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Actif</p>
              <p className="text-2xl font-bold text-green-600">
                {data.stats.active}
              </p>
            </div>
            <div className="p-3 bg-success/10 rounded-full">
              <span className="text-green-600 text-xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Inactif</p>
              <p className="text-2xl font-bold text-red-600">
                {data.stats.inactive}
              </p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-full">
              <span className="text-red-600 text-xl">⏸️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Super Admins</p>
              <p className="text-2xl font-bold text-purple-600">
                {data.stats.byLevel["9"] || 0}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-full">
              <span className="text-purple-600 text-xl">👑</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <Form method="get" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recherche
              </label>
              <input
                type="text"
                name="search"
                placeholder="Nom, login, email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Niveau
              </label>
              <select
                name="level"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les niveaux</option>
                <option value="9">Super Admin (9)</option>
                <option value="8">Admin Système (8)</option>
                <option value="7">Admin Commercial (7)</option>
                <option value="6">Manager Senior (6)</option>
                <option value="5">Manager (5)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                name="isActive"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full  px-4 py-2 rounded-md  disabled:opacity-50"
                variant="blue"
                type="submit"
                disabled={isLoading}
              >
                \n {isLoading ? "Recherche..." : "Filtrer"}\n
              </Button>
            </div>
          </div>
        </Form>
      </div>

      {/* Tableau du staff */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Niveau
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fonction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">👥</span>
                      <span>Aucun membre du staff trouvé</span>
                      {data.fallbackMode && (
                        <span className="text-yellow-600 text-sm">
                          Mode de secours activé
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.staff.map((staff) => (
                  <tr key={staff.cnfa_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-sm">
                              {staff.cnfa_fname.charAt(0).toUpperCase()}
                              {staff.cnfa_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {staff.cnfa_fname} {staff.cnfa_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            @{staff.cnfa_login}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.cnfa_mail}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLevelClass(staff.cnfa_level)}`}
                      >
                        {getLevelText(staff.cnfa_level)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.cnfa_job}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.cnfa_tel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded-full "
                        variant={staff.cnfa_activ === "1" ? "success" : "error"}
                      >
                        \n {staff.cnfa_activ === "1" ? "Actif" : "Inactif"}\n
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/staff/${staff.cnfa_id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Voir
                        </Link>
                        <Link
                          to={`/admin/staff/${staff.cnfa_id}/edit`}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Éditer
                        </Link>
                        <button
                          onClick={() => _setSelectedStaff(staff)}
                          className={`${
                            staff.cnfa_activ === "1"
                              ? "text-red-600 hover:text-red-900"
                              : "text-green-600 hover:text-green-900"
                          }`}
                        >
                          {staff.cnfa_activ === "1" ? "Désactiver" : "Activer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                {data.pagination.page > 1 && (
                  <Link
                    to={`?page=${data.pagination.page - 1}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Précédent
                  </Link>
                )}
                {data.pagination.page < data.pagination.totalPages && (
                  <Link
                    to={`?page=${data.pagination.page + 1}`}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Suivant
                  </Link>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Affichage de{" "}
                    <span className="font-medium">
                      {(data.pagination.page - 1) * 10 + 1}
                    </span>{" "}
                    à{" "}
                    <span className="font-medium">
                      {Math.min(
                        data.pagination.page * 10,
                        data.pagination.totalItems,
                      )}
                    </span>{" "}
                    sur{" "}
                    <span className="font-medium">
                      {data.pagination.totalItems}
                    </span>{" "}
                    membres du staff
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {Array.from(
                      { length: data.pagination.totalPages },
                      (_, i) => i + 1,
                    )
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === data.pagination.totalPages ||
                          Math.abs(page - data.pagination.page) <= 2,
                      )
                      .map((page, index, array) => (
                        <div key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              ...
                            </span>
                          )}
                          <Link
                            to={`?page=${page}`}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === data.pagination.page
                                ? "z-10 bg-primary/5 border-blue-500 text-blue-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </Link>
                        </div>
                      ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Informations de mise à jour */}
      <div className="mt-6 text-sm text-gray-500 text-center">
        Dernière mise à jour:{" "}
        {data?.timestamp ? formatDate(data.timestamp) : "-"}
      </div>
    </div>
  );
}
