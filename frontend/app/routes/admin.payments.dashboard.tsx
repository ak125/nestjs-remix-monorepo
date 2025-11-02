import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { 
  Clock, 
  CheckCircle, 
  DollarSign, 
  AlertTriangle, 
  Search, 
  Filter,
  Download,
  Eye,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { requireAdmin } from "../auth/unified.server";
import { getAdminPayments, getPaymentStats } from "../services/payment-admin.server";
import { type Payment, type PaymentStats, PaymentStatus } from "../types/payment";

interface PayboxMonitoring {
  summary: {
    totalTransactions: number;
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
    successRate: number;
    averageAmount: number;
  };
  recentTransactions: any[];
  chartData: {
    dates: string[];
    transactions: number[];
    amounts: number[];
  };
}

interface PayboxHealth {
  status: string;
  config: {
    site: string;
    rang: string;
    identifiant: string;
    hmacKey: string;
    mode: string;
    paymentUrl: string;
  };
  lastCheck: string;
}

interface LoaderData {
  payments: Payment[];
  stats: PaymentStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  payboxMonitoring: PayboxMonitoring | null;
  payboxHealth: PayboxHealth | null;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  console.log('🔧 DEBUG - Payments dashboard loader started');
  
  await requireAdmin({ context });
  
  try {
    console.log('🔧 DEBUG - Admin auth passed, fetching payments...');
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    // Par défaut, afficher uniquement les paiements complétés (payés)
    const status = url.searchParams.get('status') || PaymentStatus.COMPLETED;
    
    // Récupération des données Paybox
    let payboxMonitoring: PayboxMonitoring | null = null;
    let payboxHealth: PayboxHealth | null = null;

    try {
      const [monitoringRes, healthRes] = await Promise.all([
        fetch('http://localhost:3000/api/admin/paybox-monitoring').catch(() => null),
        fetch('http://localhost:3000/api/admin/paybox-health').catch(() => null),
      ]);

      if (monitoringRes?.ok) {
        const monitoringData = await monitoringRes.json();
        payboxMonitoring = monitoringData.data;
      }

      if (healthRes?.ok) {
        const healthData = await healthRes.json();
        payboxHealth = healthData.data;
      }

      console.log('🔧 DEBUG - Paybox data loaded:', {
        monitoringLoaded: !!payboxMonitoring,
        healthLoaded: !!payboxHealth,
        payboxStatus: payboxHealth?.status
      });
    } catch (error) {
      console.error('⚠️ Paybox monitoring unavailable:', error);
    }

    const [paymentsResult, stats] = await Promise.all([
      getAdminPayments({ page, limit, search, status }),
      getPaymentStats(),
    ]);

    console.log('🔧 DEBUG - Payments loaded:', {
      paymentCount: paymentsResult.payments.length,
      totalPayments: paymentsResult.pagination.total,
      statsRevenue: stats.totalRevenue
    });

    return json<LoaderData>({
      payments: paymentsResult.payments,
      stats,
      pagination: paymentsResult.pagination,
      payboxMonitoring,
      payboxHealth,
    });
  } catch (error) {
    console.error("❌ Error loading admin payments:", error);
    return json<LoaderData>({
      payments: [],
      stats: {
        totalRevenue: 0,
        totalTransactions: 0,
        successRate: 0,
        averageAmount: 0,
        monthlyGrowth: 0,
        statusDistribution: {
          completed: 0,
          pending: 0,
          failed: 0,
          cancelled: 0,
          refunded: 0,
        },
        methodDistribution: {
          cyberplus: 0,
          paypal: 0,
          bank_transfer: 0,
        },
        recentPayments: [],
      },
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
      payboxMonitoring: null,
      payboxHealth: null,
    });
  }
}

export default function AdminPaymentsDashboard() {
  const { payments, stats, pagination, payboxMonitoring, payboxHealth } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (search: string) => {
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    navigate(`?${params.toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status && status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    params.set('page', '1');
    navigate(`?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    navigate(`?${params.toString()}`);
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const badges = {
      [PaymentStatus.COMPLETED]: 'bg-success/20 text-success',
      [PaymentStatus.PENDING]: 'bg-warning/20 text-warning',
      [PaymentStatus.PROCESSING]: 'bg-info/20 text-info',
      [PaymentStatus.FAILED]: 'bg-destructive/20 text-destructive',
      [PaymentStatus.CANCELLED]: 'bg-gray-100 text-gray-800',
      [PaymentStatus.REFUNDED]: 'bg-purple-100 text-purple-800',
    };

    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      console.error('Erreur formatage date:', dateString, error);
      return 'Date invalide';
    }
  };

  // ✨ Formater la méthode de paiement pour un affichage lisible
  const formatPaymentMethod = (method: string): string => {
    const methods: Record<string, string> = {
      'card': '💳 CB',
      'cyberplus': '💳 CyberPlus',
      'stripe': '💳 Stripe',
      'paypal': '🅿️ PayPal',
      'bank_transfer': '🏦 Virement',
      'check': '📝 Chèque',
    };
    return methods[method?.toLowerCase()] || `💳 ${method || 'CB'}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestion des Paiements
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Administration et suivi des transactions
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </button>
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Section Monitoring Paybox */}
        {(payboxMonitoring || payboxHealth) && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg mb-8 overflow-hidden border border-blue-200">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-lg p-2">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      🔵 Monitoring Paybox
                    </h2>
                    <p className="text-blue-100 text-sm">
                      Surveillance en temps réel des transactions Paybox/Verifone
                    </p>
                  </div>
                </div>
                {payboxHealth && (
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      payboxHealth.status === 'healthy' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {payboxHealth.status === 'healthy' ? '✓ En ligne' : '✗ Hors ligne'}
                    </span>
                    <span className="text-white text-xs bg-white/20 px-2 py-1 rounded">
                      {payboxHealth.config.mode}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {payboxMonitoring && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Total Transactions */}
                  <div className="bg-white rounded-lg shadow p-4 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Transactions Paybox
                        </p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {payboxMonitoring.summary.totalTransactions}
                        </p>
                      </div>
                      <div className="bg-blue-100 rounded-full p-3">
                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Montant Total */}
                  <div className="bg-white rounded-lg shadow p-4 border border-green-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Montant total
                        </p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {formatPrice(payboxMonitoring.summary.totalAmount)}
                        </p>
                      </div>
                      <div className="bg-green-100 rounded-full p-3">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  {/* Taux de succès */}
                  <div className="bg-white rounded-lg shadow p-4 border border-emerald-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Taux de succès
                        </p>
                        <p className="text-3xl font-bold text-emerald-600 mt-1">
                          {payboxMonitoring.summary.successRate}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payboxMonitoring.summary.successfulPayments} / {payboxMonitoring.summary.totalTransactions}
                        </p>
                      </div>
                      <div className="bg-emerald-100 rounded-full p-3">
                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  {/* Panier moyen */}
                  <div className="bg-white rounded-lg shadow p-4 border border-purple-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Panier moyen
                        </p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {formatPrice(payboxMonitoring.summary.averageAmount)}
                        </p>
                      </div>
                      <div className="bg-purple-100 rounded-full p-3">
                        <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Répartition des statuts */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm text-gray-600">Paiements réussis</p>
                        <p className="text-xl font-bold text-green-700">
                          {payboxMonitoring.summary.successfulPayments}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-sm text-gray-600">Paiements échoués</p>
                        <p className="text-xl font-bold text-red-700">
                          {payboxMonitoring.summary.failedPayments}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm text-gray-600">En attente</p>
                        <p className="text-xl font-bold text-yellow-700">
                          {payboxMonitoring.summary.pendingPayments}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Paybox */}
                {payboxHealth && (
                  <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configuration Paybox
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Site:</span>
                        <span className="ml-2 font-mono font-semibold text-gray-900">{payboxHealth.config.site}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Rang:</span>
                        <span className="ml-2 font-mono font-semibold text-gray-900">{payboxHealth.config.rang}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Identifiant:</span>
                        <span className="ml-2 font-mono font-semibold text-gray-900">{payboxHealth.config.identifiant}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">HMAC:</span>
                        <span className={`ml-2 font-semibold ${payboxHealth.config.hmacKey === 'CONFIGURED' ? 'text-green-600' : 'text-red-600'}`}>
                          {payboxHealth.config.hmacKey === 'CONFIGURED' ? '✓ Configuré' : '✗ Manquant'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Bannière informative */}
        <div className="bg-primary/5 border-l-4 border-blue-400 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>ℹ️ Vue basée sur les commandes payées</strong> - Affiche uniquement les commandes confirmées et payées (hors statut "En attente"). 
                Les données proviennent de la table des commandes.
              </p>
            </div>
          </div>
        </div>
        
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Chiffre d'affaires
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatPrice(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Transactions
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.totalTransactions.toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Taux de succès
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.successRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Montant moyen
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatPrice(stats.averageAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres et recherche */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par ID, email, montant..."
                    defaultValue={searchParams.get('search') || ''}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres
                </button>
                
                <select
                  value={searchParams.get('status') || 'all'}
                  onChange={(e) => handleStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="completed">Complété</option>
                  <option value="pending">En attente</option>
                  <option value="processing">En cours</option>
                  <option value="failed">Échoué</option>
                  <option value="cancelled">Annulé</option>
                  <option value="refunded">Remboursé</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table des paiements */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commande
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Méthode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.id.slice(0, 8)}...
                      </div>
                      <div className="text-sm text-gray-500">
                        {payment.transactionId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.orderId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.customerName || `Client #${payment.userId}`}
                      </div>
                      {payment.customerEmail && (
                        <div className="text-sm text-gray-500">
                          {payment.customerEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(payment.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {payment.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatPaymentMethod(payment.paymentMethod)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payment.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Affichage de{' '}
                    <span className="font-medium">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{' '}
                    à{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    sur{' '}
                    <span className="font-medium">{pagination.total}</span> résultats
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
