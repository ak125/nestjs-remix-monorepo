import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { useEffect } from "react";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Alert } from "~/components/ui/alert";
import { trackPurchase } from "~/utils/analytics";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { processPaymentReturn } from "../services/payment.server";
import { formatPrice } from "../utils/orders";

export const handle = {
  hideGlobalFooter: true,
  pageRole: createPageRoleMeta(PageRole.RX_CHECKOUT, {
    clusterId: "checkout-return",
    canonicalEntity: "confirmation",
    funnelStage: "decision",
    conversionGoal: "purchase",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Confirmation de paiement | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/checkout-payment-return",
  },
];

// -- Types -------------------------------------------------------------------

interface PaymentResult {
  status: "SUCCESS" | "REFUSED" | "CANCELLED" | "PENDING" | "ERROR";
  transactionId: string;
  orderId: string;
  orderNumber?: string;
  amount: number;
  email?: string;
  date: string;
  errorMessage?: string;
  errorCode?: string;
}

// -- Loader ------------------------------------------------------------------

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // --- Paybox return (params: Mt, Ref, Auto, Erreur, K) ---
  const isPaybox =
    url.searchParams.has("Erreur") || url.searchParams.has("Auto");

  if (isPaybox) {
    const erreur = url.searchParams.get("Erreur") || "";
    const auto = url.searchParams.get("Auto") || "";
    const ref = url.searchParams.get("Ref") || "";
    const mt = url.searchParams.get("Mt") || "0";
    // statusHint vient de notre PBX_EFFECTUE/REFUSE/ANNULE (ex: ?status=CANCELLED)
    const statusHint = url.searchParams.get("status");

    let derivedStatus: PaymentResult["status"];
    if (erreur === "00000") {
      derivedStatus = "SUCCESS";
    } else if (statusHint === "CANCELLED") {
      derivedStatus = "CANCELLED";
    } else {
      derivedStatus = "REFUSED";
    }

    logger.log("[PaymentReturn] Paybox return:", {
      erreur,
      auto,
      ref,
      status: derivedStatus,
    });

    // Clear server-side cart on successful payment (non-blocking)
    if (derivedStatus === "SUCCESS") {
      try {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
        await fetch(`${backendUrl}/api/cart`, {
          method: "DELETE",
          headers: {
            Cookie: request.headers.get("Cookie") || "",
          },
        });
      } catch {
        // Non-blocking — cart cleanup also happens in IPN callback
      }
    }

    return json({
      result: {
        status: derivedStatus,
        transactionId: auto,
        orderId: ref,
        amount: parseInt(mt, 10) / 100,
        date: new Date().toISOString(),
        errorCode: erreur !== "00000" ? erreur : undefined,
      } satisfies PaymentResult,
    });
  }

  // --- SystemPay / Cyberplus return ---
  const status =
    url.searchParams.get("status") || url.searchParams.get("vads_trans_status");
  const transactionId =
    url.searchParams.get("trans_id") ||
    url.searchParams.get("transaction_id") ||
    url.searchParams.get("vads_trans_id");

  if (!transactionId) {
    logger.warn("[PaymentReturn] Missing transactionId", {
      keys: Array.from(url.searchParams.keys()),
    });
    return json({
      result: {
        status: "ERROR" as const,
        transactionId: "",
        orderId: "",
        amount: 0,
        date: new Date().toISOString(),
        errorMessage:
          "Transaction introuvable. Verifiez votre email de confirmation ou contactez le support.",
      } satisfies PaymentResult,
    });
  }

  try {
    const result = await processPaymentReturn({
      transactionId,
      status,
      params: Object.fromEntries(url.searchParams),
    });

    if (!result) {
      throw new Response("Transaction introuvable", { status: 404 });
    }

    logger.log("[PaymentReturn] Processed:", {
      transactionId,
      status: (result as PaymentResult).status,
    });

    return json({ result: result as PaymentResult });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    logger.error("[PaymentReturn] Error:", error);
    throw new Response("Erreur lors du traitement du paiement", {
      status: 500,
    });
  }
}

// -- Component ---------------------------------------------------------------

export default function PaymentReturnPage() {
  const { result } = useLoaderData<typeof loader>();

  // GA4: track purchase once per transaction (sessionStorage guard)
  useEffect(() => {
    const txId = result?.transactionId || result?.orderId;
    if (result?.status === "SUCCESS" && txId) {
      const key = `purchase_tracked_${txId}`;
      if (!sessionStorage.getItem(key)) {
        trackPurchase(txId, result.amount);
        sessionStorage.setItem(key, "1");
      }
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-12 px-page">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
          {result.status === "SUCCESS" && <SuccessView result={result} />}
          {result.status === "REFUSED" && <RefusedView result={result} />}
          {result.status === "CANCELLED" && <CancelledView result={result} />}
          {result.status === "PENDING" && <PendingView result={result} />}
          {result.status === "ERROR" && <ErrorView result={result} />}
          {!["SUCCESS", "REFUSED", "CANCELLED", "PENDING", "ERROR"].includes(
            result.status,
          ) && <UnknownView />}
        </div>
      </div>

      {/* Mini footer transactionnel */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-page flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} AutoMecanik</span>
          <div className="flex gap-4">
            <a href="/legal/cgv" className="hover:text-slate-700">
              CGV
            </a>
            <a href="/legal/privacy" className="hover:text-slate-700">
              Confidentialite
            </a>
            <a href="/contact" className="hover:text-slate-700">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// -- Status views ------------------------------------------------------------

function SuccessView({ result }: { result: PaymentResult }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success/15 mb-6">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Paiement reussi !
      </h1>

      <p className="text-gray-600 mb-6">
        Votre commande #{result.orderNumber || result.orderId} a ete confirmee.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Montant paye :</span>
            <span className="font-semibold">{formatPrice(result.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Transaction :</span>
            <span className="font-mono text-xs">{result.transactionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date :</span>
            <span>{new Date(result.date).toLocaleString("fr-FR")}</span>
          </div>
        </div>
      </div>

      {/* Prochaines etapes */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Prochaines etapes
        </h3>
        <ol className="text-sm text-blue-700 space-y-1 text-left list-decimal list-inside">
          <li>Confirmation envoyee par email</li>
          <li>Preparation de votre commande</li>
          <li>Expedition sous 24-48h</li>
        </ol>
      </div>

      {result.email && (
        <Alert className="rounded-lg p-4 mb-6" variant="info">
          <p className="text-sm text-blue-800">
            Un email de confirmation vous a ete envoye a l&apos;adresse{" "}
            <strong>{result.email}</strong>.
          </p>
        </Alert>
      )}

      <div className="space-y-3">
        <Link
          to={`/account/orders/${result.orderId}`}
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Voir ma commande
        </Link>
        <Link
          to="/products"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

function RefusedView({ result }: { result: PaymentResult }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/15 mb-6">
        <XCircle className="h-8 w-8 text-red-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">Paiement refuse</h1>

      <p className="text-gray-600 mb-6">
        Votre paiement n&apos;a pas pu etre traite.
      </p>

      <div className="bg-destructive/5 border border-red-200 rounded-lg p-4 mb-6">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Raison :</span>
            <span className="text-red-800 font-medium">
              {result.errorMessage || "Paiement refuse par votre banque"}
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
          <li>&bull; Verifiez que votre carte est valide et non expiree</li>
          <li>&bull; Assurez-vous d&apos;avoir suffisamment de fonds</li>
          <li>&bull; Contactez votre banque si le probleme persiste</li>
          <li>&bull; Essayez une autre methode de paiement</li>
        </ul>
      </Alert>

      <div className="space-y-3">
        <Link
          to={`/checkout-payment?orderId=${result.orderId}`}
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Reessayer le paiement
        </Link>
        <Link
          to="/contact"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Contacter le support
        </Link>
      </div>
    </div>
  );
}

function CancelledView({ result }: { result: PaymentResult }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-warning/15 mb-6">
        <AlertTriangle className="h-8 w-8 text-yellow-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">Paiement annule</h1>

      <p className="text-gray-600 mb-6">Vous avez annule le paiement.</p>

      <Alert intent="warning">
        <p>
          Votre commande #{result.orderNumber || result.orderId} est toujours en
          attente de paiement. Elle sera automatiquement annulee si elle
          n&apos;est pas payee.
        </p>
      </Alert>

      <div className="space-y-3 mt-6">
        <Link
          to={`/checkout-payment?orderId=${result.orderId}`}
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Reprendre le paiement
        </Link>
        <Link
          to="/cart"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Modifier mon panier
        </Link>
      </div>
    </div>
  );
}

function PendingView({ result }: { result: PaymentResult }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/15 mb-6">
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
          <p>
            Transaction :{" "}
            <span className="font-mono">{result.transactionId}</span>
          </p>
          <p>
            Nous attendons la confirmation de votre banque. Cela peut prendre
            quelques minutes.
          </p>
          <p>Vous recevrez un email des que le paiement sera confirme.</p>
        </div>
      </Alert>

      <div className="space-y-3">
        <Link
          to={`/account/orders/${result.orderId}`}
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Suivre ma commande
        </Link>
        <Link
          to="/"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ result }: { result: PaymentResult }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/15 mb-6">
        <AlertTriangle className="h-8 w-8 text-red-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Transaction introuvable
      </h1>

      <p className="text-gray-600 mb-6">
        {result.errorMessage ||
          "Impossible de retrouver votre transaction. Verifiez votre email de confirmation ou contactez le support."}
      </p>

      <div className="space-y-3">
        <Link
          to="/contact"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Contacter le support
        </Link>
        <Link
          to="/"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

function UnknownView() {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-6">
        <HelpCircle className="h-8 w-8 text-gray-500" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Statut de paiement inconnu
      </h1>

      <p className="text-gray-600 mb-6">
        Le statut de votre paiement n&apos;a pas pu etre determine. Veuillez
        verifier votre email de confirmation ou contacter notre support.
      </p>

      <div className="space-y-3">
        <Link
          to="/contact"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Contacter le support
        </Link>
        <Link
          to="/"
          className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

// -- Error Boundary ----------------------------------------------------------

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
