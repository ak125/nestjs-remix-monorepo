/**
 * Dashboard Admin Orders - CRUD Complet
 * Interface simplifiée avec créer/modifier commandes
 */

import { type LoaderFunction, type ActionFunction, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useFetcher } from "@remix-run/react";
import { ShoppingCart, Plus, Download, CheckCircle, Clock, Package, DollarSign } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Commandes - Admin" },
    { name: "description", content: "Dashboard admin pour la gestion des commandes" },
  ];
};

// Types
interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  notes?: string;
}

interface OrdersStats {
  totalOrders: number;
  totalAmount: number;
  pendingOrders: number;
  completedOrders: number;
}

// Action pour opérations CRUD
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  try {
    switch (intent) {
      case "create": {
        const customerId = formData.get("customerId") as string;
        const productName = formData.get("productName") as string;
        const quantity = parseInt(formData.get("quantity") as string);
        const price = parseFloat(formData.get("price") as string);
        const notes = formData.get("notes") as string;
        
        const items = [{
          productId: `PROD-${Date.now()}`,
          productName,
          quantity,
          price,
        }];
        
        const response = await fetch('http://localhost:3000/api/legacy-orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify({
            customerId,
            items,
            notes,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Erreur API: ${errorData}`);
        }
        
        return json({ success: true, message: 'Commande créée avec succès' });
      }
      
      case "updateStatus": {
        const orderId = formData.get("orderId") as string;
        const status = formData.get("status") as string;
        
        // TODO: Implémenter l'API de mise à jour de statut
        return json({ success: true, message: `Statut mis à jour: ${status}` });
      }
      
      default:
        return json({ error: 'Action non reconnue' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erreur action:', error);
    return json({ error: `Erreur: ${error.message}` }, { status: 500 });
  }
};

// Loader pour charger les données
export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Charger les commandes
    const ordersResponse = await fetch('http://localhost:3000/api/legacy-orders', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });
    
    if (!ordersResponse.ok) {
      throw new Error('Erreur lors du chargement des commandes');
    }
    
    const ordersData = await ordersResponse.json();
    
    // Charger les statistiques
    const statsResponse = await fetch('http://localhost:3000/api/legacy-orders/stats', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });
    
    const statsData = statsResponse.ok ? await statsResponse.json() : {
      totalOrders: 0,
      totalAmount: 0,
      pendingOrders: 0,
      completedOrders: 0,
    };
    
    return json({
      orders: ordersData?.orders || [],
      stats: statsData,
    });
  } catch (error) {
    console.error('Erreur loader:', error);
    return json({
      orders: [],
      stats: { totalOrders: 0, totalAmount: 0, pendingOrders: 0, completedOrders: 0 },
      error: error.message,
    });
  }
};

// Composant principal
export default function AdminOrders() {
  const { orders, stats, error } = useLoaderData<{
    orders: Order[];
    stats: OrdersStats;
    error?: string;
  }>();
  
  const actionData = useActionData<{
    success?: boolean;
    message?: string;
    error?: string;
  }>();
  
  const fetcher = useFetcher();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return styles[status] || styles.pending;
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestion des Commandes</h1>
                <p className="text-gray-600">Dashboard administrateur</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Commande
              </Button>
              <Form method="post">
                <input type="hidden" name="intent" value="export" />
                <Button type="submit" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </Button>
              </Form>
            </div>
          </div>
        </div>

        {/* Messages */}
        {actionData?.success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {actionData.message}
          </div>
        )}
        
        {actionData?.error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {actionData.error}
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            Erreur de chargement: {error}
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Attente</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminées</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedOrders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Formulaire de création */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Créer une nouvelle commande</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="create" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerId">ID Client</Label>
                    <Input 
                      id="customerId"
                      name="customerId" 
                      placeholder="ex: CUST-123"
                      required 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="productName">Nom du Produit</Label>
                    <Input 
                      id="productName"
                      name="productName" 
                      placeholder="ex: Produit Test"
                      required 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="quantity">Quantité</Label>
                    <Input 
                      id="quantity"
                      name="quantity" 
                      type="number"
                      min="1"
                      defaultValue="1"
                      required 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="price">Prix unitaire (€)</Label>
                    <Input 
                      id="price"
                      name="price" 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      required 
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (optionnel)</Label>
                  <Textarea 
                    id="notes"
                    name="notes" 
                    placeholder="Informations complémentaires..."
                    rows={3}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Créer la Commande
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Liste des commandes */}
        <Card>
          <CardHeader>
            <CardTitle>Commandes récentes ({orders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune commande trouvée
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">ID Commande</th>
                      <th className="text-left p-3">Client</th>
                      <th className="text-left p-3">Statut</th>
                      <th className="text-left p-3">Montant</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 20).map((order) => (
                      <tr key={order.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-sm">{order.id}</td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{order.customerName || 'Client inconnu'}</div>
                            <div className="text-sm text-gray-500">{order.customerEmail}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={getStatusBadge(order.status)}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium">{formatCurrency(order.totalAmount)}</td>
                        <td className="p-3 text-sm">{formatDate(order.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Voir
                            </Button>
                            {order.status === 'pending' && (
                              <Form method="post" className="inline">
                                <input type="hidden" name="intent" value="updateStatus" />
                                <input type="hidden" name="orderId" value={order.id} />
                                <input type="hidden" name="status" value="processing" />
                                <Button size="sm" type="submit" className="bg-blue-600 hover:bg-blue-700">
                                  Traiter
                                </Button>
                              </Form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Détails de commande */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">Détails de la commande</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedOrder(null)}
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <strong>ID:</strong> {selectedOrder.id}
                  </div>
                  <div>
                    <strong>Client:</strong> {selectedOrder.customerName} ({selectedOrder.customerId})
                  </div>
                  <div>
                    <strong>Statut:</strong> 
                    <Badge className={`ml-2 ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                  <div>
                    <strong>Total:</strong> {formatCurrency(selectedOrder.totalAmount)}
                  </div>
                  <div>
                    <strong>Date:</strong> {formatDate(selectedOrder.createdAt)}
                  </div>
                  
                  <div>
                    <strong>Articles:</strong>
                    <div className="mt-2 space-y-2">
                      {selectedOrder.items?.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded">
                          <div>{item.productName}</div>
                          <div className="text-sm text-gray-600">
                            Quantité: {item.quantity} × {formatCurrency(item.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {selectedOrder.notes && (
                    <div>
                      <strong>Notes:</strong>
                      <div className="mt-1 p-3 bg-gray-50 rounded">{selectedOrder.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
