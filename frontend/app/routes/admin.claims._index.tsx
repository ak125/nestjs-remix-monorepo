import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
  useSearchParams,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { AlertTriangle, CheckCircle, UserCheck, Filter } from "lucide-react";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export const meta: MetaFunction = () => [
  { title: "SAV - Réclamations | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface Claim {
  id: string;
  customerName: string;
  customerEmail: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  orderId?: string;
  assignedTo?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  open: number;
  resolved: number;
  averageResolutionTime: number;
  satisfactionRating: number;
}

type LoaderData = { claims: Claim[]; stats: Stats };
type ActionData = { success?: boolean; error?: string };

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  open: { label: "Ouverte", variant: "destructive" },
  investigating: { label: "Investigation", variant: "default" },
  pending_customer: { label: "Attente client", variant: "secondary" },
  pending_supplier: { label: "Attente fournisseur", variant: "secondary" },
  resolved: { label: "Résolue", variant: "outline" },
  closed: { label: "Clôturée", variant: "outline" },
  rejected: { label: "Rejetée", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Faible", className: "text-gray-500" },
  normal: { label: "Normal", className: "text-blue-600" },
  high: { label: "Haute", className: "text-orange-600 font-medium" },
  urgent: { label: "Urgente", className: "text-red-600 font-bold" },
};

const typeLabels: Record<string, string> = {
  defective_product: "Produit défectueux",
  wrong_product: "Mauvais produit",
  missing_product: "Produit manquant",
  delivery_issue: "Livraison",
  billing_issue: "Facturation",
  service_complaint: "Service",
  other: "Autre",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  try {
    const params = new URLSearchParams();
    if (status) params.set("status", status);

    const [claimsRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/api/support/claims?${params}`, {
        headers: { Accept: "application/json", Cookie: cookie },
      }),
      fetch(`${baseUrl}/api/support/claims/stats`, {
        headers: { Accept: "application/json", Cookie: cookie },
      }),
    ]);

    const claimsData = claimsRes.ok ? await claimsRes.json() : [];
    const statsData = statsRes.ok
      ? await statsRes.json()
      : {
          total: 0,
          open: 0,
          resolved: 0,
          averageResolutionTime: 0,
          satisfactionRating: 0,
        };

    const claims = (
      Array.isArray(claimsData) ? claimsData : claimsData.data || []
    ).map((c: Record<string, unknown>) => ({
      id: c.id || c.clm_id,
      customerName: c.customerName || c.clm_customer_name || "",
      customerEmail: c.customerEmail || c.clm_customer_email || "",
      type: c.type || c.clm_type || "other",
      status: c.status || c.clm_status || "open",
      priority: c.priority || c.clm_priority || "normal",
      title: c.title || c.clm_title || "",
      orderId: c.orderId || c.clm_order_id || undefined,
      assignedTo: c.assignedTo || c.clm_assigned_to || undefined,
      createdAt: c.createdAt || c.clm_created_at || "",
    }));
    return json<LoaderData>({ claims, stats: statsData });
  } catch (error) {
    logger.error("Erreur chargement claims admin:", error);
    return json<LoaderData>({
      claims: [],
      stats: {
        total: 0,
        open: 0,
        resolved: 0,
        averageResolutionTime: 0,
        satisfactionRating: 0,
      },
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const claimId = formData.get("claimId") as string;

  try {
    const res = await fetch(`${baseUrl}/api/support/claims/${claimId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(
        intent === "updateStatus"
          ? { status: formData.get("newStatus") }
          : { assignedTo: formData.get("staffId"), status: "investigating" },
      ),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json<ActionData>(
        { error: err.message || `Erreur ${res.status}` },
        { status: res.status },
      );
    }
    return json<ActionData>({ success: true });
  } catch (error) {
    logger.error("Erreur action claim admin:", error);
    return json<ActionData>({ error: "Erreur serveur" }, { status: 500 });
  }
}

export default function AdminClaims() {
  const { claims, stats } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "";

  const statusFilters = [
    { value: "", label: "Toutes" },
    { value: "open", label: "Ouvertes" },
    { value: "investigating", label: "Investigation" },
    { value: "resolved", label: "Résolues" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SAV — Réclamations</h1>
        <p className="text-gray-600">Gestion des réclamations client</p>
      </div>

      {actionData?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          Action effectuée
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-gray-600">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.open}</p>
            <p className="text-sm text-gray-600">Ouvertes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {stats.resolved}
            </p>
            <p className="text-sm text-gray-600">Résolues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {stats.averageResolutionTime.toFixed(0)}h
            </p>
            <p className="text-sm text-gray-600">Temps moyen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {stats.satisfactionRating > 0
                ? `${stats.satisfactionRating.toFixed(1)}/5`
                : "—"}
            </p>
            <p className="text-sm text-gray-600">Satisfaction</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        {statusFilters.map((f) => (
          <Form key={f.value} method="get">
            {f.value && <input type="hidden" name="status" value={f.value} />}
            <Button
              type="submit"
              variant={currentStatus === f.value ? "default" : "outline"}
              size="sm"
            >
              {f.label}
            </Button>
          </Form>
        ))}
      </div>

      {claims.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Réclamation
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Client
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Statut
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Priorité
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.map((claim) => {
                const sc = statusConfig[claim.status] || statusConfig.open;
                const pc =
                  priorityConfig[claim.priority] || priorityConfig.normal;
                return (
                  <tr key={claim.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-xs">
                        {claim.title}
                      </p>
                      {claim.orderId && (
                        <p className="text-xs text-gray-500">
                          Cmd #{claim.orderId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{claim.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {claim.customerEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {typeLabels[claim.type] || claim.type}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={pc.className}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(claim.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {claim.status === "open" && (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="updateStatus"
                            />
                            <input
                              type="hidden"
                              name="claimId"
                              value={claim.id}
                            />
                            <input
                              type="hidden"
                              name="newStatus"
                              value="investigating"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              title="Prendre en charge"
                              disabled={navigation.state === "submitting"}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </Button>
                          </Form>
                        )}
                        {(claim.status === "investigating" ||
                          claim.status === "pending_supplier") && (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="updateStatus"
                            />
                            <input
                              type="hidden"
                              name="claimId"
                              value={claim.id}
                            />
                            <input
                              type="hidden"
                              name="newStatus"
                              value="resolved"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              title="Résoudre"
                              disabled={navigation.state === "submitting"}
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                            </Button>
                          </Form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune réclamation
            </h3>
            <p className="text-gray-600">
              {currentStatus ? "Aucune avec ce filtre" : "Aucune enregistrée"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error))
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  return <ErrorGeneric />;
}
