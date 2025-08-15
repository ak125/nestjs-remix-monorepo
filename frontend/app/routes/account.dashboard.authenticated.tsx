import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { 
  User, 
  ShoppingBag, 
  MapPin, 
  Mail,
  Key,
  ArrowRight,
  AlertTriangle,
  Package
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tel?: string;
  isPro?: boolean;
  isActive?: boolean;
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
  };
  profile: {
    completeness: number;
    hasActiveSubscription: boolean;
    securityScore: number;
  };
  addresses: {
    billing: number;
    shipping: number;
    total: number;
  };
};

type LoaderData = {
  user: User | null;
  stats: DashboardStats;
  authenticated: boolean;
  sessionInfo: any;
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    // Vérifier l'authentification avec la session
    const authResponse = await fetch(`${baseUrl}/api/legacy-users/debug-session`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    const authResult = await authResponse.json();
    console.log("Dashboard authentifié - Auth check:", authResult.data);

    if (!authResult.success || !authResult.data.isAuthenticated) {
      // Rediriger vers la page de login de test si pas authentifié
      throw new Response("Non authentifié - Veuillez vous connecter", { 
        status: 401,
        headers: {
          'Location': '/test/login'
        }
      });
    }

    // Appeler l'endpoint dashboard authentifié
    const dashboardResponse = await fetch(`${baseUrl}/api/legacy-users/dashboard`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    console.log("Dashboard authentifié - Dashboard status:", dashboardResponse.status);

    if (!dashboardResponse.ok) {
      throw new Response(`Erreur dashboard: ${dashboardResponse.status}`, { 
        status: dashboardResponse.status 
      });
    }

    const dashboardData = await dashboardResponse.json();
    console.log("Dashboard authentifié - Dashboard data:", dashboardData);

    return json<LoaderData>({ 
      user: dashboardData.user,
      stats: dashboardData.stats,
      authenticated: true,
      sessionInfo: authResult.data
    });

  } catch (error) {
    console.error("Dashboard authentifié - Erreur:", error);
    
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response("Erreur lors du chargement du dashboard", { status: 500 });
  }
};

export default function AuthenticatedDashboard() {
  const { user, stats, authenticated, sessionInfo } = useLoaderData<LoaderData>();

  if (!authenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            Non authentifié
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous devez être connecté pour accéder au dashboard.
          </p>
          <Link 
            to="/test/login"
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Dashboard Authentifié - Bienvenue, {user.firstName}
                </h1>
                <p className="text-sm text-gray-600">
                  Session authentifiée - {user.email}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Authentifié
                </Badge>
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  Session: {sessionInfo.sessionId.slice(0, 8)}...
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Messages */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.messages.total}</p>
                  {stats.messages.unread > 0 && (
                    <p className="text-sm text-orange-600">
                      {stats.messages.unread} non lu{stats.messages.unread > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <Mail className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          {/* Commandes */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Commandes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.orders.total}</p>
                  {stats.orders.pending > 0 && (
                    <p className="text-sm text-amber-600">
                      {stats.orders.pending} en cours
                    </p>
                  )}
                </div>
                <ShoppingBag className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          {/* Profil */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Profil</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.profile.completeness}%</p>
                  <p className="text-sm text-gray-500">Complété</p>
                </div>
                <User className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          {/* Sécurité */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sécurité</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.profile.securityScore}%</p>
                  <p className="text-sm text-gray-500">Score sécurité</p>
                </div>
                <Key className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions et informations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Actions rapides
              </h3>
              <div className="space-y-3">
                <Link 
                  to="/account/profile" 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium">Gérer le profil</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                
                <Link 
                  to="/account/orders" 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium">Mes commandes</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
                
                <Link 
                  to="/account/addresses" 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium">Adresses</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations utilisateur
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID utilisateur:</span>
                  <span className="font-mono text-xs">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nom complet:</span>
                  <span>{user.firstName} {user.lastName}</span>
                </div>
                {user.tel && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Téléphone:</span>
                    <span>{user.tel}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Type compte:</span>
                  <span>{user.isPro ? 'Professionnel' : 'Particulier'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Session ID:</span>
                  <span className="font-mono text-xs">{sessionInfo.sessionId}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <Link 
                  to="/test/dashboard"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  ← Retour au dashboard de test
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
