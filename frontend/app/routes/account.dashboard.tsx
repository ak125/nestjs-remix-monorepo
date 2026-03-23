import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { User, ShoppingBag, Mail, Key } from "lucide-react";
import { z } from "zod";

import AccountDashboard from "~/components/account/AccountDashboard";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Alert } from "~/components/ui/alert";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { getProxyHeaders } from "~/utils/proxy-headers.server";
import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { ActivityTimeline } from "../components/dashboard/ActivityTimeline";
import { AuthErrorState } from "../components/dashboard/AuthErrorState";
import { QuickActions } from "../components/dashboard/QuickActions";
import { StatCard } from "../components/dashboard/StatCard";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

/**
 * 🔒 SEO Meta Tags - noindex pour espace compte utilisateur
 */
export const meta: MetaFunction = () => [
  { title: "Mon compte | Tableau de bord" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/dashboard",
  },
];

const orderStatusSchema = z.enum([
  "paid",
  "pending",
  "shipped",
  "delivered",
  "cancelled",
]);

const dashboardDataSchema = z.object({
  user: z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    email: z.string().email(),
    firstName: z.string().default(""),
    lastName: z.string().default(""),
    status: z.string().optional(),
    lastLoginAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    isPro: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    level: z.number().optional(),
    isAdmin: z.boolean().optional(),
  }),
  stats: z.object({
    messages: z.object({
      total: z.number().int().nonnegative().default(0),
      unread: z.number().int().nonnegative().default(0),
      threads: z.number().int().nonnegative().default(0),
    }),
    orders: z.object({
      total: z.number().int().nonnegative().default(0),
      pending: z.number().int().nonnegative().default(0),
      completed: z.number().int().nonnegative().default(0),
      revenue: z.number().optional(),
      recent: z
        .array(
          z.object({
            id: z.union([z.string(), z.number()]),
            date: z.string(),
            totalTtc: z.number(),
            status: orderStatusSchema.catch("pending"),
            info: z.string().optional(),
          }),
        )
        .optional(),
    }),
    profile: z.object({
      completeness: z.number().min(0).max(100).default(0),
      hasActiveSubscription: z.boolean().default(false),
      securityScore: z.number().min(0).max(100).default(0),
    }),
  }),
});

type DashboardData = z.infer<typeof dashboardDataSchema>;

type Activity = {
  id: string;
  type: "order" | "message" | "profile" | "shipping" | "payment";
  title: string;
  description: string;
  timestamp: string;
  status?: "success" | "pending" | "error";
};

interface LoaderData {
  user: DashboardData["user"];
  stats: DashboardData["stats"];
  recentActivity: Activity[];
  mode: {
    enhanced: boolean;
    authenticated: boolean;
    debug: boolean;
  };
  sessionInfo?: any;
}

export const loader: LoaderFunction = async ({ request }) => {
  logger.log("🔄 Dashboard unifié - Loader started");

  try {
    // Détecter le mode depuis les paramètres URL
    const url = new URL(request.url);
    const enhanced = url.searchParams.get("enhanced") === "true";
    const authenticated = url.searchParams.get("strict") === "true";
    const debug = url.searchParams.get("debug") === "true";

    const mode = { enhanced, authenticated, debug };
    logger.log("🎯 Dashboard mode:", mode);

    // Auth validation
    const authResult = await requireAuth(request);

    // Auth stricte si demandée
    if (authenticated && !authResult) {
      logger.log("🔒 Strict auth required - redirecting");
      return json({ authenticated: false }, { status: 401 });
    }

    // API Call - même endpoint que les versions précédentes
    const dashboardUrl = getInternalApiUrlFromRequest(
      "/api/legacy-users/dashboard",
      request,
    );
    const dashboardResponse = await fetch(dashboardUrl, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        ...getProxyHeaders(request),
      },
    });

    logger.log("📡 Dashboard API status:", dashboardResponse.status);

    if (!dashboardResponse.ok) {
      throw new Response(`Erreur dashboard: ${dashboardResponse.status}`, {
        status: dashboardResponse.status,
      });
    }

    const rawData = await dashboardResponse.json();
    const parseResult = dashboardDataSchema.safeParse(rawData);

    if (!parseResult.success) {
      logger.error(
        "⚠️ Dashboard data validation failed:",
        parseResult.error.flatten(),
      );
    }

    const dashboardData = parseResult.success ? parseResult.data : rawData;

    // Mock recent activity pour version enhanced
    const recentActivity: Activity[] = enhanced
      ? [
          {
            id: "1",
            type: "order",
            title: "Commande #1234 confirmée",
            description:
              "Votre commande a été confirmée et sera expédiée sous 24h",
            timestamp: "Il y a 2 heures",
            status: "success",
          },
          {
            id: "2",
            type: "message",
            title: "Nouveau message support",
            description: "Réponse à votre demande de renseignements",
            timestamp: "Il y a 5 heures",
            status: "pending",
          },
          {
            id: "3",
            type: "profile",
            title: "Profil mis à jour",
            description: "Vos informations personnelles ont été modifiées",
            timestamp: "Hier",
            status: "success",
          },
        ]
      : [];

    const responseData: LoaderData = {
      user: dashboardData.user,
      stats: dashboardData.stats,
      recentActivity,
      mode,
      ...(debug && { sessionInfo: authResult }),
    };

    logger.log("✅ Dashboard unifié - Data loaded successfully");
    return json(responseData);
  } catch (error) {
    logger.error("❌ Dashboard unifié - Error:", error);

    if (error instanceof Response) {
      throw error;
    }

    throw new Response("Erreur lors du chargement du dashboard", {
      status: 500,
    });
  }
};

export default function UnifiedAccountDashboard() {
  const { user, stats, recentActivity, mode, sessionInfo } =
    useLoaderData<LoaderData>();

  // Mode auth strict - vérification supplémentaire
  if (mode.authenticated && !user) {
    return <AuthErrorState />;
  }

  // Calculs pour les StatCards
  const profileCompleteness = stats.profile.completeness;
  const ordersTrend =
    stats.orders.completed > 0 ? { value: 12, isPositive: true } : undefined;

  return (
    <>
      {/* Mobile Layout (< md) */}
      <div className="md:hidden font-body bg-[var(--navy)]">
        <AccountDashboard user={user} stats={stats} />
      </div>

      {/* Desktop Layout (>= md) */}
      <div className="hidden md:block">
        <AccountLayout user={user} stats={stats}>
          <div className="space-y-6">
            {/* Breadcrumb */}
            <PublicBreadcrumb items={[{ label: "Mon Compte" }]} />

            {/* Debug info */}
            {mode.debug && sessionInfo && (
              <Alert className="rounded-lg p-4 text-sm" variant="warning">
                <strong>Debug Mode:</strong> Session info disponible
                <pre className="mt-2 text-xs overflow-auto">
                  {JSON.stringify({ mode, sessionInfo }, null, 2)}
                </pre>
              </Alert>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Bonjour {user.firstName} 👋
                </h1>
                <p className="text-gray-600">
                  {mode.enhanced
                    ? "Dashboard enrichi"
                    : "Vue d'ensemble de votre compte"}
                </p>
              </div>
              {mode.enhanced && (
                <div className="text-right text-sm text-gray-500">
                  <p>Dernière connexion</p>
                  <p className="font-medium">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              )}
            </div>

            {/* Bandeau Espace Commercial */}
            {user.level && user.level >= 3 && (
              <a
                href="/commercial"
                className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl hover:from-indigo-100 hover:to-purple-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                    <ShoppingBag className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-indigo-800">
                      Espace Commercial
                    </p>
                    <p className="text-sm text-indigo-600">
                      Gerer les commandes, expeditions et clients
                    </p>
                  </div>
                </div>
                <span className="text-indigo-500 group-hover:translate-x-1 transition-transform">
                  &rarr;
                </span>
              </a>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Mes commandes"
                value={stats.orders.total}
                description={`${stats.orders.pending} en cours`}
                icon={ShoppingBag}
                variant={stats.orders.pending > 0 ? "warning" : "default"}
                enhanced={mode.enhanced}
                progress={
                  mode.enhanced
                    ? (stats.orders.completed / stats.orders.total) * 100
                    : undefined
                }
                trend={mode.enhanced ? ordersTrend : undefined}
              />

              <StatCard
                title="Messages"
                value={stats.messages.total}
                description={`${stats.messages.unread} non lus`}
                icon={Mail}
                variant={stats.messages.unread > 0 ? "danger" : "success"}
                enhanced={mode.enhanced}
              />

              <StatCard
                title="Profil"
                value={`${profileCompleteness}%`}
                description="Completé"
                icon={User}
                variant={profileCompleteness >= 80 ? "success" : "warning"}
                enhanced={mode.enhanced}
                progress={mode.enhanced ? profileCompleteness : undefined}
              />

              <StatCard
                title="Sécurité"
                value={stats.profile.securityScore}
                description="Score de sécurité"
                icon={Key}
                variant={
                  stats.profile.securityScore >= 80 ? "success" : "warning"
                }
                enhanced={mode.enhanced}
                progress={
                  mode.enhanced ? stats.profile.securityScore : undefined
                }
              />
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Quick Actions */}
              <QuickActions stats={stats} enhanced={mode.enhanced} />

              {/* Activity Timeline - Enhanced uniquement */}
              {mode.enhanced && (
                <ActivityTimeline activities={recentActivity} enhanced={true} />
              )}

              {/* Mode standard - Navigation simple */}
              {!mode.enhanced && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Informations compte
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type de compte:</span>
                      <span className="font-medium">
                        {user.isPro ? "Professionnel" : "Particulier"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Statut:</span>
                      <span
                        className={`font-medium ${user.isActive ? "text-green-600" : "text-red-600"}`}
                      >
                        {user.isActive ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <p>
                  Mode: {mode.enhanced ? "Enrichi" : "Standard"}
                  {mode.authenticated && " • Auth stricte"}
                  {mode.debug && " • Debug"}
                </p>
                <div className="flex gap-2">
                  {!mode.enhanced && (
                    <a
                      href="/account/dashboard?enhanced=true"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      → Version enrichie
                    </a>
                  )}
                  {mode.enhanced && (
                    <a
                      href="/account/dashboard"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      → Version standard
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </AccountLayout>
      </div>
    </>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
