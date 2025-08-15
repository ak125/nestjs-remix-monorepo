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
  Package
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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
    threads: number; // Support threading du MessageModernService
  };
  orders: {
    total: number;
    pending: number;
    completed: number; // Historique complet des commandes
  };
  profile: {
    completeness: number;
    hasActiveSubscription: boolean;
    securityScore: number; // Score sécurité basé sur RGPD/sessions
  };
  addresses: {
    billing: number; // Adresses facturation séparées
    shipping: number; // Adresses livraison séparées  
    total: number;
  };
};

type LoaderData = {
  user: User | null;
  stats: DashboardStats;
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Authentification requise
    const rawUser = await requireAuth(request);
    
    // Cast vers any pour gérer la structure dynamique de données
    const userData = rawUser as any;
    
    // Debug : log de la structure utilisateur
    console.log("Dashboard - User loaded:", {
      hasUser: !!rawUser,
      userKeys: rawUser ? Object.keys(rawUser) : [],
      email: userData?.email || userData?.cst_mail,
      firstName: userData?.firstName || userData?.cst_fname
    });
    
    // Transformation de la structure utilisateur si nécessaire
    const user = userData ? {
      id: userData.id || userData.cst_id,
      email: userData.email || userData.cst_mail,
      firstName: userData.firstName || userData.cst_fname,
      lastName: userData.lastName || userData.cst_name,
      isPro: userData.isPro || userData.cst_is_pro === '1',
      isActive: userData.isActive || userData.cst_activ === '1',
      level: userData.level || parseInt(userData.cst_level || '1'),
      isAdmin: userData.isAdmin || false,
      lastLoginAt: userData.lastLoginAt,
      createdAt: userData.createdAt,
      status: userData.status
    } : null;
    
    // Vérification de la structure de l'utilisateur transformé
    if (!user || !user.email) {
      console.error("User structure invalid after transformation:", user);
      throw new Response("Utilisateur invalide", { status: 401 });
    }
    
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    // Appel à l'endpoint dashboard backend avec authentification
    const response = await fetch(`${baseUrl}/api/legacy-users/dashboard`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    if (!response.ok) {
      console.error(`Dashboard API error: ${response.status}`);
      // En cas d'erreur API, on utilise les données utilisateur de base
      return json<LoaderData>({ 
        user,
        stats: {
          messages: { total: 0, unread: 0, threads: 0 },
          orders: { total: 0, pending: 0, completed: 0 },
          profile: { 
            completeness: (user?.firstName && user?.lastName) ? 80 : 40,
            hasActiveSubscription: false, 
            securityScore: 60 
          },
          addresses: { billing: 0, shipping: 0, total: 0 }
        }
      });
    }

    const dashboardData = await response.json();
    return json<LoaderData>({ 
      user, 
      stats: dashboardData.stats || {
        messages: { total: 0, unread: 0, threads: 0 },
        orders: { total: 0, pending: 0, completed: 0 },
        profile: { 
          completeness: (user?.firstName && user?.lastName) ? 80 : 40,
          hasActiveSubscription: false, 
          securityScore: 60 
        },
        addresses: { billing: 0, shipping: 0, total: 0 }
      }
    });
  } catch (error) {
    // Si c'est une redirection d'auth, on la laisse passer
    if (error instanceof Response) {
      throw error;
    }
    
    console.error("Erreur lors du chargement du dashboard:", error);
    return json<LoaderData>({ 
      user: null, 
      stats: {
        messages: { total: 0, unread: 0, threads: 0 },
        orders: { total: 0, pending: 0, completed: 0 },
        profile: { completeness: 0, hasActiveSubscription: false, securityScore: 0 },
        addresses: { billing: 0, shipping: 0, total: 0 }
      }
    });
  }
};

// Composant StatCard moderne avec shadcn/ui
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
}

function StatCard({ title, value, description, icon: Icon, variant = "default", trend }: StatCardProps) {
  const variantClasses = {
    default: "border-gray-200 bg-white",
    success: "border-green-200 bg-green-50",
    warning: "border-yellow-200 bg-yellow-50",
    destructive: "border-red-200 bg-red-50"
  };

  const iconClasses = {
    default: "text-gray-600",
    success: "text-green-600",
    warning: "text-yellow-600",
    destructive: "text-red-600"
  };

  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md", variantClasses[variant])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {trend && (
                <div className={cn(
                  "flex items-center text-sm",
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
            <Icon className={cn("w-8 h-8", iconClasses[variant])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Composant MenuCard pour les actions rapides
interface MenuCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number | null;
  urgency?: "low" | "medium" | "high";
}

function MenuCard({ title, description, icon: Icon, href, badge, urgency }: MenuCardProps) {
  const urgencyColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-red-100 text-red-800"
  };

  return (
    <Link to={href} className="block">
      <Card className="transition-all duration-200 hover:shadow-md hover:bg-gray-50 group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{description}</p>
                {urgency && (
                  <Badge className={cn("mt-2", urgencyColors[urgency])}>
                    {urgency === "high" && "Urgent"}
                    {urgency === "medium" && "Important"}
                    {urgency === "low" && "Normal"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {badge !== null && badge !== undefined && badge > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {badge}
                </Badge>
              )}
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AccountDashboard() {
  const { user, stats } = useLoaderData<LoaderData>();

  // Configuration des éléments du menu avec urgence basée sur les stats
  const menuItems: Array<{
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    badge?: number | null;
    urgency?: "low" | "medium" | "high";
  }> = [
    {
      title: "Profil utilisateur",
      description: "Gérer vos informations personnelles et préférences",
      icon: User,
      href: "/account/profile",
      badge: stats.profile.completeness < 100 ? 1 : null,
      urgency: stats.profile.completeness < 50 ? "high" : undefined
    },
    {
      title: "Mes commandes",
      description: "Suivre vos commandes et historique d'achats (Migration complète)",
      icon: ShoppingBag,
      href: "/account/orders",
      badge: stats.orders.pending,
      urgency: stats.orders.pending > 0 ? "medium" : undefined
    },
    {
      title: "Mes adresses",
      description: "Gérer adresses facturation et livraison (CRUD complet)",
      icon: MapPin,
      href: "/account/addresses",
      badge: stats.addresses.total === 0 ? 1 : null,
      urgency: stats.addresses.total === 0 ? "high" : undefined
    },
    {
      title: "Messages & Notifications",
      description: "Messagerie interne avec threading (MessageModernService)",
      icon: Mail,
      href: "/account/messages",
      badge: stats.messages.unread,
      urgency: stats.messages.unread > 5 ? "high" : stats.messages.unread > 0 ? "medium" : undefined
    },
    {
      title: "Sécurité & Mot de passe",
      description: "Sécurité renforcée (bcrypt, JWT, tokens sécurisés)",
      icon: Key,
      href: "/account/security",
      badge: stats.profile.securityScore < 70 ? 1 : null,
      urgency: stats.profile.securityScore < 50 ? "high" : stats.profile.securityScore < 70 ? "medium" : undefined
    }
  ];

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
        {/* En-tête avec informations utilisateur */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-700 border-0">
            <CardContent className="p-8 text-white">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/20 rounded-full">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">
                    Bonjour, {user.firstName || (user.email ? user.email.split('@')[0] : 'Utilisateur')} ! 👋
                  </h1>
                  <p className="text-white/80 text-lg">
                    Voici un aperçu de votre activité récente
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/60">Dernière connexion</p>
                  <p className="text-white font-medium">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR') : "Aujourd'hui"}
                  </p>
                </div>
              </div>
              
              {/* Barre de progression du profil */}
              {stats.profile.completeness < 100 && (
                <div className="mt-6 p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-medium">Complétude du profil</span>
                    <span className="text-white font-bold">{stats.profile.completeness}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-white h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${stats.profile.completeness}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-white/60 mt-2">
                    Complétez votre profil pour débloquer toutes les fonctionnalités
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Actions rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/account/orders" className="block">
              <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 hover:shadow-lg transition-all duration-200 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg">
                      <ShoppingBag className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">Mes commandes</h3>
                      <p className="text-white/80 text-sm">Voir toutes vos commandes</p>
                    </div>
                    {stats.orders.pending > 0 && (
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/20">
                        {stats.orders.pending}
                      </Badge>
                    )}
                    <ArrowRight className="w-5 h-5 text-white/60" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/orders/new" className="block">
              <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white border-0 hover:shadow-lg transition-all duration-200 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">Nouvelle commande</h3>
                      <p className="text-white/80 text-sm">Passer une commande</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/60" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/account/messages" className="block">
              <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white border-0 hover:shadow-lg transition-all duration-200 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">Messages</h3>
                      <p className="text-white/80 text-sm">Centre de messages</p>
                    </div>
                    {stats.messages.unread > 0 && (
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/20">
                        {stats.messages.unread}
                      </Badge>
                    )}
                    <ArrowRight className="w-5 h-5 text-white/60" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Statistiques rapides - Services modernisés */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Messages"
            value={stats.messages.total}
            description={`${stats.messages.unread} non lus • ${stats.messages.threads} fils`}
            icon={Mail}
            variant={stats.messages.unread > 0 ? "warning" : "default"}
            trend={stats.messages.threads > 0 ? { value: 12, isPositive: true } : undefined}
          />
          <StatCard
            title="Commandes"
            value={stats.orders.total}
            description={`${stats.orders.pending} en cours • ${stats.orders.completed} terminées`}
            icon={Package}
            variant={stats.orders.pending > 0 ? "success" : "default"}
            trend={{ value: 8, isPositive: stats.orders.completed > stats.orders.pending }}
          />
          <StatCard
            title="Sécurité"
            value={`${stats.profile.securityScore}/100`}
            description="Score de sécurité RGPD"
            icon={Key}
            variant={stats.profile.securityScore < 70 ? "destructive" : stats.profile.securityScore < 90 ? "warning" : "success"}
            trend={{ value: 5, isPositive: stats.profile.securityScore > 70 }}
          />
          <StatCard
            title="Adresses"
            value={stats.addresses.total}
            description={`${stats.addresses.billing} facturation • ${stats.addresses.shipping} livraison`}
            icon={MapPin}
            variant={stats.addresses.total === 0 ? "destructive" : "default"}
          />
        </div>

        {/* Menu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {menuItems.map((item, index) => (
            <MenuCard
              key={index}
              title={item.title}
              description={item.description}
              icon={item.icon}
              href={item.href}
              badge={item.badge}
              urgency={item.urgency}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
