import { useState } from "react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { toast } from "sonner";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { getProxyHeaders } from "~/utils/proxy-headers.server";
import { requireAuth } from "../auth/unified.server";

export const meta: MetaFunction = () => createNoIndexMeta("Facture");

// Réponse de GET /api/orders/:id/invoice (backend OrdersController.getOrderInvoice)
interface InvoiceApiAddress {
  civility: string | null;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  addressLine2: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
}

interface InvoiceApiLine {
  orl_id: string | null;
  orl_pg_name: string | null;
  orl_art_quantity: string | number | null;
  orl_art_price_sell_unit_ttc: string | number | null;
  orl_art_price_sell_ttc: string | number | null;
}

interface InvoiceApiData {
  ord_id: string;
  ord_parent: string | null;
  ord_date: string | null;
  ord_date_pay: string | null;
  ord_amount_ttc: string | number | null;
  ord_deposit_ttc: string | number | null;
  ord_shipping_fee_ttc: string | number | null;
  ord_total_ttc: string | number | null;
  lines: InvoiceApiLine[];
  billing_address: InvoiceApiAddress | null;
  delivery_address: InvoiceApiAddress | null;
  payment_state: "paid" | "payable" | "not_payable";
  payment_refusal: string | null;
}

const LOAD_FAILED = "Erreur lors du chargement de la facture";

function toAmount(value: string | number | null): number {
  const amount = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(amount) ? amount : 0;
}

/** Données affichées par la page, dérivées de la réponse du backend. */
export function toInvoice(data: InvoiceApiData) {
  const parentOrderId =
    data.ord_parent && data.ord_parent !== "0" ? data.ord_parent : null;
  return {
    id: data.ord_id,
    number: `${data.ord_id}/A`,
    date: data.ord_date,
    datePay: data.ord_date_pay,
    isPaid: data.payment_state === "paid",
    isSupplementOrder: parentOrderId !== null,
    parentOrderId,
    // Seul un supplément se paie depuis cette page, et seulement si le
    // backend le déclare payable (même règle que le lien de reprise).
    canPay: parentOrderId !== null && data.payment_state === "payable",
    paymentRefusal: data.payment_refusal,
    amountTTC: toAmount(data.ord_amount_ttc),
    depositTTC: toAmount(data.ord_deposit_ttc),
    shippingFeeTTC: toAmount(data.ord_shipping_fee_ttc),
    totalTTC: toAmount(data.ord_total_ttc),
    billingAddress: data.billing_address,
    deliveryAddress: data.delivery_address,
    lines: data.lines.map((line) => ({
      id: line.orl_id,
      productName: line.orl_pg_name ?? "",
      unitPriceTTC: toAmount(line.orl_art_price_sell_unit_ttc),
      quantity: toAmount(line.orl_art_quantity),
      totalPriceTTC: toAmount(line.orl_art_price_sell_ttc),
    })),
  };
}

/**
 * La facture passe par le backend, qui ne sert que les commandes du client
 * connecté (404 sinon) et calcule l'état de paiement.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAuth(request);
  const orderId = params.orderId;
  if (!orderId) {
    throw new Response("Commande non trouvée", { status: 404 });
  }

  let res: Response;
  try {
    res = await fetch(
      getInternalApiUrlFromRequest(
        `/api/orders/${encodeURIComponent(orderId)}/invoice`,
        request,
      ),
      {
        headers: {
          Accept: "application/json",
          Cookie: request.headers.get("Cookie") || "",
          ...getProxyHeaders(request),
        },
      },
    );
  } catch (error) {
    logger.error("Facture : backend injoignable", error);
    throw new Response(LOAD_FAILED, { status: 500 });
  }

  if (res.status === 404) {
    throw new Response("Commande non trouvée", { status: 404 });
  }
  if (!res.ok) {
    logger.error(`Facture ${orderId} : réponse backend ${res.status}`);
    throw new Response(LOAD_FAILED, { status: 500 });
  }

  const body = (await res.json().catch(() => null)) as {
    data?: InvoiceApiData;
  } | null;
  if (!body?.data) {
    logger.error(`Facture ${orderId} : réponse backend sans données`);
    throw new Response(LOAD_FAILED, { status: 500 });
  }

  return { invoice: toInvoice(body.data) };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("fr-FR");
}

function AddressBlock({
  title,
  address,
}: {
  title: string;
  address: InvoiceApiAddress | null;
}) {
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" ");
  return (
    <div className="border border-gray-200 rounded p-4">
      <h3 className="font-semibold mb-2 underline">{title}</h3>
      {address ? (
        <>
          <p>{join(address.civility, address.lastName, address.firstName)}</p>
          <p>{address.address}</p>
          {address.addressLine2 && <p>{address.addressLine2}</p>}
          <p>
            {join(address.zipCode, address.city)}
            {address.country ? `, ${address.country}` : ""}
          </p>
        </>
      ) : (
        <p className="text-gray-500">
          Adresse non enregistrée pour cette commande
        </p>
      )}
    </div>
  );
}

export default function OrderInvoice() {
  const { invoice } = useLoaderData<typeof loader>();
  const [paymentMethod, setPaymentMethod] = useState<"PAYBOX" | "PAYPAL">(
    "PAYBOX",
  );
  const date = formatDate(invoice.date);
  const datePay = formatDate(invoice.datePay);

  return (
    <div className="container-fluid invoice-page bg-white">
      <div className="max-w-5xl mx-auto p-8">
        {/* En-tête avec logo et informations commande */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          <div className="col-span-12 md:col-span-3">
            <div className="border p-4 rounded">
              <img
                src="/assets/img/automecanik.png"
                alt="AutoMecanik"
                className="w-full h-auto"
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">{/* Espace vide */}</div>

          <div className="col-span-12 md:col-span-5">
            <div className="border border-gray-300 rounded-lg p-4 space-y-2">
              {/* Titre selon le type et statut */}
              <div className="flex justify-between">
                <span className="font-semibold">
                  {invoice.isPaid
                    ? "Facture n°"
                    : invoice.isSupplementOrder
                      ? "Supplément n°"
                      : "Bon de commande n°"}
                </span>
                <span>{invoice.number}</span>
              </div>

              {/* Date de commande */}
              {date && (
                <div className="flex justify-between">
                  <span className="font-semibold">Date</span>
                  <span>{date}</span>
                </div>
              )}

              {/* Date de paiement si payé */}
              {invoice.isPaid && datePay && (
                <div className="flex justify-between">
                  <span className="font-semibold">Date de paiement</span>
                  <span>{datePay}</span>
                </div>
              )}

              {/* Référence commande parent si supplément */}
              {invoice.parentOrderId && (
                <div className="flex justify-between">
                  <span className="font-semibold">Commande parente n°</span>
                  <span>{invoice.parentOrderId}/A</span>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-semibold">Total TTC</span>
                <span className="font-bold">
                  {invoice.totalTTC.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Adresses facturation et livraison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <AddressBlock title="Facturée à :" address={invoice.billingAddress} />
          <AddressBlock title="Livrée à :" address={invoice.deliveryAddress} />
        </div>

        {/* Tableau des produits */}
        <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
          <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-300 font-semibold p-3 text-center">
            <div className="col-span-5">Désignation</div>
            <div className="col-span-3">PU TTC</div>
            <div className="col-span-1">QTE</div>
            <div className="col-span-3">PT TTC</div>
          </div>

          {invoice.lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-12 border-b border-gray-200 p-3 text-sm"
            >
              <div className="col-span-5">{line.productName}</div>
              <div className="col-span-3 text-right">
                {line.unitPriceTTC.toFixed(2)} €
              </div>
              <div className="col-span-1 text-center">{line.quantity}</div>
              <div className="col-span-3 text-right font-semibold">
                {line.totalPriceTTC.toFixed(2)} €
              </div>
            </div>
          ))}

          {/* Récapitulatif : montants enregistrés sur la commande */}
          <div className="grid grid-cols-12 bg-gray-50 p-4">
            <div className="col-span-12 md:col-span-6 md:col-start-7 space-y-1">
              <div className="flex justify-between">
                <span>Total articles TTC</span>
                <span>{invoice.amountTTC.toFixed(2)} €</span>
              </div>
              {invoice.depositTTC > 0 && (
                <div className="flex justify-between">
                  <span>Consignes TTC</span>
                  <span>{invoice.depositTTC.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Frais de port TTC</span>
                <span>{invoice.shippingFeeTTC.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-semibold">Total TTC</span>
                <span className="text-lg font-bold">
                  {invoice.totalTTC.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Supplément qui ne peut plus être payé (annulé, etc.) */}
        {invoice.isSupplementOrder &&
          !invoice.isPaid &&
          invoice.paymentRefusal && (
            <Alert intent="warning">
              <p>{invoice.paymentRefusal}</p>
            </Alert>
          )}

        {/* Section paiement (uniquement pour les suppléments payables) */}
        {invoice.canPay && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <img
                  src="/assets/img/pay-paybox.jpg"
                  alt="Paybox"
                  className="w-full max-w-xs mx-auto mb-3"
                />
                <p className="mb-3">Carte bancaire</p>
                <input
                  type="radio"
                  name="paymethod"
                  value="PAYBOX"
                  checked={paymentMethod === "PAYBOX"}
                  onChange={(e) => setPaymentMethod(e.target.value as "PAYBOX")}
                  className="w-4 h-4"
                />
              </div>

              <div className="border border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <img
                  src="/assets/img/pay-paypal.jpg"
                  alt="PayPal"
                  className="w-full max-w-xs mx-auto mb-3"
                />
                <p className="mb-3">PayPal</p>
                <input
                  type="radio"
                  name="paymethod"
                  value="PAYPAL"
                  checked={paymentMethod === "PAYPAL"}
                  onChange={(e) => setPaymentMethod(e.target.value as "PAYPAL")}
                  className="w-4 h-4"
                />
              </div>
            </div>

            <div className="border border-primary bg-primary/10 rounded-lg p-4">
              <p className="text-sm">
                En cliquant sur le bouton « Payer maintenant », vous acceptez de
                vous conformer aux{" "}
                <a
                  href="/conditions-generales-de-vente.html"
                  target="_blank"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Conditions générales de vente
                </a>{" "}
                que vous reconnaissez avoir lues, comprises et acceptées dans
                leur intégralité.
              </p>
            </div>

            <div className="text-center">
              <form
                method="post"
                action="/api/payments/proceed-supplement"
                onSubmit={async (e) => {
                  e.preventDefault();

                  try {
                    const response = await fetch(
                      "/api/payments/proceed-supplement",
                      {
                        method: "POST",
                        credentials: "include",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          orderId: invoice.id,
                          paymentMethod: paymentMethod,
                        }),
                      },
                    );

                    if (response.ok) {
                      const result = await response.json();
                      // Rediriger vers la passerelle de paiement
                      if (result.data?.redirectUrl) {
                        toast.loading("Redirection vers le paiement...", {
                          duration: 2000,
                        });
                        window.location.href = result.data.redirectUrl;
                      }
                    } else {
                      toast.error("Erreur d'initialisation du paiement", {
                        description: "Veuillez réessayer plus tard",
                        duration: 4000,
                      });
                    }
                  } catch (error) {
                    // Propager les Response HTTP (404, etc.) telles quelles
                    if (error instanceof Response) {
                      throw error;
                    }
                    logger.error("Payment error:", error);
                    toast.error("Erreur de paiement", {
                      description:
                        "Une erreur est survenue lors de l'initialisation",
                      duration: 4000,
                    });
                  }
                }}
              >
                <Button
                  className="font-bold py-3 px-8 rounded-lg text-lg"
                  variant="green"
                  type="submit"
                >
                  Payer maintenant
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Message si déjà payé */}
        {invoice.isPaid && (
          <Alert intent="success">
            <p>
              ✓ Cette commande a été payée
              {datePay ? ` le ${datePay}` : ""}
            </p>
          </Alert>
        )}

        {/* Pied de page */}
        <div className="border-t border-gray-300 pt-6 mt-8 text-center text-sm text-gray-600">
          <p className="mb-1">AUTO PIECES EQUIPEMENTS</p>
          <p className="mb-1">
            184 AVENUE ARISTIDE BRIAND 93320 LES PAVILLONS SOUS BOIS
          </p>
          <p className="mb-1">TEL 0177695892 SASU au capital de 10000 euro</p>
          <p className="mb-1">
            RCS Bobigny siret 82049999400010 N° tva FR58820499994 CODE APE4531Z
          </p>
          <p>WWW.AUTOMECANIK.COM</p>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-4 justify-center mt-8">
          <Link
            to={`/account/orders/${invoice.id}`}
            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded transition-colors"
          >
            ← Retour à la commande
          </Link>

          <button
            onClick={() => window.print()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-6 rounded transition-colors"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .invoice-page {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
