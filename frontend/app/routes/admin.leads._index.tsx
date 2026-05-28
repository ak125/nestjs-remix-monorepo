/**
 * Mini-CRM V0 — Surface admin /admin/leads (liste).
 *
 * Lit /api/admin/leads (NestJS, IsAdminGuard). Transitions de statut
 * inline via boutons rapides (LEAD_TRANSITIONS).
 */

import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  Form,
  useNavigation,
  useSearchParams,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "@remix-run/react";
import { Bell, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import {
  LEAD_TRANSITIONS,
  isValidLeadTransition,
  type LeadStatus,
} from "@repo/database-types";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export const meta: MetaFunction = () => [
  { title: "Leads CRM | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface Lead {
  msg_id: string;
  msg_date: string;
  msg_subject: string;
  msg_crm_status: LeadStatus;
  msg_crm_source_page: string | null;
  msg_crm_vehicle_info: string | null;
  msg_crm_next_follow_up_at: string | null;
  msg_crm_updated_at: string | null;
  customer?: {
    cst_name: string | null;
    cst_fname: string | null;
    cst_mail: string | null;
  } | null;
}

type LoaderData = {
  rows: Lead[];
  total: number;
  page: number;
  page_size: number;
  filter_status: string;
  filter_follow_up: string;
};

const STATUS_LABEL: Record<
  LeadStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  new: { label: "Nouveau", variant: "default" },
  contacted: { label: "Contacté", variant: "secondary" },
  quoted: { label: "Devisé", variant: "secondary" },
  won: { label: "Gagné", variant: "outline" },
  lost: { label: "Perdu", variant: "destructive" },
};

function customerDisplay(c: Lead["customer"]): string {
  if (!c) return "—";
  const name = [c.cst_fname, c.cst_name].filter(Boolean).join(" ").trim();
  return name || c.cst_mail || "—";
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

  const status = url.searchParams.get("status") || "";
  const followUp = url.searchParams.get("follow_up") || "";
  const page = url.searchParams.get("page") || "1";

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (followUp && followUp !== "any") params.set("follow_up", followUp);
  params.set("page", page);
  params.set("page_size", "50");

  try {
    const res = await fetch(`${baseUrl}/api/admin/leads?${params}`, {
      headers: { Accept: "application/json", Cookie: cookie },
    });

    if (res.status === 401 || res.status === 403) {
      throw json(
        { error: "Authentification admin requise" },
        { status: res.status },
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("admin.leads loader failed", { status: res.status, errText });
      throw json(
        { error: `API leads failed: ${res.status}` },
        { status: 502 },
      );
    }

    const body = (await res.json()) as {
      rows: Lead[];
      total: number;
      page: number;
      page_size: number;
    };

    return json<LoaderData>({
      rows: body.rows,
      total: body.total,
      page: body.page,
      page_size: body.page_size,
      filter_status: status,
      filter_follow_up: followUp || "any",
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    logger.error("admin.leads loader exception", { err });
    throw json({ error: "API leads unreachable" }, { status: 502 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const formData = await request.formData();

  const leadId = String(formData.get("lead_id") || "");
  const nextStatus = String(formData.get("next_status") || "") as LeadStatus;
  const intent = String(formData.get("intent") || "");

  if (!leadId || intent !== "transition") {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  const res = await fetch(`${baseUrl}/api/admin/leads/${leadId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ status: nextStatus }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: "Unknown error" }));
    return json(
      { error: errBody.message || `Transition failed: ${res.status}` },
      { status: res.status },
    );
  }

  // Préserve les filtres en cours
  const url = new URL(request.url);
  return redirect(`/admin/leads?${url.searchParams.toString()}`);
}

export default function AdminLeadsIndex() {
  const data = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  function onFilterChange(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Leads CRM
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.total} lead{data.total > 1 ? "s" : ""} — page {data.page} /{" "}
            {totalPages}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm">
            Statut :
            <select
              className="ml-2 border rounded px-2 py-1 text-sm"
              value={data.filter_status}
              onChange={(e) => onFilterChange("status", e.target.value)}
            >
              <option value="">Tous</option>
              <option value="new">Nouveau</option>
              <option value="contacted">Contacté</option>
              <option value="quoted">Devisé</option>
              <option value="won">Gagné</option>
              <option value="lost">Perdu</option>
            </select>
          </label>
          <label className="text-sm">
            Relance :
            <select
              className="ml-2 border rounded px-2 py-1 text-sm"
              value={data.filter_follow_up}
              onChange={(e) => onFilterChange("follow_up", e.target.value)}
            >
              <option value="any">Toutes</option>
              <option value="due">À relancer maintenant</option>
              <option value="overdue">En retard (24h+)</option>
            </select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Sujet</th>
                  <th className="px-4 py-3 font-medium">Véhicule</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Relance</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((lead) => {
                  const followUpDate = lead.msg_crm_next_follow_up_at;
                  const followUpLabel = followUpDate
                    ? new Date(followUpDate).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—";
                  const followUpOverdue = isOverdue(followUpDate);
                  const statusInfo = STATUS_LABEL[lead.msg_crm_status];
                  const allowedTransitions = LEAD_TRANSITIONS[lead.msg_crm_status];

                  return (
                    <tr
                      key={lead.msg_id}
                      className="border-t hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(lead.msg_date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {customerDisplay(lead.customer)}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <Link
                          to={`/admin/leads/${lead.msg_id}`}
                          className="text-primary hover:underline line-clamp-1"
                        >
                          {lead.msg_subject}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="line-clamp-1">
                          {lead.msg_crm_vehicle_info || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {followUpDate ? (
                          <Badge
                            variant={
                              followUpOverdue ? "destructive" : "secondary"
                            }
                          >
                            {followUpLabel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {(["contacted", "quoted", "won", "lost"] as const).map(
                            (target) => {
                              if (
                                !isValidLeadTransition(
                                  lead.msg_crm_status,
                                  target,
                                ) ||
                                target === lead.msg_crm_status
                              ) {
                                return null;
                              }
                              if (!allowedTransitions.includes(target))
                                return null;
                              return (
                                <Form
                                  method="post"
                                  key={`${lead.msg_id}-${target}`}
                                  className="inline"
                                >
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="transition"
                                  />
                                  <input
                                    type="hidden"
                                    name="lead_id"
                                    value={lead.msg_id}
                                  />
                                  <input
                                    type="hidden"
                                    name="next_status"
                                    value={target}
                                  />
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                  >
                                    → {STATUS_LABEL[target].label}
                                  </Button>
                                </Form>
                              );
                            },
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Aucun lead trouvé avec ces filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={data.page <= 1}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("page", String(data.page - 1));
            setSearchParams(next);
          }}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {data.page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={data.page >= totalPages}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("page", String(data.page + 1));
            setSearchParams(next);
          }}
        >
          Suivant <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorGeneric
        title={`Erreur ${error.status}`}
        message={
          typeof error.data === "object" && error.data && "error" in error.data
            ? String((error.data as { error: unknown }).error)
            : "Impossible de charger la liste des leads."
        }
      />
    );
  }
  return (
    <ErrorGeneric
      title="Erreur"
      message="Une erreur inattendue est survenue."
    />
  );
}
