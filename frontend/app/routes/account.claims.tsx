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
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

export const meta: MetaFunction = () => [
  { title: "Mes réclamations | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface Claim {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
}

type LoaderData = { claims: Claim[]; user: Record<string, unknown> };

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  open: { label: "Ouverte", variant: "destructive" },
  investigating: { label: "En cours", variant: "default" },
  pending_customer: { label: "En attente client", variant: "secondary" },
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

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (!user) throw new Response("Non authentifié", { status: 401 });

  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const userId =
    (user as Record<string, unknown>).id ||
    (user as Record<string, unknown>).cst_id;

  try {
    const res = await fetch(
      `${baseUrl}/api/support/claims?customerId=${userId}`,
      { headers: { Accept: "application/json", Cookie: cookie } },
    );
    if (!res.ok) return json<LoaderData>({ claims: [], user });

    const data = await res.json();
    const claims = (Array.isArray(data) ? data : data.data || []).map(
      (c: Record<string, unknown>) => ({
        id: c.id || c.clm_id,
        type: c.type || c.clm_type || "other",
        status: c.status || c.clm_status || "open",
        priority: c.priority || c.clm_priority || "normal",
        title: c.title || c.clm_title || "",
        orderId: c.orderId || c.clm_order_id || undefined,
        createdAt: c.createdAt || c.clm_created_at || "",
        updatedAt: c.updatedAt || c.clm_updated_at || "",
      }),
    );
    return json<LoaderData>({ claims, user });
  } catch (error) {
    logger.error("Erreur chargement réclamations:", error);
    return json<LoaderData>({ claims: [], user });
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "open" || status === "investigating")
    return <Clock className="w-4 h-4" />;
  if (status === "resolved" || status === "closed")
    return <CheckCircle className="w-4 h-4" />;
  if (status === "rejected") return <XCircle className="w-4 h-4" />;
  return <Search className="w-4 h-4" />;
}

export default function AccountClaims() {
  const { claims, user } = useLoaderData<LoaderData>();
  const openCount = claims.filter(
    (c) => !["resolved", "closed", "rejected"].includes(c.status),
  ).length;

  return (
    <AccountLayout
      user={user}
      stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}
    >
      <div className="space-y-6">
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Réclamations" },
          ]}
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mes Réclamations
            </h1>
            <p className="text-gray-600">
              Suivez vos demandes de SAV et réclamations
            </p>
          </div>
          <Button asChild>
            <Link to="/account/claims/new">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle réclamation
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {claims.length}
              </p>
              <p className="text-sm text-gray-600">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{openCount}</p>
              <p className="text-sm text-gray-600">En cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {claims.length - openCount}
              </p>
              <p className="text-sm text-gray-600">Résolues</p>
            </CardContent>
          </Card>
        </div>

        {claims.length > 0 ? (
          <div className="space-y-3">
            {claims.map((claim) => {
              const sc = statusConfig[claim.status] || statusConfig.open;
              return (
                <Link key={claim.id} to={`/account/claims/${claim.id}`}>
                  <Card className="hover:border-blue-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <StatusIcon status={claim.status} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {claim.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {typeLabels[claim.type] || claim.type}
                              {claim.orderId && ` — Commande #${claim.orderId}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                          <span className="text-sm text-gray-400">
                            {new Date(claim.createdAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune réclamation
              </h3>
              <p className="text-gray-600 mb-4">
                Vous n&apos;avez pas encore de réclamation en cours
              </p>
              <Button asChild>
                <Link to="/account/claims/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une réclamation
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button asChild variant="outline">
            <Link to="/account/dashboard">Retour au dashboard</Link>
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
