import { type LoaderFunctionArgs, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Paiement refusé | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface LoaderData {
  errorCode?: string;
  reference?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  return json<LoaderData>({
    errorCode: url.searchParams.get('Erreur') || url.searchParams.get('E') || undefined,
    reference: url.searchParams.get('Ref') || url.searchParams.get('R') || undefined,
  });
}

export default function PayboxPaymentRefused() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          {/* Icône d'erreur */}
          <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/50">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          {/* Titre */}
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Paiement refusé
          </h1>

          {/* Message */}
          <p className="text-lg text-slate-600 mb-8">
            Votre paiement n'a pas pu être traité. Veuillez vérifier vos informations bancaires et réessayer.
          </p>

          {/* Détails erreur */}
          {data.errorCode && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-red-900 mb-1">Code erreur</h3>
                  <p className="text-sm text-red-700 font-mono">{data.errorCode}</p>
                  {data.reference && (
                    <p className="text-sm text-red-700 mt-2">
                      Référence: <span className="font-mono">{data.reference}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Raisons possibles */}
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8 text-left">
            <h2 className="font-semibold text-orange-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Raisons possibles
            </h2>
            <ul className="space-y-2 text-sm text-orange-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span>Fonds insuffisants sur votre compte</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span>Carte expirée ou invalide</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span>Limite de paiement dépassée</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span>Paiement refusé par votre banque</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span>Erreur lors de la saisie du code de sécurité</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={`/checkout-payment${data.reference ? `?orderId=${data.reference}` : ''}`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Réessayer le paiement
            </Link>
            
            <Link
              to="/support/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold border-2 border-slate-200 hover:border-slate-300 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Contacter le support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
