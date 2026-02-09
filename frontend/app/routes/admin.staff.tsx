/**
 * Page Staff - Gestion du personnel administratif
 * Utilise les vraies données et inclut la gestion des messages
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Shield,
  Users,
  Crown,
  Settings,
  AlertCircle,
  MessageSquare,
  Mail,
} from "lucide-react";
import { Alert } from "~/components/ui/alert";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireUser } from "../auth/unified.server";

export const meta: MetaFunction = () => createNoIndexMeta("Staff - Admin");

// Interface pour les données staff basée sur les vraies données users
interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  level: number;
  isActive: boolean;
  department?: string;
  phone?: string;
  lastLogin?: string;
  role: string;
}

interface StaffData {
  staff: StaffMember[];
  total: number;
  error?: string;
  fallbackMode?: boolean;
  messagesEnabled?: boolean;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });

  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  try {
    logger.log("🔄 Chargement du staff depuis l'endpoint test-staff...");

    // ✅ Utiliser l'endpoint test-staff (public, sans auth)
    const baseUrl = "http://127.0.0.1:3000";

    // 1. Utiliser l'endpoint test-staff qui ne nécessite pas d'authentification
    try {
      const staffResponse = await fetch(
        `${baseUrl}/api/legacy-users/test-staff?page=1&limit=100`,
      );

      if (staffResponse.ok) {
        const staffData = await staffResponse.json();

        if (staffData.success && staffData.data) {
          logger.log(
            `✅ Endpoint test-staff utilisé avec succès - ${staffData.total} membres trouvés`,
          );

          // Les données sont déjà dans le bon format
          const staffMembers = staffData.data;

          return json({
            staff: staffMembers,
            total: staffData.total,
            fallbackMode: false,
            messagesEnabled: true,
            apiSource: "test-staff-endpoint",
          } as StaffData);
        }
      }
    } catch (staffApiError) {
      logger.log(
        "ℹ️ Endpoint test-staff non disponible, fallback vers API users:",
        staffApiError,
      );
    }

    // 2. Fallback vers l'API users existante (si test-staff échoue)
    const apiUrl = new URL(`${baseUrl}/api/legacy-users`);
    apiUrl.searchParams.set("limit", "100");
    apiUrl.searchParams.set("page", "1");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      logger.log("📊 Réponse API users reçue:", JSON.stringify(data, null, 2));

      // Valider la structure des données users
      let allUsers: any[] = [];

      if (data && Array.isArray(data.users)) {
        allUsers = data.users;
      } else if (data && Array.isArray(data.data)) {
        allUsers = data.data;
      } else if (data && Array.isArray(data)) {
        allUsers = data;
      } else {
        logger.warn(
          "⚠️ Structure de données inattendue, utilisation mode minimal",
        );
        return json({
          staff: [],
          total: 0,
          fallbackMode: true,
          messagesEnabled: false,
          apiSource: "minimal-fallback",
        } as StaffData);
      }

      // Filtrer pour ne garder que le staff (niveau >= 7)
      const staffMembers = allUsers.filter((member: any) => {
        return member && member.level && Number(member.level) >= 7;
      });

      logger.log(
        `✅ ${staffMembers.length} membres du staff trouvés sur ${allUsers.length} utilisateurs`,
      );

      return json({
        staff: staffMembers,
        total: staffMembers.length,
        fallbackMode: true,
        messagesEnabled: false,
        apiSource: "users-api",
      } as StaffData);
    } else {
      logger.error("❌ Erreur API:", response.status, response.statusText);

      return json({
        staff: [],
        total: 0,
        fallbackMode: true,
        messagesEnabled: false,
        apiSource: "error-fallback",
      } as StaffData);
    }
  } catch (error: unknown) {
    logger.error("❌ Erreur lors du chargement du staff:", error);

    // Mode fallback d'urgence
    return json({
      staff: [
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          level:
            typeof user.level === "number"
              ? user.level
              : parseInt(user.level || "9"),
          isActive: true,
          department: "Administration",
          phone: "",
          role: "Super Admin",
        },
      ],
      total: 1,
      error: "Erreur de connexion à l'API",
      fallbackMode: true,
      messagesEnabled: false,
    } as StaffData);
  }
}

export default function AdminStaff() {
  const { staff, total, error, fallbackMode, messagesEnabled } =
    useLoaderData<StaffData>();

  const getRoleColor = (level: number) => {
    if (level >= 9) return "warning";
    if (level >= 8) return "info";
    if (level >= 7) return "success";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "success" : "error";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                Gestion du Personnel
              </h1>
            </div>
            <p className="text-gray-600">
              Personnel administratif depuis les vraies données utilisateur
              (niveau ≥ 7)
            </p>
            {messagesEnabled && (
              <p className="text-sm text-green-600 mt-1">
                ✅ Système de messagerie activé (table ___xtr_msg)
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {messagesEnabled && (
              <Link
                to="/admin/messages"
                className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 text-success-foreground rounded-lg"
              >
                <MessageSquare className="h-4 w-4" />
                Messages
              </Link>
            )}
            <Link
              to="/admin/users"
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
            >
              <Users className="h-4 w-4" />
              Voir tous les utilisateurs
            </Link>
          </div>
        </div>
      </div>

      {/* Indicateur de source */}
      <div
        className={`mb-6 p-4 rounded-lg border-l-4 ${
          fallbackMode
            ? "border-warning bg-warning/10"
            : "border-success bg-success/10"
        }`}
      >
        <div className="flex items-center gap-2">
          {fallbackMode ? (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          ) : (
            <Shield className="h-5 w-5 text-green-600" />
          )}
          <span className="font-medium">
            {fallbackMode
              ? "Mode fallback - Données limitées"
              : "Données en temps réel depuis table ___xtr_customer (staff filtré niveau ≥ 7)"}
          </span>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <Alert className="mb-6 p-4    rounded-lg" variant="error">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">Niveau ≥ 7</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Super Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {staff.filter((s) => s.level >= 9).length}
              </p>
              <p className="text-xs text-gray-500">Niveau ≥ 9</p>
            </div>
            <Crown className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actifs</p>
              <p className="text-2xl font-bold text-gray-900">
                {staff.filter((s) => s.isActive).length}
              </p>
              <p className="text-xs text-gray-500">Connectés</p>
            </div>
            <Settings className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {staff.filter((s) => s.level >= 8 && s.level < 9).length}
              </p>
              <p className="text-xs text-gray-500">Niveau 8</p>
            </div>
            <Shield className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Liste du staff */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Membres de l'Équipe Administrative
              </h2>
              <p className="text-gray-600">
                Personnel depuis les vraies données client (filtré niveau ≥ 7)
              </p>
            </div>
            {messagesEnabled && (
              <div className="flex items-center gap-2 text-green-600">
                <Mail className="h-4 w-4" />
                <span className="text-sm">Messagerie activée</span>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {member.firstName?.[0]}
                            {member.lastName?.[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {member.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.email}</div>
                    {member.phone && (
                      <div className="text-sm text-gray-500">
                        {member.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getRoleColor(member.level)}`}
                    >
                      {member.role} (Niv. {member.level})
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(member.isActive)}`}
                    >
                      {member.isActive ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/users/${member.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Détails
                      </Link>
                      {messagesEnabled && (
                        <Link
                          to={`/admin/messages?staff=${member.id}`}
                          className="text-green-600 hover:text-green-900"
                        >
                          Messages
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {staff.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Aucun staff trouvé
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Aucun utilisateur avec un niveau ≥ 7 n'a été trouvé.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Information sur la table des messages */}
      {messagesEnabled && (
        <div className="mt-8 p-6 bg-primary/5 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Système de Messagerie Intégré
              </h3>
              <p className="text-blue-800 mb-4">
                La table{" "}
                <code className="bg-primary/15 px-2 py-1 rounded">
                  ___xtr_msg
                </code>{" "}
                est disponible pour la gestion des communications entre clients
                et staff.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">
                    Fonctionnalités disponibles :
                  </h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>
                      • Messages client ↔ staff (msg_cst_id ↔ msg_cnfa_id)
                    </li>
                    <li>• Suivi des commandes (msg_ord_id, msg_orl_id)</li>
                    <li>• Fils de discussion (msg_parent_id)</li>
                    <li>• Statuts ouvert/fermé (msg_open, msg_close)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">
                    Structure des données :
                  </h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>
                      • <code>msg_cnfa_id</code> : Lien vers ce staff admin
                    </li>
                    <li>
                      • <code>msg_cst_id</code> : Lien vers client
                      (___xtr_customer)
                    </li>
                    <li>
                      • <code>msg_subject</code> : Sujet du message
                    </li>
                    <li>
                      • <code>msg_content</code> : Contenu complet
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/admin/messages"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                >
                  <MessageSquare className="h-4 w-4" />
                  Accéder à la messagerie
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
