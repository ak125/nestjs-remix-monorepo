/**
 * Page d'administration des commandes avec la vraie table ___xtr_order
 * Utilise la structure réelle des données Supabase
 */

import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { 
  Package, 
  Users, 
  TrendingUp, 
  Search, 
  Filter, 
  Download,
  Edit,
  Eye,
  MoreHorizontal
} from "lucide-react";
import { getOptionalUser } from "~/server/auth.server";

interface Order {
  ord_id: string;
  ord_cst_id: string;
  ord_date: string;
  ord_total_ttc: string;
  ord_is_pay: string;
  ord_ords_id: string;
  ord_amount_ht?: string;
  ord_shipping_fee_ttc?: string;
  ord_info?: string;
  statusDetails?: {
    ords_id: string;
    ords_named: string;
    ords_action: string;
    ords_color: string;
  };
  customer?: {
    cst_fname: string;
    cst_name: string;
    cst_mail: string;
  };
  billingAddress?: {
    cba_id: string;
    cba_mail?: string;
    cba_civility?: string;
    cba_name: string;
    cba_fname: string;
    cba_address: string;
    cba_zip_code: string;
    cba_city: string;
    cba_country: string;
    cba_tel?: string;
    cba_gsm?: string;
  };
  deliveryAddress?: {
    cda_id: string;
    cda_mail?: string;
    cda_civility?: string;
    cda_name: string;
    cda_fname: string;
    cda_address: string;
    cda_zip_code: string;
    cda_city: string;
    cda_country: string;
    cda_tel?: string;
    cda_gsm?: string;
  };
  orderLines?: Array<{
    orl_id: string;
    orl_art_ref: string;
    orl_art_quantity: string;
    orl_art_price_sell_unit_ttc: string;
    orl_pg_name: string;
  }>;
}

interface LoaderData {
  orders: Order[];
  totalOrders: number;
  currentPage: number;
  totalPages: number;
  user: any;
  filters: {
    status: string | null;
    paymentStatus: string | null;
    search: string | null;
  };
}

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await getOptionalUser({ context });
  
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Vérifier que l'utilisateur est admin
  if (!user.isPro) {
    throw new Response("Forbidden - Accès réservé aux administrateurs", { status: 403 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const status = url.searchParams.get("status") || undefined;
  const paymentStatus = url.searchParams.get("paymentStatus") || undefined;
  const search = url.searchParams.get("search") || undefined;

  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(search && { search })
    });

    const response = await fetch(`http://localhost:3000/api/orders?${queryParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    const data = await response.json();
    
    return json<LoaderData>({
      orders: data.orders || [],
      totalOrders: data.total || 0,
      currentPage: page,
      totalPages: Math.ceil((data.total || 0) / limit),
      user,
      filters: {
        status: status || null,
        paymentStatus: paymentStatus || null,
        search: search || null
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return json<LoaderData>({
      orders: [],
      totalOrders: 0,
      currentPage: 1,
      totalPages: 1,
      user,
      filters: {
        status: null,
        paymentStatus: null,
        search: null
      }
    });
  }
};

export default function AdminOrders() {
  const { orders, totalOrders, currentPage, totalPages, user, filters } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  const getStatusColor = (statusDetails: any) => {
    if (!statusDetails) return "bg-gray-100 text-gray-800";
    
    switch (statusDetails.ords_named?.toLowerCase()) {
      case 'en attente':
      case 'pending': return "bg-yellow-100 text-yellow-800";
      case 'confirmée':
      case 'confirmed': return "bg-blue-100 text-blue-800";
      case 'en cours':
      case 'processing': return "bg-purple-100 text-purple-800";
      case 'expédiée':
      case 'shipped': return "bg-indigo-100 text-indigo-800";
      case 'livrée':
      case 'delivered': return "bg-green-100 text-green-800";
      case 'annulée':
      case 'cancelled': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (isPaid: string) => {
    switch (isPaid) {
      case '1': return "bg-green-100 text-green-800";
      case '0': return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusText = (isPaid: string) => {
    switch (isPaid) {
      case '1': return "Payé";
      case '0': return "En attente";
      default: return "Non spécifié";
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleSearch = () => {
    const newParams = new URLSearchParams(searchParams);
    if (localSearch) {
      newParams.set('search', localSearch);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setLocalSearch("");
  };

  const uniqueCustomers = new Set(orders.map(o => o.ord_cst_id)).size;
  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.ord_total_ttc) || 0), 0);
  const paidOrders = orders.filter(o => o.ord_is_pay === '1').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Commandes</h1>
          <p className="text-gray-600">Interface d'administration pour le service commercial</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exporter
          </Button>
          <Link to="/orders/new">
            <Button className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Nouvelle commande
            </Button>
          </Link>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              +{orders.length} affichées
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Uniques</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Sur cette page
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(0)}€</div>
            <p className="text-xs text-muted-foreground">
              TTC sur cette page
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commandes Payées</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidOrders}</div>
            <p className="text-xs text-muted-foreground">
              Sur {orders.length} affichées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres et Recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Rechercher par ID commande, client..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSearch} className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Rechercher
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={filters.status || ""} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut commande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les statuts</SelectItem>
                  <SelectItem value="1">En attente</SelectItem>
                  <SelectItem value="2">Confirmée</SelectItem>
                  <SelectItem value="3">En cours</SelectItem>
                  <SelectItem value="4">Expédiée</SelectItem>
                  <SelectItem value="5">Livrée</SelectItem>
                  <SelectItem value="6">Annulée</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.paymentStatus || ""} onValueChange={(value) => handleFilterChange('paymentStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut paiement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les paiements</SelectItem>
                  <SelectItem value="1">Payé</SelectItem>
                  <SelectItem value="0">En attente</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={clearFilters}>
                Effacer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des commandes */}
      <Card>
        <CardHeader>
          <CardTitle>Commandes ({orders.length} sur {totalOrders})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.ord_id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">#{order.ord_id}</h3>
                      <Badge className={getStatusColor(order.statusDetails)}>
                        {order.statusDetails?.ords_named || 'Non spécifié'}
                      </Badge>
                      <Badge className={getPaymentStatusColor(order.ord_is_pay)}>
                        {getPaymentStatusText(order.ord_is_pay)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/orders/${order.ord_id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to={`/orders/${order.ord_id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Client</p>
                    <p className="font-medium">{order.customer?.cst_fname} {order.customer?.cst_name || 'Non spécifié'}</p>
                    <p className="text-gray-500">{order.customer?.cst_mail || 'Non spécifié'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Articles</p>
                    <p className="font-medium">{order.orderLines?.length || 0} articles</p>
                    <p className="text-gray-500">
                      {order.orderLines?.slice(0, 1).map(line => line.orl_pg_name).join(', ')}
                      {(order.orderLines?.length || 0) > 1 && '...'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Adresse de facturation</p>
                    {order.billingAddress ? (
                      <div className="font-medium text-sm">
                        <p>{order.billingAddress.cba_civility} {order.billingAddress.cba_fname} {order.billingAddress.cba_name}</p>
                        <p>{order.billingAddress.cba_address}</p>
                        <p>{order.billingAddress.cba_zip_code} {order.billingAddress.cba_city}</p>
                        <p>{order.billingAddress.cba_country}</p>
                        {order.billingAddress.cba_tel && <p>Tél: {order.billingAddress.cba_tel}</p>}
                        {order.billingAddress.cba_gsm && <p>GSM: {order.billingAddress.cba_gsm}</p>}
                      </div>
                    ) : (
                      <p className="text-gray-500">Non spécifiée</p>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Adresse de livraison</p>
                    {order.deliveryAddress ? (
                      <div className="font-medium text-sm">
                        <p>{order.deliveryAddress.cda_civility} {order.deliveryAddress.cda_fname} {order.deliveryAddress.cda_name}</p>
                        <p>{order.deliveryAddress.cda_address}</p>
                        <p>{order.deliveryAddress.cda_zip_code} {order.deliveryAddress.cda_city}</p>
                        <p>{order.deliveryAddress.cda_country}</p>
                        {order.deliveryAddress.cda_tel && <p>Tél: {order.deliveryAddress.cda_tel}</p>}
                        {order.deliveryAddress.cda_gsm && <p>GSM: {order.deliveryAddress.cda_gsm}</p>}
                      </div>
                    ) : (
                      <p className="text-gray-500">Non spécifiée</p>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">
                      {order.ord_date ? new Date(order.ord_date).toLocaleDateString('fr-FR') : 'Non spécifiée'}
                    </p>
                    <p className="text-gray-500">
                      Total: {parseFloat(order.ord_total_ttc).toFixed(2)}€
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Informations</p>
                    <p className="font-medium">{order.ord_info || 'Aucune information'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {orders.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune commande trouvée</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages} ({totalOrders} commandes au total)
              </p>
              <div className="flex gap-2">
                <Link to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(Math.max(1, currentPage - 1)) })}`}>
                  <Button variant="outline" disabled={currentPage === 1}>
                    Précédent
                  </Button>
                </Link>
                <Link to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(Math.min(totalPages, currentPage + 1)) })}`}>
                  <Button variant="outline" disabled={currentPage === totalPages}>
                    Suivant
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
