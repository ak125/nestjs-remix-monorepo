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
  TrendingUp,
  Package,
  Heart,
  CreditCard,
  ChevronRight,
  Activity,
  Calendar,
  Shield
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { requireAuth } from "../auth/unified.server";
import { cn } from "../lib/utils";

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
    totalSpent: number;
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
  activity: {
    lastOrderDate?: string;
    totalSessions: number;
    averageSessionTime: number;
  };
};

type RecentActivity = {
  id: string;
  type: 'order' | 'message' | 'profile' | 'security';
  title: string;
  description: string;
  date: string;
  status?: string;
};

type QuickAction = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  variant: 'primary' | 'secondary' | 'outline';
  badge?: number;
};

type LoaderData = {
  user: User | null;
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  quickActions: QuickAction[];
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    // Appel à l'endpoint dashboard avec données enrichies
    const response = await fetch(`${baseUrl}/api/users/dashboard`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    let stats: DashboardStats = {
      messages: { total: 0, unread: 0, threads: 0 },
      orders: { total: 0, pending: 0, completed: 0, totalSpent: 0 },
      profile: { 
        completeness: user?.firstName && user?.lastName ? 80 : 40,
        hasActiveSubscription: false, 
        securityScore: 75 
      },
      addresses: { billing: 0, shipping: 0, total: 0 },
      activity: {
        totalSessions: 12,
        averageSessionTime: 15,
        lastOrderDate: '2025-08-01'
      }
    };

    if (response.ok) {
      const dashboardData = await response.json();
      stats = { ...stats, ...dashboardData.stats };
    }

    // Activité récente simulée (à remplacer par vraies données)
    const recentActivity: RecentActivity[] = [
      {
        id: '1',
        type: 'order',
        title: 'Nouvelle commande',
        description: 'Commande #CMD-2025-001 passée avec succès',
        date: '2025-08-12',
        status: 'pending'
      },
      {
        id: '2',
        type: 'message',
        title: 'Message reçu',
        description: 'Support client : Réponse à votre demande',
        date: '2025-08-11'
      },
      {
        id: '3',
        type: 'profile',
        title: 'Profil mis à jour',
        description: 'Adresse de livraison modifiée',
        date: '2025-08-10'
      }
    ];

    // Actions rapides personnalisées
    const quickActions: QuickAction[] = [
      {
        title: 'Nouvelle commande',
        description: 'Passer une commande rapidement',
        icon: ShoppingBag,
        href: '/orders/new',
        variant: 'primary'
      },
      {
        title: 'Mes favoris',
        description: 'Produits sauvegardés',
        icon: Heart,
        href: '/account/favorites',
        variant: 'secondary',
        badge: 5
      },
      {
        title: 'Moyens de paiement',
        description: 'Gérer vos cartes',
        icon: CreditCard,
        href: '/account/payment-methods',
        variant: 'outline'
      }
    ];

    return json<LoaderData>({ 
      user, 
      stats,
      recentActivity,
      quickActions
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    console.error("Erreur lors du chargement du dashboard:", error);
    return json<LoaderData>({ 
      user: null, 
      stats: {
        messages: { total: 0, unread: 0, threads: 0 },
        orders: { total: 0, pending: 0, completed: 0, totalSpent: 0 },
        profile: { completeness: 0, hasActiveSubscription: false, securityScore: 0 },
        addresses: { billing: 0, shipping: 0, total: 0 },
        activity: { totalSessions: 0, averageSessionTime: 0 }
      },
      recentActivity: [],
      quickActions: []
    });
  }
};

// Composant StatCard amélioré
interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "destructive";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

function StatCard({ title, value, description, icon: Icon, variant = "default", trend, onClick }: StatCardProps) {
  const variantClasses = {
    default: "border-gray-200 bg-gradient-to-br from-white to-gray-50",
    success: "border-green-200 bg-gradient-to-br from-green-50 to-green-100",
    warning: "border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100",
    destructive: "border-red-200 bg-gradient-to-br from-red-50 to-red-100"
  };

  const iconClasses = {
    default: "text-gray-600",
    success: "text-green-600",
    warning: "text-yellow-600",
    destructive: "text-red-600"
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer", 
        variantClasses[variant]
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {trend && (
                <div className={cn(
                  "flex items-center text-sm font-medium",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}>
                  <TrendingUp className={cn(
                    "w-4 h-4 mr-1",
                    !trend.isPositive && "rotate-180"
                  )} />
                  {Math.abs(trend.value)}%
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          <div className="ml-4">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <Icon className={cn("w-6 h-6", iconClasses[variant])} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Composant QuickActionCard
interface QuickActionCardProps {
  action: QuickAction;
}

function QuickActionCard({ action }: QuickActionCardProps) {
  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600",
    secondary: "bg-gradient-to-r from-purple-600 to-purple-700 text-white border-purple-600",
    outline: "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"
  };

  return (
    <Link to={action.href}>
      <Card className={cn(
        "transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer",
        variantClasses[action.variant]
      )}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-lg",
              action.variant === 'outline' ? "bg-gray-100" : "bg-white/20"
            )}>
              <action.icon className={cn(
                "w-6 h-6",
                action.variant === 'outline' ? "text-gray-600" : "text-white"
              )} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{action.title}</h3>
              <p className={cn(
                "text-sm",
                action.variant === 'outline' ? "text-gray-600" : "text-white/80"
              )}>
                {action.description}
              </p>
            </div>
            {action.badge && (
              <Badge variant="secondary" className="ml-2">
                {action.badge}
              </Badge>
            )}
            <ArrowRight className={cn(
              "w-5 h-5",
              action.variant === 'outline' ? "text-gray-400" : "text-white/60"
            )} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Composant ActivityItem
interface ActivityItemProps {
  activity: RecentActivity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const typeIcons = {
    order: Package,
    message: Mail,
    profile: User,
    security: Shield
  };

  const typeColors = {
    order: "text-blue-600 bg-blue-100",
    message: "text-green-600 bg-green-100",
    profile: "text-purple-600 bg-purple-100",
    security: "text-red-600 bg-red-100"
  };

  const Icon = typeIcons[activity.type];

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className={cn("p-2 rounded-full", typeColors[activity.type])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900">{activity.title}</h4>
        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
        <p className="text-xs text-gray-500 mt-2">
          {new Date(activity.date).toLocaleDateString('fr-FR')}
        </p>
      </div>
      {activity.status && (
        <Badge variant="outline" className="text-xs">
          {activity.status}
        </Badge>
      )}
    </div>
  );
}

export default function AccountDashboard() {
  const { user, stats, recentActivity, quickActions } = useLoaderData<LoaderData>();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Erreur de chargement
            </h2>
            <p className="text-gray-600 mb-4">
              Impossible de charger vos informations. Veuillez réessayer.
            </p>
            <Button asChild>
              <Link to="/account/dashboard">Actualiser</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête avec accueil personnalisé */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-700 border-0">
            <CardContent className="p-8 text-white">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/20 rounded-full">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">
                    Bonjour, {user.firstName || user.email.split('@')[0]} ! 👋
                  </h1>
                  <p className="text-white/80 text-lg">
                    Voici un aperçu de votre activité récente
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-white/80 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Dernière connexion</span>
                  </div>
                  <p className="text-white font-medium">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR') : "Aujourd'hui"}
                  </p>
                </div>
              </div>
              
              {/* Barre de progression du profil */}
              <div className="mt-6 p-4 bg-white/10 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Complétude du profil</span>
                  <span className="text-sm font-bold">{stats.profile.completeness}%</span>
                </div>
                <Progress 
                  value={stats.profile.completeness} 
                  className="h-2 bg-white/20"
                />
                {stats.profile.completeness < 100 && (
                  <p className="text-xs text-white/60 mt-2">
                    Complétez votre profil pour débloquer toutes les fonctionnalités
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <QuickActionCard key={index} action={action} />
            ))}
          </div>
        </div>

        {/* Statistiques */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Vue d'ensemble</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Commandes"
              value={stats.orders.total}
              description={`${stats.orders.pending} en cours`}
              icon={Package}
              variant={stats.orders.pending > 0 ? "success" : "default"}
              trend={{ value: 12, isPositive: true }}
              onClick={() => window.location.href = '/account/orders'}
            />
            <StatCard
              title="Messages"
              value={stats.messages.unread}
              description={`${stats.messages.total} au total`}
              icon={Mail}
              variant={stats.messages.unread > 0 ? "warning" : "default"}
              onClick={() => window.location.href = '/account/messages'}
            />
            <StatCard
              title="Sécurité"
              value={`${stats.profile.securityScore}%`}
              description="Score de sécurité"
              icon={Shield}
              variant={stats.profile.securityScore < 70 ? "destructive" : "success"}
              onClick={() => window.location.href = '/account/security'}
            />
            <StatCard
              title="Dépenses"
              value={`${stats.orders.totalSpent}€`}
              description="Total dépensé"
              icon={CreditCard}
              variant="default"
              trend={{ value: 8, isPositive: false }}
            />
          </div>
        </div>

        {/* Contenu principal en deux colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activité récente */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activité récente
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {recentActivity.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucune activité récente</p>
                  </div>
                )}
                <div className="p-4 border-t bg-gray-50">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/account/activity">
                      Voir toute l'activité
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Navigation rapide */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Menu principal</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {[
                    { title: "Mes commandes", href: "/account/orders", icon: ShoppingBag, badge: stats.orders.pending },
                    { title: "Mon profil", href: "/account/profile", icon: User },
                    { title: "Mes adresses", href: "/account/addresses", icon: MapPin },
                    { title: "Messages", href: "/account/messages", icon: Mail, badge: stats.messages.unread },
                    { title: "Sécurité", href: "/account/security", icon: Key },
                  ].map((item, index) => (
                    <Link
                      key={index}
                      to={item.href}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors group"
                    >
                      <item.icon className="w-5 h-5 text-gray-400 group-hover:text-gray-500" />
                      <span className="flex-1">{item.title}</span>
                      {item.badge && item.badge > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                    </Link>
                  ))}
                </nav>
              </CardContent>
            </Card>

            {/* Carte de support */}
            <Card className="mt-6 bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
              <CardContent className="p-6 text-center">
                <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Besoin d'aide ?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Notre équipe support est là pour vous aider
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/account/messages/new">
                    Contacter le support
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
