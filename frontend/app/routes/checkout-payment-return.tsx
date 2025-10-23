import { Alert } from '@fafa/ui';
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { processPaymentReturn } from "../services/payment.server";
import { formatPrice } from "../utils/orders";

interface PaymentResult {
  status: 'SUCCESS' | 'REFUSED' | 'CANCELLED' | 'PENDING';
  transactionId: string;
  orderId: string;
  orderNumber?: string;
  amount: number;
  email?: string;
  date: string;
  errorMessage?: string;
  errorCode?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const transactionId = url.searchParams.get("trans_id") || url.searchParams.get("transaction_id");

  if (!transactionId) {
    return redirect("/cart");
  }

  try {
    // Traiter le retour de paiement
    const result = await processPaymentReturn({
      transactionId,
      status,
      params: Object.fromEntries(url.searchParams),
    });

    if (!result) {
      throw new Response("Transaction introuvable", { status: 404 });
    }

    return json({ result: result as PaymentResult });
  } catch (error) {
    console.error("❌ Payment return error:", error);
    throw new Response("Erreur lors du traitement du paiement", { status: 500 });
  }
}

export default function PaymentReturnPage() {
  const { result } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {result.status === 'SUCCESS' && (
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Paiement réussi !
            </h1>
            
            <p className="text-gray-600 mb-6">
              Votre commande #{result.orderNumber || result.orderId} a été confirmée.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Montant payé :</span>
                  <span className="font-semibold">{formatPrice(result.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction :</span>
                  <span className="font-mono text-xs">{result.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date :</span>
                  <span>{new Date(result.date).toLocaleString('fr-FR')}</span>
                </div>
              </div>
            </div>

            {result.email && (
<Alert className="rounded-lg p-4 mb-6" variant="info">
                <p className="text-sm text-blue-800">
                  Un email de confirmation vous a été envoyé à l'adresse <strong>{result.email}</strong>.
                  Vous pouvez suivre votre commande dans votre espace client.
                </p>
              </Alert>
            )}

            <div className="space-y-3">
              <Link 
                to={`/account/orders/${result.orderId}`} 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Voir ma commande
              </Link>
              <Link 
                to="/products" 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Continuer mes achats
              </Link>
            </div>
          </div>
        )}

        {result.status === 'REFUSED' && (
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Paiement refusé
            </h1>
            
            <p className="text-gray-600 mb-6">
              Votre paiement n'a pas pu être traité.
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Raison :</span>
                  <span className="text-red-800 font-medium">
                    {result.errorMessage || "Paiement refusé par votre banque"}
                  </span>
                </div>
                {result.errorCode && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Code :</span>
                    <span className="font-mono text-xs">{result.errorCode}</span>
                  </div>
                )}
              </div>
            </div>

<Alert className="rounded-lg p-4 mb-6" variant="warning">
              <h3 className="font-medium text-yellow-800 mb-2">Que faire ?</h3>
              <ul className="text-sm text-yellow-700 space-y-1 text-left">
                <li>• Vérifiez que votre carte est valide et non expirée</li>
                <li>• Assurez-vous d'avoir suffisamment de fonds</li>
                <li>• Contactez votre banque si le problème persiste</li>
                <li>• Essayez une autre méthode de paiement</li>
              </ul>
            </Alert>

            <div className="space-y-3">
              <Link 
                to={`/checkout-payment?orderId=${result.orderId}`} 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Réessayer le paiement
              </Link>
              <Link 
                to="/support/contact" 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Contacter le support
              </Link>
            </div>
          </div>
        )}

        {result.status === 'CANCELLED' && (
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Paiement annulé
            </h1>
            
            <p className="text-gray-600 mb-6">
              Vous avez annulé le paiement.
            </p>

            <Alert intent="warning"><p>Votre commande #{result.orderNumber || result.orderId} est toujours en attente de paiement.
                Elle sera automatiquement annulée dans 24 heures si elle n'est pas payée.</p></Alert>

            <div className="space-y-3">
              <Link 
                to={`/checkout-payment?orderId=${result.orderId}`} 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reprendre le paiement
              </Link>
              <Link 
                to="/cart" 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Modifier mon panier
              </Link>
            </div>
          </div>
        )}

        {result.status === 'PENDING' && (
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Paiement en attente
            </h1>
            
            <p className="text-gray-600 mb-6">
              Votre paiement est en cours de traitement.
            </p>

<Alert className="rounded-lg p-4 mb-6" variant="info">
              <div className="space-y-2 text-sm text-blue-800">
                <p>Transaction : <span className="font-mono">{result.transactionId}</span></p>
                <p>
                  Nous attendons la confirmation de votre banque.
                  Cela peut prendre quelques minutes.
                </p>
                <p>
                  Vous recevrez un email dès que le paiement sera confirmé.
                </p>
              </div>
            </Alert>

            <div className="space-y-3">
              <Link 
                to={`/account/orders/${result.orderId}`} 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Suivre ma commande
              </Link>
              <Link 
                to="/" 
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retour à l'accueil
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
