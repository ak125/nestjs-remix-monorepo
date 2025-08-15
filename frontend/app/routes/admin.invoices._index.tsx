/**
 * 🧾 INTERFACE GESTION FACTURES - Admin Interface
 * 
 * Interface de gestion des factures et lignes de factures
 * Intégration avec le service InvoicesService nouvellement créé
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { requireAdmin } from "~/server/auth.server";

// Types pour la gestion des factures
interface Invoice {
  inv_id: string;
  inv_number: string;
  inv_ord_id?: string;
  inv_spl_id?: string;
  inv_date: string;
  inv_due_date?: string;
  inv_amount: number;
  inv_tax_amount?: number;
  inv_total_amount: number;
  inv_currency?: string;
  inv_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  inv_payment_terms?: string;
  inv_notes?: string;
  inv_is_credit?: boolean;
  inv_created_at?: string;
  inv_updated_at?: string;
}

interface InvoiceStats {
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalAmount: number;
  totalTaxAmount: number;
  averageInvoiceAmount: number;
}

interface InvoicesData {
  invoices: Invoice[];
  stats: InvoiceStats;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
}

// Fonction loader pour récupérer les données des factures
export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context });
  
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const limit = Number(url.searchParams.get("limit")) || 20;
  const status = url.searchParams.get("status") || "";
  const search = url.searchParams.get("search") || "";

  try {
    // Récupérer les factures depuis l'API
    let invoicesUrl = `http://localhost:3000/api/invoices?page=${page}&limit=${limit}`;
    if (status) invoicesUrl += `&status=${status}`;
    
    const invoicesResponse = await fetch(invoicesUrl, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Content-Type': 'application/json',
      },
    });

    // Récupérer les statistiques
    const statsResponse = await fetch('http://localhost:3000/api/invoices/stats', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Content-Type': 'application/json',
      },
    });

    let invoicesData = {
      invoices: [],
      total: 0,
      page,
      limit
    };
    
    let stats: InvoiceStats = {
      totalInvoices: 0,
      draftInvoices: 0,
      sentInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
      totalAmount: 0,
      totalTaxAmount: 0,
      averageInvoiceAmount: 0,
    };

    if (invoicesResponse.ok) {
      invoicesData = await invoicesResponse.json();
    }

    if (statsResponse.ok) {
      stats = await statsResponse.json();
    }

    // Si recherche, utiliser l'endpoint de recherche
    if (search) {
      const searchResponse = await fetch(`http://localhost:3000/api/invoices/search?q=${encodeURIComponent(search)}`, {
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
          'Content-Type': 'application/json',
        },
      });
      
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        invoicesData.invoices = searchResults;
        invoicesData.total = searchResults.length;
      }
    }

    const pagination = {
      page,
      totalPages: Math.ceil(invoicesData.total / limit),
      totalItems: invoicesData.total,
    };

    return json({
      invoices: invoicesData.invoices,
      stats,
      pagination,
      user,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    
    // Données par défaut en cas d'erreur
    return json({
      invoices: [],
      stats: {
        totalInvoices: 0,
        draftInvoices: 0,
        sentInvoices: 0,
        paidInvoices: 0,
        overdueInvoices: 0,
        totalAmount: 0,
        totalTaxAmount: 0,
        averageInvoiceAmount: 0,
      },
      pagination: {
        page: 1,
        totalPages: 0,
        totalItems: 0,
      },
      user,
    });
  }
}

export default function InvoicesIndex() {
  const { invoices, stats, pagination, user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const isLoading = navigation.state === "loading";

  // Formatage de la devise
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Formatage de la date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  // Couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Traduction du statut
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Payée';
      case 'sent': return 'Envoyée';
      case 'draft': return 'Brouillon';
      case 'overdue': return 'En retard';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🧾 Gestion des Factures</h1>
        <p className="text-gray-600">Gérer toutes les factures et lignes de factures</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Factures</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Factures Payées</h3>
          <p className="text-2xl font-bold text-green-600">{stats.paidInvoices}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">En Retard</h3>
          <p className="text-2xl font-bold text-red-600">{stats.overdueInvoices}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Montant Total</h3>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalAmount)}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <Form method="get" className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                name="search"
                placeholder="Rechercher par numéro de facture..."
                defaultValue={searchTerm}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                name="status"
                defaultValue={selectedStatus}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="overdue">En retard</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Recherche..." : "Rechercher"}
            </button>
          </Form>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="flex gap-4">
            <Link
              to="/admin/invoices/new"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              ➕ Nouvelle Facture
            </Link>
            <Link
              to="/admin/invoices/stats"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              📊 Statistiques Détaillées
            </Link>
            <Link
              to="/admin/invoices/export"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              📥 Exporter
            </Link>
          </div>
        </div>
      </div>

      {/* Tableau des factures */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant TTC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Échéance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.inv_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.inv_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(invoice.inv_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.inv_status)}`}>
                      {getStatusLabel(invoice.inv_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.inv_total_amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {invoice.inv_due_date ? formatDate(invoice.inv_due_date) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/invoices/${invoice.inv_id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Voir
                      </Link>
                      <Link
                        to={`/admin/invoices/${invoice.inv_id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Modifier
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                {pagination.page > 1 && (
                  <Link
                    to={`?page=${pagination.page - 1}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Précédent
                  </Link>
                )}
                {pagination.page < pagination.totalPages && (
                  <Link
                    to={`?page=${pagination.page + 1}`}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Suivant
                  </Link>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{pagination.page}</span> sur{' '}
                    <span className="font-medium">{pagination.totalPages}</span> - Total{' '}
                    <span className="font-medium">{pagination.totalItems}</span> factures
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {pagination.page > 1 && (
                      <Link
                        to={`?page=${pagination.page - 1}`}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                      >
                        Précédent
                      </Link>
                    )}
                    {pagination.page < pagination.totalPages && (
                      <Link
                        to={`?page=${pagination.page + 1}`}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                      >
                        Suivant
                      </Link>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* État vide */}
      {invoices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Aucune facture trouvée</p>
          <Link
            to="/admin/invoices/new"
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Créer la première facture
          </Link>
        </div>
      )}
    </div>
  );
}
