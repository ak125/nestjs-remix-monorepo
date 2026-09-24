import {
  ArrowLeft,
  Package,
  MapPin,
  CreditCard,
  FileText,
  Truck,
} from "lucide-react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  Link,
  Form,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Alert } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import {
  getLineStatusLabel,
  getStatusBadgeColor,
  getStatusLabel,
} from "~/utils/orders.utils";
import { getProxyHeaders } from "~/utils/proxy-headers.server";
import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { getOrderDetails } from "../services/orders.server";

export const meta: MetaFunction<typeof loader> = ({ loaderData: data }) =>
  createNoIndexMeta(
    data?.order?.orderNumber
      ? `Commande #${data.order.orderNumber}`
      : "Commande",
  );

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  // Authentification requise
  const user = await requireAuth(request);
  const orderId = params.orderId;

  if (!orderId) {
    throw new Response("Commande introuvable", { status: 404 });
  }

  // Récupérer l'ID utilisateur (gérer la structure legacy cst_*)
  const userId = user?.id || (user as any)?.cst_id;
  if (!userId) {
    throw new Response("Utilisateur non identifié", { status: 401 });
  }

  try {
    const order = await getOrderDetails({
      orderId,
      userId,
      request,
    });

    if (!order) {
      throw new Response("Commande introuvable", { status: 404 });
    }

    return { order, user };
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("Erreur lors du chargement du détail de commande:", error);
    throw new Response("Erreur lors du chargement de la commande", {
      status: 500,
    });
  }
}

const CANCEL_FAILED_MESSAGE =
  "L'annulation n'a pas pu aboutir. Réessayez ou contactez notre service client.";

/**
 * Annulation par le client. Le backend (DELETE /api/orders/:id) vérifie le
 * propriétaire, refuse une commande payée ou plus annulable (409) et passe
 * par l'autorité unique cancel_order_atomic.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireAuth(request);
  const orderId = params.orderId;
  if (!orderId) {
    return data({ error: "Commande introuvable." }, { status: 404 });
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "cancel") {
    return data({ error: "Action inconnue." }, { status: 400 });
  }

  try {
    const res = await fetch(
      getInternalApiUrlFromRequest(
        `/api/orders/${encodeURIComponent(orderId)}`,
        request,
      ),
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Cookie: request.headers.get("Cookie") || "",
          ...getProxyHeaders(request),
        },
      },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      // 409 = refus métier (payée, déjà annulée) : message backend destiné au client
      const message =
        res.status === 409 && typeof errorData.message === "string"
          ? errorData.message
          : CANCEL_FAILED_MESSAGE;
      return data({ error: message }, { status: res.status });
    }

    return { success: true as const };
  } catch (error) {
    logger.error("Erreur lors de l'annulation de la commande:", error);
    return data({ error: CANCEL_FAILED_MESSAGE }, { status: 500 });
  }
}

export default function OrderDetailPage() {
  const { order, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isCancelling =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "cancel";
  const cancelError =
    actionData && "error" in actionData ? actionData.error : null;
  const cancelled = actionData && "success" in actionData;

  return (
    <AccountLayout user={user}>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Mes Commandes", href: "/account/orders" },
            { label: `Commande #${order.orderNumber}` },
          ]}
        />

        {/* Header avec bouton retour */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                Commande #{order.orderNumber}
              </h1>
              <p className="text-muted-foreground">
                Passée le{" "}
                {new Date(order.createdAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pas de <Badge> : sa variante par défaut (bg-primary) écrase les
                couleurs de statut, faute de fusion des classes. */}
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${getStatusBadgeColor(String(order.status))}`}
            >
              {getStatusLabel(String(order.status))}
            </span>
          </div>
        </div>

        {cancelled && (
          <Alert variant="success" title="Commande annulée">
            Votre commande a bien été annulée.
          </Alert>
        )}

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-3">
          {order.trackingNumber && (
            <Button asChild variant="outline">
              <a
                href={
                  order.trackingUrl ||
                  `https://www.laposte.fr/outils/suivre-vos-envois?code=${order.trackingNumber}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <Truck className="h-4 w-4" />
                Suivre le colis ({order.trackingNumber})
              </a>
            </Button>
          )}

          {/* Afficher le lien facture/bon de commande pour toutes les commandes */}
          <Button asChild variant="outline">
            <Link to={`/account/orders/${order.id}/invoice`} className="gap-2">
              <FileText className="h-4 w-4" />
              {order.isPaid ? "Voir la facture" : "Voir le bon de commande"}
            </Link>
          </Button>
        </div>

        {/* Timeline de statut */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Suivi de commande
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.statusHistory.map((status: any, index: number) => (
                  <div
                    key={index}
                    className={`flex items-start gap-4 ${status.isActive ? "" : "opacity-50"}`}
                  >
                    <div
                      className={`mt-2 h-3 w-3 rounded-full ${status.isActive ? "bg-primary" : "bg-muted"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{status.label}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(status.date).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Articles commandés */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Articles commandés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.lines?.map((line: any) => (
                    <div
                      key={line.id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      {line.productImage && (
                        <img
                          src={line.productImage}
                          alt={line.productName}
                          className="h-16 w-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{line.productName}</h4>
                        {line.productRef && (
                          <p className="text-sm text-muted-foreground">
                            Réf: {line.productRef}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm">Qté: {line.quantity}</span>
                          <span className="text-sm">
                            {formatPrice(line.unitPrice)} / unité
                          </span>
                          <LineStatusBadge status={line.status} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatPrice(
                            line.totalPrice || line.unitPrice * line.quantity,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Récapitulatif des totaux */}
                <div className="mt-6 border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total HT</span>
                    <span>
                      {formatPrice(
                        order.subtotalHT || order.subtotalPrice || 0,
                      )}
                    </span>
                  </div>
                  {order.tva && (
                    <div className="flex justify-between text-sm">
                      <span>TVA</span>
                      <span>{formatPrice(order.tva)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Frais de port</span>
                    <span>
                      {formatPrice(
                        order.shippingFee || order.deliveryPrice || 0,
                      )}
                    </span>
                  </div>
                  {order.discountAmount && order.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Remise</span>
                      <span>-{formatPrice(order.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-lg border-t pt-2">
                    <span>Total TTC</span>
                    <span>
                      {formatPrice(order.totalTTC || order.totalPrice || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Informations annexes */}
          <div className="space-y-6">
            {/* Adresse de livraison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Livraison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-sm space-y-1">
                  {(order.shippingAddress || order.deliveryAddress) && (
                    <>
                      <div>
                        {order.shippingAddress?.firstName ||
                          order.deliveryAddress?.firstName}{" "}
                        {order.shippingAddress?.lastName ||
                          order.deliveryAddress?.lastName}
                      </div>
                      {(order.shippingAddress?.company ||
                        order.deliveryAddress?.company) && (
                        <div className="text-muted-foreground">
                          {order.shippingAddress?.company ||
                            order.deliveryAddress?.company}
                        </div>
                      )}
                      <div>
                        {order.shippingAddress?.address1 ||
                          order.deliveryAddress?.street}
                      </div>
                      {(order.shippingAddress?.address2 ||
                        order.deliveryAddress?.additionalInfo) && (
                        <div>
                          {order.shippingAddress?.address2 ||
                            order.deliveryAddress?.additionalInfo}
                        </div>
                      )}
                      <div>
                        {order.shippingAddress?.postalCode ||
                          order.deliveryAddress?.postalCode}{" "}
                        {order.shippingAddress?.city ||
                          order.deliveryAddress?.city}
                      </div>
                      <div>
                        {order.shippingAddress?.country ||
                          order.deliveryAddress?.country}
                      </div>
                    </>
                  )}
                </address>

                {order.deliveryMethod && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium">Mode de livraison</p>
                    <p className="text-sm text-muted-foreground">
                      {order.deliveryMethod}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Informations de paiement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Paiement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.paymentMethod && (
                  <div>
                    <p className="text-sm font-medium">Méthode</p>
                    <p className="text-sm text-muted-foreground">
                      {order.paymentMethod}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium">Statut</p>
                  <Badge
                    variant={getPaymentStatusVariant(
                      order.paymentStatus || "pending",
                    )}
                  >
                    {order.paymentStatus || "En attente"}
                  </Badge>
                </div>

                {order.transactionId && (
                  <div>
                    <p className="text-sm font-medium">Transaction</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {order.transactionId}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Annulation : autorisée par le backend (commande non payée) */}
            {order.canCancel && (
              <Card>
                <CardHeader>
                  <CardTitle>Annuler la commande</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez annuler cette commande tant qu'elle n'est pas
                    payée.
                  </p>
                  {cancelError && (
                    <p role="alert" className="text-sm text-red-600">
                      {cancelError}
                    </p>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Annuler la commande</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Annuler la commande #{order.orderNumber} ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          L'annulation est définitive : la commande ne pourra
                          plus être payée ni reprise.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {cancelError && (
                        <p role="alert" className="text-sm text-red-600">
                          {cancelError}
                        </p>
                      )}
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancelling}>
                          Garder ma commande
                        </AlertDialogCancel>
                        <Form method="post">
                          <input type="hidden" name="intent" value="cancel" />
                          <Button
                            type="submit"
                            variant="destructive"
                            disabled={isCancelling}
                            className="w-full"
                          >
                            {isCancelling
                              ? "Annulation en cours…"
                              : "Oui, annuler la commande"}
                          </Button>
                        </Form>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}

// Fonctions utilitaires

/** Statut propre à la ligne ; aucun badge si le code est absent ou inconnu. */
function LineStatusBadge({ status }: { status?: string | null }) {
  const label = getLineStatusLabel(status);
  return label ? <Badge variant="outline">{label}</Badge> : null;
}

function getPaymentStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid" || status === "Payé") return "default";
  if (status === "pending" || status === "En attente") return "secondary";
  if (status === "failed" || status === "Échec") return "destructive";
  return "outline";
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
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
