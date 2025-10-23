import { type LoaderFunctionArgs, type ActionFunctionArgs, json } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { useLoaderData, useNavigate, Form, useNavigation } from "@remix-run/react";
import { 
  ArrowLeft,
  DollarSign,
  CreditCard,
  Calendar,
  MapPin,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download
} from "lucide-react";
import { useState } from "react";
import { requireAdmin } from "../auth/unified.server";
import { getPaymentById, processRefund } from "../services/payment-admin.server";
import { type Payment, PaymentStatus } from "../types/payment";

interface LoaderData {
  payment: Payment | null;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  await requireAdmin({ context });
  
  const paymentId = params.paymentId;
  if (!paymentId) {
    throw new Response("Payment ID is required", { status: 400 });
  }

  try {
    const payment = await getPaymentById(paymentId);
    return json<LoaderData>({ payment });
  } catch (error) {
    console.error("❌ Error loading payment:", error);
    return json<LoaderData>({ payment: null });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin({ context });
  
  const formData = await request.formData();
  const action = formData.get('action');
  const paymentId = formData.get('paymentId') as string;
  
  try {
    if (action === 'refund') {
      const amount = parseFloat(formData.get('amount') as string);
      const reason = formData.get('reason') as string;
      
      await processRefund(paymentId, amount, reason);
      
      return json({ 
        success: true, 
        message: 'Remboursement traité avec succès' 
      });
    }
    
    return json({ 
      success: false, 
      message: 'Action non reconnue' 
    }, { status: 400 });
  } catch (error) {
    console.error("❌ Error processing action:", error);
    return json({ 
      success: false, 
      message: 'Erreur lors du traitement de l\'action' 
    }, { status: 500 });
  }
}

export default function AdminPaymentDetail() {
  const { payment } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Paiement introuvable
          </h2>
          <p className="text-gray-600 mb-4">
            Le paiement demandé n'existe pas ou n'est plus accessible.
          </p>
          <button
            onClick={() => navigate('/admin/payments/dashboard')}
            className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux paiements
          </button>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.COMPLETED:
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case PaymentStatus.PENDING:
      case PaymentStatus.PROCESSING:
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case PaymentStatus.FAILED:
        return <XCircle className="h-5 w-5 text-red-600" />;
      case PaymentStatus.CANCELLED:
        return <XCircle className="h-5 w-5 text-gray-600" />;
      case PaymentStatus.REFUNDED:
        return <RefreshCw className="h-5 w-5 text-purple-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const badges = {
      [PaymentStatus.COMPLETED]: 'bg-green-100 text-green-800',
      [PaymentStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [PaymentStatus.PROCESSING]: 'bg-blue-100 text-blue-800',
      [PaymentStatus.FAILED]: 'bg-red-100 text-red-800',
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
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const canRefund = payment.status === PaymentStatus.COMPLETED && !payment.refundedAt;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/admin/payments/dashboard')}
                  className="mr-4 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Détails du Paiement
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Paiement #{payment.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {getStatusIcon(payment.status)}
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(payment.status)}`}>
                  {payment.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Informations principales */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Détails du paiement */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Informations de Transaction
                </h3>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      ID Transaction
                    </label>
                    <p className="mt-1 text-sm text-gray-900 font-mono">
                      {payment.transactionId || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      ID Commande
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {payment.orderId}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Montant
                    </label>
                    <div className="mt-1 flex items-center">
                      <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-lg font-semibold text-gray-900">
                        {formatPrice(payment.amount)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Méthode de paiement
                    </label>
                    <div className="mt-1 flex items-center">
                      <CreditCard className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">
                        {payment.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Date de création
                    </label>
                    <div className="mt-1 flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">
                        {formatDate(payment.createdAt)}
                      </span>
                    </div>
                  </div>
                  {payment.processedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">
                        Date de traitement
                      </label>
                      <div className="mt-1 flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-900">
                          {formatDate(payment.processedAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Adresse de facturation */}
            {payment.billingAddress && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Adresse de Facturation
                  </h3>
                </div>
                <div className="px-6 py-4">
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                    <div>
                      <p className="text-sm text-gray-900">
                        {payment.billingAddress.firstName} {payment.billingAddress.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {payment.billingAddress.street}
                      </p>
                      <p className="text-sm text-gray-600">
                        {payment.billingAddress.postalCode} {payment.billingAddress.city}
                      </p>
                      <p className="text-sm text-gray-600">
                        {payment.billingAddress.country}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Historique */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Historique des Événements
                </h3>
              </div>
              <div className="px-6 py-4">
                <div className="flow-root">
                  <ul className="-mb-8">
                    <li>
                      <div className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                              <DollarSign className="h-4 w-4 text-white" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Paiement créé - {formatPrice(payment.amount)}
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {formatDate(payment.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                    
                    {payment.processedAt && (
                      <li>
                        <div className="relative">
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center ring-8 ring-white">
                                <CheckCircle className="h-4 w-4 text-white" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-500">
                                  Paiement traité avec succès
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                {formatDate(payment.processedAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-6">
            
            {/* Actions principales */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Actions</h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                
                {canRefund && (
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rembourser
                  </button>
                )}
                
                <button className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger reçu
                </button>
                
                <button className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <User className="h-4 w-4 mr-2" />
                  Voir le client
                </button>
              </div>
            </div>

            {/* Informations techniques */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Informations Techniques
                </h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    ID Paiement
                  </label>
                  <p className="mt-1 text-xs text-gray-900 font-mono break-all">
                    {payment.id}
                  </p>
                </div>
                
                {payment.gatewayTransactionId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      ID Gateway
                    </label>
                    <p className="mt-1 text-xs text-gray-900 font-mono">
                      {payment.gatewayTransactionId}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Devise
                  </label>
                  <p className="mt-1 text-xs text-gray-900">
                    {payment.currency}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de remboursement */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Traiter un Remboursement
              </h3>
              
              <Form method="post" className="space-y-4">
                <input type="hidden" name="action" value="refund" />
                <input type="hidden" name="paymentId" value={payment.id} />
                
                <div className="text-left">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Montant à rembourser
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    max={payment.amount}
                    name="amount"
                    id="amount"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Max: ${formatPrice(payment.amount)}`}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div className="text-left">
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                    Raison du remboursement
                  </label>
                  <textarea
                    name="reason"
                    id="reason"
                    rows={3}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Expliquez la raison du remboursement..."
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRefundModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                  <Button className="flex-1 px-4 py-2  rounded-md disabled:opacity-50" variant="red" type="submit"
                    disabled={navigation.state === 'submitting'}>\n  {navigation.state === 'submitting' ? 'Traitement...' : 'Rembourser'}\n</Button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
