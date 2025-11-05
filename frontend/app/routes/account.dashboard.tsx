import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { 
  User, 
  ShoppingBag, 
  Mail,
  Key
} from "lucide-react";
import { Alert } from '~/components/ui/alert';

import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { ActivityTimeline } from "../components/dashboard/ActivityTimeline";
import { AuthErrorState } from "../components/dashboard/AuthErrorState";
import { QuickActions } from "../components/dashboard/QuickActions";
import { StatCard } from "../components/dashboard/StatCard";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  isPro?: boolean;
  isActive?: boolean;
  level?: number;
  isAdmin?: boolean;
};

type DashboardStats = {
  messages: {
    total: number;
    unread: number;
    threads: number;
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    revenue?: number;
  };
  profile: {
    completeness: number;
    hasActiveSubscription: boolean;
    securityScore: number;
  };
};

type Activity = {
  id: string;
  type: 'order' | 'message' | 'profile' | 'shipping' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'pending' | 'error';
};

interface LoaderData {
  user: User;
  stats: DashboardStats;
  recentActivity: Activity[];
  mode: {
    enhanced: boolean;
    authenticated: boolean;
    debug: boolean;
  };
  sessionInfo?: any;
}

export const loader: LoaderFunction = async ({ request }) => {
  console.log('🔄 Dashboard unifié - Loader started');

  try {
    // Détecter le mode depuis les paramètres URL
    const url = new URL(request.url);
    const enhanced = url.searchParams.get('enhanced') === 'true';
    const authenticated = url.searchParams.get('strict') === 'true';
    const debug = url.searchParams.get('debug') === 'true';

    const mode = { enhanced, authenticated, debug };
    console.log('🎯 Dashboard mode:', mode);

    // Auth validation
    const authResult = await requireAuth(request);
    
    // Auth stricte si demandée
    if (authenticated && !authResult) {
      console.log('🔒 Strict auth required - redirecting');
      return json({ authenticated: false }, { status: 401 });
    }

    // API Call - même endpoint que les versions précédentes
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const dashboardResponse = await fetch(`${baseUrl}/api/legacy-users/dashboard`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    console.log('📡 Dashboard API status:', dashboardResponse.status);

    if (!dashboardResponse.ok) {
      throw new Response(`Erreur dashboard: ${dashboardResponse.status}`, { 
        status: dashboardResponse.status 
      });
    }

    const dashboardData = await dashboardResponse.json();
    
    // Mock recent activity pour version enhanced
    const recentActivity: Activity[] = enhanced ? [
      {
        id: '1',
        type: 'order',
        title: 'Commande #1234 confirmée',
        description: 'Votre commande a été confirmée et sera expédiée sous 24h',
        timestamp: 'Il y a 2 heures',
        status: 'success'
      },
      {
        id: '2',
        type: 'message',
        title: 'Nouveau message support',
        description: 'Réponse à votre demande de renseignements',
        timestamp: 'Il y a 5 heures',
        status: 'pending'
      },
      {
        id: '3',
        type: 'profile',
        title: 'Profil mis à jour',
        description: 'Vos informations personnelles ont été modifiées',
        timestamp: 'Hier',
        status: 'success'
      }
    ] : [];

    const responseData: LoaderData = {
      user: dashboardData.user,
      stats: dashboardData.stats,
      recentActivity,
      mode,
      ...(debug && { sessionInfo: authResult })
    };

    console.log('✅ Dashboard unifié - Data loaded successfully');
    return json(responseData);

  } catch (error) {
    console.error('❌ Dashboard unifié - Error:', error);
    
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response("Erreur lors du chargement du dashboard", { status: 500 });
  }
};

export default function UnifiedAccountDashboard() {
  const { user, stats, recentActivity, mode, sessionInfo } = useLoaderData<LoaderData>();

  // Mode auth strict - vérification supplémentaire
  if (mode.authenticated && !user) {
    return <AuthErrorState />;
  }

  // Calculs pour les StatCards
  const profileCompleteness = stats.profile.completeness;
  const ordersTrend = stats.orders.completed > 0 ? 
    { value: 12, isPositive: true } : undefined;

  return (
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
              {mode.enhanced ? 'Dashboard enrichi' : 'Vue d\'ensemble de votre compte'}
            </p>
          </div>
          {mode.enhanced && (
            <div className="text-right text-sm text-gray-500">
              <p>Dernière connexion</p>
              <p className="font-medium">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Mes commandes"
            value={stats.orders.total}
            description={`${stats.orders.pending} en cours`}
            icon={ShoppingBag}
            variant={stats.orders.pending > 0 ? "warning" : "default"}
            enhanced={mode.enhanced}
            progress={mode.enhanced ? (stats.orders.completed / stats.orders.total) * 100 : undefined}
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
            variant={stats.profile.securityScore >= 80 ? "success" : "warning"}
            enhanced={mode.enhanced}
            progress={mode.enhanced ? stats.profile.securityScore : undefined}
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
                    {user.isPro ? 'Professionnel' : 'Particulier'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Statut:</span>
                  <span className={`font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {user.isActive ? 'Actif' : 'Inactif'}
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
              Mode: {mode.enhanced ? 'Enrichi' : 'Standard'}
              {mode.authenticated && ' • Auth stricte'}
              {mode.debug && ' • Debug'}
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
  );
}
