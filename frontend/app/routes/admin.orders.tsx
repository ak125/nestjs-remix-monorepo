/**
 * Dashboard Admin Orders - CRUD Complet
 * Version simplifiée avec styles CSS purs
 */

import { type LoaderFunction, type ActionFunction, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { ShoppingCart, Plus, Download, CheckCircle, Clock, Package, DollarSign } from "lucide-react";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Commandes - Admin" },
    { name: "description", content: "Dashboard admin pour la gestion des commandes" },
  ];
};

// Types mis à jour pour les VRAIES données legacy-orders
interface Order {
  id: string;
  customerId: string;
  date: string;
  amountHt: number;
  totalHt: number;
  amountTtc: number;
  totalTtc: number;
  depositHt: number;
  depositTtc: number;
  shippingFeeHt: number;
  shippingFeeTtc: number;
  tva: number;
  isPaid: boolean;
  status: string; // "pending", etc.
  info: string; // JSON string with payment info
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
        
        const response = await fetch('http://localhost:3000/api/orders', {
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
        // TODO: Implémenter l'API de mise à jour de statut
        return json({ success: true, message: 'Statut mis à jour (simulation)' });
      }
      
      case "export": {
        return json({ 
          success: true, 
          message: 'Export CSV généré (fonctionnalité à compléter)'
        });
      }
      
      default:
        return json({ error: 'Action non reconnue' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erreur action:', error);
    return json({ error: `Erreur: ${error instanceof Error ? error.message : 'Unknown'}` }, { status: 500 });
  }
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Utiliser les VRAIES données legacy-orders
    const ordersResponse = await fetch('http://localhost:3000/api/legacy-orders', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });
    
    if (!ordersResponse.ok) {
      throw new Error('Erreur lors du chargement des commandes');
    }
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData?.data || [];
    
    // Calculer les vraies stats basées sur les données legacy
    const stats = {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum: number, order: any) => sum + (order.totalTtc || 0), 0),
      pendingOrders: orders.filter((order: any) => order.status === "pending").length,
      completedOrders: orders.filter((order: any) => order.isPaid === true).length,
    };
    
    return json({
      orders,
      stats,
    });
  } catch (error) {
    console.error('Erreur loader:', error);
    return json({
      orders: [],
      stats: { totalOrders: 0, totalAmount: 0, pendingOrders: 0, completedOrders: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
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
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const getStatusBadge = (status: string) => {
    const statusMap = {
      "pending": { label: "En attente", class: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      "confirmed": { label: "Confirmée", class: "bg-blue-100 text-blue-800 border-blue-200" },
      "processing": { label: "En traitement", class: "bg-orange-100 text-orange-800 border-orange-200" },
      "shipped": { label: "Expédiée", class: "bg-purple-100 text-purple-800 border-purple-200" },
      "delivered": { label: "Livrée", class: "bg-green-100 text-green-800 border-green-200" },
      "cancelled": { label: "Annulée", class: "bg-red-100 text-red-800 border-red-200" },
    };
    return statusMap[status as keyof typeof statusMap] || { label: status, class: "bg-gray-100 text-gray-800 border-gray-200" };
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
      <style>{`
        .card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .btn-primary {
          background-color: #2563eb;
          color: white;
        }
        .btn-primary:hover {
          background-color: #1d4ed8;
        }
        .btn-outline {
          background-color: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        .btn-outline:hover {
          background-color: #f9fafb;
        }
        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid;
        }
        .input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }
        .input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          min-height: 80px;
        }
        .textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 4px;
        }
        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 50;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          max-width: 2xl;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .alert {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 24px;
          border: 1px solid;
        }
        .alert-success {
          background-color: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }
        .alert-error {
          background-color: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }
      `}</style>
      
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
              <button 
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Commande
              </button>
              <Form method="post">
                <input type="hidden" name="intent" value="export" />
                <button type="submit" className="btn btn-outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </button>
              </Form>
            </div>
          </div>
        </div>

        {/* Messages */}
        {actionData?.success && (
          <div className="alert alert-success">
            {actionData.message}
          </div>
        )}
        
        {actionData?.error && (
          <div className="alert alert-error">
            {actionData.error}
          </div>
        )}
        
        {error && (
          <div className="alert alert-error">
            Erreur de chargement: {error}
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Total Commandes</div>
              <Package className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Chiffre d'Affaires</div>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">En Attente</div>
              <Clock className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Terminées</div>
              <CheckCircle className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{stats.completedOrders}</div>
          </div>
        </div>

        {/* Formulaire de création */}
        {showCreateForm && (
          <div className="card mb-8">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Créer une nouvelle commande</h3>
            </div>
            <div className="p-6">
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="create" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="customerId">ID Client</label>
                    <input 
                      id="customerId"
                      name="customerId" 
                      placeholder="ex: CUST-123"
                      className="input"
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="label" htmlFor="productName">Nom du Produit</label>
                    <input 
                      id="productName"
                      name="productName" 
                      placeholder="ex: Produit Test"
                      className="input"
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="label" htmlFor="quantity">Quantité</label>
                    <input 
                      id="quantity"
                      name="quantity" 
                      type="number"
                      min="1"
                      defaultValue="1"
                      className="input"
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="label" htmlFor="price">Prix unitaire (€)</label>
                    <input 
                      id="price"
                      name="price" 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="input"
                      required 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label" htmlFor="notes">Notes (optionnel)</label>
                  <textarea 
                    id="notes"
                    name="notes" 
                    placeholder="Informations complémentaires..."
                    className="textarea"
                    rows={3}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button type="submit" className="btn btn-primary">
                    Créer la Commande
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Annuler
                  </button>
                </div>
              </Form>
            </div>
          </div>
        )}

        {/* Liste des commandes */}
        <div className="card">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold">Commandes récentes ({orders.length})</h3>
          </div>
          <div className="p-6">
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
                            <div className="text-sm font-medium text-gray-900">
                              Client #{order.customerId}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.isPaid ? '💳 Payé' : '⏳ En attente paiement'}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`badge ${getStatusBadge(order.status).class}`}>
                            {getStatusBadge(order.status).label}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{formatCurrency(order.totalTtc)}</td>
                        <td className="p-3 text-sm">{formatDate(order.date)}</td>
                        <td className="p-3">
                          <div className="flex space-x-2">
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Voir
                            </button>
                            {order.status === "pending" && (
                              <Form method="post" className="inline">
                                <input type="hidden" name="intent" value="updateStatus" />
                                <input type="hidden" name="orderId" value={order.id} />
                                <input type="hidden" name="status" value="processing" />
                                <button type="submit" className="btn btn-primary btn-sm">
                                  Traiter
                                </button>
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
          </div>
        </div>

        {/* Modal détails de commande */}
        {selectedOrder && (
          <div className="modal">
            <div className="modal-content">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">Détails de la commande</h3>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedOrder(null)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <strong>ID:</strong> {selectedOrder.id}
                  </div>
                  <div>
                    <strong>Client:</strong> Client #{selectedOrder.customerId}
                  </div>
                  <div>
                    <strong>Statut:</strong> 
                    <span className={`badge ml-2 ${getStatusBadge(selectedOrder.status).class}`}>
                      {getStatusBadge(selectedOrder.status).label}
                    </span>
                  </div>
                  <div>
                    <strong>Total:</strong> {formatCurrency(selectedOrder.totalTtc)}
                  </div>
                  <div>
                    <strong>Date:</strong> {formatDate(selectedOrder.date)}
                  </div>
                  <div>
                    <strong>Paiement:</strong> {selectedOrder.isPaid ? '✅ Payé' : '⏳ En attente'}
                  </div>
                  <div>
                    <strong>TVA:</strong> {selectedOrder.tva}%
                  </div>
                  
                  {selectedOrder.info && (
                    <div>
                      <strong>Détails paiement:</strong>
                      <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                        {JSON.parse(selectedOrder.info).payment_gateway || 'N/A'}
                      </div>
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
