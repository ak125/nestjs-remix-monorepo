// app/routes/admin.suppliers.tsx
// Interface de gestion des fournisseurs optimisée appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Outlet, useLoaderData, NavLink } from '@remix-run/react';
import { 
  Building2, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  Clock,
  Package,
  AlertTriangle,
  Calendar,
  FileText,
  Settings
} from 'lucide-react';
import { getOptionalUser, requireAuth } from '../auth/unified.server';

// Interface pour les données des fournisseurs
interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingApprovals: number;
  totalProducts: number;
  averageDeliveryTime: number;
  topPerformingSuppliers: number;
  contractsExpiring: number;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  // Vérifier permissions admin (niveau 7+)
  if (!user.level || user.level < 7) {
    throw new Response('Accès refusé - Permissions administrateur requises', { status: 403 });
  }

  // En production, récupérer les vraies données des fournisseurs
  const supplierStats: SupplierStats = {
    totalSuppliers: 108,
    activeSuppliers: 89,
    pendingApprovals: 7,
    totalProducts: 12847,
    averageDeliveryTime: 3.2,
    topPerformingSuppliers: 23,
    contractsExpiring: 12
  };

  return json({ user, supplierStats });
}

export default function AdminSuppliersLayout() {
  const { user, supplierStats } = useLoaderData<typeof loader>();

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const calculatePerformanceRate = () => {
    if (supplierStats.totalSuppliers === 0) return 0;
    return Math.round((supplierStats.topPerformingSuppliers / supplierStats.totalSuppliers) * 100);
  };

  const calculateActiveRate = () => {
    if (supplierStats.totalSuppliers === 0) return 0;
    return Math.round((supplierStats.activeSuppliers / supplierStats.totalSuppliers) * 100);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Gestion des Fournisseurs</h1>
              <p className="text-indigo-100 text-lg mt-1">
                Administration des partenaires et fournisseurs
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur px-6 py-3 rounded-lg">
            <div className="flex items-center gap-2 text-indigo-200">
              <TrendingUp className="h-5 w-5" />
              <span className="font-semibold">{calculateActiveRate()}% actifs</span>
            </div>
            <div className="text-sm text-indigo-100 mt-1">
              Sur {formatNumber(supplierStats.totalSuppliers)} fournisseurs
            </div>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total fournisseurs */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Fournisseurs</h2>
            </div>
            <div className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm font-medium">
              TOTAL
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(supplierStats.totalSuppliers)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              {formatNumber(supplierStats.activeSuppliers)} actifs
            </div>
            <div className="text-indigo-600">
              {calculateActiveRate()}%
            </div>
          </div>
        </div>

        {/* Produits référencés */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Produits</h2>
            </div>
            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
              CATALOGUE
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(supplierStats.totalProducts)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Références actives</span>
            <div className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              En croissance
            </div>
          </div>
        </div>

        {/* Approbations en attente */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">En Attente</h2>
            </div>
            <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">
              PENDING
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(supplierStats.pendingApprovals)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">À approuver</span>
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              Urgent
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Performance</h2>
            </div>
            <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">
              TOP
            </div>
          </div>
          
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(supplierStats.topPerformingSuppliers)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Excellents</span>
            <div className="text-purple-600">
              {calculatePerformanceRate()}%
            </div>
          </div>
        </div>
      </div>

      {/* Métriques secondaires */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Délais de livraison */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Délais de Livraison
          </h2>
          
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {supplierStats.averageDeliveryTime} j
            </div>
            <p className="text-gray-600 text-sm">Délai moyen</p>
            
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Objectif</span>
                <span className="font-medium text-blue-600">≤ 3 jours</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min((3 / supplierStats.averageDeliveryTime) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Contrats */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contrats
          </h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="font-medium text-green-900">Actifs</span>
              <span className="text-2xl font-bold text-green-600">
                {formatNumber(supplierStats.activeSuppliers)}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="font-medium text-red-900">Expirent bientôt</span>
              <span className="text-2xl font-bold text-red-600">
                {formatNumber(supplierStats.contractsExpiring)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Actions Rapides
          </h2>
          
          <div className="space-y-3">
            <button className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              Nouveau fournisseur
            </button>
            
            <button className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              Approuver en attente ({supplierStats.pendingApprovals})
            </button>
            
            <button className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              Renouveler contrats ({supplierStats.contractsExpiring})
            </button>
          </div>
        </div>
      </div>

      {/* Navigation des sous-routes */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <nav className="flex space-x-8">
          <NavLink 
            to="/admin/suppliers" 
            end
            className={({ isActive }) => 
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-600 hover:text-indigo-600'
              }`
            }
          >
            <Building2 className="h-5 w-5" />
            Vue d'ensemble
          </NavLink>
          
          <NavLink 
            to="/admin/suppliers/list"
            className={({ isActive }) => 
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-600 hover:text-indigo-600'
              }`
            }
          >
            <Users className="h-5 w-5" />
            Liste complète
          </NavLink>
          
          <NavLink 
            to="/admin/suppliers/new"
            className={({ isActive }) => 
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-600 hover:text-indigo-600'
              }`
            }
          >
            <Package className="h-5 w-5" />
            Nouveau
          </NavLink>
          
          <NavLink 
            to="/admin/suppliers/contracts"
            className={({ isActive }) => 
              `flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                isActive 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-600 hover:text-indigo-600'
              }`
            }
          >
            <FileText className="h-5 w-5" />
            Contrats
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
