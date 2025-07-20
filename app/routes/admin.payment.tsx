import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";

// Types pour les paiements legacy - ALIGNÉS SUR LES VRAIES TABLES
interface LegacyPayment {
  id: number;                    // ord_id de ___xtr_order
  orderId: number;              // ord_id 
  customerId: number;           // ord_cst_id (référence ___xtr_customer)
  montantTotal: number;         // ord_total_ttc
  devise: string;               // stocké dans ord_info
  statutPaiement: string;       // ord_is_pay ('0'=EN_ATTENTE, '1'=PAYE)
  methodePaiement: string;      // stocké dans ord_info.payment_gateway
  referenceTransaction?: string; // stocké dans ord_info.transaction_id
  dateCreation: string;         // ord_date
  datePaiement?: string;        // ord_date_pay
}

// DTO pour créer un paiement - ALIGNÉ SUR CreateLegacyPaymentDto
interface CreatePaymentRequest {
  ord_cst_id: string;           // ID client (string comme attendu par l'API)
  ord_total_ttc: string;        // Montant TTC (string comme attendu par l'API) 
  ord_currency?: string;        // Devise
  payment_gateway?: string;     // Gateway (stocké dans ord_info)
  return_url?: string;          // URL retour succès
  cancel_url?: string;          // URL retour annulation
  callback_url?: string;        // URL callback
  payment_metadata?: Record<string, any>; // Métadonnées
}

interface PaymentStats {
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  total_amount: number;
  currency: string;
}

// Loader pour récupérer les données depuis l'API
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 10;
  
  try {
    // Récupérer les statistiques des paiements
    const statsResponse = await fetch("http://localhost:3001/api/payments/stats");
    const stats: PaymentStats = statsResponse.ok ? await statsResponse.json() : {
      total_orders: 0,
      paid_orders: 0,
      pending_orders: 0,
      total_amount: 0,
      currency: 'EUR'
    };

    // Simuler une liste de paiements récents (en attendant une vraie API de listing)
    const payments: LegacyPayment[] = [];

    return json({
      payments,
      stats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(stats.total_orders / limit),
        limit
      }
    });
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    return json({
      payments: [],
      stats: {
        total_orders: 0,
        paid_orders: 0,
        pending_orders: 0,
        total_amount: 0,
        currency: 'EUR'
      },
      pagination: { currentPage: 1, totalPages: 1, limit }
    });
  }
}

// Action pour créer un nouveau paiement de test
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create_test_payment") {
    try {
      const testPayment = {
        ord_cst_id: formData.get("customerId") || "1",
        ord_total_ttc: formData.get("amount") || "99.99",
        ord_currency: "EUR",
        payment_gateway: formData.get("gateway") || "CYBERPLUS",
        return_url: "http://localhost:3000/admin/payment?success=1",
        cancel_url: "http://localhost:3000/admin/payment?cancelled=1",
        payment_metadata: { test: true, created_from: "admin_interface" }
      };

      const response = await fetch("http://localhost:3001/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayment)
      });

      if (response.ok) {
        const result = await response.json();
        return json({ success: true, payment: result });
      } else {
        const error = await response.text();
        return json({ success: false, error });
      }
    } catch (error) {
      return json({ success: false, error: "Erreur lors de la création du paiement" });
    }
  }

  if (action === "check_status") {
    const orderId = formData.get("orderId");
    try {
      const response = await fetch(`http://localhost:3001/api/payments/${orderId}/status`);
      if (response.ok) {
        const payment = await response.json();
        return json({ success: true, payment });
      } else {
        return json({ success: false, error: "Paiement non trouvé" });
      }
    } catch (error) {
      return json({ success: false, error: "Erreur lors de la vérification" });
    }
  }

  return json({ success: false, error: "Action non reconnue" });
}

export default function AdminPaymentPage() {
  const { payments, stats, pagination } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [selectedGateway, setSelectedGateway] = useState("CYBERPLUS");

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold leading-7 text-gray-900 sm:text-4xl sm:truncate">
              🏦 Administration des Paiements Legacy
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Gestion des paiements utilisant les tables ___xtr_order, ___xtr_customer et ic_postback
            </p>
          </div>
        </div>

        {/* Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <strong>Succès !</strong> {actionData.payment ? 
              `Paiement créé avec l'ID: ${actionData.payment.id}` : 
              "Opération réussie"
            }
          </div>
        )}

        {actionData?.error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Erreur :</strong> {actionData.error}
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">📦</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Commandes
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.total_orders.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">✅</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Payées
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.paid_orders.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">⏳</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      En Attente
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.pending_orders.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">💰</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Montant Total
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.total_amount.toLocaleString()} {stats.currency}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              🧪 Actions de Test
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Créer un paiement de test */}
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">Créer un Paiement de Test</h4>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="action" value="create_test_payment" />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID Client</label>
                    <input
                      type="text"
                      name="customerId"
                      defaultValue="1"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Montant (€)</label>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      defaultValue="99.99"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gateway</label>
                    <select
                      name="gateway"
                      value={selectedGateway}
                      onChange={(e) => setSelectedGateway(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="CYBERPLUS">CyberPlus</option>
                      <option value="STRIPE">Stripe</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="BANK_TRANSFER">Virement</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting ? "Création..." : "Créer Paiement Test"}
                  </button>
                </Form>
              </div>

              {/* Vérifier le statut */}
              <div>
                <h4 className="text-md font-medium text-gray-700 mb-3">Vérifier le Statut d'un Paiement</h4>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="action" value="check_status" />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID Commande</label>
                    <input
                      type="text"
                      name="orderId"
                      placeholder="ex: 123"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {isSubmitting ? "Vérification..." : "Vérifier Statut"}
                  </button>
                </Form>

                {actionData?.success && actionData.payment && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <h5 className="font-medium text-blue-800">Résultat:</h5>
                    <pre className="text-sm text-blue-700 mt-1">
                      {JSON.stringify(actionData.payment, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Documentation API */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              📚 APIs Disponibles
            </h3>
            
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium">POST /api/payments</h4>
                <p className="text-sm text-gray-600">Créer un nouveau paiement dans ___xtr_order</p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium">GET /api/payments/:orderId/status</h4>
                <p className="text-sm text-gray-600">Obtenir le statut d'un paiement</p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-medium">POST /api/payments/callback/:gateway</h4>
                <p className="text-sm text-gray-600">Recevoir les callbacks de paiement (ic_postback)</p>
              </div>
              
              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-medium">GET /api/payments/stats</h4>
                <p className="text-sm text-gray-600">Statistiques basées sur les vraies tables legacy</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h4 className="font-medium text-gray-900 mb-2">🗄️ Tables Legacy Utilisées:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• <strong>___xtr_order</strong>: {stats.total_orders.toLocaleString()} commandes</li>
                <li>• <strong>___xtr_customer</strong>: Clients et informations de facturation</li>
                <li>• <strong>ic_postback</strong>: Logs et callbacks de paiement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
