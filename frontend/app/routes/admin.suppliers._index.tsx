/**
 * 📋 INTERFACE GESTION FOURNISSEURS - Admin Interface
 * 
 * Interface de gestion des fournisseurs AutoParts
 * Migration des fonctionnalités PHP legacy vers Remix
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "~/server/auth.server";
import { getRemixApiService } from "~/server/remix-api.server";

// Types pour la gestion des fournisseurs
interface Supplier {
  id: string;
  name: string;
  category: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  newThisMonth: number;
  topCategories: Array<{ category: string; count: number }>;
}

interface _SuppliersData {
  suppliers: Supplier[];
  stats: SupplierStats;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
}

// Fonction loader pour récupérer les données des fournisseurs
export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  
  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  const url = new URL(request.url);
  
  // Paramètres de requête pour la pagination et les filtres
  const page = parseInt(url.searchParams.get('page') || '1');
  const search = url.searchParams.get('search') || '';
  const country = url.searchParams.get('country') || '';
  const isActive = url.searchParams.get('status') === 'active' ? true : 
                   url.searchParams.get('status') === 'inactive' ? false : undefined;

  try {
    const remixService = await getRemixApiService(context);
    const suppliersResult = await remixService.getSuppliersForRemix({
      page,
      limit: 10,
      search,
      country,
      isActive,
    });

    if (!suppliersResult.success) {
      throw new Error(suppliersResult.error || "Erreur API pour les données des fournisseurs");
    }

    // Transformer les données et calculer les statistiques
    const suppliers = suppliersResult.suppliers.map((supplier: any) => ({
      id: supplier.id,
      name: supplier.name,
      category: supplier.category || 'Non définie',
      email: supplier.email,
      phone: supplier.phone,
      city: supplier.address?.city || supplier.city,
      country: supplier.country,
      status: supplier.isActive ? 'verified' : 'inactive',
      is_active: supplier.isActive,
      created_at: supplier.createdAt || new Date().toISOString(),
      updated_at: supplier.updatedAt || new Date().toISOString(),
    }));

    // Calculer les statistiques basiques
    const stats: SupplierStats = {
      totalSuppliers: suppliersResult.total,
      activeSuppliers: suppliers.filter(s => s.is_active).length,
      inactiveSuppliers: suppliers.filter(s => !s.is_active).length,
      newThisMonth: 0, // À implémenter selon les besoins
      topCategories: [], // À implémenter selon les besoins
    };

    return json({
      suppliers,
      stats,
      pagination: {
        page,
        totalPages: suppliersResult.pagination?.totalPages ?? suppliersResult.totalPages ?? 1,
        totalItems: suppliersResult.total,
      },
      fallbackMode: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erreur loader suppliers:', error);
    
    // Fallback en cas d'erreur
    return json({
      suppliers: [],
      stats: {
        totalSuppliers: 0,
        activeSuppliers: 0,
        inactiveSuppliers: 0,
        newThisMonth: 0,
        topCategories: [],
      },
      pagination: { page: 1, totalPages: 1, totalItems: 0 },
      fallbackMode: true,
      timestamp: new Date().toISOString(),
    });
  }
}

// Composant principal de gestion des fournisseurs
export default function AdminSuppliers() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [_selectedSupplier, _setSelectedSupplier] = useState<Supplier | null>(null);
  
  const isLoading = navigation.state === "loading";

  // Fonction pour formater les dates
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fonction pour obtenir la classe CSS du statut
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Fonction pour obtenir le texte du statut
  const getStatusText = (status: string) => {
    switch (status) {
      case 'verified':
        return 'Vérifié';
      case 'pending':
        return 'En attente';
      case 'rejected':
        return 'Rejeté';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* En-tête avec navigation */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Link to="/admin" className="hover:text-blue-600">Admin</Link>
          <span>›</span>
          <span className="font-medium">Gestion des Fournisseurs</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Fournisseurs</h1>
            <p className="text-gray-600 mt-1">
              Gestion centralisée des partenaires fournisseurs AutoParts
            </p>
          </div>
          
          <div className="flex gap-3">
            <Link
              to="/admin/suppliers/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Nouveau Fournisseur
            </Link>
          </div>
        </div>
      </div>

      {/* Indicateur de mode fallback */}
      {data.fallbackMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">⚠️</span>
            <span className="text-yellow-800 font-medium">Mode Développement</span>
            <span className="text-yellow-600 text-sm">
              - Données de test affichées
            </span>
          </div>
        </div>
      )}

      {/* Statistiques des fournisseurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Fournisseurs</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalSuppliers}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <span className="text-blue-600 text-xl">🏢</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fournisseurs Actifs</p>
              <p className="text-2xl font-bold text-green-600">{data.stats.activeSuppliers}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <span className="text-green-600 text-xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fournisseurs Inactifs</p>
              <p className="text-2xl font-bold text-red-600">{data.stats.inactiveSuppliers}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <span className="text-red-600 text-xl">⏸️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Nouveaux ce mois</p>
              <p className="text-2xl font-bold text-blue-600">{data.stats.newThisMonth}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <span className="text-blue-600 text-xl">📈</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <Form method="get" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recherche
              </label>
              <input
                type="text"
                name="search"
                placeholder="Nom du fournisseur..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>
              <select
                name="category"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes les catégories</option>
                <option value="pieces-detachees">Pièces détachées</option>
                <option value="moteurs">Moteurs</option>
                <option value="accessoires">Accessoires</option>
                <option value="electronique">Électronique</option>
                <option value="carrosserie">Carrosserie</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                name="status"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="verified">Vérifié</option>
                <option value="pending">En attente</option>
                <option value="rejected">Rejeté</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Recherche...' : 'Filtrer'}
              </button>
            </div>
          </div>
        </Form>
      </div>

      {/* Tableau des fournisseurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créé le
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">📦</span>
                      <span>Aucun fournisseur trouvé</span>
                      {data.fallbackMode && (
                        <span className="text-yellow-600 text-sm">Mode de secours activé</span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-sm">
                              {supplier.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {supplier.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {supplier.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {supplier.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {supplier.email && (
                          <div className="flex items-center gap-1">
                            <span>📧</span>
                            <span>{supplier.email}</span>
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1 mt-1">
                            <span>📞</span>
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {supplier.city && <div>{supplier.city}</div>}
                        {supplier.country && (
                          <div className="text-gray-500">{supplier.country}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(supplier.status)}`}>
                          {getStatusText(supplier.status)}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          supplier.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {supplier.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(supplier.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/suppliers/${supplier.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Voir
                        </Link>
                        <Link
                          to={`/admin/suppliers/${supplier.id}/edit`}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Éditer
                        </Link>
                        <button
                          onClick={() => _setSelectedSupplier(supplier as Supplier)}
                          className={`${
                            supplier.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {supplier.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                {data.pagination.page > 1 && (
                  <Link
                    to={`?page=${data.pagination.page - 1}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Précédent
                  </Link>
                )}
                {data.pagination.page < data.pagination.totalPages && (
                  <Link
                    to={`?page=${data.pagination.page + 1}`}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Suivant
                  </Link>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Affichage de{' '}
                    <span className="font-medium">
                      {(data.pagination.page - 1) * 10 + 1}
                    </span>{' '}
                    à{' '}
                    <span className="font-medium">
                      {Math.min(data.pagination.page * 10, data.pagination.totalItems)}
                    </span>{' '}
                    sur{' '}
                    <span className="font-medium">{data.pagination.totalItems}</span>{' '}
                    fournisseurs
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1)
                      .filter(page => 
                        page === 1 || 
                        page === data.pagination.totalPages || 
                        Math.abs(page - data.pagination.page) <= 2
                      )
                      .map((page, index, array) => (
                        <div key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              ...
                            </span>
                          )}
                          <Link
                            to={`?page=${page}`}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === data.pagination.page
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </Link>
                        </div>
                      ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Informations de mise à jour */}
      <div className="mt-6 text-sm text-gray-500 text-center">
        Dernière mise à jour: {formatDate(data.timestamp)}
      </div>
    </div>
  );
}
