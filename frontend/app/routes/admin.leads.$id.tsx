/**
 * Mini-CRM V0 — Surface admin /admin/leads/:id (détail + édition).
 *
 * Lit /api/admin/leads/:id, écrit via PATCH /api/admin/leads/:id et
 * PATCH /api/admin/leads/:id/status. Une seule action() gère 2 intents
 * (fields | status) déclenchés par des Form séparés.
 */

import {
  LEAD_TRANSITIONS,
  LEAD_STATUSES,
  type LeadStatus,
} from "@repo/database-types";
import { ArrowLeft, Save } from "lucide-react";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "react-router";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

export const meta: MetaFunction = () => [
  { title: "Lead — Détail | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

interface LeadDetail {
  msg_id: string;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_open: "0" | "1";
  msg_close: "0" | "1";
  msg_cnfa_id: string | null;
  msg_crm_status: LeadStatus;
  msg_crm_source_page: string | null;
  msg_crm_vehicle_info: string | null;
  msg_crm_part_requested: string | null;
  msg_crm_next_follow_up_at: string | null;
  msg_crm_internal_note: string | null;
  msg_crm_updated_at: string | null;
  customer?: {
    cst_name: string | null;
    cst_fname: string | null;
    cst_mail: string | null;
    cst_phone: string | null;
  } | null;
}

type LoaderData = { lead: LeadDetail };
type ActionData = { success?: boolean; error?: string };

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  quoted: "Devisé",
  won: "Gagné",
  lost: "Perdu",
};

/**
 * Convertit ISO (TZ-aware) → format datetime-local (sans TZ) pour <input>.
 * Si null, renvoie chaîne vide.
 */
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const id = params.id;

  if (!id) throw data({ error: "Lead id manquant" }, { status: 400 });

  try {
    const res = await fetch(`${baseUrl}/api/admin/leads/${id}`, {
      headers: { Accept: "application/json", Cookie: cookie },
    });

    if (res.status === 401 || res.status === 403) {
      throw data(
        { error: "Authentification admin requise" },
        { status: res.status },
      );
    }
    if (res.status === 404) {
      throw data(
        { error: "Lead introuvable ou non-trackable" },
        { status: 404 },
      );
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("admin.leads.$id loader failed", {
        status: res.status,
        errText,
      });
      throw data({ error: `API leads failed: ${res.status}` }, { status: 502 });
    }

    const lead = (await res.json()) as LeadDetail;
    return { lead };
  } catch (err) {
    if (err instanceof Response) throw err;
    logger.error("admin.leads.$id loader exception", { err });
    throw data({ error: "API leads unreachable" }, { status: 502 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const id = params.id;
  if (!id) return data({ error: "Lead id manquant" }, { status: 400 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "status") {
    const nextStatus = String(formData.get("status") || "") as LeadStatus;
    if (!LEAD_STATUSES.includes(nextStatus)) {
      return data({ error: "Status invalide" }, { status: 400 });
    }
    const res = await fetch(`${baseUrl}/api/admin/leads/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const errBody = await res
        .json()
        .catch(() => ({ message: "Transition échouée" }));
      return data(
        { error: errBody.message || `Status update failed: ${res.status}` },
        { status: res.status },
      );
    }
    return redirect(`/admin/leads/${id}`);
  }

  if (intent === "fields") {
    const vehicleInfo = String(formData.get("vehicle_info") || "").trim();
    const partRequested = String(formData.get("part_requested") || "").trim();
    const internalNote = String(formData.get("internal_note") || "").trim();
    const followUpRaw = String(formData.get("next_follow_up_at") || "").trim();

    // Conversion datetime-local (sans TZ) → ISO TZ-aware locale machine.
    const followUpIso = followUpRaw
      ? new Date(followUpRaw).toISOString()
      : null;

    const body = {
      vehicle_info: vehicleInfo || null,
      part_requested: partRequested || null,
      internal_note: internalNote || null,
      next_follow_up_at: followUpIso,
    };

    const res = await fetch(`${baseUrl}/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res
        .json()
        .catch(() => ({ message: "Mise à jour échouée" }));
      return data(
        { error: errBody.message || `Fields update failed: ${res.status}` },
        { status: res.status },
      );
    }
    return redirect(`/admin/leads/${id}`);
  }

  if (intent === "clear_follow_up") {
    const res = await fetch(`${baseUrl}/api/admin/leads/${id}/follow-up`, {
      method: "DELETE",
      headers: { Accept: "application/json", Cookie: cookie },
    });
    if (!res.ok) {
      return data(
        { error: `Clear follow-up failed: ${res.status}` },
        { status: res.status },
      );
    }
    return redirect(`/admin/leads/${id}`);
  }

  return data({ error: "Intent inconnu" }, { status: 400 });
}

export default function AdminLeadDetail() {
  const { lead } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const allowedTargets = LEAD_TRANSITIONS[lead.msg_crm_status];
  const customerName =
    [lead.customer?.cst_fname, lead.customer?.cst_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "—";

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link
          to="/admin/leads"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour à la liste
        </Link>
        <Badge variant="outline">
          Statut : {STATUS_LABEL[lead.msg_crm_status]}
        </Badge>
      </div>

      {actionData?.error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            {actionData.error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{lead.msg_subject}</h1>
          <p className="text-sm text-muted-foreground">
            Lead #{lead.msg_id} —{" "}
            {new Date(lead.msg_date).toLocaleString("fr-FR", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium">Client :</span> {customerName}
            {lead.customer?.cst_mail && <> — {lead.customer.cst_mail}</>}
            {lead.customer?.cst_phone && <> — {lead.customer.cst_phone}</>}
          </div>
          {lead.msg_crm_source_page && (
            <div className="text-muted-foreground">
              <span className="font-medium">Page d&apos;origine :</span>{" "}
              {lead.msg_crm_source_page}
            </div>
          )}
          <div>
            <span className="font-medium">Message :</span>
            <pre className="mt-1 whitespace-pre-wrap break-words bg-muted/30 p-3 rounded text-xs">
              {lead.msg_content}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Transition de statut</h2>
        </CardHeader>
        <CardContent>
          {allowedTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Statut terminal — aucune transition possible.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowedTargets.map((target) => (
                <Form method="post" key={target} className="inline">
                  <input type="hidden" name="intent" value="status" />
                  <input type="hidden" name="status" value={target} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                  >
                    → {STATUS_LABEL[target]}
                  </Button>
                </Form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Qualification & relance</h2>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="fields" />

            <label className="block text-sm">
              <span className="font-medium">Véhicule (texte libre)</span>
              <Input
                name="vehicle_info"
                defaultValue={lead.msg_crm_vehicle_info ?? ""}
                maxLength={500}
                placeholder="ex. Renault Clio IV 2015 1.5 dCi"
                className="mt-1"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Pièce demandée</span>
              <Input
                name="part_requested"
                defaultValue={lead.msg_crm_part_requested ?? ""}
                maxLength={500}
                placeholder="ex. Plaquettes avant"
                className="mt-1"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Note interne</span>
              <Textarea
                name="internal_note"
                defaultValue={lead.msg_crm_internal_note ?? ""}
                maxLength={4000}
                rows={4}
                placeholder="Notes commerciales (non visibles client)…"
                className="mt-1"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Prochaine relance</span>
              <Input
                type="datetime-local"
                name="next_follow_up_at"
                defaultValue={isoToDatetimeLocal(
                  lead.msg_crm_next_follow_up_at,
                )}
                className="mt-1"
              />
            </label>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" /> Enregistrer
              </Button>
              {lead.msg_crm_next_follow_up_at && (
                <Form method="post">
                  <input type="hidden" name="intent" value="clear_follow_up" />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                  >
                    Effacer la relance
                  </Button>
                </Form>
              )}
            </div>
          </Form>
        </CardContent>
      </Card>

      {lead.msg_crm_updated_at && (
        <p className="text-xs text-muted-foreground text-right">
          Dernier write CRM :{" "}
          {new Date(lead.msg_crm_updated_at).toLocaleString("fr-FR")}
        </p>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorGeneric
        status={error.status}
        message={
          typeof error.data === "object" && error.data && "error" in error.data
            ? String((error.data as { error: unknown }).error)
            : "Impossible de charger ce lead."
        }
      />
    );
  }
  return <ErrorGeneric message="Une erreur inattendue est survenue." />;
}
