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
import { ArrowLeft, Clock } from "lucide-react";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
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

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.claim?.title
      ? `${data.claim.title} | Réclamation`
      : "Réclamation | AutoMecanik",
  },
  { name: "robots", content: "noindex, nofollow" },
];

interface TimelineEntry {
  id: string;
  action: string;
  description: string;
  performedBy: string;
  performedAt: string;
  visibility: string;
}

interface ClaimDetail {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  expectedResolution: string;
  orderId?: string;
  timeline: TimelineEntry[];
  resolution?: { type: string; description: string; amount?: number };
  satisfaction?: { rating: number; feedback?: string };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

type LoaderData = { claim: ClaimDetail; user: Record<string, unknown> };

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  open: { label: "Ouverte", variant: "destructive" },
  investigating: { label: "En cours d'investigation", variant: "default" },
  pending_customer: {
    label: "En attente de votre réponse",
    variant: "secondary",
  },
  pending_supplier: { label: "En attente fournisseur", variant: "secondary" },
  resolved: { label: "Résolue", variant: "outline" },
  closed: { label: "Clôturée", variant: "outline" },
  rejected: { label: "Rejetée", variant: "outline" },
};

const typeLabels: Record<string, string> = {
  defective_product: "Produit défectueux",
  wrong_product: "Mauvais produit",
  missing_product: "Produit manquant",
  delivery_issue: "Problème livraison",
  billing_issue: "Problème facturation",
  service_complaint: "Plainte service",
  other: "Autre",
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (!user) throw new Response("Non authentifié", { status: 401 });
  const claimId = params.claimId;
  if (!claimId) throw new Response("Réclamation introuvable", { status: 404 });

  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(`${baseUrl}/api/support/claims/${claimId}`, {
      headers: { Accept: "application/json", Cookie: cookie },
    });
    if (!res.ok) throw new Response("Réclamation introuvable", { status: 404 });

    const data = await res.json();
    const claim: ClaimDetail = {
      id: data.id || data.clm_id,
      type: data.type || data.clm_type || "other",
      status: data.status || data.clm_status || "open",
      priority: data.priority || data.clm_priority || "normal",
      title: data.title || data.clm_title || "",
      description: data.description || data.clm_description || "",
      expectedResolution:
        data.expectedResolution || data.clm_expected_resolution || "",
      orderId: data.orderId || data.clm_order_id || undefined,
      timeline: (data.timeline || data.clm_timeline || []).map(
        (t: Record<string, unknown>) => ({
          id: t.id,
          action: t.action,
          description: t.description,
          performedBy: t.performedBy,
          performedAt: t.performedAt,
          visibility: t.visibility,
        }),
      ),
      resolution: data.resolution || data.clm_resolution || undefined,
      satisfaction: data.satisfaction || data.clm_satisfaction || undefined,
      createdAt: data.createdAt || data.clm_created_at || "",
      updatedAt: data.updatedAt || data.clm_updated_at || "",
      resolvedAt: data.resolvedAt || data.clm_resolved_at || undefined,
    };
    return json<LoaderData>({ claim, user });
  } catch (error) {
    if (error instanceof Response) throw error;
    logger.error("Erreur chargement réclamation:", error);
    throw new Response("Erreur serveur", { status: 500 });
  }
}

export default function ClaimDetailPage() {
  const { claim, user } = useLoaderData<LoaderData>();
  const sc = statusConfig[claim.status] || statusConfig.open;

  return (
    <AccountLayout
      user={user}
      stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}
    >
      <div className="space-y-6">
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Réclamations", href: "/account/claims" },
            { label: claim.title },
          ]}
        />
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/account/claims">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{claim.title}</h1>
            <p className="text-sm text-gray-500">
              {typeLabels[claim.type] || claim.type}
              {claim.orderId && ` — Commande #${claim.orderId}`}
            </p>
          </div>
          <Badge variant={sc.variant} className="px-3 py-1">
            {sc.label}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 whitespace-pre-wrap">
              {claim.description}
            </p>
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                Résolution souhaitée
              </h4>
              <p className="text-gray-600">{claim.expectedResolution}</p>
            </div>
            <div className="flex gap-4 text-sm text-gray-500 border-t pt-4">
              <span>
                Créée le {new Date(claim.createdAt).toLocaleDateString("fr-FR")}
              </span>
              <span>
                Mise à jour le{" "}
                {new Date(claim.updatedAt).toLocaleDateString("fr-FR")}
              </span>
              <span className="capitalize">Priorité : {claim.priority}</span>
            </div>
          </CardContent>
        </Card>

        {claim.resolution && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700">Résolution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{claim.resolution.description}</p>
              {claim.resolution.amount && (
                <p className="mt-2 font-medium">
                  Montant : {claim.resolution.amount.toFixed(2)} EUR
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {claim.timeline.length > 0 ? (
              <div className="space-y-4">
                {claim.timeline
                  .filter((t) => t.visibility !== "internal")
                  .map((entry) => (
                    <div key={entry.id} className="flex gap-4">
                      <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          {entry.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(entry.performedAt).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Aucun historique disponible
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button asChild variant="outline">
            <Link to="/account/claims">Retour aux réclamations</Link>
          </Button>
        </div>
      </div>
    </AccountLayout>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error))
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  return <ErrorGeneric />;
}
