/**
 * Route publique de reprise de paiement.
 * Compatible guest — utilise un token aléatoire stocké en DB.
 *
 * GET /checkout/resume?token=xxx          → relance le paiement
 * GET /checkout/resume?token=xxx&check=1  → vérifie l'état (read-only, ne consomme PAS le token)
 */

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { CheckCircle, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { buildPayboxRedirectUrl } from "~/services/order.server";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "Reprise de paiement | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const isCheck = url.searchParams.get("check") === "1";

  if (!token) {
    throw new Response("Token manquant", { status: 400 });
  }

  const API_BASE = getInternalApiUrl("");

  try {
    // Vérifier le token via une API interne qui lit order_resume_tokens
    const tokenRes = await fetch(
      `${API_BASE}/api/orders/resume-token/${encodeURIComponent(token)}`,
      { headers: { "internal-call": "true" } },
    );

    if (!tokenRes.ok) {
      const status = tokenRes.status;
      if (status === 404) throw new Response("Token invalide", { status: 404 });
      if (status === 410)
        throw new Response("Token expiré ou déjà utilisé", { status: 410 });
      throw new Response("Erreur serveur", { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const { orderId, orderStatus, isPaid, totalTTC, customerEmail } = tokenData;

    // Mode check : afficher l'état sans consommer le token
    if (isCheck) {
      return json({
        mode: "check" as const,
        orderId,
        isPaid: isPaid === "1" || isPaid === true,
        orderStatus,
      });
    }

    // Si déjà payé, afficher la confirmation
    if (isPaid === "1" || isPaid === true) {
      return json({
        mode: "already_paid" as const,
        orderId,
        isPaid: true,
        orderStatus,
      });
    }

    // Rediriger vers Paybox (le token sera marqué used_at par le backend)
    const redirectUrl = buildPayboxRedirectUrl(
      orderId,
      totalTTC,
      customerEmail,
    );
    return redirect(redirectUrl);
  } catch (error) {
    if (error instanceof Response) throw error;
    logger.error("[Resume] Error:", error);
    throw new Response("Erreur lors de la reprise de paiement", {
      status: 500,
    });
  }
}

export default function CheckoutResume() {
  const data = useLoaderData<typeof loader>();

  if (data.mode === "already_paid") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
            <CardTitle>Commande déjà payée</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              La commande <strong>{data.orderId}</strong> a déjà été réglée.
            </p>
            <Link to="/">
              <Button className="w-full">Retour à l&apos;accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.mode === "check") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {data.isPaid ? (
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
            ) : (
              <AlertTriangle className="mx-auto h-12 w-12 text-orange-500 mb-2" />
            )}
            <CardTitle>
              {data.isPaid ? "Paiement confirmé" : "En attente de paiement"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Commande <strong>{data.orderId}</strong> —{" "}
              {data.isPaid
                ? "Le paiement a été reçu."
                : "Le paiement n'a pas encore été confirmé."}
            </p>
            <div className="flex gap-3">
              <Link to="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  Accueil
                </Button>
              </Link>
              {!data.isPaid && (
                <Link
                  to={`/checkout/resume?token=${new URL(typeof window !== "undefined" ? window.location.href : "http://x").searchParams.get("token")}`}
                  className="flex-1"
                >
                  <Button className="w-full">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Reprendre le paiement
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
