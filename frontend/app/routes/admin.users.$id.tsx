import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  MapPin,
  ShoppingBag,
  Award,
  Calendar,
  TrendingUp,
  Building2,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Alert, Badge } from "~/components/ui";
import { Button } from "~/components/ui/button";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  city?: string;
  isPro: boolean;
  isCompany: boolean;
  level: number;
  isActive: boolean;
  phone?: string;
  mobile?: string;
  address?: string;
  zipCode?: string;
  country?: string;
  siret?: string;
  companyName?: string;
  totalOrders?: number;
  totalSpent?: number;
}

interface UserStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
  firstOrderDate: string | null;
  paymentRate: number;
  accountAge: number;
  registrationDate: string | null;
}

interface Order {
  id: string;
  date: string;
  total: number;
  isPaid: boolean;
  status: string;
  info: string | null;
}

interface LoaderData {
  targetUser: User;
  stats: UserStats;
  recentOrders: Order[];
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = params.id;

  if (!userId) {
    throw new Response("Utilisateur non trouvé", { status: 404 });
  }

  console.log(`🔍 [Frontend] Chargement utilisateur avec ID: ${userId}`);

  try {
    const cookie = request.headers.get("Cookie") || "";

    // Récupérer les détails de l'utilisateur depuis l'API admin legacy
    const response = await fetch(
      `http://127.0.0.1:3000/api/legacy-users/${userId}`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ [Frontend] API /api/legacy-users/${userId} returned ${response.status}:`,
        errorText,
      );

      throw new Response(
        `Utilisateur non trouvé avec l'ID: ${userId}. Vérifiez que cet ID existe dans la base de données.`,
        { status: 404 },
      );
    }

    const data = await response.json();
    console.log(`✅ [Frontend] Utilisateur chargé:`, {
      id: userId,
      email: data.data?.email || data.email,
    });
    const user = data.data || data;

    // Récupérer les statistiques de l'utilisateur
    let stats: UserStats = {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      lastOrderDate: null,
      firstOrderDate: null,
      paymentRate: 0,
      accountAge: 0,
      registrationDate: null,
    };

    try {
      const statsResponse = await fetch(
        `http://127.0.0.1:3000/api/legacy-users/${userId}/stats`,
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

      console.log(
        `� [Frontend] Stats response status: ${statsResponse.status}`,
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        stats = statsData.data || statsData;
        console.log(`✅ [Frontend] Stats chargées:`, stats);
      } else {
        const errorText = await statsResponse.text();
        console.error(
          `❌ [Frontend] Erreur stats (${statsResponse.status}):`,
          errorText,
        );
      }
    } catch (error) {
      console.warn("⚠️ [Frontend] Impossible de récupérer les stats:", error);
    }

    // Récupérer les commandes récentes de l'utilisateur
    let recentOrders: Order[] = [];

    try {
      const ordersResponse = await fetch(
        `http://127.0.0.1:3000/api/legacy-users/${userId}/orders?limit=5`,
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

      console.log(
        `📦 [Frontend] Orders response status: ${ordersResponse.status}`,
      );

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        const orders = ordersData.data || ordersData.orders || [];
        recentOrders = orders.map((order: any) => ({
          id: order.id,
          date: order.date || order.ord_date,
          total: parseFloat(order.total || order.ord_total_ttc || 0),
          isPaid: order.isPaid || order.ord_paye === 1,
          status: order.status || (order.ord_paye === 1 ? "paid" : "pending"),
          info: order.info || order.ord_info || null,
        }));
        console.log(
          `✅ [Frontend] Orders chargées: ${recentOrders.length} commandes récentes`,
        );
      } else {
        const errorText = await ordersResponse.text();
        console.error(
          `❌ [Frontend] Erreur orders (${ordersResponse.status}):`,
          errorText,
        );
      }
    } catch (error) {
      console.warn(
        "⚠️ [Frontend] Impossible de récupérer les commandes:",
        error,
      );
    }

    return json<LoaderData>({
      targetUser: {
        ...user,
        totalOrders: stats.totalOrders,
        totalSpent: stats.totalSpent,
      },
      stats,
      recentOrders,
    });
  } catch (error) {
    console.error("Erreur lors du chargement de l'utilisateur:", error);
    throw new Response("Erreur lors du chargement de l'utilisateur", {
      status: 500,
    });
  }
};

export function ErrorBoundary() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/users">
          <button className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </button>
        </Link>
      </div>

      <div className="space-y-4">
        <Alert
          intent="error"
          variant="solid"
          icon={<User className="w-6 h-6" />}
          title="Utilisateur non trouvé"
        >
          L'ID utilisateur spécifié n'existe pas dans la base de données.
        </Alert>

        <div className="bg-white border border-gray-200 rounded p-4">
          <h3 className="font-semibold mb-2">Suggestions :</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>Vérifiez que l'ID utilisateur est correct</li>
            <li>L'utilisateur a peut-être été supprimé</li>
            <li>
              Retournez à la liste des utilisateurs pour en sélectionner un
              autre
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <Link to="/admin/users">
            <Button className="px-4 py-2  rounded-md" variant="blue">
              \n Voir tous les utilisateurs\n
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UserDetails() {
  const { targetUser: user, stats, recentOrders } = useLoaderData<LoaderData>();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateString));
  };

  const formatDateShort = (dateString: string) => {
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(dateString));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/users">
                <button className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-gray-50 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                    <User className="w-6 h-6" />
                  </div>
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : "Utilisateur sans nom"}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-gray-600">{user.email}</p>
                  <Badge
                    variant={user.isActive ? "success" : "default"}
                    size="sm"
                  >
                    {user.isActive ? "🟢 Actif" : "⚪ Inactif"}
                  </Badge>
                  {user.isPro && (
                    <Badge
                      variant="info"
                      size="sm"
                      icon={<Award className="w-3 h-3" />}
                    >
                      Pro
                    </Badge>
                  )}
                  {user.isCompany && (
                    <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Entreprise
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link to={`/admin/users/${user.id}/edit`}>
                <button className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 transition-colors">
                  ✏️ Modifier
                </button>
              </Link>
              <button
                className={`px-4 py-2 text-sm rounded-md text-white transition-colors ${
                  user.isActive
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-success hover:bg-success/90"
                }`}
              >
                {user.isActive ? "🚫 Désactiver" : "✅ Activer"}
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-muted rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.totalOrders}
              </div>
              <div className="text-sm text-gray-600 font-medium">Commandes</div>
            </div>
          </div>

          <div className="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-success/10 rounded-lg">
                  <CreditCard className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Dépensé
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {formatCurrency(stats.totalSpent)}
              </div>
              <div className="text-sm text-gray-600 font-medium">Total TTC</div>
            </div>
          </div>

          <div className="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-muted rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Panier moyen
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {formatCurrency(stats.averageOrderValue)}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Par commande
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-muted rounded-lg">
                  <CheckCircle className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Taux
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.paymentRate}%
              </div>
              <div className="text-sm text-gray-600 font-medium">
                {stats.completedOrders}/{stats.totalOrders} payées
              </div>
            </div>
          </div>
        </div>

        {/* Informations détaillées */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informations personnelles */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
              <div className="p-2 bg-muted rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Informations personnelles
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  ID Utilisateur
                </label>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                  {user.id}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <a
                    href={`mailto:${user.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {user.email}
                  </a>
                </div>
              </div>

              {user.phone && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Téléphone fixe
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <a
                      href={`tel:${user.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {user.phone}
                    </a>
                  </div>
                </div>
              )}

              {user.mobile && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Téléphone mobile
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <a
                      href={`tel:${user.mobile}`}
                      className="text-blue-600 hover:underline"
                    >
                      {user.mobile}
                    </a>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Niveau client
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-lg ${i < user.level ? "text-yellow-500" : "text-gray-300"}`}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    Niveau {user.level}
                  </span>
                </div>
              </div>

              {user.isCompany && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      Informations entreprise
                    </label>
                  </div>
                  {user.companyName && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Raison sociale
                      </label>
                      <p className="mt-1 font-medium">{user.companyName}</p>
                    </div>
                  )}
                  {user.siret && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        SIRET
                      </label>
                      <p className="mt-1 font-mono text-sm bg-gray-100 p-2 rounded">
                        {user.siret}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Adresse */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Adresse</h3>
            </div>
            <div className="space-y-3">
              {user.address && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rue
                  </label>
                  <p className="mt-1">{user.address}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {user.zipCode && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Code postal
                    </label>
                    <p className="mt-1 font-medium">{user.zipCode}</p>
                  </div>
                )}

                {user.city && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ville
                    </label>
                    <p className="mt-1 font-medium">{user.city}</p>
                  </div>
                )}
              </div>

              {user.country && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Pays
                  </label>
                  <p className="mt-1">{user.country}</p>
                </div>
              )}

              {!user.city && !user.address && (
                <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                  <AlertCircle className="w-5 h-5" />
                  <p className="italic">Aucune adresse renseignée</p>
                </div>
              )}
            </div>
          </div>

          {/* Activité */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Activité</h3>
            </div>
            <div className="space-y-4">
              <Alert className="rounded-lg p-4" variant="info">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <label className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                    Première commande
                  </label>
                </div>
                <p className="text-sm text-blue-900 font-medium">
                  {formatDate(stats.firstOrderDate)}
                </p>
              </Alert>

              <Alert className="rounded-lg p-4" variant="success">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <label className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                    Dernière commande
                  </label>
                </div>
                <p className="text-sm text-green-900 font-medium">
                  {formatDate(stats.lastOrderDate)}
                </p>
              </Alert>

              <Alert className="rounded-lg p-4" variant="default">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <label className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                    Ancienneté
                  </label>
                </div>
                <p className="text-sm text-purple-900 font-medium">
                  {stats.accountAge} jours
                  {stats.accountAge > 365 && (
                    <span className="text-xs ml-2">
                      (~{Math.floor(stats.accountAge / 365)} an
                      {Math.floor(stats.accountAge / 365) > 1 ? "s" : ""})
                    </span>
                  )}
                </p>
              </Alert>

              <div className="grid grid-cols-2 gap-3">
                <Alert className="rounded-lg p-3 text-center" variant="success">
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-green-700">
                    {stats.completedOrders}
                  </div>
                  <div className="text-xs text-green-600">Payées</div>
                </Alert>
                <Alert className="rounded-lg p-3 text-center" variant="warning">
                  <XCircle className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-orange-700">
                    {stats.pendingOrders}
                  </div>
                  <div className="text-xs text-orange-600">En attente</div>
                </Alert>
              </div>
            </div>
          </div>
        </div>

        {/* Commandes récentes */}
        {recentOrders.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Commandes récentes
                </h3>
              </div>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {recentOrders.length} dernières
              </span>
            </div>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-info/20/30 transition-all duration-200"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Gauche: ID et Date */}
                    <div className="flex-shrink-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-md">
                          #{order.id}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${
                            order.isPaid
                              ? "bg-success/20 text-success border border-green-200"
                              : "bg-orange-100 text-orange-800 border border-orange-200"
                          }`}
                        >
                          {order.isPaid ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              Payée
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              En attente
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDateShort(order.date)}
                      </div>
                    </div>

                    {/* Centre: Informations */}
                    {order.info && (
                      <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Informations complémentaires
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                          {order.info.includes("{") ? (
                            // Si c'est du JSON, essayer de le parser et l'afficher proprement
                            <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                              {JSON.stringify(JSON.parse(order.info), null, 2)}
                            </pre>
                          ) : (
                            // Sinon afficher tel quel, en remplaçant les <br> par des sauts de ligne
                            <HtmlContent
                              html={order.info.replace(/<br>/g, "<br/>")}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Droite: Montant et Actions */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-3">
                      <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                          Montant
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatCurrency(order.total)}
                        </div>
                      </div>
                      <Link
                        to={`/orders/${order.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        Voir détails
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Lien vers toutes les commandes */}
            {stats.totalOrders > recentOrders.length && (
              <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                <Link
                  to={`/admin/orders?userId=${user.id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Voir toutes les {stats.totalOrders} commandes
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Actions rapides */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
          <h3 className="text-lg font-semibold mb-5 pb-3 border-b border-gray-200 text-gray-900">
            Actions rapides
          </h3>
          <div className="flex gap-3 flex-wrap">
            <a
              href={`mailto:${user.email}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-info bg-info/10 border border-blue-200 rounded-lg hover:bg-info/20 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
            >
              <Mail className="w-4 h-4" />
              Envoyer un email
            </a>
            <Link
              to={`/admin/orders?userId=${user.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              Toutes ses commandes ({stats.totalOrders})
            </Link>
            <Link
              to={`/admin/users/${user.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow"
            >
              ✏️ Modifier le profil
            </Link>
            {user.phone && (
              <a
                href={`tel:${user.phone}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-success bg-success/10 border border-green-200 rounded-lg hover:bg-success/20 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow"
              >
                <Phone className="w-4 h-4" />
                Appeler
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
