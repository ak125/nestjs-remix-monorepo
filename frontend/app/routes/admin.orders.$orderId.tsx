/**
 * Page detail d'une commande admin
 * Affiche toutes les infos : client, lignes, paiement Paybox, adresses, actions
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  CreditCard,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { logger } from "~/utils/logger";
import { requireUser } from "../auth/unified.server";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  getPaymentBadgeColor,
  getPaymentLabel,
  getPaymentMethodInfo,
  getStatusBadgeColor,
  getStatusLabel,
} from "../utils/orders.utils";

// ========================================
// META
// ========================================
export const meta = () => [
  { title: "Detail Commande | Admin" },
  { name: "robots", content: "noindex, nofollow" },
];

// ========================================
// TYPES
// ========================================
interface OrderLine {
  orl_id: string;
  orl_pg_name?: string;
  orl_pm_name?: string;
  orl_art_ref?: string;
  orl_art_quantity?: string;
  orl_art_price_sell_unit_ttc?: string;
  orl_art_price_sell_ttc?: string;
  orl_art_deposit_unit_ttc?: string;
  orl_art_deposit_ttc?: string;
  orl_website_url?: string;
}

interface Customer {
  cst_id?: string;
  cst_fname?: string;
  cst_name?: string;
  cst_mail?: string;
  cst_tel?: string;
  cst_gsm?: string;
  cst_city?: string;
  cst_zip_code?: string;
  cst_country?: string;
  cst_address?: string;
  cst_activ?: string;
}

interface AddressSnapshot {
  firstName?: string;
  lastName?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
}

interface Postback {
  status?: string;
  statuscode?: string;
  transactionid?: string;
  paymentid?: string;
  paymentmethod?: string;
  datepayment?: string;
  amount?: string;
}

interface OrderDetail {
  ord_id: string;
  ord_cst_id: string;
  ord_date: string;
  ord_amount_ttc?: string;
  ord_deposit_ttc?: string;
  ord_shipping_fee_ttc?: string;
  ord_total_ht?: string;
  ord_total_ttc: string;
  ord_tva?: string;
  ord_is_pay: string;
  ord_date_pay?: string;
  ord_ords_id: string;
  ord_info?: string;
  ord_tracking?: string;
  ord_tracking_url?: string;
  ord_date_ship?: string;
  ord_date_deliv?: string;
  ord_cancel_date?: string;
  ord_cancel_reason?: string;
  ord_updated_at?: string;
  customer?: Customer;
  ord_billing_snapshot?: AddressSnapshot;
  ord_shipping_snapshot?: AddressSnapshot;
  orderLines?: OrderLine[];
  postback?: Postback;
}

interface LoaderData {
  order: OrderDetail;
  error?: string;
}

// ========================================
// LOADER
// ========================================
export const loader = async ({
  request,
  context,
  params,
}: LoaderFunctionArgs) => {
  const user = await requireUser({ context });
  if (!user || !user.level || user.level < 3) {
    throw new Response("Acces refuse", { status: 403 });
  }

  const orderId = params.orderId;
  if (!orderId) {
    throw new Response("ID commande manquant", { status: 400 });
  }

  try {
    const cookie = request.headers.get("Cookie") || "";
    const res = await fetch(
      `http://127.0.0.1:3000/api/legacy-orders/${orderId}`,
      {
        headers: { Cookie: cookie },
      },
    );

    if (!res.ok) {
      throw new Response("Commande introuvable", { status: 404 });
    }

    const result = await res.json();
    if (!result.success || !result.data) {
      throw new Response("Commande introuvable", { status: 404 });
    }

    return json<LoaderData>({ order: result.data });
  } catch (error) {
    if (error instanceof Response) throw error;
    logger.error("Erreur chargement commande:", error);
    throw new Response("Erreur serveur", { status: 500 });
  }
};

// ========================================
// ACTION
// ========================================
export const action = async ({
  request,
  context,
  params,
}: ActionFunctionArgs) => {
  const user = await requireUser({ context });
  if (!user || !user.level || user.level < 3) {
    return json({ error: "Acces refuse" }, { status: 403 });
  }

  const orderId = params.orderId;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const cookie = request.headers.get("Cookie") || "";

  try {
    let apiUrl = "";
    let method = "POST";
    let body: string | undefined;

    switch (intent) {
      case "markPaid":
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/confirm-payment`;
        break;
      case "ship":
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/ship`;
        body = JSON.stringify({
          trackingNumber: formData.get("trackingNumber"),
        });
        break;
      case "cancel":
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/cancel`;
        body = JSON.stringify({ reason: formData.get("reason") });
        break;
      case "deliver":
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/deliver`;
        break;
      case "updateStatus":
        apiUrl = `http://127.0.0.1:3000/api/orders/admin/${orderId}/status`;
        method = "PATCH";
        body = JSON.stringify({ statusId: formData.get("statusId") });
        break;
      default:
        return json({ error: "Action inconnue" }, { status: 400 });
    }

    const headers: Record<string, string> = { Cookie: cookie };
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(apiUrl, { method, headers, body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erreur" }));
      return json({ error: err.message || "Erreur" }, { status: 500 });
    }

    return json({ success: true, message: `Action "${intent}" executee` });
  } catch (error) {
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
};

// ========================================
// HELPERS
// ========================================
function AddressBlock({
  addr,
  title,
}: {
  addr?: AddressSnapshot;
  title: string;
}) {
  if (!addr) return null;
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ");
  const line2 = [addr.zipCode, addr.city].filter(Boolean).join(" ");

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        {title}
      </h4>
      <div className="space-y-1 text-sm">
        {name && <p className="font-medium">{name}</p>}
        {addr.address && <p>{addr.address}</p>}
        {addr.addressLine2 && <p>{addr.addressLine2}</p>}
        {line2 && <p>{line2}</p>}
        {addr.country && <p>{addr.country}</p>}
        {addr.phone && (
          <p className="flex items-center gap-1.5 text-muted-foreground mt-2">
            <Phone className="w-3.5 h-3.5" />
            {addr.phone}
          </p>
        )}
      </div>
    </div>
  );
}

// ========================================
// PAGE COMPONENT
// ========================================
export default function OrderDetailPage() {
  const { order } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<{
    success?: boolean;
    message?: string;
    error?: string;
  }>();
  const [trackingInput, setTrackingInput] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showShipForm, setShowShipForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);

  const isSubmitting = fetcher.state !== "idle";
  const customer = order.customer;
  const customerName = customer
    ? `${customer.cst_fname || ""} ${customer.cst_name || ""}`.trim() ||
      "Client inconnu"
    : "Client inconnu";
  const postback = order.postback;
  const isPaid = order.ord_is_pay === "1";
  const isCancelled = order.ord_ords_id === "2";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copie dans le presse-papier");
  };

  const handleAction = (intent: string, extraData?: Record<string, string>) => {
    const data: Record<string, string> = { intent, ...extraData };
    fetcher.submit(data, { method: "post" });
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back + Header */}
        <div className="mb-6">
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux commandes
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {order.ord_id}
                </h1>
                <button
                  onClick={() => handleCopy(order.ord_id)}
                  className="p-1 rounded hover:bg-muted"
                  title="Copier l'ID"
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateTime(order.ord_date)}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusBadgeColor(order.ord_ords_id)}>
                {getStatusLabel(order.ord_ords_id)}
              </Badge>
              <Badge className={getPaymentBadgeColor(order.ord_is_pay)}>
                {getPaymentLabel(order.ord_is_pay)}
              </Badge>
              {postback?.status === "completed" && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  Paybox OK
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Fetcher feedback */}
        {fetcher.data?.error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {fetcher.data.error}
          </div>
        )}
        {fetcher.data?.success && (
          <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
            {fetcher.data.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* --- LEFT COLUMN (2/3) --- */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lignes de commande */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="w-5 h-5" />
                  Produits commandes ({order.orderLines?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.orderLines && order.orderLines.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Produit</th>
                          <th className="pb-2 pr-4 font-medium">Ref</th>
                          <th className="pb-2 pr-4 font-medium">Marque</th>
                          <th className="pb-2 pr-4 text-center font-medium">
                            Qte
                          </th>
                          <th className="pb-2 pr-4 text-right font-medium">
                            Prix unit.
                          </th>
                          <th className="pb-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.orderLines.map((line) => (
                          <tr
                            key={line.orl_id}
                            className="border-b last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="font-medium">
                                {line.orl_pg_name || "—"}
                              </div>
                              {line.orl_website_url && (
                                <a
                                  href={line.orl_website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  Voir le produit{" "}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {line.orl_art_ref || "—"}
                              </code>
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {line.orl_pm_name || "—"}
                            </td>
                            <td className="py-3 pr-4 text-center font-medium">
                              {line.orl_art_quantity || 1}
                            </td>
                            <td className="py-3 pr-4 text-right text-muted-foreground">
                              {formatPrice(line.orl_art_price_sell_unit_ttc)}
                            </td>
                            <td className="py-3 text-right font-semibold">
                              {formatPrice(line.orl_art_price_sell_ttc)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm py-4">
                    Aucune ligne de commande
                  </p>
                )}

                {/* Totaux */}
                <Separator className="my-4" />
                <div className="space-y-2 max-w-xs ml-auto">
                  {order.ord_amount_ttc && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Sous-total articles
                      </span>
                      <span>{formatPrice(order.ord_amount_ttc)}</span>
                    </div>
                  )}
                  {order.ord_deposit_ttc &&
                    parseFloat(order.ord_deposit_ttc) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-700">Consignes</span>
                        <span className="text-amber-700">
                          {formatPrice(order.ord_deposit_ttc)}
                        </span>
                      </div>
                    )}
                  {order.ord_shipping_fee_ttc &&
                    parseFloat(order.ord_shipping_fee_ttc) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Frais de port
                        </span>
                        <span>{formatPrice(order.ord_shipping_fee_ttc)}</span>
                      </div>
                    )}
                  {order.ord_tva && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVA</span>
                      <span>{formatPrice(order.ord_tva)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total TTC</span>
                    <span className="text-primary">
                      {formatPrice(order.ord_total_ttc)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adresses */}
            {(order.ord_billing_snapshot || order.ord_shipping_snapshot) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="w-5 h-5" />
                    Adresses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AddressBlock
                      addr={order.ord_billing_snapshot}
                      title="Facturation"
                    />
                    <AddressBlock
                      addr={order.ord_shipping_snapshot}
                      title="Livraison"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {order.ord_info && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {order.ord_info}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* --- RIGHT COLUMN (1/3) --- */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isPaid && (
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Marquer cette commande comme payee ?")) {
                        handleAction("markPaid");
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Marquer comme payee
                  </Button>
                )}

                {!showShipForm ? (
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setShowShipForm(true)}
                    disabled={isSubmitting || isCancelled}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Expedier
                  </Button>
                ) : (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    <input
                      type="text"
                      placeholder="Numero de suivi..."
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!trackingInput.trim()) {
                            toast.error("Numero de suivi requis");
                            return;
                          }
                          handleAction("ship", {
                            trackingNumber: trackingInput.trim(),
                          });
                          setShowShipForm(false);
                          setTrackingInput("");
                        }}
                        disabled={isSubmitting}
                      >
                        Confirmer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowShipForm(false);
                          setTrackingInput("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Marquer cette commande comme livree ?")) {
                      handleAction("deliver");
                    }
                  }}
                  disabled={isSubmitting || isCancelled}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marquer livree
                </Button>

                <Separator />

                {!showCancelForm ? (
                  <Button
                    className="w-full justify-start text-destructive hover:text-destructive"
                    variant="outline"
                    onClick={() => setShowCancelForm(true)}
                    disabled={isSubmitting || isCancelled}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Annuler la commande
                  </Button>
                ) : (
                  <div className="space-y-2 p-3 bg-destructive/5 rounded-lg">
                    <textarea
                      placeholder="Raison de l'annulation..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (!cancelReason.trim()) {
                            toast.error("Raison d'annulation requise");
                            return;
                          }
                          handleAction("cancel", {
                            reason: cancelReason.trim(),
                          });
                          setShowCancelForm(false);
                          setCancelReason("");
                        }}
                        disabled={isSubmitting}
                      >
                        Confirmer l'annulation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCancelForm(false);
                          setCancelReason("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-5 h-5" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{customerName}</p>
                  {customer?.cst_mail && (
                    <a
                      href={`mailto:${customer.cst_mail}`}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1.5 mt-1"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {customer.cst_mail}
                    </a>
                  )}
                  {(customer?.cst_tel || customer?.cst_gsm) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Phone className="w-3.5 h-3.5" />
                      {customer.cst_tel || customer.cst_gsm}
                    </p>
                  )}
                </div>
                {customer?.cst_address && (
                  <div className="text-sm text-muted-foreground">
                    <p>{customer.cst_address}</p>
                    <p>
                      {customer.cst_zip_code} {customer.cst_city}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Paiement Paybox */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="w-5 h-5" />
                  Paiement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={getPaymentBadgeColor(order.ord_is_pay)}>
                    {getPaymentLabel(order.ord_is_pay)}
                  </Badge>
                </div>

                {order.ord_date_pay && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date paiement</span>
                    <span>{formatDateTime(order.ord_date_pay)}</span>
                  </div>
                )}

                {postback && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Callback Paybox
                    </p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Statut gateway
                      </span>
                      <Badge
                        className={
                          postback.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {postback.status || "—"}
                      </Badge>
                    </div>
                    {postback.statuscode && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Code retour
                        </span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {postback.statuscode}
                        </code>
                      </div>
                    )}
                    {postback.transactionid && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          Transaction
                        </span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {postback.transactionid}
                          </code>
                          <button
                            onClick={() => handleCopy(postback.transactionid!)}
                            className="p-0.5 rounded hover:bg-muted"
                          >
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    )}
                    {postback.paymentmethod &&
                      (() => {
                        const pm = getPaymentMethodInfo(postback.paymentmethod);
                        return (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">
                              Methode
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${pm.color}`}
                            >
                              {pm.label}
                            </span>
                          </div>
                        );
                      })()}
                    {postback.amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Montant recu
                        </span>
                        <span className="font-medium">
                          {formatPrice(postback.amount)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {!postback && isPaid && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                    Paiement marque manuellement (pas de callback Paybox)
                  </p>
                )}

                {!postback && !isPaid && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                    Aucune trace de paiement gateway
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Expedition */}
            {(order.ord_tracking ||
              order.ord_date_ship ||
              order.ord_date_deliv) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Truck className="w-5 h-5" />
                    Expedition
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {order.ord_tracking && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">N de suivi</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {order.ord_tracking}
                        </code>
                        <button
                          onClick={() => handleCopy(order.ord_tracking!)}
                          className="p-0.5 rounded hover:bg-muted"
                        >
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                  {order.ord_tracking_url && (
                    <a
                      href={order.ord_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                    >
                      Suivre le colis <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {order.ord_date_ship && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Date expedition
                      </span>
                      <span>{formatDate(order.ord_date_ship)}</span>
                    </div>
                  )}
                  {order.ord_date_deliv && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Date livraison
                      </span>
                      <span>{formatDate(order.ord_date_deliv)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Annulation */}
            {isCancelled && order.ord_cancel_reason && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <XCircle className="w-5 h-5" />
                    Annulation
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-muted-foreground">
                    {order.ord_cancel_reason}
                  </p>
                  {order.ord_cancel_date && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDateTime(order.ord_cancel_date)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
