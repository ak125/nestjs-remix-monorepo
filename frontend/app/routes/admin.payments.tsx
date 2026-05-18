// app/routes/admin.payments.tsx
// Tableau de bord paiements optimisé appliquant "vérifier existant et utiliser le meilleur"

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, useLoaderData, NavLink } from "@remix-run/react";
import {
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Calendar,
} from "lucide-react";
import { Alert } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { requireAuth } from "../auth/unified.server";

export const meta: MetaFunction = () => [
  { title: "Paiements | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/admin/payments",
  },
];

// Interface pour les données de paiements
interface PaymentStats {
  totalRevenue: number;
  pendingPayments: number;
  completedToday: number;
  failedPayments: number;
  averageAmount: number;
  transactionCount: number;
  conversionRate: number;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  // Vérifier permissions admin (niveau 7+)
  if (!user.level || user.level < 7) {
    throw new Response("Accès refusé - Permissions administrateur requises", {
      status: 403,
    });
  }

  // En production, récupérer les vraies données des paiements
  const paymentStats: PaymentStats = {
    totalRevenue: 847620.5,
    pendingPayments: 23,
    completedToday: 167,
    failedPayments: 5,
    averageAmount: 234.8,
    transactionCount: 3608,
    conversionRate: 94.2,
  };

  return json({ user, paymentStats });
}

export default function AdminPaymentsLayout() {
  const { paymentStats } = useLoaderData<typeof loader>();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CreditCard className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Gestion des Paiements</h1>
              <p className="text-green-100 text-lg mt-1">
                Administration des transactions et revenus
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-lg">
            <div className="flex items-center gap-2 text-green-200">
              <TrendingUp className="h-5 w-5" />
              <span className="font-semibold">+12.4% ce mois</span>
            </div>
            <div className="text-sm text-green-100 mt-1">
              Croissance des revenus
            </div>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Revenus totaux */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Revenus</h2>
            </div>
            <Alert intent="success">TOTAL</Alert>
          </div>

          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatCurrency(paymentStats.totalRevenue)}
          </div>
          <p className="text-sm text-green-600">
            {paymentStats.transactionCount.toLocaleString()} transactions
          </p>
        </div>

        {/* Paiements en attente */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                En Attente
              </h2>
            </div>
            <Badge
              className="px-2 py-1 rounded text-sm font-medium"
              variant="orange"
            >
              PENDING
            </Badge>
          </div>

          <div className="text-3xl font-bold text-gray-900 mb-2">
            {paymentStats.pendingPayments}
          </div>
          <p className="text-sm text-gray-600">Nécessitent validation</p>
        </div>

        {/* Paiements complétés */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Aujourd'hui
              </h2>
            </div>
            <Alert intent="info">COMPLÉTÉ</Alert>
          </div>

          <div className="text-3xl font-bold text-gray-900 mb-2">
            {paymentStats.completedToday}
          </div>
          <p className="text-sm text-blue-600">
            {formatCurrency(paymentStats.averageAmount)} / transaction
          </p>
        </div>

        {/* Échecs de paiements */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Échecs</h2>
            </div>
            <Alert intent="error">ERREUR</Alert>
          </div>

          <div className="text-3xl font-bold text-gray-900 mb-2">
            {paymentStats.failedPayments}
          </div>
          <p className="text-sm text-gray-600">
            Taux de succès: {paymentStats.conversionRate}%
          </p>
        </div>
      </div>

      {/* Navigation des sous-routes */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <nav className="flex space-x-8">
          <NavLink
            to="/admin/payments"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-600 hover:text-green-600"
              }`
            }
          >
            <CreditCard className="h-5 w-5" />
            Aperçu
          </NavLink>

          <NavLink
            to="/admin/payments/transactions"
            className={({ isActive }) =>
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-600 hover:text-green-600"
              }`
            }
          >
            <Users className="h-5 w-5" />
            Transactions
          </NavLink>

          <NavLink
            to="/admin/payments/reports"
            className={({ isActive }) =>
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-600 hover:text-green-600"
              }`
            }
          >
            <Calendar className="h-5 w-5" />
            Rapports
          </NavLink>
        </nav>
      </div>

      {/* Contenu des sous-routes */}
      <div className="bg-white rounded-lg shadow-lg">
        <Outlet />
      </div>
    </div>
  );
}
