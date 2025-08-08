/**
 * Page des transactions de paiement pour l'admin
 * Affiche la liste de toutes les transactions avec filtres et pagination
 */

import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { 
  CreditCard, 
  Search, 
  Filter, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ArrowUpDown, // TODO: utiliser pour le tri des colonnes
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

interface Transaction {
  id: string;
  orderId: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    totalAmount: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
  };
}

export const loader: LoaderFunction = async ({ request, context }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';

  try {
    // Utiliser l'API Remix simplifiée (fallback HTTP si nécessaire)
    const { getRemixApiService } = await import("~/server/remix-api.server");
    const remixService: any = await getRemixApiService(context);
    const result: any = await remixService.getPayments?.({
      page,
      limit: 20,
      search,
      status,
    });

    if (!result || result.success === false) {
      throw new Error((result && result.error) || 'Erreur lors du chargement des transactions');
    }

    // Simuler des stats et transformer les données pour l'instant
  const transformedTransactions = ((result && result.payments) || []).map((payment: any) => ({
      id: payment.id || payment.pmt_id || 'N/A',
      orderId: payment.orderId || payment.ord_id || 'N/A',
      customerEmail: payment.customerEmail || payment.customer?.email || 'N/A',
      amount: payment.montantTotal || payment.amount || 0,
      currency: payment.devise || payment.currency || 'EUR',
      status: payment.statutPaiement || payment.status || 'pending',
      paymentMethod: payment.methodePaiement || payment.paymentMethod || 'Carte',
      transactionId: payment.referenceTransaction || payment.transactionId || null,
      createdAt: payment.dateCreation || payment.createdAt || new Date().toISOString(),
      updatedAt: payment.datePaiement || payment.updatedAt || new Date().toISOString(),
    }));

    const stats = {
      totalAmount: transformedTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
      completedCount: transformedTransactions.filter((t: any) => t.status === 'completed' || t.status === 'payé').length,
      pendingCount: transformedTransactions.filter((t: any) => t.status === 'pending' || t.status === 'en_attente').length,
      failedCount: transformedTransactions.filter((t: any) => t.status === 'failed' || t.status === 'échoué').length,
    };

    return json<LoaderData>({
      transactions: transformedTransactions,
  total: (result && result.total) || 0,
      page,
  totalPages: (result && result.totalPages) || 1,
      stats,
    });
  } catch (error) {
    console.error('Error loading transactions:', error);
    return json<LoaderData>({
      transactions: [],
      total: 0,
      page: 1,
      totalPages: 1,
      stats: {
        totalAmount: 0,
        completedCount: 0,
        pendingCount: 0,
        failedCount: 0,
      },
    });
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'refunded':
      return <AlertCircle className="w-4 h-4 text-purple-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'refunded':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function AdminPaymentsTransactions() {
  const { transactions, total, page, totalPages, stats } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentSearch = searchParams.get('search') || '';
  const currentStatus = searchParams.get('status') || '';

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = formData.get('search') as string;
    
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (search) {
        newParams.set('search', search);
      } else {
        newParams.delete('search');
      }
      newParams.delete('page'); // Reset à la page 1
      return newParams;
    });
  };

  const handleStatusFilter = (status: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (status && status !== 'all') {
        newParams.set('status', status);
      } else {
        newParams.delete('status');
      }
      newParams.delete('page'); // Reset à la page 1
      return newParams;
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <CreditCard className="w-8 h-8 mr-3" />
            Transactions de Paiement
          </h1>
          <p className="text-gray-600 mt-1">
            {total} transaction{total > 1 ? 's' : ''} au total
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CreditCard className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Montant Total</p>
                <p className="text-2xl font-bold">{stats.totalAmount.toFixed(2)}€</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Complétées</p>
                <p className="text-2xl font-bold">{stats.completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En Attente</p>
                <p className="text-2xl font-bold">{stats.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Échouées</p>
                <p className="text-2xl font-bold">{stats.failedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filtres et Recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Recherche */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="flex">
                <Input
                  name="search"
                  placeholder="Rechercher par email, ID commande..."
                  defaultValue={currentSearch}
                  className="rounded-r-none"
                />
                <Button type="submit" className="rounded-l-none">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </form>

            {/* Filtre par statut */}
            <div className="flex gap-2">
              <Button
                variant={currentStatus === '' ? 'default' : 'outline'}
                onClick={() => handleStatusFilter('all')}
                size="sm"
              >
                Tous
              </Button>
              <Button
                variant={currentStatus === 'completed' ? 'default' : 'outline'}
                onClick={() => handleStatusFilter('completed')}
                size="sm"
              >
                Complétées
              </Button>
              <Button
                variant={currentStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => handleStatusFilter('pending')}
                size="sm"
              >
                En attente
              </Button>
              <Button
                variant={currentStatus === 'failed' ? 'default' : 'outline'}
                onClick={() => handleStatusFilter('failed')}
                size="sm"
              >
                Échouées
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Aucune transaction trouvée</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(transaction.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">#{transaction.id}</span>
                          <Badge className={getStatusColor(transaction.status)}>
                            {transaction.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          Commande: #{transaction.orderId}
                        </p>
                        <p className="text-sm text-gray-600">
                          Client: {transaction.customerEmail}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {transaction.amount.toFixed(2)} {transaction.currency}
                      </div>
                      <p className="text-sm text-gray-600">
                        {transaction.paymentMethod}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  {transaction.transactionId && (
                    <div className="mt-2 text-xs text-gray-500">
                      ID Transaction: {transaction.transactionId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          {page > 1 && (
            <Button variant="outline" asChild>
              <Link to={`/admin/payments/transactions?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: (page - 1).toString() })}`}>
                Précédent
              </Link>
            </Button>
          )}
          
          <span className="flex items-center px-4 py-2 text-sm">
            Page {page} sur {totalPages}
          </span>
          
          {page < totalPages && (
            <Button variant="outline" asChild>
              <Link to={`/admin/payments/transactions?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: (page + 1).toString() })}`}>
                Suivant
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
