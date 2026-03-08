import { type PaymentMethod } from "~/types/payment";

interface Props {
  paymentMethods: PaymentMethod[];
  acceptedTerms: boolean;
  onAcceptedTermsChange: (accepted: boolean) => void;
  isProcessing: boolean;
  totalTTC: number;
  itemCount: number;
  orderNumber?: string;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function CheckoutPaiementSection({
  paymentMethods,
  acceptedTerms,
  onAcceptedTermsChange,
  isProcessing,
  totalTTC,
  itemCount,
  orderNumber,
}: Props) {
  return (
    <div className="space-y-6 pt-2">
      {/* Payment methods */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">
          Methode de paiement
        </h3>
        <div className="space-y-3">
          {paymentMethods
            .filter((method) => method.enabled)
            .map((method) => (
              <label
                key={method.id}
                className="relative flex items-center p-4 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  required
                  defaultChecked={method.isDefault}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div className="ml-4 flex items-center gap-3">
                  <div className="w-12 h-8 bg-white rounded flex items-center justify-center border border-slate-200">
                    <img
                      src={method.logo}
                      alt={method.name}
                      className="h-6 w-auto object-contain"
                    />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">
                      {method.name}
                    </div>
                    <div className="text-sm text-slate-500">
                      {method.description}
                    </div>
                  </div>
                </div>
              </label>
            ))}
        </div>
      </div>

      {/* CGV */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            checked={acceptedTerms}
            onChange={(e) => onAcceptedTermsChange(e.target.checked)}
            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded mt-0.5"
          />
          <span className="text-sm text-slate-700">
            J&apos;accepte les{" "}
            <a
              href="/legal/cgv"
              target="_blank"
              className="text-blue-600 hover:underline font-medium"
            >
              conditions generales de vente
            </a>{" "}
            et la{" "}
            <a
              href="/legal/privacy"
              target="_blank"
              className="text-blue-600 hover:underline font-medium"
            >
              politique de confidentialite
            </a>
          </span>
        </label>
      </div>

      {/* Security badges */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 text-emerald-600 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-emerald-700">
            Paiement 100% securise — SSL/TLS, PCI DSS, 3D Secure
          </p>
        </div>
      </div>

      {orderNumber && (
        <p className="text-xs text-center text-slate-500">
          Commande #{orderNumber} &middot; {itemCount} article
          {itemCount > 1 ? "s" : ""} &middot; {formatPrice(totalTTC)}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isProcessing || !acceptedTerms}
        className="w-full bg-cta hover:bg-cta-hover text-white py-4 px-6 rounded-xl font-semibold shadow-lg shadow-cta/30 hover:shadow-xl hover:shadow-cta/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
      >
        {isProcessing ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Traitement en cours...</span>
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Payer {formatPrice(totalTTC)}</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
