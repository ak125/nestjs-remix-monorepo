import { type LoaderFunctionArgs, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Paiement réussi | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface LoaderData {
  amount?: string;
  reference?: string;
  authorization?: string;
  signature?: string;
  errorCode?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // Enregistrer le paiement automatiquement côté serveur
  const amount = url.searchParams.get('Mt');
  const reference = url.searchParams.get('Ref');
  const authorization = url.searchParams.get('Auto');
  const errorCode = url.searchParams.get('Erreur') || '00000';

  // Appel au callback test pour enregistrer le paiement
  if (amount && reference) {
    try {
      const callbackUrl = `http://localhost:3000/api/paybox/callback-test?Mt=${amount}&Ref=${reference}&Auto=${authorization || 'XXXXXX'}&Erreur=${errorCode}`;
      const response = await fetch(callbackUrl);
      const data = await response.json();
      
      if (!data.success) {
        console.error('Erreur enregistrement paiement:', data);
      } else {
        console.log('✅ Paiement enregistré automatiquement:', data);
      }
    } catch (error) {
      console.error('Erreur appel callback:', error);
    }
  }
  
  return json<LoaderData>({
    amount: amount || undefined,
    reference: reference || undefined,
    authorization: authorization || undefined,
    signature: url.searchParams.get('Signature') || url.searchParams.get('K') || undefined,
    errorCode: errorCode,
  });
}

export default function PayboxPaymentSuccess() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          {/* Icône de succès */}
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/50">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Titre */}
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Paiement réussi !
          </h1>

          {/* Message */}
          <p className="text-lg text-slate-600 mb-8">
            Votre commande a été confirmée et votre paiement a été traité avec succès.
          </p>

          {/* Détails */}
          {data.reference && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-8 text-left">
              <h2 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Détails de la transaction
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700">Référence commande</span>
                  <span className="font-mono font-semibold text-emerald-900">{data.reference}</span>
                </div>
                {data.authorization && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-700">N° autorisation</span>
                    <span className="font-mono font-semibold text-emerald-900">{data.authorization}</span>
                  </div>
                )}
                {data.amount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-700">Montant</span>
                    <span className="font-semibold text-emerald-900">
                      {(parseInt(data.amount) / 100).toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email de confirmation */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-blue-900 mb-1">Email de confirmation envoyé</h3>
                <p className="text-sm text-blue-700">
                  Vous allez recevoir un email de confirmation avec le récapitulatif de votre commande.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={data.reference ? `/account/orders/${data.reference}` : '/account/orders'}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Voir ma commande
            </Link>
            
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold border-2 border-slate-200 hover:border-slate-300 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
